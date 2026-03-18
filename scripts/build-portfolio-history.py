#!/usr/bin/env python3
"""
IOWN Portfolio History Builder
Parses transaction data, fetches historical weekly prices,
and outputs portfolio-history.json for the dashboard chart.
"""

import re
import json
import sys
from datetime import datetime, timedelta
from collections import defaultdict

def parse_transactions(filepath):
    """Parse the Morningstar transaction text file."""
    with open(filepath) as f:
        lines = f.readlines()
    
    current_ticker = None
    transactions = []
    cash_transactions = []
    in_cash = False
    
    for line in lines:
        raw = line.rstrip('\r\n')
        
        # CASH$ section
        if raw.startswith("CASH$"):
            in_cash = True
            current_ticker = None
            continue
        
        # Ticker header line (exits CASH$ section)
        m = re.match(r'^([A-Z][A-Z0-9]{0,5})\t(.+)\t([\d.]+)\t([\d.]+)\t', raw)
        if m and "CASH$" not in raw:
            current_ticker = m.group(1)
            in_cash = False
            continue
        
        # Parse date-based entries
        tm = re.match(r'^\s+(\d{2}-\d{2}-\d{2})\t(\w[\w\s]*?)\t', raw)
        if not tm:
            continue
            
        date_str = tm.group(1)
        tx_type = tm.group(2).strip()
        month, day, year = date_str.split("-")
        yr = int(year)
        full_year = 2000 + yr if yr < 50 else 1900 + yr
        d = f"{full_year}-{month}-{day}"
        
        # Stock transactions: PURCHASE, SALE, DIVIDEND REINVESTMENT
        stock_m = re.match(
            r'^\s+\d{2}-\d{2}-\d{2}\t(PURCHASE|SALE|DIVIDEND REINVESTMENT)\t([\d.]+)\t([\d.]+)\t([\d,.]+)',
            raw
        )
        if stock_m and current_ticker:
            transactions.append({
                "date": d,
                "ticker": current_ticker,
                "type": stock_m.group(1),
                "shares": float(stock_m.group(2)),
                "price": float(stock_m.group(3)),
                "amount": float(stock_m.group(4).replace(",", "")),
            })
            continue
        
        # Cash transactions: DEPOSIT, WITHDRAWAL
        cash_m = re.match(
            r'^\s+\d{2}-\d{2}-\d{2}\t(DEPOSIT|WITHDRAWAL)\t--\t--\t([\d,.]+)',
            raw
        )
        if cash_m:
            cash_transactions.append({
                "date": d,
                "type": cash_m.group(1),
                "amount": float(cash_m.group(2).replace(",", "")),
            })
    
    # Sort everything by date
    transactions.sort(key=lambda x: x["date"])
    cash_transactions.sort(key=lambda x: x["date"])
    
    return transactions, cash_transactions


def get_all_fridays(start_date, end_date):
    """Get all Friday dates between start and end."""
    fridays = []
    d = start_date
    while d <= end_date:
        if d.weekday() == 4:  # Friday
            fridays.append(d)
        d += timedelta(days=1)
    return fridays


def fetch_historical_prices(tickers, start_date, end_date):
    """
    Fetch weekly close prices for all tickers.
    Uses Alpaca bars API (free tier allows historical SIP data >15min old).
    Falls back to building from available data.
    """
    import urllib.request
    import os
    
    api_key = os.environ.get("ALPACA_KEY", "")
    api_secret = os.environ.get("ALPACA_SECRET", "")
    
    if not api_key or not api_secret:
        print("ERROR: Set ALPACA_KEY and ALPACA_SECRET environment variables")
        sys.exit(1)
    
    all_prices = {}  # { ticker: { "YYYY-MM-DD": close_price } }
    
    # Alpaca allows max 200 symbols per request, and limited date range
    # Fetch in chunks of 30 tickers, 1 year at a time
    ticker_list = sorted(tickers)
    
    for batch_start in range(0, len(ticker_list), 30):
        batch = ticker_list[batch_start:batch_start + 30]
        
        # Fetch year by year
        current_start = start_date
        while current_start < end_date:
            current_end = min(current_start.replace(year=current_start.year + 1), end_date)
            
            syms = ",".join(batch)
            url = (
                f"https://data.alpaca.markets/v2/stocks/bars"
                f"?symbols={syms}"
                f"&timeframe=1Week"
                f"&start={current_start.strftime('%Y-%m-%d')}"
                f"&end={current_end.strftime('%Y-%m-%d')}"
                f"&limit=10000"
                f"&adjustment=split"
            )
            
            req = urllib.request.Request(url)
            req.add_header("APCA-API-KEY-ID", api_key)
            req.add_header("APCA-API-SECRET-KEY", api_secret)
            
            try:
                with urllib.request.urlopen(req) as resp:
                    data = json.loads(resp.read().decode())
                
                if "bars" in data:
                    for sym, bars in data["bars"].items():
                        if sym not in all_prices:
                            all_prices[sym] = {}
                        for bar in bars:
                            # bar["t"] is like "2024-01-05T05:00:00Z"
                            bar_date = bar["t"][:10]
                            all_prices[sym][bar_date] = bar["c"]
                
                # Handle pagination
                next_token = data.get("next_page_token")
                while next_token:
                    purl = url + f"&page_token={next_token}"
                    req2 = urllib.request.Request(purl)
                    req2.add_header("APCA-API-KEY-ID", api_key)
                    req2.add_header("APCA-API-SECRET-KEY", api_secret)
                    with urllib.request.urlopen(req2) as resp2:
                        data2 = json.loads(resp2.read().decode())
                    if "bars" in data2:
                        for sym, bars in data2["bars"].items():
                            if sym not in all_prices:
                                all_prices[sym] = {}
                            for bar in bars:
                                bar_date = bar["t"][:10]
                                all_prices[sym][bar_date] = bar["c"]
                    next_token = data2.get("next_page_token")
                    
            except Exception as e:
                print(f"  Warning: Failed to fetch {syms} for {current_start.year}: {e}")
            
            current_start = current_end
            
        print(f"  Fetched {len(batch)} tickers: {batch[0]}...{batch[-1]} ({sum(len(v) for k, v in all_prices.items() if k in batch)} data points)")
    
    return all_prices


def get_price_on_date(prices, ticker, target_date, fridays_list):
    """Get the closest available price for a ticker on or before target_date."""
    date_str = target_date.strftime("%Y-%m-%d")
    
    if ticker not in prices:
        return None
    
    ticker_prices = prices[ticker]
    
    # Try exact date
    if date_str in ticker_prices:
        return ticker_prices[date_str]
    
    # Try nearby dates (within 10 days before)
    for delta in range(1, 11):
        check = (target_date - timedelta(days=delta)).strftime("%Y-%m-%d")
        if check in ticker_prices:
            return ticker_prices[check]
    
    # Try nearby dates (within 5 days after)
    for delta in range(1, 6):
        check = (target_date + timedelta(days=delta)).strftime("%Y-%m-%d")
        if check in ticker_prices:
            return ticker_prices[check]
    
    return None


def build_portfolio_history(transactions, cash_transactions, prices, start_balance=100000):
    """
    Replay all transactions chronologically and calculate weekly portfolio values.
    """
    # Combine and sort all events by date
    all_events = []
    for tx in transactions:
        all_events.append({"date": tx["date"], "kind": "stock", **tx})
    for ctx in cash_transactions:
        all_events.append({"date": ctx["date"], "kind": "cash", **ctx})
    all_events.sort(key=lambda x: x["date"])
    
    # State
    holdings = defaultdict(float)  # ticker -> shares
    cash = start_balance
    
    # Get date range
    if not all_events:
        return []
    
    start_date = datetime.strptime(all_events[0]["date"], "%Y-%m-%d")
    end_date = datetime.now()
    fridays = get_all_fridays(start_date - timedelta(days=7), end_date)
    
    # Build event index by date
    events_by_date = defaultdict(list)
    for evt in all_events:
        events_by_date[evt["date"]].append(evt)
    
    # Process week by week
    history = []
    event_idx = 0
    
    for friday in fridays:
        friday_str = friday.strftime("%Y-%m-%d")
        
        # Apply all events up to and including this Friday
        while event_idx < len(all_events) and all_events[event_idx]["date"] <= friday_str:
            evt = all_events[event_idx]
            
            if evt["kind"] == "stock":
                if evt["type"] == "PURCHASE":
                    holdings[evt["ticker"]] += evt["shares"]
                    cash -= evt["amount"]
                elif evt["type"] == "SALE":
                    holdings[evt["ticker"]] -= evt["shares"]
                    cash += evt["amount"]
                    # Clean up zero holdings
                    if holdings[evt["ticker"]] <= 0.0001:
                        holdings[evt["ticker"]] = 0
                elif evt["type"] == "DIVIDEND REINVESTMENT":
                    holdings[evt["ticker"]] += evt["shares"]
                    # Dividend reinvestment: shares added, cash neutral
                    # (the dividend was already deposited as cash, then used to buy shares)
            
            elif evt["kind"] == "cash":
                if evt["type"] == "DEPOSIT":
                    cash += evt["amount"]
                elif evt["type"] == "WITHDRAWAL":
                    cash -= evt["amount"]
            
            event_idx += 1
        
        # Calculate portfolio value
        stock_value = 0
        held_tickers = {t: s for t, s in holdings.items() if s > 0}
        
        for ticker, shares in held_tickers.items():
            price = get_price_on_date(prices, ticker, friday, fridays)
            if price is not None:
                stock_value += shares * price
            else:
                # Use the transaction price as fallback
                # Find most recent transaction for this ticker
                for evt in reversed(all_events[:event_idx]):
                    if evt.get("ticker") == ticker and evt.get("price", 0) > 0:
                        stock_value += shares * evt["price"]
                        break
        
        total_value = stock_value + cash
        
        history.append({
            "date": friday_str,
            "value": round(total_value, 2),
            "stocks": round(stock_value, 2),
            "cash": round(cash, 2),
            "num_holdings": len(held_tickers),
        })
    
    return history


def fetch_benchmark_history(benchmark_ticker, start_date, end_date, start_value=100000):
    """Fetch benchmark weekly prices from Finnhub and normalize to start_value."""
    import urllib.request
    import os
    
    finnhub_key = os.environ.get("FINNHUB_KEY", "")
    if not finnhub_key:
        print(f"  Warning: No FINNHUB_KEY set, skipping {benchmark_ticker}")
        return []
    
    # Finnhub candle endpoint — resolution W = weekly
    from_ts = int(start_date.timestamp())
    to_ts = int(end_date.timestamp())
    
    url = (
        f"https://finnhub.io/api/v1/stock/candle"
        f"?symbol={benchmark_ticker}"
        f"&resolution=W"
        f"&from={from_ts}"
        f"&to={to_ts}"
        f"&token={finnhub_key}"
    )
    
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
        
        if data.get("s") != "ok" or not data.get("c"):
            print(f"  Warning: Finnhub returned no data for {benchmark_ticker}")
            return []
        
        closes = data["c"]
        timestamps = data["t"]
        
        if not closes:
            return []
        
        # Normalize to start_value
        first_close = closes[0]
        history = []
        for i, (close, ts) in enumerate(zip(closes, timestamps)):
            date = datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d")
            normalized = (close / first_close) * start_value
            history.append({"date": date, "value": round(normalized, 2)})
        
        return history
        
    except Exception as e:
        print(f"  Warning: Failed to fetch benchmark {benchmark_ticker}: {e}")
        return []


def main():
    import os
    
    tx_file = sys.argv[1] if len(sys.argv) > 1 else "dividend_strategy_transactions.txt"
    sleeve_name = sys.argv[2] if len(sys.argv) > 2 else "dividend"
    
    print(f"=== IOWN Portfolio History Builder ===")
    print(f"Transaction file: {tx_file}")
    print(f"Sleeve: {sleeve_name}")
    print()
    
    # Parse transactions
    print("Parsing transactions...")
    transactions, cash_transactions = parse_transactions(tx_file)
    print(f"  Stock transactions: {len(transactions)}")
    print(f"  Cash transactions: {len(cash_transactions)}")
    
    if not transactions:
        print("ERROR: No transactions found!")
        sys.exit(1)
    
    # Get all unique tickers
    all_tickers = set(tx["ticker"] for tx in transactions)
    print(f"  Unique tickers: {len(all_tickers)}")
    
    start_date = datetime.strptime(transactions[0]["date"], "%Y-%m-%d")
    end_date = datetime.now()
    print(f"  Date range: {start_date.date()} to {end_date.date()}")
    print()
    
    # Fetch historical prices
    print("Fetching historical weekly prices from Alpaca...")
    prices = fetch_historical_prices(all_tickers, start_date, end_date)
    total_points = sum(len(v) for v in prices.values())
    print(f"  Total price data points: {total_points}")
    print(f"  Tickers with data: {len(prices)}/{len(all_tickers)}")
    missing = all_tickers - set(prices.keys())
    if missing:
        print(f"  Missing price data: {sorted(missing)}")
    print()
    
    # Build portfolio history
    print("Building portfolio history...")
    history = build_portfolio_history(transactions, cash_transactions, prices)
    print(f"  Weekly data points: {len(history)}")
    if history:
        print(f"  Start value: ${history[0]['value']:,.2f}")
        print(f"  End value: ${history[-1]['value']:,.2f}")
        total_return = ((history[-1]['value'] / history[0]['value']) - 1) * 100
        print(f"  Total return: {total_return:+.2f}%")
    print()
    
    # Fetch benchmarks
    benchmarks = ["SPY", "QQQ", "DIA", "DVY", "IWS", "IUSG"]
    benchmark_data = {}
    print("Fetching benchmark data from Finnhub...")
    import time
    for bm in benchmarks:
        print(f"  Fetching {bm}...")
        bm_history = fetch_benchmark_history(bm, start_date, end_date)
        if bm_history:
            benchmark_data[bm] = bm_history
            bm_return = ((bm_history[-1]["value"] / bm_history[0]["value"]) - 1) * 100
            print(f"    {len(bm_history)} points, return: {bm_return:+.2f}%")
        else:
            print(f"    No data available")
        time.sleep(1.5)  # Rate limit: 60 calls/min on Finnhub free tier
    print()
    
    # Output
    output = {
        "sleeve": sleeve_name,
        "generated": datetime.now().isoformat(),
        "start_balance": 100000,
        "start_date": start_date.strftime("%Y-%m-%d"),
        "end_date": end_date.strftime("%Y-%m-%d"),
        "portfolio": history,
        "benchmarks": benchmark_data,
    }
    
    out_file = f"portfolio-history-{sleeve_name}.json"
    with open(out_file, "w") as f:
        json.dump(output, f)
    
    print(f"Output written to {out_file}")
    print(f"File size: {os.path.getsize(out_file) / 1024:.1f} KB")
    print("Done!")


if __name__ == "__main__":
    main()
