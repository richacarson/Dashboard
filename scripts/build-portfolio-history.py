#!/usr/bin/env python3
"""
IOWN Portfolio History Builder
Parses transaction data, fetches historical weekly prices from Polygon.io,
and outputs portfolio-history.json for the dashboard chart.
"""

import re
import json
import sys
import time
from datetime import datetime, timedelta
from collections import defaultdict


def parse_transactions(filepath):
    """Parse the Morningstar transaction text file."""
    with open(filepath) as f:
        lines = f.readlines()
    
    current_ticker = None
    transactions = []
    cash_transactions = []
    current_holdings = {}  # From file headers: ticker -> {shares, price, value}
    in_cash = False
    
    for line in lines:
        raw = line.rstrip('\r\n')
        
        # CASH$ section — parse the cash balance from header
        if raw.startswith("CASH$"):
            in_cash = True
            current_ticker = None
            cash_header = re.match(r'^CASH\$\t[^\t]+\t--\t--\t([\d,.]+)', raw)
            if cash_header:
                current_holdings["__CASH__"] = float(cash_header.group(1).replace(",", ""))
            continue
        
        # Ticker header line
        m = re.match(r'^([A-Z][A-Z0-9]{0,5})\t(.+)\t([\d.]+)\t([\d.]+)\t([\d,.]+)', raw)
        if m and "CASH$" not in raw:
            current_ticker = m.group(1)
            shares = float(m.group(3))
            price = float(m.group(4))
            value = float(m.group(5).replace(",", ""))
            if shares > 0 and current_ticker not in current_holdings:
                current_holdings[current_ticker] = {
                    "shares": shares, "price": price, "value": value
                }
            in_cash = False
            continue
        
        # Parse date-based entries
        tm = re.match(r'^\s+(\d{2}-\d{2}-\d{2})\t(\w[\w\s]*?)\t', raw)
        if not tm:
            continue
            
        date_str = tm.group(1)
        month, day, year = date_str.split("-")
        yr = int(year)
        full_year = 2000 + yr if yr < 50 else 1900 + yr
        d = f"{full_year}-{month}-{day}"
        
        # Stock transactions
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
        
        # Cash transactions
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
    
    transactions.sort(key=lambda x: x["date"])
    cash_transactions.sort(key=lambda x: x["date"])
    
    return transactions, cash_transactions, current_holdings


def get_all_fridays(start_date, end_date):
    """Get all Friday dates between start and end."""
    fridays = []
    d = start_date
    while d <= end_date:
        if d.weekday() == 4:
            fridays.append(d)
        d += timedelta(days=1)
    return fridays


def fetch_polygon_prices(tickers, start_date, end_date):
    """
    Fetch weekly close prices from Polygon.io for all tickers.
    Uses /v2/aggs/ticker/{ticker}/range/1/week/{from}/{to}
    Free tier: 5 calls/minute.
    """
    import urllib.request
    import os
    
    api_key = os.environ.get("POLYGON_KEY", "")
    if not api_key:
        print("  ERROR: POLYGON_KEY not set!")
        return {}
    
    all_prices = {}
    ticker_list = sorted(tickers)
    start_str = start_date.strftime("%Y-%m-%d")
    end_str = end_date.strftime("%Y-%m-%d")
    
    call_count = 0
    
    for i, ticker in enumerate(ticker_list):
        # Rate limit: 5 calls/min on free tier
        if call_count >= 5:
            print(f"    Rate limit pause (60s)... [{i}/{len(ticker_list)}]")
            time.sleep(61)
            call_count = 0
        
        url = (
            f"https://api.polygon.io/v2/aggs/ticker/{ticker}/range/1/week/{start_str}/{end_str}"
            f"?adjusted=true&sort=asc&limit=50000&apiKey={api_key}"
        )
        
        try:
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode())
            
            call_count += 1
            
            if data.get("resultsCount", 0) > 0 and data.get("results"):
                all_prices[ticker] = {}
                for bar in data["results"]:
                    # bar["t"] is Unix timestamp in milliseconds
                    ts = bar["t"] / 1000
                    date = datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d")
                    all_prices[ticker][date] = bar["c"]  # Close price
                
        except Exception as e:
            print(f"    Warning: {ticker}: {e}")
            call_count += 1
        
        # Progress every 10 tickers
        if (i + 1) % 10 == 0:
            total_pts = sum(len(v) for v in all_prices.values())
            print(f"    Progress: {i+1}/{len(ticker_list)} tickers, {total_pts} data points")
    
    return all_prices


def get_price_on_date(prices, ticker, target_date, fridays_list):
    """Get the closest available price for a ticker on or before target_date."""
    date_str = target_date.strftime("%Y-%m-%d")
    
    if ticker not in prices:
        return None
    
    ticker_prices = prices[ticker]
    
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


def build_portfolio_history(transactions, cash_transactions, prices, start_balance=100000, current_holdings=None):
    """
    Replay all transactions chronologically and calculate weekly portfolio values.
    
    Cash: Only small deposits (<$500) are dividend income.
    Large deposits/withdrawals are rebalancing (already in buy/sell).
    """
    DIVIDEND_THRESHOLD = 500
    dividend_deposits = [ctx for ctx in cash_transactions 
                        if ctx["type"] == "DEPOSIT" and ctx["amount"] < DIVIDEND_THRESHOLD]
    
    total_div = sum(d["amount"] for d in dividend_deposits)
    print(f"  Dividend deposits (<${DIVIDEND_THRESHOLD}): {len(dividend_deposits)} entries, ${total_div:,.2f}")
    
    all_events = []
    for tx in transactions:
        all_events.append({"date": tx["date"], "kind": "stock", **tx})
    for ctx in dividend_deposits:
        all_events.append({"date": ctx["date"], "kind": "cash", **ctx})
    all_events.sort(key=lambda x: x["date"])
    
    holdings = defaultdict(float)
    cash = start_balance
    
    if not all_events:
        return []
    
    start_date = datetime.strptime(all_events[0]["date"], "%Y-%m-%d")
    end_date = datetime.now()
    fridays = get_all_fridays(start_date - timedelta(days=7), end_date)
    
    history = []
    event_idx = 0
    
    for friday in fridays:
        friday_str = friday.strftime("%Y-%m-%d")
        
        while event_idx < len(all_events) and all_events[event_idx]["date"] <= friday_str:
            evt = all_events[event_idx]
            
            if evt["kind"] == "stock":
                if evt["type"] == "PURCHASE":
                    holdings[evt["ticker"]] += evt["shares"]
                    cash -= evt["amount"]
                elif evt["type"] == "SALE":
                    holdings[evt["ticker"]] -= evt["shares"]
                    if holdings[evt["ticker"]] <= 0.0001:
                        holdings[evt["ticker"]] = 0
                    cash += evt["amount"]
                elif evt["type"] == "DIVIDEND REINVESTMENT":
                    holdings[evt["ticker"]] += evt["shares"]
            
            elif evt["kind"] == "cash":
                if evt["type"] == "DEPOSIT":
                    cash += evt["amount"]
            
            event_idx += 1
        
        stock_value = 0
        held_tickers = {t: s for t, s in holdings.items() if s > 0}
        
        for ticker, shares in held_tickers.items():
            price = get_price_on_date(prices, ticker, friday, fridays)
            if price is not None:
                stock_value += shares * price
            else:
                # Fallback to transaction price
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
    
    # Override last point with Morningstar ground truth from file headers
    if current_holdings and history:
        gt_cash_from_file = current_holdings.pop("__CASH__", None)
        gt_stocks = sum(h["value"] for h in current_holdings.values())
        gt_cash = gt_cash_from_file if gt_cash_from_file is not None else cash
        gt_total = gt_stocks + gt_cash
        gt_holdings = len(current_holdings)
        history[-1]["value"] = round(gt_total, 2)
        history[-1]["stocks"] = round(gt_stocks, 2)
        history[-1]["cash"] = round(gt_cash, 2)
        history[-1]["num_holdings"] = gt_holdings
        print(f"  Ground truth endpoint: stocks=${gt_stocks:,.2f}, cash=${gt_cash:,.2f}, total=${gt_total:,.2f}, holdings={gt_holdings}")
    
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
    transactions, cash_transactions, current_holdings = parse_transactions(tx_file)
    print(f"  Stock transactions: {len(transactions)}")
    print(f"  Cash transactions: {len(cash_transactions)}")
    
    if not transactions:
        print("ERROR: No transactions found!")
        sys.exit(1)
    
    all_tickers = set(tx["ticker"] for tx in transactions)
    print(f"  Unique tickers: {len(all_tickers)}")
    print(f"  Current holdings (from file headers): {len([k for k in current_holdings if k != '__CASH__'])} tickers, ${sum(h['value'] for k, h in current_holdings.items() if k != '__CASH__'):,.2f}")
    
    start_date = datetime.strptime(transactions[0]["date"], "%Y-%m-%d")
    end_date = datetime.now()
    print(f"  Date range: {start_date.date()} to {end_date.date()}")
    print()
    
    # Fetch historical prices from Polygon.io
    print("Fetching historical weekly prices from Polygon.io...")
    print(f"  (Free tier: 5 calls/min, {len(all_tickers)} tickers = ~{len(all_tickers)//5 + 1} minutes)")
    prices = fetch_polygon_prices(all_tickers, start_date, end_date)
    total_points = sum(len(v) for v in prices.values())
    print(f"  Total price data points: {total_points}")
    print(f"  Tickers with data: {len(prices)}/{len(all_tickers)}")
    missing = all_tickers - set(prices.keys())
    if missing:
        print(f"  Missing price data: {sorted(missing)}")
    print()
    
    # Build portfolio history
    print("Building portfolio history...")
    history = build_portfolio_history(transactions, cash_transactions, prices, current_holdings=current_holdings)
    print(f"  Weekly data points: {len(history)}")
    if history:
        print(f"  Start value: ${history[0]['value']:,.2f}")
        print(f"  End value: ${history[-1]['value']:,.2f}")
        print(f"  End cash: ${history[-1]['cash']:,.2f}")
        print(f"  End stocks: ${history[-1]['stocks']:,.2f}")
        total_return = ((history[-1]['value'] / history[0]['value']) - 1) * 100
        print(f"  Total return: {total_return:+.2f}%")
        for pt in [history[0], history[len(history)//2], history[-1]]:
            print(f"    {pt['date']}: ${pt['value']:>12,.2f} (stocks: ${pt['stocks']:>12,.2f}, cash: ${pt['cash']:>10,.2f}, holdings: {pt['num_holdings']})")
    print()
    
    # Output (no benchmarks for now)
    output = {
        "sleeve": sleeve_name,
        "generated": datetime.now().isoformat(),
        "start_balance": 100000,
        "start_date": start_date.strftime("%Y-%m-%d"),
        "end_date": end_date.strftime("%Y-%m-%d"),
        "portfolio": history,
        "benchmarks": {},
    }
    
    out_file = f"portfolio-history-{sleeve_name}.json"
    with open(out_file, "w") as f:
        json.dump(output, f)
    
    import os as _os
    print(f"Output written to {out_file}")
    print(f"File size: {_os.path.getsize(out_file) / 1024:.1f} KB")
    print("Done!")


if __name__ == "__main__":
    main()
