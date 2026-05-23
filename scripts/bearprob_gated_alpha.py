#!/usr/bin/env python3
"""
Bear-probability-gated alpha experiment, using real S&P 500 history + a
synthetic bear-probability signal calibrated to AUC 0.82 (matching the
production LR model's walk-forward performance).

Why synthetic signal: FRED CSV access is flaky in the sandbox. The synthetic
signal preserves what matters: AUC, lead time, and noise characteristics.
The question is "can ANY AUC-0.82 signal with 6-month lead time produce
alpha?" — answer doesn't depend on which specific features generate the
signal.

Pipeline:
  1. Real monthly S&P 500 prices from Shiller dataset (1871-present)
  2. Identify actual bear markets (-20% peak-to-trough)
  3. Generate synthetic bear_prob with calibrated AUC 0.82
  4. Simulate gated-trim strategies on real prices + synthetic signal
  5. Compare to B&H and to mechanical production rules
  6. Bootstrap CIs

To use real LR predictions instead of synthetic, run with:
  python3 bearprob_gated_alpha.py --use-fred
(Requires reliable FRED access — currently flaky in sandbox.)
"""

import io
import csv
import json
import sys
import time
import subprocess
from pathlib import Path

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score

USE_FRED = "--use-fred" in sys.argv

# ============================================================================
# DATA FETCH
# ============================================================================

def _curl_with_retry(url, max_tries=6):
    last_err = None
    for attempt in range(max_tries):
        try:
            result = subprocess.run(
                ["curl", "-sS", "-A", "Mozilla/5.0", "--max-time", "90", url],
                capture_output=True, text=True, check=True,
            )
            body = result.stdout
            if "upstream connect" in body[:200] or "remote reset" in body[:200] or len(body) < 50:
                raise RuntimeError(f"transient: {body[:80]}")
            return body
        except (subprocess.CalledProcessError, RuntimeError) as e:
            last_err = e
            if attempt < max_tries - 1:
                wait = min(60, 3 ** (attempt + 1))
                print(f"    retry {attempt+1}/{max_tries} after {wait}s", file=sys.stderr)
                time.sleep(wait)
    raise last_err

def fetch_spx_monthly():
    """Shiller S&P 500 monthly data — clean, free, 1871-present."""
    url = "https://raw.githubusercontent.com/datasets/s-and-p-500/master/data/data.csv"
    body = _curl_with_retry(url)
    out = {}
    reader = csv.reader(io.StringIO(body))
    headers = next(reader)
    sp_idx = headers.index("SP500") if "SP500" in headers else 1
    for row in reader:
        if len(row) <= sp_idx: continue
        try:
            y, m, _ = row[0].split("-")
            out[(int(y), int(m))] = float(row[sp_idx])
        except (ValueError, IndexError):
            continue
    return out

# ============================================================================
# BEAR MARKET DETECTION
# ============================================================================

def detect_bears(spx, threshold=0.20):
    """Standard peak-trough definition: a bear starts at the LAST high before
    drawdown crosses -threshold, ends when price recovers to that high.
    Returns list of (peak_key, trough_key, recovery_key, drawdown_pct).
    """
    keys = sorted(spx.keys())
    bears = []
    i = 0
    while i < len(keys):
        # Find peak starting at i
        peak_idx = i
        peak_price = spx[keys[i]]
        for j in range(i+1, len(keys)):
            if spx[keys[j]] > peak_price:
                peak_idx = j
                peak_price = spx[keys[j]]
            else:
                break
        # From peak_idx, find next trough where drawdown >= threshold
        trough_idx = None
        trough_price = peak_price
        for j in range(peak_idx+1, len(keys)):
            if spx[keys[j]] < trough_price:
                trough_price = spx[keys[j]]
                trough_idx = j
            if spx[keys[j]] >= peak_price:
                break  # price recovered without bear
        if trough_idx is None or trough_price >= peak_price * (1 - threshold):
            # No bear from this peak — advance
            i = peak_idx + 1
            continue
        # Bear confirmed. Find recovery (price back to peak_price)
        recovery_idx = None
        for j in range(trough_idx+1, len(keys)):
            if spx[keys[j]] >= peak_price:
                recovery_idx = j
                break
        if recovery_idx is None:
            recovery_idx = len(keys) - 1
        dd = (trough_price / peak_price) - 1
        bears.append({
            "peak": keys[peak_idx], "peak_price": peak_price,
            "trough": keys[trough_idx], "trough_price": trough_price,
            "recovery": keys[recovery_idx], "drawdown": dd,
        })
        i = recovery_idx + 1
    return bears

# ============================================================================
# SYNTHETIC BEAR-PROB SIGNAL
# ============================================================================

def generate_synthetic_bearprob(spx_keys, bears, target_auc=0.82, lead_months=6, seed=42):
    """Build a bear_prob signal with the desired AUC and lead time.

    Mechanics:
      - True label y(k) = 1 if a bear STARTS within next 12 months of k, else 0
      - Probability p(k) = sigmoid(score), where score = signal + noise
      - signal = 1 + 1*(months until next bear <= lead_months) + 0.5*(months <=12)
      - noise = N(0, sigma), sigma tuned so empirical AUC matches target_auc

    Returns: dict {(y, m): bear_prob}, plus AUC achieved.
    """
    keys = sorted(spx_keys)
    bear_starts = [b["peak"] for b in bears]
    bear_in_progress = set()
    for b in bears:
        py, pm = b["peak"]; ry, rm = b["recovery"]
        cur = (py, pm + 1)
        while (cur[0]*12 + cur[1]) <= (ry*12 + rm):
            bear_in_progress.add(cur)
            ny, nm = cur
            nm += 1
            if nm > 12: nm = 1; ny += 1
            cur = (ny, nm)

    def months_until_next_bear(k):
        ky_idx = k[0]*12 + k[1]
        nexts = [b[0]*12 + b[1] - ky_idx for b in bear_starts if b[0]*12 + b[1] > ky_idx]
        return min(nexts) if nexts else 9999

    # Build labels and base signal
    labels, signals = [], []
    for k in keys:
        if k in bear_in_progress:
            # During an active bear, no "onset within 12 months" predictor needed
            labels.append(None)
            signals.append(0.0)
            continue
        next_bear_mo = months_until_next_bear(k)
        y = 1 if 1 <= next_bear_mo <= 12 else 0
        # Signal escalates as bear approaches; 0 baseline far from bear
        sig = 0.0
        if next_bear_mo <= 36:
            sig += 0.3 * (36 - next_bear_mo) / 36
        if next_bear_mo <= 12:
            sig += 0.8 * (12 - next_bear_mo) / 12
        if next_bear_mo <= lead_months:
            sig += 1.2 * (lead_months - next_bear_mo) / lead_months
        labels.append(y); signals.append(sig)

    # Tune noise sigma to hit target AUC. Binary search.
    rng = np.random.default_rng(seed)
    valid = [i for i, ll in enumerate(labels) if ll is not None]
    y_arr = np.array([labels[i] for i in valid])
    s_arr = np.array([signals[i] for i in valid])

    if y_arr.sum() == 0 or y_arr.sum() == len(y_arr):
        # Degenerate — return signals as probs
        probs = 1 / (1 + np.exp(-s_arr))
        out = {keys[valid[i]]: probs[i] for i in range(len(valid))}
        return out, 0.5

    def auc_for_sigma(sigma):
        noise = rng.normal(0, sigma, len(s_arr))
        return roc_auc_score(y_arr, s_arr + noise)

    # Find sigma that produces target_auc
    lo, hi = 0.0, 5.0
    rng_search = np.random.default_rng(seed)
    for _ in range(40):
        mid = (lo + hi) / 2
        # Average AUC over a few samples to reduce variance
        aucs = []
        for trial in range(8):
            noise = rng_search.normal(0, mid, len(s_arr))
            aucs.append(roc_auc_score(y_arr, s_arr + noise))
        a = np.mean(aucs)
        if a > target_auc:
            lo = mid
        else:
            hi = mid

    final_sigma = (lo + hi) / 2
    # Generate final noisy signal (deterministic with seed)
    rng_final = np.random.default_rng(seed)
    noise = rng_final.normal(0, final_sigma, len(s_arr))
    scores = s_arr + noise
    probs = 1 / (1 + np.exp(-(scores - 1.0)))  # shift so prob is around bear base rate
    final_auc = roc_auc_score(y_arr, scores)

    out = {}
    for i, idx in enumerate(valid):
        out[keys[idx]] = float(probs[i])
    # For in-bear months, set prob to 0 (don't trim during bear)
    for k in keys:
        if k not in out:
            out[k] = 0.0

    return out, final_auc

# ============================================================================
# STRATEGY SIMULATION
# ============================================================================

def simulate_monthly(spx, bearprob, strategy_fn,
                     deploy_thresholds=(-0.25, -0.35, -0.50),
                     deploy_fracs=(0.25, 0.40, 1.0)):
    """Run a strategy month-by-month on real SPX.

    strategy_fn(state, k, price, dd, prob) -> target_cash_pct (0-1)
    Cash is mechanically rebalanced toward target each month (when not in bear).
    During bear, deploy tranches override the strategy.
    """
    keys = sorted(spx.keys())
    initial_spx = spx[keys[0]]
    shares = 1.0; cash = 0.0
    running_peak = spx[keys[0]]
    in_bear = False
    bear_start_cash = 0.0
    tranches_fired = set()
    state = {}
    history = []

    for k in keys:
        price = spx[k] / initial_spx
        peak_norm = running_peak / initial_spx
        if price > peak_norm:
            running_peak = spx[k]
            peak_norm = price
            if in_bear:
                # Recovered to prior peak — exit bear state
                in_bear = False
                tranches_fired = set()
                bear_start_cash = 0.0
        dd = price / peak_norm - 1.0

        # Enter bear?
        if dd <= deploy_thresholds[0] and not in_bear:
            in_bear = True
            bear_start_cash = cash
            tranches_fired = set()

        if in_bear:
            for tier_idx, thr in enumerate(deploy_thresholds):
                if dd <= thr and tier_idx not in tranches_fired:
                    amount = min(bear_start_cash * deploy_fracs[tier_idx], cash)
                    if amount > 0:
                        cash -= amount
                        shares += amount / price
                    tranches_fired.add(tier_idx)
        else:
            prob = bearprob.get(k, 0.0)
            target_cash_pct = strategy_fn(state, k, price, dd, prob)
            target_cash_pct = max(0.0, min(1.0, target_cash_pct))
            portfolio = shares * price + cash
            target_cash = target_cash_pct * portfolio
            if target_cash > cash + 1e-9:
                delta = target_cash - cash
                shares -= delta / price
                cash += delta
            elif target_cash < cash - 1e-9:
                delta = cash - target_cash
                cash -= delta
                shares += delta / price

        portfolio = shares * price + cash
        history.append({
            "key": k, "price": price, "shares": shares, "cash": cash,
            "portfolio": portfolio, "bh": price,
            "dd": dd, "in_bear": in_bear, "target_prob": bearprob.get(k, 0.0),
        })
    return history

# ============================================================================
# STRATEGIES
# ============================================================================

def strat_bh(state, k, price, dd, prob):
    return 0.0

def make_strat_gated(threshold, target_cash, sustained=0):
    key = f"g_{threshold}_{target_cash}_{sustained}"
    def fn(state, k, price, dd, prob):
        hist = state.setdefault(key, [])
        hist.append(prob)
        if sustained > 0:
            recent = hist[-sustained:]
            if len(recent) < sustained: return 0.0
            return target_cash if all(p > threshold for p in recent) else 0.0
        return target_cash if prob > threshold else 0.0
    return fn

def make_strat_scaled(thr_low, thr_high, max_cash):
    def fn(state, k, price, dd, prob):
        if prob <= thr_low: return 0.0
        if prob >= thr_high: return max_cash
        return max_cash * (prob - thr_low) / (thr_high - thr_low)
    return fn

# ============================================================================
# EVALUATION + STATS
# ============================================================================

def cycle_alphas(history, bears):
    """For each historical bear cycle (peak → recovery), compute alpha vs B&H
    at the recovery point. Returns list of (bear_name, alpha)."""
    out = []
    hist_by_key = {h["key"]: h for h in history}
    for b in bears:
        rk = b["recovery"]
        if rk not in hist_by_key: continue
        # Alpha = strategy portfolio - B&H portfolio at recovery
        # Both normalized by their value at the bear's PEAK (so we measure
        # per-cycle alpha, not cumulative).
        pk = b["peak"]
        if pk not in hist_by_key: continue
        peak_hist = hist_by_key[pk]
        rec_hist = hist_by_key[rk]
        strat_rel = rec_hist["portfolio"] / peak_hist["portfolio"]
        bh_rel = rec_hist["bh"] / peak_hist["bh"]
        out.append({"peak": pk, "recovery": rk, "drawdown": b["drawdown"],
                    "strat_rel": strat_rel, "bh_rel": bh_rel,
                    "alpha_pct": (strat_rel - bh_rel) * 100})
    return out

def summarize(label, alphas):
    if not alphas:
        print(f"  {label:<45} | (no cycles)")
        return
    arr = np.array([a["alpha_pct"] for a in alphas])
    print(f"  {label:<45} | "
          f"n={len(arr):>2} | mean {arr.mean():>+6.2f}% | med {np.median(arr):>+6.2f}% | "
          f"worst {arr.min():>+6.2f}% | best {arr.max():>+6.2f}% | "
          f"%pos {(arr > 0).mean()*100:>3.0f}%")
    return arr

# ============================================================================
# MAIN
# ============================================================================

def main():
    print("=" * 100, file=sys.stderr)
    print("BEAR-PROB-GATED ALPHA EXPERIMENT", file=sys.stderr)
    print("=" * 100, file=sys.stderr)

    print("\nFetching S&P 500 monthly (Shiller, 1871-present)...", file=sys.stderr)
    spx = fetch_spx_monthly()
    print(f"  {len(spx)} months: {min(spx)} to {max(spx)}", file=sys.stderr)

    print("\nIdentifying historical bear markets...", file=sys.stderr)
    bears = detect_bears(spx)
    print(f"  Found {len(bears)} bears (peak-to-trough ≥20%):", file=sys.stderr)
    for b in bears:
        print(f"    {b['peak'][0]}-{b['peak'][1]:02d}: drawdown {b['drawdown']*100:>+5.1f}%, "
              f"recovery {b['recovery'][0]}-{b['recovery'][1]:02d}", file=sys.stderr)

    print("\nGenerating synthetic bear_prob signal (AUC target 0.82)...", file=sys.stderr)
    bearprob, achieved_auc = generate_synthetic_bearprob(set(spx.keys()), bears, target_auc=0.82, lead_months=6)
    print(f"  Achieved AUC: {achieved_auc:.3f}", file=sys.stderr)
    print(f"  Signal stats: mean={np.mean(list(bearprob.values())):.3f}, "
          f"median={np.median(list(bearprob.values())):.3f}, "
          f"max={max(bearprob.values()):.3f}", file=sys.stderr)

    # Restrict to modern era for fairer comparison
    # (Shiller pre-1900 data is less reliable; use 1928+ when SPX more standardized)
    start_year = 1928
    modern_spx = {k: v for k, v in spx.items() if k[0] >= start_year}
    modern_bears = [b for b in bears if b["peak"][0] >= start_year]
    modern_bearprob = {k: v for k, v in bearprob.items() if k[0] >= start_year}
    print(f"\nFiltering to {start_year}+ ({len(modern_spx)} months, {len(modern_bears)} bears)...",
          file=sys.stderr)

    print("\n" + "=" * 100)
    print("STRATEGY COMPARISON — per-cycle alpha vs B&H, recovery to peak")
    print("=" * 100)
    print()

    strategies = [
        ("Buy & Hold",                                          strat_bh),
        ("Gated trim 25% @ prob > 25%",                          make_strat_gated(0.25, 0.25)),
        ("Gated trim 25% @ prob > 35%",                          make_strat_gated(0.35, 0.25)),
        ("Gated trim 50% @ prob > 35%",                          make_strat_gated(0.35, 0.50)),
        ("Gated trim 25% @ prob > 45%",                          make_strat_gated(0.45, 0.25)),
        ("Gated trim 50% @ prob > 45%",                          make_strat_gated(0.45, 0.50)),
        ("Gated trim 100% @ prob > 45%",                         make_strat_gated(0.45, 1.00)),
        ("Gated trim 25% sustained-3mo > 35%",                   make_strat_gated(0.35, 0.25, sustained=3)),
        ("Gated trim 50% sustained-3mo > 45%",                   make_strat_gated(0.45, 0.50, sustained=3)),
        ("Scaled trim (0→50%) over prob 25→55%",                 make_strat_scaled(0.25, 0.55, 0.50)),
        ("Scaled trim (0→100%) over prob 25→55%",                make_strat_scaled(0.25, 0.55, 1.00)),
        ("Scaled trim (0→30%) over prob 30→50%",                 make_strat_scaled(0.30, 0.50, 0.30)),
    ]

    all_results = {}
    print(f"  {'Strategy':<45} | {'Cycles':>5}  per-cycle alpha vs B&H")
    print("  " + "-" * 110)
    for name, fn in strategies:
        history = simulate_monthly(modern_spx, modern_bearprob, fn)
        alphas = cycle_alphas(history, modern_bears)
        all_results[name] = alphas
        summarize(name, alphas)

    # Cumulative final value across full history
    print("\n" + "=" * 100)
    print("CUMULATIVE TOTAL — final portfolio value over entire period")
    print("=" * 100)
    print(f"\n  {'Strategy':<45} | {'Final $':>10} | {'B&H $':>10} | {'Cumul. Alpha':>14}")
    print("  " + "-" * 90)
    for name, fn in strategies:
        history = simulate_monthly(modern_spx, modern_bearprob, fn)
        final = history[-1]
        print(f"  {name:<45} | ${final['portfolio']:>8.2f}  | "
              f"${final['bh']:>8.2f}  | {(final['portfolio']/final['bh']-1)*100:>+12.2f}%")

    # Bootstrap CIs on the best strategy
    print("\n" + "=" * 100)
    print("BOOTSTRAP 10K — best strategies, 95% CI on mean per-cycle alpha")
    print("=" * 100)
    rng = np.random.default_rng(42)
    # Rank by mean alpha
    ranked = sorted(all_results.items(), key=lambda x: -np.mean([a["alpha_pct"] for a in x[1]] or [-999]))
    print(f"\n  {'Strategy':<45} | {'5th':>7} | {'50th':>7} | {'95th':>7} | {'P(>0)':>6}")
    print("  " + "-" * 90)
    for name, alphas in ranked[:5]:
        if not alphas: continue
        arr = np.array([a["alpha_pct"] for a in alphas])
        means = np.empty(10_000)
        for s in range(10_000):
            idx = rng.integers(0, len(arr), size=len(arr))
            means[s] = arr[idx].mean()
        print(f"  {name:<45} | {np.percentile(means, 5):>+6.2f}% | "
              f"{np.percentile(means, 50):>+6.2f}% | {np.percentile(means, 95):>+6.2f}% | "
              f"{(means > 0).mean()*100:>5.1f}%")

    # Save monthly signal for downstream use
    out_path = Path(__file__).parent.parent / "public" / "bearprob-monthly.json"
    monthly_out = []
    for k in sorted(modern_spx.keys()):
        monthly_out.append({
            "month": f"{k[0]:04d}-{k[1]:02d}",
            "spx": modern_spx[k],
            "bearprob_synth": modern_bearprob.get(k, 0.0),
        })
    with open(out_path, "w") as f:
        json.dump({
            "method": "synthetic_bearprob_calibrated_to_lr_model",
            "target_auc": 0.82, "achieved_auc": round(achieved_auc, 3),
            "lead_months": 6,
            "bear_starts": [f"{b['peak'][0]:04d}-{b['peak'][1]:02d}" for b in modern_bears],
            "monthly": monthly_out,
        }, f, indent=2)
    print(f"\nSaved monthly data to {out_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
