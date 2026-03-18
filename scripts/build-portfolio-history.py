#!/usr/bin/env python3
"""
IOWN Portfolio History Builder
Parses transaction data, fetches historical weekly prices,
and outputs portfolio-history.json for the dashboard chart.

Price sources:
- Alpaca (free): 2011-2024 weekly bars (SIP historical, accurate)
- Polygon.io (free): 2024-2026 weekly bars (official NYSE/NASDAQ closes)
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
    current_holdings = {}
    in_cash = False
    
    for line in lines:
        raw = line.rstrip('\r\n')
        
        if raw.startswith("CASH$"):
            in_cash = True
            current_ticker = None
            cash_header = re.match(r'^CASH\$\t[^\t]+\t--\t--\t([\d,.]+)', raw)
            if cash_header:
                current_holdings["__CASH__"] = float(cash_header.group(1).replace(",", ""))
            continue
        
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
        
        tm = re.match(r'^\s+(\d{2}-\d{2}-\d{2})\t(\w[\w\s]*?)\t', raw)
        if not tm:
            continue
        date_str = tm.group(1)
        month, day, year = date_str.split("-")
        yr = int(year)
        full_year = 2000 + yr if yr < 50 else 1900 + yr
        d = f"{full_year}-{month}-{day}"
        
        stock_m = re.match(
            r'^\s+\d{2}-\d{2}-\d{2}\t(PURCHASE|SALE|DIVIDEND REINVESTMENT)\t([\d.]+)\t([\d.]+)\t([\d,.]+)', raw)
        if stock_m and current_ticker:
            transactions.append({
                "date": d, "ticker": current_ticker, "type": stock_m.group(1),
                "shares": float(stock_m.group(2)), "price": float(stock_m.group(3)),
                "amount": float(stock_m.group(4).replace(",", "")),
            })
            continue
        
        cash_m = re.match(r'^\s+\d{2}-\d{2}-\d{2}\t(DEPOSIT|WITHDRAWAL)\t--\t--\t([\d,.]+)', raw)
        if cash_m:
            cash_transactions.append({
                "date": d, "type": cash_m.group(1),
                "amount": float(cash_m.group(2).replace(",", "")),
            })
    
    transactions.sort(key=lambda x: x["date"])
    cash_transactions.sort(key=lambda x: x["date"])
    return transactions, cash_transactions, current_holdings


def get_all_fridays(start_date, end_date):
    fridays = []
    d = start_date
    while d <= end_date:
        if d.weekday() == 4:
            fridays.append(d)
        d += timedelta(days=1)
    return fridays


def fetch_alpaca_prices(tickers, start_date, end_date):
    """Fetch weekly bars from Alpaca for 2011-2024 (SIP historical, free)."""
    import urllib.request, os
    
    api_key = os.environ.get("ALPACA_KEY", "")
    api_secret = os.environ.get("ALPACA_SECRET", "")
    if not api_key or not api_secret:
        print("  WARNING: No Alpaca keys, skipping Alpaca fetch")
        return {}
    
    all_prices = {}
    ticker_list = sorted(tickers)
    
    # Cap end date at 2024-12-31 (Alpaca 403s for 2025+)
    alpaca_end = min(end_date, datetime(2024, 12, 31))
    if start_date >= alpaca_end:
        return {}
    
    for batch_start in range(0, len(ticker_list), 30):
        batch = ticker_list[batch_start:batch_start + 30]
        current_start = start_date
        while current_start < alpaca_end:
            current_end = min(current_start.replace(year=current_start.year + 1), alpaca_end)
            syms = ",".join(batch)
            url = (
                f"https://data.alpaca.markets/v2/stocks/bars"
                f"?symbols={syms}&timeframe=1Week"
                f"&start={current_start.strftime('%Y-%m-%d')}"
                f"&end={current_end.strftime('%Y-%m-%d')}"
                f"&limit=10000&adjustment=split"
            )
            try:
                req = urllib.request.Request(url)
                req.add_header("APCA-API-KEY-ID", api_key)
                req.add_header("APCA-API-SECRET-KEY", api_secret)
                with urllib.request.urlopen(req, timeout=30) as resp:
                    data = json.loads(resp.read().decode())
                if "bars" in data:
                    for sym, bars in data["bars"].items():
                        if sym not in all_prices:
                            all_prices[sym] = {}
                        for bar in bars:
                            all_prices[sym][bar["t"][:10]] = bar["c"]
                next_token = data.get("next_page_token")
                while next_token:
                    purl = url + f"&page_token={next_token}"
                    req2 = urllib.request.Request(purl)
                    req2.add_header("APCA-API-KEY-ID", api_key)
                    req2.add_header("APCA-API-SECRET-KEY", api_secret)
                    with urllib.request.urlopen(req2, timeout=30) as resp2:
                        data2 = json.loads(resp2.read().decode())
                    if "bars" in data2:
                        for sym, bars in data2["bars"].items():
                            if sym not in all_prices:
                                all_prices[sym] = {}
                            for bar in bars:
                                all_prices[sym][bar["t"][:10]] = bar["c"]
                    next_token = data2.get("next_page_token")
            except Exception as e:
                print(f"  Warning: Alpaca {batch[0]}..{batch[-1]} {current_start.year}: {e}")
            current_start = current_end
        
        pts = sum(len(v) for k, v in all_prices.items() if k in batch)
        print(f"  Alpaca: {batch[0]}...{batch[-1]} ({pts} points)")
    
    return all_prices


def fetch_polygon_prices(tickers, start_date, end_date):
    """Fetch weekly bars from Polygon.io for 2024+ (official closes, free 2yr)."""
    import urllib.request, os
    
    api_key = os.environ.get("POLYGON_KEY", "")
    if not api_key:
        print("  WARNING: No POLYGON_KEY, skipping Polygon fetch")
        return {}
    
    # Polygon free tier: 2 years history, 5 calls/min
    polygon_start = max(start_date, datetime(2024, 1, 1))
    start_str = polygon_start.strftime("%Y-%m-%d")
    end_str = end_date.strftime("%Y-%m-%d")
    
    all_prices = {}
    ticker_list = sorted(tickers)
    call_count = 0
    
    print(f"  Polygon: fetching {len(ticker_list)} tickers ({start_str} to {end_str})")
    print(f"  Rate limit: 5 calls/min, estimated {len(ticker_list) // 5 + 1} minutes")
    
    for i, ticker in enumerate(ticker_list):
        if call_count >= 5:
            elapsed_tickers = i
            remaining = len(ticker_list) - i
            est_min = remaining // 5 + 1
            print(f"    Rate limit pause... [{i}/{len(ticker_list)}] ~{est_min} min remaining")
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
                if ticker not in all_prices:
                    all_prices[ticker] = {}
                for bar in data["results"]:
                    ts = bar["t"] / 1000
                    date = datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d")
                    all_prices[ticker][date] = bar["c"]
        except Exception as e:
            print(f"    Warning: {ticker}: {e}")
            call_count += 1
        
        if (i + 1) % 10 == 0:
            total_pts = sum(len(v) for v in all_prices.values())
            print(f"    Progress: {i+1}/{len(ticker_list)} tickers, {total_pts} data points")
    
    total_pts = sum(len(v) for v in all_prices.values())
    print(f"  Polygon complete: {len(all_prices)} tickers, {total_pts} data points")
    return all_prices


def get_price_on_date(prices, ticker, target_date, fridays_list):
    date_str = target_date.strftime("%Y-%m-%d")
    if ticker not in prices:
        return None
    tp = prices[ticker]
    if date_str in tp:
        return tp[date_str]
    for delta in range(1, 11):
        check = (target_date - timedelta(days=delta)).strftime("%Y-%m-%d")
        if check in tp:
            return tp[check]
    for delta in range(1, 6):
        check = (target_date + timedelta(days=delta)).strftime("%Y-%m-%d")
        if check in tp:
            return tp[check]
    return None


def build_portfolio_history(transactions, cash_transactions, prices, start_balance=100000, current_holdings=None):
    """
    Replay all transactions and calculate weekly portfolio values.
    Cash: only small deposits (<$500) as dividend income.
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
    
    # Override last point with file header ground truth
    if current_holdings and history:
        gt_cash = current_holdings.pop("__CASH__", None)
        gt_stocks = sum(h["value"] for h in current_holdings.values())
        if gt_cash is None:
            gt_cash = cash
        gt_total = gt_stocks + gt_cash
        gt_holdings = len(current_holdings)
        history[-1]["value"] = round(gt_total, 2)
        history[-1]["stocks"] = round(gt_stocks, 2)
        history[-1]["cash"] = round(gt_cash, 2)
        history[-1]["num_holdings"] = gt_holdings
        print(f"  Ground truth endpoint: ${gt_total:,.2f} (stocks=${gt_stocks:,.2f} cash=${gt_cash:,.2f}) {gt_holdings} holdings")
    
    return history


def main():
    import os
    
    tx_file = sys.argv[1] if len(sys.argv) > 1 else "dividend_strategy_transactions.txt"
    sleeve_name = sys.argv[2] if len(sys.argv) > 2 else "dividend"
    
    print(f"=== IOWN Portfolio History Builder ===")
    print(f"Sleeve: {sleeve_name}")
    print()
    
    print("Parsing transactions...")
    transactions, cash_transactions, current_holdings = parse_transactions(tx_file)
    print(f"  Stock txns: {len(transactions)}, Cash txns: {len(cash_transactions)}")
    
    all_tickers = set(tx["ticker"] for tx in transactions)
    gt_count = len([k for k in current_holdings if k != "__CASH__"])
    gt_value = sum(h["value"] for k, h in current_holdings.items() if k != "__CASH__")
    print(f"  {len(all_tickers)} unique tickers, {gt_count} current holdings (${gt_value:,.2f})")
    
    start_date = datetime.strptime(transactions[0]["date"], "%Y-%m-%d")
    end_date = datetime.now()
    print(f"  Date range: {start_date.date()} to {end_date.date()}")
    print()
    
    # === HYBRID PRICE FETCH ===
    # Phase 1: Alpaca for 2011-2024 (free SIP historical)
    print("Phase 1: Fetching 2011-2024 from Alpaca...")
    alpaca_prices = fetch_alpaca_prices(all_tickers, start_date, end_date)
    alpaca_pts = sum(len(v) for v in alpaca_prices.values())
    print(f"  Alpaca total: {len(alpaca_prices)} tickers, {alpaca_pts} data points")
    print()
    
    # Phase 2: Polygon for 2024-2026 (free tier, official closes)
    print("Phase 2: Fetching 2024-2026 from Polygon.io...")
    polygon_prices = fetch_polygon_prices(all_tickers, start_date, end_date)
    polygon_pts = sum(len(v) for v in polygon_prices.values())
    print(f"  Polygon total: {len(polygon_prices)} tickers, {polygon_pts} data points")
    print()
    
    # Merge: Polygon takes priority (more accurate official closes)
    print("Merging price data (Polygon priority for overlapping dates)...")
    merged = {}
    for ticker in all_tickers:
        merged[ticker] = {}
        if ticker in alpaca_prices:
            merged[ticker].update(alpaca_prices[ticker])
        if ticker in polygon_prices:
            merged[ticker].update(polygon_prices[ticker])  # Overwrites Alpaca for overlap
    
    total_pts = sum(len(v) for v in merged.values())
    tickers_with_data = sum(1 for v in merged.values() if v)
    missing = [t for t in all_tickers if not merged.get(t)]
    print(f"  Merged: {tickers_with_data}/{len(all_tickers)} tickers, {total_pts} data points")
    if missing:
        print(f"  Missing: {sorted(missing)}")
    print()
    
    # Build portfolio history
    print("Building portfolio history...")
    history = build_portfolio_history(transactions, cash_transactions, merged, current_holdings=current_holdings)
    print(f"  Weekly data points: {len(history)}")
    if history:
        print(f"  Start: ${history[0]['value']:,.2f}")
        print(f"  End:   ${history[-1]['value']:,.2f} (stocks=${history[-1]['stocks']:,.2f} cash=${history[-1]['cash']:,.2f})")
        ret = ((history[-1]['value'] / history[0]['value']) - 1) * 100
        print(f"  Return: {ret:+.2f}%")
    print()
    
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
    
    print(f"Output: {out_file} ({os.path.getsize(out_file) / 1024:.1f} KB)")
    print("Done!")


if __name__ == "__main__":
    main()
