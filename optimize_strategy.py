#!/usr/bin/env python3
"""
Comprehensive Bull/Bear Strategy Optimizer
==========================================
Tests every viable approach and parameter combination across 14 historical cycles.
Uses the V3 framework (era-specific risk-free rates, recovery phase, cash interest).

Goal: Find the SINGLE BEST strategy that:
1. Produces POSITIVE alpha vs buy-and-hold
2. Meaningfully reduces drawdown (>=1pp average)
3. Is rule-based and explainable
"""

import math
import itertools
from dataclasses import dataclass
from typing import List, Optional, Tuple

# =============================================================================
# RISK-FREE RATES (era-specific)
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
    # (bull_name, bull_gain%, bull_months,
    #  bear_name, bear_dd%, bear_months, recovery_months,
    #  bull_start_year, bear_peak_year, bear_trough_year)
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

# =============================================================================
# STRATEGY CONFIGURATION
# =============================================================================
@dataclass
class Strategy:
    name: str
    # Trim tiers: list of (gain_threshold_pct, target_cash_pct)
    trim_tiers: List[Tuple[float, float]]
    # Deploy tiers: list of (drawdown_threshold_pct, deploy_pct_of_INITIAL_cash)
    deploy_tiers: List[Tuple[float, float]]
    # Time decay: if set, months after last trim before cash auto-redeploys
    time_decay_months: Optional[float] = None
    time_decay_redeploy_pct: float = 100.0
    # Age gate: only allow trims after bull is this many months old
    age_gate_months: float = 0.0


def simulate_strategy(strategy: Strategy) -> dict:
    """
    Run strategy across all 14 cycles, compounding wealth.
    Returns detailed per-cycle and aggregate results.
    """
    INITIAL = 1_000_000.0
    strat_value = INITIAL
    bench_value = INITIAL

    cycle_results = []

    for cycle_num, c in enumerate(CYCLES):
        (bull_name, bull_gain_pct, bull_months,
         bear_name, bear_dd_pct, bear_months, recovery_months,
         bull_start_yr, bear_peak_yr, bear_trough_yr) = c

        # At cycle start: 100% equity (reset after recovery)
        strat_equity = strat_value
        strat_cash = 0.0
        cycle_start_strat = strat_equity
        cycle_start_bench = bench_value

        # ─── PHASE 1: BULL MARKET ───
        total_bull = bull_gain_pct / 100.0
        n_bull = max(1, round(bull_months))
        m_eq_ret = (1 + total_bull) ** (1/n_bull) - 1
        bull_mid_yr = bull_start_yr + int(bull_months / 24)
        rf_m = monthly_rf(bull_mid_yr)

        market_from_trough = 1.0
        t_idx = 0
        # Only consider achievable trim tiers
        achievable_trims = [(g, c_) for g, c_ in strategy.trim_tiers if total_bull >= g]

        # Track last trim for time decay
        last_trim_month = None
        trim_active = True  # whether trims are currently active (not decayed)

        for month in range(n_bull):
            strat_equity *= (1 + m_eq_ret)
            ci = strat_cash * rf_m
            strat_cash += ci
            market_from_trough *= (1 + m_eq_ret)
            gain = market_from_trough - 1.0
            bull_age = month + 1  # 1-indexed

            # Check time decay
            if (strategy.time_decay_months is not None and
                last_trim_month is not None and
                (bull_age - last_trim_month) >= strategy.time_decay_months and
                strat_cash > 0):
                # Redeploy cash
                redeploy = strat_cash * strategy.time_decay_redeploy_pct / 100.0
                strat_equity += redeploy
                strat_cash -= redeploy
                last_trim_month = None
                # Reset trim index to allow re-triggering
                t_idx = 0
                # Re-filter achievable trims from current gain level
                # But we need to re-trigger only tiers not yet reached
                # Actually, let's just reset and let them re-trigger
                achievable_trims = [(g, c_) for g, c_ in strategy.trim_tiers if total_bull >= g]

            # Check trim triggers (with age gate)
            while t_idx < len(achievable_trims):
                g_thresh, cum_cash = achievable_trims[t_idx]
                if gain >= g_thresh:
                    # Age gate check
                    if bull_age >= strategy.age_gate_months:
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

        # ─── PHASE 2: BEAR MARKET ───
        drawdown = bear_dd_pct / 100.0
        n_bear = max(1, round(bear_months))
        trough_level = 1.0 - drawdown
        m_decline = trough_level ** (1/n_bear) - 1 if trough_level > 0 else -0.5
        rf_bear = monthly_rf(bear_peak_yr)

        strat_pre_bear = strat_equity + strat_cash
        initial_cash_reserves = strat_cash
        mkt = 1.0
        d_idx = 0
        achievable_deploys = [(d, p) for d, p in strategy.deploy_tiers if drawdown >= d]
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

        # ─── PHASE 3: RECOVERY ───
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

        # Benchmark recovers to pre-bear value
        # (already captured: bench_value was multiplied by bull, bear recovery = net zero)

        # ─── RESET: deploy all cash ───
        strat_equity += strat_cash
        strat_cash = 0.0
        strat_value = strat_equity

        # ─── CYCLE METRICS ───
        strat_cycle_ret = (strat_value / cycle_start_strat - 1) * 100
        bench_cycle_ret = (bench_value / cycle_start_bench - 1) * 100
        cycle_alpha = strat_cycle_ret - bench_cycle_ret

        cycle_results.append({
            'num': cycle_num + 1,
            'bull': bull_name,
            'bear': bear_name,
            'bull_gain': bull_gain_pct,
            'bull_months': bull_months,
            'bear_dd': -bear_dd_pct,
            'bear_months': bear_months,
            'recovery_months': recovery_months,
            'cash_pct': cash_pct_peak,
            'strat_ret': strat_cycle_ret,
            'bench_ret': bench_cycle_ret,
            'alpha': cycle_alpha,
            'strat_dd': strat_max_dd * 100,
            'bench_dd': bear_dd_pct,
            'dd_red': bear_dd_pct - strat_max_dd * 100,
            'strat_end': strat_value,
            'bench_end': bench_value,
        })

    # ─── AGGREGATE ───
    alphas = [r['alpha'] for r in cycle_results]
    dd_reds = [r['dd_red'] for r in cycle_results]

    n = len(alphas)
    avg_alpha = sum(alphas) / n
    avg_dd_red = sum(dd_reds) / n
    wins = sum(1 for a in alphas if a > 0)

    total_years = 92.0
    strat_final = cycle_results[-1]['strat_end']
    bench_final = cycle_results[-1]['bench_end']

    strat_cagr = (strat_final / 1_000_000) ** (1/total_years) - 1
    bench_cagr = (bench_final / 1_000_000) ** (1/total_years) - 1
    cagr_alpha_bps = (strat_cagr - bench_cagr) * 10000

    return {
        'name': strategy.name,
        'results': cycle_results,
        'avg_alpha': avg_alpha,
        'sum_alpha': sum(alphas),
        'avg_dd_red': avg_dd_red,
        'win_rate': wins / n,
        'wins': wins,
        'n': n,
        'strat_cagr': strat_cagr * 100,
        'bench_cagr': bench_cagr * 100,
        'cagr_alpha_bps': cagr_alpha_bps,
        'strat_final': strat_final,
        'bench_final': bench_final,
        'worst_alpha': min(alphas),
        'best_alpha': max(alphas),
        'median_alpha': sorted(alphas)[n // 2],
    }


def print_detailed(bt):
    """Print full cycle-by-cycle results."""
    print(f"\n{'='*130}")
    print(f"STRATEGY: {bt['name']}")
    print(f"{'='*130}")
    print(f"\n{'#':>2}  {'Bull':<14}  {'Bear':<18}  {'Bull%':>6}  {'Bear%':>6}  {'Cash%':>5}  "
          f"{'StratRet':>9}  {'B&HRet':>9}  {'Alpha':>8}  {'SDD':>6}  {'BDD':>6}  {'DDR':>5}")
    print("-" * 130)

    for r in bt['results']:
        print(f"{r['num']:>2}  {r['bull']:<14}  {r['bear']:<18}  "
              f"{r['bull_gain']:>+6.1f}  {r['bear_dd']:>+6.1f}  {r['cash_pct']:>4.1f}%  "
              f"{r['strat_ret']:>+8.2f}%  {r['bench_ret']:>+8.2f}%  {r['alpha']:>+7.2f}%  "
              f"{r['strat_dd']:>5.1f}%  {r['bench_dd']:>5.1f}%  {r['dd_red']:>+4.1f}")

    print("-" * 130)
    print(f"\n  Avg Alpha:          {bt['avg_alpha']:>+8.3f}% per cycle")
    print(f"  Sum Alpha:          {bt['sum_alpha']:>+8.2f}%")
    print(f"  CAGR Alpha:         {bt['cagr_alpha_bps']:>+8.1f} bps/yr")
    print(f"  Avg DD Reduction:   {bt['avg_dd_red']:>+8.1f} pp")
    print(f"  Win Rate:           {bt['wins']}/{bt['n']} ({bt['win_rate']:.0%})")
    print(f"  Worst Cycle:        {bt['worst_alpha']:>+8.2f}%")
    print(f"  Best Cycle:         {bt['best_alpha']:>+8.2f}%")
    print(f"  Strategy CAGR:      {bt['strat_cagr']:>8.4f}%")
    print(f"  Benchmark CAGR:     {bt['bench_cagr']:>8.4f}%")
    print(f"  Terminal ($1M):     Strat ${bt['strat_final']:>,.0f}  |  B&H ${bt['bench_final']:>,.0f}")


# =============================================================================
# STRATEGY FACTORY FUNCTIONS
# =============================================================================

def baseline():
    return Strategy(
        name="BASELINE (Current Rules)",
        trim_tiers=[(0.80, 0.02), (1.20, 0.05), (1.75, 0.08), (2.50, 0.12)],
        deploy_tiers=[(0.20, 0.20), (0.30, 0.30), (0.40, 0.50)],
    )

def approach1_low_trim(t1, t2, t3, t4):
    return Strategy(
        name=f"LowTrim [{t1},{t2},{t3},{t4}]%",
        trim_tiers=[(0.80, t1/100), (1.20, t2/100), (1.75, t3/100), (2.50, t4/100)],
        deploy_tiers=[(0.20, 0.20), (0.30, 0.30), (0.40, 0.50)],
    )

def approach2_time_decay(decay_mo, redeploy_pct=100):
    return Strategy(
        name=f"TimeDecay {decay_mo}mo/{redeploy_pct}%",
        trim_tiers=[(0.80, 0.02), (1.20, 0.05), (1.75, 0.08), (2.50, 0.12)],
        deploy_tiers=[(0.20, 0.20), (0.30, 0.30), (0.40, 0.50)],
        time_decay_months=decay_mo,
        time_decay_redeploy_pct=redeploy_pct,
    )

def approach3_aggro_deploy(d1_pct, d2_pct, d3_pct):
    return Strategy(
        name=f"AggroDeploy [{d1_pct},{d2_pct},{d3_pct}]%",
        trim_tiers=[(0.80, 0.02), (1.20, 0.05), (1.75, 0.08), (2.50, 0.12)],
        deploy_tiers=[(0.20, d1_pct/100), (0.30, d2_pct/100), (0.40, d3_pct/100)],
    )

def approach5_age_gated(min_age):
    return Strategy(
        name=f"AgeGated {min_age}mo",
        trim_tiers=[(0.80, 0.02), (1.20, 0.05), (1.75, 0.08), (2.50, 0.12)],
        deploy_tiers=[(0.20, 0.20), (0.30, 0.30), (0.40, 0.50)],
        age_gate_months=min_age,
    )

def approach6_asymmetric(t1, t2, t3, t4, d1_trig, d1_pct, d2_trig, d2_pct):
    return Strategy(
        name=f"Asym t=[{t1},{t2},{t3},{t4}] d=[{d1_trig}/{d1_pct},{d2_trig}/{d2_pct}]",
        trim_tiers=[(0.80, t1/100), (1.20, t2/100), (1.75, t3/100), (2.50, t4/100)],
        deploy_tiers=[(d1_trig/100, d1_pct/100), (d2_trig/100, d2_pct/100)],
    )

def hybrid_strategy(t1, t2, t3, t4, d1_trig, d1_pct, d2_trig, d2_pct,
                     age_gate=0, decay_mo=None, decay_pct=100):
    parts = [f"t=[{t1},{t2},{t3},{t4}]", f"d=[{d1_trig}/{d1_pct},{d2_trig}/{d2_pct}]"]
    if age_gate > 0:
        parts.append(f"age>{age_gate}")
    if decay_mo:
        parts.append(f"decay={decay_mo}mo")
    return Strategy(
        name="Hybrid " + " ".join(parts),
        trim_tiers=[(0.80, t1/100), (1.20, t2/100), (1.75, t3/100), (2.50, t4/100)],
        deploy_tiers=[(d1_trig/100, d1_pct/100), (d2_trig/100, d2_pct/100)],
        age_gate_months=age_gate,
        time_decay_months=decay_mo,
        time_decay_redeploy_pct=decay_pct,
    )

def custom_thresholds(trig1, t1, trig2, t2, trig3, t3, trig4, t4,
                       d1_trig, d1_pct, d2_trig, d2_pct, d3_trig=None, d3_pct=None,
                       age_gate=0, decay_mo=None, decay_pct=100):
    """Fully customizable trim triggers and levels."""
    trims = [(trig1/100, t1/100), (trig2/100, t2/100), (trig3/100, t3/100), (trig4/100, t4/100)]
    deploys = [(d1_trig/100, d1_pct/100), (d2_trig/100, d2_pct/100)]
    if d3_trig is not None:
        deploys.append((d3_trig/100, d3_pct/100))

    name = f"Custom trig=[{trig1},{trig2},{trig3},{trig4}] cash=[{t1},{t2},{t3},{t4}] d=[{d1_trig}/{d1_pct},{d2_trig}/{d2_pct}]"
    if age_gate > 0:
        name += f" age>{age_gate}"
    if decay_mo:
        name += f" decay={decay_mo}"

    return Strategy(
        name=name,
        trim_tiers=trims,
        deploy_tiers=deploys,
        age_gate_months=age_gate,
        time_decay_months=decay_mo,
        time_decay_redeploy_pct=decay_pct,
    )


# =============================================================================
# MAIN: EXHAUSTIVE SEARCH
# =============================================================================
if __name__ == "__main__":
    print("=" * 100)
    print("COMPREHENSIVE STRATEGY OPTIMIZER")
    print("Testing all approaches across 14 historical cycles (1932-2024)")
    print("=" * 100)

    all_results = []

    # ─── BASELINE ───
    bt = simulate_strategy(baseline())
    print_detailed(bt)
    all_results.append(bt)

    # ─── APPROACH 1: Lower Trim Levels ───
    print("\n\n>>> APPROACH 1: LOWER TRIM LEVELS <<<")
    for t4 in [3, 4, 5, 6, 7, 8]:
        for ratio in [0.25, 0.33, 0.5]:
            t1 = max(0.5, round(t4 * ratio * 0.25, 1))
            t2 = max(1.0, round(t4 * ratio * 0.5, 1))
            t3 = max(1.5, round(t4 * ratio * 0.75, 1))
            s = approach1_low_trim(t1, t2, t3, t4)
            bt = simulate_strategy(s)
            all_results.append(bt)

    # ─── APPROACH 2: Time Decay ───
    print("\n\n>>> APPROACH 2: TIME DECAY <<<")
    for decay in [12, 15, 18, 21, 24, 30, 36]:
        for pct in [50, 75, 100]:
            s = approach2_time_decay(decay, pct)
            bt = simulate_strategy(s)
            all_results.append(bt)

    # ─── APPROACH 3: Aggressive Deploy ───
    print("\n\n>>> APPROACH 3: AGGRESSIVE DEPLOYMENT <<<")
    for d1 in [30, 40, 50, 60]:
        for d2 in [50, 60, 75, 100]:
            for d3 in [75, 100]:
                if d1 <= d2 <= d3:
                    s = approach3_aggro_deploy(d1, d2, d3)
                    bt = simulate_strategy(s)
                    all_results.append(bt)

    # ─── APPROACH 5: Age-Gated ───
    print("\n\n>>> APPROACH 5: AGE-GATED TRIMMING <<<")
    for age in [12, 18, 24, 30, 36, 42, 48, 54, 60]:
        s = approach5_age_gated(age)
        bt = simulate_strategy(s)
        all_results.append(bt)

    # ─── APPROACH 6: Asymmetric (tiny trim, big deploy) ───
    print("\n\n>>> APPROACH 6: ASYMMETRIC SIZING <<<")
    for t4 in [2, 3, 4, 5]:
        for d1_trig in [10, 15, 20]:
            for d2_trig in [20, 25, 30, 35]:
                if d2_trig <= d1_trig:
                    continue
                for d1_pct in [40, 50, 60, 70]:
                    s = approach6_asymmetric(
                        t1=max(0.5, t4*0.25), t2=max(1, t4*0.5),
                        t3=max(1.5, t4*0.75), t4=t4,
                        d1_trig=d1_trig, d1_pct=d1_pct,
                        d2_trig=d2_trig, d2_pct=100,
                    )
                    bt = simulate_strategy(s)
                    all_results.append(bt)

    # ─── APPROACH 7: COMBINED HYBRID ───
    # Combine the most promising elements: low trim + aggressive deploy + age gate + time decay
    print("\n\n>>> APPROACH 7: HYBRID COMBINATIONS <<<")
    for t4 in [3, 4, 5, 6]:
        for d1_trig in [10, 15, 20]:
            for d2_trig in [20, 25, 30]:
                if d2_trig <= d1_trig:
                    continue
                for d1_pct in [50, 60, 70]:
                    for age in [0, 24, 36, 48]:
                        for decay in [None, 18, 24, 36]:
                            s = hybrid_strategy(
                                t1=max(0.5, t4*0.25), t2=max(1, t4*0.5),
                                t3=max(1.5, t4*0.75), t4=t4,
                                d1_trig=d1_trig, d1_pct=d1_pct,
                                d2_trig=d2_trig, d2_pct=100,
                                age_gate=age, decay_mo=decay,
                            )
                            bt = simulate_strategy(s)
                            all_results.append(bt)

    # ─── APPROACH 8: Custom Trim Triggers ───
    # Higher trim thresholds (later triggers = less cash drag)
    print("\n\n>>> APPROACH 8: HIGHER TRIM TRIGGERS <<<")
    for trig1 in [100, 120, 150]:
        for trig2 in [150, 175, 200]:
            if trig2 <= trig1:
                continue
            for trig3 in [200, 250, 300]:
                if trig3 <= trig2:
                    continue
                for trig4 in [300, 350, 400, 500]:
                    if trig4 <= trig3:
                        continue
                    for t4 in [3, 4, 5, 6]:
                        for d1_pct in [50, 60]:
                            s = custom_thresholds(
                                trig1=trig1, t1=max(0.5, t4*0.25),
                                trig2=trig2, t2=max(1, t4*0.5),
                                trig3=trig3, t3=max(1.5, t4*0.75),
                                trig4=trig4, t4=t4,
                                d1_trig=15, d1_pct=d1_pct,
                                d2_trig=25, d2_pct=100,
                            )
                            bt = simulate_strategy(s)
                            all_results.append(bt)

    # ─── APPROACH 9: Two-tier only (simplest possible) ───
    print("\n\n>>> APPROACH 9: SIMPLE TWO-TIER <<<")
    for trig in [80, 100, 120, 150, 175]:
        for cash in [1, 2, 3, 4, 5]:
            for d_trig in [15, 20, 25]:
                s = Strategy(
                    name=f"TwoTier trig={trig} cash={cash}% deploy@{d_trig}%",
                    trim_tiers=[(trig/100, cash/100)],
                    deploy_tiers=[(d_trig/100, 1.0)],  # deploy ALL at first trigger
                )
                bt = simulate_strategy(s)
                all_results.append(bt)

    # ═════════════════════════════════════════════════════════════════════════
    # FILTER AND RANK
    # ═════════════════════════════════════════════════════════════════════════
    print("\n\n" + "=" * 130)
    print("RANKING: STRATEGIES WITH POSITIVE ALPHA AND >= 1pp DD REDUCTION")
    print("=" * 130)

    # Filter: positive avg alpha AND >= 1pp avg DD reduction
    viable = [r for r in all_results if r['avg_alpha'] > 0 and r['avg_dd_red'] >= 1.0]

    if not viable:
        print("\nNo strategies met BOTH criteria (positive alpha + >=1pp DD reduction).")
        print("\nRelaxing to: positive CAGR alpha OR positive avg alpha:")
        viable = [r for r in all_results if r['cagr_alpha_bps'] > 0 or r['avg_alpha'] > 0]

    if not viable:
        print("\nStill no strategies with positive alpha. Showing top 20 by avg alpha:")
        viable = sorted(all_results, key=lambda x: x['avg_alpha'], reverse=True)[:20]

    # Sort by CAGR alpha (the true compound measure)
    viable.sort(key=lambda x: x['cagr_alpha_bps'], reverse=True)

    print(f"\nFound {len(viable)} viable strategies. Top 30:\n")
    print(f"{'Rank':>4}  {'Strategy':<70}  {'AvgAlpha':>9}  {'CAGRbps':>8}  {'AvgDDR':>7}  {'WinRate':>8}  {'Worst':>8}")
    print("-" * 130)

    for i, r in enumerate(viable[:30]):
        flag = " ***" if r['avg_dd_red'] >= 1.0 and r['cagr_alpha_bps'] > 0 else ""
        print(f"{i+1:>4}  {r['name']:<70}  {r['avg_alpha']:>+8.3f}%  {r['cagr_alpha_bps']:>+7.1f}  "
              f"{r['avg_dd_red']:>+6.1f}pp  {r['win_rate']:>7.0%}  {r['worst_alpha']:>+7.2f}%{flag}")

    # ═════════════════════════════════════════════════════════════════════════
    # SHOW TOP 5 IN DETAIL
    # ═════════════════════════════════════════════════════════════════════════
    print("\n\n" + "=" * 130)
    print("TOP 5 STRATEGIES - DETAILED RESULTS")
    print("=" * 130)

    for i, bt in enumerate(viable[:5]):
        print(f"\n\n{'='*100}")
        print(f"RANK #{i+1}: {bt['name']}")
        print(f"{'='*100}")
        print_detailed(bt)

    # ═════════════════════════════════════════════════════════════════════════
    # BEST STRATEGY WITH DD REDUCTION
    # ═════════════════════════════════════════════════════════════════════════
    best_with_dd = [r for r in viable if r['avg_dd_red'] >= 1.0]
    if best_with_dd:
        print("\n\n" + "=" * 130)
        print("THE SINGLE BEST STRATEGY (positive alpha + >=1pp DD reduction)")
        print("=" * 130)
        winner = best_with_dd[0]
        print_detailed(winner)
    else:
        # Find best trade-off
        print("\n\n" + "=" * 130)
        print("BEST AVAILABLE (may not meet both criteria)")
        print("=" * 130)
        # Score: alpha * dd_reduction (want both positive)
        scored = [(r, r['cagr_alpha_bps'] * max(0.1, r['avg_dd_red'])) for r in all_results]
        scored.sort(key=lambda x: x[1], reverse=True)
        winner = scored[0][0]
        print_detailed(winner)

    print(f"\n\nTotal strategies tested: {len(all_results)}")
