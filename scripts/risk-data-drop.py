#!/usr/bin/env python3
"""
Risk Data Drop — pre-market quantitative sweep of the 52 holdings.

Runs inside GitHub Actions. Produces public/risk-data-drop.json: raw facts per
holding, NOT judgments. The Risk Sentinel routine interprets them.

Source split (all free tiers, each used for its strength):
  - Alpaca batch snapshot (1 call): price + settled day % move for all 52
    PLUS index refs (SPY, QQQ) so index-level signals in levels.json resolve. PRIMARY.
  - Polygon grouped-daily (<=3 calls): same data, FALLBACK if Alpaca is empty.
  - Finnhub: recommendation trend ONLY, paced under the free 60/min cap.
  - Earnings surprise: read committed earnings-calendar.json for the few names
    with a recent print; call Finnhub /stock/earnings for those only.
  - FMP: removed (free tier 403's the batch quote and lacks grade actions).

Defensive throughout: one failed call records an error and nulls the field;
it never sinks the run. A zero-priced drop screams instead of going green.
"""

import json
import os
import re
import sys
import time
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path

ALPACA_KEY = os.environ.get("ALPACA_API_KEY", "")
ALPACA_SECRET = os.environ.get("ALPACA_API_SECRET", "")
POLYGON_KEY = os.environ.get("POLYGON_API_KEY", "")
FINNHUB_KEY = os.environ.get("FINNHUB_KEY", "")

OUT_PATH = "public/risk-data-drop.json"
EARNINGS_CAL = "public/earnings-calendar.json"

# --- Universe -----------------------------------------------------------------
# Read from TARGET_WEIGHTS in src/App.jsx, which is the live book. This used to
# be a hardcoded list with a "keep in sync with the live book" comment on it,
# and it drifted six names out of date in each sleeve: it was still sweeping
# BKH, DVN, VLO, CWAN, COIN and SUPV after they were sold, and had never picked
# up SPGI, CEG, NWG, NOW, SOFI or YMM — NOW and SOFI being the two largest
# growth positions at 8% and 6.5%.
#
# Nothing caught it because both sleeves still counted 25 and the drop is
# rebuilt every weekday, so it was fresh data about the wrong universe: the one
# kind of staleness that never looks stale. Deriving it removes the class of
# bug rather than this instance, which is why this is not simply a corrected
# list.
APP_JSX = Path(__file__).resolve().parent.parent / "src" / "App.jsx"
DIGITAL = ["IBIT", "ETHA"]   # no TARGET_WEIGHTS entry; sized outside the sleeves


def load_sleeves():
    """Parse TARGET_WEIGHTS out of App.jsx.

    Hard-fails rather than falling back to a stale list. A risk sweep that
    quietly covers the wrong names is worse than one that does not run: the
    first looks green, the second pages someone."""
    try:
        src = APP_JSX.read_text()
    except OSError as ex:
        sys.exit(f"FATAL: cannot read {APP_JSX}: {ex}")
    m = re.search(
        r"const TARGET_WEIGHTS = \{\s*dividend:\s*\{([^}]*)\},\s*growth:\s*\{([^}]*)\}",
        src, flags=re.DOTALL)
    if not m:
        sys.exit("FATAL: could not parse TARGET_WEIGHTS from src/App.jsx")
    out = {}
    for label, body in (("Dividend", m.group(1)), ("Growth", m.group(2))):
        tickers = re.findall(r"([A-Z][A-Z0-9.\-]*)\s*:", body)
        if len(tickers) < 5:
            sys.exit(f"FATAL: only {len(tickers)} tickers parsed for {label} — refusing to run")
        out[label] = tickers
    out["Digital"] = list(DIGITAL)
    return out


SLEEVES = load_sleeves()
SLEEVE_OF = {t: s for s, ts in SLEEVES.items() for t in ts}
UNIVERSE = [t for ts in SLEEVES.values() for t in ts]
print(f"Universe from App.jsx: {len(UNIVERSE)} names "
      f"({', '.join(f'{k} {len(v)}' for k, v in SLEEVES.items())})")

# Index references — priced so the Sentinel's level check (levels.json) can
# assess index-level supports/resistances (e.g. SPY 645.80). Not holdings;
# emitted in a separate index_refs block. Add tickers here if levels.json
# starts tracking others.
INDEX_REFS = ["SPY", "QQQ"]

ALL_SYMS = UNIVERSE + INDEX_REFS

errors = []


def log_err(ticker, field, msg):
    errors.append({"ticker": ticker, "field": field, "msg": str(msg)[:200]})


def http_json(url, headers=None, timeout=20):
    try:
        req = urllib.request.Request(url, headers=headers or {"User-Agent": "RiskDataDrop/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read()), r.status
    except urllib.error.HTTPError as e:
        return {"__error__": f"HTTP {e.code}"}, e.code
    except Exception as e:
        return {"__error__": str(e)}, 0


def pct(cur, prev):
    try:
        if cur is not None and prev not in (None, 0):
            return round((cur / prev - 1) * 100, 2)
    except Exception:
        pass
    return None


# =============================================================================
# 1. PRICES — Alpaca batch snapshot (primary), 52 holdings + index refs
# =============================================================================
prices = {}  # ticker -> {price, pct_change, prev_close, quote_source}

if ALPACA_KEY and ALPACA_SECRET:
    syms = ",".join(ALL_SYMS)
    url = f"https://data.alpaca.markets/v2/stocks/snapshots?symbols={syms}&feed=iex"
    hdrs = {"APCA-API-KEY-ID": ALPACA_KEY, "APCA-API-SECRET-KEY": ALPACA_SECRET}
    data, status = http_json(url, headers=hdrs)
    snaps = data.get("snapshots", data) if isinstance(data, dict) else {}
    if isinstance(data, dict) and "__error__" in data:
        log_err("*", "alpaca_snapshot", data["__error__"])
    for t in ALL_SYMS:
        s = snaps.get(t) if isinstance(snaps, dict) else None
        if not s:
            continue
        daily = s.get("dailyBar") or {}
        prevd = s.get("prevDailyBar") or {}
        latest = (s.get("latestTrade") or {}).get("p")
        close = daily.get("c")
        prev_close = prevd.get("c")
        price = latest if latest is not None else close
        prices[t] = {
            "price": price,
            "pct_change": pct(close, prev_close),
            "prev_close": prev_close,
            "quote_source": "alpaca",
        }
    print(f"Alpaca snapshot: {len(prices)}/{len(ALL_SYMS)} priced (HTTP {status})")
else:
    print("No Alpaca creds — will try Polygon fallback")

# --- Polygon grouped-daily fallback (only if Alpaca came up short) ----------
missing = [t for t in ALL_SYMS if t not in prices]
if missing and POLYGON_KEY:
    print(f"Polygon fallback for {len(missing)} names…")

    def grouped(date_str):
        url = (f"https://api.polygon.io/v2/aggs/grouped/locale/us/market/stocks/"
               f"{date_str}?adjusted=true&apiKey={POLYGON_KEY}")
        d, _ = http_json(url)
        if isinstance(d, dict) and d.get("results"):
            return {r["T"]: r.get("c") for r in d["results"] if "T" in r}
        return None

    day_maps = []
    probe = datetime.now(timezone.utc).date() - timedelta(days=1)
    tries = 0
    while len(day_maps) < 2 and tries < 8:
        m = grouped(probe.isoformat())
        if m:
            day_maps.append(m)
        probe -= timedelta(days=1)
        tries += 1
        time.sleep(13)  # free Polygon ~5/min
    if len(day_maps) >= 2:
        latest_map, prev_map = day_maps[0], day_maps[1]
        for t in missing:
            c, p = latest_map.get(t), prev_map.get(t)
            if c is not None:
                prices[t] = {"price": c, "pct_change": pct(c, p),
                             "prev_close": p, "quote_source": "polygon"}
        print(f"Polygon filled {sum(1 for t in missing if t in prices)} names")
    else:
        log_err("*", "polygon_grouped", "could not find 2 trading days with data")

# =============================================================================
# 2. RECOMMENDATION TREND — Finnhub only, holdings only, paced under 60/min
# =============================================================================
recs = {}
FINNHUB_MIN_INTERVAL = 1.3  # ~46/min — comfortably under the free 60/min cap
_last_fh = [0.0]


def finnhub(path, ticker):
    if not FINNHUB_KEY:
        return None
    wait = FINNHUB_MIN_INTERVAL - (time.time() - _last_fh[0])
    if wait > 0:
        time.sleep(wait)
    url = f"https://finnhub.io/api/v1/{path}{'&' if '?' in path else '?'}token={FINNHUB_KEY}"
    d, status = http_json(url)
    _last_fh[0] = time.time()
    if isinstance(d, dict) and "__error__" in d:
        log_err(ticker, path.split("?")[0], d["__error__"])
        return None
    return d


for i, t in enumerate(UNIVERSE):
    rec = finnhub(f"stock/recommendation?symbol={t}", t)
    if isinstance(rec, list) and rec:
        cur = rec[0]
        prev = rec[1] if len(rec) > 1 else None
        recs[t] = {
            "period": cur.get("period"),
            "strongBuy": cur.get("strongBuy"), "buy": cur.get("buy"),
            "hold": cur.get("hold"), "sell": cur.get("sell"),
            "strongSell": cur.get("strongSell"),
            "prev_period": ({
                "period": prev.get("period"), "strongBuy": prev.get("strongBuy"),
                "buy": prev.get("buy"), "hold": prev.get("hold"),
                "sell": prev.get("sell"), "strongSell": prev.get("strongSell"),
            } if prev else None),
        }
    if (i + 1) % 15 == 0:
        print(f"  …rec {i + 1}/{len(UNIVERSE)}")
print(f"Finnhub recommendation: {len(recs)}/{len(UNIVERSE)} names")

# =============================================================================
# 3. EARNINGS SURPRISE — only for names with a recent print (from the calendar)
# =============================================================================
earnings = {}
recent_reporters = []
try:
    cal = json.load(open(EARNINGS_CAL))
    today = datetime.now(timezone.utc).date()
    uni = set(UNIVERSE)
    for e in cal:
        sym = e.get("symbol")
        ds = (e.get("date") or "")[:10]
        if sym in uni and ds:
            try:
                d = datetime.strptime(ds, "%Y-%m-%d").date()
                if 0 <= (today - d).days <= 5:  # reported within last 5 days
                    recent_reporters.append(sym)
            except Exception:
                pass
    recent_reporters = sorted(set(recent_reporters))
    print(f"Recent reporters to check: {recent_reporters or 'none'}")
except Exception as ex:
    print(f"earnings-calendar.json unavailable ({ex}); skipping surprise check")

for t in recent_reporters:
    earn = finnhub(f"stock/earnings?symbol={t}&limit=4", t)
    if isinstance(earn, list) and earn:
        last = earn[0]
        earnings[t] = {
            "period": last.get("period"),
            "eps_actual": last.get("actual"),
            "eps_estimate": last.get("estimate"),
            "surprise": last.get("surprise"),
            "surprise_pct": last.get("surprisePercent"),
        }

# =============================================================================
# 4. ASSEMBLE & WRITE
# =============================================================================
holdings = {}
for t in UNIVERSE:
    p = prices.get(t, {})
    holdings[t] = {
        "sleeve": SLEEVE_OF.get(t),
        "price": p.get("price"),
        "pct_change": p.get("pct_change"),
        "prev_close": p.get("prev_close"),
        "quote_source": p.get("quote_source"),
        "recommendation": recs.get(t),
        "earnings": earnings.get(t),  # null unless it reported in the last 5 days
    }

index_refs = {}
for t in INDEX_REFS:
    p = prices.get(t, {})
    index_refs[t] = {
        "price": p.get("price"),
        "pct_change": p.get("pct_change"),
        "prev_close": p.get("prev_close"),
        "quote_source": p.get("quote_source"),
    }

out = {
    "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "universe_count": len(UNIVERSE),
    "universe": UNIVERSE,
    "sleeves": SLEEVES,
    "holdings": holdings,
    "index_refs": index_refs,
    "recent_reporters": recent_reporters,
    "errors": errors,
    "sources": {
        "price": "alpaca" if any(h.get("quote_source") == "alpaca" for h in holdings.values())
                 else ("polygon" if any(h.get("quote_source") == "polygon" for h in holdings.values()) else None),
        "recommendation": "finnhub" if recs else None,
    },
}

os.makedirs("public", exist_ok=True)
with open(OUT_PATH, "w") as f:
    json.dump(out, f, indent=2)

priced = sum(1 for h in holdings.values() if h.get("price") is not None)
idx_priced = sum(1 for v in index_refs.values() if v.get("price") is not None)
print(f"Wrote {OUT_PATH}: {len(holdings)} holdings, {priced} priced, "
      f"{idx_priced}/{len(INDEX_REFS)} index refs, {len(recs)} rec, "
      f"{len(earnings)} earnings, {len(errors)} errors")
if not priced:
    print("WARNING: zero holdings priced — check Alpaca/Polygon creds; "
          "do NOT trust this drop as 'all clear'", file=sys.stderr)
    sys.exit(1)
