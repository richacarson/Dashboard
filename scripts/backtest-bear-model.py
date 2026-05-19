"""
Backtest the bear-probability composite model against ~35 years of history.

Replays the same scoring functions used in src/App.jsx against monthly FRED
macro data and Yahoo S&P 500 history, then labels each month with the realized
12-month bear-onset outcome.

Outputs public/model-backtest.json with calibration buckets, ROC AUC, and
threshold analysis.

Requires:
  - FRED_KEY env var for FRED API access
  - Internet access to query1.finance.yahoo.com for SPX history
"""

import json
import os
import subprocess
import io
import csv
import sys
from datetime import datetime
from pathlib import Path

OUT_PATH = Path(__file__).parent.parent / "public" / "model-backtest.json"
FRED_KEY = os.environ.get("FRED_KEY", "")


def curl_json(url):
    """Fetch JSON via curl (more reliable than urllib in some environments)."""
    result = subprocess.run(
        ["curl", "-sf", "-A", "Mozilla/5.0", "--max-time", "60", url],
        capture_output=True, text=True, check=True,
    )
    return json.loads(result.stdout)


def fetch_fred_api(series_id):
    """Fetch FRED series via official API. Returns list of (date, value)."""
    if not FRED_KEY:
        raise RuntimeError("FRED_KEY env var required")
    url = (
        f"https://api.stlouisfed.org/fred/series/observations"
        f"?series_id={series_id}&api_key={FRED_KEY}&file_type=json"
    )
    data = curl_json(url)
    out = []
    for obs in data.get("observations", []):
        v_str = obs.get("value", ".")
        if v_str in (".", "", "NA"):
            continue
        try:
            d = datetime.strptime(obs["date"], "%Y-%m-%d").date()
            out.append((d, float(v_str)))
        except (ValueError, TypeError):
            continue
    return out


def fetch_yahoo_history(symbol, range_="max", interval="1mo"):
    """Fetch Yahoo Finance OHLC history. Returns list of (date, close)."""
    url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
        f"?range={range_}&interval={interval}"
    )
    data = curl_json(url)
    res = data["chart"]["result"][0]
    timestamps = res.get("timestamp", [])
    closes = res.get("indicators", {}).get("quote", [{}])[0].get("close", [])
    out = []
    for ts, c in zip(timestamps, closes):
        if c is None:
            continue
        d = datetime.utcfromtimestamp(ts).date()
        out.append((d, float(c)))
    return out


def to_monthly_last(series):
    """Convert to month-end dict keyed by (year, month)."""
    monthly = {}
    for d, v in series:
        key = (d.year, d.month)
        monthly[key] = (d, v)
    return monthly


def to_monthly_first(series):
    monthly = {}
    for d, v in series:
        key = (d.year, d.month)
        if key not in monthly:
            monthly[key] = (d, v)
    return monthly


def to_monthly_avg(series):
    monthly = {}
    for d, v in series:
        key = (d.year, d.month)
        if key not in monthly:
            monthly[key] = [d, [v]]
        else:
            monthly[key][1].append(v)
    return {k: (v[0], sum(v[1]) / len(v[1])) for k, v in monthly.items()}


def add_months(yr, mo, n):
    total = yr * 12 + (mo - 1) + n
    return total // 12, total % 12 + 1


def interp(x, points):
    """Linear interp between (x, score) pairs — matches App.jsx exactly."""
    if x is None:
        return None
    if x <= points[0][0]:
        return points[0][1]
    if x >= points[-1][0]:
        return points[-1][1]
    for i in range(len(points) - 1):
        x1, y1 = points[i]
        x2, y2 = points[i + 1]
        if x1 <= x <= x2:
            return y1 + (y2 - y1) * (x - x1) / (x2 - x1)
    return points[-1][1]


def main():
    print("Fetching FRED series...")
    if not FRED_KEY:
        print("  ERROR: FRED_KEY env var not set — backtest cannot run", file=sys.stderr)
        sys.exit(1)
    series = {}
    fred_ids = [
        ("T10Y2Y", "yield_2s10s", to_monthly_avg),
        ("BAA10Y", "baa10y", to_monthly_avg),
        ("VIXCLS", "vix", to_monthly_avg),
        ("IC4WSA", "claims", to_monthly_last),
        ("CFNAI", "cfnai", to_monthly_first),
        ("UNRATE", "unrate", to_monthly_first),
        ("DCOILWTICO", "oil", to_monthly_avg),
    ]
    for fid, name, agg in fred_ids:
        print(f"  {fid} -> {name}...", flush=True)
        try:
            raw = fetch_fred_api(fid)
            series[name] = agg(raw)
            print(f"    {len(raw)} observations, {len(series[name])} months")
        except Exception as e:
            print(f"    FAILED: {e}", file=sys.stderr)
            series[name] = {}

    if all(len(series[name]) == 0 for _, name, _ in fred_ids):
        print("ERROR: All FRED fetches returned empty — FRED_KEY may be invalid", file=sys.stderr)
        sys.exit(1)

    print("Fetching ^GSPC daily history from Yahoo (for accurate bear detection)...")
    spx_daily_raw = fetch_yahoo_history("%5EGSPC", range_="max", interval="1d")
    print(f"  {len(spx_daily_raw)} daily closes ({spx_daily_raw[0][0]} to {spx_daily_raw[-1][0]})")
    # Monthly closes = last daily close in each month
    spx_monthly = {}
    for d, v in spx_daily_raw:
        spx_monthly[(d.year, d.month)] = (d, v)
    print(f"  {len(spx_monthly)} monthly closes derived")

    # Build chronological list
    spx_keys = sorted(spx_monthly.keys())
    spx_vals = [spx_monthly[k][1] for k in spx_keys]

    # 10-month SMA (monthly equivalent of 200-day)
    sma10 = {}
    for i, k in enumerate(spx_keys):
        if i >= 9:
            sma10[k] = sum(spx_vals[i - 9:i + 1]) / 10

    # Identify bear starts using DAILY closes (-20% from peak, recovery reset).
    # Daily catches rapid bears (1990, 2020, 2022) that monthly closes barely miss.
    bear_starts_daily = []
    bear_end_dates_daily = []
    in_bear = False
    running_peak = 0
    bear_peak = 0
    for d, v in spx_daily_raw:
        if not in_bear:
            if v > running_peak:
                running_peak = v
            if running_peak > 0 and (v / running_peak - 1) * 100 <= -20:
                bear_starts_daily.append(d)
                in_bear = True
                bear_peak = running_peak
        else:
            if v >= bear_peak:
                bear_end_dates_daily.append(d)
                in_bear = False
                running_peak = v

    bear_starts = [(d.year, d.month) for d in bear_starts_daily]
    bear_end_dates = [(d.year, d.month) for d in bear_end_dates_daily]
    print(f"Bear-market starts identified (daily): {len(bear_starts)}")
    for bs in bear_starts:
        print(f"  {bs[0]}-{bs[1]:02d}")

    def months_since_last_bear_end(yr, mo):
        cand = [be for be in bear_end_dates if be < (yr, mo)]
        if not cand:
            return None
        last = max(cand)
        return (yr - last[0]) * 12 + (mo - last[1])

    # Oil YoY
    oil = series.get("oil", {})
    oil_yoy = {}
    for k in oil:
        yr_ago = add_months(k[0], k[1], -12)
        if yr_ago in oil and oil[yr_ago][1] > 0:
            oil_yoy[k] = (oil[k][1] / oil[yr_ago][1] - 1) * 100

    # Claims trend (M/M %)
    claims = series.get("claims", {})
    claims_trend = {}
    for k in claims:
        prev = add_months(k[0], k[1], -1)
        if prev in claims and claims[prev][1] > 0:
            claims_trend[k] = (claims[k][1] / claims[prev][1] - 1) * 100

    # Sahm Rule
    unrate = series.get("unrate", {})
    sahm = {}
    unrate_keys = sorted(unrate.keys())
    for i, k in enumerate(unrate_keys):
        if i < 12:
            continue
        last3 = [unrate[unrate_keys[j]][1] for j in range(i - 2, i + 1)]
        last12 = [unrate[unrate_keys[j]][1] for j in range(i - 11, i + 1)]
        sahm[k] = sum(last3) / 3 - min(last12)

    # CFNAI 3-month
    cfnai = series.get("cfnai", {})
    cfnai_3m = {}
    cfnai_keys = sorted(cfnai.keys())
    for i, k in enumerate(cfnai_keys):
        if i < 2:
            continue
        cfnai_3m[k] = sum(cfnai[cfnai_keys[j]][1] for j in range(i - 2, i + 1)) / 3

    # Determine start month — when all key factors have data
    # BAA10Y starts 1986, VIX starts 1990 → use 1990 for full coverage
    START = (1990, 1)
    END = max(spx_monthly.keys())

    months = []
    yr, mo = START
    while (yr, mo) <= END:
        months.append((yr, mo))
        yr, mo = add_months(yr, mo, 1)

    print(f"\nScoring {len(months)} months from {START} to {END}...")

    rows = []
    for k in months:
        factors = []

        # Yield Curve (18%)
        if k in series["yield_2s10s"]:
            spread = series["yield_2s10s"][k][1]
            score = interp(spread, [(-1.5, 92), (-0.8, 78), (-0.4, 62), (0.0, 45), (0.5, 30), (1.0, 18), (2.0, 10), (3.0, 5)])
            factors.append(("yield", score, 18))

        # Jobless Claims (12%)
        if k in claims_trend:
            ct = claims_trend[k]
            score = interp(ct, [(-15, 5), (-5, 12), (0, 22), (5, 38), (10, 55), (20, 72), (35, 85), (50, 92)])
            factors.append(("claims", score, 12))

        # Bull Duration (10%)
        bull_age = months_since_last_bear_end(k[0], k[1])
        if bull_age is not None and bull_age >= 0:
            score = interp(bull_age, [(6, 8), (18, 15), (36, 25), (60, 40), (84, 55), (120, 68), (160, 80)])
            factors.append(("duration", score, 10))

        # Credit Spreads (10%)
        if k in series["baa10y"]:
            spread = series["baa10y"][k][1]
            score = interp(spread, [(1.2, 8), (1.5, 15), (1.8, 22), (2.2, 32), (2.8, 48), (3.5, 65), (4.5, 80), (5.5, 90)])
            factors.append(("credit", score, 10))

        # Momentum (10%)
        if k in spx_monthly and k in sma10:
            pct = (spx_monthly[k][1] / sma10[k] - 1) * 100
            score = interp(pct, [(-12, 90), (-6, 75), (-2, 55), (0, 40), (3, 25), (6, 15), (12, 5)])
            factors.append(("momentum", score, 10))

        # VIX (5%)
        if k in series["vix"]:
            score = interp(series["vix"][k][1], [(10, 5), (14, 12), (18, 25), (22, 40), (28, 58), (35, 72), (45, 85)])
            factors.append(("vix", score, 5))

        # CFNAI (8%)
        if k in cfnai_3m:
            score = interp(cfnai_3m[k], [(-1.5, 92), (-0.7, 75), (-0.35, 55), (0, 35), (0.2, 20), (0.5, 10), (1.0, 5)])
            factors.append(("cfnai", score, 8))

        # Sahm (7%)
        if k in sahm:
            score = interp(sahm[k], [(0, 5), (0.15, 15), (0.3, 35), (0.4, 55), (0.5, 75), (0.7, 88), (1.0, 95)])
            factors.append(("sahm", score, 7))

        # Oil (5%)
        if k in oil_yoy:
            score = interp(oil_yoy[k], [(-20, 5), (-5, 10), (10, 18), (25, 32), (40, 50), (60, 68), (85, 82), (120, 92)])
            factors.append(("oil", score, 5))

        if len(factors) < 5:
            continue

        total_w = sum(w for _, _, w in factors)
        base = sum(s * w / total_w for _, s, w in factors)
        elevated = sum(1 for _, s, _ in factors if s >= 50)
        bonus = 15 if elevated >= 5 else 10 if elevated >= 4 else 5 if elevated >= 3 else 0
        composite = max(5, min(95, round(base + bonus)))

        # Outcome: bear within next 12 months?
        outcome = 0
        for be in bear_starts:
            ahead = (be[0] - k[0]) * 12 + (be[1] - k[1])
            if 1 <= ahead <= 12:
                outcome = 1
                break

        rows.append({
            "month": f"{k[0]:04d}-{k[1]:02d}",
            "score": composite,
            "outcome": outcome,
            "n_factors": len(factors),
            "elevated": elevated,
        })

    print(f"Scored {len(rows)} months ({sum(r['outcome'] for r in rows)} positive)")

    # Bucket calibration
    buckets = [(0, 20), (20, 30), (30, 40), (40, 50), (50, 60), (60, 70), (70, 100)]
    bucket_stats = []
    for lo, hi in buckets:
        in_b = [r for r in rows if lo <= r["score"] < hi]
        n = len(in_b)
        bears = sum(r["outcome"] for r in in_b)
        rate = bears / n if n else 0
        # Wilson 95% CI
        if n > 0:
            z = 1.96
            denom = 1 + z * z / n
            center = (rate + z * z / (2 * n)) / denom
            margin = z * ((rate * (1 - rate) / n + z * z / (4 * n * n)) ** 0.5) / denom
            ci = (max(0, center - margin), min(1, center + margin))
        else:
            ci = (0, 0)
        bucket_stats.append({
            "range": f"{lo}-{hi}",
            "lo": lo, "hi": hi, "n": n, "bears": bears,
            "rate": round(rate * 100, 1),
            "ci_lo": round(ci[0] * 100, 1),
            "ci_hi": round(ci[1] * 100, 1),
        })

    # ROC AUC via Mann-Whitney U
    pos = [r["score"] for r in rows if r["outcome"] == 1]
    neg = [r["score"] for r in rows if r["outcome"] == 0]
    auc = None
    if pos and neg:
        wins = ties = 0
        for p in pos:
            for n in neg:
                if p > n:
                    wins += 1
                elif p == n:
                    ties += 1
        auc = (wins + 0.5 * ties) / (len(pos) * len(neg))

    # Threshold analysis
    thresholds = {}
    total_pos = sum(r["outcome"] for r in rows)
    total_neg = sum(1 for r in rows if r["outcome"] == 0)
    for t in [40, 45, 50, 55, 60, 65]:
        above = [r for r in rows if r["score"] >= t]
        tp = sum(r["outcome"] for r in above)
        fp = len(above) - tp
        thresholds[str(t)] = {
            "n_above": len(above),
            "true_pos": tp,
            "false_pos": fp,
            "precision": round(tp / len(above) * 100, 1) if above else 0,
            "recall": round(tp / total_pos * 100, 1) if total_pos else 0,
            "fpr": round(fp / total_neg * 100, 1) if total_neg else 0,
        }

    # Trajectory before each bear: avg score 12mo, 6mo, 3mo, 1mo before
    pre_bear_scores = {12: [], 6: [], 3: [], 1: []}
    for be in bear_starts:
        for lag, store in pre_bear_scores.items():
            target = add_months(be[0], be[1], -lag)
            target_str = f"{target[0]:04d}-{target[1]:02d}"
            r = next((r for r in rows if r["month"] == target_str), None)
            if r:
                store.append(r["score"])
    pre_bear_avg = {str(k): round(sum(v) / len(v), 1) if v else None for k, v in pre_bear_scores.items()}

    result = {
        "generated": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "start_month": rows[0]["month"] if rows else None,
        "end_month": rows[-1]["month"] if rows else None,
        "total_months": len(rows),
        "bear_months": total_pos,
        "bear_starts": [f"{k[0]:04d}-{k[1]:02d}" for k in bear_starts],
        "auc": round(auc, 3) if auc is not None else None,
        "buckets": bucket_stats,
        "thresholds": thresholds,
        "pre_bear_avg_score": pre_bear_avg,
        "factors_included": [f[0] for f in [("yield_2s10s", 18), ("claims", 12), ("duration", 10), ("baa10y", 10), ("momentum", 10), ("vix", 5), ("cfnai", 8), ("sahm", 7), ("oil_yoy", 5)]],
        "factors_excluded": ["valuation_pe", "eps_trend"],
        "notes": (
            "Backtest scores each month from 1990-present using the same factor "
            "interpolation tables as the live model. Excludes Valuation (no free "
            "monthly P/E history) and EPS Trend (new factor). Yield-curve "
            "post-inversion premium is also excluded — the backtest uses raw "
            "10Y-2Y spread only. Outcome label: any bear-market start (-20% "
            "from peak) within the following 12 months."
        ),
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w") as f:
        json.dump(result, f, indent=2)

    print(f"\nWrote {OUT_PATH}")
    print(f"AUC: {result['auc']}")
    print("\nBucket calibration:")
    for b in bucket_stats:
        print(f"  {b['range']:>7s}: n={b['n']:>3d}, bears={b['bears']:>3d}, rate={b['rate']:>5.1f}% (95% CI {b['ci_lo']:.1f}-{b['ci_hi']:.1f}%)")
    print("\nThresholds:")
    for t, s in thresholds.items():
        print(f"  >={t}: precision={s['precision']}%, recall={s['recall']}%, FPR={s['fpr']}%")
    print(f"\nAvg score before bear starts: {pre_bear_avg}")


if __name__ == "__main__":
    main()
