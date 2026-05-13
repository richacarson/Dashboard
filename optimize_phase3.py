#!/usr/bin/env python3
"""
Phase 3: Final optimization around the two best strategy families.

Key insights from Phase 2:
1. AgeGate48 + trig=[100,200,300,400] + cash=[2,4,6,8] + d=[15/50,30/100]
   → +4.7 bps CAGR alpha, 0.5pp DD reduction, 64% win rate
2. 2Tier trig=[200,400] cash=[3,8] d=[15/50,30/100]
   → +4.5 bps CAGR alpha, 0.4pp DD reduction, but worst cycle only -0.61%!

The constraint gap: 1pp DD reduction is hard because:
- To get DD reduction, you need cash at the peak (before the bear)
- To avoid cash drag, you need to minimize cash during the bull
- These are fundamentally opposed

Strategy: Push the age gate higher, increase cash levels, test more
aggressive deploy to see if we can cross 1pp DD reduction while
keeping alpha positive.

Also: test variations of the 2-tier approach which showed remarkable
consistency (worst cycle only -0.61%).
"""

import math
from typing import List, Optional, Tuple


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

            if (decay_mo is not None and last_trim_month is not None and
                (bull_age - last_trim_month) >= decay_mo and strat_cash > 0):
                redeploy = strat_cash * decay_pct / 100.0
                strat_equity += redeploy
                strat_cash -= redeploy
                last_trim_month = None
                t_idx = 0
                achievable_trims = [(g, c_) for g, c_ in trim_tiers if total_bull >= g]

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
    print("PHASE 3: FINAL OPTIMIZATION")
    print("=" * 130)

    all_results = []

    # ═══════════════════════════════════════════════════════════════════════
    # FAMILY A: Age-gated with higher cash levels
    # Push age gate to 36-60, test cash up to 10%, vary deploy aggressiveness
    # ═══════════════════════════════════════════════════════════════════════
    print("\n>>> FAMILY A: Age-gated strategies (pushing for higher DD reduction) <<<")

    for age in [36, 40, 44, 48, 52, 56, 60]:
        for trig1 in [80, 100, 120]:
            for trig4 in [350, 400, 450]:
                trig2 = round(trig1 + (trig4 - trig1) / 3)
                trig3 = round(trig1 + 2 * (trig4 - trig1) / 3)
                for max_cash in [6, 7, 8, 9, 10, 12]:
                    c1 = max_cash * 0.25
                    c2 = max_cash * 0.50
                    c3 = max_cash * 0.75
                    c4 = max_cash
                    trims = [(trig1/100, c1/100), (trig2/100, c2/100),
                             (trig3/100, c3/100), (trig4/100, c4/100)]
                    # Deploy configs
                    for deploy_config in [
                        [(0.10, 0.50), (0.20, 1.00)],
                        [(0.12, 0.50), (0.25, 1.00)],
                        [(0.15, 0.50), (0.30, 1.00)],
                        [(0.10, 1.00)],  # all-in at -10%
                        [(0.12, 1.00)],
                        [(0.15, 1.00)],
                        [(0.10, 0.40), (0.20, 0.40), (0.30, 0.20)],
                        [(0.15, 0.30), (0.25, 0.30), (0.35, 0.40)],
                    ]:
                        bt = simulate(trims, deploy_config, age_gate=age)
                        name = f"AG{age} trig=[{trig1},{trig2},{trig3},{trig4}] cash_max={max_cash}% d={deploy_config}"
                        bt['name'] = name
                        all_results.append(bt)

    # ═══════════════════════════════════════════════════════════════════════
    # FAMILY B: 2-tier (simplest) with fine-grained parameters
    # ═══════════════════════════════════════════════════════════════════════
    print("\n>>> FAMILY B: 2-tier (simplest, most consistent) <<<")

    for trig1 in range(150, 301, 10):
        for trig2 in range(max(trig1 + 50, 300), 501, 25):
            for c1 in [1.5, 2, 2.5, 3, 3.5, 4]:
                for c2 in [5, 6, 7, 8, 9, 10]:
                    if c2 <= c1: continue
                    trims = [(trig1/100, c1/100), (trig2/100, c2/100)]
                    for d_config in [
                        [(0.10, 0.50), (0.20, 1.00)],
                        [(0.12, 0.50), (0.25, 1.00)],
                        [(0.15, 0.50), (0.30, 1.00)],
                        [(0.10, 1.00)],
                        [(0.12, 1.00)],
                        [(0.15, 1.00)],
                    ]:
                        bt = simulate(trims, d_config)
                        name = f"2T trig=[{trig1},{trig2}] cash=[{c1},{c2}] d={d_config}"
                        bt['name'] = name
                        all_results.append(bt)

    # ═══════════════════════════════════════════════════════════════════════
    # FAMILY C: Age-gated 2-tier
    # ═══════════════════════════════════════════════════════════════════════
    print("\n>>> FAMILY C: Age-gated 2-tier <<<")

    for age in [36, 42, 48, 54, 60]:
        for trig1 in [80, 100, 120, 150]:
            for trig2 in [250, 300, 350, 400]:
                if trig2 <= trig1 + 50: continue
                for c1 in [2, 3, 4, 5]:
                    for c2 in [6, 7, 8, 9, 10]:
                        if c2 <= c1: continue
                        trims = [(trig1/100, c1/100), (trig2/100, c2/100)]
                        for d_config in [
                            [(0.10, 0.50), (0.20, 1.00)],
                            [(0.12, 0.50), (0.25, 1.00)],
                            [(0.15, 0.50), (0.30, 1.00)],
                            [(0.10, 1.00)],
                            [(0.15, 1.00)],
                        ]:
                            bt = simulate(trims, d_config, age_gate=age)
                            name = f"AG{age}-2T trig=[{trig1},{trig2}] cash=[{c1},{c2}] d={d_config}"
                            bt['name'] = name
                            all_results.append(bt)

    # ═══════════════════════════════════════════════════════════════════════
    # FAMILY D: Age-gated with time decay (re-deploy if no bear comes)
    # ═══════════════════════════════════════════════════════════════════════
    print("\n>>> FAMILY D: Age-gate + time decay <<<")

    for age in [36, 48, 60]:
        for decay in [18, 24, 30]:
            for trig1 in [80, 100]:
                for trig4 in [350, 400]:
                    trig2 = round(trig1 + (trig4 - trig1) / 3)
                    trig3 = round(trig1 + 2 * (trig4 - trig1) / 3)
                    for max_cash in [8, 10, 12]:
                        c1 = max_cash * 0.25
                        c2 = max_cash * 0.50
                        c3 = max_cash * 0.75
                        c4 = max_cash
                        trims = [(trig1/100, c1/100), (trig2/100, c2/100),
                                 (trig3/100, c3/100), (trig4/100, c4/100)]
                        for d_config in [
                            [(0.10, 0.50), (0.20, 1.00)],
                            [(0.15, 0.50), (0.30, 1.00)],
                            [(0.10, 1.00)],
                        ]:
                            bt = simulate(trims, d_config, age_gate=age, decay_mo=decay)
                            name = f"AG{age}D{decay} trig=[{trig1},{trig2},{trig3},{trig4}] cm={max_cash} d={d_config}"
                            bt['name'] = name
                            all_results.append(bt)

    # ═══════════════════════════════════════════════════════════════════════
    # RANK AND REPORT
    # ═══════════════════════════════════════════════════════════════════════
    print(f"\n\nTotal strategies tested: {len(all_results)}")

    # Filter: positive CAGR alpha AND >= 1pp DD reduction
    best_both = [r for r in all_results if r['cagr_alpha_bps'] > 0 and r['avg_dd_red'] >= 1.0]
    print(f"\nStrategies with CAGR alpha > 0 AND DD reduction >= 1pp: {len(best_both)}")

    if best_both:
        best_both.sort(key=lambda x: x['cagr_alpha_bps'], reverse=True)
        print(f"\n{'='*140}")
        print(f"STRATEGIES MEETING BOTH CRITERIA (positive alpha + >=1pp DD reduction)")
        print(f"{'='*140}")
        print(f"{'Rank':>4}  {'CAGRbps':>8}  {'AvgAlpha':>9}  {'AvgDDR':>7}  {'WR':>5}  {'Worst':>8}  {'Name'}")
        print("-" * 140)
        for i, r in enumerate(best_both[:20]):
            print(f"{i+1:>4}  {r['cagr_alpha_bps']:>+7.1f}  {r['avg_alpha']:>+8.3f}%  "
                  f"{r['avg_dd_red']:>+6.1f}pp  {r['win_rate']:>4.0%}  {r['worst_alpha']:>+7.2f}%  {r['name']}")

        print(f"\n\n{'#'*140}")
        print(f"  THE WINNER: POSITIVE ALPHA + >= 1pp DD REDUCTION")
        print(f"{'#'*140}")
        print_detail(best_both[0], best_both[0]['name'])

    # Also show best overall (highest score = alpha * DD_red)
    scored = []
    for r in all_results:
        if r['cagr_alpha_bps'] > 0 and r['avg_dd_red'] > 0:
            score = r['cagr_alpha_bps'] * r['avg_dd_red']
            scored.append((r, score))
    scored.sort(key=lambda x: x[1], reverse=True)

    print(f"\n\n{'='*140}")
    print(f"TOP 20 BY BALANCED SCORE (CAGR_alpha * DD_reduction)")
    print(f"{'='*140}")
    print(f"{'Rank':>4}  {'CAGRbps':>8}  {'AvgDDR':>7}  {'Score':>8}  {'WR':>5}  {'Worst':>8}  {'AvgAlpha':>9}  {'Name'}")
    print("-" * 140)
    for i, (r, score) in enumerate(scored[:20]):
        print(f"{i+1:>4}  {r['cagr_alpha_bps']:>+7.1f}  {r['avg_dd_red']:>+6.1f}pp  {score:>7.1f}  "
              f"{r['win_rate']:>4.0%}  {r['worst_alpha']:>+7.2f}%  {r['avg_alpha']:>+8.3f}%  {r['name']}")

    print(f"\n\n{'#'*140}")
    print(f"  OVERALL BEST (highest balanced score)")
    print(f"{'#'*140}")
    if scored:
        print_detail(scored[0][0], scored[0][0]['name'])

    # Show top 3 in full detail
    print(f"\n\n{'='*140}")
    print(f"TOP 3 DETAILED")
    print(f"{'='*140}")
    for i, (r, score) in enumerate(scored[:3]):
        print_detail(r, f"RANK #{i+1}: {r['name']}")

    # Comparative analysis: Baseline vs Top Strategy
    print(f"\n\n{'='*140}")
    print(f"COMPARISON: BASELINE vs RECOMMENDED STRATEGY")
    print(f"{'='*140}")

    baseline = simulate(
        [(0.80, 0.02), (1.20, 0.05), (1.75, 0.08), (2.50, 0.12)],
        [(0.20, 0.20), (0.30, 0.30), (0.40, 0.50)],
    )
    baseline['name'] = "BASELINE"
    print_detail(baseline, "BASELINE (Current Rules)")

    if scored:
        winner = scored[0][0]
        print_detail(winner, f"RECOMMENDED: {winner['name']}")

        print(f"\n\n{'='*100}")
        print(f"SIDE-BY-SIDE COMPARISON")
        print(f"{'='*100}")
        print(f"{'Metric':<30} {'Baseline':>20} {'Recommended':>20} {'Delta':>15}")
        print("-" * 100)
        print(f"{'CAGR Alpha (bps/yr)':<30} {baseline['cagr_alpha_bps']:>+20.1f} {winner['cagr_alpha_bps']:>+20.1f} {winner['cagr_alpha_bps']-baseline['cagr_alpha_bps']:>+15.1f}")
        print(f"{'Avg Alpha (% per cycle)':<30} {baseline['avg_alpha']:>+20.3f} {winner['avg_alpha']:>+20.3f} {winner['avg_alpha']-baseline['avg_alpha']:>+15.3f}")
        print(f"{'Avg DD Reduction (pp)':<30} {baseline['avg_dd_red']:>+20.1f} {winner['avg_dd_red']:>+20.1f} {winner['avg_dd_red']-baseline['avg_dd_red']:>+15.1f}")
        print(f"{'Win Rate':<30} {baseline['win_rate']:>19.0%} {winner['win_rate']:>19.0%} {''}")
        print(f"{'Worst Cycle Alpha':<30} {baseline['worst_alpha']:>+20.2f} {winner['worst_alpha']:>+20.2f} {winner['worst_alpha']-baseline['worst_alpha']:>+15.2f}")
        print(f"{'Strategy CAGR':<30} {baseline['strat_cagr']:>20.4f} {winner['strat_cagr']:>20.4f} {winner['strat_cagr']-baseline['strat_cagr']:>+15.4f}")
        print(f"{'Terminal Wealth ($1M start)':<30} ${baseline['strat_final']:>19,.0f} ${winner['strat_final']:>19,.0f} ${winner['strat_final']-baseline['strat_final']:>14,.0f}")

        print(f"\n  Cycle-by-cycle comparison:")
        print(f"  {'#':>2}  {'Cycle':<30}  {'Base Alpha':>10}  {'New Alpha':>10}  {'Base DDR':>8}  {'New DDR':>8}")
        print("  " + "-" * 80)
        for i in range(14):
            b = baseline['results'][i]
            w = winner['results'][i]
            cycle = f"{b['bull']} / {b['bear']}"
            print(f"  {i+1:>2}  {cycle:<30}  {b['alpha']:>+9.2f}%  {w['alpha']:>+9.2f}%  {b['dd_red']:>+7.1f}  {w['dd_red']:>+7.1f}")
