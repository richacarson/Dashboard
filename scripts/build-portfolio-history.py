#!/usr/bin/env python3
"""
IOWN Portfolio History Builder
Parses transaction data, fetches historical daily prices from Yahoo Finance,
and outputs portfolio-history.json for the dashboard chart.

Price source: Yahoo Finance close (split-adjusted, matching displayed prices)
"""

import re
import json
import sys
import time
from datetime import datetime, timedelta
from collections import defaultdict
import urllib.request
import urllib.error


## ── Company-name-to-ticker map (for "By Activity" exports) ──────────────────
NAME_TO_TICKER = {
    "Advanced Micro Devices Inc": "AMD",
    "Agnico Eagle Mines Ltd": "AEM",
    "Atour Lifestyle Holdings Ltd ADR": "ATAT",
    "Block Inc Class A": "XYZ",
    "CNX Resources Corp": "CNX",
    "Chevron Corp": "CVX",
    "Clearwater Analytics Holdings Inc Class A": "CWAN",
    "Coinbase Global Inc Ordinary Shares - Class A": "COIN",
    "Credo Technology Group Holding Ltd": "CRDO",
    "Docusign Inc": "DOCU",
    "Edison International": "EIX",
    "FinVolution Group ADR": "FINV",
    "Fortinet Inc": "FTNT",
    "Freeport-McMoRan Inc": "FCX",
    "Gold Fields Ltd ADR": "GFI",
    "Grupo Supervielle SA ADR": "SUPV",
    "Harmony Biosciences Holdings Inc Ordinary Shares": "HRMY",
    "Hut 8 Corp": "HUT",
    "Keysight Technologies Inc": "KEYS",
    "Linde PLC": "LIN",
    "MARA Holdings Inc": "MARA",
    "Marvell Technology Inc": "MRVL",
    "Meritage Homes Corp": "MTH",
    "NVIDIA Corp": "NVDA",
    "NXP Semiconductors NV": "NXPI",
    "ONEOK Inc": "OKE",
    "PDD Holdings Inc ADR": "PDD",
    "Robinhood Markets Inc Class A": "HOOD",
    "SoFi Technologies Inc Ordinary Shares": "SOFI",
    "Super Micro Computer Inc": "SMCI",
    "Synchrony Financial": "SYF",
    "Taiwan Semiconductor Manufacturing Co Ltd ADR": "TSM",
    "Toll Brothers Inc": "TOL",
    "Vistra Corp": "VST",
    "Cash": "__CASH__",
}


def _detect_format(lines):
    """Detect whether the file is 'By Security' (has ticker headers) or 'By Activity'."""
    for line in lines[:10]:
        raw = line.rstrip('\r\n')
        if raw.startswith("Date\t") or "By Activity" in raw:
            return "activity"
    return "security"


def _parse_by_activity(lines):
    """Parse Morningstar 'By Activity' format (chronological, no ticker headers).

    Format is:
      <space> <tab> MM-DD-YY <tab> <CR>
      TYPECompanyName <CR>
      shares <tab> price <tab> amount <tab> Edit <tab> <space> <CR>

    For cash events:
      <space> <tab> MM-DD-YY <tab> <CR>
      DEPOSITCash <CR>
      -- <tab> -- <tab> amount <tab> Edit <tab> <space> <CR>
    """
    transactions = []
    cash_transactions = []

    i = 0
    while i < len(lines):
        raw = lines[i].rstrip('\r\n')

        # Look for date lines: leading whitespace, tab, MM-DD-YY, tab
        date_m = re.match(r'^\s+\t(\d{2}-\d{2}-\d{2})\t', raw)
        if not date_m:
            i += 1
            continue

        date_str = date_m.group(1)
        month, day, year = date_str.split("-")
        yr = int(year)
        full_year = 2000 + yr if yr < 50 else 1900 + yr
        d = f"{full_year}-{month}-{day}"

        # Next line should be TYPECompanyName
        if i + 1 >= len(lines):
            i += 1
            continue
        type_line = lines[i + 1].rstrip('\r\n')

        tx_type = None
        company_name = None
        for prefix in ["DIVIDEND REINVESTMENT", "PURCHASE", "SALE"]:
            if type_line.startswith(prefix):
                tx_type = prefix
                company_name = type_line[len(prefix):]
                break

        # Check for DEPOSIT/WITHDRAWAL
        if tx_type is None:
            for prefix in ["DEPOSIT", "WITHDRAWAL"]:
                if type_line.startswith(prefix):
                    tx_type = prefix
                    company_name = type_line[len(prefix):]
                    break

        if tx_type is None:
            i += 1
            continue

        # Next line has the numbers: shares<tab>price<tab>amount<tab>Edit
        if i + 2 >= len(lines):
            i += 2
            continue
        nums_line = lines[i + 2].rstrip('\r\n')

        if tx_type in ("DEPOSIT", "WITHDRAWAL"):
            # Cash event: --<tab>--<tab>amount<tab>Edit
            cash_m = re.match(r'^--\t--\t([\d,.]+)\t', nums_line)
            if cash_m:
                cash_transactions.append({
                    "date": d, "type": tx_type,
                    "amount": float(cash_m.group(1).replace(",", "")),
                })
            i += 3
            continue

        # Stock event: shares<tab>price<tab>amount<tab>Edit
        nums_m = re.match(r'^([\d,.]+)\t([\d,.]+)\t([\d,.]+)\t', nums_line)
        if nums_m and company_name:
            ticker = NAME_TO_TICKER.get(company_name.strip())
            if not ticker:
                # FAIL LOUDLY — silently skipping a transaction means we under-report
                # purchases (cash strands, positions missing) or sales (positions overstate).
                # Both corrupt the portfolio. Better to fail the build than to publish
                # wrong numbers. To fix: add the company to NAME_TO_TICKER above.
                raise ValueError(
                    f"Unknown company name in transaction: '{company_name.strip()}' "
                    f"on {d} ({tx_type} for ${nums_m.group(3)}). "
                    f"Add this company to NAME_TO_TICKER in scripts/build-portfolio-history.py."
                )
            transactions.append({
                "date": d, "ticker": ticker, "type": tx_type,
                "shares": float(nums_m.group(1).replace(",", "")),
                "price": float(nums_m.group(2).replace(",", "")),
                "amount": float(nums_m.group(3).replace(",", "")),
            })
        i += 3

    transactions.sort(key=lambda x: x["date"])
    cash_transactions.sort(key=lambda x: x["date"])

    # Build current_holdings by replaying all transactions
    holdings = defaultdict(float)
    last_price = {}
    for tx in transactions:
        t = tx["ticker"]
        if tx["type"] == "PURCHASE":
            holdings[t] += tx["shares"]
        elif tx["type"] == "SALE":
            holdings[t] -= tx["shares"]
        elif tx["type"] == "DIVIDEND REINVESTMENT":
            # Dividends go to cash, not reinvested as shares
            pass
        last_price[t] = tx["price"]

    current_holdings = {}
    for t, shares in holdings.items():
        if shares > 0.0001:
            price = last_price.get(t, 0)
            current_holdings[t] = {
                "shares": round(shares, 6), "price": price, "value": round(shares * price, 2)
            }

    # Add cash from cash transactions
    cash_total = sum(c["amount"] for c in cash_transactions if c["type"] == "DEPOSIT") - \
                 sum(c["amount"] for c in cash_transactions if c["type"] == "WITHDRAWAL")
    if cash_total != 0:
        current_holdings["__CASH__"] = cash_total

    # Build split schedule
    split_schedule = defaultdict(list)
    for tx in transactions:
        if tx["type"] == "SPLIT":
            split_schedule[tx["ticker"]].append((tx["date"], tx["ratio"]))
    for ticker in split_schedule:
        split_schedule[ticker].sort()

    return transactions, cash_transactions, current_holdings, split_schedule


def parse_transactions(filepath):
    """Parse the Morningstar transaction text file (auto-detects format)."""
    with open(filepath) as f:
        lines = f.readlines()

    # Auto-detect format
    fmt = _detect_format(lines)
    if fmt == "activity":
        print(f"  Detected 'By Activity' format — using name-to-ticker mapping")
        return _parse_by_activity(lines)

    print(f"  Detected 'By Security' format — using ticker headers")

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
    Uses regular close (split-adjusted, not dividend-adjusted) to match
    Yahoo Finance's displayed price and YTD return.
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
                    # Use regular close (split-adjusted, not dividend-adjusted)
                    # to match Yahoo Finance's displayed prices
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


def fetch_alpaca_prices(tickers, start_date, end_date):
    """
    Fetch daily close prices from Alpaca Markets API.
    Uses ALPACA_KEY and ALPACA_SECRET env vars.
    Returns {ticker: {date_str: close_price}} — same format as fetch_yahoo_prices.
    """
    import os
    api_key = os.environ.get("ALPACA_KEY", "")
    api_secret = os.environ.get("ALPACA_SECRET", "")
    if not api_key or not api_secret:
        print("    Warning: No Alpaca credentials, falling back to Yahoo")
        return fetch_yahoo_prices(tickers, start_date, end_date)

    all_prices = {}
    base = "https://data.alpaca.markets"
    headers = {
        "APCA-API-KEY-ID": api_key,
        "APCA-API-SECRET-KEY": api_secret,
    }
    start_str = (start_date - timedelta(days=7)).strftime("%Y-%m-%d")
    end_str = end_date.strftime("%Y-%m-%d")

    for ticker in sorted(tickers):
        try:
            url = f"{base}/v2/stocks/bars?symbols={ticker}&timeframe=1Day&start={start_str}&end={end_str}&limit=10000&adjustment=split&feed=sip"
            req = urllib.request.Request(url)
            for k, v in headers.items():
                req.add_header(k, v)
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode())
            bars = data.get("bars", {}).get(ticker, [])
            if bars:
                all_prices[ticker] = {}
                for bar in bars:
                    d = bar["t"][:10]  # "2026-01-02T05:00:00Z" -> "2026-01-02"
                    all_prices[ticker][d] = round(bar["c"], 4)
        except Exception as e:
            print(f"    Warning: Alpaca {ticker}: {e}")

    total_pts = sum(len(v) for v in all_prices.values())
    print(f"    Alpaca: {len(all_prices)}/{len(tickers)} tickers, {total_pts} data points")
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

    # Detect whether the initial start_balance deposit exists in cash transactions.
    # "By Security" format has an explicit DEPOSIT matching start_balance — stock
    # buys/sells don't move cash because Morningstar records both sides.
    # "By Activity" format does NOT have the initial deposit — so stock buys/sells
    # must move cash to keep the balance accurate.
    has_initial_deposit = any(
        ctx["type"] == "DEPOSIT" and abs(ctx["amount"] - start_balance) < 0.01
        for ctx in cash_transactions
    )
    stock_moves_cash = not has_initial_deposit

    # Stock events
    for tx in transactions:
        all_events.append({"date": tx["date"], "kind": "stock", "moves_cash": stock_moves_cash, **tx})
    # Cash events
    for ctx in cash_transactions:
        # Skip the initial deposit matching start_balance (handled by cash init)
        if has_initial_deposit and ctx["type"] == "DEPOSIT" and abs(ctx["amount"] - start_balance) < 0.01:
            has_initial_deposit = False  # Only skip first match
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
                    if evt.get("moves_cash"):
                        cash -= evt.get("amount", evt["shares"] * evt.get("price", 0))
                elif evt["type"] == "SALE":
                    holdings[evt["ticker"]] -= evt["shares"]
                    if holdings[evt["ticker"]] <= 0.0001:
                        holdings[evt["ticker"]] = 0
                    if evt.get("moves_cash"):
                        cash += evt.get("amount", evt["shares"] * evt.get("price", 0))
                elif evt["type"] == "DIVIDEND REINVESTMENT":
                    # Dividends go to cash, not reinvested as shares
                    cash += evt.get("amount", evt["shares"] * evt.get("price", 0))
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

    # Log endpoint info (no override — daily calculation is source of truth)
    if history:
        last = history[-1]
        print(f"  Endpoint: ${last['value']:,.2f} (stocks=${last['stocks']:,.2f} cash=${last['cash']:,.2f}) {last['num_holdings']} holdings")

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

    # Merge user-added transactions from the dashboard UI
    user_tx_file = os.path.join(os.path.dirname(tx_file), "user_transactions.json")
    if os.path.exists(user_tx_file):
        with open(user_tx_file) as f:
            user_txs = json.load(f)
        for utx in user_txs:
            if utx.get("ticker"):
                transactions.append({
                    "date": utx["date"], "ticker": utx["ticker"], "type": utx["type"],
                    "shares": utx.get("shares", 0), "price": utx.get("price", 0),
                    "amount": utx.get("amount", 0),
                })
                # Update current_holdings for ground truth
                t = utx["ticker"]
                if utx["type"] == "PURCHASE":
                    if t in current_holdings:
                        current_holdings[t]["shares"] += utx.get("shares", 0)
                    else:
                        current_holdings[t] = {"shares": utx.get("shares", 0), "price": utx.get("price", 0), "value": utx.get("amount", 0)}
                elif utx["type"] == "DIVIDEND REINVESTMENT":
                    # Dividends go to cash, not reinvested as shares
                    if isinstance(current_holdings.get("__CASH__"), (int, float)):
                        current_holdings["__CASH__"] += utx.get("amount", 0)
                    else:
                        current_holdings["__CASH__"] = utx.get("amount", 0)
                elif utx["type"] == "SALE" and t in current_holdings:
                    current_holdings[t]["shares"] -= utx.get("shares", 0)
                    if current_holdings[t]["shares"] <= 0:
                        current_holdings[t]["shares"] = 0
            else:
                cash_transactions.append({"date": utx["date"], "type": utx["type"], "amount": utx.get("amount", 0)})
                if utx["type"] == "DEPOSIT":
                    current_holdings.setdefault("__CASH__", 0)
                    if isinstance(current_holdings.get("__CASH__"), (int, float)):
                        current_holdings["__CASH__"] += utx["amount"]
                elif utx["type"] == "WITHDRAWAL":
                    if isinstance(current_holdings.get("__CASH__"), (int, float)):
                        current_holdings["__CASH__"] -= utx["amount"]
        transactions.sort(key=lambda x: x["date"])
        cash_transactions.sort(key=lambda x: x["date"])
        print(f"  Merged {len(user_txs)} user transactions from dashboard UI")

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

    # Benchmark data — prefer Alpaca (consistent with live feed), fall back to Yahoo
    SLEEVE_BENCHMARKS = {
        "dividend": ["SPY", "DIA", "IWS", "DVY"],
        "growth": ["IUSG", "QQQ", "SPY"],
    }
    benchmark_syms = SLEEVE_BENCHMARKS.get(sleeve_name, ["SPY", "DIA", "IWS", "DVY"])
    print(f"Fetching benchmark data ({', '.join(benchmark_syms)})...")
    bm_prices = fetch_alpaca_prices(set(benchmark_syms), start_date, end_date)
    # Fall back to Yahoo for any missing tickers
    missing = [s for s in benchmark_syms if s not in bm_prices or not bm_prices[s]]
    if missing:
        print(f"    Falling back to Yahoo for: {', '.join(missing)}")
        yahoo_bm = fetch_yahoo_prices(set(missing), start_date, end_date)
        bm_prices.update(yahoo_bm)

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

    # Current holdings from simulation replay (accurate share counts).
    # IMPORTANT: For "By Security" exports, the per-ticker header rows in the
    # Morningstar file reflect the file's "As of <date>" timestamp, which can
    # lag behind the most recent transactions (e.g., a rebalance executed
    # after the export's "as of" date will appear in the transaction list
    # but NOT in the headers). Trusting the headers caused new positions
    # (CTRA, NTR after the 4/17/26 dividend rebalance) to be omitted from
    # `holdings` while fully-closed positions (e.g., A) lingered. Always
    # replay the transactions to get the true current share counts —
    # this matches the logic in `build_portfolio_history` and `_parse_by_activity`.
    sim_holdings = defaultdict(float)
    for tx in sorted(transactions, key=lambda x: x["date"]):
        t = tx["ticker"]
        if tx["type"] == "PURCHASE":
            sim_holdings[t] += tx["shares"]
        elif tx["type"] == "SALE":
            sim_holdings[t] -= tx["shares"]
        # DIVIDEND REINVESTMENT goes to cash, not shares (matches build_portfolio_history)
    holdings_map = {}
    for ticker, shares in sim_holdings.items():
        if shares > 0.0001:
            holdings_map[ticker] = round(shares, 6)

    # Use simulation's final cash (includes dividends sent to cash)
    live_cash = history[-1]["cash"] if history else 0

    # Annual return history by year
    # Skip the first partial year (portfolio started mid-year) — only include
    # years where we have a full Jan 1 starting point from the prior year's close
    annual_returns = {}
    if history and len(history) > 10:
        by_year = {}
        for h in history:
            yr = h["date"][:4]
            if yr not in by_year:
                by_year[yr] = []
            by_year[yr].append(h)
        years_sorted = sorted(by_year.keys())
        start_year = history[0]["date"][:4]
        for i, yr in enumerate(years_sorted):
            pts = by_year[yr]
            if yr == start_year and history[0]["date"][5:] > "01-15":
                # Skip first year if portfolio started after Jan 15 (partial year)
                continue
            if i == 0 or yr == start_year:
                start_v = pts[0]["value"]
            else:
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

    # Compute cost basis per holding using average cost method
    cost_basis = {}
    cb_holdings = defaultdict(float)  # ticker -> shares held
    cb_cost = defaultdict(float)      # ticker -> total cost
    for tx in sorted(transactions, key=lambda x: x["date"]):
        t = tx["ticker"]
        if tx["type"] == "PURCHASE":
            cb_holdings[t] += tx["shares"]
            cb_cost[t] += tx["shares"] * tx["price"]
        elif tx["type"] == "SALE":
            if cb_holdings[t] > 0:
                avg = cb_cost[t] / cb_holdings[t]
                cb_holdings[t] -= tx["shares"]
                cb_cost[t] = avg * max(cb_holdings[t], 0)
                if cb_holdings[t] <= 0.0001:
                    cb_holdings[t] = 0
                    cb_cost[t] = 0
        elif tx["type"] == "SPLIT":
            if cb_holdings[t] > 0:
                cb_holdings[t] *= tx.get("ratio", 1)
                # Total cost stays the same — avg cost per share decreases
    for ticker in holdings_map:
        if cb_holdings[ticker] > 0:
            cost_basis[ticker] = {
                "avg_cost": round(cb_cost[ticker] / cb_holdings[ticker], 4),
                "total_cost": round(cb_cost[ticker], 2),
            }
    print(f"  Cost basis computed for {len(cost_basis)} holdings")

    # Build transactions list for the dashboard (stock + cash, newest first)
    all_tx = []
    for tx in transactions:
        all_tx.append({
            "date": tx["date"], "ticker": tx["ticker"], "type": tx["type"],
            "shares": tx["shares"], "price": tx["price"], "amount": tx["amount"],
        })
    for ctx in cash_transactions:
        all_tx.append({
            "date": ctx["date"], "type": ctx["type"], "amount": ctx["amount"],
        })
    all_tx.sort(key=lambda x: x["date"], reverse=True)

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
        "cost_basis": cost_basis,
        "transactions": all_tx,

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
