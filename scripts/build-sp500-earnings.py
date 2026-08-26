#!/usr/bin/env python3
"""
Aggregate S&P 500 trailing earnings, so the playbook's EPS Trend factor has a
series with a current tail.

Why this exists: nobody publishes an index-level EPS series we can reach. FMP
has none, and multpl's earnings table lags its price and P/E tables by a
quarter or more, so the last few months of it are carry-forward flat. A 90-day
change taken off that reads 0.0% and scores the factor as stalled earnings —
an artifact of the backfill rather than anything the market did.

The factor only needs a *percentage change*, not the index EPS level, and that
falls out of aggregate constituent earnings with no index divisor involved:
sum trailing-twelve-month net income across the members, and track how the sum
moves.

Two things make the number honest:

  * As-of, not latest. A company's TTM at a past quarter-end uses only the
    quarters it had *filed* by then, so the series is not built with hindsight
    the model would never have had.
  * Same-store. Only companies with a complete TTM at every point in the window
    are counted, so index reconstitution and IPOs cannot masquerade as earnings
    growth.

Writes public/sp500-earnings.json.
"""
import importlib.util, json, sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / "public" / "sp500-earnings.json"

# Reuse the sibling builder's HTTP layer: retries with backoff, the Worker-proxy
# support, and — the important one — treating FMP's 200-with-an-error-body as a
# failure rather than as "no data".
_spec = importlib.util.spec_from_file_location("fmpbuild", Path(__file__).parent / "build-fundamentals-fmp.py")
_fmp = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_fmp)
api, ApiError, num = _fmp.api, _fmp.ApiError, _fmp.num

QUARTERS_BACK = 12          # 3 years of statements per company
POINTS = 9                  # as-of points, one per quarter-length step


def asof_points(n):
    """n as-of dates, 91 days apart, ending today.

    Not calendar quarter-ends. Companies file weeks after a quarter closes, so a
    quarter-end as-of catches most of the index *before* that quarter is in, while
    a date two months later catches it after. Mixing the two makes the last step
    span more filing progress than the earlier ones and reads as an earnings
    acceleration that did not happen — the first build showed +2 to +5% steps
    across history and +10 to +12% for the two nearest today.

    91 days apart puts every point at the same phase of the filing cycle, and makes
    the newest interval literally the 90-day change the factor claims to show."""
    today = datetime.now(timezone.utc).date()
    return [(today - timedelta(days=91 * k)).isoformat() for k in range(n - 1, -1, -1)]


def ttm_as_of(rows, as_of):
    """Trailing-twelve-month net income using only what was filed by `as_of`.

    filingDate is the guard against hindsight: a quarter ending 2026-06-30 is
    typically filed weeks later, and counting it at the quarter end would credit
    the model with earnings nobody had yet."""
    seen = [r for r in rows
            if (r.get("filingDate") or r.get("date", "")) <= as_of
            and num(r.get("netIncome")) is not None]
    seen.sort(key=lambda r: r.get("date", ""), reverse=True)
    if len(seen) < 4:
        return None
    return sum(num(r["netIncome"]) for r in seen[:4])


def main():
    if not _fmp.FMP_KEY and not _fmp.FMP_PROXY:
        sys.exit("set FMP_KEY or FMP_PROXY")

    # FMP has renamed this one before; try the known spellings rather than burn a
    # weekly cycle on a 404.
    members = []
    for path in ("sp500-constituent", "sp500_constituent", "sp500-constituents"):
        try:
            members = api(path)
        except ApiError:
            members = []
        if members:
            print(f"  constituents via /{path}")
            break
    syms = sorted({m["symbol"] for m in members if m.get("symbol")})
    if len(syms) < 400:
        sys.exit(f"ERROR: only {len(syms)} constituents returned — refusing to build on a partial index")
    print(f"S&P 500: {len(syms)} constituents")

    asof = asof_points(POINTS)
    stmts, failed = {}, []
    for i, sym in enumerate(syms):
        if i % 50 == 0:
            print(f"  {i}/{len(syms)}…")
        try:
            stmts[sym] = api("income-statement", symbol=sym, period="quarter", limit=QUARTERS_BACK)
        except ApiError as e:
            failed.append(sym)
    if len(failed) > len(syms) // 10:
        sys.exit(f"ERROR: {len(failed)}/{len(syms)} statement fetches failed — not a usable aggregate")
    print(f"  statements: {len(stmts)} ok, {len(failed)} failed")

    # Same-store cohort: a complete TTM at every point, so the change reflects
    # earnings rather than which companies happen to be in the index.
    per_sym = {}
    for sym, rows in stmts.items():
        vals = [ttm_as_of(rows, d) for d in asof]
        if all(v is not None for v in vals):
            per_sym[sym] = vals
    if len(per_sym) < 300:
        sys.exit(f"ERROR: only {len(per_sym)} companies span the full window — cohort too thin")

    def median(xs):
        xs = sorted(xs)
        n = len(xs)
        return None if not n else (xs[n // 2] if n % 2 else (xs[n // 2 - 1] + xs[n // 2]) / 2)

    # Two readings per point, and the factor uses the median rather than the sum.
    #
    # The aggregate is dominated by a handful of mega-caps and by one-off items
    # inside individual filings — Marvell booked a ~$1.9B non-operating gain through
    # interestIncome in one quarter, and netIncome carries it. The first builds showed
    # the aggregate stepping +1.5 to +5% across history and then +9.5% and +14.5% at
    # the tail; a 14.5% move in a *trailing-twelve-month* total implies the incoming
    # quarter beat the one it replaced by nearly 60%, which is not something a whole
    # index does. It is a few names.
    #
    # The median company's TTM growth is equal-weighted, so no single filing can move
    # it, and breadth is the better read on an earnings recession anyway: the question
    # is whether earnings are deteriorating broadly, not whether the top ten are.
    def growth_at(i):
        if i == 0:
            return None
        g = [v[i] / v[i - 1] - 1 for v in per_sym.values() if v[i - 1] > 0 and v[i] > 0]
        m = median(g)
        return None if m is None else round(m * 100, 2)

    series = [{"asof": d,
               "ttmNetIncome": round(sum(v[i] for v in per_sym.values())),
               "medianGrowthPct": growth_at(i)}
              for i, d in enumerate(asof)]
    chg = series[-1]["medianGrowthPct"]
    agg = None
    if len(series) >= 2 and series[-2]["ttmNetIncome"]:
        agg = round((series[-1]["ttmNetIncome"] / series[-2]["ttmNetIncome"] - 1) * 100, 2)

    OUT.write_text(json.dumps({
        "generated": datetime.now(timezone.utc).isoformat(),
        "source": "FMP — median constituent TTM net income growth (aggregate published alongside)",
        "cohort": len(per_sym), "constituents": len(syms),
        "chgQoQ": chg, "aggChgQoQ": agg, "series": series,
    }, indent=1))
    print(f"  cohort {len(per_sym)}/{len(syms)} | median QoQ {chg}% | aggregate QoQ {agg}%")
    for p in series:
        g = p["medianGrowthPct"]
        print(f"    {p['asof']}  agg ${p['ttmNetIncome']/1e9:>6,.0f}B   median {'' if g is None else f'{g:+.1f}%'}")


if __name__ == "__main__":
    main()
