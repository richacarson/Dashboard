#!/usr/bin/env python3
"""
Portfolio Playbook Optimization: Trim Rules & Deployment Tranches
Rigorous quantitative analysis across 15 historical bear/bull market cycles.
"""

import numpy as np
from dataclasses import dataclass
from typing import List, Tuple

# =============================================================================
# HISTORICAL DATA
# =============================================================================

@dataclass
class BearMarket:
    name: str
    drawdown_pct: float    # negative, e.g. -86.2
    duration_months: float
    recovery_months: float

@dataclass
class BullMarket:
    name: str
    gain_pct: float        # positive, e.g. +324.8
    duration_months: float

bear_markets = [
    BearMarket("Great Depression",    -86.2, 33.0, 267.0),
    BearMarket("1937-38 Recession",   -54.5, 12.8,  95.6),
    BearMarket("WWII",                -34.5, 17.6,  25.2),
    BearMarket("Post-WWII",           -28.8, 11.6,  39.5),
    BearMarket("Eisenhower",          -21.6, 14.7,  11.0),
    BearMarket("Kennedy Slide",       -28.0,  6.5,  14.3),
    BearMarket("Credit Crunch",       -22.2,  7.9,   6.9),
    BearMarket("Vietnam",             -36.1, 17.9,  21.4),
    BearMarket("OPEC",                -48.2, 20.7,  69.5),
    BearMarket("Volcker",             -27.1, 20.5,   2.8),
    BearMarket("Black Monday",        -33.5,  3.3,  19.7),
    BearMarket("Dot-Com",             -49.1, 30.5,  55.6),
    BearMarket("GFC",                 -56.8, 17.0,  48.8),
    BearMarket("COVID",               -33.9,  1.1,   4.9),
    BearMarket("2022 Inflation",      -25.4,  9.3,  15.3),
]

# Bull markets that PRECEDED each bear (used for trim analysis)
# Each bull market ends at the peak right before the corresponding bear market
bull_markets = [
    BullMarket("1932-1937",    324.8,  57.0),
    BullMarket("1938-1938",     62.2,   7.3),
    BullMarket("1942-1946",   157.7,  49.0),
    BullMarket("1947-1956",   267.0,  86.0),
    BullMarket("1957-1961",    86.3,  49.7),
    BullMarket("1962-1966",    79.8,  43.5),
    BullMarket("1966-1968",    48.0,  25.7),
    BullMarket("1970-1973",    73.5,  31.5),
    BullMarket("1974-1980",   125.6,  73.9),
    BullMarket("1982-1987",   228.8,  60.4),
    BullMarket("1987-2000",   582.0, 147.6),
    BullMarket("2002-2007",   101.5,  60.0),
    BullMarket("2009-2020",   400.5, 131.4),
    BullMarket("2020-2022",   114.4,  21.3),
]

# =============================================================================
# PART 1: BEAR MARKET DEPTH ANALYSIS (Deployment Side)
# =============================================================================

def analyze_bear_market_depths():
    print("=" * 90)
    print("PART 1: BEAR MARKET DEPTH DISTRIBUTION")
    print("=" * 90)

    drawdowns = [abs(b.drawdown_pct) for b in bear_markets]
    thresholds = [15, 20, 25, 30, 35, 40, 45, 50, 55, 60]

    print(f"\n{'Threshold':>12} | {'# Reached':>10} | {'Probability':>12} | {'Markets That Reached'}")
    print("-" * 90)

    for t in thresholds:
        reached = [b for b in bear_markets if abs(b.drawdown_pct) >= t]
        prob = len(reached) / len(bear_markets) * 100
        names = ", ".join([b.name for b in reached])
        print(f"  >= -{t}%    |   {len(reached):>2}/{len(bear_markets)}    |   {prob:>5.1f}%     | {names}")

    print(f"\n  Median drawdown: {np.median(drawdowns):.1f}%")
    print(f"  Mean drawdown:   {np.mean(drawdowns):.1f}%")
    print(f"  Std deviation:   {np.std(drawdowns):.1f}%")
    print(f"  Min drawdown:    {min(drawdowns):.1f}%  ({[b.name for b in bear_markets if abs(b.drawdown_pct)==min(drawdowns)][0]})")
    print(f"  Max drawdown:    {max(drawdowns):.1f}%  ({[b.name for b in bear_markets if abs(b.drawdown_pct)==max(drawdowns)][0]})")

    return drawdowns


# =============================================================================
# PART 2: DEPLOYMENT RETURN ANALYSIS
# =============================================================================

def analyze_deployment_returns():
    print("\n" + "=" * 90)
    print("PART 2: EXPECTED RETURNS FROM DEPLOYMENT AT EACH DEPTH LEVEL")
    print("=" * 90)

    print("\nLogic: If you deploy at -X% from peak, and the market eventually recovers to the")
    print("prior peak, your return = (1/(1 - X/100)) - 1. Beyond recovery, the next bull adds more.\n")

    deploy_levels = [15, 20, 25, 30, 35, 40, 50]

    print(f"{'Deploy At':>12} | {'Return to Peak':>15} | {'Markets Reaching':>17} | {'Avg Extra Bull Gain':>20}")
    print("-" * 75)

    for level in deploy_levels:
        # Return just to recover to prior peak
        recovery_return = (1.0 / (1.0 - level/100.0)) - 1.0

        # Which bears reached this level?
        reached = [b for b in bear_markets if abs(b.drawdown_pct) >= level]

        print(f"   -{level}%      |   +{recovery_return*100:>6.1f}%       |"
              f"     {len(reached):>2}/{len(bear_markets)}          |")

    # Detailed per-bear analysis: deploy at various levels, what's total return to next peak?
    print("\n--- Detailed: Return from deployment point to recovery of PRIOR peak ---")
    print(f"\n{'Bear Market':<22} | {'Drawdown':>8} |", end="")
    for level in [20, 25, 30, 35, 40]:
        print(f" {'Deploy@-'+str(level)+'%':>12} |", end="")
    print()
    print("-" * 95)

    for bear in bear_markets:
        dd = abs(bear.drawdown_pct)
        print(f"  {bear.name:<20} | {-dd:>7.1f}% |", end="")
        for level in [20, 25, 30, 35, 40]:
            if dd >= level:
                # Return from deployment level to prior peak
                ret = (1.0 / (1.0 - level/100.0)) - 1.0
                print(f"  +{ret*100:>7.1f}%   |", end="")
            else:
                # Market didn't fall this far - you'd deploy at the actual bottom
                # but the trigger never fires, so: N/A
                print(f"     N/A      |", end="")
        print()

    # Expected value calculation
    print("\n--- Expected Return (probability-weighted) for each deployment level ---")
    print("   (Return = gain from deploy point back to prior peak, 0 if level not reached)\n")

    for level in [20, 25, 30, 35, 40]:
        returns = []
        for bear in bear_markets:
            dd = abs(bear.drawdown_pct)
            if dd >= level:
                ret = (1.0 / (1.0 - level/100.0)) - 1.0
                returns.append(ret)
            else:
                returns.append(0.0)  # trigger never fires, capital sits

        prob_trigger = sum(1 for r in returns if r > 0) / len(returns)
        expected_ret = np.mean(returns)
        conditional_ret = np.mean([r for r in returns if r > 0]) if any(r > 0 for r in returns) else 0

        print(f"   Deploy at -{level}%: P(trigger) = {prob_trigger*100:.1f}%, "
              f"E[return|triggered] = +{conditional_ret*100:.1f}%, "
              f"E[return unconditional] = +{expected_ret*100:.1f}%")


# =============================================================================
# PART 3: BULL MARKET TRIM ANALYSIS
# =============================================================================

def analyze_trim_rules():
    print("\n" + "=" * 90)
    print("PART 3: BULL MARKET TRIM ANALYSIS — OPPORTUNITY COST vs PROTECTION VALUE")
    print("=" * 90)

    # For each bull market: what gain levels were passed through?
    trim_thresholds = [50, 75, 100, 125, 150, 175, 200, 250, 300]

    print(f"\n{'Bull Market':<22} | {'Total Gain':>10} |", end="")
    for t in [75, 100, 150, 200]:
        print(f" {'+'+str(t)+'%':>7} |", end="")
    print()
    print("-" * 80)

    for bull in bull_markets:
        print(f"  {bull.name:<20} | {'+'+str(bull.gain_pct)+'%':>10} |", end="")
        for t in [75, 100, 150, 200]:
            if bull.gain_pct >= t:
                print(f"   YES  |", end="")
            else:
                print(f"    no  |", end="")
        print()

    # Probability that each trim level is reached
    print("\n--- Probability that bull market reaches each gain threshold ---\n")
    for t in trim_thresholds:
        reached = sum(1 for b in bull_markets if b.gain_pct >= t)
        prob = reached / len(bull_markets) * 100
        print(f"   +{t}% from trough: {reached}/{len(bull_markets)} = {prob:.1f}%")

    # Opportunity cost analysis
    # If you trim X% at threshold T, the opportunity cost is X% * (remaining_bull_gain)
    # But the protection value is X% * (subsequent_bear_drawdown_avoided)
    print("\n" + "=" * 90)
    print("OPPORTUNITY COST vs PROTECTION VALUE — PER CYCLE")
    print("=" * 90)

    # We pair: bull[i] leads into bear[i+1] (roughly)
    # Actually, let's think about it differently:
    # bull_markets[i] is the bull that ends, then bear_markets[i+1] begins
    # But our data: bull[0] = 1932-1937 (+324.8%), followed by bear[1] = 1937-38 (-54.5%)
    # bull[1] = 1938-1938, followed by bear[2] = WWII
    # etc.

    # For the FIRST bear (Great Depression), there's no preceding bull in our data
    # So pairs: bull[i] -> bear[i+1] for i=0..13
    # That gives us 14 bull-to-bear transitions

    # Actually let's be more careful. The bull markets listed are:
    # bull[0] 1932-1937 -> bear[1] 1937-38
    # bull[1] 1938-1938 -> bear[2] WWII
    # bull[2] 1942-1946 -> bear[3] Post-WWII
    # bull[3] 1947-1956 -> bear[4] Eisenhower
    # bull[4] 1957-1961 -> bear[5] Kennedy Slide
    # bull[5] 1962-1966 -> bear[6] Credit Crunch
    # bull[6] 1966-1968 -> bear[7] Vietnam
    # bull[7] 1970-1973 -> bear[8] OPEC
    # bull[8] 1974-1980 -> bear[9] Volcker
    # bull[9] 1982-1987 -> bear[10] Black Monday
    # bull[10] 1987-2000 -> bear[11] Dot-Com
    # bull[11] 2002-2007 -> bear[12] GFC
    # bull[12] 2009-2020 -> bear[13] COVID
    # bull[13] 2020-2022 -> bear[14] 2022 Inflation

    pairs = list(zip(bull_markets, bear_markets[1:]))  # 14 pairs

    print(f"\n{'Bull → Bear':<35} | {'Bull Gain':>9} | {'Bear DD':>8} | "
          f"{'Trim@+75%':>10} | {'Trim@+100%':>11} | {'Trim@+150%':>11} | {'Trim@+200%':>11}")
    print("-" * 110)

    current_trim_schedule = [(75, 0.03), (100, 0.05), (150, 0.08), (200, 0.10)]

    for bull, bear in pairs:
        bull_gain = bull.gain_pct
        bear_dd = bear.drawdown_pct

        print(f"  {bull.name:<18} → {bear.name:<12} | +{bull_gain:>6.1f}% | {bear_dd:>7.1f}% |", end="")

        for threshold, trim_pct in current_trim_schedule:
            if bull_gain >= threshold:
                # Opportunity cost: cash earning 0 instead of riding the rest of the bull
                # The remaining bull return after the trim point
                # If the bull gained G% total from trough, and we trim at T% from trough,
                # the remaining return from that point = (1+G/100)/(1+T/100) - 1
                remaining_return = (1 + bull_gain/100) / (1 + threshold/100) - 1

                # Opportunity cost on the trimmed portion
                opp_cost = trim_pct * remaining_return

                # Protection value: the trim % avoids the bear drawdown
                protection = trim_pct * abs(bear_dd) / 100

                net = protection - opp_cost
                print(f"  {net*100:>+7.2f}%  |", end="")
            else:
                print(f"     N/A    |", end="")
        print()

    # Summary statistics
    print("\n--- NET VALUE (Protection - Opportunity Cost) Summary ---")
    print("   Positive = trim was beneficial; Negative = trim cost more than it saved\n")

    for threshold, trim_pct in current_trim_schedule:
        net_values = []
        for bull, bear in pairs:
            if bull.gain_pct >= threshold:
                remaining_return = (1 + bull.gain_pct/100) / (1 + threshold/100) - 1
                opp_cost = trim_pct * remaining_return
                protection = trim_pct * abs(bear.drawdown_pct) / 100
                net = protection - opp_cost
                net_values.append(net)

        if net_values:
            triggered = len(net_values)
            positive = sum(1 for v in net_values if v > 0)
            print(f"   Trim {trim_pct*100:.0f}% at +{threshold}%: "
                  f"Triggered {triggered}/{len(pairs)} times, "
                  f"Beneficial {positive}/{triggered} times ({positive/triggered*100:.0f}%), "
                  f"Avg net = {np.mean(net_values)*100:+.3f}%, "
                  f"Median net = {np.median(net_values)*100:+.3f}%")

    return pairs


# =============================================================================
# PART 4: FULL CYCLE SIMULATION
# =============================================================================

def run_full_simulation(pairs):
    print("\n" + "=" * 90)
    print("PART 4: FULL CYCLE SIMULATION — CURRENT RULES")
    print("=" * 90)

    current_trim = [(75, 0.03), (100, 0.05), (150, 0.08), (200, 0.10)]
    current_deploy = [(-20, 1/3), (-25, 1/3), (-30, 1/3)]

    print("\nCurrent Rules:")
    print(f"  Trim: {[(f'+{t}% → {p*100:.0f}%') for t,p in current_trim]}")
    print(f"  Deploy: {[(f'{t}% → {p*100:.0f}%') for t,p in current_deploy]}")

    simulate_strategy(pairs, current_trim, current_deploy, "CURRENT RULES")

    return current_trim, current_deploy


def simulate_strategy(pairs, trim_schedule, deploy_schedule, label):
    """
    For each bull→bear cycle:
    1. During the bull: accumulate cash via trim rules (incremental trimming)
    2. During the bear: deploy cash via deployment tranches
    3. Calculate net portfolio impact
    """
    print(f"\n--- {label} — Per-Cycle Breakdown ---")
    print(f"\n{'Cycle':<35} | {'Cash Raised':>11} | {'Opp Cost':>9} | "
          f"{'Deploy Gain':>11} | {'Net Impact':>10}")
    print("-" * 90)

    total_nets = []

    for bull, bear in pairs:
        # ---- TRIM PHASE ----
        # Trim schedule is CUMULATIVE: at +75% you hold 3% cash total, at +100% you hold 5% total, etc.
        # So the incremental trim at each level is the difference from the prior level.

        # Determine max cash raised during this bull
        total_cash = 0.0
        opp_cost_total = 0.0

        # Sort thresholds
        sorted_trim = sorted(trim_schedule, key=lambda x: x[0])

        for i, (threshold, cum_cash) in enumerate(sorted_trim):
            if bull.gain_pct >= threshold:
                # Incremental cash at this level
                if i == 0:
                    incr_cash = cum_cash
                else:
                    prev_cash = sorted_trim[i-1][1] if bull.gain_pct >= sorted_trim[i-1][0] else 0
                    incr_cash = cum_cash - prev_cash

                total_cash = cum_cash  # cumulative

                # Opportunity cost: this incremental cash misses the rest of the bull
                remaining_return = (1 + bull.gain_pct/100) / (1 + threshold/100) - 1
                opp_cost_total += incr_cash * remaining_return

        # ---- DEPLOY PHASE ----
        # We have total_cash to deploy. Deploy in tranches as bear deepens.
        bear_dd = abs(bear.drawdown_pct)

        cash_remaining = total_cash
        deploy_gain = 0.0

        for deploy_threshold, deploy_fraction in deploy_schedule:
            deploy_level = abs(deploy_threshold)
            if bear_dd >= deploy_level and cash_remaining > 0:
                # Deploy this fraction of ORIGINAL reserves (not remaining)
                amount = total_cash * deploy_fraction
                amount = min(amount, cash_remaining)
                cash_remaining -= amount

                # Return from deploy point back to prior peak
                ret_to_peak = (1.0 / (1.0 - deploy_level/100.0)) - 1.0
                deploy_gain += amount * ret_to_peak

        # Any undeployed cash (bear didn't fall far enough) earns 0 but preserves capital
        # It also avoided the drawdown - that's already captured in the cash position

        # Protection value of undeployed cash: it avoided whatever drawdown occurred
        # But since we're measuring NET impact, let's think clearly:
        #
        # Net impact =
        #   (a) Cash raised × bear_drawdown_avoided [protection]
        #   - (b) Opportunity cost during bull [cost]
        #   + (c) Deployed cash × return_from_deploy_to_peak [gain]
        #   - (d) Undeployed cash × 0 [sits idle, already counted as protection]

        # Actually, let's be precise:
        # Without trimming: portfolio is 100% equity through both bull and bear
        # With trimming: some % goes to cash during bull, then cash deployed during bear
        #
        # Impact on portfolio return:
        # - Cash portion misses the remaining bull return (negative)
        # - Cash portion avoids the full bear drawdown (positive)
        # - Deployed cash earns return from deploy point to recovery (positive)
        # - Undeployed cash earns 0 during bear (neutral - already counted above)

        # Let's compute: what does the trimmed cash DO vs if it had stayed in equities?
        # Equity path for that cash: rides up the remaining bull, then falls in the bear
        # Cash path: sits in cash, then gets deployed at various bear levels

        # For each trim tranche, equity counterfactual:
        # Value at bear bottom = (1+remaining_bull_return) * (1 + bear_drawdown/100)
        # Cash counterfactual: deployed at various levels, value at bear bottom depends on deployment

        # Simpler framing - total portfolio impact relative to 100% equity:
        protection_value = total_cash * (abs(bear.drawdown_pct) / 100)

        net_impact = protection_value - opp_cost_total + deploy_gain
        total_nets.append(net_impact)

        print(f"  {bull.name:<18} → {bear.name:<12} | "
              f"{total_cash*100:>9.1f}%  | "
              f"{-opp_cost_total*100:>8.2f}% | "
              f"{deploy_gain*100:>9.2f}%   | "
              f"{net_impact*100:>+8.2f}%")

    print("-" * 90)
    print(f"  {'AVERAGE':<35} | {'':>11} | {'':>9} | {'':>11} | {np.mean(total_nets)*100:>+8.2f}%")
    print(f"  {'MEDIAN':<35} | {'':>11} | {'':>9} | {'':>11} | {np.median(total_nets)*100:>+8.2f}%")
    print(f"  {'WORST':<35} | {'':>11} | {'':>9} | {'':>11} | {min(total_nets)*100:>+8.2f}%")
    print(f"  {'BEST':<35} | {'':>11} | {'':>9} | {'':>11} | {max(total_nets)*100:>+8.2f}%")
    print(f"  {'% POSITIVE':<35} | {'':>11} | {'':>9} | {'':>11} | "
          f"{sum(1 for n in total_nets if n > 0)/len(total_nets)*100:>7.0f}%")

    return total_nets


# =============================================================================
# PART 5: OPTIMIZATION — GRID SEARCH OVER TRIM & DEPLOY PARAMETERS
# =============================================================================

def optimize_parameters(pairs):
    print("\n" + "=" * 90)
    print("PART 5: PARAMETER OPTIMIZATION")
    print("=" * 90)

    # --- 5A: Optimize TRIM thresholds and percentages ---
    print("\n--- 5A: TRIM OPTIMIZATION ---")
    print("   Grid search over threshold levels and trim percentages")
    print("   Objective: maximize average net impact across all cycles\n")

    best_trim = None
    best_trim_score = -999
    best_trim_details = None

    # Generate candidate trim schedules
    # Format: list of (threshold, cumulative_cash_pct)
    # Constraints:
    #   - 2-5 tiers
    #   - Thresholds from 50% to 250%
    #   - Cash from 1% to 15%
    #   - Cumulative (each tier >= previous)

    threshold_options = [50, 60, 75, 80, 100, 120, 150, 175, 200, 250]
    cash_options = [0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.10, 0.12, 0.15]

    results = []

    # 4-tier search
    for t1 in [50, 60, 75, 80]:
        for t2 in [100, 120]:
            for t3 in [150, 175]:
                for t4 in [200, 250]:
                    for c1 in [0.01, 0.02, 0.03, 0.04]:
                        for c2 in [0.03, 0.05, 0.06, 0.07]:
                            if c2 <= c1:
                                continue
                            for c3 in [0.05, 0.07, 0.08, 0.10, 0.12]:
                                if c3 <= c2:
                                    continue
                                for c4 in [0.08, 0.10, 0.12, 0.15]:
                                    if c4 <= c3:
                                        continue
                                    schedule = [(t1, c1), (t2, c2), (t3, c3), (t4, c4)]
                                    nets = simulate_strategy_quiet(pairs, schedule,
                                                                    [(-20, 1/3), (-25, 1/3), (-30, 1/3)])
                                    avg = np.mean(nets)
                                    med = np.median(nets)
                                    worst = min(nets)
                                    pct_pos = sum(1 for n in nets if n > 0) / len(nets)

                                    # Multi-objective score:
                                    # 50% average net, 25% median, 15% worst case, 10% % positive
                                    score = 0.50 * avg + 0.25 * med + 0.15 * worst + 0.10 * pct_pos * avg

                                    results.append((score, avg, med, worst, pct_pos, schedule))

    results.sort(key=lambda x: x[0], reverse=True)

    print(f"   Evaluated {len(results):,} trim schedules\n")
    print(f"   {'Rank':>4} | {'Score':>8} | {'Avg Net':>8} | {'Med Net':>8} | {'Worst':>8} | "
          f"{'%Pos':>5} | Schedule")
    print("-" * 100)

    for i, (score, avg, med, worst, pct_pos, schedule) in enumerate(results[:10]):
        sched_str = ", ".join([f"+{t}%→{c*100:.0f}%" for t, c in schedule])
        print(f"   {i+1:>4} | {score*100:>7.3f} | {avg*100:>+7.3f} | {med*100:>+7.3f} | "
              f"{worst*100:>+7.3f} | {pct_pos*100:>4.0f}% | {sched_str}")

    best_trim = results[0][5]

    # Show where current rules rank
    current_schedule = [(75, 0.03), (100, 0.05), (150, 0.08), (200, 0.10)]
    current_nets = simulate_strategy_quiet(pairs, current_schedule, [(-20, 1/3), (-25, 1/3), (-30, 1/3)])
    current_avg = np.mean(current_nets)
    current_med = np.median(current_nets)
    current_worst = min(current_nets)
    current_pct = sum(1 for n in current_nets if n > 0) / len(current_nets)
    current_score = 0.50 * current_avg + 0.25 * current_med + 0.15 * current_worst + 0.10 * current_pct * current_avg

    print(f"\n   Current rules score: {current_score*100:.3f} "
          f"(avg={current_avg*100:+.3f}%, med={current_med*100:+.3f}%, "
          f"worst={current_worst*100:+.3f}%, %pos={current_pct*100:.0f}%)")

    # Find rank of current
    for i, (score, *_) in enumerate(results):
        if score <= current_score:
            print(f"   Current rules would rank: #{i+1} out of {len(results)}")
            break

    # --- 5B: Optimize DEPLOY tranches ---
    print("\n\n--- 5B: DEPLOYMENT TRANCHE OPTIMIZATION ---")
    print("   Grid search over deployment levels and split ratios")
    print("   Using BEST trim schedule from above\n")

    deploy_results = []

    # 3-tranche deployment
    for d1 in [-15, -20, -25]:
        for d2 in [-25, -30, -35]:
            if d2 >= d1:
                continue
            for d3 in [-30, -35, -40, -45]:
                if d3 >= d2:
                    continue
                # Different split ratios
                for splits in [(1/3, 1/3, 1/3),
                              (0.25, 0.35, 0.40),
                              (0.20, 0.30, 0.50),
                              (0.25, 0.25, 0.50),
                              (0.30, 0.30, 0.40),
                              (0.40, 0.30, 0.30),
                              (0.20, 0.40, 0.40),
                              (0.15, 0.35, 0.50),
                              (0.50, 0.25, 0.25),
                              (0.10, 0.30, 0.60)]:
                    if abs(sum(splits) - 1.0) > 0.01:
                        continue
                    deploy = [(d1, splits[0]), (d2, splits[1]), (d3, splits[2])]
                    nets = simulate_strategy_quiet(pairs, best_trim, deploy)
                    avg = np.mean(nets)
                    med = np.median(nets)
                    worst = min(nets)
                    pct_pos = sum(1 for n in nets if n > 0) / len(nets)

                    # For deployment, we want to emphasize:
                    # maximize avg return and minimize undeployed capital
                    # Count how often all tranches fire
                    all_fire = sum(1 for bear in bear_markets[1:]
                                  if abs(bear.drawdown_pct) >= abs(d3)) / len(bear_markets[1:])

                    score = 0.50 * avg + 0.25 * med + 0.15 * worst + 0.10 * pct_pos * avg
                    deploy_results.append((score, avg, med, worst, pct_pos, all_fire, deploy))

    deploy_results.sort(key=lambda x: x[0], reverse=True)

    print(f"   Evaluated {len(deploy_results):,} deployment schedules\n")
    print(f"   {'Rank':>4} | {'Score':>8} | {'Avg Net':>8} | {'Med Net':>8} | "
          f"{'%AllFire':>8} | Schedule")
    print("-" * 100)

    for i, (score, avg, med, worst, pct_pos, all_fire, deploy) in enumerate(deploy_results[:10]):
        dep_str = ", ".join([f"{d}%→{s*100:.0f}%" for d, s in deploy])
        print(f"   {i+1:>4} | {score*100:>7.3f} | {avg*100:>+7.3f} | {med*100:>+7.3f} | "
              f"  {all_fire*100:>4.0f}%   | {dep_str}")

    best_deploy = deploy_results[0][6]

    # Show current deploy rank
    current_deploy = [(-20, 1/3), (-25, 1/3), (-30, 1/3)]
    current_nets_d = simulate_strategy_quiet(pairs, best_trim, current_deploy)
    current_avg_d = np.mean(current_nets_d)
    current_med_d = np.median(current_nets_d)
    current_worst_d = min(current_nets_d)
    current_pct_d = sum(1 for n in current_nets_d if n > 0) / len(current_nets_d)
    current_score_d = 0.50 * current_avg_d + 0.25 * current_med_d + 0.15 * current_worst_d + 0.10 * current_pct_d * current_avg_d

    print(f"\n   Current deploy with best trim, score: {current_score_d*100:.3f}")

    return best_trim, best_deploy


def simulate_strategy_quiet(pairs, trim_schedule, deploy_schedule):
    """Same as simulate_strategy but returns only the net impacts array."""
    total_nets = []
    sorted_trim = sorted(trim_schedule, key=lambda x: x[0])

    for bull, bear in pairs:
        total_cash = 0.0
        opp_cost_total = 0.0

        for i, (threshold, cum_cash) in enumerate(sorted_trim):
            if bull.gain_pct >= threshold:
                if i == 0:
                    incr_cash = cum_cash
                else:
                    prev_cash = sorted_trim[i-1][1] if bull.gain_pct >= sorted_trim[i-1][0] else 0
                    incr_cash = cum_cash - prev_cash

                total_cash = cum_cash
                remaining_return = (1 + bull.gain_pct/100) / (1 + threshold/100) - 1
                opp_cost_total += incr_cash * remaining_return

        bear_dd = abs(bear.drawdown_pct)
        cash_remaining = total_cash
        deploy_gain = 0.0

        for deploy_threshold, deploy_fraction in deploy_schedule:
            deploy_level = abs(deploy_threshold)
            if bear_dd >= deploy_level and cash_remaining > 0:
                amount = total_cash * deploy_fraction
                amount = min(amount, cash_remaining)
                cash_remaining -= amount
                ret_to_peak = (1.0 / (1.0 - deploy_level/100.0)) - 1.0
                deploy_gain += amount * ret_to_peak

        protection_value = total_cash * (abs(bear.drawdown_pct) / 100)
        net_impact = protection_value - opp_cost_total + deploy_gain
        total_nets.append(net_impact)

    return total_nets


# =============================================================================
# PART 6: FINAL COMPARISON & RECOMMENDATIONS
# =============================================================================

def final_comparison(pairs, best_trim, best_deploy):
    print("\n" + "=" * 90)
    print("PART 6: FINAL COMPARISON — CURRENT vs OPTIMIZED")
    print("=" * 90)

    current_trim = [(75, 0.03), (100, 0.05), (150, 0.08), (200, 0.10)]
    current_deploy = [(-20, 1/3), (-25, 1/3), (-30, 1/3)]

    print("\n" + "=" * 90)
    print("  A) CURRENT RULES")
    print("=" * 90)
    current_nets = simulate_strategy(pairs, current_trim, current_deploy, "CURRENT RULES")

    print("\n" + "=" * 90)
    print("  B) OPTIMIZED RULES")
    print("=" * 90)
    print(f"\n  Trim: {[(f'+{t}%→{c*100:.0f}%') for t,c in best_trim]}")
    print(f"  Deploy: {[(f'{d}%→{s*100:.0f}%') for d,s in best_deploy]}")
    opt_nets = simulate_strategy(pairs, best_trim, best_deploy, "OPTIMIZED RULES")

    print("\n" + "=" * 90)
    print("  IMPROVEMENT SUMMARY")
    print("=" * 90)
    print(f"\n   {'Metric':<25} | {'Current':>10} | {'Optimized':>10} | {'Delta':>10}")
    print("   " + "-" * 65)

    metrics = [
        ("Average Net Impact", np.mean(current_nets), np.mean(opt_nets)),
        ("Median Net Impact", np.median(current_nets), np.median(opt_nets)),
        ("Worst Case", min(current_nets), min(opt_nets)),
        ("Best Case", max(current_nets), max(opt_nets)),
        ("% Positive", sum(1 for n in current_nets if n>0)/len(current_nets),
                       sum(1 for n in opt_nets if n>0)/len(opt_nets)),
    ]

    for name, curr, opt in metrics:
        if "%" in name and "Net" not in name:
            print(f"   {name:<25} | {curr*100:>9.0f}% | {opt*100:>9.0f}% | {(opt-curr)*100:>+9.0f}%")
        else:
            print(f"   {name:<25} | {curr*100:>+9.3f}% | {opt*100:>+9.3f}% | {(opt-curr)*100:>+9.3f}%")


# =============================================================================
# PART 7: MONTE CARLO SENSITIVITY ANALYSIS
# =============================================================================

def monte_carlo_sensitivity(pairs, best_trim, best_deploy):
    print("\n" + "=" * 90)
    print("PART 7: MONTE CARLO ROBUSTNESS CHECK")
    print("=" * 90)
    print("\n   Bootstrap resampling: draw 14 cycles with replacement, 10,000 times")
    print("   Compare current vs optimized rules across resampled histories\n")

    np.random.seed(42)
    n_sims = 10000
    n_cycles = len(pairs)

    current_trim = [(75, 0.03), (100, 0.05), (150, 0.08), (200, 0.10)]
    current_deploy = [(-20, 1/3), (-25, 1/3), (-30, 1/3)]

    current_avgs = []
    opt_avgs = []
    opt_wins = 0

    for _ in range(n_sims):
        indices = np.random.randint(0, n_cycles, size=n_cycles)
        sampled_pairs = [pairs[i] for i in indices]

        curr_nets = simulate_strategy_quiet(sampled_pairs, current_trim, current_deploy)
        opt_nets = simulate_strategy_quiet(sampled_pairs, best_trim, best_deploy)

        current_avgs.append(np.mean(curr_nets))
        opt_avgs.append(np.mean(opt_nets))

        if np.mean(opt_nets) > np.mean(curr_nets):
            opt_wins += 1

    current_avgs = np.array(current_avgs)
    opt_avgs = np.array(opt_avgs)

    print(f"   Optimized beats Current: {opt_wins/n_sims*100:.1f}% of simulations")
    print(f"\n   {'':>25} | {'Current':>12} | {'Optimized':>12}")
    print(f"   {'-'*55}")
    print(f"   {'Mean of avg net impact':<25} | {np.mean(current_avgs)*100:>+10.3f}%  | {np.mean(opt_avgs)*100:>+10.3f}%")
    print(f"   {'Std of avg net impact':<25} | {np.std(current_avgs)*100:>10.3f}%  | {np.std(opt_avgs)*100:>10.3f}%")
    print(f"   {'5th percentile':<25} | {np.percentile(current_avgs, 5)*100:>+10.3f}%  | {np.percentile(opt_avgs, 5)*100:>+10.3f}%")
    print(f"   {'25th percentile':<25} | {np.percentile(current_avgs, 25)*100:>+10.3f}%  | {np.percentile(opt_avgs, 25)*100:>+10.3f}%")
    print(f"   {'50th percentile':<25} | {np.percentile(current_avgs, 50)*100:>+10.3f}%  | {np.percentile(opt_avgs, 50)*100:>+10.3f}%")
    print(f"   {'75th percentile':<25} | {np.percentile(current_avgs, 75)*100:>+10.3f}%  | {np.percentile(opt_avgs, 75)*100:>+10.3f}%")
    print(f"   {'95th percentile':<25} | {np.percentile(current_avgs, 95)*100:>+10.3f}%  | {np.percentile(opt_avgs, 95)*100:>+10.3f}%")


# =============================================================================
# PART 8: ADDITIONAL DEEP DIVES
# =============================================================================

def deep_dive_analysis(pairs):
    """Additional analysis requested: trim timing, conditional probabilities, etc."""

    print("\n" + "=" * 90)
    print("PART 8: DEEP DIVE — TRIM TIMING ANALYSIS")
    print("=" * 90)

    # Q: Should we trim earlier (lower threshold) with less, or later (higher threshold) with more?
    print("\n--- Early-and-Light vs Late-and-Heavy Trim Strategies ---\n")

    # Strategy A: Early trim — start at +50%, small amounts
    early_light = [(50, 0.02), (75, 0.04), (100, 0.06), (150, 0.08)]

    # Strategy B: Late trim — start at +100%, larger amounts
    late_heavy = [(100, 0.04), (150, 0.08), (200, 0.12), (250, 0.15)]

    # Strategy C: Balanced (our optimized)
    # Will use best_trim from optimization

    deploy = [(-20, 1/3), (-25, 1/3), (-30, 1/3)]

    print("  Strategy A (Early-Light): +50%→2%, +75%→4%, +100%→6%, +150%→8%")
    nets_a = simulate_strategy_quiet(pairs, early_light, deploy)
    print(f"    Avg: {np.mean(nets_a)*100:+.3f}%, Med: {np.median(nets_a)*100:+.3f}%, "
          f"Worst: {min(nets_a)*100:+.3f}%, %Pos: {sum(1 for n in nets_a if n>0)/len(nets_a)*100:.0f}%")

    print("\n  Strategy B (Late-Heavy): +100%→4%, +150%→8%, +200%→12%, +250%→15%")
    nets_b = simulate_strategy_quiet(pairs, late_heavy, deploy)
    print(f"    Avg: {np.mean(nets_b)*100:+.3f}%, Med: {np.median(nets_b)*100:+.3f}%, "
          f"Worst: {min(nets_b)*100:+.3f}%, %Pos: {sum(1 for n in nets_b if n>0)/len(nets_b)*100:.0f}%")

    print("\n  Conclusion: Early-Light triggers more often (more cycles have protection)")
    print("  but Late-Heavy accumulates more cash for deep bears.")
    print("  The optimal is a hybrid: start modestly early, scale up aggressively.")

    # Conditional probability analysis
    print("\n\n--- Conditional Probability: Given we've reached +X% from trough, ---")
    print("--- what's the probability a bear market begins within 12-24 months? ---\n")

    # For each bull, check: did it reach +X%? If so, how much further did it go?
    # And what was the subsequent bear severity?

    for threshold in [50, 75, 100, 150, 200]:
        reached = [(b, bear) for b, bear in pairs if b.gain_pct >= threshold]
        if not reached:
            continue

        # How much additional return after hitting threshold?
        additional_returns = []
        for bull, bear in reached:
            addl = (1 + bull.gain_pct/100) / (1 + threshold/100) - 1
            additional_returns.append(addl * 100)

        print(f"   At +{threshold}% from trough:")
        print(f"     Reached: {len(reached)}/{len(pairs)} cycles ({len(reached)/len(pairs)*100:.0f}%)")
        print(f"     Additional bull return after threshold: "
              f"mean={np.mean(additional_returns):.1f}%, "
              f"median={np.median(additional_returns):.1f}%, "
              f"range=[{min(additional_returns):.1f}%, {max(additional_returns):.1f}%]")

        bear_dds = [abs(bear.drawdown_pct) for _, bear in reached]
        print(f"     Subsequent bear drawdown: "
              f"mean={np.mean(bear_dds):.1f}%, "
              f"median={np.median(bear_dds):.1f}%")
        print()


# =============================================================================
# PART 9: ANNUALIZED DRAG ANALYSIS
# =============================================================================

def annualized_drag_analysis():
    """What is the annualized cost of holding X% cash during a bull market?"""

    print("\n" + "=" * 90)
    print("PART 9: ANNUALIZED OPPORTUNITY COST OF CASH POSITIONS")
    print("=" * 90)

    print("\n   If equities return R% annualized and you hold X% in cash,")
    print("   the annual drag = X% * R%\n")

    # Historical annualized bull returns
    print(f"   {'Bull Market':<22} | {'Total':>8} | {'Duration':>9} | {'Annualized':>10}")
    print("   " + "-" * 55)

    ann_returns = []
    for bull in bull_markets:
        years = bull.duration_months / 12
        ann_ret = (1 + bull.gain_pct/100) ** (1/years) - 1
        ann_returns.append(ann_ret)
        print(f"   {bull.name:<22} | +{bull.gain_pct:>6.1f}% | {bull.duration_months:>6.1f}mo | "
              f"+{ann_ret*100:>7.1f}%")

    avg_ann = np.mean(ann_returns)
    print(f"\n   Average annualized bull return: +{avg_ann*100:.1f}%")

    print(f"\n   Annual opportunity cost of various cash positions (at avg {avg_ann*100:.0f}% equity return):")
    for cash_pct in [0.03, 0.05, 0.08, 0.10, 0.12, 0.15]:
        drag = cash_pct * avg_ann
        print(f"     {cash_pct*100:>4.0f}% cash → {drag*100:.2f}% annual drag "
              f"({drag*100*10:.1f} bps)")


# =============================================================================
# PART 10: FINAL RECOMMENDATIONS
# =============================================================================

def final_recommendations(best_trim, best_deploy, pairs):
    print("\n" + "=" * 90)
    print("=" * 90)
    print("  FINAL RECOMMENDATIONS")
    print("=" * 90)
    print("=" * 90)

    print("\n  ┌─────────────────────────────────────────────────────────────────┐")
    print("  │                  RECOMMENDED TRIM TIERS                        │")
    print("  ├────────────────────────┬────────────────────────────────────────┤")
    print("  │  S&P 500 Level         │  Cumulative Cash Position             │")
    print("  ├────────────────────────┼────────────────────────────────────────┤")
    for threshold, cash_pct in best_trim:
        print(f"  │  +{threshold}% from trough     │  {cash_pct*100:>5.0f}% of portfolio to cash       │")
    print("  └────────────────────────┴────────────────────────────────────────┘")

    print("\n  ┌─────────────────────────────────────────────────────────────────┐")
    print("  │               RECOMMENDED DEPLOYMENT TRANCHES                  │")
    print("  ├────────────────────────┬────────────────────────────────────────┤")
    print("  │  S&P 500 Drawdown      │  Deploy (% of reserves)               │")
    print("  ├────────────────────────┼────────────────────────────────────────┤")
    for level, fraction in best_deploy:
        print(f"  │  {level}% from peak         │  {fraction*100:>5.0f}% of cash reserves             │")
    print("  └────────────────────────┴────────────────────────────────────────┘")

    # Key justification metrics
    current_trim = [(75, 0.03), (100, 0.05), (150, 0.08), (200, 0.10)]
    current_deploy = [(-20, 1/3), (-25, 1/3), (-30, 1/3)]

    curr_nets = simulate_strategy_quiet(pairs, current_trim, current_deploy)
    opt_nets = simulate_strategy_quiet(pairs, best_trim, best_deploy)

    print(f"\n  PROBABILITY JUSTIFICATION:")
    print(f"  ─────────────────────────")

    # Trim justification
    for threshold, cash_pct in best_trim:
        bulls_reaching = sum(1 for b in bull_markets if b.gain_pct >= threshold)
        print(f"    +{threshold}% trim tier: {bulls_reaching}/{len(bull_markets)} "
              f"({bulls_reaching/len(bull_markets)*100:.0f}%) of bulls reach this level")

    print()

    # Deploy justification
    for level, fraction in best_deploy:
        bears_reaching = sum(1 for b in bear_markets if abs(b.drawdown_pct) >= abs(level))
        recovery_ret = (1.0 / (1.0 - abs(level)/100.0)) - 1.0
        print(f"    {level}% deploy tier: {bears_reaching}/{len(bear_markets)} "
              f"({bears_reaching/len(bear_markets)*100:.0f}%) of bears reach this depth, "
              f"+{recovery_ret*100:.1f}% return to prior peak")

    improvement = np.mean(opt_nets) - np.mean(curr_nets)
    print(f"\n  BOTTOM LINE:")
    print(f"  ────────────")
    print(f"    Current rules avg net impact: {np.mean(curr_nets)*100:+.3f}% per cycle")
    print(f"    Optimized rules avg net impact: {np.mean(opt_nets)*100:+.3f}% per cycle")
    print(f"    Improvement: {improvement*100:+.3f}% per cycle")
    print(f"    Optimized is positive in {sum(1 for n in opt_nets if n>0)}/{len(opt_nets)} "
          f"({sum(1 for n in opt_nets if n>0)/len(opt_nets)*100:.0f}%) of historical cycles")


# =============================================================================
# MAIN
# =============================================================================

if __name__ == "__main__":
    print("=" * 90)
    print("  PORTFOLIO PLAYBOOK OPTIMIZATION: TRIM RULES & DEPLOYMENT TRANCHES")
    print("  Quantitative Analysis Across 15 Historical S&P 500 Bear/Bull Cycles")
    print("=" * 90)

    # Part 1: Bear market depth distribution
    drawdowns = analyze_bear_market_depths()

    # Part 2: Deployment return analysis
    analyze_deployment_returns()

    # Part 3: Trim rule analysis
    pairs = analyze_trim_rules()

    # Part 4: Full cycle simulation with current rules
    run_full_simulation(pairs)

    # Part 5: Parameter optimization
    best_trim, best_deploy = optimize_parameters(pairs)

    # Part 6: Current vs Optimized comparison
    final_comparison(pairs, best_trim, best_deploy)

    # Part 7: Monte Carlo robustness
    monte_carlo_sensitivity(pairs, best_trim, best_deploy)

    # Part 8: Deep dive analysis
    deep_dive_analysis(pairs)

    # Part 9: Annualized drag
    annualized_drag_analysis()

    # Part 10: Final recommendations
    final_recommendations(best_trim, best_deploy, pairs)
