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

    series = [{"asof": d, "ttmNetIncome": round(sum(v[i] for v in per_sym.values()))}
              for i, d in enumerate(asof)]
    chg = None
    if len(series) >= 2 and series[-2]["ttmNetIncome"]:
        chg = round((series[-1]["ttmNetIncome"] / series[-2]["ttmNetIncome"] - 1) * 100, 2)

    OUT.write_text(json.dumps({
        "generated": datetime.now(timezone.utc).isoformat(),
        "source": "FMP — aggregate TTM net income across S&P 500 constituents",
        "cohort": len(per_sym), "constituents": len(syms),
        "chgQoQ": chg, "series": series,
    }, indent=1))
    print(f"  cohort {len(per_sym)}/{len(syms)} | latest TTM ${series[-1]['ttmNetIncome']/1e9:.0f}B | QoQ {chg}%")
    for p in series[-4:]:
        print(f"    {p['asof']}  ${p['ttmNetIncome']/1e9:,.0f}B")


if __name__ == "__main__":
    main()
