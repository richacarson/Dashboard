#!/usr/bin/env python3
"""
Build per-holding fundamentals (lite, free-data version) for the Metrics
fundamentals panel.

Source: Yahoo Finance keyless fundamentals-timeseries (annual + quarterly
diluted EPS, free cash flow, diluted shares) + monthly close prices. Rolls the
trailing 4 quarters to TTM, computes annual P/E and P/FCF at each fiscal
year-end, and a ~5y monthly price line for the EPS-vs-price chart.

USD ONLY: any holding whose financials are reported in a non-USD currency
(most ADRs / foreign names) is skipped — its price is USD but statements are
local currency, so the multiples would be nonsense.

Universe = union of current holdings across dividend, growth, fci100, fciValues
(read from public/portfolio-history-*.json).

Writes public/fundamentals/<TICKER>.json and public/fundamentals/index.json.
"""
import json, os, sys, time, urllib.request, urllib.parse, concurrent.futures
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / "public" / "fundamentals"
OUT.mkdir(parents=True, exist_ok=True)
UA = {"User-Agent": "Mozilla/5.0"}

# Crumb-authenticated opener (needed for quoteSummary forward estimates)
import http.cookiejar
_OP = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
_OP.addheaders = [("User-Agent", "Mozilla/5.0")]
_CRUMB = None
try:
    _OP.open("https://fc.yahoo.com", timeout=15)
except Exception:
    pass
try:
    _CRUMB = _OP.open("https://query1.finance.yahoo.com/v1/test/getcrumb", timeout=15).read().decode()
except Exception:
    _CRUMB = None


def _get(url):
    for _ in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=25) as r:
                return json.loads(r.read())
        except Exception:
            time.sleep(0.5)
    return None


def forward(sym):
    """Forward EPS / forward P/E from Yahoo quoteSummary (crumb-auth)."""
    if not _CRUMB:
        return {}
    url = (f"https://query1.finance.yahoo.com/v10/finance/quoteSummary/{urllib.parse.quote(sym)}"
           f"?modules=defaultKeyStatistics&crumb={urllib.parse.quote(_CRUMB)}")
    for _ in range(3):
        try:
            d = json.loads(_OP.open(url, timeout=20).read())
            ks = d["quoteSummary"]["result"][0].get("defaultKeyStatistics", {}) or {}
            return {"eps": (ks.get("forwardEps") or {}).get("raw"),
                    "pe": (ks.get("forwardPE") or {}).get("raw")}
        except Exception:
            time.sleep(0.4)
    return {}


def timeseries(sym, types):
    url = (f"https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/{sym}"
           f"?symbol={urllib.parse.quote(sym)}&type={types}&period1=1262304000&period2=1799999999&merge=false")
    d = _get(url)
    out = {}
    for block in ((d or {}).get("timeseries", {}) or {}).get("result", []) or []:
        t = block.get("meta", {}).get("type", ["?"])[0]
        series = []
        for v in block.get(t, []) or []:
            if v and v.get("reportedValue"):
                series.append((v["asOfDate"], v["reportedValue"]["raw"], v.get("currencyCode")))
        if series:
            out[t] = series
    return out


def monthly_prices(sym):
    url = (f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}"
           f"?period1=1420070400&period2=1799999999&interval=1mo")
    d = _get(url)
    try:
        r = d["chart"]["result"][0]
        ts, cl = r["timestamp"], r["indicators"]["quote"][0]["close"]
        return [(datetime.utcfromtimestamp(t).strftime("%Y-%m"), c) for t, c in zip(ts, cl) if c]
    except Exception:
        return []


def close_on_or_before(prices, ym):
    prev = None
    for d, c in prices:
        if d <= ym:
            prev = c
        else:
            break
    return prev


def build(sym):
    ann = timeseries(sym, "annualDilutedEPS,annualFreeCashFlow,annualDilutedAverageShares")
    qtr = timeseries(sym, "quarterlyDilutedEPS,quarterlyFreeCashFlow")
    if "annualDilutedEPS" not in ann:
        return sym, None
    # currency check — statements must be USD
    cur = None
    for s in ann.get("annualDilutedEPS", []):
        if s[2]:
            cur = s[2]; break
    if cur and cur != "USD":
        return sym, {"skip": "non-USD", "currency": cur}

    prices = monthly_prices(sym)
    if not prices:
        return sym, None

    eps = {d: v for d, v, _ in ann.get("annualDilutedEPS", [])}
    fcf = {d: v for d, v, _ in ann.get("annualFreeCashFlow", [])}
    sh = {d: v for d, v, _ in ann.get("annualDilutedAverageShares", [])}
    years = sorted(set(eps) | set(fcf))
    annual = []
    for d in years:
        ym = d[:7]
        px = close_on_or_before(prices, ym)
        e = eps.get(d); f = fcf.get(d); s = sh.get(d)
        fcfps = (f / s) if (f and s) else None
        annual.append({
            "date": d, "eps": e, "fcf": f, "fcfps": fcfps, "shares": s, "px": px,
            "pe": (px / e) if (px and e and e > 0) else None,
            "pfcf": (px / fcfps) if (px and fcfps and fcfps > 0) else None,
        })

    # TTM from last 4 quarters
    qe = sorted(qtr.get("quarterlyDilutedEPS", []))
    qf = sorted(qtr.get("quarterlyFreeCashFlow", []))
    ttm_eps = sum(v for _, v, _ in qe[-4:]) if len(qe) >= 4 else None
    ttm_fcf = sum(v for _, v, _ in qf[-4:]) if len(qf) >= 4 else None
    latest_sh = sh.get(years[-1]) if years else None
    ttm_fcfps = (ttm_fcf / latest_sh) if (ttm_fcf and latest_sh) else None

    return sym, {
        "ticker": sym, "currency": cur or "USD",
        "asof": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "ttm": {"eps": ttm_eps, "fcf": ttm_fcf, "fcfps": ttm_fcfps, "shares": latest_sh},
        "fwd": forward(sym),
        "annual": annual,
        "quarterly": [{"date": d, "eps": v} for d, v, _ in qe[-8:]],
        "price": [{"m": m, "c": round(c, 2)} for m, c in prices[-72:]],  # last 6y monthly
    }


def universe():
    syms = set()
    for sl in ("dividend", "growth", "fci100", "fciValues"):
        p = REPO / "public" / f"portfolio-history-{sl}.json"
        if p.exists():
            syms |= set((json.load(open(p)).get("holdings") or {}).keys())
    return sorted(syms)


def main():
    only = [a for a in sys.argv[1:] if not a.startswith("-")]
    syms = only or universe()
    print(f"Building fundamentals for {len(syms)} tickers")
    built, skipped, failed = [], [], []
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        for sym, data in ex.map(build, syms):
            if data is None:
                failed.append(sym)
            elif data.get("skip"):
                skipped.append((sym, data.get("currency")))
            else:
                (OUT / f"{sym}.json").write_text(json.dumps(data, separators=(",", ":")))
                built.append(sym)
    (OUT / "index.json").write_text(json.dumps({
        "generated": datetime.now(timezone.utc).isoformat(),
        "available": sorted(built),
        "excluded_non_usd": sorted(s for s, _ in skipped),
        "no_data": sorted(failed),
    }, indent=1))
    print(f"  built {len(built)} | excluded (non-USD): {len(skipped)} | no data: {len(failed)}")
    if skipped:
        print("  non-USD:", ", ".join(f"{s}({c})" for s, c in skipped[:30]))
    if failed:
        print("  no data:", ", ".join(failed[:30]))


if __name__ == "__main__":
    main()
