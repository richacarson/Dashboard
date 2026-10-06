#!/usr/bin/env python3
"""
Roll QTR_START_DATE / QTR_START_PRICES in src/App.jsx to the new quarter.

QTD% for every holding is measured against the last close of the PREVIOUS
quarter. That basis has to move on the first trading day of each new quarter
or the column silently keeps reporting last quarter's move. It did exactly
that in Q4 2026: the quarter opened 10/1 with the basis still on 7/8 closes,
so a median of 10.1pp of Q3 drift was being shown as this quarter's return
(SSNC read +21.1% against a true +2.8%).

WHAT THIS SCRIPT DOES NOT TOUCH
───────────────────────────────
REBALANCE_ANCHORS. That map is the basis for *weight drift* and for the
"Since Rebalance" panels, and it belongs to the last actual rebalance, not to
the calendar. Drifted weights are computed as

    target_weight x (current_price / anchor_price)

which assumes the book was reset to target weights on the anchor date. Rolling
that map on a quarter boundary when no rebalance was booked would assert a
trade that never happened and corrupt every weight readout. The two bases
nearly coincided in Q3 2026 (quarter opened 7/1, rebalance booked 7/9), which
is how they came to share one map in the first place.

So: this script rolls the QTD basis only. Weight drift keeps reading from
REBALANCE_ANCHORS and is unaffected. Re-anchoring after a real rebalance is a
separate job — that is reanchor-rebalance.py.

IDEMPOTENT
──────────
Safe to run every day. It resolves the target date (the last trading session
before this quarter began) and exits without writing if QTR_START_DATE already
matches. That is what lets the workflow run across the first several days of
the quarter without caring which one is the actual trading day.

Env: FMP_PROXY (Cloudflare Worker, preferred) or FMP_KEY.
Usage:
    python3 scripts/roll-quarter-anchors.py              # roll to current quarter
    python3 scripts/roll-quarter-anchors.py 2026-09-30   # pin an explicit basis date
"""
import datetime as dt
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

FMP_KEY = os.environ.get("FMP_KEY", "")
FMP_PROXY = os.environ.get("FMP_PROXY", "").rstrip("/")
BASE = "https://financialmodelingprep.com/stable"
APP_JSX = Path(__file__).resolve().parent.parent / "src" / "App.jsx"

# Resolving "last trading day of the previous quarter" from a calendar is a
# holiday-table problem. Asking a liquid symbol what it actually last traded is
# not, so we read the calendar off SPY instead of hardcoding market holidays.
CALENDAR_SYMBOL = "SPY"


class ApiError(Exception):
    """A call that failed for a reason unrelated to the symbol having no data."""


def api(path, **params):
    """GET /stable/<path>, same contract as build-fundamentals-fmp.py.

    Returns [] only when FMP genuinely has no rows; raises on anything else.
    FMP answers 200 with an {"Error Message": ...} envelope when throttled, and
    treating that as "no data" is how a rate limit turns into silently wrong
    output rather than a failed run."""
    if FMP_PROXY:
        url = f"{FMP_PROXY}/fmp/stable/{path}?{urllib.parse.urlencode(params)}"
    elif FMP_KEY:
        params["apikey"] = FMP_KEY
        url = f"{BASE}/{path}?{urllib.parse.urlencode(params)}"
    else:
        sys.exit("ERROR: set FMP_PROXY (Worker URL) or FMP_KEY")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; DashboardBuilder/1.0)"})
    last = "unknown"
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                d = json.loads(r.read().decode())
            if isinstance(d, list):
                return d
            last = (d or {}).get("Error Message") or (d or {}).get("message") or str(d)[:120]
        except Exception as e:
            last = f"{type(e).__name__}: {e}"
        if attempt < 4:
            time.sleep(min(30, 2 ** attempt * 2))
    raise ApiError(f"{path} {params}: {last}")


def quarter_first_day(today: dt.date) -> dt.date:
    return dt.date(today.year, ((today.month - 1) // 3) * 3 + 1, 1)


def resolve_basis_date(quarter_start: dt.date) -> str:
    """The last session that actually traded before the quarter opened."""
    rows = api(
        "historical-price-eod/light",
        symbol=CALENDAR_SYMBOL,
        **{"from": (quarter_start - dt.timedelta(days=14)).isoformat(),
           "to": (quarter_start - dt.timedelta(days=1)).isoformat()},
    )
    dates = sorted(r["date"] for r in rows if r.get("date"))
    if not dates:
        sys.exit(f"ERROR: no {CALENDAR_SYMBOL} sessions in the 14 days before {quarter_start}")
    return dates[-1]


def parse_symbols(src: str) -> list[str]:
    """Every held name, plus whatever non-equity sleeves the current map carries.

    Driven off TARGET_WEIGHTS so names added or dropped at a rebalance are picked
    up automatically; the existing QTR_START_PRICES block contributes the digital
    sleeve (IBIT/ETHA), which has no TARGET_WEIGHTS entry."""
    m = re.search(
        r"const TARGET_WEIGHTS = \{\s*dividend:\s*\{([^}]*)\},\s*growth:\s*\{([^}]*)\}",
        src, flags=re.DOTALL)
    if not m:
        sys.exit("ERROR: could not locate TARGET_WEIGHTS in App.jsx")
    syms = re.findall(r"([A-Z][A-Z0-9.\-]*)\s*:", m.group(1) + m.group(2))

    held = set(syms)
    m2 = re.search(r"const QTR_START_PRICES = \{(.*?)\n\};", src, flags=re.DOTALL)
    if m2:
        for extra in re.findall(r"([A-Z][A-Z0-9.\-]*)\s*:", m2.group(1)):
            # Keep non-equity sleeves, drop names that have since been sold so the
            # map does not accumulate exited tickers quarter after quarter.
            if extra not in held and extra in ("IBIT", "ETHA"):
                syms.append(extra)
                held.add(extra)
    return syms


def fetch_closes(symbols: list[str], date: str) -> dict[str, float]:
    closes: dict[str, float] = {}
    for s in symbols:
        rows = api("historical-price-eod/light", symbol=s, **{"from": date, "to": date})
        row = next((r for r in rows if r.get("date") == date), None)
        if row and row.get("price"):
            closes[s] = float(row["price"])
    return closes


def fmt_price(p: float) -> str:
    return f"{p:.4f}".rstrip("0").rstrip(".")


def build_block(date: str, closes: dict[str, float], src: str) -> str:
    m = re.search(
        r"const TARGET_WEIGHTS = \{\s*dividend:\s*\{([^}]*)\},\s*growth:\s*\{([^}]*)\}",
        src, flags=re.DOTALL)
    div = re.findall(r"([A-Z][A-Z0-9.\-]*)\s*:", m.group(1))
    grw = re.findall(r"([A-Z][A-Z0-9.\-]*)\s*:", m.group(2))
    digital = [s for s in ("IBIT", "ETHA") if s in closes]

    def group(label: str, syms: list[str]) -> list[str]:
        present = [s for s in syms if s in closes]
        if not present:
            return []
        out, cur = [f"  // {label}"], []
        for s in present:
            cur.append(f"{s}:{fmt_price(closes[s])}")
            if len(cur) == 10:
                out.append("  " + ", ".join(cur) + ",")
                cur = []
        if cur:
            out.append("  " + ", ".join(cur) + ",")
        return out

    y, mo, d = date.split("-")
    pretty = f"{int(mo)}/{int(d)}/{y[2:]}"
    body = group("Dividend sleeve", div) + group("Growth sleeve", grw) + group("Digital sleeve", digital)
    return (
        f'const QTR_START_DATE = "{date}";\n'
        "const QTR_START_PRICES = {\n"
        f"  // Quarter-start closes ({pretty}) — rolled by scripts/roll-quarter-anchors.py.\n"
        "  // QTD% only. Weight drift and \"Since Rebalance\" read REBALANCE_ANCHORS,\n"
        "  // which belongs to the last actual rebalance and is not touched here.\n"
        + "\n".join(body) + "\n};"
    )


def main() -> int:
    today = dt.date.today()
    src = APP_JSX.read_text()

    if len(sys.argv) > 1:
        basis = sys.argv[1]
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", basis):
            sys.exit(f"ERROR: date must be YYYY-MM-DD, got {basis!r}")
    else:
        basis = resolve_basis_date(quarter_first_day(today))

    current = re.search(r'const QTR_START_DATE = "([^"]+)";', src)
    if current and current.group(1) == basis:
        print(f"QTR_START_DATE already {basis} — nothing to roll.")
        return 0

    symbols = parse_symbols(src)
    print(f"Rolling QTD basis to {basis} close ({len(symbols)} symbols)…")
    closes = fetch_closes(symbols, basis)
    missing = [s for s in symbols if s not in closes]
    if missing:
        print(f"WARNING: no close for: {', '.join(missing)}")
    print(f"  got {len(closes)}/{len(symbols)}")

    # A partial roll is worse than none: names that resolved would read from the
    # new quarter while the rest silently fell back to the stale rebalance anchor,
    # putting two different bases in one column.
    if len(closes) < len(symbols) * 0.95:
        sys.exit(f"ERROR: only {len(closes)}/{len(symbols)} priced — refusing a partial roll")

    new_block = build_block(basis, closes, src)
    new_src, n = re.subn(
        r'const QTR_START_DATE = "[^"]+";\nconst QTR_START_PRICES = \{.*?\n\};',
        lambda _m: new_block, src, count=1, flags=re.DOTALL)
    if n != 1 or new_src == src:
        sys.exit("ERROR: rewrite produced no change — check regexes")

    APP_JSX.write_text(new_src)
    print(f"Updated QTR_START_DATE → {basis}")
    print(f"Updated QTR_START_PRICES → {len(closes)} entries")
    print("REBALANCE_ANCHORS untouched (weight drift / Since Rebalance unaffected)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
