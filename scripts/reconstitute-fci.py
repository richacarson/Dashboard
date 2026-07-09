#!/usr/bin/env python3
"""
FCI reconstitution — rebuild FCI 100 / FCI Values 100 to the new top-100
equal-weight rosters at 7/8 close prices, booked 2026-07-09.

Reads the final rosters from /tmp/fci_final.json (produced upstream), current
holdings from the portfolio-history JSON, fetches 7/8 closes from Yahoo, and
appends By-Activity SALE/PURCHASE blocks to the FCI transaction files.

Run with --write to actually modify files; default is a dry run.
"""
import json, os, re, sys, urllib.request, concurrent.futures, importlib.util
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
WRITE = "--write" in sys.argv
TRADE_DATE = "07-09-26"
PRICE_DATE = "2026-07-08"

final = json.load(open("/tmp/fci_final.json"))
man = {x["ticker"]: x for x in json.loads(urllib.request.urlopen(
    urllib.request.Request("https://richacarson.github.io/Stock-Screener/manifest.json",
                           headers={"User-Agent": "Mozilla/5.0"}), timeout=30).read())}

spec = importlib.util.spec_from_file_location("bph", REPO/"scripts"/"build-portfolio-history.py")
bph = importlib.util.module_from_spec(spec); spec.loader.exec_module(bph)
N2T = dict(bph.NAME_TO_TICKER)
reverse = {}
for name, tk in N2T.items():
    reverse.setdefault(tk, name)   # first name wins

# ---- 7/8 prices ----
def fetch(t):
    import time
    P1, P2 = 1783382400, 1783728000  # ~7/7..7/11 2026
    for attempt in range(4):
        try:
            u = f"https://query1.finance.yahoo.com/v8/finance/chart/{t}?period1={P1}&period2={P2}&interval=1d"
            r = json.loads(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"}), timeout=25).read())["chart"]["result"][0]
            m = {datetime.utcfromtimestamp(x).strftime("%Y-%m-%d"): c for x, c in zip(r["timestamp"], r["indicators"]["quote"][0]["close"]) if c}
            p = m.get(PRICE_DATE) or (list(m.values())[-1] if m else None)
            if p:
                return t, p
        except Exception:
            pass
        time.sleep(0.5 * (attempt + 1))
    return t, None

need = set()
for sl in ("fci100", "fciValues"):
    need |= set(final[sl]) | set(json.load(open(REPO/"public"/f"portfolio-history-{sl}.json"))["holdings"])
prices = {}
with concurrent.futures.ThreadPoolExecutor(max_workers=16) as ex:
    for t, p in ex.map(fetch, need):
        prices[t] = p

# ---- name mappings for new tickers ----
name_additions = {}
for sl in ("fci100", "fciValues"):
    for t in final[sl]:
        if t not in reverse:
            nm = man.get(t, {}).get("name")
            if not nm:
                sys.exit(f"No company name for {t}")
            name_additions[nm] = t
            reverse[t] = nm

def fmt(n, d=4):
    return f"{n:,.{d}f}"

def block(tx_type, ticker, shares, price):
    amount = shares * price
    return (f" \t{TRADE_DATE}\t\n"
            f"{tx_type}{reverse[ticker]}\n"
            f"{fmt(shares)}\t{fmt(price,4)}\t{fmt(amount,2)}\tEdit\t \n")

summary = {}
file_blocks = {}
for sl in ("fci100", "fciValues"):
    d = json.load(open(REPO/"public"/f"portfolio-history-{sl}.json"))
    cur = d["holdings"]; cash = d.get("cash", 0)
    nav = sum(cur.get(t, 0) * (prices.get(t) or 0) for t in cur) + cash
    tgt = nav / 100.0
    roster = set(final[sl])
    trades = []
    for t in sorted(set(cur) | roster):
        p = prices.get(t)
        if not p:
            sys.exit(f"missing price {t}")
        tgt_sh = (tgt / p) if t in roster else 0.0
        delta = tgt_sh - cur.get(t, 0.0)
        if abs(delta * p) < 1.0:
            continue
        trades.append((t, "PURCHASE" if delta > 0 else "SALE", abs(delta), p))
    blocks = "".join(block(tt, t, sh, p) for t, tt, sh, p in trades)
    file_blocks[sl] = blocks
    # resulting book
    newh = {t: (tgt/prices[t]) for t in roster}
    summary[sl] = dict(nav=nav, tgt=tgt, ntrades=len(trades),
                       nnew=len(roster), maxw=max(newh[t]*prices[t]/nav for t in roster)*100,
                       minw=min(newh[t]*prices[t]/nav for t in roster)*100)

print("=== NAME_TO_TICKER additions needed ===")
for nm, t in sorted(name_additions.items(), key=lambda x: x[1]):
    print(f'    "{nm}": "{t}",')
print("\n=== resulting book ===")
for sl, s in summary.items():
    print(f"  {sl}: NAV ${s['nav']:,.0f}  target/name ${s['tgt']:,.0f}  trades {s['ntrades']}  "
          f"holdings {s['nnew']}  weight range {s['minw']:.2f}%-{s['maxw']:.2f}%")

if WRITE:
    # 1) add name mappings to build-portfolio-history.py
    if name_additions:
        src = (REPO/"scripts"/"build-portfolio-history.py").read_text()
        add = "".join(f'    "{nm}": "{t}",\n' for nm, t in sorted(name_additions.items(), key=lambda x: x[1]))
        # insert after the NAME_TO_TICKER opening brace line
        src = re.sub(r"(NAME_TO_TICKER\s*=\s*\{\n)", r"\1" + add, src, count=1)
        (REPO/"scripts"/"build-portfolio-history.py").write_text(src)
    # 2) append blocks before the trailing "As of" line
    for sl in ("fci100", "fciValues"):
        f = REPO/"transactions"/f"{sl}_strategy_transactions.txt"
        lines = f.read_text().splitlines(keepends=True)
        idx = len(lines)
        for i in range(len(lines)-1, -1, -1):
            if lines[i].startswith("As of"):
                idx = i; break
        lines[idx:idx] = [file_blocks[sl]]
        f.write_text("".join(lines))
    print("\n[WROTE files]")
else:
    print("\n[dry run — no files written]  (re-run with --write)")
