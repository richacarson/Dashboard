#!/usr/bin/env python3
"""
IOWN Portfolio History Builder
Parses transaction data, fetches historical daily prices from Yahoo Finance,
and outputs portfolio-history.json for the dashboard chart.

Price source: Yahoo Finance adjusted close (split+dividend adjusted)
"""

import re
import json
import sys
import time
from datetime import datetime, timedelta
from collections import defaultdict
import urllib.request
import urllib.error


def parse_transactions(filepath):
    """Parse the Morningstar transaction text file."""
    with open(filepath) as f:
        lines = f.readlines()

    current_ticker = None
    transactions = []
    cash_transactions = []
    current_holdings = {}  # First header with shares > 0
    all_headers = {}  # ALL headers (including 0-share) - first occurrence
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
            # Track first header for each ticker
            if current_ticker not in all_headers:
                all_headers[current_ticker] = shares
            if shares > 0 and current_ticker not in current_holdings:
                current_holdings[current_ticker] = {
                    "shares": shares, "price": price, "value": value
                }
            in_cash = False
            continue

        # Parse SPLIT events first (e.g., "SPLIT 2.000:1.000") since the
        # generic date regex below doesn't match SPLIT lines due to the "." and ":"
        split_m = re.match(r'^\s+(\d{2}-\d{2}-\d{2})\tSPLIT\s+([\d.]+):([\d.]+)', raw)
        if split_m and current_ticker:
            sdate = split_m.group(1)
            smo, sday, syr = sdate.split("-")
            sfull = 2000 + int(syr) if int(syr) < 50 else 1900 + int(syr)
            transactions.append({
                "date": f"{sfull}-{smo}-{sday}", "ticker": current_ticker, "type": "SPLIT",
                "ratio": float(split_m.group(2)) / float(split_m.group(3)),
                "shares": 0, "price": 0, "amount": 0,
            })
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
            r'^\s+\d{2}-\d{2}-\d{2}\t(PURCHASE|SALE|DIVIDEND REINVESTMENT)\t([\d,.]+)\t([\d,.]+)\t([\d,.]+)', raw)
        if stock_m and current_ticker:
            transactions.append({
                "date": d, "ticker": current_ticker, "type": stock_m.group(1),
                "shares": float(stock_m.group(2).replace(",", "")), "price": float(stock_m.group(3).replace(",", "")),
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

    # Build split schedule: {ticker: [(date, ratio), ...]} sorted by date
    split_schedule = defaultdict(list)
    for tx in transactions:
        if tx["type"] == "SPLIT":
            split_schedule[tx["ticker"]].append((tx["date"], tx["ratio"]))
    for ticker in split_schedule:
        split_schedule[ticker].sort()

    return transactions, cash_transactions, current_holdings, split_schedule


def get_all_fridays(start_date, end_date):
    fridays = []
    d = start_date
    while d <= end_date:
        if d.weekday() == 4:
            fridays.append(d)
        d += timedelta(days=1)
    return fridays


def get_trading_days(start_date, end_date, prices):
    """
    Get all trading days from the price data (any date that has at least one price).
    Falls back to weekdays if no price data available.
    """
    all_dates = set()
    for ticker_prices in prices.values():
        all_dates.update(ticker_prices.keys())
    trading_days = sorted(d for d in all_dates if start_date.strftime("%Y-%m-%d") <= d <= end_date.strftime("%Y-%m-%d"))
    return [datetime.strptime(d, "%Y-%m-%d") for d in trading_days]


def apply_split_adjustments(prices, split_schedule):
    """
    Adjust Yahoo Finance close prices (which are actual historical prices)
    to post-split terms matching Morningstar's split-adjusted share counts.

    For each ticker with splits, divide all prices BEFORE each split by
    the split ratio (e.g., 2:1 split → divide pre-split prices by 2).
    """
    for ticker, splits in split_schedule.items():
        if ticker not in prices:
            continue
        tp = prices[ticker]
        for split_date, ratio in splits:
            for date_str in list(tp.keys()):
                if date_str < split_date:
                    tp[date_str] = round(tp[date_str] / ratio, 4)
    return prices


def fetch_yahoo_prices(tickers, start_date, end_date):
    """
    Fetch daily close prices from Yahoo Finance.
    No API key needed. Returns {ticker: {date_str: close_price}}.
    Note: close prices are NOT split-adjusted; call apply_split_adjustments() after.
    """
    all_prices = {}
    ticker_list = sorted(tickers)

    # Convert dates to Unix timestamps
    period1 = int(start_date.timestamp()) - 86400  # 1 day before to ensure coverage
    period2 = int(end_date.timestamp()) + 86400

    for i, ticker in enumerate(ticker_list):
        url = (
            f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
            f"?period1={period1}&period2={period2}&interval=1d"
            f"&includeAdjustedClose=true"
        )

        retries = 0
        success = False
        while retries < 3 and not success:
            try:
                req = urllib.request.Request(url)
                req.add_header("User-Agent", "Mozilla/5.0")
                with urllib.request.urlopen(req, timeout=30) as resp:
                    data = json.loads(resp.read().decode())

                result = data.get("chart", {}).get("result", [])
                if result:
                    r = result[0]
                    timestamps = r.get("timestamp", [])
                    # Use regular close (split-adjusted only, NOT dividend-adjusted)
                    # because we track dividends separately via DIVIDEND REINVESTMENT transactions.
                    # Using adjclose would double-count dividend returns.
                    adjclose = r.get("indicators", {}).get("quote", [{}])[0].get("close", [])

                    if timestamps and adjclose:
                        all_prices[ticker] = {}
                        for ts, price in zip(timestamps, adjclose):
                            if price is not None:
                                d = datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d")
                                all_prices[ticker][d] = round(price, 4)
                        success = True
                    else:
                        print(f"    Warning: {ticker}: no price data returned")
                        success = True  # don't retry, just skip
                else:
                    err = data.get("chart", {}).get("error", {})
                    print(f"    Warning: {ticker}: {err.get('description', 'no data')}")
                    success = True

            except urllib.error.HTTPError as e:
                if e.code == 429:  # Rate limited
                    retries += 1
                    wait = 2 ** retries
                    print(f"    Rate limited on {ticker}, waiting {wait}s...")
                    time.sleep(wait)
                else:
                    print(f"    Warning: {ticker}: HTTP {e.code}")
                    success = True
            except Exception as e:
                print(f"    Warning: {ticker}: {e}")
                retries += 1
                if retries < 3:
                    time.sleep(1)
                else:
                    success = True

        # Brief pause between requests to avoid rate limiting
        if (i + 1) % 5 == 0:
            time.sleep(0.5)

        if (i + 1) % 10 == 0 or (i + 1) == len(ticker_list):
            total_pts = sum(len(v) for v in all_prices.values())
            print(f"    Progress: {i+1}/{len(ticker_list)} tickers, {total_pts} data points")

    return all_prices


def get_price_on_date(prices, ticker, target_date, fridays_list=None):
    """Get the adjusted close price for a ticker on or near the target date."""
    date_str = target_date.strftime("%Y-%m-%d")
    if ticker not in prices:
        return None
    tp = prices[ticker]
    # Exact match
    if date_str in tp:
        return tp[date_str]
    # Look backward up to 7 days (handles weekends, holidays)
    for delta in range(1, 8):
        check = (target_date - timedelta(days=delta)).strftime("%Y-%m-%d")
        if check in tp:
            return tp[check]
    # Look forward up to 3 days
    for delta in range(1, 4):
        check = (target_date + timedelta(days=delta)).strftime("%Y-%m-%d")
        if check in tp:
            return tp[check]
    return None


def build_portfolio_history(transactions, cash_transactions, prices, start_balance=100000, current_holdings=None):
    """
    Replay all transactions and calculate daily portfolio values.

    Uses daily sampling (every trading day) for accurate period returns.
    Truncates DRIP fractional shares to match Morningstar's rounding.

    Cash tracking uses the cash section exclusively (DEPOSIT/WITHDRAWAL).
    Stock transactions only update share counts, not cash — because
    Morningstar records both sides: a PURCHASE shows as a stock entry
    AND a cash WITHDRAWAL. Using both would double-count.
    """
    total_deposits = sum(c["amount"] for c in cash_transactions if c["type"] == "DEPOSIT")
    total_withdrawals = sum(c["amount"] for c in cash_transactions if c["type"] == "WITHDRAWAL")
    print(f"  Cash deposits: {sum(1 for c in cash_transactions if c['type'] == 'DEPOSIT')} entries, ${total_deposits:,.2f}")
    print(f"  Cash withdrawals: {sum(1 for c in cash_transactions if c['type'] == 'WITHDRAWAL')} entries, ${total_withdrawals:,.2f}")

    all_events = []
    # Stock events — only affect holdings (share counts)
    for tx in transactions:
        all_events.append({"date": tx["date"], "kind": "stock", **tx})
    # Cash events — ALL deposits and withdrawals affect cash balance
    # Skip the initial deposit matching start_balance (handled by cash init)
    initial_skipped = False
    for ctx in cash_transactions:
        if not initial_skipped and ctx["type"] == "DEPOSIT" and abs(ctx["amount"] - start_balance) < 0.01:
            initial_skipped = True
            continue
        all_events.append({"date": ctx["date"], "kind": "cash", **ctx})
    # Sort by date, then deposits/sales before withdrawals/purchases
    # so cash inflows are processed before outflows on the same day
    ORDER = {"DEPOSIT": 0, "SALE": 1, "DIVIDEND REINVESTMENT": 2, "PURCHASE": 3, "WITHDRAWAL": 4, "SPLIT": 5}
    all_events.sort(key=lambda x: (x["date"], ORDER.get(x.get("type", ""), 5)))

    holdings = defaultdict(float)
    cash = start_balance

    if not all_events:
        return []

    start_date = datetime.strptime(all_events[0]["date"], "%Y-%m-%d")
    end_date = datetime.now()

    # Use daily trading days from price data for accurate date alignment
    sample_days = get_trading_days(start_date - timedelta(days=7), end_date, prices)
    if not sample_days:
        # Fallback to Fridays if no price data
        sample_days = get_all_fridays(start_date - timedelta(days=7), end_date)

    print(f"  Sampling {len(sample_days)} trading days")

    # Prepend the starting balance as the initial data point (day before first event)
    pre_start = (start_date - timedelta(days=1)).strftime("%Y-%m-%d")
    history = [{
        "date": pre_start,
        "value": start_balance,
        "stocks": 0,
        "cash": start_balance,
        "num_holdings": 0,
    }]
    event_idx = 0

    for day in sample_days:
        day_str = day.strftime("%Y-%m-%d")

        while event_idx < len(all_events) and all_events[event_idx]["date"] <= day_str:
            evt = all_events[event_idx]
            if evt["kind"] == "stock":
                if evt["type"] == "PURCHASE":
                    holdings[evt["ticker"]] += evt["shares"]
                elif evt["type"] == "SALE":
                    holdings[evt["ticker"]] -= evt["shares"]
                    if holdings[evt["ticker"]] <= 0.0001:
                        holdings[evt["ticker"]] = 0
                elif evt["type"] == "DIVIDEND REINVESTMENT":
                    # Truncate to 4 decimal places to match Morningstar's rounding
                    holdings[evt["ticker"]] += int(evt["shares"] * 10000) / 10000
            elif evt["kind"] == "cash":
                if evt["type"] == "DEPOSIT":
                    cash += evt["amount"]
                elif evt["type"] == "WITHDRAWAL":
                    cash -= evt["amount"]
            event_idx += 1

        stock_value = 0
        held_tickers = {t: s for t, s in holdings.items() if s > 0}
        for ticker, shares in held_tickers.items():
            price = get_price_on_date(prices, ticker, day)
            if price is not None:
                stock_value += shares * price
            else:
                # Fallback: use last known transaction price
                for evt in reversed(all_events[:event_idx]):
                    if evt.get("ticker") == ticker and evt.get("price", 0) > 0:
                        stock_value += shares * evt["price"]
                        break

        total_value = stock_value + cash
        history.append({
            "date": day_str,
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
    transactions, cash_transactions, current_holdings, split_schedule = parse_transactions(tx_file)
    print(f"  Stock txns: {len(transactions)}, Cash txns: {len(cash_transactions)}")
    if split_schedule:
        for ticker, splits in sorted(split_schedule.items()):
            for sd, sr in splits:
                print(f"  Split: {ticker} {sr}:1 on {sd}")

    all_tickers = set(tx["ticker"] for tx in transactions)
    gt_count = len([k for k in current_holdings if k != "__CASH__"])
    gt_value = sum(h["value"] for k, h in current_holdings.items() if k != "__CASH__")
    print(f"  {len(all_tickers)} unique tickers, {gt_count} current holdings (${gt_value:,.2f})")

    start_date = datetime.strptime(transactions[0]["date"], "%Y-%m-%d")
    end_date = datetime.now()
    print(f"  Date range: {start_date.date()} to {end_date.date()}")
    print()

    # Fetch prices from Yahoo Finance (daily close, no API key needed)
    print("Fetching daily prices from Yahoo Finance...")
    prices = fetch_yahoo_prices(all_tickers, start_date, end_date)
    total_pts = sum(len(v) for v in prices.values())
    tickers_with_data = sum(1 for v in prices.values() if v)
    missing = sorted(t for t in all_tickers if not prices.get(t))
    print(f"  Total: {tickers_with_data}/{len(all_tickers)} tickers, {total_pts} data points")
    if missing:
        print(f"  Missing: {missing}")

    # Note: Yahoo Finance close is already split-adjusted, so no manual split
    # adjustment needed. The close prices match Morningstar's post-split basis.
    print()

    # Build portfolio history
    print("Building portfolio history...")
    history = build_portfolio_history(transactions, cash_transactions, prices, current_holdings=current_holdings)
    print(f"  Daily data points: {len(history)}")
    if history:
        print(f"  Start: ${history[0]['value']:,.2f}")
        print(f"  End:   ${history[-1]['value']:,.2f} (stocks=${history[-1]['stocks']:,.2f} cash=${history[-1]['cash']:,.2f})")
        ret = ((history[-1]['value'] / history[0]['value']) - 1) * 100
        print(f"  Return: {ret:+.2f}%")
        # Check for negative cash weeks
        neg_cash_weeks = sum(1 for h in history if h['cash'] < 0)
        if neg_cash_weeks:
            print(f"  Note: {neg_cash_weeks} weeks with negative cash (temporary margin during rebalancing)")
    print()

    # Benchmark data from Yahoo Finance
    benchmark_syms = ["SPY", "QQQ", "DIA", "IWS", "DVY"]
    print("Fetching benchmark data (SPY, QQQ, DIA, IWS, DVY)...")
    bm_prices = fetch_yahoo_prices(set(benchmark_syms), start_date, end_date)

    benchmarks = {}
    for sym in benchmark_syms:
        if sym in bm_prices and bm_prices[sym]:
            bm_points = []
            for h in history:
                d = datetime.strptime(h["date"], "%Y-%m-%d")
                price = get_price_on_date(bm_prices, sym, d)
                if price is not None:
                    bm_points.append({"date": h["date"], "close": round(price, 2)})
            benchmarks[sym] = bm_points
            print(f"  {sym}: {len(bm_points)} data points")
    print()

    # Current holdings for live portfolio value calculation
    # Re-parse to get fresh copy (current_holdings was consumed by ground truth override)
    _, _, fresh_holdings, _ = parse_transactions(tx_file)
    live_cash = fresh_holdings.pop("__CASH__", 0)
    holdings_map = {}
    for ticker, info in fresh_holdings.items():
        holdings_map[ticker] = info["shares"]

    # Annual return history by year
    annual_returns = {}
    if history and len(history) > 52:
        # Group data points by year
        by_year = {}
        for h in history:
            yr = h["date"][:4]
            if yr not in by_year:
                by_year[yr] = []
            by_year[yr].append(h)
        years_sorted = sorted(by_year.keys())
        for i, yr in enumerate(years_sorted):
            pts = by_year[yr]
            if i == 0:
                # First year: start from first data point
                start_v = pts[0]["value"]
            else:
                # Use last data point of previous year as start
                prev_yr = years_sorted[i - 1]
                start_v = by_year[prev_yr][-1]["value"]
            end_v = pts[-1]["value"]
            if start_v > 0:
                annual_returns[yr] = round(((end_v / start_v) - 1) * 100, 2)

    # Benchmark annual returns
    bm_annual = {}
    for sym, bm_points in benchmarks.items():
        if not bm_points:
            continue
        bm_by_year = {}
        for bp in bm_points:
            yr = bp["date"][:4]
            if yr not in bm_by_year:
                bm_by_year[yr] = []
            bm_by_year[yr].append(bp)
        bm_ann = {}
        bm_years = sorted(bm_by_year.keys())
        for i, yr in enumerate(bm_years):
            pts = bm_by_year[yr]
            if i == 0:
                start_v = pts[0]["close"]
            else:
                prev_yr = bm_years[i - 1]
                start_v = bm_by_year[prev_yr][-1]["close"]
            end_v = pts[-1]["close"]
            if start_v > 0:
                bm_ann[yr] = round(((end_v / start_v) - 1) * 100, 2)
        bm_annual[sym] = bm_ann

    output = {
        "sleeve": sleeve_name,
        "generated": datetime.now().isoformat(),
        "start_balance": 100000,
        "start_date": start_date.strftime("%Y-%m-%d"),
        "end_date": end_date.strftime("%Y-%m-%d"),
        "portfolio": history,
        "benchmarks": benchmarks,
        "holdings": holdings_map,
        "cash": live_cash,

        "annual_returns": annual_returns,
        "bm_annual_returns": bm_annual,
    }

    out_file = f"portfolio-history-{sleeve_name}.json"
    with open(out_file, "w") as f:
        json.dump(output, f)

    print(f"Output: {out_file} ({os.path.getsize(out_file) / 1024:.1f} KB)")

    # Print return comparison
    if history and len(history) > 52:
        print()
        print("=== Return Check ===")
        last = history[-1]
        # YTD uses last trading day of prior year (Dec 31 or nearest before)
        ytd_cutoff = f"{datetime.now().year - 1}-12-31"
        ytd_start = None
        for h in reversed(history):
            if h["date"] <= ytd_cutoff:
                ytd_start = h
                break
        for label, start_entry in [
            ("YTD", ytd_start or history[0]),
            ("1Y", next((h for h in history if h["date"] >= (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d")), history[0])),
            ("3Y", next((h for h in history if h["date"] >= (datetime.now() - timedelta(days=365*3)).strftime("%Y-%m-%d")), history[0])),
            ("5Y", next((h for h in history if h["date"] >= (datetime.now() - timedelta(days=365*5)).strftime("%Y-%m-%d")), history[0])),
            ("ALL", history[0]),
        ]:
            ret = ((last["value"] / start_entry["value"]) - 1) * 100
            print(f"  {label}: {ret:+.1f}% (from {start_entry['date']} ${start_entry['value']:,.0f} to ${last['value']:,.0f})")

    print("\nDone!")


if __name__ == "__main__":
    main()
