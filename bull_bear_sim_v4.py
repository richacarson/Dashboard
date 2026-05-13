#!/usr/bin/env python3
"""
Bull/Bear Trim Strategy Simulator v4

Key insight: measuring returns AT THE TROUGH is wrong. The strategy's value
comes from deploying cash DURING the bear and benefiting from the RECOVERY.

The correct measurement point is at recovery (when price returns to the
previous peak), or equivalently, at the START of the next bull.

At recovery, price = peak_price again. So:
- Benchmark: value = 1 share * peak_price = peak_price (same as start of bear)
- Strategy: shares_total * peak_price + remaining_cash

This makes deploy massively more valuable: buying at -30% and riding back to 0%
gives a 42.9% return on that deployed cash.

Let me also consider: the "return" over a cycle might be measured differently.
Perhaps it's the CAGR from cycle start to cycle end, compared between strategy
and benchmark.

Actually, the simplest interpretation that could produce the user's numbers:
- Total return from start of bull to END of bear (recovery to peak level)
- At recovery: price = peak_price
- Strategy benefit: deployed cash bought shares at a discount, those shares
  are now worth peak_price, generating excess return
"""

from dataclasses import dataclass
from typing import List, Tuple, Optional
import math

@dataclass
class BullMarket:
    name: str
    gain_pct: float
    duration_mo: float

@dataclass
class BearMarket:
    name: str
    drawdown_pct: float
    duration_mo: float
    recovery_mo: float

@dataclass
class Cycle:
    label: str
    bull: BullMarket
    bear: BearMarket

CYCLES = [
    Cycle("1932-37/Depression Recovery", BullMarket("1932-37", 324.8, 57), BearMarket("1937-38", 54.5, 12.8, 95.6)),
    Cycle("1938-40/Pre-WWII", BullMarket("1938", 62.2, 7.3), BearMarket("WWII", 34.5, 17.6, 25.2)),
    Cycle("1942-46/Post-WWII", BullMarket("1942-46", 157.7, 49), BearMarket("Post-WWII", 28.8, 11.6, 39.5)),
    Cycle("1947-56/Eisenhower", BullMarket("1947-56", 267.0, 86), BearMarket("Eisenhower", 21.6, 14.7, 11.0)),
    Cycle("1957-61/Kennedy", BullMarket("1957-61", 86.3, 49.7), BearMarket("Kennedy", 28.0, 6.5, 14.3)),
    Cycle("1962-66/Mid-60s", BullMarket("1962-66", 79.8, 43.5), BearMarket("Credit Crunch", 22.2, 7.9, 6.9)),
    Cycle("1966-68/Late-60s", BullMarket("1966-68", 48.0, 25.7), BearMarket("Vietnam", 36.1, 17.9, 21.4)),
    Cycle("1970-73/OPEC", BullMarket("1970-73", 73.5, 31.5), BearMarket("OPEC", 48.2, 20.7, 69.5)),
    Cycle("1974-80/Volcker", BullMarket("1974-80", 125.6, 73.9), BearMarket("Volcker", 27.1, 20.5, 2.8)),
    Cycle("1982-87/Black Monday", BullMarket("1982-87", 228.8, 60.4), BearMarket("Black Monday", 33.5, 3.3, 19.7)),
    Cycle("1987-00/Dot-Com", BullMarket("1987-2000", 582.0, 147.6), BearMarket("Dot-Com", 49.1, 30.5, 55.6)),
    Cycle("2002-07/GFC", BullMarket("2002-07", 101.5, 60), BearMarket("GFC", 56.8, 17.0, 48.8)),
    Cycle("2009-20/COVID", BullMarket("2009-20", 400.5, 131.4), BearMarket("COVID", 33.9, 1.1, 4.9)),
    Cycle("2020-22/2022 Inflation", BullMarket("2020-22", 114.4, 21.3), BearMarket("2022", 25.4, 9.3, 15.3)),
]

@dataclass
class StrategyParams:
    age_gate_mo: int
    trim_tiers: List[Tuple[float, float]]
    decay_mo: int
    deploy_triggers: List[Tuple[float, float]]
    max_trim_cap: Optional[float] = None


def simulate_cycle(cycle: Cycle, params: StrategyParams) -> dict:
    """
    Simulate one cycle. Measure at RECOVERY (price returns to peak).

    At recovery:
    - Benchmark: 1 share * peak_price = peak_price (started with 1 share at $1)
    - Strategy: total_shares * peak_price + remaining_cash

    Alpha = (strategy_recovery_value - benchmark_recovery_value) / 1.0 * 100
    Since both measure from starting value of 1.0.

    Actually, let me think about this more carefully.

    The cycle return for benchmark = (peak_price - 1) * 100 = bull gain.
    Wait no. From cycle start to recovery: price goes from 1 to peak_price,
    then drops, then recovers back to peak_price.
    Benchmark return = peak_price - 1.0 (same as bull gain).

    Strategy return = (total_shares * peak_price + remaining_cash) - 1.0.

    But the strategy SOLD shares during the bull (reducing shares) and
    BOUGHT during the bear (increasing shares at lower cost).

    If no decay and no redeploy during bull:
    - Sold X% at various prices during bull. Cash = sum of sales.
    - Portfolio at peak: (1-X_effective) * peak_price + cash
    - Deploy during bear: buy shares at discount prices.
    - At recovery: those discounted shares are now worth peak_price.
    - Remaining cash stays as cash.

    The alpha comes from: buying at bear prices, which at recovery become
    worth peak_price. The gain per deployed dollar at drawdown D is:
    peak_price / (peak_price * (1-D)) - 1 = 1/(1-D) - 1 = D/(1-D).

    For D=0.15 (deploy at -15%): gain = 17.6%
    For D=0.30 (deploy at -30%): gain = 42.9%

    This is potentially VERY significant for cycles with cash at bear start.
    """
    bull = cycle.bull
    bear = cycle.bear

    bull_total = bull.gain_pct / 100.0
    bull_months = bull.duration_mo

    shares = 1.0
    cash = 0.0

    tiers_triggered = [False] * len(params.trim_tiers)
    last_trim_month = None
    total_trimmed_pct = 0.0

    num_months = int(math.ceil(bull_months))

    for month in range(1, num_months + 1):
        t = min(month, bull_months)
        price = (1 + bull_total) ** (t / bull_months)
        cum_gain_pct = (price - 1.0) * 100

        if month < params.age_gate_mo:
            continue

        # Decay check
        if last_trim_month is not None and cash > 0:
            if month - last_trim_month >= params.decay_mo:
                shares += cash / price
                cash = 0.0
                last_trim_month = None

        # Trim checks
        for i, (threshold, trim_pct) in enumerate(params.trim_tiers):
            if not tiers_triggered[i] and cum_gain_pct >= threshold:
                effective_trim = trim_pct
                if params.max_trim_cap is not None:
                    remaining = params.max_trim_cap - total_trimmed_pct
                    if remaining <= 0:
                        continue
                    effective_trim = min(trim_pct, remaining)

                equity_val = shares * price
                trim_amount = equity_val * (effective_trim / 100.0)
                shares -= trim_amount / price
                cash += trim_amount
                total_trimmed_pct += effective_trim
                tiers_triggered[i] = True
                last_trim_month = month

    peak_price = 1.0 + bull_total
    equity_at_peak = shares * peak_price
    portfolio_at_peak = equity_at_peak + cash

    # Bear phase - deploy at trigger levels
    bear_dd = bear.drawdown_pct / 100.0
    cash_at_bear_start = cash
    cash_remaining = cash

    for trigger_dd_pct, deploy_frac_pct in sorted(params.deploy_triggers, key=lambda x: x[0]):
        trigger_dd = trigger_dd_pct / 100.0
        deploy_frac = deploy_frac_pct / 100.0

        if bear_dd >= trigger_dd and cash_remaining > 0:
            deploy_price = peak_price * (1 - trigger_dd)
            cash_to_deploy = cash_remaining * deploy_frac
            shares += cash_to_deploy / deploy_price
            cash_remaining -= cash_to_deploy

    # Value at RECOVERY (price = peak_price again)
    strategy_recovery = shares * peak_price + cash_remaining
    benchmark_recovery = 1.0 * peak_price  # 1 share at price peak_price

    # Alpha: difference in final value (starting from 1.0)
    strategy_return = (strategy_recovery - 1.0) * 100
    benchmark_return = (benchmark_recovery - 1.0) * 100
    alpha = strategy_return - benchmark_return
    # Simplified: alpha = (strategy_recovery - benchmark_recovery) * 100

    # Drawdown analysis
    # Strategy trough value
    trough_price = peak_price * (1 - bear_dd)
    strat_trough = shares * trough_price + cash_remaining
    strat_dd = (1 - strat_trough / portfolio_at_peak) * 100 if portfolio_at_peak > 0 else 0
    bench_dd = bear.drawdown_pct
    dd_red = bench_dd - strat_dd

    return {
        'cycle': cycle.label,
        'bull_gain': bull.gain_pct,
        'bull_duration': bull.duration_mo,
        'bear_drawdown': bear.drawdown_pct,
        'strategy_return': strategy_return,
        'benchmark_return': benchmark_return,
        'alpha': alpha,
        'total_trimmed_pct': total_trimmed_pct,
        'cash_pct_at_peak': (cash_at_bear_start / portfolio_at_peak * 100) if portfolio_at_peak > 0 else 0,
        'strat_dd': strat_dd,
        'bench_dd': bench_dd,
        'dd_reduction': dd_red,
        'is_win': alpha >= -0.005,
    }


def run_strategy(params: StrategyParams, verbose=False) -> dict:
    results = []
    for cycle in CYCLES:
        r = simulate_cycle(cycle, params)
        results.append(r)

    wins = sum(1 for r in results if r['is_win'])
    losses = len(results) - wins
    win_rate = wins / len(results) * 100

    total_alpha = sum(r['alpha'] for r in results)
    avg_alpha = total_alpha / len(results)

    active = [r for r in results if r['total_trimmed_pct'] > 0.01]
    avg_dd_red = (sum(r['dd_reduction'] for r in active) / len(active)) if active else 0

    alpha_bps_yr = total_alpha / 94 * 100

    summary = {
        'wins': wins,
        'losses': losses,
        'win_rate': win_rate,
        'total_alpha': total_alpha,
        'avg_alpha': avg_alpha,
        'alpha_bps_yr': alpha_bps_yr,
        'avg_dd_reduction': avg_dd_red,
        'active_cycles': len(active),
        'results': results,
        'params': params,
    }

    if verbose:
        print(f"\nStrategy: age_gate={params.age_gate_mo}, tiers={params.trim_tiers}, "
              f"decay={params.decay_mo}, deploy={params.deploy_triggers}")
        if params.max_trim_cap is not None:
            print(f"  max_trim_cap={params.max_trim_cap}%")
        print(f"  Win rate: {wins}/{len(results)} = {win_rate:.1f}%")
        print(f"  Total alpha: {total_alpha:.2f}%")
        print(f"  Alpha bps/yr: {alpha_bps_yr:.1f}")
        print(f"  Avg DD reduction (active): {avg_dd_red:.2f}pp")
        print()

        target_alphas = {
            '1932-37': 9.83, '1938-40': 0.00, '1942-46': -0.00,
            '1947-56': -1.23, '1957-61': 0.00, '1962-66': 0.00,
            '1966-68': 0.00, '1970-73': -0.00, '1974-80': 0.96,
            '1982-87': 7.06, '1987-00': -10.02, '2002-07': 2.26,
            '2009-20': 8.32, '2020-22': -0.06,
        }

        print(f"  {'Cycle':<30} {'MyAlpha':>8} {'Target':>8} {'Diff':>8} {'Trim%':>5} {'Cash%':>5} {'DDRed':>6}")
        print(f"  {'-'*30} {'-'*8} {'-'*8} {'-'*8} {'-'*5} {'-'*5} {'-'*6}")
        for r in results:
            key = None
            for k in target_alphas:
                if k in r['cycle']:
                    key = k
                    break
            target = target_alphas.get(key, 0)
            diff = r['alpha'] - target
            print(f"  {r['cycle']:<30} {r['alpha']:>7.2f}% {target:>7.2f}% {diff:>7.2f}% "
                  f"{r['total_trimmed_pct']:>4.1f}% {r['cash_pct_at_peak']:>4.1f}% {r['dd_reduction']:>5.1f}pp")

    return summary


def get_baseline_params():
    return StrategyParams(
        age_gate_mo=48,
        trim_tiers=[(100, 3), (200, 6), (300, 9), (400, 12)],
        decay_mo=18,
        deploy_triggers=[(15, 50), (30, 50)],
    )


if __name__ == "__main__":
    print("=" * 100)
    print("MODEL: Recovery-based measurement (trim % of current equity)")
    print("=" * 100)
    baseline = get_baseline_params()
    run_strategy(baseline, verbose=True)
