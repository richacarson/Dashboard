#!/usr/bin/env python3
"""
Bull/Bear Strategy Backtester
Simulates trim/deploy strategies across 14 historical market cycles (1932-2024).

The simulation models each cycle as a bull phase followed by a bear phase.
During bulls, equity grows at the bull's CAGR. Cash earns a risk-free rate.
Trims move equity to cash at specified gain thresholds.
Deployments move cash to equity at specified drawdown thresholds.

Alpha = strategy total return - buy-and-hold total return (per cycle)
"""

import math
import itertools
from dataclasses import dataclass, field
from typing import List, Tuple, Optional, Dict
import json

# ─── Historical Data ───────────────────────────────────────────────────────────

@dataclass
class Cycle:
    name: str
    bull_gain_pct: float      # total bull gain %
    bull_months: float        # bull duration in months
    bear_drawdown_pct: float  # bear drawdown % (negative)
    bear_months: float        # bear duration in months
    recovery_months: float    # months to recover to prior peak

CYCLES = [
    Cycle("1932-37/Depression",  324.8, 57.0, -86.2, 33.0, 267.0),
    Cycle("1938/1937-38",         62.2,  7.3, -54.5, 12.8,  95.6),
    Cycle("1942-46/WWII",       157.7, 49.0, -34.5, 17.6,  25.2),
    Cycle("1947-56/Post-WWII",  267.0, 86.0, -28.8, 11.6,  39.5),
    Cycle("1957-61/Eisenhower",  86.3, 49.7, -21.6, 14.7,  11.0),
    Cycle("1962-66/Kennedy",     79.8, 43.5, -28.0,  6.5,  14.3),
    Cycle("1966-68/Vietnam-era", 48.0, 25.7, -22.2,  7.9,   6.9),
    Cycle("1970-73/Vietnam",     73.5, 31.5, -36.1, 17.9,  21.4),
    Cycle("1974-80/OPEC",       125.6, 73.9, -48.2, 20.7,  69.5),
    Cycle("1982-87/Volcker",    228.8, 60.4, -27.1, 20.5,   2.8),
    Cycle("1987-2000/Mega-bull",582.0,147.6, -33.5,  3.3,  19.7),
    Cycle("2002-07/Recovery",   101.5, 60.0, -49.1, 30.5,  55.6),
    Cycle("2009-20/Post-GFC",   400.5,131.4, -56.8, 17.0,  48.8),
    Cycle("2020-22/COVID-rec",  114.4, 21.3, -33.9,  1.1,   4.9),
]

# Note on cycle pairing: Each cycle pairs the bull with the FOLLOWING bear.
# The first cycle (1932-37 bull) is followed by the 1937-38 bear (-54.5%).
# This is a simplification but captures the key dynamics.
# Actually, let me re-examine. The bear data represents the bear that FOLLOWS
# each bull. Let me re-pair based on historical sequence:

# Bull 1932-37 -> Bear 1937-38 (-54.5%)
# Bull 1938 -> Bear 1939-42 (WWII, -34.5%)
# Bull 1942-46 -> Bear 1946-47 (-28.8%)
# Bull 1947-56 -> Bear 1957 (Eisenhower, -21.6%)
# Bull 1957-61 -> Bear 1961-62 (Kennedy Flash, -28.0%)
# Bull 1962-66 -> Bear 1966 (Credit Crunch, -22.2%)
# Bull 1966-68 -> Bear 1968-70 (Vietnam, -36.1%)
# Bull 1970-73 -> Bear 1973-74 (OPEC, -48.2%)
# Bull 1974-80 -> Bear 1980-82 (Volcker, -27.1%)
# Bull 1982-87 -> Bear 1987 (Black Monday, -33.5%)
# Bull 1987-2000 -> Bear 2000-02 (Dot-com, -49.1%)
# Bull 2002-07 -> Bear 2007-09 (GFC, -56.8%)
# Bull 2009-20 -> Bear 2020 (COVID, -33.9%)
# Bull 2020-22 -> Bear 2022 (-25.4%)

CYCLES_PAIRED = [
    Cycle("1932-37 → 1937-38",   324.8,  57.0, -54.5, 12.8,  95.6),
    Cycle("1938 → WWII",          62.2,   7.3, -34.5, 17.6,  25.2),
    Cycle("1942-46 → Post-WWII", 157.7,  49.0, -28.8, 11.6,  39.5),
    Cycle("1947-56 → Eisenhower", 267.0,  86.0, -21.6, 14.7,  11.0),
    Cycle("1957-61 → Kennedy",    86.3,  49.7, -28.0,  6.5,  14.3),
    Cycle("1962-66 → Crunch",     79.8,  43.5, -22.2,  7.9,   6.9),
    Cycle("1966-68 → Vietnam",    48.0,  25.7, -36.1, 17.9,  21.4),
    Cycle("1970-73 → OPEC",       73.5,  31.5, -48.2, 20.7,  69.5),
    Cycle("1974-80 → Volcker",   125.6,  73.9, -27.1, 20.5,   2.8),
    Cycle("1982-87 → Blk Mon",   228.8,  60.4, -33.5,  3.3,  19.7),
    Cycle("1987-00 → Dot-com",   582.0, 147.6, -49.1, 30.5,  55.6),
    Cycle("2002-07 → GFC",       101.5,  60.0, -56.8, 17.0,  48.8),
    Cycle("2009-20 → COVID",     400.5, 131.4, -33.9,  1.1,   4.9),
    Cycle("2020-22 → 2022",      114.4,  21.3, -25.4,  9.3,  15.3),
]

RISK_FREE_ANNUAL = 0.035  # approximate average T-bill rate across full period
RISK_FREE_MONTHLY = (1 + RISK_FREE_ANNUAL) ** (1/12) - 1


@dataclass
class TrimRule:
    """Trim equity to cash when bull gain exceeds threshold."""
    gain_threshold_pct: float   # e.g., 80 means trim when bull is up 80%
    cash_target_pct: float      # e.g., 2 means move to 2% cash allocation
    min_bull_age_months: float = 0  # optional: only trim if bull is this old


@dataclass
class DeployRule:
    """Deploy cash to equity when bear drawdown exceeds threshold."""
    drawdown_threshold_pct: float  # e.g., -20 means deploy when market is down 20%
    deploy_pct_of_cash: float      # e.g., 20 means deploy 20% of cash reserves
    # If > 100, we're deploying more than cash (leverage/aggressive rebalance)


@dataclass
class TimeDecayRule:
    """If no bear materializes within X months of a trim, put cash back."""
    months_after_trim: float
    pct_of_cash_to_redeploy: float  # 100 = put all cash back


@dataclass
class Strategy:
    name: str
    trim_rules: List[TrimRule]
    deploy_rules: List[DeployRule]
    time_decay: Optional[TimeDecayRule] = None
    max_cash_pct: float = 100.0  # cap on total cash allocation


def simulate_cycle(cycle: Cycle, strategy: Strategy) -> dict:
    """
    Simulate one bull-bear cycle.

    Month-by-month simulation:
    - During bull: equity grows at the bull's monthly CAGR
    - During bear: equity declines according to bear drawdown spread over bear months
    - Trims/deploys execute when thresholds are crossed
    - Cash earns risk-free rate throughout

    Returns dict with alpha, drawdown reduction, returns, etc.
    """
    # Monthly growth rates
    bull_total_mult = 1 + cycle.bull_gain_pct / 100
    bull_monthly_rate = bull_total_mult ** (1 / cycle.bull_months) - 1

    bear_total_mult = 1 + cycle.bear_drawdown_pct / 100  # e.g., 1 + (-0.491) = 0.509
    bear_monthly_rate = bear_total_mult ** (1 / cycle.bear_months) - 1

    # Starting portfolio: $1 in equity, $0 in cash
    equity = 1.0
    cash = 0.0

    # Buy-and-hold benchmark: $1 fully invested
    bnh_equity = 1.0

    # Track trims for time-decay
    last_trim_month = None
    total_months = 0

    # Track peak for drawdown calculation
    peak_portfolio = 1.0
    max_drawdown_strategy = 0.0
    peak_bnh = 1.0
    max_drawdown_bnh = 0.0

    # Track which trim thresholds have been triggered
    triggered_trims = set()

    # ── Bull Phase ──
    bull_start_equity = 1.0  # track the equity level at start of bull

    for month in range(1, int(math.ceil(cycle.bull_months)) + 1):
        # Fractional last month
        if month == int(math.ceil(cycle.bull_months)) and cycle.bull_months % 1 != 0:
            frac = cycle.bull_months - int(cycle.bull_months)
            monthly_rate = (1 + bull_monthly_rate) ** frac - 1
        else:
            monthly_rate = bull_monthly_rate

        # Grow equity
        equity *= (1 + monthly_rate)
        cash *= (1 + RISK_FREE_MONTHLY)
        bnh_equity *= (1 + monthly_rate)
        total_months += 1

        # Calculate current bull gain (from trough/start)
        total_portfolio = equity + cash
        # The bull gain is measured on the market, not the portfolio
        # Market gain = bnh_equity / 1.0 - 1
        market_gain_pct = (bnh_equity - 1.0) * 100

        # Check trim rules
        for i, rule in enumerate(strategy.trim_rules):
            if i in triggered_trims:
                continue
            if market_gain_pct >= rule.gain_threshold_pct:
                if total_months >= rule.min_bull_age_months:
                    # Calculate how much to trim
                    current_total = equity + cash
                    current_cash_pct = cash / current_total * 100 if current_total > 0 else 0
                    target_cash_pct = min(rule.cash_target_pct, strategy.max_cash_pct)

                    if target_cash_pct > current_cash_pct:
                        # Move equity to cash
                        move_pct = target_cash_pct - current_cash_pct
                        move_amount = current_total * move_pct / 100
                        equity -= move_amount
                        cash += move_amount

                    triggered_trims.add(i)
                    last_trim_month = total_months

        # Check time-decay rule
        if strategy.time_decay and last_trim_month is not None:
            months_since_trim = total_months - last_trim_month
            if months_since_trim >= strategy.time_decay.months_after_trim and cash > 0:
                redeploy = cash * strategy.time_decay.pct_of_cash_to_redeploy / 100
                equity += redeploy
                cash -= redeploy
                last_trim_month = None  # reset
                triggered_trims.clear()  # allow re-triggering

        # Track drawdowns
        portfolio_val = equity + cash
        if portfolio_val > peak_portfolio:
            peak_portfolio = portfolio_val
        dd = (portfolio_val - peak_portfolio) / peak_portfolio
        if dd < max_drawdown_strategy:
            max_drawdown_strategy = dd

        if bnh_equity > peak_bnh:
            peak_bnh = bnh_equity
        dd_bnh = (bnh_equity - peak_bnh) / peak_bnh
        if dd_bnh < max_drawdown_bnh:
            max_drawdown_bnh = dd_bnh

    # Record pre-bear values
    pre_bear_portfolio = equity + cash
    pre_bear_bnh = bnh_equity
    pre_bear_cash_pct = cash / pre_bear_portfolio * 100 if pre_bear_portfolio > 0 else 0

    # ── Bear Phase ──
    # Track which deploy thresholds have been triggered
    triggered_deploys = set()
    bear_start_market = bnh_equity

    for month in range(1, int(math.ceil(cycle.bear_months)) + 1):
        # Fractional last month
        if month == int(math.ceil(cycle.bear_months)) and cycle.bear_months % 1 != 0:
            frac = cycle.bear_months - int(cycle.bear_months)
            monthly_rate = (1 + bear_monthly_rate) ** frac - 1
        else:
            monthly_rate = bear_monthly_rate

        equity *= (1 + monthly_rate)
        cash *= (1 + RISK_FREE_MONTHLY)
        bnh_equity *= (1 + monthly_rate)
        total_months += 1

        # Calculate bear drawdown from peak (bear start)
        market_dd_pct = (bnh_equity / bear_start_market - 1) * 100

        # Check deploy rules
        for i, rule in enumerate(strategy.deploy_rules):
            if i in triggered_deploys:
                continue
            if market_dd_pct <= rule.drawdown_threshold_pct:
                # Deploy cash
                if cash > 0:
                    deploy_amount = cash * min(rule.deploy_pct_of_cash, 100) / 100
                    equity += deploy_amount
                    cash -= deploy_amount
                triggered_deploys.add(i)

        # Track drawdowns
        portfolio_val = equity + cash
        if portfolio_val > peak_portfolio:
            peak_portfolio = portfolio_val
        dd = (portfolio_val - peak_portfolio) / peak_portfolio
        if dd < max_drawdown_strategy:
            max_drawdown_strategy = dd

        if bnh_equity > peak_bnh:
            peak_bnh = bnh_equity
        dd_bnh = (bnh_equity - peak_bnh) / peak_bnh
        if dd_bnh < max_drawdown_bnh:
            max_drawdown_bnh = dd_bnh

    # Final values
    final_portfolio = equity + cash
    final_bnh = bnh_equity

    # Calculate returns
    strategy_return = (final_portfolio - 1.0) * 100
    bnh_return = (final_bnh - 1.0) * 100
    alpha_pct = strategy_return - bnh_return

    # Annualized
    years = total_months / 12
    if years > 0:
        strategy_cagr = (final_portfolio ** (1/years) - 1) * 100
        bnh_cagr = (final_bnh ** (1/years) - 1) * 100
        alpha_cagr_bps = (strategy_cagr - bnh_cagr) * 100  # in basis points
    else:
        strategy_cagr = 0
        bnh_cagr = 0
        alpha_cagr_bps = 0

    dd_reduction = max_drawdown_bnh - max_drawdown_strategy  # positive = strategy has less drawdown
    dd_reduction_pp = dd_reduction * 100  # in percentage points

    return {
        'cycle': cycle.name,
        'bull_gain': cycle.bull_gain_pct,
        'bear_dd': cycle.bear_drawdown_pct,
        'bull_months': cycle.bull_months,
        'bear_months': cycle.bear_months,
        'total_months': total_months,
        'years': years,
        'strategy_return': strategy_return,
        'bnh_return': bnh_return,
        'alpha_pct': alpha_pct,
        'strategy_cagr': strategy_cagr,
        'bnh_cagr': bnh_cagr,
        'alpha_cagr_bps': alpha_cagr_bps,
        'max_dd_strategy': max_drawdown_strategy * 100,
        'max_dd_bnh': max_drawdown_bnh * 100,
        'dd_reduction_pp': dd_reduction_pp,
        'pre_bear_cash_pct': pre_bear_cash_pct,
        'final_portfolio': final_portfolio,
        'final_bnh': final_bnh,
    }


def run_backtest(strategy: Strategy, cycles: List[Cycle] = None) -> dict:
    """Run strategy across all cycles and compute aggregate statistics."""
    if cycles is None:
        cycles = CYCLES_PAIRED

    results = []
    for cycle in cycles:
        result = simulate_cycle(cycle, strategy)
        results.append(result)

    # Aggregate
    alphas = [r['alpha_pct'] for r in results]
    alpha_cagrs = [r['alpha_cagr_bps'] for r in results]
    dd_reductions = [r['dd_reduction_pp'] for r in results]

    avg_alpha_pct = sum(alphas) / len(alphas)
    avg_alpha_cagr_bps = sum(alpha_cagrs) / len(alpha_cagrs)
    avg_dd_reduction = sum(dd_reductions) / len(dd_reductions)

    wins = sum(1 for a in alphas if a > 0)
    win_rate = wins / len(alphas)

    # Cumulative: chain all cycles together
    cumulative_strategy = 1.0
    cumulative_bnh = 1.0
    total_months_all = 0
    for r in results:
        cumulative_strategy *= r['final_portfolio']
        cumulative_bnh *= r['final_bnh']
        total_months_all += r['total_months']

    total_years = total_months_all / 12
    cum_strategy_cagr = (cumulative_strategy ** (1/total_years) - 1) * 100 if total_years > 0 else 0
    cum_bnh_cagr = (cumulative_bnh ** (1/total_years) - 1) * 100 if total_years > 0 else 0
    cum_alpha_cagr_bps = (cum_strategy_cagr - cum_bnh_cagr) * 100

    return {
        'strategy_name': strategy.name,
        'results': results,
        'avg_alpha_pct': avg_alpha_pct,
        'avg_alpha_cagr_bps': avg_alpha_cagr_bps,
        'avg_dd_reduction_pp': avg_dd_reduction,
        'win_rate': win_rate,
        'wins': wins,
        'losses': len(alphas) - wins,
        'cumulative_strategy': cumulative_strategy,
        'cumulative_bnh': cumulative_bnh,
        'cum_strategy_cagr': cum_strategy_cagr,
        'cum_bnh_cagr': cum_bnh_cagr,
        'cum_alpha_cagr_bps': cum_alpha_cagr_bps,
        'total_years': total_years,
        'median_alpha_pct': sorted(alphas)[len(alphas)//2],
        'worst_alpha_pct': min(alphas),
        'best_alpha_pct': max(alphas),
    }


def print_backtest(bt: dict, verbose: bool = True):
    """Pretty-print backtest results."""
    print(f"\n{'='*80}")
    print(f"STRATEGY: {bt['strategy_name']}")
    print(f"{'='*80}")

    if verbose:
        print(f"\n{'Cycle':<28} {'Bull%':>6} {'Bear%':>6} {'Alpha%':>8} {'α bps/yr':>9} {'DD Strat':>8} {'DD B&H':>8} {'DD Red':>7} {'Cash%':>6}")
        print("-" * 100)
        for r in bt['results']:
            print(f"{r['cycle']:<28} {r['bull_gain']:>6.0f} {r['bear_dd']:>6.1f} "
                  f"{r['alpha_pct']:>+8.2f} {r['alpha_cagr_bps']:>+9.1f} "
                  f"{r['max_dd_strategy']:>8.1f} {r['max_dd_bnh']:>8.1f} "
                  f"{r['dd_reduction_pp']:>+7.1f} {r['pre_bear_cash_pct']:>6.1f}")
        print("-" * 100)

    print(f"\n  Avg Alpha (total %):     {bt['avg_alpha_pct']:>+8.2f}%")
    print(f"  Avg Alpha (CAGR bps):    {bt['avg_alpha_cagr_bps']:>+8.1f} bps/yr")
    print(f"  Cumul Alpha (CAGR bps):  {bt['cum_alpha_cagr_bps']:>+8.1f} bps/yr")
    print(f"  Avg DD Reduction:        {bt['avg_dd_reduction_pp']:>+8.1f} pp")
    print(f"  Win Rate:                {bt['win_rate']:>8.1%} ({bt['wins']}/{bt['wins']+bt['losses']})")
    print(f"  Worst Cycle Alpha:       {bt['worst_alpha_pct']:>+8.2f}%")
    print(f"  Best Cycle Alpha:        {bt['best_alpha_pct']:>+8.2f}%")
    print(f"  Cumul CAGR (Strategy):   {bt['cum_strategy_cagr']:>8.2f}%")
    print(f"  Cumul CAGR (Buy&Hold):   {bt['cum_bnh_cagr']:>8.2f}%")


# ─── Strategy Definitions ──────────────────────────────────────────────────────

def make_baseline():
    """Current strategy: the one producing -9 bps/yr."""
    return Strategy(
        name="Baseline (Current Rules)",
        trim_rules=[
            TrimRule(80, 2),
            TrimRule(120, 5),
            TrimRule(175, 8),
            TrimRule(250, 12),
        ],
        deploy_rules=[
            DeployRule(-20, 20),
            DeployRule(-30, 30),
            DeployRule(-40, 50),
        ],
    )


def make_approach1_low_trim():
    """Approach 1: Lower max trim (5% max instead of 12%)."""
    return Strategy(
        name="Approach 1: Low Trim (max 5%)",
        trim_rules=[
            TrimRule(80, 1),
            TrimRule(120, 2),
            TrimRule(175, 3.5),
            TrimRule(250, 5),
        ],
        deploy_rules=[
            DeployRule(-20, 25),
            DeployRule(-30, 35),
            DeployRule(-40, 50),
        ],
    )


def make_approach2_time_decay(decay_months=18, redeploy_pct=100):
    """Approach 2: Time-decay on trims."""
    return Strategy(
        name=f"Approach 2: Time Decay ({decay_months}mo, {redeploy_pct}% redeploy)",
        trim_rules=[
            TrimRule(80, 2),
            TrimRule(120, 5),
            TrimRule(175, 8),
            TrimRule(250, 12),
        ],
        deploy_rules=[
            DeployRule(-20, 20),
            DeployRule(-30, 30),
            DeployRule(-40, 50),
        ],
        time_decay=TimeDecayRule(decay_months, redeploy_pct),
    )


def make_approach3_aggressive_deploy():
    """Approach 3: Aggressive deployment (deploy all cash early)."""
    return Strategy(
        name="Approach 3: Aggressive Deploy (all at -20%)",
        trim_rules=[
            TrimRule(80, 2),
            TrimRule(120, 5),
            TrimRule(175, 8),
            TrimRule(250, 12),
        ],
        deploy_rules=[
            DeployRule(-20, 50),
            DeployRule(-30, 75),
            DeployRule(-40, 100),
        ],
    )


def make_approach5_age_gated(min_age=36):
    """Approach 5: Only trim after bull is X months old."""
    return Strategy(
        name=f"Approach 5: Age-Gated Trims (min {min_age}mo)",
        trim_rules=[
            TrimRule(80, 2, min_bull_age_months=min_age),
            TrimRule(120, 5, min_bull_age_months=min_age),
            TrimRule(175, 8, min_bull_age_months=min_age),
            TrimRule(250, 12, min_bull_age_months=min_age),
        ],
        deploy_rules=[
            DeployRule(-20, 20),
            DeployRule(-30, 30),
            DeployRule(-40, 50),
        ],
    )


def make_approach6_asymmetric():
    """Approach 6: Tiny trims, massive deploys."""
    return Strategy(
        name="Approach 6: Asymmetric (tiny trim, massive deploy)",
        trim_rules=[
            TrimRule(80, 1),
            TrimRule(120, 2),
            TrimRule(175, 3),
            TrimRule(250, 4),
        ],
        deploy_rules=[
            DeployRule(-15, 50),
            DeployRule(-25, 100),
        ],
    )


def make_approach8_hybrid(min_age=36, decay_months=24, redeploy_pct=75):
    """Approach 8: Hybrid - age-gated trims + time decay + aggressive deploy."""
    return Strategy(
        name=f"Hybrid: age>{min_age}mo, decay={decay_months}mo/{redeploy_pct}%",
        trim_rules=[
            TrimRule(80, 1.5, min_bull_age_months=min_age),
            TrimRule(120, 3, min_bull_age_months=min_age),
            TrimRule(175, 5, min_bull_age_months=min_age),
            TrimRule(250, 7, min_bull_age_months=min_age),
        ],
        deploy_rules=[
            DeployRule(-15, 40),
            DeployRule(-25, 60),
            DeployRule(-35, 100),
        ],
        time_decay=TimeDecayRule(decay_months, redeploy_pct),
    )


# ─── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 80)
    print("BULL/BEAR STRATEGY BACKTESTER")
    print("14 Historical Cycles, 1932-2024")
    print("=" * 80)

    # 1. Baseline
    baseline = run_backtest(make_baseline())
    print_backtest(baseline)

    # 2. Approach 1: Low trim
    a1 = run_backtest(make_approach1_low_trim())
    print_backtest(a1)

    # 3. Approach 2: Time decay (various parameters)
    for decay_m in [12, 18, 24, 36]:
        for redeploy in [50, 75, 100]:
            a2 = run_backtest(make_approach2_time_decay(decay_m, redeploy))
            print_backtest(a2, verbose=False)

    # 4. Approach 3: Aggressive deploy
    a3 = run_backtest(make_approach3_aggressive_deploy())
    print_backtest(a3)

    # 5. Approach 5: Age-gated trims
    for age in [24, 36, 48, 60]:
        a5 = run_backtest(make_approach5_age_gated(age))
        print_backtest(a5, verbose=False)

    # 6. Approach 6: Asymmetric
    a6 = run_backtest(make_approach6_asymmetric())
    print_backtest(a6)

    # 7. Approach 8: Hybrid
    for age in [24, 36, 48]:
        for decay in [18, 24, 36]:
            for redeploy in [50, 75, 100]:
                a8 = run_backtest(make_approach8_hybrid(age, decay, redeploy))
                print_backtest(a8, verbose=False)

    print("\n\n")
    print("=" * 80)
    print("PHASE 2: DETAILED OPTIMIZATION")
    print("=" * 80)
