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
            
            # For 2025+, Alpaca free tier blocks default SIP feed.
            # Use feed=iex which is free for real-time data.
            # For pre-2025, use default (SIP historical is free).
            if current_start.year >= 2025:
                feed_options = ["&feed=iex"]
            else:
                feed_options = ["", "&feed=iex"]
            
            base_url = (
                f"https://data.alpaca.markets/v2/stocks/bars"
                f"?symbols={syms}"
                f"&timeframe=1Week"
                f"&start={current_start.strftime('%Y-%m-%d')}"
                f"&end={current_end.strftime('%Y-%m-%d')}"
                f"&limit=10000"
                f"&adjustment=split"
            )
            
            fetched = False
            for feed_param in feed_options:
                if fetched:
                    break
                url = base_url + feed_param
                req = urllib.request.Request(url)
                req.add_header("APCA-API-KEY-ID", api_key)
                req.add_header("APCA-API-SECRET-KEY", api_secret)
                
                try:
                    with urllib.request.urlopen(req, timeout=30) as resp:
                        data = json.loads(resp.read().decode())
                    
                    if "bars" in data:
                        for sym, bars in data["bars"].items():
                            if sym not in all_prices:
                                all_prices[sym] = {}
                            for bar in bars:
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
                    
                    fetched = True
                except Exception as e:
                    print(f"  Warning: Failed to fetch {batch[0]}..{batch[-1]} for {current_start.year} (feed={feed_param or 'default'}): {e}")
                    # Continue to next feed option
            
            current_start = current_end
            
        print(f"  Fetched {len(batch)} tickers: {batch[0]}...{batch[-1]} ({sum(len(v) for k, v in all_prices.items() if k in batch)} data points)")
    
    # Backfill missing 2025+ data from Finnhub
    import time
    finnhub_key = os.environ.get("FINNHUB_KEY", "")
    if finnhub_key:
        gap_start = datetime(2025, 1, 1)
        gap_end = end_date
        gap_start_ts = int(gap_start.timestamp())
        gap_end_ts = int(gap_end.timestamp())
        
        # Find ALL tickers that are missing 2025+ data
        tickers_needing_backfill = []
        for t in ticker_list:
            if t not in all_prices:
                tickers_needing_backfill.append(t)
                continue
            has_2025 = any(d >= "2025-01-01" for d in all_prices[t])
            if not has_2025:
                tickers_needing_backfill.append(t)
        
        if tickers_needing_backfill:
            print(f"\n  Backfilling {len(tickers_needing_backfill)} tickers with 2025+ data from Finnhub...")
            backfill_count = 0
            for t in tickers_needing_backfill:
                url = (
                    f"https://finnhub.io/api/v1/stock/candle"
                    f"?symbol={t}&resolution=W"
                    f"&from={gap_start_ts}&to={gap_end_ts}"
                    f"&token={finnhub_key}"
                )
                try:
                    req = urllib.request.Request(url)
                    with urllib.request.urlopen(req, timeout=15) as resp:
                        data = json.loads(resp.read().decode())
                    if data.get("s") == "ok" and data.get("c"):
                        if t not in all_prices:
                            all_prices[t] = {}
                        for close, ts in zip(data["c"], data["t"]):
                            date = datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d")
                            all_prices[t][date] = close
                        backfill_count += 1
                except Exception as e:
                    pass  # Skip silently, Finnhub rate limits
                time.sleep(0.5)  # Rate limit: stay under 60/min
            
            print(f"  Backfilled {backfill_count}/{len(tickers_needing_backfill)} tickers from Finnhub")
            total_points = sum(len(v) for v in all_prices.values())
            print(f"  Total price data points after backfill: {total_points}")
    
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
    
    # Process week by week using TIME-WEIGHTED RETURN
    # Each week: portfolio_value = sum(shares * price)
    # When cash flows happen (buy/sell), we calculate the sub-period return
    # and chain-multiply. This isolates pure investment performance from
    # the effect of adding/removing money.
    
    history = []
    event_idx = 0
    prev_value = None  # Portfolio value at start of current sub-period
    cumulative_growth = 1.0  # Chained return factor
    
    for friday in fridays:
        friday_str = friday.strftime("%Y-%m-%d")
        
        # Track cash flows that happened this week
        week_flows = 0  # Net cash flow: positive = money added (purchase), negative = money removed (sale)
        
        # Apply all events up to and including this Friday
        while event_idx < len(all_events) and all_events[event_idx]["date"] <= friday_str:
            evt = all_events[event_idx]
            
            if evt["kind"] == "stock":
                if evt["type"] == "PURCHASE":
                    holdings[evt["ticker"]] += evt["shares"]
                    week_flows += evt["amount"]  # Money flowing INTO portfolio
                elif evt["type"] == "SALE":
                    holdings[evt["ticker"]] -= evt["shares"]
                    if holdings[evt["ticker"]] <= 0.0001:
                        holdings[evt["ticker"]] = 0
                    week_flows -= evt["amount"]  # Money flowing OUT of portfolio
                elif evt["type"] == "DIVIDEND REINVESTMENT":
                    holdings[evt["ticker"]] += evt["shares"]
                    # No cash flow — dividend is internal return
            
            event_idx += 1
        
        # Calculate current portfolio value (stock holdings only)
        stock_value = 0
        held_tickers = {t: s for t, s in holdings.items() if s > 0}
        
        for ticker, shares in held_tickers.items():
            price = get_price_on_date(prices, ticker, friday, fridays)
            if price is not None:
                stock_value += shares * price
            else:
                for evt in reversed(all_events[:event_idx]):
                    if evt.get("ticker") == ticker and evt.get("price", 0) > 0:
                        stock_value += shares * evt["price"]
                        break
        
        # Calculate time-weighted return for this period
        if prev_value is not None and prev_value > 0:
            # Value BEFORE cash flows happened = current value - net flows
            # Return = (end_value) / (start_value + cash_flows)
            adjusted_start = prev_value + week_flows
            if adjusted_start > 0:
                period_return = stock_value / adjusted_start
                cumulative_growth *= period_return
        
        prev_value = stock_value
        
        # Portfolio value = $100K * cumulative growth factor
        display_value = round(start_balance * cumulative_growth, 2) if cumulative_growth > 0 else start_balance
        
        history.append({
            "date": friday_str,
            "value": display_value,
            "stocks": round(stock_value, 2),
            "cash": 0,
            "num_holdings": len(held_tickers),
        })
    
    return history


def fetch_benchmark_history(benchmark_ticker, start_date, end_date, start_value=100000):
    """Fetch benchmark weekly prices from Alpaca and normalize to start_value."""
    import urllib.request
    import os
    
    api_key = os.environ.get("ALPACA_KEY", "")
    api_secret = os.environ.get("ALPACA_SECRET", "")
    
    if not api_key or not api_secret:
        print(f"  ERROR: No Alpaca keys, skipping {benchmark_ticker}")
        return []
    
    all_bars = []
    
    # Fetch year by year (same approach as portfolio stocks)
    current_start = start_date
    while current_start < end_date:
        current_end = min(current_start.replace(year=current_start.year + 1), end_date)
        
        url = (
            f"https://data.alpaca.markets/v2/stocks/bars"
            f"?symbols={benchmark_ticker}"
            f"&timeframe=1Week"
            f"&start={current_start.strftime('%Y-%m-%d')}"
            f"&end={current_end.strftime('%Y-%m-%d')}"
            f"&limit=10000"
            f"&adjustment=split"
            f"&feed=iex"
        )
        
        try:
            req = urllib.request.Request(url)
            req.add_header("APCA-API-KEY-ID", api_key)
            req.add_header("APCA-API-SECRET-KEY", api_secret)
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode())
            if "bars" in data and benchmark_ticker in data["bars"]:
                all_bars.extend(data["bars"][benchmark_ticker])
            
            # Pagination
            next_token = data.get("next_page_token")
            while next_token:
                purl = url + f"&page_token={next_token}"
                req2 = urllib.request.Request(purl)
                req2.add_header("APCA-API-KEY-ID", api_key)
                req2.add_header("APCA-API-SECRET-KEY", api_secret)
                with urllib.request.urlopen(req2, timeout=30) as resp2:
                    data2 = json.loads(resp2.read().decode())
                if "bars" in data2 and benchmark_ticker in data2["bars"]:
                    all_bars.extend(data2["bars"][benchmark_ticker])
                next_token = data2.get("next_page_token")
        except Exception as e:
            print(f"    Warning: {benchmark_ticker} {current_start.year}: {e}")
        
        current_start = current_end
    
    if not all_bars:
        print(f"    No bars returned for {benchmark_ticker}")
        return []
    
    print(f"    {len(all_bars)} weekly bars fetched")
    
    # Normalize to start_value
    first_close = all_bars[0]["c"]
    history = []
    for bar in all_bars:
        date = bar["t"][:10]
        normalized = (bar["c"] / first_close) * start_value
        history.append({"date": date, "value": round(normalized, 2)})
    
    return history


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
        print(f"  End cash: ${history[-1]['cash']:,.2f}")
        print(f"  End stocks: ${history[-1]['stocks']:,.2f}")
        total_return = ((history[-1]['value'] / history[0]['value']) - 1) * 100
        print(f"  Total return: {total_return:+.2f}%")
        # Sample data points
        for pt in [history[0], history[len(history)//2], history[-1]]:
            print(f"    {pt['date']}: ${pt['value']:>12,.2f} (stocks: ${pt['stocks']:>12,.2f}, cash: ${pt['cash']:>10,.2f}, holdings: {pt['num_holdings']})")
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
