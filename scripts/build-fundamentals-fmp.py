#!/usr/bin/env python3
"""
Build public/fundamentals/<TICKER>.json from FMP instead of SEC EDGAR + Yahoo.

Why this exists: the EDGAR pipeline guesses XBRL tags, differences YTD cash-flow
figures into discrete quarters, and hand-adjusts EPS for splits by filing date.
That machinery drops every foreign filer and ADR (27 of 154 holdings report
"no-edgar-eps"), and lags a full quarter behind because it waits on the filing
to be indexed. FMP returns the same figures already normalised.

Two properties verified before writing this, both essential:
  * Statement EPS is split-adjusted (AAPL FY2019 reports 2.97, not the
    as-filed 11.89), and the price series is adjusted on the SAME basis
    (Sep-2019 = $55.99, not $220). So P/E is consistent without any
    split_factor() correction — the trickiest part of the EDGAR script.
  * Quarterly statements arrive sooner: LRCX had 2026-06-28 here while EDGAR
    still ended at 2026-03-29.

Output schema is byte-for-byte compatible with the EDGAR builder so the
frontend needs no changes. Run alongside it and diff before switching over.

The FMP key is read from the FMP_KEY env var. This script runs server-side in
CI, so the key is never shipped to a browser — unlike a VITE_* variable, which
Vite inlines into the public bundle.
"""
import concurrent.futures, json, os, sys, time, urllib.parse, urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / "public" / "fundamentals"
OUT.mkdir(parents=True, exist_ok=True)

FMP_KEY = os.environ.get("FMP_KEY", "")
# Optional: route through the Cloudflare Worker instead of holding a key here.
# The Worker attaches the key server-side, so CI needs no FMP secret at all.
FMP_PROXY = os.environ.get("FMP_PROXY", "").rstrip("/")
BASE = "https://financialmodelingprep.com/stable"
PRICE_FROM = "2009-01-01"      # ~17y, matching the EDGAR builder's price depth
QTRS = 80                      # 20 years of quarters (EDGAR builder reached ~73)
YEARS = 20


class ApiError(Exception):
    """A call that failed for a reason unrelated to the symbol having no data."""


def api(path, **params):
    """GET /stable/<path>.

    Returns [] ONLY when FMP genuinely has no rows. Anything else — HTTP error,
    timeout, or an {"Error Message": ...} envelope (FMP answers 200 with one of
    those when throttled) — raises ApiError after exhausting retries.

    The distinction matters. An earlier version returned [] for the error
    envelope too, so a rate-limit response was indistinguishable from "this
    company files no income statement". A single throttled stretch silently
    recorded no-fmp-income for ~20 consecutive symbols, NVDA and QCOM among
    them, and the run still reported success."""
    if FMP_PROXY:
        url = f"{FMP_PROXY}/fmp/stable/{path}?{urllib.parse.urlencode(params)}"
    elif FMP_KEY:
        params["apikey"] = FMP_KEY
        url = f"{BASE}/{path}?{urllib.parse.urlencode(params)}"
    else:
        return []
    # A default Python UA gets a 403 from Cloudflare in front of the Worker.
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; DashboardBuilder/1.0)"})
    last = "unknown"
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                d = json.loads(r.read().decode())
            if isinstance(d, list):
                return d
            # Non-list body = FMP's error envelope. Treat every one as retryable:
            # misreading a throttle as "no data" is the failure mode above, and a
            # genuinely restricted endpoint just costs a few wasted retries.
            last = (d or {}).get("Error Message") or (d or {}).get("message") or str(d)[:120]
        except Exception as e:
            last = f"{type(e).__name__}: {e}"
        if attempt < 4:
            time.sleep(min(30, 2 ** attempt * 2))   # 2s, 4s, 8s, 16s — outlasts a per-minute window
    raise ApiError(f"{path} {params}: {last}")


# ─────────────────────────── currency ───────────────────────────
# Foreign issuers file in their home currency while the ticker we price is the
# US listing, quoted in USD. Nothing reconciled the two, so every valuation for
# those names was nonsense: TSM came out at a P/E of 1.1 (USD 418 price over
# TWD 435 of earnings) against a true ~30.
MONEY_FIELDS = ("epsDiluted", "revenue", "grossProfit", "operatingIncome", "netIncome", "freeCashFlow")
_FX = {}


def fx_series(cur):
    """Monthly {'YYYY-MM': rate} multiplying `cur` into USD. None for USD itself."""
    if not cur or cur == "USD":
        return None
    if cur in _FX:
        return _FX[cur]
    by, invert = {}, False
    try:
        rows = api("historical-price-eod/light", symbol=f"{cur}USD", **{"from": PRICE_FROM})
    except ApiError:
        rows = []
    if not rows:                                  # some pairs are only quoted the other way round
        try:
            rows, invert = api("historical-price-eod/light", symbol=f"USD{cur}", **{"from": PRICE_FROM}), True
        except ApiError:
            rows = []
    for r in sorted(rows, key=lambda x: x.get("date", "")):
        d, p = r.get("date"), r.get("price")
        if d and isinstance(p, (int, float)) and p > 0:
            by[d[:7]] = (1.0 / p) if invert else float(p)
    _FX[cur] = by
    return by


def fx_at(fx, ym):
    """Rate for that month, else the last prior month (FX gaps on holidays)."""
    prior = [m for m in fx if m <= ym]
    return fx[max(prior)] if prior else None


def to_usd(rows, fx):
    """Restate a statement's money fields in USD at each period's own FX rate.

    Per-period rather than one spot rate: a 20-year EPS history converted at
    today's rate would misstate every prior year's earnings."""
    if not fx:
        return rows
    out = []
    for r in rows:
        d = r.get("date")
        rate = fx_at(fx, d[:7]) if d else None
        if not rate:
            continue        # drop the period rather than mix two currencies in one series
        r = dict(r)
        for k in MONEY_FIELDS:
            v = num(r.get(k))
            if v is not None:
                r[k] = v * rate
        out.append(r)
    return out


def monthly_prices(sym):
    """Daily closes collapsed to one close per calendar month, oldest first."""
    rows = api("historical-price-eod/light", symbol=sym, **{"from": PRICE_FROM})
    by_month = {}
    for r in sorted(rows, key=lambda x: x.get("date", "")):
        d, p = r.get("date"), r.get("price")
        if d and isinstance(p, (int, float)) and p > 0:
            by_month[d[:7]] = round(float(p), 2)
    return [{"m": m, "c": c} for m, c in sorted(by_month.items())]


def price_at(prices, ym):
    """Close for the month a period ended in, else the last prior month."""
    prior = [p for p in prices if p["m"] <= ym]
    return prior[-1]["c"] if prior else None


def num(v):
    return v if isinstance(v, (int, float)) else None


def split_factors(sym):
    """Spinoff-style events only, as (date, factor) pairs.

    FMP already restates statement EPS for genuine stock splits — AAPL FY2019
    reports 2.97, not the as-filed 11.89 — so adjusting for those would
    double-count (it dropped LRCX agreement from 55/55 to 11/55 when tried).

    Spinoffs are different: they are recorded in this same endpoint but are NOT
    applied to statement EPS, while the price series IS adjusted for them. That
    mismatch put ABT's 2010 P/E at 6.6x against a true ~13.8x, and FMP's own
    /stable/ratios repeats the error, so it can't be used as a shortcut.

    The two are distinguishable by shape. Real splits carry small whole-number
    ratios (2:1, 3:2, 7:1, 10:1). Spinoffs carry the odd ratios that fall out of
    a distribution — ABT's AbbVie separation is 5000:2399 and its earlier
    Hospira one is 2500:2339. Only the latter kind is returned here.
    """
    events = []
    for r in api("splits", symbol=sym, limit=100):
        d, n, den = r.get("date"), num(r.get("numerator")), num(r.get("denominator"))
        if not (d and n and den and den > 0 and n > 0):
            continue
        if den <= 20 and n <= 100:      # a plain split — FMP has already applied it
            continue
        events.append((d, n / den))
    events.sort(key=lambda x: x[0])
    return events


def adj_for(events, period_date):
    """Product of every split that happened AFTER this period ended."""
    f = 1.0
    for d, ratio in events:
        if d > period_date:
            f *= ratio
    return f


def build(sym):
    try:
        inc_q = api("income-statement", symbol=sym, period="quarter", limit=QTRS)
        if not inc_q:
            return sym, {"skip": "no-fmp-income"}
        # Statements come back in the filer's reporting currency; the price series is
        # the US listing in USD. Restate everything into USD before it is used.
        reported = inc_q[0].get("reportedCurrency") or "USD"
        fx = fx_series(reported)
        if reported != "USD" and not fx:
            return sym, {"skip": f"no-fx-{reported}"}
        inc_q = to_usd(inc_q, fx)
        if not inc_q:
            return sym, {"skip": f"no-fx-{reported}"}
        cf_q = {r["date"]: r for r in to_usd(api("cash-flow-statement", symbol=sym, period="quarter", limit=QTRS), fx) if r.get("date")}
        inc_a = to_usd(api("income-statement", symbol=sym, period="annual", limit=YEARS), fx)
        cf_a = {r["date"]: r for r in to_usd(api("cash-flow-statement", symbol=sym, period="annual", limit=YEARS), fx) if r.get("date")}
        splits = split_factors(sym)
        prices = monthly_prices(sym)
        if len(prices) < 2:
            return sym, {"skip": "no-prices"}

        # ---- quarterly, oldest first so trailing sums read backwards cleanly ----
        qs = sorted([r for r in inc_q if r.get("date")], key=lambda r: r["date"])
        quarterly = []
        for i, r in enumerate(qs):
            d = r["date"]
            cf = cf_q.get(d, {})
            f = adj_for(splits, d)                 # 1.0 when no later split
            eps, rev = num(r.get("epsDiluted")), num(r.get("revenue"))
            if eps is not None: eps /= f            # per-share shrinks, share count grows
            sh, fcf = num(r.get("weightedAverageShsOutDil")), num(cf.get("freeCashFlow"))
            if sh is not None: sh *= f
            px = price_at(prices, d[:7])
            win = qs[max(0, i - 3): i + 1]          # this quarter + prior three
            full = len(win) == 4
            def tsum(key, src=None):
                vals = []
                for w in win:
                    v = num((cf_q.get(w["date"], {}) if src == "cf" else w).get(key))
                    if v is None:
                        return None
                    if key == "epsDiluted":
                        v /= adj_for(splits, w["date"])
                    vals.append(v)
                return sum(vals)
            t_eps = tsum("epsDiluted") if full else None
            t_rev = tsum("revenue") if full else None
            t_fcf = tsum("freeCashFlow", "cf") if full else None
            t_gp, t_oi, t_ni = (tsum("grossProfit") if full else None,
                                tsum("operatingIncome") if full else None,
                                tsum("netIncome") if full else None)
            rec = {
                "date": d,
                "eps": round(eps, 4) if eps is not None else None,
                "fcf": fcf, "rev": rev, "sh": sh, "px": px,
                "pe": (px / t_eps) if (px and t_eps and t_eps > 0) else None,
                "pfcf": (px / (t_fcf / sh)) if (px and t_fcf and sh and t_fcf > 0) else None,
                "ps": (px / (t_rev / sh)) if (px and t_rev and sh and t_rev > 0) else None,
                "gm": round(t_gp / t_rev, 4) if (t_gp is not None and t_rev) else None,
                "om": round(t_oi / t_rev, 4) if (t_oi is not None and t_rev) else None,
                "nm": round(t_ni / t_rev, 4) if (t_ni is not None and t_rev) else None,
            }
            quarterly.append(rec)

        # ---- annual ----
        annual = []
        for r in sorted([r for r in inc_a if r.get("date")], key=lambda r: r["date"]):
            d = r["date"]
            f = adj_for(splits, d)
            eps, sh = num(r.get("epsDiluted")), num(r.get("weightedAverageShsOutDil"))
            if eps is not None: eps /= f
            if sh is not None: sh *= f
            fcf = num(cf_a.get(d, {}).get("freeCashFlow"))
            fcfps = (fcf / sh) if (fcf is not None and sh) else None
            px = price_at(prices, d[:7])
            annual.append({
                "date": d, "eps": eps, "fcf": fcf, "fcfps": fcfps, "shares": sh, "px": px,
                "pe": (px / eps) if (px and eps and eps > 0) else None,
                "pfcf": (px / fcfps) if (px and fcfps and fcfps > 0) else None,
            })

        # ---- TTM (sum of the last four reported quarters) ----
        last4 = qs[-4:]
        def s4(key, src=None):
            vals = []
            for w in last4:
                v = num((cf_q.get(w["date"], {}) if src == "cf" else w).get(key))
                if v is None:
                    return None
                if key == "epsDiluted":
                    v /= adj_for(splits, w["date"])
                vals.append(v)
            return sum(vals) if len(vals) == 4 else None
        ttm_eps, ttm_rev, ttm_fcf = s4("epsDiluted"), s4("revenue"), s4("freeCashFlow", "cf")
        shares = (num(last4[-1].get("weightedAverageShsOutDil")) or 0) * adj_for(splits, last4[-1]["date"]) if last4 else None
        ttm = {
            "eps": ttm_eps, "fcf": ttm_fcf,
            "fcfps": (ttm_fcf / shares) if (ttm_fcf is not None and shares) else None,
            "rev": ttm_rev,
            "revps": (ttm_rev / shares) if (ttm_rev is not None and shares) else None,
            "shares": shares,
        }

        # ---- forward estimates (replaces the Finnhub earnings-calendar lookup) ----
        fwd = {}
        est = api("analyst-estimates", symbol=sym, period="quarter", limit=40)
        today = datetime.now(timezone.utc).date().isoformat()
        future = sorted([e for e in est if e.get("date", "") > today], key=lambda e: e["date"])
        if future:
            nxt = future[0]
            nq = num(nxt.get("epsAvg"))
            fwd = {"nextQ": nq, "nextQDate": nxt.get("date"), "src": "fmp"}
            nxt4 = [num(e.get("epsAvg")) for e in future[:4]]
            if len(nxt4) == 4 and all(v is not None for v in nxt4):
                fwd["eps"] = sum(nxt4)

        return sym, {
            "ticker": sym,
            "currency": "USD",              # everything above is restated into USD
            "reportedCurrency": reported,   # what the filer actually files in
            "source": "FMP",
            "asof": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "ttm": ttm, "fwd": fwd,
            "annual": annual, "quarterly": quarterly, "price": prices,
        }
    except ApiError as e:
        print(f"  {sym}: API {e}")
        return sym, None
    except Exception as e:
        print(f"  {sym}: {type(e).__name__} {e}")
        return sym, None


def universe():
    syms = set()
    for sl in ("dividend", "growth", "fci100", "fciValues"):
        p = REPO / "public" / f"portfolio-history-{sl}.json"
        if p.exists():
            syms |= set((json.load(open(p)).get("holdings") or {}).keys())
    return sorted(syms)


def main():
    if not FMP_KEY and not FMP_PROXY:
        sys.exit("set FMP_KEY (CI secret, NOT a VITE_ var) or FMP_PROXY (Worker URL)")
    only = [a for a in sys.argv[1:] if not a.startswith("-")]
    dry = "--dry" in sys.argv
    syms = only or universe()
    print(f"Building fundamentals (FMP) for {len(syms)} tickers{' [dry run]' if dry else ''}")
    built, skipped, failed = [], [], []
    # 3 workers, not 6. Each symbol costs 6+ calls and the previous setting walked
    # straight into FMP's rate limit partway through the run.
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as ex:
        for sym, data in ex.map(build, syms):
            if data is None:
                failed.append(sym)
            elif data.get("skip"):
                skipped.append((sym, data["skip"]))
            else:
                if not dry:
                    (OUT / f"{sym}.json").write_text(json.dumps(data, separators=(",", ":")))
                built.append((sym, len(data["annual"])))
    if not dry:
        (OUT / "index.json").write_text(json.dumps({
            "generated": datetime.now(timezone.utc).isoformat(), "source": "FMP",
            "available": sorted(s for s, _ in built),
            "excluded": {s: r for s, r in skipped},
        }, indent=1))
    yrs = sorted(n for _, n in built)
    print(f"  built {len(built)} (median {yrs[len(yrs)//2] if yrs else 0} annual yrs) | skipped {len(skipped)} | failed {len(failed)}")
    if skipped:
        print("  skip reasons:", dict(Counter(r for _, r in skipped)))
        print("  skipped:", ", ".join(f"{s}({r})" for s, r in skipped[:40]))
    if failed:
        print("  failed:", ", ".join(failed[:40]))
    # A failed symbol keeps whatever file the last good run wrote, so the dashboard
    # degrades to stale rather than blank. That also means a broken run looks fine
    # from the outside — hence failing the job loudly instead.
    if not dry and failed and len(failed) > max(3, len(syms) // 20):
        sys.exit(f"ERROR: {len(failed)}/{len(syms)} symbols failed — refusing to call this a good run")


if __name__ == "__main__":
    main()
