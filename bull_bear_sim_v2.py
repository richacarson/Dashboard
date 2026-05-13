#!/usr/bin/env python3
"""
Bull/Bear Trim Strategy Simulator v2

Refined model to match known baseline results.

Key modeling decisions:
- Trim tiers: "+100% -> 3%" means when cumulative gain from bull start reaches +100%,
  sell 3% of the ORIGINAL starting portfolio value. So at +100%, portfolio = 2.0,
  and we sell 0.03 (3% of original 1.0). This is a fixed-dollar amount per tier.
- Age gate: no trimming until bull is N months old
- Time decay: if M months pass since last trim without a bear, redeploy all cash
  at current prices
- Deploy: at -X% drawdown from peak, deploy Y% of cash reserves at that price level

The key difference from v1: trim is a fraction of ORIGINAL position, not current.
Also: careful about how redeploy affects things, and how deploy at drawdown levels works.

Actually, let me reconsider. Looking at the known results:
- 1942-46: 157.7% gain, 49 months, age gate 48. This means trimming starts at month 48.
  At month 48, gain ~ 157.7*(48/49) path... but we need to check thresholds.
  With 48mo age gate: bull is 49 months. Only month 49 qualifies (or 48 if 0-indexed).
  Gain at month 48 of 49: roughly 153%. So +100% tier triggers (3% trim).
  +200% doesn't trigger (only 153%).
  Then bear = -28.8%. Deploy at -15%: yes. Deploy at -30%: no (only -28.8%).

  User says alpha = -0.00% for this cycle. So the trim/deploy should produce ~0 or
  slightly negative alpha.

- 2009-20: 400.5% gain, 131.4 months, age gate 48.
  From month 48 onwards, gain ~ 400.5*(48/131.4)^... compound path.
  +100%, +200%, +300%, +400% all trigger. Trims: 3+6+9+12 = 30% total.
  But with decay: 18 months after each trim, cash redeploys.
  User says alpha = +8.32%. So trimming and redeploying works well here.
  The bull is SO long that trims happen early, decay redeploys,
  and by the time bear arrives, most cash has been redeployed.
  Wait - but the bear IS COVID (-33.9%), so having some cash should help...
  Actually +8.32% alpha means strategy beats B&H significantly.

Let me reconsider the entire model more carefully.

Maybe "trim 3% at +100%" means: at the +100% gain level, move 3% of current equity
to cash. Let me try modeling it differently.

Actually, I think the critical insight is about WHEN things happen in a long bull with
decay. Let me model this properly with actual monthly stepping.
"""

from dataclasses import dataclass
from typing import List, Tuple, Optional
import itertools
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

@dataclass
class StrategyParams:
    age_gate_mo: int
    trim_tiers: List[Tuple[float, float]]  # [(gain_threshold_pct, trim_pct), ...]
    decay_mo: int
    deploy_triggers: List[Tuple[float, float]]  # [(drawdown_pct, fraction_of_reserves), ...]
    max_trim_cap: Optional[float] = None

def simulate_cycle(cycle: Cycle, params: StrategyParams) -> dict:
    """
    Simulate one bull+bear cycle.

    Model: Start with portfolio value = 1.0, all in equity.
    Price grows during bull from 1.0 to (1 + gain).
    Growth is compound (log-linear in time).

    Trimming: at each tier, sell trim_pct% of CURRENT portfolio equity value.
    Trimmed amount goes to cash (earns 0 return).

    After trimming, fewer shares remain. Cash sits idle.

    Decay: if decay_mo months pass since last trim, redeploy ALL cash by buying
    shares at current price.

    Bear: equity price drops from peak. At each deploy trigger level,
    deploy fraction of remaining cash reserves at that price.

    Final value = shares * trough_price + remaining_cash
    Alpha = (strategy_return - benchmark_return)
    """
    bull = cycle.bull
    bear = cycle.bear

    bull_total = bull.gain_pct / 100.0
    bull_months = bull.duration_mo

    # Price at month t: P(t) = (1 + bull_total)^(t / bull_months)
    # So P(0) = 1, P(bull_months) = 1 + bull_total

    shares = 1.0  # start with 1 share at price 1.0
    cash = 0.0

    tiers_triggered = [False] * len(params.trim_tiers)
    last_trim_month = None
    total_trimmed_pct = 0.0  # track total % trimmed (for cap)

    # Track decay/redeploy events
    redeploy_events = []
    trim_events = []

    # Monthly simulation through the bull
    num_months = int(math.ceil(bull_months))

    for month in range(1, num_months + 1):
        # Fractional month for the last partial month
        t = min(month, bull_months)
        price = (1 + bull_total) ** (t / bull_months)
        cum_gain_pct = (price - 1.0) * 100  # gain from price=1.0

        # Age gate check
        if month < params.age_gate_mo:
            continue

        # Time decay check: redeploy if enough time since last trim
        if last_trim_month is not None and cash > 0:
            months_since_trim = month - last_trim_month
            if months_since_trim >= params.decay_mo:
                # Redeploy all cash
                new_shares = cash / price
                shares += new_shares
                redeploy_events.append((month, cash, price))
                cash = 0.0
                last_trim_month = None  # reset
                # Don't reset tiers - they stay triggered

        # Trim tier checks (process in order of threshold)
        for i, (threshold, trim_pct) in enumerate(params.trim_tiers):
            if not tiers_triggered[i] and cum_gain_pct >= threshold:
                # Apply max trim cap if set
                effective_trim_pct = trim_pct
                if params.max_trim_cap is not None:
                    remaining_cap = params.max_trim_cap - total_trimmed_pct
                    if remaining_cap <= 0:
                        continue
                    effective_trim_pct = min(trim_pct, remaining_cap)

                # Sell effective_trim_pct% of current equity value
                equity_value = shares * price
                trim_amount = equity_value * (effective_trim_pct / 100.0)
                shares_sold = trim_amount / price  # = shares * effective_trim_pct/100

                shares -= shares_sold
                cash += trim_amount
                total_trimmed_pct += effective_trim_pct
                tiers_triggered[i] = True
                last_trim_month = month
                trim_events.append((month, threshold, effective_trim_pct, price))

    # End of bull
    peak_price = 1.0 + bull_total

    # Portfolio at peak
    equity_at_peak = shares * peak_price
    portfolio_at_peak = equity_at_peak + cash

    # Benchmark at peak
    benchmark_at_peak = 1.0 * peak_price

    # Bear phase
    bear_dd = bear.drawdown_pct / 100.0  # e.g., 0.545 for 54.5%
    trough_price = peak_price * (1 - bear_dd)

    # Deploy cash at trigger levels
    cash_remaining = cash
    deploy_triggers_sorted = sorted(params.deploy_triggers, key=lambda x: x[0])

    for trigger_dd_pct, deploy_frac_pct in deploy_triggers_sorted:
        trigger_dd = trigger_dd_pct / 100.0
        deploy_frac = deploy_frac_pct / 100.0

        if bear_dd >= trigger_dd and cash_remaining > 0:
            # Deploy at this drawdown level
            deploy_price = peak_price * (1 - trigger_dd)
            cash_to_deploy = cash_remaining * deploy_frac
            new_shares = cash_to_deploy / deploy_price
            shares += new_shares
            cash_remaining -= cash_to_deploy

    # Final values at trough
    strategy_value = shares * trough_price + cash_remaining
    benchmark_value = 1.0 * trough_price  # 1 share at trough price

    strategy_return = (strategy_value - 1.0) * 100
    benchmark_return = (benchmark_value - 1.0) * 100
    alpha = strategy_return - benchmark_return

    # Drawdown calculations
    strategy_dd = (1 - strategy_value / portfolio_at_peak) * 100 if portfolio_at_peak > 0 else 0
    benchmark_dd = bear.drawdown_pct
    dd_reduction = benchmark_dd - strategy_dd

    return {
        'cycle': cycle.label,
        'bull_gain': bull.gain_pct,
        'bull_duration': bull.duration_mo,
        'bear_drawdown': bear.drawdown_pct,
        'strategy_return': strategy_return,
        'benchmark_return': benchmark_return,
        'alpha': alpha,
        'total_trimmed_pct': total_trimmed_pct,
        'cash_pct_at_peak': (cash / portfolio_at_peak * 100) if portfolio_at_peak > 0 else 0,
        'strategy_dd': strategy_dd,
        'benchmark_dd': benchmark_dd,
        'dd_reduction': dd_reduction,
        'is_win': alpha >= -0.005,
        'trim_events': trim_events,
        'redeploy_events': redeploy_events,
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
    }

    if verbose:
        print(f"\nStrategy: age_gate={params.age_gate_mo}mo, "
              f"tiers={params.trim_tiers}, "
              f"decay={params.decay_mo}mo, "
              f"deploy={params.deploy_triggers}")
        if params.max_trim_cap is not None:
            print(f"  max_trim_cap={params.max_trim_cap}%")
        print(f"  Win rate: {wins}/{len(results)} = {win_rate:.1f}%")
        print(f"  Total alpha: {total_alpha:.2f}%")
        print(f"  Alpha bps/yr: {alpha_bps_yr:.1f}")
        print(f"  Avg DD reduction (active): {avg_dd_red:.2f}pp")
        print()
        print(f"  {'Cycle':<32} {'BullG':>6} {'BullM':>5} {'BearDD':>6} "
              f"{'Trim%':>5} {'Cash%':>5} {'Alpha':>8} {'DDRed':>6} {'W':>2}")
        print(f"  {'-'*32} {'-'*6} {'-'*5} {'-'*6} "
              f"{'-'*5} {'-'*5} {'-'*8} {'-'*6} {'-'*2}")
        for r in results:
            w = "Y" if r['is_win'] else "N"
            print(f"  {r['cycle']:<32} {r['bull_gain']:>5.1f}% {r['bull_duration']:>5.1f} "
                  f"{r['bear_drawdown']:>5.1f}% {r['total_trimmed_pct']:>4.1f}% "
                  f"{r['cash_pct_at_peak']:>4.1f}% {r['alpha']:>7.2f}% "
                  f"{r['dd_reduction']:>5.1f}pp {w:>2}")

        # Show trim/redeploy details for key cycles
        print("\n  Detailed trim/redeploy events for key cycles:")
        for r in results:
            if r['trim_events'] or r['redeploy_events']:
                print(f"\n  {r['cycle']}:")
                for ev in r['trim_events']:
                    month, thresh, pct, price = ev
                    print(f"    Month {month}: TRIM at +{thresh}% (price={price:.3f}), trimmed {pct:.1f}%")
                for ev in r['redeploy_events']:
                    month, amount, price = ev
                    print(f"    Month {month}: REDEPLOY ${amount:.4f} at price={price:.3f}")

    return summary


def get_baseline_params():
    return StrategyParams(
        age_gate_mo=48,
        trim_tiers=[(100, 3), (200, 6), (300, 9), (400, 12)],
        decay_mo=18,
        deploy_triggers=[(15, 50), (30, 50)],
    )


if __name__ == "__main__":
    print("=" * 90)
    print("BASELINE STRATEGY VALIDATION (v2)")
    print("=" * 90)
    baseline = get_baseline_params()
    summary = run_strategy(baseline, verbose=True)
