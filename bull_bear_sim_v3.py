#!/usr/bin/env python3
"""
Bull/Bear Trim Strategy Simulator v3

Testing different interpretation: trim_pct is % of the TOTAL portfolio
(equity + cash) to move from equity to cash.

Also testing: maybe the deploy fractions are of TOTAL cash, not remaining cash.
e.g., -15% -> deploy 50% of total reserves, -30% -> deploy 50% of total reserves
(which means the second tranche deploys 50% of original reserves, potentially
even if some was already deployed).

Actually the simplest interpretation that might match:
- Deploy: -15% -> 50% of reserves = half of whatever cash you have
- Deploy: -30% -> remaining 50% = the other half = all remaining cash

Let me also try: the gain thresholds might be measured against the INITIAL portfolio
value (price=1), not current equity value. And the trim amounts might be
absolute fractions of initial.

Key issue: in the 1942-46 cycle (bull +157.7%, 49 months, age gate 48),
the user says alpha = -0.00% (a loss). With my model, I get +1.46%.
The bull barely reaches +100% by month 48 in my model.

Let me check: at month 48 of 49, price = 2.577^(48/49) = ?
Actually: (1 + 1.577)^(48/49) = 2.577^0.9796 = ?
log(2.577) * 0.9796 = 0.9468 * 0.9796 = 0.9275
e^0.9275 = 2.528. So gain = 152.8%. +100% threshold IS crossed.

So in my model, 3% trim happens. Then bear is -28.8%.
With deploy at -15%: deploy price = peak*(1-0.15) = 2.577*0.85 = 2.190
Deploy 50% of cash at 2.190.
-28.8% > 15%, so first trigger fires.
-28.8% < 30%, so second trigger does NOT fire.

Cash from trim: shares_sold = 1.0 * 0.03 = 0.03 shares. Cash = 0.03 * 2.528 = 0.0758.
After trim: shares = 0.97, cash = 0.0758.

Peak: equity = 0.97 * 2.577 = 2.500. Portfolio = 2.500 + 0.076 = 2.576.

Deploy: 50% of 0.076 = 0.038 at price 2.190. New shares = 0.038/2.190 = 0.0173.
Shares = 0.97 + 0.0173 = 0.9873. Cash remaining = 0.038.

Trough: price = 2.577 * (1-0.288) = 1.835.
Strategy = 0.9873 * 1.835 + 0.038 = 1.812 + 0.038 = 1.850.
Benchmark = 1.0 * 1.835 = 1.835.
Alpha = 1.850 - 1.835 = 0.015 = +1.5%. Not matching -0.00%.

For this to be negative, the cash drag during the last month of bull must outweigh
the bear protection. But with only 3% trimmed, cash drag is minimal.

The user says alpha = -0.00% for this cycle. One possibility: the trim happens
at a LOWER price, reducing gains more, and the deploy doesn't fully compensate.

Another possibility: the trim amounts are interpreted differently.
Maybe +100% -> 3% means: sell enough to bring the equity allocation down by 3pp.
Or: sell 3% of the gain (not the portfolio).

Let me try yet another interpretation:
"Trim tiers: +100% -> 3%, +200% -> 6%" might mean CUMULATIVE trim targets.
So at +100%, total trim = 3%. At +200%, total trim = 6% (sell another 3%).
At +300%, total trim = 9%. At +400%, total trim = 12%.

That's what I already have. Hmm.

Actually, wait. Let me re-read the user's data more carefully.

The user says the CURRENT strategy has 9/14 wins (64%) with +7.3 bps/yr alpha.
The 5 losses are: 1942-46 (-0.00%), 1947-56 (-1.23%), 1970-73 (-0.00%),
1987-00 (-10.02%), 2020-22 (-0.06%).

And the wins include: 1938-40 (0.00%), 1957-61 (0.00%), 1962-66 (0.00%),
1966-68 (0.00%).

So cycles with NO trimming (bull too short for age gate or gain too low)
are classified as WINS with 0.00% alpha. That makes sense.

The 1970-73 cycle: bull +73.5%, 31.5 months. Age gate 48. No trimming.
But the user says alpha = -0.00% (a LOSS). Why would a no-trim strategy
have negative alpha? Unless there's a baseline cost or fee.

Hmm, maybe there's a very small cost per cycle or the "0.00%" is truly
zero but it's categorized differently. The user notes: "cycles where both
strategy and benchmark return the same (0.00% alpha) count as 'wins'."
And the 5 losses have "negative alpha."

But -0.00% printed as the alpha value could just mean a very tiny negative
number that rounds to -0.00%. Perhaps there's a small management fee or
transaction cost in the model?

OR: maybe 1942-46 and 1970-73 are losses because of an extremely tiny
negative alpha from some other mechanic. The user does say these are
"near-zero losses" and suggests "tiny adjustments" could flip them.

Let me try adding a small transaction cost to trimming/deploying and see
if that explains the pattern. But actually, that would also affect
cycles that are currently showing 0.00% alpha.

Wait - 1942-46 DOES have trimming in my model (3% trim at month 48).
So it's NOT a no-trim cycle. The 1970-73 cycle has no trimming (too short).
But the user says it's a loss at -0.00%.

I think the near-zero losses might just be the user's model producing
slightly different numbers due to implementation details. Let me focus on
getting the BIG numbers right (the 1932-37 +9.83%, 1982-87 +7.06%,
1987-00 -10.02%, 2009-20 +8.32%) and then worry about the tiny ones.

Let me try a different model for the Dot-Com cycle.

1987-2000: bull +582%, 147.6 months. Bear: -49.1%.
With age gate 48: trimming starts at month 48.
At month 48: price = 6.82^(48/147.6) = ?

Let me compute properly. Total gain = 5.82x. So peak price = 6.82.
Monthly growth rate = 6.82^(1/147.6) - 1.

At month 48: price = 6.82^(48/147.6) = 6.82^0.3252 = ?
ln(6.82) = 1.920. 1.920 * 0.3252 = 0.6245. e^0.6245 = 1.867.
So at month 48, gain = +86.7%. Not yet +100%.

Month 54: 6.82^(54/147.6) = 6.82^0.3659 = e^(1.920*0.3659) = e^0.7025 = 2.019.
Gain = +101.9%. +100% trigger fires. Trim 3%.

Month 72: 6.82^(72/147.6) = e^(1.920*0.4878) = e^0.9367 = 2.552.
Decay: 72 - 54 = 18 = decay_mo. Redeploy!

Month 85: 6.82^(85/147.6) = e^(1.920*0.5759) = e^1.1057 = 3.022.
+200% trigger. Trim 6%.

Month 103: 85 + 18 = 103. Decay fires. Redeploy.

Month 107: 6.82^(107/147.6) = e^(1.920*0.7249) = e^1.3918 = 4.023.
+300% trigger. Trim 9%.

Month 124: 6.82^(124/147.6) = e^(1.920*0.8401) = e^1.6130 = 5.018.
+400% trigger. Trim 12%. But 107+18=125, so decay almost fires at 125.
Actually let me check: last trim was at 107, so decay at 107+18=125.
Does +400% trigger before or at month 124?
Actually month 125: decay. Month 124: trim.
So trim happens at 124, then at 125 decay would fire (18 months since month 107).
But we just trimmed at 124, so last_trim_month = 124. Decay won't fire until 142.

Month 142: 124 + 18 = 142. < 147.6 (bull duration). Redeploy.
After redeploying, all cash is back in equity.

So at peak (month 147.6), if everything was redeployed, then the strategy
has slightly MORE shares than B&H (due to rebuying at various prices, some
lower, some higher) but also potentially fewer if the sell-high/rebuy-higher
pattern dominates.

The issue: every time we trim, we sell at price P1, and then redeploy 18 months
later at price P2 > P1 (because the bull is still going up). So we're selling
low and buying high! That's why the Dot-Com cycle loses money.

In the user's model, alpha = -10.02%. In mine, -25.47%. The magnitude difference
might be because the user's model has a different trim mechanic.

Let me try: trim_pct is percentage of INITIAL value (i.e., trim $0.03 at +100%,
$0.06 at +200%, etc.). This would mean smaller actual % of current equity gets sold
since the portfolio has grown.

Actually, I think a key difference might be: the trim percentages refer to
percentages of the GAIN, not the portfolio. Like "+100% -> 3%" means
"trim 3% of the unrealized gains." Let me try that.

Wait, actually the simplest interpretation of trim tiers in wealth management:
+100% -> 3% means: when portfolio is up 100%, trim 3% of total portfolio to cash.

That IS what I had in v2. Let me try yet another interpretation:
the trim amount is a FIXED 3% of STARTING value, i.e., $0.03 regardless of
current portfolio size.
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
    Model A: "trim X%" = sell X% of CURRENT portfolio value (equity portion).
    Model B: "trim X%" = sell X% of INITIAL value ($0.0X per $1 invested).

    Let me implement BOTH and compare.
    """
    return simulate_cycle_modelA(cycle, params)


def simulate_cycle_modelA(cycle: Cycle, params: StrategyParams) -> dict:
    """Model A: trim X% of current equity."""
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

        # Time decay check BEFORE trim check
        if last_trim_month is not None and cash > 0:
            if month - last_trim_month >= params.decay_mo:
                new_shares = cash / price
                shares += new_shares
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

    bear_dd = bear.drawdown_pct / 100.0
    trough_price = peak_price * (1 - bear_dd)

    cash_remaining = cash
    for trigger_dd_pct, deploy_frac_pct in sorted(params.deploy_triggers, key=lambda x: x[0]):
        trigger_dd = trigger_dd_pct / 100.0
        deploy_frac = deploy_frac_pct / 100.0

        if bear_dd >= trigger_dd and cash_remaining > 0:
            deploy_price = peak_price * (1 - trigger_dd)
            cash_to_deploy = cash_remaining * deploy_frac
            shares += cash_to_deploy / deploy_price
            cash_remaining -= cash_to_deploy

    strategy_value = shares * trough_price + cash_remaining
    benchmark_value = trough_price

    alpha = (strategy_value - benchmark_value) * 100

    strat_dd = (1 - strategy_value / portfolio_at_peak) * 100 if portfolio_at_peak > 0 else 0
    bench_dd = bear.drawdown_pct
    dd_red = bench_dd - strat_dd

    return {
        'cycle': cycle.label,
        'bull_gain': bull.gain_pct,
        'bull_duration': bull.duration_mo,
        'bear_drawdown': bear.drawdown_pct,
        'alpha': alpha,
        'total_trimmed_pct': total_trimmed_pct,
        'cash_pct_at_peak': (cash / portfolio_at_peak * 100) if portfolio_at_peak > 0 else 0,
        'strat_dd': strat_dd,
        'bench_dd': bench_dd,
        'dd_reduction': dd_red,
        'is_win': alpha >= -0.005,
        'portfolio_at_peak': portfolio_at_peak,
        'strategy_value': strategy_value,
        'benchmark_value': benchmark_value,
    }


def simulate_cycle_modelB(cycle: Cycle, params: StrategyParams) -> dict:
    """Model B: trim X% of INITIAL portfolio value (fixed dollar amount)."""
    bull = cycle.bull
    bear = cycle.bear

    bull_total = bull.gain_pct / 100.0
    bull_months = bull.duration_mo

    shares = 1.0
    cash = 0.0
    initial_value = 1.0  # reference point for trim amounts

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

        if last_trim_month is not None and cash > 0:
            if month - last_trim_month >= params.decay_mo:
                new_shares = cash / price
                shares += new_shares
                cash = 0.0
                last_trim_month = None

        for i, (threshold, trim_pct) in enumerate(params.trim_tiers):
            if not tiers_triggered[i] and cum_gain_pct >= threshold:
                effective_trim = trim_pct
                if params.max_trim_cap is not None:
                    remaining = params.max_trim_cap - total_trimmed_pct
                    if remaining <= 0:
                        continue
                    effective_trim = min(trim_pct, remaining)

                # Key difference: trim is based on INITIAL value
                trim_amount = initial_value * (effective_trim / 100.0)
                # Can't sell more than we have
                max_sellable = shares * price
                trim_amount = min(trim_amount, max_sellable)

                shares -= trim_amount / price
                cash += trim_amount
                total_trimmed_pct += effective_trim
                tiers_triggered[i] = True
                last_trim_month = month

    peak_price = 1.0 + bull_total
    equity_at_peak = shares * peak_price
    portfolio_at_peak = equity_at_peak + cash

    bear_dd = bear.drawdown_pct / 100.0
    trough_price = peak_price * (1 - bear_dd)

    cash_remaining = cash
    for trigger_dd_pct, deploy_frac_pct in sorted(params.deploy_triggers, key=lambda x: x[0]):
        trigger_dd = trigger_dd_pct / 100.0
        deploy_frac = deploy_frac_pct / 100.0

        if bear_dd >= trigger_dd and cash_remaining > 0:
            deploy_price = peak_price * (1 - trigger_dd)
            cash_to_deploy = cash_remaining * deploy_frac
            shares += cash_to_deploy / deploy_price
            cash_remaining -= cash_to_deploy

    strategy_value = shares * trough_price + cash_remaining
    benchmark_value = trough_price

    alpha = (strategy_value - benchmark_value) * 100

    strat_dd = (1 - strategy_value / portfolio_at_peak) * 100 if portfolio_at_peak > 0 else 0
    bench_dd = bear.drawdown_pct
    dd_red = bench_dd - strat_dd

    return {
        'cycle': cycle.label,
        'bull_gain': bull.gain_pct,
        'bull_duration': bull.duration_mo,
        'bear_drawdown': bear.drawdown_pct,
        'alpha': alpha,
        'total_trimmed_pct': total_trimmed_pct,
        'cash_pct_at_peak': (cash / portfolio_at_peak * 100) if portfolio_at_peak > 0 else 0,
        'strat_dd': strat_dd,
        'bench_dd': bench_dd,
        'dd_reduction': dd_red,
        'is_win': alpha >= -0.005,
    }


def run_strategy(params: StrategyParams, model='A', verbose=False) -> dict:
    results = []
    for cycle in CYCLES:
        if model == 'A':
            r = simulate_cycle_modelA(cycle, params)
        else:
            r = simulate_cycle_modelB(cycle, params)
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
        print(f"\nModel {model}: age_gate={params.age_gate_mo}, tiers={params.trim_tiers}, "
              f"decay={params.decay_mo}, deploy={params.deploy_triggers}")
        if params.max_trim_cap is not None:
            print(f"  max_trim_cap={params.max_trim_cap}%")
        print(f"  Win rate: {wins}/{len(results)} = {win_rate:.1f}%")
        print(f"  Total alpha: {total_alpha:.2f}%")
        print(f"  Alpha bps/yr: {alpha_bps_yr:.1f}")
        print(f"  Avg DD reduction (active): {avg_dd_red:.2f}pp")
        print()

        # Focus on the key cycles
        target_alphas = {
            '1932-37': 9.83, '1938-40': 0.00, '1942-46': -0.00,
            '1947-56': -1.23, '1957-61': 0.00, '1962-66': 0.00,
            '1966-68': 0.00, '1970-73': -0.00, '1974-80': 0.96,
            '1982-87': 7.06, '1987-00': -10.02, '2002-07': 2.26,
            '2009-20': 8.32, '2020-22': -0.06,
        }

        print(f"  {'Cycle':<30} {'MyAlpha':>8} {'Target':>8} {'Diff':>8} {'Trim%':>5} {'Cash%':>5}")
        print(f"  {'-'*30} {'-'*8} {'-'*8} {'-'*8} {'-'*5} {'-'*5}")
        for r in results:
            # Find matching target
            key = None
            for k in target_alphas:
                if k in r['cycle']:
                    key = k
                    break
            target = target_alphas.get(key, 0)
            diff = r['alpha'] - target
            print(f"  {r['cycle']:<30} {r['alpha']:>7.2f}% {target:>7.2f}% {diff:>7.2f}% "
                  f"{r['total_trimmed_pct']:>4.1f}% {r['cash_pct_at_peak']:>4.1f}%")

    return summary


def get_baseline_params():
    return StrategyParams(
        age_gate_mo=48,
        trim_tiers=[(100, 3), (200, 6), (300, 9), (400, 12)],
        decay_mo=18,
        deploy_triggers=[(15, 50), (30, 50)],
    )


if __name__ == "__main__":
    baseline = get_baseline_params()

    print("=" * 90)
    print("MODEL A: Trim X% of current equity value")
    print("=" * 90)
    run_strategy(baseline, model='A', verbose=True)

    print("\n" + "=" * 90)
    print("MODEL B: Trim X% of initial portfolio value")
    print("=" * 90)
    run_strategy(baseline, model='B', verbose=True)
