#!/usr/bin/env python3
"""
Fine-grained optimization around the winning parameter region.
The coarse search found that 3-tranche deployment fixes the Dot-Com loss.
Now we fine-tune all parameters for maximum alpha while maintaining 100% non-loss.

We also want to understand whether the "win rate" definition should be:
- Strictly positive alpha on every cycle, OR
- Non-negative alpha (>= 0) on every cycle

Since age-gated cycles produce exactly 0 alpha (no action taken), we define
"100% win rate" as "no cycle has NEGATIVE alpha" (i.e., min_alpha >= 0).
"""

import sys
import math
from itertools import product

sys.path.insert(0, '/home/user/Dashboard')
from backtest_22bears import (
    Cycle, CYCLES_22, TrimTier, DeployTier, Strategy,
    simulate_cycle, run_full_backtest, print_results,
)


def test_quick(age, trims, decay, deploys):
    """Quick test returning key metrics."""
    s = Strategy(age_gate_months=age, trim_tiers=trims,
                 time_decay_months=decay, deploy_tiers=deploys)
    bt = run_full_backtest(s)
    return bt


def main():
    print("=" * 100)
    print("FINE-GRAINED OPTIMIZATION")
    print("=" * 100)

    # Based on coarse search, best region:
    # - Age gate: 21 (allows 1935-37 which is 24mo)
    # - Trims: +75/150/250/350/500 -> 1/3/5/7/9%
    # - Decay: 24 (allows re-trimming in mega-bulls)
    # - Deploy: 3 tranches at -20/-30/-40 with 33/50/100%

    # Fine-tune around these values
    best_results = []

    # Age gates to test
    ages = [15, 18, 21, 24]

    # Time decay options
    decays = [0, 18, 21, 24, 30, 36]

    # Trim configurations - fine variations
    trim_configs = []
    # Base: 75/150/250/350/500 -> 1/3/5/7/9
    # Vary thresholds
    for t1_gain in [60, 75, 90, 100]:
        for t1_cash in [0.5, 1.0, 1.5]:
            for t2_gain in [125, 150, 175, 200]:
                for t2_cash in [2, 3, 4]:
                    for max_tiers in [3, 4, 5]:
                        trims = [TrimTier(t1_gain, t1_cash), TrimTier(t2_gain, t2_cash)]
                        if max_tiers >= 3:
                            trims.append(TrimTier(250, 5))
                        if max_tiers >= 4:
                            trims.append(TrimTier(350, 7))
                        if max_tiers >= 5:
                            trims.append(TrimTier(500, 9))
                        # Only add if not duplicate
                        trim_key = tuple((t.gain_pct, t.cash_target_pct) for t in trims)
                        if trim_key not in [tuple((t.gain_pct, t.cash_target_pct) for t in tc) for tc in trim_configs]:
                            trim_configs.append(trims)

    # Deploy configurations - fine variations
    deploy_configs = []
    # 2-tranche
    for d1_dd in [20, 25, 30]:
        for d1_pct in [40, 50, 60]:
            for d2_dd in [25, 30, 35, 40]:
                if d2_dd <= d1_dd:
                    continue
                for d2_pct in [80, 100]:
                    deploy_configs.append([DeployTier(d1_dd, d1_pct), DeployTier(d2_dd, d2_pct)])

    # 3-tranche
    for d1_dd in [20, 25]:
        for d1_pct in [25, 33, 40]:
            for d2_dd in [30, 35]:
                if d2_dd <= d1_dd:
                    continue
                for d2_pct in [40, 50, 60]:
                    for d3_dd in [35, 40, 45, 50]:
                        if d3_dd <= d2_dd:
                            continue
                        deploy_configs.append([
                            DeployTier(d1_dd, d1_pct),
                            DeployTier(d2_dd, d2_pct),
                            DeployTier(d3_dd, 100),
                        ])

    total = len(ages) * len(decays) * len(trim_configs) * len(deploy_configs)
    print(f"\nFine search: {len(ages)} ages x {len(decays)} decays x {len(trim_configs)} trims x {len(deploy_configs)} deploys = {total} combos")

    if total > 500000:
        print("Too many combos, reducing search space...")
        # Reduce trim configs to top candidates
        trim_configs = trim_configs[:200]
        total = len(ages) * len(decays) * len(trim_configs) * len(deploy_configs)
        print(f"Reduced to {total} combos")

    count = 0
    best_cum_alpha = -999
    best_strat_info = None

    for age in ages:
        for decay in decays:
            for trims in trim_configs:
                for deploys in deploy_configs:
                    count += 1
                    bt = test_quick(age, trims, decay, deploys)

                    if bt['min_alpha'] >= 0:
                        if bt['cum_alpha_cagr'] > best_cum_alpha:
                            best_cum_alpha = bt['cum_alpha_cagr']
                            best_strat_info = {
                                'age': age, 'decay': decay,
                                'trims': trims, 'deploys': deploys,
                                'bt': bt,
                            }
                            best_results.append(best_strat_info)

                    if count % 10000 == 0:
                        print(f"  Tested {count}/{total}... best cum alpha CAGR so far: {best_cum_alpha:+.4f}%")

    print(f"\nDone. Tested {count} combinations.")
    print(f"Best cumulative alpha CAGR: {best_cum_alpha:+.4f}% ({best_cum_alpha*100:+.1f} bps/yr)")

    if best_strat_info:
        s = best_strat_info
        trim_desc = ", ".join([f"+{t.gain_pct}%->{t.cash_target_pct}%" for t in s['trims']])
        deploy_desc = ", ".join([f"-{d.drawdown_pct}%->{d.deploy_pct_of_cash}%" for d in s['deploys']])
        decay_desc = f"{s['decay']}mo" if s['decay'] > 0 else "OFF"

        print(f"\n{'='*100}")
        print(f"BEST STRATEGY FOUND")
        print(f"{'='*100}")
        print(f"  Age gate:    {s['age']} months")
        print(f"  Trim tiers:  {trim_desc}")
        print(f"  Time decay:  {decay_desc}")
        print(f"  Deploy:      {deploy_desc}")
        print()

        # Run with verbose
        strat = Strategy(
            age_gate_months=s['age'],
            trim_tiers=s['trims'],
            time_decay_months=s['decay'],
            deploy_tiers=s['deploys'],
        )
        bt_detail = run_full_backtest(strat, verbose=True)
        print_results(bt_detail, f"OPTIMIZED: Age={s['age']}mo, Decay={decay_desc}")

    # Also test the current strategy with just the deploy fix
    print(f"\n\n{'='*100}")
    print("COMPARISON: Current strategy with 3-tranche deploy fix")
    print(f"{'='*100}")
    fixed_strat = Strategy(
        age_gate_months=21,
        trim_tiers=[
            TrimTier(75, 1), TrimTier(150, 3), TrimTier(250, 5),
            TrimTier(350, 7), TrimTier(500, 9),
        ],
        time_decay_months=24,
        deploy_tiers=[
            DeployTier(20, 33), DeployTier(30, 50), DeployTier(40, 100),
        ],
    )
    bt_fixed = run_full_backtest(fixed_strat, verbose=False)
    print_results(bt_fixed, "Current + 3-Tranche Deploy Fix")


if __name__ == "__main__":
    main()
