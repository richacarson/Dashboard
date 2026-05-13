#!/usr/bin/env python3
"""
Bull/Bear Trim Strategy Simulator v5

Key realization: the alpha might be measured as the PERCENTAGE POINT difference
in maximum drawdown from peak. That is:
- Benchmark drawdown = bear_drawdown_pct
- Strategy drawdown = less (because cash buffer)
- Alpha = benchmark_dd - strategy_dd (drawdown reduction in pp)

But the user's numbers don't match that either (1932-37 has +9.83% alpha but
DD reduction would be ~3.4pp).

Let me try another approach: maybe the DEPLOY happens at the TROUGH (not at
trigger levels), and the measurement is at the trough. This would mean all cash
gets deployed at the absolute bottom.

Actually no, let me try: measurement at TROUGH, but the deploy triggers work
such that cash buys shares at discount prices, and the benefit is measured by
how many more shares you have at the trough relative to benchmark.

Wait, I had this in v2 and it gave alpha for 2009-20 of +0.91%, not +8.32%.

Let me try measuring alpha as: percentage difference in trough-to-recovery
RETURN. When you have more shares at the trough, your recovery is faster.

Hmm, let me try yet another approach. Perhaps the strategy comparison isn't
1:1 (start with same amount). Maybe it's about the portfolio PATH:
- Start with $100
- Strategy has $100 invested
- At bull peak, strategy has (100 - trimmed) in equity + trimmed in cash
- Through the bear, equity drops but cash is protected
- The "alpha" is measured as the outperformance at the trough

Actually I had that. Let me look at the numbers more carefully.

For 1982-87/Black Monday (target alpha +7.06%):
Bull +228.8%, 60.4 months. Age gate 48.
At month 48: price = 3.288^(48/60.4) = 3.288^0.7947

Let me just compute this carefully. 3.288 = 1 + 2.288.
ln(3.288) = 1.1894. 1.1894 * 0.7947 = 0.9454. e^0.9454 = 2.574.
Gain at month 48: +157.4%. Both +100% and +150% (if using 150 threshold) trigger.
With tiers at +100%,+200%,+300%,+400%: only +100% at month 48.

At month 56: price = 3.288^(56/60.4) = e^(1.1894*0.9272) = e^1.1029 = 3.014.
Gain = +201.4%. +200% triggers. Trim another 6%.

Total trim: 9%. No +300% before bull ends (peak = +228.8%).

Shares after trims: after 3% at month 48: 0.97 shares.
After 6% of remaining at month 56: 0.97 * 0.94 = 0.9118 shares.
Cash: 0.03 * 2.574 + 0.06 * 0.97 * 3.014 = 0.0772 + 0.1754 = 0.2526.

Wait no. Trim 3% of current equity at month 48:
equity_val = 1.0 * 2.574 = 2.574
trim = 2.574 * 0.03 = 0.0772
shares = 1.0 - 0.0772/2.574 = 1.0 - 0.03 = 0.97
cash = 0.0772

Trim 6% of current equity at month 56:
equity_val = 0.97 * 3.014 = 2.924
trim = 2.924 * 0.06 = 0.1754
shares = 0.97 - 0.1754/3.014 = 0.97 - 0.0582 = 0.9118
cash = 0.0772 + 0.1754 = 0.2526

No decay (48+18=66 > 60.4, so decay doesn't fire before bull ends).

At peak: equity = 0.9118 * 3.288 = 2.998. Portfolio = 2.998 + 0.253 = 3.251.
Cash% of portfolio = 0.253/3.251 = 7.8%.

Bear: -33.5%. Trough price = 3.288 * 0.665 = 2.187.
Deploy at -15%: price = 3.288 * 0.85 = 2.795. 50% of 0.253 = 0.126.
Shares bought = 0.126/2.795 = 0.0451.
Deploy at -30%: price = 3.288 * 0.70 = 2.302. 50% of remaining 0.126 = 0.063.
Shares bought = 0.063/2.302 = 0.0274.

Total shares = 0.9118 + 0.0451 + 0.0274 = 0.9843.
Remaining cash = 0.063.

At trough: strategy = 0.9843 * 2.187 + 0.063 = 2.153 + 0.063 = 2.216.
Benchmark: 1.0 * 2.187 = 2.187.
Alpha = (2.216 - 2.187) * 100 = 2.92%.

But target is 7.06%. That's a big gap.

What if "deploy -15% -> 50%, -30% -> remaining 50%" means:
deploy at -15%: put in 50% of total starting cash (0.126).
deploy at -30%: put in remaining (another 0.126). All deployed.

shares at trough = 0.9118 + 0.0451 + 0.126/2.302 = 0.9118 + 0.0451 + 0.0547 = 1.0116
remaining cash = 0.
strategy = 1.0116 * 2.187 = 2.212.
Alpha = (2.212 - 2.187)*100 = 2.54%. Still not 7%.

Hmm. For alpha to be 7.06%, strategy value at trough would need to be:
2.187 + 0.0706 = 2.258. With 1.0 shares benchmark at 2.187.
strategy_shares * 2.187 + cash = 2.258.
If no remaining cash: shares = 2.258/2.187 = 1.0324. We'd need 1.0324 shares.
But we only have 0.9843 (or 1.0116 at best). Not enough.

What if we measure at recovery? Then benchmark = peak = 3.288.
strategy = shares * 3.288 + remaining_cash.
For alpha = 7.06%: strategy = 3.288 + 0.0706 = 3.359.
With 0.9843 shares: 0.9843 * 3.288 + 0.063 = 3.236 + 0.063 = 3.299.
Alpha = 1.15%. Still not 7%.

With all cash deployed: 1.0116 * 3.288 + 0 = 3.326. Alpha = 3.8%. Closer but not 7%.

Let me try: maybe the measurement includes the bear's duration/recovery as
additional growth. Or maybe the trim percentages mean something different.

Actually let me try: "+100% -> 3%" means when the INDEX is up 100% from the
cycle start, you trim 3% OF THE GAIN (not the portfolio). So at +100% (portfolio=2.0),
you trim 3% of the 1.0 gain = 0.03. Same as what I have.

Let me try a MUCH larger trim: "+100% -> 3%" might mean 3% trim of EVERYTHING
AT EACH PRICE LEVEL above that threshold. Like, every month the price is above
+100%, you trim 3% of new gains.

No, that's too complex. Let me try the simplest thing: maybe the percentages are
larger than I think. "+100% -> 3%" might mean a 30% trim. Or maybe the tiers are
cumulative percentages, not incremental.

Actually wait. Re-reading: "Trim tiers: +100%->3%, +200%->6%, +300%->9%, +400%->12%"
What if these are CUMULATIVE? So at +200%, total in cash = 6% (not 3+6=9%).
That means at +200%, you trim only 3% more (6-3=3%).

Let me check:
- At +100%: trim 3% of portfolio
- At +200%: trim to total of 6%, so additional 3%
- At +300%: trim to total of 9%, so additional 3%
- At +400%: trim to total of 12%, so additional 3%

Each tier adds 3%. Let me try this.

With 1932-37 (324.8% gain, 57mo): tiers +100, +200, +300 trigger (not +400).
Cumulative model: 9% trimmed total (3+3+3).
Original model: 18% trimmed (3+6+9).

Let me see which fits the +9.83% target alpha better.
"""

from dataclasses import dataclass
from typing import List, Tuple, Optional
import math
import sys

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
    trim_tiers: List[Tuple[float, float]]  # [(threshold_pct, CUMULATIVE_trim_pct)]
    decay_mo: int
    deploy_triggers: List[Tuple[float, float]]
    max_trim_cap: Optional[float] = None
    cumulative_tiers: bool = False  # if True, tier values are cumulative targets


def get_price(bull_total, bull_months, month):
    """Get price at given month using compound growth."""
    t = min(month, bull_months)
    return (1 + bull_total) ** (t / bull_months)


def simulate_cycle(cycle, params, measure_at='trough'):
    """
    measure_at: 'trough' or 'recovery'
    """
    bull = cycle.bull
    bear = cycle.bear

    bull_total = bull.gain_pct / 100.0
    bull_months = bull.duration_mo

    shares = 1.0
    cash = 0.0
    total_trimmed_frac = 0.0  # total fraction of portfolio trimmed (for cumulative model)

    tiers_triggered = [False] * len(params.trim_tiers)
    last_trim_month = None

    num_months = int(math.ceil(bull_months))

    for month in range(1, num_months + 1):
        price = get_price(bull_total, bull_months, month)
        cum_gain_pct = (price - 1.0) * 100

        if month < params.age_gate_mo:
            continue

        # Decay
        if last_trim_month is not None and cash > 0:
            if month - last_trim_month >= params.decay_mo:
                shares += cash / price
                cash = 0.0
                last_trim_month = None
                total_trimmed_frac = 0.0  # reset for cumulative model

        # Trim
        for i, (threshold, tier_pct) in enumerate(params.trim_tiers):
            if not tiers_triggered[i] and cum_gain_pct >= threshold:
                if params.cumulative_tiers:
                    # tier_pct is the cumulative TARGET
                    additional_pct = tier_pct - total_trimmed_frac * 100
                    if additional_pct <= 0:
                        tiers_triggered[i] = True
                        continue
                    effective_pct = additional_pct
                else:
                    effective_pct = tier_pct

                if params.max_trim_cap is not None:
                    remaining = params.max_trim_cap - total_trimmed_frac * 100
                    if remaining <= 0:
                        continue
                    effective_pct = min(effective_pct, remaining)

                equity_val = shares * price
                trim_amount = equity_val * (effective_pct / 100.0)
                shares -= trim_amount / price
                cash += trim_amount
                total_trimmed_frac += effective_pct / 100.0
                tiers_triggered[i] = True
                last_trim_month = month

    peak_price = 1.0 + bull_total
    equity_at_peak = shares * peak_price
    portfolio_at_peak = equity_at_peak + cash
    cash_at_bear = cash

    # Deploy
    bear_dd = bear.drawdown_pct / 100.0
    cash_remaining = cash
    for trigger_dd_pct, deploy_frac_pct in sorted(params.deploy_triggers, key=lambda x: x[0]):
        trigger_dd = trigger_dd_pct / 100.0
        deploy_frac = deploy_frac_pct / 100.0
        if bear_dd >= trigger_dd and cash_remaining > 0:
            deploy_price = peak_price * (1 - trigger_dd)
            to_deploy = cash_remaining * deploy_frac
            shares += to_deploy / deploy_price
            cash_remaining -= to_deploy

    trough_price = peak_price * (1 - bear_dd)

    if measure_at == 'trough':
        strat_val = shares * trough_price + cash_remaining
        bench_val = 1.0 * trough_price
    else:  # recovery
        strat_val = shares * peak_price + cash_remaining
        bench_val = 1.0 * peak_price

    alpha = (strat_val - bench_val) * 100

    strat_dd = (1 - (shares * trough_price + cash_remaining) / portfolio_at_peak) * 100 if portfolio_at_peak > 0 else 0
    dd_red = bear.drawdown_pct - strat_dd

    return {
        'cycle': cycle.label,
        'bull_gain': bull.gain_pct,
        'bull_duration': bull.duration_mo,
        'bear_drawdown': bear.drawdown_pct,
        'alpha': alpha,
        'total_trimmed_pct': total_trimmed_frac * 100,
        'cash_pct_at_peak': (cash_at_bear / portfolio_at_peak * 100) if portfolio_at_peak > 0 else 0,
        'dd_reduction': dd_red,
        'is_win': alpha >= -0.005,
    }


def run_strategy(params, measure_at='trough', verbose=False):
    results = [simulate_cycle(c, params, measure_at) for c in CYCLES]

    wins = sum(1 for r in results if r['is_win'])
    total_alpha = sum(r['alpha'] for r in results)
    active = [r for r in results if r['total_trimmed_pct'] > 0.01]
    avg_dd_red = (sum(r['dd_reduction'] for r in active) / len(active)) if active else 0

    summary = {
        'wins': wins,
        'losses': len(results) - wins,
        'win_rate': wins / len(results) * 100,
        'total_alpha': total_alpha,
        'alpha_bps_yr': total_alpha / 94 * 100,
        'avg_dd_reduction': avg_dd_red,
        'results': results,
    }

    if verbose:
        target_alphas = [9.83, 0.00, -0.00, -1.23, 0.00, 0.00, 0.00, -0.00,
                         0.96, 7.06, -10.02, 2.26, 8.32, -0.06]

        print(f"\n  age_gate={params.age_gate_mo}, decay={params.decay_mo}, "
              f"cumul={params.cumulative_tiers}, measure={measure_at}")
        print(f"  tiers={params.trim_tiers}")
        print(f"  deploy={params.deploy_triggers}")
        print(f"  Win: {wins}/14 = {wins/14*100:.1f}%, Alpha: {total_alpha:.2f}%, "
              f"bps/yr: {total_alpha/94*100:.1f}")
        print()
        print(f"  {'Cycle':<30} {'My':>8} {'Tgt':>8} {'Diff':>8} {'Trim':>5} {'Cash':>5}")
        print(f"  {'-'*30} {'-'*8} {'-'*8} {'-'*8} {'-'*5} {'-'*5}")
        for r, t in zip(results, target_alphas):
            d = r['alpha'] - t
            print(f"  {r['cycle']:<30} {r['alpha']:>7.2f}% {t:>7.2f}% {d:>7.2f}% "
                  f"{r['total_trimmed_pct']:>4.1f}% {r['cash_pct_at_peak']:>4.1f}%")

    return summary


if __name__ == "__main__":
    baseline = StrategyParams(
        age_gate_mo=48,
        trim_tiers=[(100, 3), (200, 6), (300, 9), (400, 12)],
        decay_mo=18,
        deploy_triggers=[(15, 50), (30, 50)],
    )

    baseline_cumul = StrategyParams(
        age_gate_mo=48,
        trim_tiers=[(100, 3), (200, 6), (300, 9), (400, 12)],
        decay_mo=18,
        deploy_triggers=[(15, 50), (30, 50)],
        cumulative_tiers=True,
    )

    print("=" * 85)
    print("INCREMENTAL TIERS, TROUGH MEASUREMENT")
    print("=" * 85)
    run_strategy(baseline, 'trough', verbose=True)

    print("\n" + "=" * 85)
    print("CUMULATIVE TIERS, TROUGH MEASUREMENT")
    print("=" * 85)
    run_strategy(baseline_cumul, 'trough', verbose=True)

    print("\n" + "=" * 85)
    print("INCREMENTAL TIERS, RECOVERY MEASUREMENT")
    print("=" * 85)
    run_strategy(baseline, 'recovery', verbose=True)

    print("\n" + "=" * 85)
    print("CUMULATIVE TIERS, RECOVERY MEASUREMENT")
    print("=" * 85)
    run_strategy(baseline_cumul, 'recovery', verbose=True)

    # Try with deploy at trough (all cash deployed at bottom)
    print("\n" + "=" * 85)
    print("INCREMENTAL, TROUGH MEAS, DEPLOY ALL AT TROUGH")
    print("=" * 85)
    baseline_trough_deploy = StrategyParams(
        age_gate_mo=48,
        trim_tiers=[(100, 3), (200, 6), (300, 9), (400, 12)],
        decay_mo=18,
        deploy_triggers=[(15, 50), (30, 100)],  # deploy all by -30%
    )
    run_strategy(baseline_trough_deploy, 'trough', verbose=True)
