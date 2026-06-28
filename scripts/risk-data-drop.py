#!/usr/bin/env python3
"""
Risk Data Drop — pre-market quantitative sweep of the 52 holdings.

Runs inside GitHub Actions (where FINHUB_API / FMP_API secrets are injected).
Produces public/risk-data-drop.json: raw facts per holding, NOT judgments.
The Risk Sentinel routine reads this file and does the interpretation
(severity, thesis cross-check, deal watch).

Design notes:
  - Thin on purpose. We fetch only the three things nothing else in the repos
    already provides: per-name price/% move, per-name earnings surprise, and
    analyst-recommendation drift. Calendars, theses, and levels are read by the
    Sentinel from their existing committed sources.
  - Defensive by default. Any single failed call records an error and leaves the
    field null. One bad ticker never sinks the run. Missing data stays missing.
  - FMP batch quote is one call for all 52 (price/% move). Finnhub provides the
    per-name recommendation trend and earnings surprise.
"""

import json
import os
import sys
import time
import urllib.request
import urllib.parse
from datetime import datetime, timezone

FINNHUB_KEY = os.environ.get("FINNHUB_KEY", "")
FMP_KEY = os.environ.get("FMP_KEY", "")

OUT_PATH = "public/risk-data-drop.json"

# --- The universe -----------------------------------------------------------
# Keep in sync with the live book. NOTE: uses DVN (Coterra merged into Devon
# 2026-05-07); Stock-Screener/data/portfolios.json still says CTRA — the
# Sentinel's roster-integrity step flags that drift. Digital sleeve included.
SLEEVES = {
    "Dividend": ["ABT", "ADI", "ATO", "ADP", "BKH", "CAT", "CHD", "CL", "DVN",
                 "FAST", "GD", "GPC", "LRCX", "LMT", "NEE", "NTR", "ORI", "PCAR",
                 "QCOM", "DGX", "SSNC", "STLD", "SYK", "TEL", "VLO"],
    "Growth":   ["AMD", "AEM", "ATAT", "CVX", "CWAN", "CNX", "COIN", "CRDO",
                 "EIX", "FCX", "FTNT", "SUPV", "HRMY", "HUT", "HOOD", "KEYS",
                 "MARA", "MRVL", "NVDA", "NXPI", "OKE", "SYF", "TSM", "TOL", "VST"],
    "Digital":  ["IBIT", "ETHA"],
}
SLEEVE_OF = {t: s for s, ts in SLEEVES.items() for t in ts}
UNIVERSE = [t for ts in SLEEVES.values() for t in ts]

errors = []


def fetch_json(url, timeout=15):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "RiskDataDrop/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read())
    except Exception as e:
        return {"__error__": str(e)}


def log_err(ticker, field, msg):
    errors.append({"ticker": ticker, "field": field, "msg": str(msg)[:200]})


# --- 1. FMP batch quote (one call) for price + % move -----------------------
quotes = {}
if FMP_KEY:
    syms = ",".join(UNIVERSE)
    url = f"https://financialmodelingprep.com/api/v3/quote/{syms}?apikey={FMP_KEY}"
    data = fetch_json(url)
    if isinstance(data, list):
        for q in data:
            s = q.get("symbol")
            if s:
                quotes[s] = {
                    "price": q.get("price"),
                    "pct_change": q.get("changesPercentage"),
                    "prev_close": q.get("previousClose"),
                    "source": "fmp",
                }
        print(f"FMP batch quote: {len(quotes)}/{len(UNIVERSE)} names")
    else:
        log_err("*", "fmp_batch_quote", data.get("__error__", "unexpected shape")
                if isinstance(data, dict) else "unexpected shape")
else:
    print("No FMP_KEY — skipping batch quote, will rely on Finnhub /quote")


# --- 2. Per-name Finnhub: quote fallback, recommendation, earnings ----------
def finnhub(path, ticker):
    if not FINNHUB_KEY:
        return None
    url = f"https://finnhub.io/api/v1/{path}{'&' if '?' in path else '?'}token={FINNHUB_KEY}"
    d = fetch_json(url)
    if isinstance(d, dict) and "__error__" in d:
        log_err(ticker, path.split("?")[0], d["__error__"])
        return None
    return d


holdings = {}
for i, t in enumerate(UNIVERSE):
    h = {"sleeve": SLEEVE_OF.get(t)}

    # Price (FMP batch preferred; Finnhub /quote fallback)
    if t in quotes:
        h.update({k: quotes[t][k] for k in ("price", "pct_change", "prev_close")})
        h["quote_source"] = "fmp"
    else:
        q = finnhub(f"quote?symbol={t}", t)
        if q and q.get("c") is not None:
            h.update({"price": q.get("c"), "pct_change": q.get("dp"),
                      "prev_close": q.get("pc"), "quote_source": "finnhub"})
        else:
            h.update({"price": None, "pct_change": None, "prev_close": None,
                      "quote_source": None})

    # Recommendation trend (current vs prior period → Sentinel computes drift)
    rec = finnhub(f"stock/recommendation?symbol={t}", t)
    if isinstance(rec, list) and rec:
        cur = rec[0]
        prev = rec[1] if len(rec) > 1 else None
        h["recommendation"] = {
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
    else:
        h["recommendation"] = None

    # Earnings surprise (most recent actual vs estimate)
    earn = finnhub(f"stock/earnings?symbol={t}&limit=4", t)
    if isinstance(earn, list) and earn:
        last = earn[0]
        h["earnings"] = {
            "period": last.get("period"),
            "eps_actual": last.get("actual"),
            "eps_estimate": last.get("estimate"),
            "surprise": last.get("surprise"),
            "surprise_pct": last.get("surprisePercent"),
        }
    else:
        h["earnings"] = None

    holdings[t] = h

    # Pace Finnhub to stay under the 60/min free-tier limit (2 calls/name here)
    if FINNHUB_KEY:
        time.sleep(1.1)
    if (i + 1) % 10 == 0:
        print(f"  …{i + 1}/{len(UNIVERSE)} processed")


# --- 3. FMP analyst grade actions (best-effort enhancement) -----------------
# Recent upgrades/downgrades per name. FMP has reshuffled these endpoints over
# time, so this is best-effort: if it returns nothing, we degrade silently and
# the Finnhub recommendation trend above remains the dependable rec signal.
if FMP_KEY:
    grade_hits = 0
    for t in UNIVERSE:
        url = f"https://financialmodelingprep.com/api/v3/upgrades-downgrades?symbol={t}&apikey={FMP_KEY}"
        d = fetch_json(url)
        if isinstance(d, list) and d:
            recent = [{
                "date": g.get("publishedDate", "")[:10],
                "firm": g.get("gradingCompany"),
                "action": g.get("action"),
                "from": g.get("previousGrade"),
                "to": g.get("newGrade"),
            } for g in d[:3]]
            holdings.setdefault(t, {})["recent_grades"] = recent
            grade_hits += 1
        time.sleep(0.3)
    print(f"FMP grade actions: {grade_hits}/{len(UNIVERSE)} names had recent activity")


# --- 4. Write -----------------------------------------------------------------
out = {
    "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "universe_count": len(UNIVERSE),
    "universe": UNIVERSE,
    "sleeves": SLEEVES,
    "holdings": holdings,
    "errors": errors,
    "sources": {
        "finnhub": bool(FINNHUB_KEY),
        "fmp": bool(FMP_KEY),
    },
}

os.makedirs("public", exist_ok=True)
with open(OUT_PATH, "w") as f:
    json.dump(out, f, indent=2)

priced = sum(1 for h in holdings.values() if h.get("price") is not None)
print(f"Wrote {OUT_PATH}: {len(holdings)} holdings, {priced} priced, {len(errors)} errors")
if not priced:
    # No prices at all almost always means a bad/empty key — surface loudly so
    # the Sentinel (and Carson) don't trust an empty drop.
    print("WARNING: zero holdings priced — check FINHUB_API / FMP_API secrets", file=sys.stderr)
