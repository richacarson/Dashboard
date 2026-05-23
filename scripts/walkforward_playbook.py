#!/usr/bin/env python3
"""
Walk-forward validation of the production playbook rules.

Uses a NUMERICAL FULL-CYCLE SIMULATOR that tracks portfolio value (shares
and cash) through each phase: bull → trim events → peak → bear → deploy
events → bottom → recovery. This avoids the approximation bias in the
analytical simulator (playbook_optimization.py), which mixes bear-bottom
protection with peak-recovery alpha — a meaningful issue in cycles like
2009-2020 where the bull dwarfs the bear.

Reports three distinct, well-defined metrics for each bull→bear cycle:
  - DD_REDUCTION:  drawdown protection at bear bottom (vs B&H bottom)
  - RECOVERY_NET:  portfolio value at peak recovery (vs B&H at recovery)
  - BLENDED:       DD_reduction + recovery_net (50/50) — risk-aware score

Tests:
  1. PRODUCTION rules in-sample
  2. WALK-FORWARD — at each historical bear, optimize on prior bears only,
     test on held-out. Compares WF-optimal-on-past vs PRODUCTION.
  3. PARAMETER SENSITIVITY — perturb each production parameter; flat
     surface = robust to choice.
  4. BOOTSTRAP — resample bear sequence 10K times, characterize CI.
"""

import numpy as np
from dataclasses import dataclass
from itertools import product

# =============================================================================
# DATA — 15 bears / 14 bull-bear pairs (same as playbook_optimization.py)
# =============================================================================

@dataclass
class BearMarket:
    name: str
    drawdown_pct: float
    duration_months: float
    recovery_months: float

@dataclass
class BullMarket:
    name: str
    gain_pct: float
    duration_months: float

BEARS = [
    BearMarket("Great Depression",    -86.2, 33.0, 267.0),
    BearMarket("1937-38 Recession",   -54.5, 12.8,  95.6),
    BearMarket("WWII",                -34.5, 17.6,  25.2),
    BearMarket("Post-WWII",           -28.8, 11.6,  39.5),
    BearMarket("Eisenhower",          -21.6, 14.7,  11.0),
    BearMarket("Kennedy Slide",       -28.0,  6.5,  14.3),
    BearMarket("Credit Crunch",       -22.2,  7.9,   6.9),
    BearMarket("Vietnam",             -36.1, 17.9,  21.4),
    BearMarket("OPEC",                -48.2, 20.7,  69.5),
    BearMarket("Volcker",             -27.1, 20.5,   2.8),
    BearMarket("Black Monday",        -33.5,  3.3,  19.7),
    BearMarket("Dot-Com",             -49.1, 30.5,  55.6),
    BearMarket("GFC",                 -56.8, 17.0,  48.8),
    BearMarket("COVID",               -33.9,  1.1,   4.9),
    BearMarket("2022 Inflation",      -25.4,  9.3,  15.3),
]

BULLS = [
    BullMarket("1932-1937",   324.8,  57.0),
    BullMarket("1938-1938",    62.2,   7.3),
    BullMarket("1942-1946",   157.7,  49.0),
    BullMarket("1947-1956",   267.0,  86.0),
    BullMarket("1957-1961",    86.3,  49.7),
    BullMarket("1962-1966",    79.8,  43.5),
    BullMarket("1966-1968",    48.0,  25.7),
    BullMarket("1970-1973",    73.5,  31.5),
    BullMarket("1974-1980",   125.6,  73.9),
    BullMarket("1982-1987",   228.8,  60.4),
    BullMarket("1987-2000",   582.0, 147.6),
    BullMarket("2002-2007",   101.5,  60.0),
    BullMarket("2009-2020",   400.5, 131.4),
    BullMarket("2020-2022",   114.4,  21.3),
]

PAIRS = list(zip(BULLS, BEARS[1:]))   # 14 pairs

# =============================================================================
# PRODUCTION RULES — exactly as in src/App.jsx
# =============================================================================

PROD_TRIM = [(75, 0.02), (150, 0.05), (250, 0.08), (350, 0.11), (500, 0.14)]
PROD_DEPLOY = [(-25, 0.25), (-35, 0.40), (-50, 1.0)]

# =============================================================================
# NUMERICAL FULL-CYCLE SIMULATOR (with 18-month time decay)
# =============================================================================
# Models the production strategy as it actually operates:
#   - Trim thresholds fire as the bull crosses each tier
#   - After 18 months without a bear, the LAST trim's cash is recycled to
#     equity (App.jsx: "18-Month Time Decay" rule)
#   - Each tier fires AT MOST ONCE per cycle (post-decay, only higher tiers
#     can fire — "triggers reset and can fire again at higher levels")
# =============================================================================

DECAY_MONTHS = 18

def simulate_bull(bull, trim):
    """Run the bull market with trim + decay. Returns (shares, cash) at peak."""
    G = bull.gain_pct / 100
    duration = bull.duration_months
    if duration <= 0 or G <= 0:
        return 1.0, 0.0

    # Assume exponential growth: (1+r)^duration = 1+G
    r = (1 + G) ** (1 / duration) - 1

    # Events: (fire_month, target_cum_cash, threshold_pct)
    events = []
    for thr_pct, target_cum in sorted(trim, key=lambda x: x[0]):
        thr = thr_pct / 100
        if G >= thr:
            m = np.log(1 + thr) / np.log(1 + r)
            events.append((m, target_cum, thr_pct))

    shares = 1.0
    cash = 0.0
    last_trim_month = None  # clock for 18-month decay

    for fire_month, target_cum, thr_pct in events:
        # Decay check: did 18 months pass since last trim before this event?
        if last_trim_month is not None:
            decay_at = last_trim_month + DECAY_MONTHS
            if decay_at < fire_month:
                # Recycle all cash to equity at the decay-month price
                decay_price = (1 + r) ** decay_at
                shares += cash / decay_price
                cash = 0.0
                last_trim_month = None

        # Fire this tier: bring cash up to target_cum × portfolio
        share_price = (1 + r) ** fire_month
        portfolio = shares * share_price + cash
        target_cash = target_cum * portfolio
        if target_cash > cash:
            delta = target_cash - cash
            shares -= delta / share_price
            cash += delta
        last_trim_month = fire_month

    # Final decay check: did the last trim decay before peak?
    if last_trim_month is not None:
        decay_at = last_trim_month + DECAY_MONTHS
        if decay_at < duration:
            decay_price = (1 + r) ** decay_at
            shares += cash / decay_price
            cash = 0.0

    return shares, cash


def simulate_pair(bull, bear, trim, deploy):
    G = bull.gain_pct / 100
    DD = abs(bear.drawdown_pct) / 100

    # BULL phase (with 18-month decay)
    shares, cash = simulate_bull(bull, trim)
    bear_start_cash = cash

    # BEAR phase: deploy tranches in order of severity
    for thr_pct, frac in sorted(deploy, key=lambda x: abs(x[0])):
        L = abs(thr_pct) / 100
        if DD < L:
            continue
        price = (1 + G) * (1 - L)
        amount = min(bear_start_cash * frac, cash)
        if amount <= 0:
            continue
        cash -= amount
        shares += amount / price

    # AT BEAR BOTTOM
    bottom_price = (1 + G) * (1 - DD)
    bottom_value_strat = shares * bottom_price + cash
    bottom_value_bh    = (1 + G) * (1 - DD)

    # AT PEAK RECOVERY
    recovery_value_strat = shares * (1 + G) + cash
    recovery_value_bh    = (1 + G)

    dd_reduction = bottom_value_strat - bottom_value_bh
    recovery_net = recovery_value_strat - recovery_value_bh
    blended      = 0.5 * dd_reduction + 0.5 * recovery_net

    return {
        "dd_reduction": dd_reduction,
        "recovery_net": recovery_net,
        "blended": blended,
        "cash_at_peak": bear_start_cash,
    }

def simulate(pairs, trim, deploy, metric="recovery_net"):
    return [simulate_pair(b, br, trim, deploy)[metric] for b, br in pairs]

def score(nets):
    """Composite score: weighted toward mean but also penalizes worst case."""
    avg = np.mean(nets); med = np.median(nets); worst = min(nets)
    pct_pos = sum(1 for n in nets if n > 0) / len(nets)
    return 0.50 * avg + 0.25 * med + 0.15 * worst + 0.10 * pct_pos * avg

# =============================================================================
# GRID — vary cash & deploy percentages at fixed App.jsx threshold structure
# =============================================================================

TRIM_THRESHOLDS = [75, 150, 250, 350, 500]
TRIM_OPTIONS = [
    [0.00, 0.01, 0.02, 0.03, 0.04],     # +75% tier
    [0.03, 0.04, 0.05, 0.06, 0.07],     # +150%
    [0.06, 0.07, 0.08, 0.09, 0.11],     # +250%
    [0.09, 0.10, 0.11, 0.12, 0.14],     # +350%
    [0.12, 0.13, 0.14, 0.16, 0.18],     # +500%
]

DEPLOY_THRESHOLDS = [-25, -35, -50]
DEPLOY_OPTIONS = [
    [0.15, 0.20, 0.25, 0.30, 0.35],
    [0.25, 0.30, 0.40, 0.45, 0.50],
    [0.50, 0.75, 1.00],
]

def enumerate_trims():
    out = []
    for combo in product(*TRIM_OPTIONS):
        if all(combo[i] < combo[i+1] for i in range(len(combo)-1)):
            out.append(list(zip(TRIM_THRESHOLDS, combo)))
    return out

def enumerate_deploys():
    return [list(zip(DEPLOY_THRESHOLDS, combo)) for combo in product(*DEPLOY_OPTIONS)]

# =============================================================================
# TEST 1 — Production in-sample, all three metrics
# =============================================================================

def test_production_in_sample():
    print("=" * 100)
    print("TEST 1 — PRODUCTION RULES, IN-SAMPLE (per-cycle breakdown)")
    print("=" * 100)
    print("\n  Trim:   ", PROD_TRIM)
    print("  Deploy: ", PROD_DEPLOY)
    print(f"\n  {'Cycle':<37} | {'DD Red.':>9} | {'Rec. Net':>9} | {'Blended':>9} | {'Cash@Peak':>10}")
    print("  " + "-" * 95)

    dds, recs, blends = [], [], []
    for bull, bear in PAIRS:
        r = simulate_pair(bull, bear, PROD_TRIM, PROD_DEPLOY)
        dds.append(r["dd_reduction"])
        recs.append(r["recovery_net"])
        blends.append(r["blended"])
        print(f"  {bull.name:<15} → {bear.name:<19} | "
              f"{r['dd_reduction']*100:>+7.2f}%  | {r['recovery_net']*100:>+7.2f}%  | "
              f"{r['blended']*100:>+7.2f}%  | {r['cash_at_peak']*100:>8.1f}%")
    print("  " + "-" * 95)
    print(f"  {'MEAN':<37} | {np.mean(dds)*100:>+7.2f}%  | {np.mean(recs)*100:>+7.2f}%  | "
          f"{np.mean(blends)*100:>+7.2f}%  |")
    print(f"  {'MEDIAN':<37} | {np.median(dds)*100:>+7.2f}%  | {np.median(recs)*100:>+7.2f}%  | "
          f"{np.median(blends)*100:>+7.2f}%  |")
    print(f"  {'WORST':<37} | {min(dds)*100:>+7.2f}%  | {min(recs)*100:>+7.2f}%  | "
          f"{min(blends)*100:>+7.2f}%  |")
    print(f"  {'% POSITIVE':<37} | {sum(1 for n in dds if n>0)/len(dds)*100:>7.0f}%  | "
          f"{sum(1 for n in recs if n>0)/len(recs)*100:>7.0f}%  | "
          f"{sum(1 for n in blends if n>0)/len(blends)*100:>7.0f}%  |")

    print("\n  KEY: DD Red. = drawdown protection at bear bottom (always ≥0 for any cash position)")
    print("       Rec. Net = net portfolio value at recovery vs buy-and-hold (the 'did it pay' test)")
    print("       Blended = 50/50 of the two — risk-aware composite score\n")
    return dds, recs, blends

# =============================================================================
# TEST 2 — Walk-forward expanding window, scored on RECOVERY_NET
# =============================================================================

def test_walk_forward(metric="recovery_net"):
    print("=" * 100)
    print(f"TEST 2 — WALK-FORWARD VALIDATION (metric: {metric})")
    print("=" * 100)
    print("\n  Expanding window: at each historical bear k≥5, optimize parameters on")
    print("  pairs[0..k-1], then test on held-out pair k. Honest out-of-sample.\n")

    trims = enumerate_trims()
    deploys = enumerate_deploys()
    n_combos = len(trims) * len(deploys)
    print(f"  Grid: {len(trims)} trim × {len(deploys)} deploy = {n_combos:,} combos per fold")

    print(f"\n  {'Held-Out Cycle':<37} | {'WF-Opt':>9} | {'Prod':>9} | {'Δ (WF-Prod)':>12}")
    print("  " + "-" * 80)

    wf_oos, prod_oos, deltas = [], [], []
    prod_top_decile_hits = 0
    wf_params_history = []

    for k in range(5, len(PAIRS) + 1):
        train = PAIRS[:k-1]
        test_pair = PAIRS[k-1]

        # Optimize on training fold
        best_score = -1e9
        best_trim, best_deploy = None, None
        all_scores = []
        for t in trims:
            for d in deploys:
                s = score(simulate(train, t, d, metric))
                all_scores.append(s)
                if s > best_score:
                    best_score = s; best_trim = t; best_deploy = d
        wf_params_history.append((test_pair[1].name, best_trim, best_deploy))

        # Production's rank on the training fold
        prod_train_score = score(simulate(train, PROD_TRIM, PROD_DEPLOY, metric))
        better_than_prod = sum(1 for s in all_scores if s > prod_train_score)
        prod_pct_rank = better_than_prod / len(all_scores)
        if prod_pct_rank <= 0.10:
            prod_top_decile_hits += 1

        wf_net = simulate_pair(*test_pair, best_trim, best_deploy)[metric]
        prod_net = simulate_pair(*test_pair, PROD_TRIM, PROD_DEPLOY)[metric]
        wf_oos.append(wf_net); prod_oos.append(prod_net); deltas.append(wf_net - prod_net)

        bull, bear = test_pair
        print(f"  {bull.name:<15} → {bear.name:<19} | "
              f"{wf_net*100:>+7.2f}%  | {prod_net*100:>+7.2f}%  | "
              f"{(wf_net-prod_net)*100:>+10.2f}%")

    print("  " + "-" * 80)
    print(f"  {'MEAN':<37} | {np.mean(wf_oos)*100:>+7.2f}%  | "
          f"{np.mean(prod_oos)*100:>+7.2f}%  | {np.mean(deltas)*100:>+10.2f}%")
    print(f"  {'MEDIAN':<37} | {np.median(wf_oos)*100:>+7.2f}%  | "
          f"{np.median(prod_oos)*100:>+7.2f}%  | {np.median(deltas)*100:>+10.2f}%")
    n_folds = len(PAIRS) - 4
    print(f"\n  Production in TOP DECILE of training grid: {prod_top_decile_hits}/{n_folds} folds "
          f"({prod_top_decile_hits/n_folds*100:.0f}%)")
    print(f"  Production OOS POSITIVE: {sum(1 for n in prod_oos if n > 0)}/{len(prod_oos)} held-out bears "
          f"({sum(1 for n in prod_oos if n > 0)/len(prod_oos)*100:.0f}%)")
    print(f"  WF-Opt OOS POSITIVE:     {sum(1 for n in wf_oos if n > 0)}/{len(wf_oos)} held-out bears "
          f"({sum(1 for n in wf_oos if n > 0)/len(wf_oos)*100:.0f}%)")

    print(f"\n  WF-chosen parameters per fold (held-out bear → best trim cumulative cash, best deploy):")
    for name, t, d in wf_params_history:
        trim_str = "/".join(f"{c*100:.0f}" for _, c in t)
        deploy_str = "/".join(f"{c*100:.0f}" for _, c in d)
        print(f"    {name:<22} trim {trim_str}  deploy {deploy_str}")

    return prod_oos, wf_oos

# =============================================================================
# TEST 3 — Parameter sensitivity around production
# =============================================================================

def test_sensitivity(metric="recovery_net"):
    print("\n" + "=" * 100)
    print(f"TEST 3 — PARAMETER SENSITIVITY (metric: {metric})")
    print("=" * 100)
    print("\n  Perturb one parameter at a time; observe mean impact.")
    print("  Flat surface = production parameters are robust.\n")

    base = np.mean(simulate(PAIRS, PROD_TRIM, PROD_DEPLOY, metric))
    print(f"  Baseline production mean ({metric}): {base*100:+.3f}%\n")

    print("  --- Trim tier perturbations ---")
    print(f"  {'Tier':>7} | {'Orig':>8} | {'Pert':>8} | {'New Mean':>10} | {'Δ vs Base':>10}")
    print("  " + "-" * 60)
    for i, (thr, cash) in enumerate(PROD_TRIM):
        for delta in [-0.02, -0.01, +0.01, +0.02]:
            new_cash = cash + delta
            if new_cash < 0: continue
            trim = list(PROD_TRIM); trim[i] = (thr, new_cash)
            if not all(trim[j][1] < trim[j+1][1] for j in range(len(trim)-1)): continue
            m = np.mean(simulate(PAIRS, trim, PROD_DEPLOY, metric))
            print(f"  +{thr:>4}%  | {cash*100:>7.0f}% | {new_cash*100:>7.0f}% | "
                  f"{m*100:>+9.3f}% | {(m-base)*100:>+9.3f}%")

    print("\n  --- Deploy tranche perturbations ---")
    print(f"  {'Tier':>7} | {'Orig':>8} | {'Pert':>8} | {'New Mean':>10} | {'Δ vs Base':>10}")
    print("  " + "-" * 60)
    for i, (thr, frac) in enumerate(PROD_DEPLOY):
        for delta in [-0.10, -0.05, +0.05, +0.10]:
            new_frac = frac + delta
            if new_frac < 0 or new_frac > 1.5: continue
            deploy = list(PROD_DEPLOY); deploy[i] = (thr, new_frac)
            m = np.mean(simulate(PAIRS, PROD_TRIM, deploy, metric))
            print(f"  {thr:>5}%  | {frac*100:>7.0f}% | {new_frac*100:>7.0f}% | "
                  f"{m*100:>+9.3f}% | {(m-base)*100:>+9.3f}%")

# =============================================================================
# TEST 4 — Bootstrap confidence interval
# =============================================================================

def test_bootstrap(metric="recovery_net", n_sims=10_000, seed=42):
    print("\n" + "=" * 100)
    print(f"TEST 4 — BOOTSTRAP CI ({n_sims:,} draws, metric: {metric})")
    print("=" * 100)
    print(f"\n  Resample 14 pairs with replacement, simulate production rules,")
    print(f"  report distribution of mean {metric}.\n")

    rng = np.random.default_rng(seed)
    means = np.empty(n_sims)
    for s in range(n_sims):
        idx = rng.integers(0, len(PAIRS), size=len(PAIRS))
        sample = [PAIRS[i] for i in idx]
        nets = simulate(sample, PROD_TRIM, PROD_DEPLOY, metric)
        means[s] = np.mean(nets)

    pct = lambda p: np.percentile(means, p) * 100
    print(f"  Mean {metric} (distribution across resamples):")
    print(f"     5th: {pct(5):+.2f}%")
    print(f"    25th: {pct(25):+.2f}%")
    print(f"    50th: {pct(50):+.2f}%  (median)")
    print(f"    75th: {pct(75):+.2f}%")
    print(f"    95th: {pct(95):+.2f}%")
    print(f"\n  P(mean > 0):   {(means > 0).mean()*100:.1f}%")
    print(f"  P(mean > 1%):  {(means > 0.01).mean()*100:.1f}%")
    print(f"  P(mean > 3%):  {(means > 0.03).mean()*100:.1f}%")
    print(f"  P(mean > 5%):  {(means > 0.05).mean()*100:.1f}%")
    return means

# =============================================================================
# MAIN — run all tests for both DD reduction and recovery net
# =============================================================================

def main():
    dds, recs, blends = test_production_in_sample()

    print("\n" + "#" * 100)
    print("# METRIC: RECOVERY_NET — did the strategy beat buy-and-hold at peak recovery?")
    print("#" * 100 + "\n")
    prod_oos_r, wf_oos_r = test_walk_forward("recovery_net")
    test_sensitivity("recovery_net")
    means_r = test_bootstrap("recovery_net")

    print("\n" + "#" * 100)
    print("# METRIC: DD_REDUCTION — how much drawdown protection did clients experience at the bottom?")
    print("#" * 100 + "\n")
    prod_oos_d, wf_oos_d = test_walk_forward("dd_reduction")
    means_d = test_bootstrap("dd_reduction")

    print("\n" + "=" * 100)
    print("FINAL CONFIDENCE SUMMARY")
    print("=" * 100)

    def confidence_block(label, in_sample_mean, oos_mean, ci_5, ci_50, ci_95, p_pos):
        print(f"\n  {label}")
        print(f"    In-sample mean:     {in_sample_mean*100:+.2f}%")
        print(f"    Walk-forward mean:  {oos_mean*100:+.2f}%")
        print(f"    Bootstrap 5/50/95:  {ci_5:+.2f}% / {ci_50:+.2f}% / {ci_95:+.2f}%")
        print(f"    P(mean > 0):        {p_pos*100:.1f}%")

    confidence_block(
        "DRAWDOWN REDUCTION (at bear bottom)",
        np.mean(dds), np.mean(prod_oos_d),
        np.percentile(means_d, 5)*100, np.percentile(means_d, 50)*100, np.percentile(means_d, 95)*100,
        (means_d > 0).mean()
    )
    confidence_block(
        "RECOVERY NET (at peak recovery, vs B&H)",
        np.mean(recs), np.mean(prod_oos_r),
        np.percentile(means_r, 5)*100, np.percentile(means_r, 50)*100, np.percentile(means_r, 95)*100,
        (means_r > 0).mean()
    )

if __name__ == "__main__":
    main()
