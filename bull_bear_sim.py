#!/usr/bin/env python3
"""
Bull/Bear Trim Strategy Simulator

Models a strategy that:
1. During bull markets: trims equity gains into cash reserves based on gain tiers
2. Applies an age gate: no trimming until the bull is N months old
3. Applies time decay: if no bear arrives within M months of last trim, redeploy cash
4. During bear markets: deploys cash reserves at drawdown triggers

We compare strategy total return vs buy-and-hold across each full cycle (bull+bear).
Alpha = strategy return - benchmark return for each cycle.
Win = alpha >= 0.
"""

import itertools
import json
import sys
from dataclasses import dataclass, field
from typing import List, Tuple, Optional

# ============================================================
# DATA
# ============================================================

@dataclass
class BullMarket:
    name: str
    gain_pct: float      # total gain in %
    duration_mo: float   # duration in months

@dataclass
class BearMarket:
    name: str
    drawdown_pct: float  # max drawdown in % (positive number = loss)
    duration_mo: float
    recovery_mo: float

@dataclass
class Cycle:
    label: str
    bull: BullMarket
    bear: BearMarket

# Historical cycles (14 total)
CYCLES = [
    Cycle("1932-37/Depression Recovery",
          BullMarket("1932-37", 324.8, 57),
          BearMarket("1937-38", 54.5, 12.8, 95.6)),
    Cycle("1938-40/Pre-WWII",
          BullMarket("1938", 62.2, 7.3),
          BearMarket("WWII", 34.5, 17.6, 25.2)),
    Cycle("1942-46/Post-WWII",
          BullMarket("1942-46", 157.7, 49),
          BearMarket("Post-WWII", 28.8, 11.6, 39.5)),
    Cycle("1947-56/Eisenhower",
          BullMarket("1947-56", 267.0, 86),
          BearMarket("Eisenhower", 21.6, 14.7, 11.0)),
    Cycle("1957-61/Kennedy",
          BullMarket("1957-61", 86.3, 49.7),
          BearMarket("Kennedy", 28.0, 6.5, 14.3)),
    Cycle("1962-66/Mid-60s",
          BullMarket("1962-66", 79.8, 43.5),
          BearMarket("Credit Crunch", 22.2, 7.9, 6.9)),
    Cycle("1966-68/Late-60s",
          BullMarket("1966-68", 48.0, 25.7),
          BearMarket("Vietnam", 36.1, 17.9, 21.4)),
    Cycle("1970-73/OPEC",
          BullMarket("1970-73", 73.5, 31.5),
          BearMarket("OPEC", 48.2, 20.7, 69.5)),
    Cycle("1974-80/Volcker",
          BullMarket("1974-80", 125.6, 73.9),
          BearMarket("Volcker", 27.1, 20.5, 2.8)),
    Cycle("1982-87/Black Monday",
          BullMarket("1982-87", 228.8, 60.4),
          BearMarket("Black Monday", 33.5, 3.3, 19.7)),
    Cycle("1987-00/Dot-Com",
          BullMarket("1987-2000", 582.0, 147.6),
          BearMarket("Dot-Com", 49.1, 30.5, 55.6)),
    Cycle("2002-07/GFC",
          BullMarket("2002-07", 101.5, 60),
          BearMarket("GFC", 56.8, 17.0, 48.8)),
    Cycle("2009-20/COVID",
          BullMarket("2009-20", 400.5, 131.4),
          BearMarket("COVID", 33.9, 1.1, 4.9)),
    Cycle("2020-22/2022 Inflation",
          BullMarket("2020-22", 114.4, 21.3),
          BearMarket("2022", 25.4, 9.3, 15.3)),
]

# ============================================================
# STRATEGY PARAMETERS
# ============================================================

@dataclass
class StrategyParams:
    age_gate_mo: int              # months before trimming starts
    trim_tiers: List[Tuple[float, float]]  # [(gain_threshold%, trim_pct%), ...]
    decay_mo: int                 # months after last trim to redeploy if no bear
    deploy_triggers: List[Tuple[float, float]]  # [(drawdown_threshold%, deploy_pct_of_reserves%), ...]
    max_trim_cap: Optional[float] = None  # optional cap on total trim %

# ============================================================
# SIMULATION
# ============================================================

def simulate_cycle(cycle: Cycle, params: StrategyParams) -> dict:
    """
    Simulate one bull+bear cycle.

    Model:
    - Start with $1 fully invested in equities.
    - During the bull, equity grows. We model the bull as producing its total gain
      over its duration. We check monthly whether trim thresholds are hit.
    - Trimming: when cumulative bull gain crosses a tier threshold AND the bull is
      past the age gate, we move trim_pct of the ORIGINAL position to cash.
      Each tier is checked once (one-time trim at each level).
    - Time decay: if decay_mo months pass after the last trim with no bear,
      we redeploy all cash back to equities at current prices.
    - During the bear, equities drop. At each deploy trigger drawdown level,
      we deploy the specified fraction of remaining cash reserves into equities.

    Returns dict with strategy return, benchmark return, alpha, cash trimmed, etc.
    """
    bull = cycle.bull
    bear = cycle.bear

    # We model monthly price levels during the bull
    # Assume compound growth: price(t) = 1 * (1 + total_gain)^(t/T)
    bull_total = bull.gain_pct / 100.0  # e.g., 3.248 for 324.8%
    bull_months = bull.duration_mo

    # Monthly growth rate
    if bull_months > 0 and bull_total > 0:
        monthly_growth = (1 + bull_total) ** (1.0 / bull_months) - 1
    else:
        monthly_growth = 0

    # State
    equity_shares = 1.0    # shares owned (normalized)
    cash = 0.0             # cash reserves
    price = 1.0            # starting price
    tiers_triggered = [False] * len(params.trim_tiers)
    last_trim_month = None
    decayed = False
    total_trimmed_frac = 0.0  # fraction of original position trimmed

    # Simulate bull month by month
    for month in range(1, int(bull_months) + 1):
        price = 1.0 * (1 + bull_total) ** (month / bull_months)
        cum_gain_pct = (price - 1.0) / 1.0 * 100  # cumulative gain from start

        # Check age gate
        if month < params.age_gate_mo:
            continue

        # Check time decay: if we've trimmed and decay_mo months passed
        if last_trim_month is not None and not decayed:
            if month - last_trim_month >= params.decay_mo:
                # Redeploy all cash at current price
                if cash > 0:
                    shares_bought = cash / price
                    equity_shares += shares_bought
                    cash = 0.0
                    decayed = True
                    # Reset tiers so they could potentially re-trigger?
                    # No - standard approach is one-time triggers per cycle

        # Check trim tiers
        for i, (threshold, trim_pct) in enumerate(params.trim_tiers):
            if not tiers_triggered[i] and cum_gain_pct >= threshold:
                # Check max trim cap
                effective_trim = trim_pct / 100.0
                if params.max_trim_cap is not None:
                    remaining_cap = params.max_trim_cap / 100.0 - total_trimmed_frac
                    if remaining_cap <= 0:
                        continue
                    effective_trim = min(effective_trim, remaining_cap)

                # Trim: sell effective_trim of ORIGINAL position value at current price
                # But we need to think about this carefully.
                # "Trim 3% at +100%" means: sell 3% of the portfolio at that point
                # Let's model: sell trim_pct% of current equity holdings
                shares_to_sell = equity_shares * effective_trim
                cash += shares_to_sell * price
                equity_shares -= shares_to_sell
                total_trimmed_frac += effective_trim
                tiers_triggered[i] = True
                last_trim_month = month
                decayed = False

    # End of bull: price at peak
    peak_price = 1.0 + bull_total  # = 1 * (1 + gain)

    # Portfolio value at peak (before bear)
    equity_value_at_peak = equity_shares * peak_price
    portfolio_at_peak = equity_value_at_peak + cash

    # Benchmark at peak
    benchmark_at_peak = peak_price  # $1 * (1 + gain)

    # Now simulate the bear
    bear_drawdown = bear.drawdown_pct / 100.0  # fraction lost from peak
    bear_bottom_price = peak_price * (1 - bear_drawdown)

    # Deploy triggers during bear
    cash_remaining = cash
    shares_added = 0.0
    deploy_triggers_sorted = sorted(params.deploy_triggers, key=lambda x: x[0])

    for trigger_dd, deploy_frac in deploy_triggers_sorted:
        trigger_dd_frac = trigger_dd / 100.0
        deploy_frac_frac = deploy_frac / 100.0

        # Does the bear reach this drawdown level?
        if bear_drawdown >= trigger_dd_frac:
            # Deploy at this price level
            deploy_price = peak_price * (1 - trigger_dd_frac)
            cash_to_deploy = cash_remaining * deploy_frac_frac
            if cash_to_deploy > 0 and deploy_price > 0:
                shares_bought = cash_to_deploy / deploy_price
                shares_added += shares_bought
                cash_remaining -= cash_to_deploy

    # After bear: what's the portfolio worth?
    # At the bear bottom? No - we should measure at the end of the cycle.
    # The standard approach: measure return over the full cycle.
    # Full cycle return = value at bear bottom / starting value - 1
    # But actually the "return" should account for eventual recovery.
    #
    # Let me reconsider: for a fair comparison, we measure the portfolio value
    # at the bear's trough relative to start. Both strategy and benchmark
    # experience the same bear trough price.

    # Strategy value at bear trough:
    total_shares = equity_shares + shares_added
    strategy_value_at_trough = total_shares * bear_bottom_price + cash_remaining

    # Benchmark value at bear trough:
    benchmark_value_at_trough = 1.0 * bear_bottom_price  # started with $1 at price $1

    # Returns
    strategy_return = (strategy_value_at_trough / 1.0 - 1) * 100
    benchmark_return = (benchmark_value_at_trough / 1.0 - 1) * 100
    alpha = strategy_return - benchmark_return

    # Drawdown from peak
    strategy_peak_value = portfolio_at_peak
    strategy_drawdown = (1 - strategy_value_at_trough / strategy_peak_value) * 100 if strategy_peak_value > 0 else 0
    benchmark_drawdown = bear_drawdown * 100  # same as bear.drawdown_pct
    drawdown_reduction = benchmark_drawdown - strategy_drawdown

    return {
        'cycle': cycle.label,
        'bull_gain': bull.gain_pct,
        'bull_duration': bull.duration_mo,
        'bear_drawdown': bear.drawdown_pct,
        'strategy_return': strategy_return,
        'benchmark_return': benchmark_return,
        'alpha': alpha,
        'cash_at_bear_start': cash / portfolio_at_peak * 100 if portfolio_at_peak > 0 else 0,
        'total_trimmed_pct': total_trimmed_frac * 100,
        'strategy_drawdown': strategy_drawdown,
        'benchmark_drawdown': benchmark_drawdown,
        'drawdown_reduction': drawdown_reduction,
        'is_win': alpha >= -0.005,  # >= 0 with small tolerance for floating point
    }


def run_strategy(params: StrategyParams, verbose=False) -> dict:
    """Run strategy across all 14 cycles and compute summary stats."""
    results = []
    for cycle in CYCLES:
        r = simulate_cycle(cycle, params)
        results.append(r)

    wins = sum(1 for r in results if r['is_win'])
    losses = sum(1 for r in results if not r['is_win'])
    win_rate = wins / len(results) * 100

    total_alpha = sum(r['alpha'] for r in results)
    avg_alpha = total_alpha / len(results)

    # Average drawdown reduction across cycles where trimming occurred
    active_cycles = [r for r in results if r['total_trimmed_pct'] > 0.01]
    avg_dd_reduction = sum(r['drawdown_reduction'] for r in active_cycles) / len(active_cycles) if active_cycles else 0

    # Cumulative alpha in bps/yr (approximate)
    # 14 cycles span roughly 94 years (1932-2026)
    total_years = 94
    alpha_bps_yr = total_alpha / total_years * 100  # convert pct to bps, then per year

    summary = {
        'wins': wins,
        'losses': losses,
        'win_rate': win_rate,
        'total_alpha': total_alpha,
        'avg_alpha': avg_alpha,
        'alpha_bps_yr': alpha_bps_yr,
        'avg_drawdown_reduction': avg_dd_reduction,
        'active_cycles': len(active_cycles),
        'results': results,
    }

    if verbose:
        print(f"\nStrategy: age_gate={params.age_gate_mo}mo, "
              f"tiers={params.trim_tiers}, "
              f"decay={params.decay_mo}mo, "
              f"deploy={params.deploy_triggers}")
        if params.max_trim_cap:
            print(f"  max_trim_cap={params.max_trim_cap}%")
        print(f"  Win rate: {wins}/{len(results)} = {win_rate:.1f}%")
        print(f"  Total alpha: {total_alpha:.2f}%")
        print(f"  Alpha bps/yr: {alpha_bps_yr:.1f}")
        print(f"  Avg drawdown reduction (active): {avg_dd_reduction:.2f}pp")
        print()
        print(f"  {'Cycle':<30} {'Alpha':>8} {'Trim%':>6} {'DDRed':>6} {'Win':>4}")
        print(f"  {'-'*30} {'-'*8} {'-'*6} {'-'*6} {'-'*4}")
        for r in results:
            win_str = "Y" if r['is_win'] else "N"
            print(f"  {r['cycle']:<30} {r['alpha']:>8.2f}% {r['total_trimmed_pct']:>5.1f}% "
                  f"{r['drawdown_reduction']:>5.1f}pp {win_str:>4}")

    return summary


# ============================================================
# CURRENT BASELINE STRATEGY
# ============================================================

def get_baseline_params():
    return StrategyParams(
        age_gate_mo=48,
        trim_tiers=[(100, 3), (200, 6), (300, 9), (400, 12)],
        decay_mo=18,
        deploy_triggers=[(15, 50), (30, 50)],
    )


if __name__ == "__main__":
    print("=" * 80)
    print("BASELINE STRATEGY VALIDATION")
    print("=" * 80)

    baseline = get_baseline_params()
    summary = run_strategy(baseline, verbose=True)
