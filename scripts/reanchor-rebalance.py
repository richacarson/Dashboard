#!/usr/bin/env python3
"""
Re-anchor REBALANCE_DATE / REBALANCE_ANCHORS in src/App.jsx.

Fetches the specified session's close prices from Alpaca for every ticker in
TARGET_WEIGHTS (dividend + growth sleeves) and rewrites the two constants in
place. Run via GitHub Action (workflow_dispatch) or locally with
ALPACA_API_KEY / ALPACA_API_SECRET in env.

Usage:
    python scripts/reanchor-rebalance.py                   # defaults to 2026-04-17 close
    python scripts/reanchor-rebalance.py 2026-04-17        # explicit date
"""
import json
import os
import re
import sys
import urllib.request
from pathlib import Path

ALPACA_BASE = "https://data.alpaca.markets"
APP_JSX = Path(__file__).resolve().parent.parent / "src" / "App.jsx"


def parse_target_weights(src: str) -> dict[str, list[str]]:
    """Extract tickers from the TARGET_WEIGHTS block."""
    m = re.search(
        r"const TARGET_WEIGHTS = \{\s*dividend:\s*\{([^}]*)\},\s*growth:\s*\{([^}]*)\}",
        src,
        flags=re.DOTALL,
    )
    if not m:
        sys.exit("ERROR: could not locate TARGET_WEIGHTS in App.jsx")
    sleeve_tickers = {}
    for sleeve, body in (("dividend", m.group(1)), ("growth", m.group(2))):
        tickers = re.findall(r"([A-Z][A-Z0-9.\-]*)\s*:", body)
        sleeve_tickers[sleeve] = tickers
    return sleeve_tickers


def parse_q1_stocks(src: str) -> dict[str, list[str]]:
    """Extract tickers from the Q1_STOCKS block inside the Q1-vs-Q2 metrics subview.
    Returns {} if not found — optional, script still works without it."""
    m = re.search(
        r"const Q1_STOCKS = \{\s*dividend:\s*\[([^\]]*)\],\s*growth:\s*\[([^\]]*)\]",
        src,
        flags=re.DOTALL,
    )
    if not m:
        return {}
    result = {}
    for sleeve, body in (("dividend", m.group(1)), ("growth", m.group(2))):
        result[sleeve] = re.findall(r'"([A-Z][A-Z0-9.\-]*)"', body)
    return result


def fetch_closes(tickers: list[str], date: str, key: str, secret: str) -> dict[str, float]:
    """Fetch 1-day close bars for all tickers for the given session date."""
    # Alpaca accepts comma-separated symbols, up to a reasonable URL length.
    # Chunk conservatively to stay under limits.
    closes: dict[str, float] = {}
    chunk_size = 40
    headers = {"APCA-API-KEY-ID": key, "APCA-API-SECRET-KEY": secret}
    for i in range(0, len(tickers), chunk_size):
        chunk = tickers[i : i + chunk_size]
        url = (
            f"{ALPACA_BASE}/v2/stocks/bars"
            f"?symbols={','.join(chunk)}"
            f"&timeframe=1Day"
            f"&start={date}T00:00:00Z"
            f"&end={date}T23:59:59Z"
            f"&adjustment=split"
            f"&feed=iex"
        )
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.load(resp)
        bars = data.get("bars", {}) or {}
        for sym, rows in bars.items():
            if rows:
                closes[sym] = float(rows[0]["c"])
    return closes


def format_anchors(
    closes: dict[str, float],
    sleeve_tickers: dict[str, list[str]],
    q1_only_tickers: list[str] | None = None,
) -> str:
    """Format the REBALANCE_ANCHORS object body, grouped like the original."""

    def fmt_price(p: float) -> str:
        # Match Yahoo-ish display: 2 decimals, strip trailing zero in integer part
        return f"{p:.2f}".rstrip("0").rstrip(".") if p == int(p) else f"{p:.2f}"

    def fmt_group(syms: list[str]) -> list[str]:
        lines, current = [], []
        for s in syms:
            if s not in closes:
                continue
            current.append(f"{s}:{fmt_price(closes[s])}")
            if len(current) == 10:
                lines.append(", ".join(current) + ",")
                current = []
        if current:
            lines.append(", ".join(current) + ",")
        return lines

    div_lines = fmt_group(sleeve_tickers["dividend"])
    grw_lines = fmt_group(sleeve_tickers["growth"])
    body_lines = ["  " + line for line in div_lines + grw_lines]
    if q1_only_tickers:
        q1_lines = fmt_group(q1_only_tickers)
        if q1_lines:
            body_lines.append("  // Q1 sold stocks (kept for Q1 vs Q2 alpha comparison)")
            body_lines.extend("  " + line for line in q1_lines)
    return "\n".join(body_lines)


def rewrite(src: str, date: str, anchors_body: str) -> str:
    """Replace REBALANCE_DATE and REBALANCE_ANCHORS in App.jsx source."""
    src = re.sub(
        r'const REBALANCE_DATE = "[^"]+";',
        f'const REBALANCE_DATE = "{date}";',
        src,
        count=1,
    )
    pretty_date = "/".join(str(int(p)) for p in date.split("-")[::-1][:2]) + "/" + date[2:4]
    # The above gives DD/MM/YY; we want MM/DD/YY for the comment:
    y, m, d = date.split("-")
    pretty = f"{int(m)}/{int(d)}/{y[2:]}"
    new_block = (
        "const REBALANCE_ANCHORS = {\n"
        f"  // {pretty} CLOSE prices from Alpaca (IEX feed)\n"
        f"{anchors_body}\n"
        "};"
    )
    src = re.sub(
        r"const REBALANCE_ANCHORS = \{[^}]*\};",
        new_block,
        src,
        count=1,
        flags=re.DOTALL,
    )
    return src


def main() -> int:
    date = sys.argv[1] if len(sys.argv) > 1 else "2026-04-17"
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", date):
        sys.exit(f"ERROR: date must be YYYY-MM-DD, got {date!r}")

    key = os.environ.get("ALPACA_API_KEY")
    secret = os.environ.get("ALPACA_API_SECRET")
    if not (key and secret):
        sys.exit("ERROR: ALPACA_API_KEY and ALPACA_API_SECRET must be set in env")

    src = APP_JSX.read_text()
    sleeve_tickers = parse_target_weights(src)
    q1_stocks = parse_q1_stocks(src)
    q2_set = set(sleeve_tickers["dividend"]) | set(sleeve_tickers["growth"])
    q1_only_tickers: list[str] = []
    if q1_stocks:
        q1_all = list(q1_stocks.get("dividend", [])) + list(q1_stocks.get("growth", []))
        # Preserve order, drop dups, drop anything already in Q2 targets
        seen = set()
        for t in q1_all:
            if t not in q2_set and t not in seen:
                q1_only_tickers.append(t)
                seen.add(t)
    all_tickers = sleeve_tickers["dividend"] + sleeve_tickers["growth"] + q1_only_tickers
    print(f"Fetching {len(all_tickers)} tickers for close of {date}…")
    if q1_only_tickers:
        print(f"  (includes {len(q1_only_tickers)} Q1-sold: {', '.join(q1_only_tickers)})")
    closes = fetch_closes(all_tickers, date, key, secret)
    missing = [t for t in all_tickers if t not in closes]
    if missing:
        print(f"WARNING: no bar returned for: {', '.join(missing)}")
    print(f"  got prices for {len(closes)}/{len(all_tickers)} tickers")

    anchors_body = format_anchors(closes, sleeve_tickers, q1_only_tickers)
    new_src = rewrite(src, date, anchors_body)
    if new_src == src:
        sys.exit("ERROR: rewrite produced no change — check regexes")
    APP_JSX.write_text(new_src)
    print(f"Updated REBALANCE_DATE → {date}")
    print(f"Updated REBALANCE_ANCHORS → {len(closes)} entries")
    return 0


if __name__ == "__main__":
    sys.exit(main())
