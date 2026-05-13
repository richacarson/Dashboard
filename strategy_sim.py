#!/usr/bin/env python3
"""
Bull/Bear Trimming Strategy Simulator

Simulates a tactical strategy that trims equity positions during extended bull markets
and redeploys cash during bear market drawdowns. Compares against a 100% buy-and-hold benchmark.

Key mechanics:
- Age gate: only begin trimming after bull market reaches a minimum age
- Trim tiers: sell portions at cumulative gain thresholds
- Time decay: if no bear arrives within N months of trimming, redeploy cash
- Deploy triggers: buy back during bear market drawdowns in tranches
"""

import itertools
import json
import sys
from dataclasses import dataclass, field
from typing import List, Tuple, Optional

# ─────────────────────────────────────────────────────────────────────
# Historical Data
# ─────────────────────────────────────────────────────────────────────

@dataclass
class BullMarket:
    name: str
    gain_pct: float      # total gain in percent
    duration_mo: float   # duration in months

@dataclass
class BearMarket:
    name: str
    drawdown_pct: float  # drawdown in percent (positive number = loss)
    duration_mo: float
    recovery_mo: float

@dataclass
class Cycle:
    """A full bull→bear cycle."""
    cycle_id: int
    label: str
    bull: BullMarket
    bear: BearMarket

# Bull markets in chronological order
BULLS = [
    BullMarket("1932-37", 324.8, 57),
    BullMarket("1938", 62.2, 7.3),
    BullMarket("1942-46", 157.7, 49),
    BullMarket("1947-56", 267.0, 86),
    BullMarket("1957-61", 86.3, 49.7),
    BullMarket("1962-66", 79.8, 43.5),
    BullMarket("1966-68", 48.0, 25.7),
    BullMarket("1970-73", 73.5, 31.5),
    BullMarket("1974-80", 125.6, 73.9),
    BullMarket("1982-87", 228.8, 60.4),
    BullMarket("1987-2000", 582.0, 147.6),
    BullMarket("2002-07", 101.5, 60),
    BullMarket("2009-20", 400.5, 131.4),
    BullMarket("2020-22", 114.4, 21.3),
]

# Bear markets following each bull (in same order)
BEARS = [
    BearMarket("1937-38/Great Depression aftermath", 54.5, 12.8, 95.6),
    BearMarket("WWII", 34.5, 17.6, 25.2),
    BearMarket("Post-WWII", 28.8, 11.6, 39.5),
    BearMarket("Eisenhower", 21.6, 14.7, 11.0),
    BearMarket("Kennedy", 28.0, 6.5, 14.3),
    BearMarket("Credit Crunch", 22.2, 7.9, 6.9),
    BearMarket("Vietnam", 36.1, 17.9, 21.4),
    BearMarket("OPEC", 48.2, 20.7, 69.5),
    BearMarket("Volcker", 27.1, 20.5, 2.8),
    BearMarket("Black Monday", 33.5, 3.3, 19.7),
    BearMarket("Dot-Com", 49.1, 30.5, 55.6),
    BearMarket("GFC", 56.8, 17.0, 48.8),
    BearMarket("COVID", 33.9, 1.1, 4.9),
    BearMarket("2022 Inflation", 25.4, 9.3, 15.3),
]

CYCLES = [
    Cycle(i, f"{BULLS[i].name}/{BEARS[i].name}", BULLS[i], BEARS[i])
    for i in range(14)
]

CYCLE_LABELS = [
    "1932-37/1937-38",
    "1938/WWII",
    "1942-46/Post-WWII",
    "1947-56/Eisenhower",
    "1957-61/Kennedy",
    "1962-66/Credit Crunch",
    "1966-68/Vietnam",
    "1970-73/OPEC",
    "1974-80/Volcker",
    "1982-87/Black Monday",
    "1987-00/Dot-Com",
    "2002-07/GFC",
    "2009-20/COVID",
    "2020-22/2022 Inflation",
]

# ─────────────────────────────────────────────────────────────────────
# Strategy Parameters
# ─────────────────────────────────────────────────────────────────────

@dataclass
class StrategyParams:
    age_gate_mo: int = 48          # months before trimming allowed
    trim_tiers: List[Tuple[float, float]] = field(default_factory=lambda: [
        (1.0, 0.03),   # +100% gain → trim 3% of portfolio
        (2.0, 0.06),   # +200% gain → trim 6%
        (3.0, 0.09),   # +300% gain → trim 9%
        (4.0, 0.12),   # +400% gain → trim 12%
    ])
    decay_mo: int = 18             # months after last trim before cash redeploys
    deploy_triggers: List[Tuple[float, float]] = field(default_factory=lambda: [
        (0.15, 0.50),  # at -15% drawdown, deploy 50% of cash reserves
        (0.30, 1.00),  # at -30% drawdown, deploy remaining 100% of cash
    ])

    def description(self) -> str:
        tiers_str = ", ".join(f"+{int(g*100)}%→{int(t*100)}%" for g, t in self.trim_tiers)
        deploy_str = ", ".join(f"-{int(d*100)}%→{int(p*100)}%" for d, p in self.deploy_triggers)
        return (f"Age={self.age_gate_mo}mo, Tiers=[{tiers_str}], "
                f"Decay={self.decay_mo}mo, Deploy=[{deploy_str}]")


# ─────────────────────────────────────────────────────────────────────
# Simulation Engine
# ─────────────────────────────────────────────────────────────────────

@dataclass
class CycleResult:
    cycle_id: int
    label: str
    benchmark_mult: float      # buy-and-hold multiplier for this cycle
    strategy_mult: float       # strategy multiplier for this cycle
    alpha_pct: float           # (strategy - benchmark) as percentage
    cash_at_bear_start: float  # fraction of portfolio in cash when bear begins
    is_win: bool               # alpha >= 0

def simulate_cycle(cycle: Cycle, params: StrategyParams) -> CycleResult:
    """
    Simulate one bull→bear cycle.

    During the bull phase, the portfolio grows. Once the bull is old enough
    (age gate), we trim at each gain tier. Trimmed cash sits idle.
    If the bull continues past decay_mo after the last trim without a bear,
    the cash redeploys (we assume it goes back to equities at current prices).

    During the bear phase, we deploy cash at specified drawdown levels,
    buying equities at lower prices.

    We model this as multiplicative returns on a normalized $1 portfolio.
    """
    bull = cycle.bull
    bear = cycle.bear

    # ── Bull Phase ──
    # Model the bull as a continuous compounding over duration_mo months.
    # Monthly return factor: (1 + gain)^(1/duration)
    bull_total_mult = 1.0 + bull.gain_pct / 100.0  # e.g., 324.8% → 4.248

    # We need to track month-by-month to apply age gate and trim logic
    equity_frac = 1.0   # fraction of portfolio in equities
    cash_frac = 0.0     # fraction of portfolio in cash

    # Monthly growth rate for equities
    if bull.duration_mo > 0:
        monthly_growth = bull_total_mult ** (1.0 / bull.duration_mo)
    else:
        monthly_growth = bull_total_mult

    # Track cumulative gain from bull start for trim tier logic
    cumulative_price_mult = 1.0  # price multiplier from bull start

    # Track which tiers have been triggered
    tiers_triggered = set()
    last_trim_month = None
    cash_redeployed = False

    total_months = int(round(bull.duration_mo))

    for month in range(1, total_months + 1):
        # Grow equity portion
        cumulative_price_mult *= monthly_growth
        equity_frac *= monthly_growth

        cumulative_gain = cumulative_price_mult - 1.0  # e.g., 3.248 for +324.8%

        # Check age gate
        if month < params.age_gate_mo:
            continue

        # Check if we should redeploy due to decay
        if last_trim_month is not None and not cash_redeployed:
            months_since_trim = month - last_trim_month
            if months_since_trim >= params.decay_mo:
                # Redeploy all cash back to equities at current prices
                equity_frac += cash_frac
                cash_frac = 0.0
                cash_redeployed = True
                # Don't check tiers this month - we just redeployed
                continue

        # Check trim tiers
        for i, (gain_threshold, trim_pct) in enumerate(params.trim_tiers):
            if i not in tiers_triggered and cumulative_gain >= gain_threshold:
                # Trim trim_pct of current TOTAL portfolio value
                total_value = equity_frac + cash_frac
                trim_amount = total_value * trim_pct
                if trim_amount <= equity_frac:
                    equity_frac -= trim_amount
                    cash_frac += trim_amount
                    tiers_triggered.add(i)
                    last_trim_month = month
                    cash_redeployed = False

    # ── At end of bull / start of bear ──
    total_portfolio_pre_bear = equity_frac + cash_frac
    benchmark_pre_bear = bull_total_mult  # buy-and-hold grew by bull multiplier

    # ── Bear Phase ──
    bear_drawdown = bear.drawdown_pct / 100.0  # e.g., 0.545 for -54.5%

    # Benchmark simply takes the full drawdown
    benchmark_post_bear = benchmark_pre_bear * (1.0 - bear_drawdown)

    # Strategy: equity portion takes drawdown, cash deploys at trigger levels
    # We need to model the drawdown path
    # Simplification: assume linear drawdown path, deploy at specified levels

    remaining_cash = cash_frac
    final_equity = equity_frac  # will be reduced by drawdown, increased by deployments

    # Sort deploy triggers by drawdown level
    sorted_triggers = sorted(params.deploy_triggers, key=lambda x: x[0])

    cash_at_start = remaining_cash  # for reporting

    # Track deployments: each deployment buys at a specific drawdown level
    # The equity bought at drawdown level d has a cost basis of (1-d) relative to peak
    # At the bottom, everything is at (1-max_drawdown) of peak
    # Then recovery happens

    # Model:
    # - Original equity falls by full bear_drawdown
    # - Cash deployed at drawdown level d buys equity at price (1-d) relative to peak
    #   Those shares are worth (1-bear_drawdown)/(1-d) at the bottom, then recover
    #   At end of bear (trough), each $1 deployed at level d buys 1/(1-d) shares
    #   Those shares at trough are worth (1-bear_drawdown)/(1-d) per dollar deployed
    #   Actually at the END of recovery (bear cycle end), price is back to peak
    #   Wait - we need to be more careful about what "end of cycle" means.

    # Let's think about it differently:
    # The bear takes the market from peak to trough: price goes from P to P*(1-drawdown)
    # At the END of the full cycle (bull+bear), the benchmark is:
    #   $1 * bull_mult * (1 - drawdown)
    #
    # For the strategy:
    # - Equity portion: equity_frac * (1 - drawdown) [takes full drawdown on remaining equity]
    # - Cash deployed at level d: buys at price P*(1-d), each $1 buys 1/(1-d) units
    #   At trough, each unit is worth (1-drawdown), so each $1 deployed is worth (1-drawdown)/(1-d)
    #   BUT: If drawdown < d, the trigger never fires and cash stays as cash
    # - Undeployed cash: stays as $1 per $1

    # Original equity takes full drawdown
    strategy_equity_value = equity_frac * (1.0 - bear_drawdown)
    strategy_cash_value = 0.0

    for trigger_level, deploy_frac in sorted_triggers:
        if bear_drawdown >= trigger_level and remaining_cash > 0:
            # This trigger fires - deploy deploy_frac of ORIGINAL cash reserves
            deploy_amount = cash_at_start * deploy_frac
            # But can't deploy more than remaining
            deploy_amount = min(deploy_amount, remaining_cash)
            remaining_cash -= deploy_amount

            # Deployed at price (1 - trigger_level) relative to pre-bear peak
            # At trough, price is (1 - bear_drawdown) relative to pre-bear peak
            # Value of deployed cash at trough:
            value_at_trough = deploy_amount * (1.0 - bear_drawdown) / (1.0 - trigger_level)
            strategy_equity_value += value_at_trough
        # If trigger doesn't fire, cash stays as cash

    # Any remaining cash that wasn't deployed stays as cash
    strategy_cash_value = remaining_cash

    # Total strategy value at bear trough
    strategy_post_bear = strategy_equity_value + strategy_cash_value

    # ── Compute alpha ──
    # Alpha is the percentage difference in end-of-cycle portfolio value
    # relative to start-of-cycle $1
    benchmark_return = benchmark_post_bear - 1.0  # total return from cycle start
    strategy_return = strategy_post_bear - 1.0

    # But actually, both start at $1, so:
    # benchmark final = bull_mult * (1 - drawdown)
    # strategy final = strategy_post_bear
    # alpha = strategy_return - benchmark_return = strategy_post_bear - benchmark_post_bear

    # Express alpha as percentage of starting value
    alpha_pct = (strategy_post_bear - benchmark_post_bear) * 100.0

    # A cycle is a "win" if alpha >= 0 (strategy does at least as well as benchmark)
    is_win = alpha_pct >= -0.005  # small tolerance for floating point

    return CycleResult(
        cycle_id=cycle.cycle_id,
        label=CYCLE_LABELS[cycle.cycle_id],
        benchmark_mult=benchmark_post_bear,
        strategy_mult=strategy_post_bear,
        alpha_pct=alpha_pct,
        cash_at_bear_start=cash_at_start / (equity_frac + cash_at_start) if (equity_frac + cash_at_start) > 0 else 0,
        is_win=is_win,
    )


def simulate_all_cycles(params: StrategyParams) -> List[CycleResult]:
    """Run the strategy across all 14 historical bull/bear cycles."""
    return [simulate_cycle(cycle, params) for cycle in CYCLES]


def summarize_results(results: List[CycleResult], params: StrategyParams, verbose: bool = True) -> dict:
    """Compute aggregate statistics and optionally print results."""
    wins = sum(1 for r in results if r.is_win)
    losses = sum(1 for r in results if not r.is_win)
    win_rate = wins / len(results)

    total_alpha = sum(r.alpha_pct for r in results)
    avg_alpha = total_alpha / len(results)

    # Average alpha in active cycles (where strategy actually did something)
    active_results = [r for r in results if abs(r.alpha_pct) > 0.005]
    avg_active_alpha = (sum(r.alpha_pct for r in active_results) / len(active_results)) if active_results else 0

    # Drawdown reduction in active cycles
    active_with_cash = [r for r in results if r.cash_at_bear_start > 0.005]

    if verbose:
        print(f"\n{'='*90}")
        print(f"Strategy: {params.description()}")
        print(f"{'='*90}")
        print(f"\n{'Cycle':<28} {'Bench':>8} {'Strat':>8} {'Alpha%':>8} {'Cash%':>7} {'Result':>8}")
        print(f"{'-'*28} {'-'*8} {'-'*8} {'-'*8} {'-'*7} {'-'*8}")

        for r in results:
            result_str = "WIN" if r.is_win else "LOSS"
            cash_pct = r.cash_at_bear_start * 100
            print(f"{r.label:<28} {r.benchmark_mult:>8.4f} {r.strategy_mult:>8.4f} "
                  f"{r.alpha_pct:>+8.2f} {cash_pct:>6.1f}% {result_str:>8}")

        print(f"\n{'Summary':}")
        print(f"  Win rate: {wins}/{len(results)} = {win_rate:.1%}")
        print(f"  Total alpha: {total_alpha:+.2f}%")
        print(f"  Avg alpha/cycle: {avg_alpha:+.4f}%")
        print(f"  Avg alpha (bps/yr approx): {avg_alpha * 100 / 7:.1f} bps")
        print(f"  Active cycles: {len(active_results)}")
        if active_results:
            print(f"  Avg active alpha: {avg_active_alpha:+.4f}%")

    return {
        'wins': wins,
        'losses': losses,
        'win_rate': win_rate,
        'total_alpha': total_alpha,
        'avg_alpha': avg_alpha,
        'results': results,
        'params': params,
    }


# ─────────────────────────────────────────────────────────────────────
# Main: Validate baseline
# ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 90)
    print("BASELINE STRATEGY VALIDATION")
    print("=" * 90)

    baseline = StrategyParams()
    results = simulate_all_cycles(baseline)
    summary = summarize_results(results, baseline)

    print(f"\nExpected: 9/14 wins (64%), ~+7.3 bps/yr alpha")
    print(f"Got:      {summary['wins']}/14 wins ({summary['win_rate']:.0%}), "
          f"{summary['avg_alpha'] * 100 / 7:.1f} bps/yr approx")
