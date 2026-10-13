#!/usr/bin/env python3
"""
Q4 2026 Rebalance Executor
==========================

Books the Q4 2026 rebalance (IC Proposal 2026-10-09), executed mid-day
2026-10-13, into the dividend and growth transaction files.

Pricing:
  - The 33 names in Carson's order screenshots book at their actual fill price.
  - Every other name is brought to its exact target at the 12:00 ET price on
    10/13 (same "model the rest to target" approach as Q3).

Sizing (same as Q3): total = Σ shares × price + real cash; each position is
set to total × 99% × weight, leaving 1% cash. Holdings come from the
portfolio-history JSON; cash from MORNINGSTAR_CASH.

Usage:  python3 -m scripts.q4_2026_rebalance.execute [--dry-run]
"""

import re
import sys
from collections import defaultdict
from datetime import datetime

from scripts.q3_2026_rebalance.execute import analyze_sleeve, _bph, REPO
from scripts.q4_2026_rebalance.ic_targets import (
    REBALANCE_DATE_ISO, DIVIDEND_TARGETS, GROWTH_TARGETS, CASH_TARGET,
    MORNINGSTAR_CASH, FILLS, NOON_PRICES, NEW_COMPANY_NAMES,
)

DIVIDEND_FILE = REPO / "transactions" / "dividend_strategy_transactions.txt"
GROWTH_FILE = REPO / "transactions" / "growth_strategy_transactions.txt"
REPORT_FILE = REPO / "public" / "research" / "Q4 2026 Rebalance Execution Report.md"

_y, _m, _d = REBALANCE_DATE_ISO.split("-")
SHORT_DATE = f"{_m}-{_d}-{_y[2:]}"


def num(n, decimals):
    return f"{n:,.{decimals}f}"


def price_for(sleeve, t):
    if t in FILLS[sleeve]:
        return FILLS[sleeve][t][1], "fill"
    return NOON_PRICES[t], "12:00 ET"


def company_name_for(ticker):
    combined = {v: k for k, v in _bph.NAME_TO_TICKER.items() if v != "__CASH__"}
    combined.update({v: k for k, v in NEW_COMPANY_NAMES.items()})
    if ticker not in combined:
        raise RuntimeError(f"No company name mapping for '{ticker}'")
    return combined[ticker]


def compute(sleeve, targets):
    pre = analyze_sleeve(DIVIDEND_FILE if sleeve == "dividend" else GROWTH_FILE, sleeve)
    shares = pre["shares"]
    cash = MORNINGSTAR_CASH[sleeve]

    prices, sources = {}, {}
    for t in set(shares) | set(targets):
        prices[t], sources[t] = price_for(sleeve, t)

    stock_value = sum(s * prices[t] for t, s in shares.items())
    total = stock_value + cash
    investable = total * (1 - CASH_TARGET)

    trades = []
    for t in sorted(set(shares) | set(targets)):
        cur = shares.get(t, 0.0)
        w = targets.get(t, 0.0)
        p = prices[t]
        delta = investable * w - cur * p
        if w == 0:
            qty, side, reason = cur, "SALE", "EXIT"
        elif cur == 0:
            qty, side, reason = delta / p, "PURCHASE", "NEW"
        elif abs(delta) < 1.00:
            continue
        elif delta > 0:
            qty, side, reason = delta / p, "PURCHASE", "ADD"
        else:
            qty, side, reason = min(cur, -delta / p), "SALE", "TRIM"
        qty = round(qty, 4)
        trades.append({
            "ticker": t, "type": side, "reason": reason, "shares": qty,
            "price": p, "amount": round(qty * p, 2), "source": sources[t],
        })

    # Every screenshot trade must agree in direction with the modelled trade.
    traded = {tr["ticker"]: tr for tr in trades}
    for t, (side, _) in FILLS[sleeve].items():
        tr = traded.get(t)
        want = "PURCHASE" if side == "BUY" else "SALE"
        if tr is None or tr["type"] != want:
            raise RuntimeError(f"{sleeve} {t}: screenshot says {side}, model says "
                               f"{tr['type'] if tr else 'no trade'}")

    proceeds = sum(tr["amount"] for tr in trades if tr["type"] == "SALE")
    outlay = sum(tr["amount"] for tr in trades if tr["type"] == "PURCHASE")
    target_cash = total * CASH_TARGET

    cash_leg = None
    if pre["format"] == "security":
        # 'By Security' trades don't move cash: one cash leg lands it on 1%.
        delta = cash - target_cash
        if abs(delta) > 1.00:
            cash_leg = {"type": "WITHDRAWAL" if delta > 0 else "DEPOSIT",
                        "amount": round(abs(delta), 2)}
        post_cash = target_cash
    else:
        post_cash = cash + proceeds - outlay

    post_shares = dict(shares)
    for tr in trades:
        sgn = 1 if tr["type"] == "PURCHASE" else -1
        post_shares[tr["ticker"]] = post_shares.get(tr["ticker"], 0.0) + sgn * tr["shares"]
    post_shares = {t: s for t, s in post_shares.items() if s > 0.00005}

    print(f"\n== {sleeve.upper()} ==")
    print(f"  stock ${stock_value:,.2f} + cash ${cash:,.2f} = total ${total:,.2f}")
    for tr in trades:
        print(f"  {tr['ticker']:5s} {tr['reason']:4s} {tr['type']:8s} {tr['shares']:>12,.4f} "
              f"@ {tr['price']:>10,.4f} ({tr['source']:8s}) = ${tr['amount']:>12,.2f}")
    print(f"  proceeds ${proceeds:,.2f}  outlay ${outlay:,.2f}  cash leg {cash_leg}")
    print(f"  post cash ${post_cash:,.2f} ({post_cash / total * 100:.3f}%)  target ${target_cash:,.2f}")
    for t, w in sorted(targets.items(), key=lambda kv: -kv[1]):
        actual = post_shares.get(t, 0) * prices[t] / total
        assert abs(actual - w * (1 - CASH_TARGET)) < 0.0005, f"{t} lands at {actual:.4%}"
    assert set(post_shares) == set(targets), set(post_shares) ^ set(targets)

    return {"pre": pre, "cash": cash, "stock_value": stock_value, "total": total,
            "trades": trades, "proceeds": proceeds, "outlay": outlay,
            "cash_leg": cash_leg, "post_cash": post_cash, "post_shares": post_shares,
            "prices": prices}


def write_dividend(r):
    with open(DIVIDEND_FILE) as f:
        lines = f.readlines()

    if r["cash_leg"]:
        idx = next(i for i, l in enumerate(lines) if l.startswith("CASH$\t"))
        leg = r["cash_leg"]
        lines.insert(idx + 1, f"  \t{SHORT_DATE}\t{leg['type']}\t--\t--\t{num(leg['amount'], 2)}\tEdit\t \n")

    header = re.compile(r'^([A-Z][A-Z0-9]{0,5})\t.+?\t[\d.,]+\t[\d.,]+\t')
    for tr in r["trades"]:
        row = (f" \t{SHORT_DATE}\t{tr['type']}\t{num(tr['shares'], 4)}\t"
               f"{num(tr['price'], 4)}\t{num(tr['amount'], 2)}\tEdit\t \n")
        pos = next((i for i, l in enumerate(lines)
                    if (m := header.match(l)) and m.group(1) == tr["ticker"]), None)
        if pos is not None:
            lines.insert(pos + 1, row)
        else:
            as_of = max(i for i, l in enumerate(lines) if l.startswith("As of"))
            lines[as_of:as_of] = [
                f"{tr['ticker']}\t{company_name_for(tr['ticker'])}\t0.0000\t0.0000\t0.00\t\n", row]

    with open(DIVIDEND_FILE, "w") as f:
        f.writelines(lines)


def write_growth(r):
    with open(GROWTH_FILE, "rb") as f:
        content = f.read().decode()
    eol = "\r\n" if "\r\n" in content else "\n"
    lines = content.splitlines(keepends=True)
    insert_at = next(i for i, l in enumerate(lines) if l.rstrip() == "Add") + 2

    blocks = []
    for tr in r["trades"]:
        blocks += [
            f" \t{SHORT_DATE}\t{eol}",
            f"{tr['type']}{company_name_for(tr['ticker'])}{eol}",
            f"{num(tr['shares'], 4)}\t{num(tr['price'], 4)}\t{num(tr['amount'], 2)}\tEdit\t {eol}",
        ]
    lines[insert_at:insert_at] = blocks
    with open(GROWTH_FILE, "wb") as f:
        f.write("".join(lines).encode())


def write_report(div, grw, dry_run):
    out = [
        "# Q4 2026 Rebalance — Execution Report",
        "",
        f"**Mode:** {'DRY RUN (proposed, not executed)' if dry_run else 'EXECUTED'}",
        f"**Booked:** {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}",
        "**Trade Date:** 10-13-26, mid-day (settles 10-14-26)",
        "**IC Proposal:** [IC Proposal — Q4 2026 Rebalance](./IC-Proposal-Q4-2026-Rebalance-2026-10-09.md)",
        "",
        "**Pricing.** Names in the 10/13 order screenshots are booked at their actual fill "
        "price. Every other name is brought to its exact target at its 12:00 ET price on "
        "10/13. Each position is sized to 99% × target weight of the sleeve's value at "
        "those prices, leaving a 1% cash reserve.",
        "",
        "---",
        "",
    ]
    for label, r in (("Dividend", div), ("Growth", grw)):
        out += [
            f"## {label} Sleeve",
            "",
            f"- Stock value at execution prices: **${r['stock_value']:,.2f}**",
            f"- Cash before rebalance: **${r['cash']:,.2f}**",
            f"- **Total sleeve value: ${r['total']:,.2f}**",
            "",
            "| Ticker | Action | Type | Shares | Price | Price source | Amount |",
            "|---|---|---|---|---|---|---|",
        ]
        for tr in sorted(r["trades"], key=lambda t: (t["reason"], t["ticker"])):
            out.append(f"| {tr['ticker']} | {tr['reason']} | {tr['type']} | {tr['shares']:,.4f} | "
                       f"${tr['price']:,.4f} | {tr['source']} | ${tr['amount']:,.2f} |")
        out += [
            "",
            f"- Sale proceeds: **${r['proceeds']:,.2f}**",
            f"- Purchase outlay: **${r['outlay']:,.2f}**",
        ]
        if r["cash_leg"]:
            out.append(f"- Cash deployment ({r['cash_leg']['type'].lower()}): "
                       f"**${r['cash_leg']['amount']:,.2f}**")
        out += [
            f"- Cash after rebalance: **${r['post_cash']:,.2f}** "
            f"({r['post_cash'] / r['total'] * 100:.2f}% of sleeve)",
            "",
            "---",
            "",
        ]
    with open(REPORT_FILE, "w") as f:
        f.write("\n".join(out))
    print(f"\nReport written: {REPORT_FILE}")


def main():
    dry_run = "--dry-run" in sys.argv
    div = compute("dividend", DIVIDEND_TARGETS)
    grw = compute("growth", GROWTH_TARGETS)
    if not dry_run:
        write_dividend(div)
        write_growth(grw)
        print("Transaction files updated.")
    write_report(div, grw, dry_run)


if __name__ == "__main__":
    main()
