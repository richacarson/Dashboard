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
import json, os, sys, time, threading, urllib.request, urllib.parse, concurrent.futures
from datetime import datetime, timezone, date, timedelta
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / "public" / "fundamentals"
OUT.mkdir(parents=True, exist_ok=True)
UA = {"User-Agent": "Mozilla/5.0"}
# SEC requires a descriptive UA with contact.
SEC_UA = {"User-Agent": "Paradiem Dashboard admin carson.rich@paradiem.org"}

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
    return out  # {end: (val, filed)}


_EPS_TAGS = ["EarningsPerShareDiluted", "EarningsPerShareBasicAndDiluted"]
_OCF_TAGS = ["NetCashProvidedByUsedInOperatingActivities",
             "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations"]
_CAPEX_TAGS = ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets"]
_SHARE_TAGS = ["WeightedAverageNumberOfDilutedSharesOutstanding",
               "WeightedAverageNumberOfShareOutstandingBasicAndDiluted"]
_REV_TAGS = ["RevenueFromContractWithCustomerExcludingAssessedTax",
             "RevenueFromContractWithCustomerIncludingAssessedTax",
             "Revenues", "SalesRevenueNet"]


def edgar_facts(cik):
    """Fetch a filer's XBRL us-gaap facts once; annual + TTM derive from it."""
    d = _get(f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json", SEC_UA)
    return (d or {}).get("facts", {}).get("us-gaap", {}) if d else None


def edgar_annual(g):
    eps = _annual_from_facts(g, _EPS_TAGS, "USD/shares")      # {end: (val, filed)}
    ocf = _annual_from_facts(g, _OCF_TAGS, "USD")
    capex = _annual_from_facts(g, _CAPEX_TAGS, "USD")
    sh = _annual_from_facts(g, _SHARE_TAGS, "shares")
    ends = sorted(set(eps) | set(ocf))
    ann = []
    for en in ends:
        ev, ovv, cv, sv = eps.get(en), ocf.get(en), capex.get(en), sh.get(en)
        o = ovv[0] if ovv else None
        c = cv[0] if cv else None
        s = sv[0] if sv else None
        fcf = (o - c) if (o is not None and c is not None) else None
        # filing date that sets this row's split basis (all fields share the 10-K)
        filed = (ev or ovv or sv or (None, ""))[1]
        ann.append({"date": en, "eps": ev[0] if ev else None, "fcf": fcf,
                    "fcfps": (fcf / s) if (fcf is not None and s) else None,
                    "shares": s, "_filed": filed})
    return ann


def _disc_quarters(g, tags, unit):
    """Discrete 3-month value per quarter-end, derived from XBRL.

    A fiscal-year-end appears as cumulative periods sharing a start (Q1=3mo,
    H1=6mo, 9mo, FY=12mo); differencing consecutive ends within each start
    yields discrete quarters — including fiscal Q4 (FY − 9mo), which is never
    filed on its own. Works for both EPS (already-discrete 3mo entries collapse
    to the same values) and cumulative cash-flow items."""
    per = {}
    for tag in tags:
        for e in g.get(tag, {}).get("units", {}).get(unit, []) or []:
            s, en = e.get("start"), e.get("end")
            if not s or not en:
                continue
            try:
                days = (date.fromisoformat(en) - date.fromisoformat(s)).days
            except Exception:
                continue
            if days > 400:
                continue
            k = (s, en); fl = e.get("filed", "")
            # earliest-filed = as originally reported, so pre-split periods stay on
            # their own share basis (later filings restate comparatives for splits);
            # split_factor() then rescales uniformly, same as the annual series.
            if k not in per or fl < per[k][1]:
                per[k] = (e["val"], fl)
    groups = {}
    for (s, en), (val, fl) in per.items():
        groups.setdefault(s, []).append((en, val, fl))
    disc = {}
    for s, items in groups.items():
        items.sort()
        for i, (en, val, fl) in enumerate(items):
            dv = val - (items[i - 1][1] if i > 0 else 0.0)
            prev_end = items[i - 1][0] if i > 0 else s
            try:
                dur = (date.fromisoformat(en) - date.fromisoformat(prev_end)).days
            except Exception:
                dur = 90
            # only emit clean ~1-quarter periods — drops the leading stub (a 6/9mo
            # cumulative with no prior quarter to difference) and any non-adjacent gap
            if 60 <= dur <= 100:
                disc[en] = (dv, fl)
    return disc  # {end_iso: (discrete_quarter_value, filed)}


def _rolling_ttm(dq):
    """{quarter_end: sum of the trailing 4 discrete quarters ending there}."""
    ends = sorted(dq)
    out = {}
    for i in range(3, len(ends)):
        out[ends[i]] = sum(dq[e] for e in ends[i - 3:i + 1])
    return out


def edgar_ttm(g):
    """Latest trailing-twelve-month EPS + FCF and the trailing 4 discrete EPS quarters."""
    epsq = _disc_quarters(g, _EPS_TAGS, "USD/shares")
    ocfq = _disc_quarters(g, _OCF_TAGS, "USD")
    capq = _disc_quarters(g, _CAPEX_TAGS, "USD")
    eps_ends = sorted(epsq)
    ttm_eps = sum(epsq[e][0] for e in eps_ends[-4:]) if len(eps_ends) >= 4 else None
    trailing4 = [epsq[e][0] for e in eps_ends[-4:]] if len(eps_ends) >= 4 else []
    ocf_ends, cap_ends = sorted(ocfq), sorted(capq)
    ttm_ocf = sum(ocfq[e][0] for e in ocf_ends[-4:]) if len(ocf_ends) >= 4 else None
    ttm_cap = sum(capq[e][0] for e in cap_ends[-4:]) if len(cap_ends) >= 4 else None
    ttm_fcf = (ttm_ocf - ttm_cap) if (ttm_ocf is not None and ttm_cap is not None) else None
    return {"eps": ttm_eps, "fcf": ttm_fcf, "trailing4": trailing4}


def edgar_quarterly(g, splits, prices, annual):
    """Per-quarter series for the charts: discrete (split-adjusted) EPS and
    discrete FCF for the bars/points, plus rolling-TTM P/E and P/FCF for the
    valuation lines and the vs-own-range band. FCF is absolute dollars (no split
    adjustment); EPS is divided by the cumulative later-split factor to sit on
    the split-adjusted price scale, same as the annual series."""
    epsq = _disc_quarters(g, _EPS_TAGS, "USD/shares")   # {end: (val, filed)}
    ocfq = _disc_quarters(g, _OCF_TAGS, "USD")
    capq = _disc_quarters(g, _CAPEX_TAGS, "USD")
    revq = _disc_quarters(g, _REV_TAGS, "USD")          # absolute $ — no split adjust
    fcfq = {e: ocfq[e][0] - capq[e][0] for e in (set(ocfq) & set(capq))}
    # split-adjust by FILING date: a quarter filed after a split is already
    # reported on the post-split basis, so it needs no further adjustment.
    eps_adj = {e: v[0] / split_factor(splits, v[1]) for e, v in epsq.items()}
    ttm_eps = _rolling_ttm(eps_adj)
    ttm_fcf = _rolling_ttm(fcfq)
    ann_sh = [(a["date"], a["shares"]) for a in annual if a.get("shares")]  # split-adjusted

    def shares_at(en):
        s = ann_sh[0][1] if ann_sh else None
        for d, sh in ann_sh:
            if d <= en:
                s = sh
            else:
                break
        return s

    out = []
    for en in sorted(epsq):
        px = close_on_or_before(prices, en[:7])
        te, tf, sh = ttm_eps.get(en), ttm_fcf.get(en), shares_at(en)
        rv = revq.get(en)
        out.append({
            "date": en,
            "eps": round(eps_adj[en], 4),
            "fcf": fcfq.get(en),
            "rev": (rv[0] if rv else None),
            "px": px,
            "pe": (px / te) if (px and te and te > 0) else None,
            "pfcf": (px / (tf / sh)) if (px and tf and sh and tf > 0) else None,
        })
    return out


# ─────────────────────────── Yahoo (prices only) ───────────────────────────
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
    # EDGAR us-gaap facts gate the universe to US USD filers: foreign 20-F/40-F
    # reporters (ADRs) simply have no us-gaap 10-K diluted EPS, so they drop out
    # here — no separate Yahoo currency call needed.
    g = edgar_facts(cik)
    if g is None:
        return sym, {"skip": "no-SEC-filing"}
    annual = edgar_annual(g)
    if not annual or not any(a["eps"] is not None for a in annual):
        return sym, {"skip": "no-edgar-eps"}

    prices, splits = monthly_prices(sym)
    if not prices:
        return sym, {"skip": "no-price"}
    for a in annual:
        # split-adjust by FILING date onto the split-adjusted price scale
        sf = split_factor(splits, a.pop("_filed", a["date"]))
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

    # TTM from EDGAR quarterly (Q4 = FY − 9mo; cash flows differenced from YTD)
    ttm = edgar_ttm(g)
    latest_sh = next((a["shares"] for a in reversed(annual) if a["shares"]), None)
    ttm_fcfps = (ttm["fcf"] / latest_sh) if (ttm["fcf"] and latest_sh) else None
    fwd = finnhub_forward(sym, ttm["trailing4"], ttm["eps"])
    quarterly = edgar_quarterly(g, splits, prices, annual)

    return sym, {
        "ticker": sym, "currency": "USD", "source": "SEC EDGAR + Yahoo prices",
        "asof": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "ttm": {"eps": ttm["eps"], "fcf": ttm["fcf"], "fcfps": ttm_fcfps, "shares": latest_sh},
        "fwd": fwd,
        "annual": annual,
        "quarterly": quarterly,
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
        "generated": datetime.now(timezone.utc).isoformat(), "source": "SEC EDGAR + Yahoo prices",
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
