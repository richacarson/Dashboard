#!/usr/bin/env python3
"""
Phase 2 Optimization: Fine-tuned search around the best-performing parameter space.

Key findings from Phase 1:
- High trim triggers (150%+) dramatically reduce cash drag on long bulls
- The top strategy: trig=[150,200,300,400] cash=[1.5,3,4.5,6] deploy=[15/50,25/100]
  produces +1.4 bps/yr CAGR alpha but only 0.4pp DD reduction
- Need to explore ways to boost DD reduction without sacrificing alpha

Phase 2 strategies:
1. Fine-grid around the winning parameter space
2. 3-tier deployment to capture more DD reduction
3. Lower deploy triggers (deploy earlier, buy more discount)
4. Different trim trigger profiles (not just proportional)
5. Combine time decay with high thresholds
6. "Late trim, early deploy" - the ideal asymmetry
"""

import math
from typing import List, Optional, Tuple

# =============================================================================
# RISK-FREE RATES
# =============================================================================
def get_rf(year):
    if year <= 1940: return 0.005
    elif year <= 1950: return 0.01
    elif year <= 1960: return 0.025
    elif year <= 1969: return 0.04
    elif year <= 1979: return 0.06
    elif year <= 1989: return 0.08
    elif year <= 1999: return 0.05
    elif year <= 2007: return 0.03
    elif year <= 2015: return 0.005
    elif year <= 2019: return 0.02
    elif year <= 2021: return 0.001
    else: return 0.05

def monthly_rf(year):
    return (1 + get_rf(year)) ** (1/12) - 1

# =============================================================================
# CYCLE DATA
# =============================================================================
CYCLES = [
    ("1932-1937", 324.8, 57.0, "1937-38 Recession", 54.5, 12.8, 95.6, 1932, 1937, 1938),
    ("1938-1940", 62.2, 7.3, "WWII", 34.5, 17.6, 25.2, 1938, 1940, 1942),
    ("1942-1946", 157.7, 49.0, "Post-WWII", 28.8, 11.6, 39.5, 1942, 1946, 1947),
    ("1947-1956", 267.0, 86.0, "Eisenhower", 21.6, 14.7, 11.0, 1947, 1956, 1957),
    ("1957-1961", 86.3, 49.7, "Kennedy Slide", 28.0, 6.5, 14.3, 1957, 1961, 1962),
    ("1962-1966", 79.8, 43.5, "Credit Crunch", 22.2, 7.9, 6.9, 1962, 1966, 1966),
    ("1966-1968", 48.0, 25.7, "Vietnam", 36.1, 17.9, 21.4, 1966, 1968, 1970),
    ("1970-1973", 73.5, 31.5, "OPEC", 48.2, 20.7, 69.5, 1970, 1973, 1974),
    ("1974-1980", 125.6, 73.9, "Volcker", 27.1, 20.5, 2.8, 1974, 1980, 1982),
    ("1982-1987", 228.8, 60.4, "Black Monday", 33.5, 3.3, 19.7, 1982, 1987, 1987),
    ("1987-2000", 582.0, 147.6, "Dot-Com", 49.1, 30.5, 55.6, 1987, 2000, 2002),
    ("2002-2007", 101.5, 60.0, "GFC", 56.8, 17.0, 48.8, 2002, 2007, 2009),
    ("2009-2020", 400.5, 131.4, "COVID", 33.9, 1.1, 4.9, 2009, 2020, 2020),
    ("2020-2022", 114.4, 21.3, "2022 Inflation", 25.4, 9.3, 15.3, 2020, 2022, 2022),
]


def simulate(trim_tiers, deploy_tiers, age_gate=0, decay_mo=None, decay_pct=100):
    """
    Run strategy across all 14 cycles.
    trim_tiers: list of (gain_threshold_frac, cash_target_frac) e.g. (1.5, 0.015)
    deploy_tiers: list of (dd_threshold_frac, deploy_frac_of_initial_cash) e.g. (0.15, 0.5)
    """
    INITIAL = 1_000_000.0
    strat_value = INITIAL
    bench_value = INITIAL
    cycle_results = []

    for c in CYCLES:
        (bull_name, bull_gain_pct, bull_months,
         bear_name, bear_dd_pct, bear_months, recovery_months,
         bull_start_yr, bear_peak_yr, bear_trough_yr) = c

        strat_equity = strat_value
        strat_cash = 0.0
        cycle_start_strat = strat_equity
        cycle_start_bench = bench_value

        # BULL PHASE
        total_bull = bull_gain_pct / 100.0
        n_bull = max(1, round(bull_months))
        m_eq_ret = (1 + total_bull) ** (1/n_bull) - 1
        bull_mid_yr = bull_start_yr + int(bull_months / 24)
        rf_m = monthly_rf(bull_mid_yr)

        market_from_trough = 1.0
        t_idx = 0
        achievable_trims = [(g, c_) for g, c_ in trim_tiers if total_bull >= g]
        last_trim_month = None

        for month in range(n_bull):
            strat_equity *= (1 + m_eq_ret)
            ci = strat_cash * rf_m
            strat_cash += ci
            market_from_trough *= (1 + m_eq_ret)
            gain = market_from_trough - 1.0
            bull_age = month + 1

            # Time decay
            if (decay_mo is not None and last_trim_month is not None and
                (bull_age - last_trim_month) >= decay_mo and strat_cash > 0):
                redeploy = strat_cash * decay_pct / 100.0
                strat_equity += redeploy
                strat_cash -= redeploy
                last_trim_month = None
                t_idx = 0
                achievable_trims = [(g, c_) for g, c_ in trim_tiers if total_bull >= g]

            # Trim triggers
            while t_idx < len(achievable_trims):
                g_thresh, cum_cash = achievable_trims[t_idx]
                if gain >= g_thresh:
                    if bull_age >= age_gate:
                        total_port = strat_equity + strat_cash
                        target_cash = total_port * cum_cash
                        if target_cash > strat_cash:
                            trim = target_cash - strat_cash
                            strat_equity -= trim
                            strat_cash += trim
                        last_trim_month = bull_age
                    t_idx += 1
                else:
                    break

        bench_value *= (1 + total_bull)
        strat_after_bull = strat_equity + strat_cash
        cash_pct_peak = strat_cash / strat_after_bull * 100 if strat_after_bull > 0 else 0

        # BEAR PHASE
        drawdown = bear_dd_pct / 100.0
        n_bear = max(1, round(bear_months))
        trough_level = 1.0 - drawdown
        m_decline = trough_level ** (1/n_bear) - 1 if trough_level > 0 else -0.5
        rf_bear = monthly_rf(bear_peak_yr)

        strat_pre_bear = strat_equity + strat_cash
        initial_cash_reserves = strat_cash
        mkt = 1.0
        d_idx = 0
        achievable_deploys = [(d, p) for d, p in deploy_tiers if drawdown >= d]
        strat_max_dd = 0.0

        for month in range(n_bear):
            mkt *= (1 + m_decline)
            strat_equity *= (1 + m_decline)
            ci = strat_cash * rf_bear
            strat_cash += ci
            current_dd = 1.0 - mkt

            while d_idx < len(achievable_deploys):
                dd_thresh, deploy_frac = achievable_deploys[d_idx]
                if current_dd >= dd_thresh:
                    amt = initial_cash_reserves * deploy_frac
                    amt = min(amt, strat_cash)
                    if amt > 0:
                        strat_equity += amt
                        strat_cash -= amt
                    d_idx += 1
                else:
                    break

            dd_s = 1.0 - (strat_equity + strat_cash) / strat_pre_bear
            strat_max_dd = max(strat_max_dd, dd_s)

        # RECOVERY PHASE
        n_rec = max(1, round(recovery_months))
        rf_rec = monthly_rf(bear_trough_yr)
        if 0 < trough_level < 1.0:
            m_rec = (1.0 / trough_level) ** (1/n_rec) - 1
        else:
            m_rec = 0

        for month in range(n_rec):
            strat_equity *= (1 + m_rec)
            ci = strat_cash * rf_rec
            strat_cash += ci

        # RESET
        strat_equity += strat_cash
        strat_cash = 0.0
        strat_value = strat_equity

        strat_cycle_ret = (strat_value / cycle_start_strat - 1) * 100
        bench_cycle_ret = (bench_value / cycle_start_bench - 1) * 100
        cycle_alpha = strat_cycle_ret - bench_cycle_ret

        cycle_results.append({
            'bull': bull_name,
            'bear': bear_name,
            'bull_gain': bull_gain_pct,
            'bear_dd': -bear_dd_pct,
            'bull_months': bull_months,
            'cash_pct': cash_pct_peak,
            'strat_ret': strat_cycle_ret,
            'bench_ret': bench_cycle_ret,
            'alpha': cycle_alpha,
            'strat_dd': strat_max_dd * 100,
            'bench_dd': bear_dd_pct,
            'dd_red': bear_dd_pct - strat_max_dd * 100,
        })

    alphas = [r['alpha'] for r in cycle_results]
    dd_reds = [r['dd_red'] for r in cycle_results]
    n = len(alphas)

    strat_final = strat_value
    bench_final = bench_value
    total_years = 92.0
    strat_cagr = (strat_final / 1_000_000) ** (1/total_years) - 1
    bench_cagr = (bench_final / 1_000_000) ** (1/total_years) - 1

    return {
        'results': cycle_results,
        'avg_alpha': sum(alphas) / n,
        'sum_alpha': sum(alphas),
        'avg_dd_red': sum(dd_reds) / n,
        'win_rate': sum(1 for a in alphas if a > 0) / n,
        'wins': sum(1 for a in alphas if a > 0),
        'cagr_alpha_bps': (strat_cagr - bench_cagr) * 10000,
        'strat_cagr': strat_cagr * 100,
        'bench_cagr': bench_cagr * 100,
        'worst_alpha': min(alphas),
        'best_alpha': max(alphas),
        'strat_final': strat_final,
        'bench_final': bench_final,
    }


def print_detail(bt, name):
    print(f"\n{'='*130}")
    print(f"STRATEGY: {name}")
    print(f"{'='*130}")
    print(f"\n{'#':>2}  {'Bull':<14}  {'Bear':<18}  {'Bull%':>6}  {'Bear%':>6}  {'Cash%':>5}  "
          f"{'StratRet':>9}  {'B&HRet':>9}  {'Alpha':>8}  {'SDD':>6}  {'BDD':>6}  {'DDR':>5}")
    print("-" * 130)

    for i, r in enumerate(bt['results']):
        print(f"{i+1:>2}  {r['bull']:<14}  {r['bear']:<18}  "
              f"{r['bull_gain']:>+6.1f}  {r['bear_dd']:>+6.1f}  {r['cash_pct']:>4.1f}%  "
              f"{r['strat_ret']:>+8.2f}%  {r['bench_ret']:>+8.2f}%  {r['alpha']:>+7.2f}%  "
              f"{r['strat_dd']:>5.1f}%  {r['bench_dd']:>5.1f}%  {r['dd_red']:>+4.1f}")
    print("-" * 130)
    print(f"  Avg Alpha:        {bt['avg_alpha']:>+.3f}%  |  CAGR Alpha: {bt['cagr_alpha_bps']:>+.1f} bps/yr")
    print(f"  Avg DD Reduction: {bt['avg_dd_red']:>+.1f} pp  |  Win Rate: {bt['wins']}/14 ({bt['win_rate']:.0%})")
    print(f"  Worst Cycle:      {bt['worst_alpha']:>+.2f}%  |  Best Cycle: {bt['best_alpha']:>+.2f}%")
    print(f"  Strat CAGR:       {bt['strat_cagr']:.4f}%  |  B&H CAGR: {bt['bench_cagr']:.4f}%")
    print(f"  Terminal ($1M):   Strat ${bt['strat_final']:>,.0f}  |  B&H ${bt['bench_final']:>,.0f}")


if __name__ == "__main__":
    print("=" * 130)
    print("PHASE 2: FINE-GRAINED OPTIMIZATION")
    print("=" * 130)

    all_results = []

    # ═══════════════════════════════════════════════════════════════════════
    # SEARCH SPACE 1: Fine grid around winning parameters
    # Best from Phase 1: trig=[150,200,300,400] cash=[1.5,3,4.5,6] deploy=[15/50,25/100]
    # ═══════════════════════════════════════════════════════════════════════
    print("\n>>> SEARCH 1: Fine grid around Phase 1 winner <<<")

    for trig1 in [120, 130, 140, 150, 160]:
        for trig2 in [175, 200, 225]:
            if trig2 <= trig1: continue
            for trig3 in [250, 275, 300, 350]:
                if trig3 <= trig2: continue
                for trig4 in [350, 400, 450, 500]:
                    if trig4 <= trig3: continue
                    for max_cash in [4, 5, 6, 7, 8]:
                        # Proportional cash levels
                        c1 = max_cash * 0.25
                        c2 = max_cash * 0.50
                        c3 = max_cash * 0.75
                        c4 = max_cash
                        trims = [(trig1/100, c1/100), (trig2/100, c2/100),
                                 (trig3/100, c3/100), (trig4/100, c4/100)]
                        # Test multiple deploy configs
                        for d1_t in [10, 12, 15]:
                            for d1_p in [40, 50, 60]:
                                for d2_t in [20, 25]:
                                    deploys = [(d1_t/100, d1_p/100), (d2_t/100, 1.0)]
                                    bt = simulate(trims, deploys)
                                    name = f"trig=[{trig1},{trig2},{trig3},{trig4}] cash=[{c1},{c2},{c3},{c4}] d=[{d1_t}/{d1_p},{d2_t}/100]"
                                    bt['name'] = name
                                    all_results.append(bt)

    # ═══════════════════════════════════════════════════════════════════════
    # SEARCH SPACE 2: 3-tier deployment (more DD reduction)
    # ═══════════════════════════════════════════════════════════════════════
    print("\n>>> SEARCH 2: 3-tier deployment <<<")

    for trig1 in [130, 150, 175]:
        for trig3 in [275, 300, 350]:
            if trig3 <= trig1 + 50: continue
            trig2 = (trig1 + trig3) // 2
            for trig4 in [375, 400, 450]:
                if trig4 <= trig3: continue
                for max_cash in [5, 6, 7, 8]:
                    c1 = max_cash * 0.25
                    c2 = max_cash * 0.50
                    c3 = max_cash * 0.75
                    c4 = max_cash
                    trims = [(trig1/100, c1/100), (trig2/100, c2/100),
                             (trig3/100, c3/100), (trig4/100, c4/100)]
                    # 3-tier deploy: early/mid/deep
                    for d1_t in [10, 12, 15]:
                        for d2_t in [20, 25]:
                            for d3_t in [30, 35, 40]:
                                if d3_t <= d2_t: continue
                                for d1_p in [30, 40, 50]:
                                    for d2_p in [30, 40]:
                                        d3_p_options = [100 - d1_p - d2_p] if d1_p + d2_p < 100 else [30]
                                        for d3_p in d3_p_options:
                                            if d3_p <= 0: continue
                                            # deploy fractions are of INITIAL cash
                                            deploys = [
                                                (d1_t/100, d1_p/100),
                                                (d2_t/100, d2_p/100),
                                                (d3_t/100, d3_p/100),
                                            ]
                                            bt = simulate(trims, deploys)
                                            name = f"3Tier trig=[{trig1},{trig2},{trig3},{trig4}] cash=[{c1:.0f},{c2:.0f},{c3:.0f},{c4:.0f}] d=[{d1_t}/{d1_p},{d2_t}/{d2_p},{d3_t}/{d3_p}]"
                                            bt['name'] = name
                                            all_results.append(bt)

    # ═══════════════════════════════════════════════════════════════════════
    # SEARCH SPACE 3: Very early deploy (all-in at -10 to -15%)
    # Rationale: every bear hits -20%+, so deploying ALL cash at -10-15%
    # maximizes the chance of catching the discount
    # ═══════════════════════════════════════════════════════════════════════
    print("\n>>> SEARCH 3: Early all-in deployment <<<")

    for trig1 in [120, 140, 150, 175, 200]:
        for trig2 in [200, 250, 300]:
            if trig2 <= trig1: continue
            for trig3 in [300, 350, 400]:
                if trig3 <= trig2: continue
                for trig4 in [400, 450, 500]:
                    if trig4 <= trig3: continue
                    for max_cash in [4, 5, 6, 7, 8, 10]:
                        c1 = max_cash * 0.25
                        c2 = max_cash * 0.50
                        c3 = max_cash * 0.75
                        c4 = max_cash
                        trims = [(trig1/100, c1/100), (trig2/100, c2/100),
                                 (trig3/100, c3/100), (trig4/100, c4/100)]
                        # Deploy ALL cash at first trigger
                        for d_trig in [8, 10, 12, 15]:
                            deploys = [(d_trig/100, 1.0)]
                            bt = simulate(trims, deploys)
                            name = f"AllIn trig=[{trig1},{trig2},{trig3},{trig4}] cash=[{c1},{c2},{c3},{c4}] deploy@{d_trig}%"
                            bt['name'] = name
                            all_results.append(bt)

    # ═══════════════════════════════════════════════════════════════════════
    # SEARCH SPACE 4: Non-proportional cash levels
    # Maybe front-load (higher % at lower thresholds) or back-load
    # ═══════════════════════════════════════════════════════════════════════
    print("\n>>> SEARCH 4: Non-proportional cash profiles <<<")

    for trig1 in [120, 150, 175]:
        for trig4 in [350, 400, 450]:
            trig2 = trig1 + (trig4 - trig1) // 3
            trig3 = trig1 + 2 * (trig4 - trig1) // 3
            # Front-loaded: more cash early
            for c1 in [2, 3, 4]:
                for c4 in [c1+1, c1+2, c1+3, c1+4]:
                    c2 = c1 + (c4 - c1) * 0.33
                    c3 = c1 + (c4 - c1) * 0.67
                    trims = [(trig1/100, c1/100), (trig2/100, c2/100),
                             (trig3/100, c3/100), (trig4/100, c4/100)]
                    for d_trig in [10, 12, 15]:
                        deploys = [(d_trig/100, 0.5), (d_trig*1.67/100, 1.0)]
                        bt = simulate(trims, deploys)
                        name = f"FrontLoad trig=[{trig1},{trig2},{trig3},{trig4}] cash=[{c1},{c2:.1f},{c3:.1f},{c4}] d=[{d_trig}/50,{int(d_trig*1.67)}/100]"
                        bt['name'] = name
                        all_results.append(bt)
            # Back-loaded: more cash late (small early, big jump late)
            for c1 in [0.5, 1.0, 1.5]:
                for c4 in [5, 6, 7, 8]:
                    c2 = c1 + (c4 - c1) * 0.2
                    c3 = c1 + (c4 - c1) * 0.5
                    trims = [(trig1/100, c1/100), (trig2/100, c2/100),
                             (trig3/100, c3/100), (trig4/100, c4/100)]
                    for d_trig in [10, 12, 15]:
                        deploys = [(d_trig/100, 0.5), (d_trig*1.67/100, 1.0)]
                        bt = simulate(trims, deploys)
                        name = f"BackLoad trig=[{trig1},{trig2},{trig3},{trig4}] cash=[{c1},{c2:.1f},{c3:.1f},{c4}] d=[{d_trig}/50,{int(d_trig*1.67)}/100]"
                        bt['name'] = name
                        all_results.append(bt)

    # ═══════════════════════════════════════════════════════════════════════
    # SEARCH SPACE 5: Age gate + high thresholds
    # ═══════════════════════════════════════════════════════════════════════
    print("\n>>> SEARCH 5: Age gate + high thresholds <<<")

    for trig1 in [100, 120, 150]:
        for trig4 in [350, 400, 450]:
            trig2 = trig1 + (trig4 - trig1) // 3
            trig3 = trig1 + 2 * (trig4 - trig1) // 3
            for max_cash in [5, 6, 7, 8]:
                c1 = max_cash * 0.25
                c2 = max_cash * 0.50
                c3 = max_cash * 0.75
                c4 = max_cash
                trims = [(trig1/100, c1/100), (trig2/100, c2/100),
                         (trig3/100, c3/100), (trig4/100, c4/100)]
                for age in [24, 36, 48]:
                    for d_trig in [10, 12, 15]:
                        deploys = [(d_trig/100, 0.5), (d_trig*2/100, 1.0)]
                        bt = simulate(trims, deploys, age_gate=age)
                        name = f"AgeGate{age} trig=[{trig1},{trig2},{trig3},{trig4}] cash=[{c1:.0f},{c2:.0f},{c3:.0f},{c4:.0f}] d=[{d_trig}/50,{d_trig*2}/100]"
                        bt['name'] = name
                        all_results.append(bt)

    # ═══════════════════════════════════════════════════════════════════════
    # SEARCH SPACE 6: Time decay + high thresholds
    # ═══════════════════════════════════════════════════════════════════════
    print("\n>>> SEARCH 6: Time decay + high thresholds <<<")

    for trig1 in [120, 150]:
        for trig4 in [350, 400]:
            trig2 = trig1 + (trig4 - trig1) // 3
            trig3 = trig1 + 2 * (trig4 - trig1) // 3
            for max_cash in [5, 6, 7, 8]:
                c1 = max_cash * 0.25
                c2 = max_cash * 0.50
                c3 = max_cash * 0.75
                c4 = max_cash
                trims = [(trig1/100, c1/100), (trig2/100, c2/100),
                         (trig3/100, c3/100), (trig4/100, c4/100)]
                for decay in [18, 24, 30, 36]:
                    for d_trig in [10, 12, 15]:
                        deploys = [(d_trig/100, 0.5), (d_trig*2/100, 1.0)]
                        bt = simulate(trims, deploys, decay_mo=decay)
                        name = f"Decay{decay} trig=[{trig1},{trig2},{trig3},{trig4}] cash=[{c1:.0f},{c2:.0f},{c3:.0f},{c4:.0f}] d=[{d_trig}/50,{d_trig*2}/100]"
                        bt['name'] = name
                        all_results.append(bt)

    # ═══════════════════════════════════════════════════════════════════════
    # SEARCH SPACE 7: Single-tier trim (simplest possible)
    # Just one trim threshold, one deploy threshold
    # ═══════════════════════════════════════════════════════════════════════
    print("\n>>> SEARCH 7: Single-tier strategies <<<")

    for trig in range(50, 401, 10):
        for cash_pct in [1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8]:
            trims = [(trig/100, cash_pct/100)]
            for d_trig in [8, 10, 12, 15, 20]:
                deploys = [(d_trig/100, 1.0)]
                bt = simulate(trims, deploys)
                name = f"Single trig={trig}% cash={cash_pct}% deploy@{d_trig}%"
                bt['name'] = name
                all_results.append(bt)

    # ═══════════════════════════════════════════════════════════════════════
    # SEARCH SPACE 8: Two-tier with variable spacing
    # ═══════════════════════════════════════════════════════════════════════
    print("\n>>> SEARCH 8: Two-tier trim strategies <<<")

    for trig1 in range(80, 201, 20):
        for trig2 in range(trig1 + 50, 501, 50):
            for c1 in [1, 1.5, 2, 3]:
                for c2 in [c1+1, c1+2, c1+3, c1+4, c1+5]:
                    if c2 > 10: continue
                    trims = [(trig1/100, c1/100), (trig2/100, c2/100)]
                    for d_trig in [10, 12, 15]:
                        deploys = [(d_trig/100, 0.5), (d_trig*2/100, 1.0)]
                        bt = simulate(trims, deploys)
                        name = f"2Tier trig=[{trig1},{trig2}] cash=[{c1},{c2}] d=[{d_trig}/50,{d_trig*2}/100]"
                        bt['name'] = name
                        all_results.append(bt)

    # ═══════════════════════════════════════════════════════════════════════
    # RANK AND REPORT
    # ═══════════════════════════════════════════════════════════════════════
    print(f"\n\nTotal strategies tested: {len(all_results)}")

    # Primary filter: positive CAGR alpha
    positive_alpha = [r for r in all_results if r['cagr_alpha_bps'] > 0]
    print(f"Strategies with positive CAGR alpha: {len(positive_alpha)}")

    # Among those, find ones with best DD reduction
    positive_alpha.sort(key=lambda x: (-x['avg_dd_red'], -x['cagr_alpha_bps']))

    print(f"\n{'='*140}")
    print(f"TOP 30 STRATEGIES WITH POSITIVE CAGR ALPHA (sorted by DD reduction, then alpha)")
    print(f"{'='*140}")
    print(f"{'Rank':>4}  {'Strategy':<80}  {'CAGRbps':>8}  {'AvgAlpha':>9}  {'AvgDDR':>7}  {'WR':>5}  {'Worst':>8}")
    print("-" * 140)

    for i, r in enumerate(positive_alpha[:30]):
        print(f"{i+1:>4}  {r['name']:<80}  {r['cagr_alpha_bps']:>+7.1f}  {r['avg_alpha']:>+8.3f}%  "
              f"{r['avg_dd_red']:>+6.1f}pp  {r['win_rate']:>4.0%}  {r['worst_alpha']:>+7.2f}%")

    # Now find the BEST balance: maximize min(cagr_alpha_bps, avg_dd_red)
    # We want both positive and meaningful
    print(f"\n\n{'='*140}")
    print(f"TOP 30 BY SCORE (CAGR_alpha * DD_reduction, both must be positive)")
    print(f"{'='*140}")

    scored = []
    for r in all_results:
        if r['cagr_alpha_bps'] > 0 and r['avg_dd_red'] > 0:
            score = r['cagr_alpha_bps'] * r['avg_dd_red']
            scored.append((r, score))

    scored.sort(key=lambda x: x[1], reverse=True)

    print(f"{'Rank':>4}  {'Strategy':<80}  {'CAGRbps':>8}  {'AvgDDR':>7}  {'Score':>8}  {'WR':>5}  {'Worst':>8}")
    print("-" * 140)

    for i, (r, score) in enumerate(scored[:30]):
        print(f"{i+1:>4}  {r['name']:<80}  {r['cagr_alpha_bps']:>+7.1f}  "
              f"{r['avg_dd_red']:>+6.1f}pp  {score:>7.1f}  {r['win_rate']:>4.0%}  {r['worst_alpha']:>+7.2f}%")

    # Show the SINGLE BEST
    if scored:
        best = scored[0][0]
        print(f"\n\n{'#'*140}")
        print(f"  THE SINGLE BEST STRATEGY")
        print(f"{'#'*140}")
        print_detail(best, best['name'])

    # Also show best with >=1pp DD reduction
    dd_1pp = [r for r in all_results if r['cagr_alpha_bps'] > 0 and r['avg_dd_red'] >= 1.0]
    if dd_1pp:
        dd_1pp.sort(key=lambda x: x['cagr_alpha_bps'], reverse=True)
        print(f"\n\n{'#'*140}")
        print(f"  BEST WITH >= 1pp DD REDUCTION")
        print(f"{'#'*140}")
        print_detail(dd_1pp[0], dd_1pp[0]['name'])
    else:
        print(f"\n\nNo strategy achieves both positive CAGR alpha AND >=1pp DD reduction.")
        # Show best with >= 0.5pp
        dd_05 = [r for r in all_results if r['cagr_alpha_bps'] > 0 and r['avg_dd_red'] >= 0.5]
        if dd_05:
            dd_05.sort(key=lambda x: x['cagr_alpha_bps'], reverse=True)
            print(f"\n  Best with >= 0.5pp DD reduction:")
            print_detail(dd_05[0], dd_05[0]['name'])

    # ═══════════════════════════════════════════════════════════════════════
    # FINAL: Show top 5 with details for the best balanced strategies
    # ═══════════════════════════════════════════════════════════════════════
    print(f"\n\n{'='*140}")
    print(f"TOP 5 BALANCED STRATEGIES - FULL DETAIL")
    print(f"{'='*140}")

    for i, (r, score) in enumerate(scored[:5]):
        print_detail(r, f"#{i+1}: {r['name']}")
