#!/usr/bin/env python3
"""
Build per-holding fundamentals for the Metrics fundamentals panel.

Deep history from SEC EDGAR (audited 10-K filings, ~15y of GAAP diluted EPS +
free cash flow + diluted shares), blended with Yahoo for the recent TTM figure,
the forward EPS estimate, and ~16y of monthly prices. Computes annual P/E and
P/FCF at each fiscal year-end.

US filers only: a name without a SEC CIK, or whose statements aren't in USD, is
skipped (most ADRs / foreign reporters). Universe = union of current holdings
across dividend, growth, fci100, fciValues.

Writes public/fundamentals/<TICKER>.json + public/fundamentals/index.json.
"""
import json, os, sys, time, threading, urllib.request, urllib.parse, concurrent.futures, http.cookiejar
from datetime import datetime, timezone, date, timedelta
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / "public" / "fundamentals"
OUT.mkdir(parents=True, exist_ok=True)
UA = {"User-Agent": "Mozilla/5.0"}
# SEC requires a descriptive UA with contact.
SEC_UA = {"User-Agent": "Paradiem Dashboard admin carson.rich@paradiem.org"}

# Yahoo crumb opener (for forward estimates)
_OP = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
_OP.addheaders = [("User-Agent", "Mozilla/5.0")]
_CRUMB = None
try:
    _OP.open("https://fc.yahoo.com", timeout=15)
    _CRUMB = _OP.open("https://query1.finance.yahoo.com/v1/test/getcrumb", timeout=15).read().decode()
except Exception:
    _CRUMB = None


def _get(url, headers=UA, tries=4):
    for _ in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=30) as r:
                return json.loads(r.read())
        except Exception:
            time.sleep(0.6)
    return None


# ─────────────────────────── SEC EDGAR ───────────────────────────
_CIK = {}


def load_cik():
    d = _get("https://www.sec.gov/files/company_tickers.json", SEC_UA)
    if d:
        for v in d.values():
            _CIK.setdefault(v["ticker"], str(v["cik_str"]).zfill(10))


def _annual_from_facts(facts, tags, unit):
    """Full-year (10-K) value per fiscal-year-end, as ORIGINALLY reported.

    A fiscal-year-end appears in several 10-Ks (the original plus restated
    comparatives in later filings). Later filings restate comparatives for
    stock splits, so mixing latest-filed values across years breaks a uniform
    split adjustment. Take the earliest-filed value so every year is on its own
    era's share basis; split_factor() then rescales them consistently."""
    out = {}
    for tag in tags:
        node = facts.get(tag)
        if not node:
            continue
        for e in node.get("units", {}).get(unit, []) or []:
            if e.get("form") != "10-K":
                continue
            s, en = e.get("start"), e.get("end")
            if not s or not en:
                continue
            try:
                days = (date.fromisoformat(en) - date.fromisoformat(s)).days
            except Exception:
                continue
            if days < 300 or days > 400:  # full fiscal year only
                continue
            cur = out.get(en)
            if not cur or (e.get("filed", "") < cur[1]):
                out[en] = (e["val"], e.get("filed", ""))
    return {k: v[0] for k, v in out.items()}


def edgar_annual(cik):
    d = _get(f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json", SEC_UA)
    if not d:
        return []
    g = d.get("facts", {}).get("us-gaap", {})
    eps = _annual_from_facts(g, ["EarningsPerShareDiluted", "EarningsPerShareBasicAndDiluted"], "USD/shares")
    ocf = _annual_from_facts(g, ["NetCashProvidedByUsedInOperatingActivities",
                                 "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations"], "USD")
    capex = _annual_from_facts(g, ["PaymentsToAcquirePropertyPlantAndEquipment",
                                   "PaymentsToAcquireProductiveAssets"], "USD")
    sh = _annual_from_facts(g, ["WeightedAverageNumberOfDilutedSharesOutstanding",
                                "WeightedAverageNumberOfShareOutstandingBasicAndDiluted"], "shares")
    ends = sorted(set(eps) | set(ocf))
    ann = []
    for en in ends:
        o, c, s = ocf.get(en), capex.get(en), sh.get(en)
        fcf = (o - c) if (o is not None and c is not None) else None
        ann.append({"date": en, "eps": eps.get(en), "fcf": fcf,
                    "fcfps": (fcf / s) if (fcf is not None and s) else None, "shares": s})
    return ann


# ─────────────────────────── Yahoo ───────────────────────────
def yahoo_ts(sym, types):
    url = (f"https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/{sym}"
           f"?symbol={urllib.parse.quote(sym)}&type={types}&period1=1262304000&period2=1799999999&merge=false")
    d = _get(url)
    out = {}
    for b in ((d or {}).get("timeseries", {}) or {}).get("result", []) or []:
        t = b.get("meta", {}).get("type", ["?"])[0]
        vals = [(v["asOfDate"], v["reportedValue"]["raw"], v.get("currencyCode")) for v in b.get(t, []) or [] if v and v.get("reportedValue")]
        if vals:
            out[t] = vals
    return out


def monthly_prices(sym):
    d = _get(f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}?period1=1199145600&period2=1799999999&interval=1mo&events=split")
    prices, splits = [], []
    try:
        r = d["chart"]["result"][0]
        prices = [(datetime.utcfromtimestamp(t).strftime("%Y-%m"), c) for t, c in zip(r["timestamp"], r["indicators"]["quote"][0]["close"]) if c]
    except Exception:
        return [], []
    for ev in (r.get("events", {}).get("splits", {}) or {}).values():
        try:
            ratio = float(ev["numerator"]) / float(ev["denominator"])
            splits.append((datetime.utcfromtimestamp(ev["date"]).strftime("%Y-%m-%d"), ratio))
        except Exception:
            pass
    return prices, sorted(splits)


def split_factor(splits, iso_date):
    """Cumulative split ratio for events strictly AFTER iso_date. Yahoo prices are
    split-adjusted; EDGAR EPS/shares are as-filed, so divide historical per-share
    figures by this to line them up with the price scale."""
    f = 1.0
    for d, ratio in splits:
        if d > iso_date:
            f *= ratio
    return f


def forward(sym):
    if not _CRUMB:
        return {}
    url = (f"https://query1.finance.yahoo.com/v10/finance/quoteSummary/{urllib.parse.quote(sym)}"
           f"?modules=defaultKeyStatistics&crumb={urllib.parse.quote(_CRUMB)}")
    for _ in range(3):
        try:
            d = json.loads(_OP.open(url, timeout=20).read())
            ks = d["quoteSummary"]["result"][0].get("defaultKeyStatistics", {}) or {}
            return {"eps": (ks.get("forwardEps") or {}).get("raw"), "pe": (ks.get("forwardPE") or {}).get("raw")}
        except Exception:
            time.sleep(0.4)
    return {}


# ─────────────────────────── Finnhub (forward EPS) ───────────────────────────
# Yahoo's forward endpoint needs a crumb+cookie that Yahoo blocks from datacenter
# IPs (this sandbox AND GitHub Actions), so forward estimates come from Finnhub's
# free earnings calendar. Paced under the free 60/min cap, thread-safe.
FINNHUB_KEY = os.environ.get("FINNHUB_KEY", "")
_FH_LOCK = threading.Lock()
_FH_LAST = [0.0]
_FH_MIN_INTERVAL = 1.3


def finnhub(path):
    if not FINNHUB_KEY:
        return None
    with _FH_LOCK:
        wait = _FH_MIN_INTERVAL - (time.time() - _FH_LAST[0])
        if wait > 0:
            time.sleep(wait)
        _FH_LAST[0] = time.time()
    url = f"https://finnhub.io/api/v1/{path}{'&' if '?' in path else '?'}token={FINNHUB_KEY}"
    return _get(url)


def finnhub_forward(sym, trailing4, ttm_eps):
    """Forward-12-month EPS by rolling ONE quarter: drop the oldest trailing
    actual quarter and add the next-quarter consensus estimate.

    Summing 4 forward quarters is tempting but free-tier consensus is noisy and
    sometimes non-GAAP/mislabeled, which compounds into absurd totals (e.g. a
    forward EPS 2x TTM). A single-quarter roll can't blow up that way, and a
    sanity band drops anything that still looks wrong so the chart stays honest."""
    if not FINNHUB_KEY or ttm_eps is None or len(trailing4) < 4:
        return {}
    today = datetime.now(timezone.utc).date()
    d = finnhub(f"calendar/earnings?from={today}&to={today + timedelta(days=200)}&symbol={urllib.parse.quote(sym)}")
    rows = (d or {}).get("earningsCalendar", []) or []
    ests = sorted((r["date"], r["epsEstimate"]) for r in rows
                  if r.get("epsEstimate") is not None and r.get("epsActual") is None and r.get("date", "") >= str(today))
    if not ests:
        return {}
    nq_date, nq = ests[0]
    fwd_eps = round(ttm_eps - trailing4[0] + nq, 4)  # last 3 actual quarters + next estimate
    if not (0.5 * ttm_eps <= fwd_eps <= 1.5 * ttm_eps):  # reject noisy/non-GAAP consensus
        return {}
    return {"eps": fwd_eps, "nextQ": round(nq, 4), "nextQDate": nq_date, "src": "finnhub"}


def close_on_or_before(prices, ym):
    prev = None
    for d, c in prices:
        if d <= ym:
            prev = c
        else:
            break
    return prev


# ─────────────────────────── Build ───────────────────────────
def build(sym):
    cik = _CIK.get(sym)
    if not cik:
        return sym, {"skip": "no-SEC-filing"}
    # currency guard via Yahoo statements
    ann_ts = yahoo_ts(sym, "annualDilutedEPS")
    cur = None
    for s in ann_ts.get("annualDilutedEPS", []):
        if s[2]:
            cur = s[2]; break
    if cur and cur != "USD":
        return sym, {"skip": "non-USD", "currency": cur}

    annual = edgar_annual(cik)
    if not annual or not any(a["eps"] is not None for a in annual):
        return sym, {"skip": "no-edgar-eps"}

    prices, splits = monthly_prices(sym)
    if not prices:
        return sym, {"skip": "no-price"}
    for a in annual:
        # split-adjust as-filed EDGAR figures onto Yahoo's split-adjusted price scale
        sf = split_factor(splits, a["date"])
        if sf != 1.0:
            if a["eps"] is not None:
                a["eps"] = round(a["eps"] / sf, 4)
            if a["shares"] is not None:
                a["shares"] = a["shares"] * sf
            a["fcfps"] = (a["fcf"] / a["shares"]) if (a["fcf"] is not None and a["shares"]) else None
        px = close_on_or_before(prices, a["date"][:7])
        a["px"] = px
        a["pe"] = (px / a["eps"]) if (px and a["eps"] and a["eps"] > 0) else None
        a["pfcf"] = (px / a["fcfps"]) if (px and a["fcfps"] and a["fcfps"] > 0) else None

    # TTM from Yahoo quarterly
    q = yahoo_ts(sym, "quarterlyDilutedEPS,quarterlyFreeCashFlow")
    qe = sorted(q.get("quarterlyDilutedEPS", []))
    qf = sorted(q.get("quarterlyFreeCashFlow", []))
    trailing4 = [v for _, v, _ in qe[-4:]]
    ttm_eps = sum(trailing4) if len(trailing4) >= 4 else None
    ttm_fcf = sum(v for _, v, _ in qf[-4:]) if len(qf) >= 4 else None
    latest_sh = next((a["shares"] for a in reversed(annual) if a["shares"]), None)
    ttm_fcfps = (ttm_fcf / latest_sh) if (ttm_fcf and latest_sh) else None

    # forward EPS: Finnhub calendar (reliable from datacenters), Yahoo as fallback
    fwd = finnhub_forward(sym, trailing4, ttm_eps) or forward(sym)

    return sym, {
        "ticker": sym, "currency": "USD", "source": "SEC EDGAR + Yahoo",
        "asof": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "ttm": {"eps": ttm_eps, "fcf": ttm_fcf, "fcfps": ttm_fcfps, "shares": latest_sh},
        "fwd": fwd,
        "annual": annual,
        "quarterly": [{"date": d, "eps": v} for d, v, _ in qe[-8:]],
        "price": [{"m": m, "c": round(c, 2)} for m, c in prices[-200:]],
    }


def universe():
    syms = set()
    for sl in ("dividend", "growth", "fci100", "fciValues"):
        p = REPO / "public" / f"portfolio-history-{sl}.json"
        if p.exists():
            syms |= set((json.load(open(p)).get("holdings") or {}).keys())
    return sorted(syms)


def main():
    load_cik()
    only = [a for a in sys.argv[1:] if not a.startswith("-")]
    syms = only or universe()
    print(f"Building fundamentals (EDGAR+Yahoo) for {len(syms)} tickers")
    built, skipped, failed = [], [], []
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:
        for sym, data in ex.map(build, syms):
            if data is None:
                failed.append(sym)
            elif data.get("skip"):
                skipped.append((sym, data["skip"]))
            else:
                (OUT / f"{sym}.json").write_text(json.dumps(data, separators=(",", ":")))
                built.append((sym, len(data["annual"])))
    (OUT / "index.json").write_text(json.dumps({
        "generated": datetime.now(timezone.utc).isoformat(), "source": "SEC EDGAR + Yahoo",
        "available": sorted(s for s, _ in built),
        "excluded": {s: r for s, r in skipped},
    }, indent=1))
    yrs = [n for _, n in built]
    print(f"  built {len(built)} (median {sorted(yrs)[len(yrs)//2] if yrs else 0} annual yrs) | skipped {len(skipped)}")
    from collections import Counter
    print("  skip reasons:", dict(Counter(r for _, r in skipped)))
    if skipped:
        print("  skipped:", ", ".join(f"{s}({r})" for s, r in skipped[:40]))


if __name__ == "__main__":
    main()
