#!/usr/bin/env python3
"""
Final verification and presentation of the winning strategy.
Also tests a few edge variants to see if we can push DD reduction to 1pp
without sacrificing alpha.
"""

import math

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
            'bull': bull_name, 'bear': bear_name,
            'bull_gain': bull_gain_pct, 'bear_dd': -bear_dd_pct,
            'bull_months': bull_months, 'bear_months': bear_months,
            'recovery_months': recovery_months,
            'cash_pct': cash_pct_peak,
            'strat_ret': strat_cycle_ret, 'bench_ret': bench_cycle_ret,
            'alpha': cycle_alpha,
            'strat_dd': strat_max_dd * 100, 'bench_dd': bear_dd_pct,
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
        'avg_alpha': sum(alphas) / n, 'sum_alpha': sum(alphas),
        'avg_dd_red': sum(dd_reds) / n,
        'win_rate': sum(1 for a in alphas if a > 0) / n,
        'wins': sum(1 for a in alphas if a > 0),
        'cagr_alpha_bps': (strat_cagr - bench_cagr) * 10000,
        'strat_cagr': strat_cagr * 100, 'bench_cagr': bench_cagr * 100,
        'worst_alpha': min(alphas), 'best_alpha': max(alphas),
        'strat_final': strat_final, 'bench_final': bench_final,
        'median_dd_red': sorted(dd_reds)[n // 2],
    }


if __name__ == "__main__":
    # ═══════════════════════════════════════════════════════════════════════
    # Test the recommended strategy and close variants
    # ═══════════════════════════════════════════════════════════════════════

    strategies = {
        "BASELINE (Current)": {
            'trims': [(0.80, 0.02), (1.20, 0.05), (1.75, 0.08), (2.50, 0.12)],
            'deploys': [(0.20, 0.20), (0.30, 0.30), (0.40, 0.50)],
            'age': 0, 'decay': None,
        },
        "WINNER: AG48 + Decay18 + 12% max + Early Deploy": {
            'trims': [(1.00, 0.03), (2.00, 0.06), (3.00, 0.09), (4.00, 0.12)],
            'deploys': [(0.15, 0.50), (0.30, 1.00)],
            'age': 48, 'decay': 18,
        },
        "Variant A: Same but no decay (pure age gate)": {
            'trims': [(1.00, 0.03), (2.00, 0.06), (3.00, 0.09), (4.00, 0.12)],
            'deploys': [(0.15, 0.50), (0.30, 1.00)],
            'age': 48, 'decay': None,
        },
        "Variant B: AG56 + Decay18 (older age gate)": {
            'trims': [(1.20, 0.03), (2.13, 0.06), (3.07, 0.09), (4.00, 0.12)],
            'deploys': [(0.15, 0.50), (0.30, 1.00)],
            'age': 56, 'decay': 18,
        },
        "Variant C: AG48 + Decay24 (longer decay)": {
            'trims': [(1.00, 0.03), (2.00, 0.06), (3.00, 0.09), (4.00, 0.12)],
            'deploys': [(0.15, 0.50), (0.30, 1.00)],
            'age': 48, 'decay': 24,
        },
        "Variant D: AG48 + Decay18 + all-in deploy at -15%": {
            'trims': [(1.00, 0.03), (2.00, 0.06), (3.00, 0.09), (4.00, 0.12)],
            'deploys': [(0.15, 1.00)],
            'age': 48, 'decay': 18,
        },
        "Variant E: AG48 + Decay18 + 10% max cash": {
            'trims': [(1.00, 0.025), (2.00, 0.05), (3.00, 0.075), (4.00, 0.10)],
            'deploys': [(0.15, 0.50), (0.30, 1.00)],
            'age': 48, 'decay': 18,
        },
        "Variant F: AG48 + Decay18 + deploy at -10/-20%": {
            'trims': [(1.00, 0.03), (2.00, 0.06), (3.00, 0.09), (4.00, 0.12)],
            'deploys': [(0.10, 0.50), (0.20, 1.00)],
            'age': 48, 'decay': 18,
        },
    }

    print("=" * 130)
    print("FINAL STRATEGY VERIFICATION AND COMPARISON")
    print("=" * 130)

    summary = []
    for name, params in strategies.items():
        bt = simulate(params['trims'], params['deploys'],
                      age_gate=params['age'], decay_mo=params['decay'])

        print(f"\n{'='*130}")
        print(f"STRATEGY: {name}")
        print(f"{'='*130}")

        # Print trim rules
        print(f"\n  TRIM RULES (age gate: {params['age']} months):")
        for g, c in params['trims']:
            print(f"    When market gains +{g*100:.0f}% from trough -> hold {c*100:.1f}% in cash")
        if params['decay']:
            print(f"  TIME DECAY: If no bear within {params['decay']} months of trim, redeploy all cash")

        print(f"\n  DEPLOY RULES:")
        for d, p in params['deploys']:
            print(f"    When drawdown hits -{d*100:.0f}% -> deploy {p*100:.0f}% of cash reserves")

        print(f"\n  {'#':>2}  {'Bull':<14}  {'Bear':<18}  {'Bull':>5}  {'Bear':>5}  {'Cash':>5}  "
              f"{'StratRet':>9}  {'B&HRet':>9}  {'Alpha':>8}  {'SDD':>6}  {'BDD':>6}  {'DDR':>5}")
        print("  " + "-" * 118)

        for i, r in enumerate(bt['results']):
            alpha_marker = " **" if abs(r['alpha']) > 5 else ""
            print(f"  {i+1:>2}  {r['bull']:<14}  {r['bear']:<18}  "
                  f"{r['bull_gain']:>+5.0f}  {r['bear_dd']:>+5.0f}  {r['cash_pct']:>4.1f}%  "
                  f"{r['strat_ret']:>+8.2f}%  {r['bench_ret']:>+8.2f}%  {r['alpha']:>+7.2f}%  "
                  f"{r['strat_dd']:>5.1f}%  {r['bench_dd']:>5.1f}%  {r['dd_red']:>+4.1f}{alpha_marker}")

        print("  " + "-" * 118)
        print(f"\n  CAGR Alpha:       {bt['cagr_alpha_bps']:>+.1f} bps/yr")
        print(f"  Avg Alpha:        {bt['avg_alpha']:>+.3f}% per cycle")
        print(f"  Sum Alpha:        {bt['sum_alpha']:>+.2f}%")
        print(f"  Avg DD Reduction: {bt['avg_dd_red']:>+.1f} pp (median: {bt['median_dd_red']:>+.1f})")
        print(f"  Win Rate:         {bt['wins']}/14 ({bt['win_rate']:.0%})")
        print(f"  Worst Cycle:      {bt['worst_alpha']:>+.2f}%")
        print(f"  Strategy CAGR:    {bt['strat_cagr']:.4f}%")
        print(f"  Benchmark CAGR:   {bt['bench_cagr']:.4f}%")
        print(f"  Terminal ($1M):   ${bt['strat_final']:>,.0f} vs ${bt['bench_final']:>,.0f}")

        summary.append({
            'name': name,
            'cagr_bps': bt['cagr_alpha_bps'],
            'avg_alpha': bt['avg_alpha'],
            'avg_dd_red': bt['avg_dd_red'],
            'win_rate': bt['win_rate'],
            'worst': bt['worst_alpha'],
        })

    # Summary table
    print(f"\n\n{'='*130}")
    print(f"SUMMARY COMPARISON")
    print(f"{'='*130}")
    print(f"{'Strategy':<55} {'CAGR bps':>9} {'AvgAlpha':>9} {'AvgDDR':>7} {'WR':>5} {'Worst':>8}")
    print("-" * 130)
    for s in summary:
        print(f"{s['name']:<55} {s['cagr_bps']:>+8.1f} {s['avg_alpha']:>+8.3f}% {s['avg_dd_red']:>+6.1f}pp {s['win_rate']:>4.0%} {s['worst']:>+7.2f}%")
