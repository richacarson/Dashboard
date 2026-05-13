#!/usr/bin/env python3
"""
Bull/Bear Strategy Backtester - Expanded 22-Bear Dataset
=========================================================
Rigorous month-by-month simulation of trim/deploy strategy.

Strategy mechanics:
- Age gate: Only trim if bull has run >= age_gate months
- Trim tiers: When market gain from bull start crosses threshold,
  move portfolio to target cash % (incremental trims)
- Time decay: If bull runs decay_months after last trim without a bear,
  redeploy all cash back to equity (and allow re-trimming)
- Deploy: When bear drawdown from peak crosses threshold, deploy
  specified fraction of cash reserves into equity
- After full cycle, any remaining cash is redeployed for next cycle

Alpha = strategy total return - buy-and-hold total return per cycle
"""

import math
from dataclasses import dataclass, field
from typing import List, Tuple, Optional

# Risk-free rate (approximate average T-bill across the full historical span)
RISK_FREE_ANNUAL = 0.035
RISK_FREE_MONTHLY = (1 + RISK_FREE_ANNUAL) ** (1/12) - 1


@dataclass
class Cycle:
    name: str
    bull_gain_pct: float       # total bull gain %
    bull_months: float         # bull duration in months
    bear_drawdown_pct: float   # bear drawdown % from peak (positive number, e.g. 83.0)
    bear_months: float         # bear duration in months


# 21 Bull->Bear cycles from the expanded dataset
# Each cycle: bull rally followed by the subsequent bear
CYCLES_22 = [
    Cycle("1929-30 rally -> 1930-32 Depression",   46.8,   5.0,  83.0, 25.7),
    Cycle("1932 rally -> 1932-33 Decline",        111.6,   3.0,  40.6,  5.7),
    Cycle("1933 rally -> 1933 Decline",           120.6,   5.0,  29.8,  3.1),
    Cycle("1933-34 rally -> 1934-35 Decline",      37.9,   4.0,  31.8, 13.2),
    Cycle("1935-37 -> 1937-38 Recession",         131.8,  24.0,  54.5, 12.8),
    Cycle("1938 -> 1938-39 War Fears",             62.2,   8.0,  26.2,  4.9),
    Cycle("1939 -> 1939-40 Fall of France",        29.8,   6.0,  31.9,  7.5),
    Cycle("1940 -> WWII Pearl Harbor",             26.8,   5.0,  34.5, 17.6),
    Cycle("1942-46 -> Post-WWII",                 157.7,  49.0,  28.8, 11.6),
    Cycle("1947-48 -> 1948-49 Recession",          20.8,  13.0,  20.6, 11.9),
    Cycle("1949-56 -> Eisenhower",                267.0,  86.0,  21.6, 14.7),
    Cycle("1957-61 -> Kennedy",                    86.3,  49.7,  28.0,  6.5),
    Cycle("1962-66 -> Credit Crunch",              79.8,  43.5,  22.2,  7.9),
    Cycle("1966-68 -> Vietnam",                    48.0,  25.7,  36.1, 17.9),
    Cycle("1970-73 -> OPEC",                       73.5,  31.5,  48.2, 20.7),
    Cycle("1974-80 -> Volcker",                   125.6,  73.9,  27.1, 20.5),
    Cycle("1982-87 -> Black Monday",              228.8,  60.4,  33.5,  3.3),
    Cycle("1987-2000 -> Dot-Com",                 582.0, 147.6,  49.1, 30.5),
    Cycle("2002-07 -> GFC",                       101.5,  60.0,  56.8, 17.0),
    Cycle("2009-20 -> COVID",                     400.5, 131.4,  33.9,  1.1),
    Cycle("2020-22 -> Inflation",                 114.4,  21.3,  25.4,  9.3),
]


@dataclass
class TrimTier:
    gain_pct: float        # market gain threshold (e.g. 75 for +75%)
    cash_target_pct: float # target cash allocation (e.g. 1 for 1%)


@dataclass
class DeployTier:
    drawdown_pct: float       # bear drawdown threshold (e.g. 25 for -25%)
    deploy_pct_of_cash: float # fraction of cash to deploy (e.g. 50 for 50%)


@dataclass
class Strategy:
    age_gate_months: float
    trim_tiers: List[TrimTier]
    time_decay_months: float       # months after last trim to redeploy cash
    deploy_tiers: List[DeployTier]


def make_current_strategy():
    """The current strategy as specified."""
    return Strategy(
        age_gate_months=21,
        trim_tiers=[
            TrimTier(75, 1),
            TrimTier(150, 3),
            TrimTier(250, 5),
            TrimTier(350, 7),
            TrimTier(500, 9),
        ],
        time_decay_months=24,
        deploy_tiers=[
            DeployTier(25, 50),
            DeployTier(30, 100),  # remaining 50% = 100% of what's left
        ],
    )


def simulate_cycle(cycle: Cycle, strategy: Strategy, verbose: bool = False) -> dict:
    """
    Simulate one bull->bear cycle month by month.

    Returns detailed results including alpha.
    """
    # Monthly growth rates
    bull_total_mult = 1 + cycle.bull_gain_pct / 100
    if cycle.bull_months > 0:
        bull_monthly_rate = bull_total_mult ** (1.0 / cycle.bull_months) - 1
    else:
        bull_monthly_rate = 0

    bear_total_mult = 1 - cycle.bear_drawdown_pct / 100  # e.g., 1 - 0.83 = 0.17
    if cycle.bear_months > 0:
        bear_monthly_rate = bear_total_mult ** (1.0 / cycle.bear_months) - 1
    else:
        bear_monthly_rate = 0

    # Portfolio starts at $1 equity, $0 cash
    equity = 1.0
    cash = 0.0
    bnh = 1.0  # buy and hold benchmark

    # Tracking
    triggered_trims = set()
    triggered_deploys = set()
    last_trim_month = None
    month_counter = 0
    time_decay_fired = False
    trims_log = []
    deploys_log = []

    # ── BULL PHASE ──
    # We simulate month by month. For fractional months, handle at the end.
    total_bull_months_int = int(math.floor(cycle.bull_months))
    bull_frac = cycle.bull_months - total_bull_months_int

    for m in range(1, total_bull_months_int + 1):
        # Grow everything
        equity *= (1 + bull_monthly_rate)
        cash *= (1 + RISK_FREE_MONTHLY)
        bnh *= (1 + bull_monthly_rate)
        month_counter += 1

        # Market gain from start of bull
        market_gain_pct = (bnh - 1.0) * 100

        # Age gate check
        if month_counter >= strategy.age_gate_months:
            # Check trim tiers (in order)
            for i, tier in enumerate(strategy.trim_tiers):
                if i in triggered_trims:
                    continue
                if market_gain_pct >= tier.gain_pct:
                    # Trim: move equity to cash to reach target cash %
                    total_val = equity + cash
                    current_cash_pct = (cash / total_val) * 100 if total_val > 0 else 0
                    if tier.cash_target_pct > current_cash_pct:
                        move_pct = tier.cash_target_pct - current_cash_pct
                        move_amount = total_val * move_pct / 100
                        equity -= move_amount
                        cash += move_amount
                        if verbose:
                            trims_log.append(f"  Month {month_counter}: Trim tier {tier.gain_pct}%->target {tier.cash_target_pct}% cash. Moved ${move_amount:.4f}. Cash now ${cash:.4f} ({cash/(equity+cash)*100:.2f}%)")
                    triggered_trims.add(i)
                    last_trim_month = month_counter

        # Time decay check
        if strategy.time_decay_months > 0 and last_trim_month is not None:
            months_since_trim = month_counter - last_trim_month
            if months_since_trim >= strategy.time_decay_months and cash > 0:
                if verbose:
                    trims_log.append(f"  Month {month_counter}: TIME DECAY - {months_since_trim}mo since last trim. Redeploying ${cash:.4f} cash.")
                equity += cash
                cash = 0
                last_trim_month = None
                triggered_trims.clear()  # Allow re-trimming
                time_decay_fired = True

    # Handle fractional month at end of bull
    if bull_frac > 0:
        frac_rate = (1 + bull_monthly_rate) ** bull_frac - 1
        equity *= (1 + frac_rate)
        cash *= (1 + RISK_FREE_MONTHLY * bull_frac)
        bnh *= (1 + frac_rate)
        month_counter += bull_frac

        # Check trims one more time at the very end
        market_gain_pct = (bnh - 1.0) * 100
        if month_counter >= strategy.age_gate_months:
            for i, tier in enumerate(strategy.trim_tiers):
                if i in triggered_trims:
                    continue
                if market_gain_pct >= tier.gain_pct:
                    total_val = equity + cash
                    current_cash_pct = (cash / total_val) * 100 if total_val > 0 else 0
                    if tier.cash_target_pct > current_cash_pct:
                        move_pct = tier.cash_target_pct - current_cash_pct
                        move_amount = total_val * move_pct / 100
                        equity -= move_amount
                        cash += move_amount
                    triggered_trims.add(i)
                    last_trim_month = month_counter

    pre_bear_portfolio = equity + cash
    pre_bear_cash = cash
    pre_bear_cash_pct = (cash / pre_bear_portfolio) * 100 if pre_bear_portfolio > 0 else 0
    pre_bear_bnh = bnh

    # ── BEAR PHASE ──
    bear_start_bnh = bnh
    bear_start_equity = equity  # for tracking

    total_bear_months_int = int(math.floor(cycle.bear_months))
    bear_frac = cycle.bear_months - total_bear_months_int

    for m in range(1, total_bear_months_int + 1):
        equity *= (1 + bear_monthly_rate)
        cash *= (1 + RISK_FREE_MONTHLY)
        bnh *= (1 + bear_monthly_rate)
        month_counter += 1

        # Current bear drawdown from peak
        current_dd_pct = (1 - bnh / bear_start_bnh) * 100  # positive number

        # Check deploy tiers
        for i, tier in enumerate(strategy.deploy_tiers):
            if i in triggered_deploys:
                continue
            if current_dd_pct >= tier.drawdown_pct:
                if cash > 0:
                    deploy_amount = cash * tier.deploy_pct_of_cash / 100
                    equity += deploy_amount
                    cash -= deploy_amount
                    if verbose:
                        deploys_log.append(f"  Month {month_counter}: Deploy at -{tier.drawdown_pct}%. Deployed ${deploy_amount:.4f} ({tier.deploy_pct_of_cash}% of cash). Remaining cash ${cash:.4f}")
                triggered_deploys.add(i)

    # Handle fractional month at end of bear
    if bear_frac > 0:
        frac_rate = (1 + bear_monthly_rate) ** bear_frac - 1
        equity *= (1 + frac_rate)
        cash *= (1 + RISK_FREE_MONTHLY * bear_frac)
        bnh *= (1 + frac_rate)
        month_counter += bear_frac

        # Check deploys one more time
        current_dd_pct = (1 - bnh / bear_start_bnh) * 100
        for i, tier in enumerate(strategy.deploy_tiers):
            if i in triggered_deploys:
                continue
            if current_dd_pct >= tier.drawdown_pct:
                if cash > 0:
                    deploy_amount = cash * tier.deploy_pct_of_cash / 100
                    equity += deploy_amount
                    cash -= deploy_amount
                triggered_deploys.add(i)

    # Final values
    final_portfolio = equity + cash
    final_bnh = bnh

    strategy_return_pct = (final_portfolio / 1.0 - 1) * 100
    bnh_return_pct = (final_bnh / 1.0 - 1) * 100
    alpha_pct = strategy_return_pct - bnh_return_pct

    # Also compute as a ratio for multiplicative chaining
    # Alpha ratio: final_portfolio / final_bnh
    alpha_ratio = final_portfolio / final_bnh if final_bnh > 0 else 1.0

    total_months_actual = cycle.bull_months + cycle.bear_months
    years = total_months_actual / 12

    if verbose:
        print(f"\n--- {cycle.name} ---")
        print(f"  Bull: +{cycle.bull_gain_pct}% over {cycle.bull_months}mo | Bear: -{cycle.bear_drawdown_pct}% over {cycle.bear_months}mo")
        print(f"  Age gate: {'BLOCKS trimming' if cycle.bull_months < strategy.age_gate_months else 'allows trimming'} (bull={cycle.bull_months}mo, gate={strategy.age_gate_months}mo)")
        for log in trims_log:
            print(log)
        print(f"  Pre-bear: Portfolio=${pre_bear_portfolio:.4f}, Cash=${pre_bear_cash:.4f} ({pre_bear_cash_pct:.1f}%), B&H=${pre_bear_bnh:.4f}")
        for log in deploys_log:
            print(log)
        print(f"  Final: Portfolio=${final_portfolio:.4f}, B&H=${final_bnh:.4f}")
        print(f"  Return: Strategy={strategy_return_pct:+.2f}%, B&H={bnh_return_pct:+.2f}%, Alpha={alpha_pct:+.4f}%")
        if time_decay_fired:
            print(f"  ** Time decay fired during this cycle **")

    # Determine which trims fired
    n_trims_fired = len(triggered_trims)
    n_deploys_fired = len(triggered_deploys)
    age_blocked = cycle.bull_months < strategy.age_gate_months

    return {
        'cycle': cycle.name,
        'bull_gain': cycle.bull_gain_pct,
        'bull_months': cycle.bull_months,
        'bear_dd': cycle.bear_drawdown_pct,
        'bear_months': cycle.bear_months,
        'age_blocked': age_blocked,
        'n_trims': n_trims_fired,
        'pre_bear_cash_pct': pre_bear_cash_pct,
        'time_decay_fired': time_decay_fired,
        'n_deploys': n_deploys_fired,
        'strategy_return': strategy_return_pct,
        'bnh_return': bnh_return_pct,
        'alpha_pct': alpha_pct,
        'alpha_ratio': alpha_ratio,
        'final_portfolio': final_portfolio,
        'final_bnh': final_bnh,
        'total_months': total_months_actual,
    }


def run_full_backtest(strategy: Strategy, cycles: List[Cycle] = None, verbose: bool = False):
    """Run strategy across all cycles."""
    if cycles is None:
        cycles = CYCLES_22

    results = []
    for cycle in cycles:
        r = simulate_cycle(cycle, strategy, verbose=verbose)
        results.append(r)

    # Aggregate
    alphas = [r['alpha_pct'] for r in results]
    wins = sum(1 for a in alphas if a > 0)
    ties = sum(1 for a in alphas if a == 0)
    losses = sum(1 for a in alphas if a < 0)

    # Cumulative: chain all cycles
    cum_strategy = 1.0
    cum_bnh = 1.0
    total_months = 0
    for r in results:
        cum_strategy *= r['final_portfolio']
        cum_bnh *= r['final_bnh']
        total_months += r['total_months']

    total_years = total_months / 12
    cum_strat_cagr = (cum_strategy ** (1/total_years) - 1) * 100 if total_years > 0 else 0
    cum_bnh_cagr = (cum_bnh ** (1/total_years) - 1) * 100 if total_years > 0 else 0
    cum_alpha_cagr = cum_strat_cagr - cum_bnh_cagr

    return {
        'results': results,
        'n_cycles': len(results),
        'wins': wins,
        'ties': ties,
        'losses': losses,
        'win_rate': wins / len(results),
        'non_loss_rate': (wins + ties) / len(results),
        'avg_alpha': sum(alphas) / len(alphas),
        'median_alpha': sorted(alphas)[len(alphas)//2],
        'min_alpha': min(alphas),
        'max_alpha': max(alphas),
        'cum_strategy': cum_strategy,
        'cum_bnh': cum_bnh,
        'cum_strat_cagr': cum_strat_cagr,
        'cum_bnh_cagr': cum_bnh_cagr,
        'cum_alpha_cagr': cum_alpha_cagr,
        'total_years': total_years,
        'total_months': total_months,
    }


def print_results(bt: dict, strategy_name: str = "Strategy"):
    """Pretty-print results."""
    print(f"\n{'='*120}")
    print(f"  {strategy_name}")
    print(f"{'='*120}")

    print(f"\n{'#':<3} {'Cycle':<42} {'Bull%':>6} {'BullMo':>6} {'Bear%':>6} {'BearMo':>6} "
          f"{'AgeBlk':>6} {'Trims':>5} {'Cash%':>6} {'Decay':>5} {'Dply':>4} "
          f"{'StratRet':>9} {'B&HRet':>9} {'Alpha%':>9}")
    print("-" * 120)

    for i, r in enumerate(bt['results']):
        print(f"{i+1:<3} {r['cycle']:<42} {r['bull_gain']:>6.1f} {r['bull_months']:>6.1f} "
              f"{r['bear_dd']:>6.1f} {r['bear_months']:>6.1f} "
              f"{'YES' if r['age_blocked'] else 'no':>6} {r['n_trims']:>5} "
              f"{r['pre_bear_cash_pct']:>6.1f} {'YES' if r['time_decay_fired'] else 'no':>5} "
              f"{r['n_deploys']:>4} "
              f"{r['strategy_return']:>+9.2f} {r['bnh_return']:>+9.2f} {r['alpha_pct']:>+9.4f}")

    print("-" * 120)

    print(f"\n  Win Rate:           {bt['wins']}/{bt['n_cycles']} ({bt['win_rate']:.1%})")
    print(f"  Non-Loss Rate:      {bt['wins']+bt['ties']}/{bt['n_cycles']} ({bt['non_loss_rate']:.1%})")
    print(f"  Losses:             {bt['losses']}")
    print(f"  Avg Alpha:          {bt['avg_alpha']:+.4f}%")
    print(f"  Median Alpha:       {bt['median_alpha']:+.4f}%")
    print(f"  Min Alpha:          {bt['min_alpha']:+.4f}%")
    print(f"  Max Alpha:          {bt['max_alpha']:+.4f}%")
    print(f"  Cum Strategy:       {bt['cum_strategy']:.4f}x")
    print(f"  Cum B&H:            {bt['cum_bnh']:.4f}x")
    print(f"  Cum CAGR Strategy:  {bt['cum_strat_cagr']:.4f}%")
    print(f"  Cum CAGR B&H:       {bt['cum_bnh_cagr']:.4f}%")
    print(f"  Cum Alpha CAGR:     {bt['cum_alpha_cagr']:+.4f}% ({bt['cum_alpha_cagr']*100:+.1f} bps/yr)")
    print(f"  Total span:         {bt['total_years']:.1f} years ({bt['total_months']:.0f} months)")


# ─── MAIN ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 80)
    print("BACKTEST: EXPANDED 22-BEAR / 21-CYCLE DATASET")
    print("=" * 80)

    # Step 1: Run current strategy
    current = make_current_strategy()
    bt = run_full_backtest(current, verbose=True)
    print_results(bt, "CURRENT STRATEGY (Age=21mo, Trims=75/150/250/350/500, Decay=24, Deploy=-25/-30)")

    # Identify losing cycles
    print("\n\n--- LOSING CYCLES (Alpha < 0) ---")
    for r in bt['results']:
        if r['alpha_pct'] < 0:
            print(f"  {r['cycle']}: alpha = {r['alpha_pct']:+.4f}%")
            print(f"    Bull: +{r['bull_gain']}% over {r['bull_months']}mo")
            print(f"    Bear: -{r['bear_dd']}% over {r['bear_months']}mo")
            print(f"    Age blocked: {r['age_blocked']}, Trims: {r['n_trims']}, Cash: {r['pre_bear_cash_pct']:.1f}%, Deploys: {r['n_deploys']}")

    # Ties (no effect)
    print("\n--- ZERO-ALPHA CYCLES ---")
    for r in bt['results']:
        if r['alpha_pct'] == 0:
            print(f"  {r['cycle']}: alpha = {r['alpha_pct']:+.4f}%")
