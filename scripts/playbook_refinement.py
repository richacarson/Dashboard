#!/usr/bin/env python3
"""
Refinement analysis: test practical variants of the optimized rules,
including a money-market yield on cash, and alternative deployment
schemes that are more likely to fully deploy.
"""
import numpy as np

# === DATA ===
bear_markets = [
    ("Great Depression",    -86.2, 33.0, 267.0),
    ("1937-38 Recession",   -54.5, 12.8,  95.6),
    ("WWII",                -34.5, 17.6,  25.2),
    ("Post-WWII",           -28.8, 11.6,  39.5),
    ("Eisenhower",          -21.6, 14.7,  11.0),
    ("Kennedy Slide",       -28.0,  6.5,  14.3),
    ("Credit Crunch",       -22.2,  7.9,   6.9),
    ("Vietnam",             -36.1, 17.9,  21.4),
    ("OPEC",                -48.2, 20.7,  69.5),
    ("Volcker",             -27.1, 20.5,   2.8),
    ("Black Monday",        -33.5,  3.3,  19.7),
    ("Dot-Com",             -49.1, 30.5,  55.6),
    ("GFC",                 -56.8, 17.0,  48.8),
    ("COVID",               -33.9,  1.1,   4.9),
    ("2022 Inflation",      -25.4,  9.3,  15.3),
]

bull_markets = [
    ("1932-1937",    324.8,  57.0),
    ("1938-1938",     62.2,   7.3),
    ("1942-1946",   157.7,  49.0),
    ("1947-1956",   267.0,  86.0),
    ("1957-1961",    86.3,  49.7),
    ("1962-1966",    79.8,  43.5),
    ("1966-1968",    48.0,  25.7),
    ("1970-1973",    73.5,  31.5),
    ("1974-1980",   125.6,  73.9),
    ("1982-1987",   228.8,  60.4),
    ("1987-2000",   582.0, 147.6),
    ("2002-2007",   101.5,  60.0),
    ("2009-2020",   400.5, 131.4),
    ("2020-2022",   114.4,  21.3),
]

pairs = list(zip(bull_markets, [bear_markets[i+1] for i in range(14)]))


def simulate(trim_schedule, deploy_schedule, cash_yield_ann=0.0, label=""):
    """
    Full cycle simulation.
    cash_yield_ann: annualized yield on cash (e.g. 0.04 = 4%)
    """
    sorted_trim = sorted(trim_schedule, key=lambda x: x[0])
    total_nets = []

    for (bull_name, bull_gain, bull_dur), (bear_name, bear_dd_raw, bear_dur, bear_recov) in pairs:
        bear_dd = abs(bear_dd_raw)

        # TRIM: accumulate cash
        total_cash = 0.0
        opp_cost_total = 0.0

        for i, (threshold, cum_cash) in enumerate(sorted_trim):
            if bull_gain >= threshold:
                if i == 0:
                    incr_cash = cum_cash
                else:
                    prev_cash = sorted_trim[i-1][1] if bull_gain >= sorted_trim[i-1][0] else 0
                    incr_cash = cum_cash - prev_cash
                total_cash = cum_cash

                # Remaining bull return after this trim
                remaining_return = (1 + bull_gain/100) / (1 + threshold/100) - 1
                opp_cost_total += incr_cash * remaining_return

        # Cash yield during the remaining bull (from first trim to end of bull)
        # Approximate: cash is held for average of remaining bull duration
        # and also through the bear
        # Simplified: cash earns yield during the bear period
        if total_cash > 0 and cash_yield_ann > 0:
            # Cash held during bear (bear_dur months)
            cash_yield_bear = total_cash * cash_yield_ann * (bear_dur / 12)
        else:
            cash_yield_bear = 0.0

        # DEPLOY
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

        # Protection value
        protection_value = total_cash * (bear_dd / 100)

        # Undeployed cash: if bear didn't go deep enough, remaining cash misses recovery
        # but that's already in protection (it avoided the drawdown)
        # However, if bear is shallow, undeployed cash needs to be re-invested at some point
        # That's a future decision, not a current cycle impact

        net_impact = protection_value - opp_cost_total + deploy_gain + cash_yield_bear
        total_nets.append((bull_name, bear_name, total_cash, opp_cost_total,
                          deploy_gain, cash_yield_bear, protection_value, net_impact))

    return total_nets


def print_results(results, label):
    print(f"\n{'='*90}")
    print(f"  {label}")
    print(f"{'='*90}")

    nets = [r[7] for r in results]

    print(f"\n{'Cycle':<35} | {'Cash':>5} | {'OppCost':>8} | {'Deploy':>7} | "
          f"{'Yield':>6} | {'Protect':>7} | {'Net':>8}")
    print("-" * 90)

    for bull_name, bear_name, cash, opp, dep, yld, prot, net in results:
        print(f"  {bull_name:<14} → {bear_name:<14} | {cash*100:>4.0f}% | "
              f"{-opp*100:>7.2f}% | {dep*100:>6.2f}% | {yld*100:>5.2f}% | "
              f"{prot*100:>6.2f}% | {net*100:>+7.2f}%")

    print("-" * 90)
    print(f"  Average: {np.mean(nets)*100:>+.3f}%   Median: {np.median(nets)*100:>+.3f}%   "
          f"Worst: {min(nets)*100:>+.3f}%   Best: {max(nets)*100:>+.3f}%   "
          f"%Pos: {sum(1 for n in nets if n>0)/len(nets)*100:.0f}%")

    return nets


# ==========================================
# TEST MULTIPLE REFINED STRATEGIES
# ==========================================
print("=" * 90)
print("  STRATEGY COMPARISON WITH CASH YIELD ADJUSTMENT")
print("  (Assuming 4% annualized money-market yield on cash)")
print("=" * 90)

mmf_yield = 0.04

# --- Current Rules ---
current_trim = [(75, 0.03), (100, 0.05), (150, 0.08), (200, 0.10)]
current_deploy = [(-20, 1/3), (-25, 1/3), (-30, 1/3)]
r1 = simulate(current_trim, current_deploy, mmf_yield)
n1 = print_results(r1, "CURRENT RULES (with 4% cash yield)")

# --- Pure Optimizer Output ---
opt_trim = [(80, 0.01), (120, 0.03), (175, 0.05), (250, 0.15)]
opt_deploy = [(-25, 0.10), (-30, 0.30), (-45, 0.60)]
r2 = simulate(opt_trim, opt_deploy, mmf_yield)
n2 = print_results(r2, "RAW OPTIMIZER (with 4% cash yield)")

# --- Practical Variant A: Keep deploy at -20/-30/-40 but weight toward depth ---
pract_a_trim = [(80, 0.02), (120, 0.04), (175, 0.07), (250, 0.12)]
pract_a_deploy = [(-20, 0.20), (-30, 0.30), (-40, 0.50)]
r3 = simulate(pract_a_trim, pract_a_deploy, mmf_yield)
n3 = print_results(r3, "PRACTICAL VARIANT A: Trim 2/4/7/12%, Deploy 20/30/50 at -20/-30/-40")

# --- Practical Variant B: earlier deploy start, heavier at depth ---
pract_b_trim = [(75, 0.02), (100, 0.04), (150, 0.07), (200, 0.12)]
pract_b_deploy = [(-20, 0.25), (-30, 0.35), (-40, 0.40)]
r4 = simulate(pract_b_trim, pract_b_deploy, mmf_yield)
n4 = print_results(r4, "PRACTICAL VARIANT B: Trim 2/4/7/12%, Deploy 25/35/40 at -20/-30/-40")

# --- Practical Variant C: Shallower trim thresholds, moderate cash ---
pract_c_trim = [(60, 0.02), (100, 0.04), (150, 0.07), (200, 0.10)]
pract_c_deploy = [(-20, 0.25), (-30, 0.35), (-40, 0.40)]
r5 = simulate(pract_c_trim, pract_c_deploy, mmf_yield)
n5 = print_results(r5, "PRACTICAL VARIANT C: Start trim at +60%, Deploy 25/35/40 at -20/-30/-40")

# --- Practical Variant D: deeper deployment schedule ---
pract_d_trim = [(80, 0.02), (120, 0.04), (175, 0.07), (250, 0.12)]
pract_d_deploy = [(-25, 0.20), (-35, 0.30), (-45, 0.50)]
r6 = simulate(pract_d_trim, pract_d_deploy, mmf_yield)
n6 = print_results(r6, "PRACTICAL VARIANT D: Trim 2/4/7/12%, Deploy 20/30/50 at -25/-35/-45")

# --- Practical Variant E: 4-tranche deployment ---
pract_e_trim = [(80, 0.02), (120, 0.04), (175, 0.07), (250, 0.12)]
pract_e_deploy = [(-20, 0.15), (-25, 0.20), (-35, 0.25), (-45, 0.40)]
r7 = simulate(pract_e_trim, pract_e_deploy, mmf_yield)
n7 = print_results(r7, "PRACTICAL VARIANT E: 4-tranche: 15/20/25/40 at -20/-25/-35/-45")


# === COMPARISON TABLE ===
print("\n" + "=" * 90)
print("  COMPARISON TABLE")
print("=" * 90)

strategies = [
    ("Current Rules", n1, current_trim, current_deploy),
    ("Raw Optimizer", n2, opt_trim, opt_deploy),
    ("Variant A: -20/-30/-40", n3, pract_a_trim, pract_a_deploy),
    ("Variant B: orig thresholds", n4, pract_b_trim, pract_b_deploy),
    ("Variant C: early start", n5, pract_c_trim, pract_c_deploy),
    ("Variant D: -25/-35/-45", n6, pract_d_trim, pract_d_deploy),
    ("Variant E: 4-tranche", n7, pract_e_trim, pract_e_deploy),
]

print(f"\n{'Strategy':<28} | {'Avg Net':>8} | {'Med Net':>8} | {'Worst':>8} | "
      f"{'Best':>8} | {'%Pos':>5} | {'StdDev':>7}")
print("-" * 90)

for name, nets, _, _ in strategies:
    print(f"  {name:<26} | {np.mean(nets)*100:>+7.3f}% | {np.median(nets)*100:>+7.3f}% | "
          f"{min(nets)*100:>+7.3f}% | {max(nets)*100:>+7.3f}% | "
          f"{sum(1 for n in nets if n>0)/len(nets)*100:>4.0f}% | "
          f"{np.std(nets)*100:>6.3f}%")


# === DETAILED DEPLOYMENT PROBABILITY ANALYSIS ===
print("\n" + "=" * 90)
print("  DEPLOYMENT EFFICIENCY: How much cash actually gets deployed?")
print("=" * 90)

for name, _, trim, deploy in strategies:
    undeployed_pcts = []
    for (bull_name, bull_gain, bull_dur), (bear_name, bear_dd_raw, bear_dur, bear_recov) in pairs:
        bear_dd = abs(bear_dd_raw)
        sorted_trim = sorted(trim, key=lambda x: x[0])

        total_cash = 0.0
        for i, (threshold, cum_cash) in enumerate(sorted_trim):
            if bull_gain >= threshold:
                total_cash = cum_cash

        if total_cash == 0:
            continue

        cash_remaining = total_cash
        for deploy_threshold, deploy_fraction in deploy:
            deploy_level = abs(deploy_threshold)
            if bear_dd >= deploy_level and cash_remaining > 0:
                amount = total_cash * deploy_fraction
                amount = min(amount, cash_remaining)
                cash_remaining -= amount

        undeployed_pct = (cash_remaining / total_cash * 100) if total_cash > 0 else 0
        undeployed_pcts.append(undeployed_pct)

    if undeployed_pcts:
        print(f"  {name:<28}: Avg undeployed = {np.mean(undeployed_pcts):.1f}%, "
              f"Fully deployed in {sum(1 for u in undeployed_pcts if u < 1)/len(undeployed_pcts)*100:.0f}% of cycles, "
              f"Max undeployed = {max(undeployed_pcts):.0f}%")


# === SENSITIVITY TO CASH YIELD ===
print("\n" + "=" * 90)
print("  SENSITIVITY: Net impact at different cash yields")
print("=" * 90)

best_pract = pract_d_trim  # Choose Variant D as candidate
best_pract_deploy = pract_d_deploy

print(f"\n  Using Variant D trim/deploy schedule")
print(f"\n{'Cash Yield':>12} | {'Avg Net':>8} | {'Med Net':>8} | {'Worst':>8}")
print("-" * 45)

for cy in [0.0, 0.02, 0.04, 0.05, 0.06]:
    r = simulate(best_pract, best_pract_deploy, cy)
    nets = [x[7] for x in r]
    print(f"  {cy*100:>8.0f}%    | {np.mean(nets)*100:>+7.3f}% | "
          f"{np.median(nets)*100:>+7.3f}% | {min(nets)*100:>+7.3f}%")


# === FINAL: UNIFIED SCORING WITH SHARPE-LIKE METRIC ===
print("\n" + "=" * 90)
print("  RISK-ADJUSTED SCORING (Net Impact / Volatility of Outcome)")
print("=" * 90)

print(f"\n{'Strategy':<28} | {'Avg/Std':>8} | {'Interpretation'}")
print("-" * 70)

for name, nets, _, _ in strategies:
    avg = np.mean(nets)
    std = np.std(nets)
    if std > 0:
        ratio = avg / std
    else:
        ratio = 0
    interp = "GOOD" if ratio > 0.1 else ("NEUTRAL" if ratio > -0.1 else "COSTLY")
    print(f"  {name:<26} | {ratio:>+7.3f}  | {interp}")
