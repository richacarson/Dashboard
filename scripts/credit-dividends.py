#!/usr/bin/env python3
"""
Dividend-credit job — maintains a committed ledger of cash dividends to credit
into the live portfolio series, replacing the manual Morningstar deposit export
that stopped ~2026-03-13.

WHAT IT DOES (and deliberately does NOT do):
  - Fetches per-share cash dividends (ex-dates) from Yahoo (events=div) for every
    ticker in the sleeve's transaction universe.
  - Records each NEW (ticker, ex_date) with its split-adjusted DPS into
    transactions/dividend_credits_<sleeve>.json.
  - It does NOT compute the dollar amount or the share count. The builder credits
    `shares_held_on_ex_date (from replay state) x dps` to cash during the history
    build, so the share count is always the as-of-ex-date count.

GUARDRAILS:
  - CUTOVER: only ex_date >= 2026-03-18 is ever recorded. Everything on/before the
    last manual Q1 deposit (ex 03-09, deposited 03-13) is owned by the manual
    deposits already in the transaction file. This boundary prevents double-count.
  - IDEMPOTENT: the ledger is the single source of truth for "already recorded".
    Each entry is keyed by (ticker, ex_date), first-write-wins (an existing key's
    dps is never overwritten, so a Yahoo revision can't rewrite history). Re-running
    only appends keys not already present; a run with no new ex-dates writes nothing
    and leaves the file byte-identical.
"""

import os
import sys
import json
import time
import importlib.util
import urllib.request
import urllib.error
from datetime import datetime, timezone

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CUTOVER = "2026-03-18"   # absolute: never credit on/before the manual Q1 deposits


def load_parser():
    """Reuse the builder's exact transaction parser (same ticker universe/basis)."""
    path = os.path.join(REPO, "scripts", "build-portfolio-history.py")
    spec = importlib.util.spec_from_file_location("bph", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def fetch_dividends(ticker, start="2026-01-01"):
    """Yahoo events=div -> [(ex_date, dps)] on/after `start`, split-adjusted."""
    p1 = int(datetime(2025, 12, 1, tzinfo=timezone.utc).timestamp())
    p2 = int(datetime.now(timezone.utc).timestamp()) + 86400
    url = (f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
           f"?period1={p1}&period2={p2}&interval=1d&events=div")
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode())
            res = data.get("chart", {}).get("result", [])
            out = []
            if res:
                ev = (res[0].get("events", {}) or {}).get("dividends", {}) or {}
                for _, v in ev.items():
                    ts, amt = v.get("date"), v.get("amount")
                    if ts is not None and amt:
                        d = datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d")
                        if d >= start:
                            out.append((d, float(amt)))
            return sorted(out)
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(1.5)
                continue
            return []
        except Exception:
            time.sleep(1)
    return []


def main():
    sleeve = sys.argv[1] if len(sys.argv) > 1 else "dividend"
    tx_file = os.path.join(REPO, "transactions", f"{sleeve}_strategy_transactions.txt")
    ledger_file = os.path.join(REPO, "transactions", f"dividend_credits_{sleeve}.json")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    if not os.path.exists(tx_file):
        print(f"No transaction file for sleeve '{sleeve}' — nothing to do.")
        return

    bph = load_parser()
    transactions, _cash, current_holdings, _splits = bph.parse_transactions(tx_file)
    # Ticker set = positions held now, plus any name traded on/after the cutover
    # (captures a position exited mid-window that still earned an in-window dividend).
    held = {t for t, h in (current_holdings or {}).items()
            if t != "__CASH__" and (h.get("shares", 0) if isinstance(h, dict) else 0) > 0}
    recent = {t["ticker"] for t in transactions if t.get("date", "") >= CUTOVER}
    tickers = sorted(held | recent)
    print(f"[{sleeve}] {len(tickers)} candidate tickers ({len(held)} held now); cutover ex_date >= {CUTOVER}; today {today}")

    # Load existing ledger -> dedupe set keyed by (ticker, ex_date)
    ledger = []
    if os.path.exists(ledger_file):
        with open(ledger_file) as f:
            ledger = json.load(f)
    seen = {(e["ticker"], e["ex_date"]) for e in ledger}
    print(f"[{sleeve}] ledger has {len(ledger)} existing credits")

    added = []
    for tk in tickers:
        for ex_date, dps in fetch_dividends(tk, start=CUTOVER):
            if ex_date < CUTOVER or ex_date > today:
                continue                       # hard cutover + no future-dated
            key = (tk, ex_date)
            if key in seen:
                continue                       # idempotent: already recorded
            seen.add(key)
            entry = {"ticker": tk, "ex_date": ex_date, "dps": round(dps, 6)}
            ledger.append(entry)
            added.append(entry)

    ledger.sort(key=lambda e: (e["ex_date"], e["ticker"]))

    if not added:
        print(f"[{sleeve}] no new dividends — ledger unchanged ({len(ledger)} credits). No-op.")
    else:
        with open(ledger_file, "w") as f:
            json.dump(ledger, f, indent=2)
        print(f"[{sleeve}] added {len(added)} new credits (ledger now {len(ledger)}):")
        for e in added:
            print(f"    {e['ex_date']}  {e['ticker']:<6} dps ${e['dps']:.4f}")
    # Always print the ledger path so the builder/workflow knows what to read.
    print(f"[{sleeve}] ledger: {ledger_file}")


if __name__ == "__main__":
    main()
