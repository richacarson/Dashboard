#!/usr/bin/env python3
"""
Q2 2026 Rebalance Executor
==========================

Performs the quarterly rebalance described in:
  public/research/Research - IC Proposal Q2 2026 Rebalance.md

Workflow:
  Phase 1: Fill dividend gap (dividends paid between last recorded deposit
           and the rebalance date that haven't been written to file).
  Phase 2: Pull 4/17/26 close prices for all current + new holdings.
  Phase 3: Compute current sleeve value, target $ per position, trade list.
  Phase 4: Reconcile projected cash to exactly 1% of total.
  Phase 5: Append all entries (dividends + trades) to transaction files.
  Phase 6: Write a human-readable rebalance report (markdown).

Requires environment variables:
  FMP_API_KEY       — Financial Modeling Prep (for dividend history)
  ALPACA_KEY        — Alpaca API key (fallback for prices)
  ALPACA_SECRET     — Alpaca secret (fallback for prices)
  Prices are primarily pulled from Yahoo Finance (no key required).
"""

import importlib.util
import json
import os
import re
import sys
import time
import urllib.request
import urllib.error
import urllib.parse
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path

# Import the existing parser from build-portfolio-history.py
REPO = Path(__file__).resolve().parent.parent.parent
BPH_PATH = REPO / "scripts" / "build-portfolio-history.py"
_spec = importlib.util.spec_from_file_location("bph", BPH_PATH)
_bph = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_bph)
parse_transactions = _bph.parse_transactions

from scripts.q2_2026_rebalance.ic_targets import (
    REBALANCE_DATE, DIVIDEND_TARGETS, GROWTH_TARGETS, CASH_TARGET,
    DIVIDEND_EXITS, GROWTH_EXITS, NEW_COMPANY_NAMES, MORNINGSTAR_CASH,
)

REBALANCE_DATE_ISO = "2026-04-17"  # YYYY-MM-DD
DIVIDEND_FILE = REPO / "transactions" / "dividend_strategy_transactions.txt"
GROWTH_FILE = REPO / "transactions" / "growth_strategy_transactions.txt"
REPORT_FILE = REPO / "public" / "research" / "Q2 2026 Rebalance Execution Report.md"


# ────────────────────────────────────────────────────────────────────────
# Data sources
# ────────────────────────────────────────────────────────────────────────

def fetch_fmp_dividends(ticker, start_date_iso, end_date_iso):
    """
    Fetch dividend payments for `ticker` from FMP where paymentDate falls in
    [start_date_iso, end_date_iso]. Returns list of dicts: {paymentDate, dividend}.
    """
    key = os.environ.get("FMP_API_KEY") or os.environ.get("VITE_FMP_KEY")
    if not key:
        print("    ! FMP_API_KEY not set; skipping dividend fetch")
        return []

    url = (f"https://financialmodelingprep.com/api/v3/historical-price-full/"
           f"stock_dividend/{ticker}?apikey={key}")
    try:
        with urllib.request.urlopen(url, timeout=20) as r:
            data = json.loads(r.read())
    except Exception as e:
        print(f"    ! FMP {ticker}: {e}")
        return []

    hist = data.get("historical", []) if isinstance(data, dict) else []
    out = []
    for h in hist:
        pay_date = h.get("paymentDate") or h.get("date")
        div = h.get("dividend") or h.get("adjDividend")
        if not pay_date or div is None:
            continue
        if start_date_iso < pay_date <= end_date_iso:
            out.append({"paymentDate": pay_date, "dividend": float(div)})
    return out


# ────────────────────────────────────────────────────────────────────────
# Sleeve analysis
# ────────────────────────────────────────────────────────────────────────

def analyze_sleeve(tx_file):
    """Return current holdings, cash, and last-deposit-date for a sleeve."""
    txs, cash_txs, holdings, _ = parse_transactions(str(tx_file))

    # Extract shares per ticker (from 'By Security' headers or 'By Activity' replay)
    shares = {}
    for t, info in holdings.items():
        if t == "__CASH__":
            continue
        if isinstance(info, dict):
            shares[t] = info["shares"]

    # Current cash: replay it to be consistent with what the app displays
    # (matches build_portfolio_history logic)
    has_initial_deposit = any(abs(c["amount"] - 100000) < 0.01 and c["type"] == "DEPOSIT"
                              for c in cash_txs)
    # If format has an explicit $100K deposit ("By Security"), stock buys/sells
    # DO NOT move cash (they're mirrored as explicit cash txs). If format does NOT
    # have an initial deposit ("By Activity"), stock buys/sells MUST move cash.
    stock_moves_cash = not has_initial_deposit

    cash = 100000.0  # start balance
    skipped_init = False
    for c in cash_txs:
        # Skip exactly one matching initial $100K deposit
        if has_initial_deposit and not skipped_init and c["type"] == "DEPOSIT" \
                and abs(c["amount"] - 100000) < 0.01:
            skipped_init = True
            continue
        if c["type"] == "DEPOSIT":
            cash += c["amount"]
        elif c["type"] == "WITHDRAWAL":
            cash -= c["amount"]

    if stock_moves_cash:
        for tx in txs:
            if tx["type"] == "PURCHASE":
                cash -= tx["amount"]
            elif tx["type"] == "SALE":
                cash += tx["amount"]

    # DIVIDEND REINVESTMENT always flows to cash under our policy
    for tx in txs:
        if tx["type"] == "DIVIDEND REINVESTMENT":
            cash += tx["amount"]

    # Determine last recorded cash-inflow date (deposit OR dividend reinvestment)
    last_inflow = "1900-01-01"
    for c in cash_txs:
        if c["type"] == "DEPOSIT" and c["date"] > last_inflow:
            last_inflow = c["date"]
    for tx in txs:
        if tx["type"] == "DIVIDEND REINVESTMENT" and tx["date"] > last_inflow:
            last_inflow = tx["date"]

    return {
        "shares": shares,
        "cash": cash,
        "last_inflow_date": last_inflow,
        "format": "security" if has_initial_deposit else "activity",
        "tx_count": len(txs),
        "cash_tx_count": len(cash_txs),
    }


# ────────────────────────────────────────────────────────────────────────
# Phase 1: Dividend gap fill
# ────────────────────────────────────────────────────────────────────────

def fill_dividend_gap(state, sleeve_name):
    """
    For each held ticker in the sleeve, query FMP for dividends paid between
    last_inflow_date and REBALANCE_DATE_ISO. Returns a list of cash DEPOSIT
    entries representing dividends that should be added.

    For dividend amounts, we use shares_held_on_ex_date — which, since we
    don't track historical share counts precisely between rebalances, we
    approximate as current shares (accurate for positions unchanged since
    last rebalance, which should be most holdings).
    """
    start = state["last_inflow_date"]
    end = REBALANCE_DATE_ISO
    print(f"\n[{sleeve_name}] Phase 1: Dividend gap fill")
    print(f"  Scanning dividends paid {start} < date ≤ {end}")

    new_deposits = []
    for ticker in sorted(state["shares"].keys()):
        shares = state["shares"][ticker]
        if shares < 0.0001:
            continue
        divs = fetch_fmp_dividends(ticker, start, end)
        if not divs:
            continue
        for d in divs:
            amt = shares * d["dividend"]
            if amt < 0.01:
                continue
            new_deposits.append({
                "date": d["paymentDate"],  # YYYY-MM-DD
                "ticker": ticker,
                "dividend_per_share": d["dividend"],
                "shares": shares,
                "amount": round(amt, 2),
            })
            print(f"    {ticker:5s} {d['paymentDate']} ${d['dividend']:.4f}/sh × {shares:.4f} = ${amt:,.2f}")
        time.sleep(0.15)  # FMP rate-limit courtesy

    total = sum(d["amount"] for d in new_deposits)
    print(f"  → {len(new_deposits)} new dividends, total ${total:,.2f}")
    return new_deposits


# ────────────────────────────────────────────────────────────────────────
# Phase 2 & 3: Price & target calculation
# ────────────────────────────────────────────────────────────────────────

def fetch_all_prices(tickers, target_date):
    """
    Fetch close prices for all tickers on target_date.

    Strategy: pull a 10-day window around target_date from Alpaca (primary)
    and Yahoo Finance (fallback), then pick the close for target_date or
    nearest prior trading day.

    Returns (prices_dict, missing_list).
    """
    td = datetime.strptime(target_date, "%Y-%m-%d")
    window_start = td - timedelta(days=10)
    window_end = td + timedelta(days=2)

    ticker_set = set(tickers)

    # Primary: Alpaca
    print(f"  Trying Alpaca for {len(ticker_set)} tickers...")
    alpaca_data = {}
    try:
        alpaca_data = _bph.fetch_alpaca_prices(ticker_set, window_start, window_end)
    except Exception as e:
        print(f"    Alpaca fetch failed: {e}")

    # Fallback: Yahoo for anything missing
    missing_from_alpaca = [t for t in ticker_set if not alpaca_data.get(t)]
    yahoo_data = {}
    if missing_from_alpaca:
        print(f"  Falling back to Yahoo for: {missing_from_alpaca}")
        try:
            yahoo_data = _bph.fetch_yahoo_prices(set(missing_from_alpaca), window_start, window_end)
        except Exception as e:
            print(f"    Yahoo fetch failed: {e}")

    # Merge
    all_data = dict(alpaca_data)
    for t, d in yahoo_data.items():
        if d:
            all_data[t] = d

    # Pick close for target_date or nearest prior trading day
    prices = {}
    missing = []
    for t in sorted(ticker_set):
        if t not in all_data or not all_data[t]:
            missing.append(t)
            print(f"    {t:5s} MISSING")
            continue
        series = all_data[t]
        # Exact match
        if target_date in series:
            prices[t] = series[target_date]
            print(f"    {t:5s} ${prices[t]:,.2f}  (exact)")
            continue
        # Backward lookup
        found = False
        for delta in range(1, 8):
            probe = (td - timedelta(days=delta)).strftime("%Y-%m-%d")
            if probe in series:
                prices[t] = series[probe]
                print(f"    {t:5s} ${prices[t]:,.2f}  (from {probe})")
                found = True
                break
        if not found:
            missing.append(t)
            print(f"    {t:5s} MISSING (no price in window)")

    return prices, missing


def compute_rebalance_trades(state, targets, prices, new_deposits, sleeve_name,
                              override_cash=None):
    """
    Compute SALE/PURCHASE trades to hit IC Proposal targets with 1% cash.

    If override_cash is provided, use it as the effective cash instead of the
    app's replayed value (used when reconciling to Morningstar's ground truth).

    Process:
      1. Effective shares = current shares (dividend deposits already in cash)
      2. Effective cash = override_cash OR (current cash + sum(new dividend deposits))
      3. Total sleeve value = Σ(shares × price) + effective_cash
      4. Investable value = total × (1 - CASH_TARGET)  (99%)
      5. For each position: target_$ = investable × position_weight
      6. Delta per position drives SALE or PURCHASE
      7. After building trades, verify projected cash ≈ 1%; nudge if needed
    """
    print(f"\n[{sleeve_name}] Phase 3: Compute rebalance trades")

    eff_shares = dict(state["shares"])
    if override_cash is not None:
        eff_cash = override_cash
        print(f"  Using override cash (Morningstar reconciled): ${eff_cash:,.2f}")
    else:
        eff_cash = state["cash"] + sum(d["amount"] for d in new_deposits)

    # Total sleeve value BEFORE rebalance (using rebalance-date prices)
    stock_value = 0.0
    unpriced = []
    for t, s in eff_shares.items():
        if t in prices:
            stock_value += s * prices[t]
        else:
            unpriced.append(t)
    total_value = stock_value + eff_cash
    print(f"  Effective cash (post-dividend gap): ${eff_cash:,.2f}")
    print(f"  Stock value @ 4/17/26:              ${stock_value:,.2f}")
    print(f"  Total sleeve value:                  ${total_value:,.2f}")
    if unpriced:
        print(f"  ! UNPRICED tickers: {unpriced}")

    investable = total_value * (1 - CASH_TARGET)
    print(f"  Investable (99%):                    ${investable:,.2f}")
    print(f"  Cash target (1%):                    ${total_value * CASH_TARGET:,.2f}")

    trades = []  # list of dicts: {ticker, type, shares, price, amount}

    # All tickers we need to consider: current holdings + target holdings
    all_tickers = set(eff_shares.keys()) | set(targets.keys())

    for t in sorted(all_tickers):
        price = prices.get(t)
        if price is None or price <= 0:
            print(f"    {t:5s} SKIP (no price)")
            continue

        current_shares = eff_shares.get(t, 0.0)
        current_value = current_shares * price

        target_weight = targets.get(t, 0.0)  # 0 = full exit
        target_value = investable * target_weight

        delta_value = target_value - current_value

        if target_weight == 0 and current_shares > 0:
            # Full exit
            trades.append({
                "ticker": t, "type": "SALE", "shares": round(current_shares, 4),
                "price": round(price, 2), "amount": round(current_shares * price, 2),
                "reason": "EXIT",
            })
            print(f"    {t:5s} EXIT      sell {current_shares:.4f} @ ${price:.2f} = ${current_shares*price:,.2f}")
        elif current_shares == 0 and target_weight > 0:
            # New addition
            shares_to_buy = target_value / price
            trades.append({
                "ticker": t, "type": "PURCHASE", "shares": round(shares_to_buy, 4),
                "price": round(price, 2), "amount": round(shares_to_buy * price, 2),
                "reason": "NEW",
            })
            print(f"    {t:5s} NEW       buy  {shares_to_buy:.4f} @ ${price:.2f} = ${shares_to_buy*price:,.2f}")
        elif abs(delta_value) < 1.00:
            # Negligible — skip
            print(f"    {t:5s} HOLD      (delta ${delta_value:+,.2f} too small)")
        elif delta_value > 0:
            # Add shares
            shares_to_buy = delta_value / price
            trades.append({
                "ticker": t, "type": "PURCHASE", "shares": round(shares_to_buy, 4),
                "price": round(price, 2), "amount": round(shares_to_buy * price, 2),
                "reason": "ADD",
            })
            print(f"    {t:5s} ADD       buy  {shares_to_buy:.4f} @ ${price:.2f} = ${shares_to_buy*price:,.2f}")
        else:
            # Trim shares (avoid selling more than we have)
            shares_to_sell = min(current_shares, abs(delta_value) / price)
            trades.append({
                "ticker": t, "type": "SALE", "shares": round(shares_to_sell, 4),
                "price": round(price, 2), "amount": round(shares_to_sell * price, 2),
                "reason": "TRIM",
            })
            print(f"    {t:5s} TRIM      sell {shares_to_sell:.4f} @ ${price:.2f} = ${shares_to_sell*price:,.2f}")

    # Projected cash after trades
    proceeds = sum(tr["amount"] for tr in trades if tr["type"] == "SALE")
    outlay = sum(tr["amount"] for tr in trades if tr["type"] == "PURCHASE")
    projected_cash = eff_cash + proceeds - outlay
    target_cash = total_value * CASH_TARGET
    print(f"  After trades: cash=${projected_cash:,.2f} vs target ${target_cash:,.2f}")

    # If projected cash deviates from target by >$50, nudge the largest new position
    # by the difference. This is a rare adjustment needed because per-ticker
    # rounding accumulates.
    diff = projected_cash - target_cash
    if abs(diff) > 50:
        # Find the newest PURCHASE with non-trivial size
        new_purchases = [tr for tr in trades if tr.get("reason") == "NEW"]
        if new_purchases:
            nudge = max(new_purchases, key=lambda tr: tr["amount"])
            old_amt = nudge["amount"]
            # If diff > 0 (too much cash), buy more of the nudge ticker
            # If diff < 0 (too little cash), buy less
            adjustment = diff  # positive diff → increase purchase by diff
            new_amt = old_amt + adjustment
            new_shares = new_amt / nudge["price"]
            nudge["shares"] = round(new_shares, 4)
            nudge["amount"] = round(new_amt, 2)
            print(f"  ↳ Nudged {nudge['ticker']}: ${old_amt:,.2f} → ${new_amt:,.2f} "
                  f"(reconcile cash by ${adjustment:+,.2f})")

    return trades, total_value


# ────────────────────────────────────────────────────────────────────────
# Phase 5: Write to transaction files
# ────────────────────────────────────────────────────────────────────────

def format_morningstar_number(n, decimals=4):
    """Format a number with Morningstar's comma convention (e.g., 2,088.5208)."""
    return f"{n:,.{decimals}f}"


def append_to_dividend_file(filepath, dividend_deposits, trades, reconciliation=None):
    """
    Append entries to the 'By Security' format dividend file.

    For cash dividends: append to the CASH$ section (after the CASH$ header line).
    For reconciliation: also append to CASH$ section.
    For trades: if ticker header exists, insert transaction after it.
               If not (new ticker), create new ticker section at end of file
               (before the trailing "As of" line).
    """
    with open(filepath, "r") as f:
        lines = f.readlines()

    # ── Insert dividend deposits after CASH$ header ──
    cash_header_idx = None
    for i, line in enumerate(lines):
        if line.startswith("CASH$\t"):
            cash_header_idx = i
            break
    if cash_header_idx is None:
        raise RuntimeError("Dividend file: no CASH$ header found")

    # Build cash event lines (reconciliation first, then dividend deposits)
    # Format:   "  \tMM-DD-YY\tTYPE\t--\t--\tamount\tEdit\t \n"
    new_cash_lines = []

    if reconciliation is not None:
        y, m, day = reconciliation["date"].split("-")
        short_date = f"{m}-{day}-{y[2:]}"
        amt_str = format_morningstar_number(reconciliation["amount"], decimals=2)
        new_cash_lines.append(
            f"  \t{short_date}\t{reconciliation['type']}\t--\t--\t{amt_str}\tEdit\t \n"
        )

    for d in dividend_deposits:
        y, m, day = d["date"].split("-")
        short_date = f"{m}-{day}-{y[2:]}"
        amt_str = format_morningstar_number(d["amount"], decimals=2)
        new_cash_lines.append(
            f"  \t{short_date}\tDEPOSIT\t--\t--\t{amt_str}\tEdit\t \n"
        )

    # Insert after CASH$ header (index cash_header_idx + 1)
    insert_pos = cash_header_idx + 1
    lines[insert_pos:insert_pos] = new_cash_lines

    # ── Insert trades ──
    # Group trades by ticker
    trades_by_ticker = defaultdict(list)
    for tr in trades:
        trades_by_ticker[tr["ticker"]].append(tr)

    # Find position for each ticker. Parse headers.
    # Header pattern: "TICKER\tName\tshares\tprice\tvalue\t"
    ticker_header_pattern = re.compile(r'^([A-Z][A-Z0-9]{0,5})\t.+?\t[\d.]+\t[\d.]+\t')

    existing_ticker_lines = {}
    for i, line in enumerate(lines):
        m = ticker_header_pattern.match(line)
        if m:
            # Only record first occurrence (stocks may appear multiple times)
            if m.group(1) not in existing_ticker_lines:
                existing_ticker_lines[m.group(1)] = i

    # For each ticker's trades, insert transaction line after the ticker header
    # Trade line format:
    #   " \tMM-DD-YY\tPURCHASE\tshares\tprice\tamount\tEdit\t \n"
    for ticker in sorted(trades_by_ticker.keys()):
        ticker_trades = trades_by_ticker[ticker]
        y, m, day = REBALANCE_DATE_ISO.split("-")
        short_date = f"{m}-{day}-{y[2:]}"

        trade_lines = []
        for tr in ticker_trades:
            shares_str = format_morningstar_number(tr["shares"], decimals=4)
            price_str = format_morningstar_number(tr["price"], decimals=2)
            amount_str = format_morningstar_number(tr["amount"], decimals=2)
            trade_lines.append(
                f" \t{short_date}\t{tr['type']}\t{shares_str}\t{price_str}\t{amount_str}\tEdit\t \n"
            )

        if ticker in existing_ticker_lines:
            # Insert after header
            pos = existing_ticker_lines[ticker] + 1
            lines[pos:pos] = trade_lines
            # Update downstream indices
            for other in existing_ticker_lines:
                if existing_ticker_lines[other] > existing_ticker_lines[ticker]:
                    existing_ticker_lines[other] += len(trade_lines)
        else:
            # New ticker — insert before the trailing "As of" line
            as_of_idx = len(lines) - 1
            for i in range(len(lines) - 1, -1, -1):
                if lines[i].startswith("As of"):
                    as_of_idx = i
                    break
            # Header line for new ticker. We don't know the exact company name;
            # use ticker as placeholder (Morningstar would normally populate this).
            company_name = _company_name_for(ticker)
            # Placeholder values for shares/price/value in header (not used post-rebalance)
            header_line = f"{ticker}\t{company_name}\t0.0000\t0.0000\t0.00\t\n"
            lines[as_of_idx:as_of_idx] = [header_line] + trade_lines

    with open(filepath, "w") as f:
        f.writelines(lines)


def _company_name_for(ticker):
    """Best-effort company name for newly-added tickers."""
    reverse = {v: k for k, v in NEW_COMPANY_NAMES.items()}
    return reverse.get(ticker, ticker)


def append_to_growth_file(filepath, dividend_deposits, trades, reconciliation=None):
    """
    Append entries to the 'By Activity' format growth file.

    Entries are chronological blocks:
      " \tMM-DD-YY\t\r\n"
      "TYPECompanyName\r\n"
      "shares\tprice\tamount\tEdit\t \r\n"

    For cash deposits (dividends) and reconciliation:
      " \tMM-DD-YY\t\r\n"
      "DEPOSITCash\r\n"  (or WITHDRAWALCash)
      "--\t--\tamount\tEdit\t \r\n"

    Inserted right after the "Add\r\n" header line (beginning of transaction list).
    """
    with open(filepath, "rb") as f:
        content = f.read()
    # Preserve original line endings
    uses_crlf = b"\r\n" in content
    eol = "\r\n" if uses_crlf else "\n"
    lines = content.decode().splitlines(keepends=True)

    # Find insertion point: right after "Add\r\n" header
    insert_at = None
    for i, line in enumerate(lines):
        if line.rstrip() == "Add":
            # Next line is the column header; next-next is where we insert
            insert_at = i + 2
            break
    if insert_at is None:
        # Fall back: find first date-line and insert above it
        for i, line in enumerate(lines):
            if re.match(r'^\s+\t\d{2}-\d{2}-\d{2}\t', line):
                insert_at = i
                break
    if insert_at is None:
        raise RuntimeError("Growth file: no insertion point found")

    # Build the new entries (newest first, reverse chronological to match file)
    new_blocks = []

    # Reconciliation (dated 4/17/26)
    if reconciliation is not None:
        y, m, day = reconciliation["date"].split("-")
        short_date = f"{m}-{day}-{y[2:]}"
        amt_str = format_morningstar_number(reconciliation["amount"], decimals=2)
        new_blocks.extend([
            f" \t{short_date}\t{eol}",
            f"{reconciliation['type']}Cash{eol}",
            f"--\t--\t{amt_str}\tEdit\t {eol}",
        ])

    # Dividend deposits
    for d in sorted(dividend_deposits, key=lambda x: x["date"], reverse=True):
        y, m, day = d["date"].split("-")
        short_date = f"{m}-{day}-{y[2:]}"
        amt_str = format_morningstar_number(d["amount"], decimals=2)
        new_blocks.extend([
            f" \t{short_date}\t{eol}",
            f"DEPOSITCash{eol}",
            f"--\t--\t{amt_str}\tEdit\t {eol}",
        ])

    # Trades (dated REBALANCE_DATE_ISO)
    y, m, day = REBALANCE_DATE_ISO.split("-")
    short_date = f"{m}-{day}-{y[2:]}"
    for tr in trades:
        company = _company_name_for(tr["ticker"])
        shares_str = format_morningstar_number(tr["shares"], decimals=4)
        price_str = format_morningstar_number(tr["price"], decimals=2)
        amount_str = format_morningstar_number(tr["amount"], decimals=2)
        new_blocks.extend([
            f" \t{short_date}\t{eol}",
            f"{tr['type']}{company}{eol}",
            f"{shares_str}\t{price_str}\t{amount_str}\tEdit\t {eol}",
        ])

    lines[insert_at:insert_at] = new_blocks

    with open(filepath, "wb") as f:
        f.write("".join(lines).encode())


# ────────────────────────────────────────────────────────────────────────
# Phase 6: Report
# ────────────────────────────────────────────────────────────────────────

def write_report(div_result, grw_result, dry_run=False):
    report_lines = [
        "# Q2 2026 Rebalance — Execution Report",
        "",
        f"**Mode:** {'DRY RUN (proposed, not executed)' if dry_run else 'EXECUTED'}",
        f"**Executed:** {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}",
        f"**Rebalance Date:** 04-17-26 @ 2:59 PM CT",
        f"**Pricing Source:** Yahoo Finance close for 2026-04-17",
        f"**IC Proposal:** [Research - IC Proposal Q2 2026 Rebalance]"
        "(./Research%20-%20IC%20Proposal%20Q2%202026%20Rebalance.md)",
        "",
        "---",
        "",
    ]

    for sleeve_label, r in [("Dividend", div_result), ("Growth", grw_result)]:
        report_lines += [
            f"## {sleeve_label} Sleeve",
            "",
            "### Pre-rebalance state",
            f"- Last recorded cash inflow: **{r['pre']['last_inflow_date']}**",
            f"- App cash (replay): **${r['pre']['cash']:,.2f}**",
            f"- Holdings: **{len(r['pre']['shares'])}**",
            "",
        ]

        # Reconciliation block
        if r.get("reconciliation"):
            rec = r["reconciliation"]
            report_lines += [
                "### Phase 1.5 — Morningstar cash reconciliation",
                f"**Book entry only — not a real cash movement.** A one-time "
                f"**{rec['type']}** of **${rec['amount']:,.2f}** is recorded on "
                f"{rec['date']} to align the app's replayed cash with the actual "
                f"Morningstar brokerage balance. This absorbs historical DRIP-vs-cash "
                f"drift (the app treats DRIP as cash; Morningstar reinvested into "
                f"shares) and any dividends paid in the gap period (already in "
                f"Morningstar's current balance). Eric does not actually deposit or "
                f"withdraw this amount.",
                "",
            ]

        report_lines += [
            "### Phase 1 — Dividend gap fill",
        ]
        if r["dividends"]:
            total_div = sum(d["amount"] for d in r["dividends"])
            report_lines.append(f"Added **{len(r['dividends'])}** dividend deposits totaling **${total_div:,.2f}**:")
            report_lines.append("")
            report_lines.append("| Date | Ticker | Shares | $/share | Amount |")
            report_lines.append("|---|---|---|---|---|")
            for d in sorted(r["dividends"], key=lambda x: x["date"]):
                report_lines.append(
                    f"| {d['date']} | {d['ticker']} | {d['shares']:.4f} | "
                    f"${d['dividend_per_share']:.4f} | ${d['amount']:,.2f} |"
                )
        elif r.get("reconciliation"):
            report_lines.append("_Skipped — Morningstar reconciliation above already "
                               "captures gap-period dividends._")
        else:
            report_lines.append("_No dividends found in gap period._")
        report_lines += [
            "",
            "### Phase 2 — Valuation (4/17/26 close)",
            f"- Stock value: **${r['stock_value']:,.2f}**",
            f"- Effective cash: **${r['eff_cash']:,.2f}**",
            f"- **Total sleeve value: ${r['total_value']:,.2f}**",
            "",
            "### Phase 3 — Rebalance trades",
            f"Generated **{len(r['trades'])}** trades:",
            "",
            "| Ticker | Action | Type | Shares | Price | Amount |",
            "|---|---|---|---|---|---|",
        ]
        for tr in sorted(r["trades"], key=lambda t: (t["reason"], t["ticker"])):
            report_lines.append(
                f"| {tr['ticker']} | {tr['reason']} | {tr['type']} | "
                f"{tr['shares']:.4f} | ${tr['price']:.2f} | ${tr['amount']:,.2f} |"
            )
        proceeds = sum(t["amount"] for t in r["trades"] if t["type"] == "SALE")
        outlay = sum(t["amount"] for t in r["trades"] if t["type"] == "PURCHASE")
        projected_cash = r["eff_cash"] + proceeds - outlay
        target_cash = r["total_value"] * CASH_TARGET
        report_lines += [
            "",
            f"- Sale proceeds: **${proceeds:,.2f}**",
            f"- Purchase outlay: **${outlay:,.2f}**",
            f"- Projected cash post-rebalance: **${projected_cash:,.2f}** "
            f"({projected_cash/r['total_value']*100:.2f}% of sleeve)",
            f"- Cash target: **${target_cash:,.2f}** (1.00%)",
            "",
            "---",
            "",
        ]

    with open(REPORT_FILE, "w") as f:
        f.write("\n".join(report_lines))
    print(f"\nReport written: {REPORT_FILE}")


# ────────────────────────────────────────────────────────────────────────
# Main
# ────────────────────────────────────────────────────────────────────────

def run_sleeve(sleeve_name, tx_file, targets):
    print(f"\n{'='*70}")
    print(f"PROCESSING {sleeve_name.upper()} SLEEVE")
    print(f"{'='*70}")

    # Pre-state
    pre = analyze_sleeve(tx_file)
    print(f"Format: {pre['format']}")
    print(f"Holdings: {len(pre['shares'])}, Cash: ${pre['cash']:,.2f}, "
          f"Last inflow: {pre['last_inflow_date']}")

    # Phase 1 — dividend gap fill ONLY if we're not using Morningstar cash.
    # (Morningstar's snapshot already contains any dividends paid, so filling
    # the gap AND reconciling would double-count.)
    ms_cash = MORNINGSTAR_CASH.get(sleeve_name)
    if ms_cash is None:
        dividends = fill_dividend_gap(pre, sleeve_name)
    else:
        print(f"\n[{sleeve_name}] Phase 1: Skipped — reconciling to Morningstar "
              f"cash (${ms_cash:,.2f}) which already includes period dividends")
        dividends = []

    # Phase 1.5 — Morningstar cash reconciliation
    # The app's replayed cash can drift from Morningstar due to historical
    # DRIP-as-cash accounting. Record the delta as a one-time WITHDRAWAL or
    # DEPOSIT dated 4/17/26 labeled as DRIP reconciliation. This also captures
    # any dividends paid in the gap period (they're in Morningstar's cash).
    app_cash = pre["cash"] + sum(d["amount"] for d in dividends)
    reconciliation = None
    if ms_cash is not None:
        drift = app_cash - ms_cash
        if abs(drift) > 1.00:
            print(f"\n[{sleeve_name}] Phase 1.5: Morningstar cash reconciliation")
            print(f"  App cash (replayed):  ${app_cash:,.2f}")
            print(f"  Morningstar cash:     ${ms_cash:,.2f}")
            print(f"  Drift to reconcile:   ${drift:+,.2f}")
            reconciliation = {
                "date": REBALANCE_DATE_ISO,
                "amount": round(abs(drift), 2),
                "type": "WITHDRAWAL" if drift > 0 else "DEPOSIT",
                "note": "DRIP + gap-period dividend reconciliation to Morningstar",
            }
            print(f"  Recording {reconciliation['type']} of ${reconciliation['amount']:,.2f}")

    # Phase 2 — prices for all current + target tickers
    all_tickers = set(pre["shares"].keys()) | set(targets.keys())
    print(f"\n[{sleeve_name}] Phase 2: Pricing {len(all_tickers)} tickers @ 4/17/26")
    prices, missing = fetch_all_prices(all_tickers, REBALANCE_DATE_ISO)
    if missing:
        print(f"  ! MISSING PRICES: {missing}")

    # Phase 3 — compute trades using Morningstar cash as ground truth
    effective_cash_for_rebalance = ms_cash if ms_cash is not None else app_cash
    trades, total_value = compute_rebalance_trades(
        pre, targets, prices, dividends, sleeve_name,
        override_cash=effective_cash_for_rebalance,
    )

    stock_value = sum(pre["shares"].get(t, 0) * prices.get(t, 0) for t in pre["shares"])

    return {
        "pre": pre, "dividends": dividends, "reconciliation": reconciliation,
        "prices": prices, "trades": trades,
        "stock_value": stock_value, "eff_cash": effective_cash_for_rebalance,
        "total_value": total_value,
    }


def main():
    print("Q2 2026 Rebalance Executor")
    print(f"Rebalance date: {REBALANCE_DATE_ISO} (2:59 PM CT)")
    dry_run = "--dry-run" in sys.argv
    print(f"Mode: {'DRY RUN (no file writes)' if dry_run else 'LIVE EXECUTION'}\n")

    div_result = run_sleeve("dividend", DIVIDEND_FILE, DIVIDEND_TARGETS)
    grw_result = run_sleeve("growth", GROWTH_FILE, GROWTH_TARGETS)

    # Phase 5 — write back to files
    if not dry_run:
        print("\n" + "="*70)
        print("PHASE 5: Writing changes to transaction files")
        print("="*70)
        append_to_dividend_file(
            DIVIDEND_FILE, div_result["dividends"], div_result["trades"],
            reconciliation=div_result.get("reconciliation"),
        )
        print(f"  ✓ Updated {DIVIDEND_FILE.name}")

        append_to_growth_file(
            GROWTH_FILE, grw_result["dividends"], grw_result["trades"],
            reconciliation=grw_result.get("reconciliation"),
        )
        print(f"  ✓ Updated {GROWTH_FILE.name}")
    else:
        print("\n[Dry run — transaction files unchanged]")

    # Phase 6 — report (always written so dry-run output is reviewable)
    write_report(div_result, grw_result, dry_run=dry_run)

    print("\n✓ Rebalance executor complete.")


if __name__ == "__main__":
    main()
