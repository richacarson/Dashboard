#!/usr/bin/env python3
"""
Optimizer for 22-Bear Strategy
Goal: Find parameters that achieve 100% non-negative alpha (win rate)
while maximizing cumulative alpha.

Key insight from current strategy failure:
- Dot-Com (147.6mo bull) triggers time decay twice, causing cash churn
- Time decay resets trims, but at higher price levels the trim amounts
  are small relative to the already-appreciated equity
- The cumulative effect is negative: small trims at high levels +
  opportunity cost of cash during further bull run > deployment benefit

Search space:
- Age gate: 12-60 months
- Trim tier 1: gain 50-150%, cash 0.5-3%
- Trim tier 2: gain 100-250%, cash 1-6%
- Trim tier 3: gain 200-400%, cash 3-10%
- Trim tier 4: gain 300-600%, cash 5-15%
- Trim tier 5: gain 400-800%, cash 7-20% (optional)
- Time decay: 12-60 months (or disabled)
- Deploy 1: drawdown 15-35%, cash deploy 30-70%
- Deploy 2: drawdown 25-50%, cash deploy 50-100%
"""

import sys
import itertools
import math
from dataclasses import dataclass
from typing import List, Optional

# Import from the backtest module
sys.path.insert(0, '/home/user/Dashboard')
from backtest_22bears import (
    Cycle, CYCLES_22, TrimTier, DeployTier, Strategy,
    simulate_cycle, run_full_backtest, print_results,
    RISK_FREE_MONTHLY
)


def test_strategy(age_gate, trim_tiers, decay_months, deploy_tiers):
    """Quick test: returns (min_alpha, avg_alpha, cum_alpha_cagr, n_positive)."""
    strategy = Strategy(
        age_gate_months=age_gate,
        trim_tiers=trim_tiers,
        time_decay_months=decay_months,
        deploy_tiers=deploy_tiers,
    )
    bt = run_full_backtest(strategy)
    return bt['min_alpha'], bt['avg_alpha'], bt['cum_alpha_cagr'], bt['wins'], bt


def main():
    print("=" * 80)
    print("PHASE 1: Diagnose the Dot-Com failure")
    print("=" * 80)

    # The issue: In a 147.6-month bull, time decay fires at month 68 and 95
    # After each decay, trims re-trigger but at lower percentages of a
    # much larger portfolio. The net effect is: you trim small amounts,
    # hold them briefly in cash (losing equity upside), then redeploy.
    # The cash drag > deployment benefit.

    # Approach 1: Disable time decay entirely
    print("\n--- Test: No time decay ---")
    strategy_no_decay = Strategy(
        age_gate_months=21,
        trim_tiers=[
            TrimTier(75, 1), TrimTier(150, 3), TrimTier(250, 5),
            TrimTier(350, 7), TrimTier(500, 9),
        ],
        time_decay_months=0,  # disabled
        deploy_tiers=[
            DeployTier(25, 50), DeployTier(30, 100),
        ],
    )
    bt = run_full_backtest(strategy_no_decay, verbose=False)
    print_results(bt, "No Time Decay (else same)")

    # Approach 2: Longer time decay (36 months)
    print("\n--- Test: 36-month time decay ---")
    strategy_36decay = Strategy(
        age_gate_months=21,
        trim_tiers=[
            TrimTier(75, 1), TrimTier(150, 3), TrimTier(250, 5),
            TrimTier(350, 7), TrimTier(500, 9),
        ],
        time_decay_months=36,
        deploy_tiers=[
            DeployTier(25, 50), DeployTier(30, 100),
        ],
    )
    bt = run_full_backtest(strategy_36decay, verbose=False)
    print_results(bt, "36-month Time Decay")

    # Approach 3: Longer time decay (48 months)
    print("\n--- Test: 48-month time decay ---")
    strategy_48decay = Strategy(
        age_gate_months=21,
        trim_tiers=[
            TrimTier(75, 1), TrimTier(150, 3), TrimTier(250, 5),
            TrimTier(350, 7), TrimTier(500, 9),
        ],
        time_decay_months=48,
        deploy_tiers=[
            DeployTier(25, 50), DeployTier(30, 100),
        ],
    )
    bt = run_full_backtest(strategy_48decay, verbose=False)
    print_results(bt, "48-month Time Decay")

    print("\n" + "=" * 80)
    print("PHASE 2: Systematic Grid Search")
    print("=" * 80)

    # Grid search over key parameters
    best_strategies = []

    age_gates = [12, 15, 18, 21, 24, 30, 36]
    decay_options = [0, 24, 30, 36, 42, 48, 60]  # 0 = disabled

    # Trim tier configurations (gain%, cash%)
    trim_configs = [
        # Config A: Current (low cash targets)
        [TrimTier(75, 1), TrimTier(150, 3), TrimTier(250, 5), TrimTier(350, 7), TrimTier(500, 9)],
        # Config B: Higher thresholds
        [TrimTier(100, 1), TrimTier(200, 3), TrimTier(300, 5), TrimTier(400, 7), TrimTier(600, 9)],
        # Config C: Fewer tiers, higher thresholds
        [TrimTier(100, 2), TrimTier(200, 4), TrimTier(350, 7), TrimTier(500, 10)],
        # Config D: Very conservative
        [TrimTier(75, 0.5), TrimTier(150, 1.5), TrimTier(250, 3), TrimTier(350, 5), TrimTier(500, 7)],
        # Config E: Aggressive low tiers
        [TrimTier(50, 1), TrimTier(100, 2), TrimTier(175, 4), TrimTier(250, 6), TrimTier(400, 9)],
        # Config F: Current but lower max
        [TrimTier(75, 1), TrimTier(150, 2), TrimTier(250, 4), TrimTier(350, 6), TrimTier(500, 8)],
        # Config G: Very few tiers
        [TrimTier(100, 1), TrimTier(250, 3), TrimTier(500, 6)],
        # Config H: Micro trims
        [TrimTier(75, 0.5), TrimTier(150, 1), TrimTier(250, 2), TrimTier(350, 3), TrimTier(500, 5)],
    ]

    deploy_configs = [
        # Deploy A: Current
        [DeployTier(25, 50), DeployTier(30, 100)],
        # Deploy B: Earlier first tranche
        [DeployTier(20, 50), DeployTier(30, 100)],
        # Deploy C: More aggressive
        [DeployTier(20, 60), DeployTier(25, 100)],
        # Deploy D: Three tranches
        [DeployTier(20, 33), DeployTier(30, 50), DeployTier(40, 100)],
        # Deploy E: All at once deep
        [DeployTier(25, 100)],
        # Deploy F: Current thresholds, different splits
        [DeployTier(25, 40), DeployTier(30, 100)],
    ]

    total_combos = len(age_gates) * len(decay_options) * len(trim_configs) * len(deploy_configs)
    print(f"\nSearching {total_combos} combinations...")

    count = 0
    for age in age_gates:
        for decay in decay_options:
            for ti, trims in enumerate(trim_configs):
                for di, deploys in enumerate(deploy_configs):
                    count += 1
                    min_a, avg_a, cum_a, wins, bt = test_strategy(age, trims, decay, deploys)

                    # Only keep strategies with 100% non-negative alpha
                    if min_a >= 0:
                        best_strategies.append({
                            'age': age,
                            'decay': decay,
                            'trim_config': ti,
                            'deploy_config': di,
                            'trims': trims,
                            'deploys': deploys,
                            'min_alpha': min_a,
                            'avg_alpha': avg_a,
                            'cum_alpha_cagr': cum_a,
                            'wins': wins,
                            'bt': bt,
                        })

    print(f"\nSearched {count} combinations.")
    print(f"Found {len(best_strategies)} strategies with min_alpha >= 0")

    if best_strategies:
        # Sort by cumulative alpha CAGR descending
        best_strategies.sort(key=lambda x: x['cum_alpha_cagr'], reverse=True)

        print(f"\n{'='*100}")
        print("TOP 20 STRATEGIES (by cumulative alpha CAGR)")
        print(f"{'='*100}")

        for rank, s in enumerate(best_strategies[:20], 1):
            # Describe trims
            trim_desc = ", ".join([f"+{t.gain_pct}%->{t.cash_target_pct}%" for t in s['trims']])
            deploy_desc = ", ".join([f"-{d.drawdown_pct}%->{d.deploy_pct_of_cash}%" for d in s['deploys']])
            decay_desc = f"{s['decay']}mo" if s['decay'] > 0 else "OFF"

            print(f"\n  #{rank}: Age={s['age']}mo, Decay={decay_desc}")
            print(f"    Trims: {trim_desc}")
            print(f"    Deploy: {deploy_desc}")
            print(f"    Win: {s['wins']}/21, Min alpha: {s['min_alpha']:+.4f}%, "
                  f"Avg alpha: {s['avg_alpha']:+.4f}%, Cum CAGR alpha: {s['cum_alpha_cagr']:+.4f}% ({s['cum_alpha_cagr']*100:+.1f} bps/yr)")

        # Print detailed results for the best strategy
        best = best_strategies[0]
        print(f"\n\n{'='*100}")
        print("DETAILED RESULTS FOR BEST STRATEGY")
        print(f"{'='*100}")

        best_strat = Strategy(
            age_gate_months=best['age'],
            trim_tiers=best['trims'],
            time_decay_months=best['decay'],
            deploy_tiers=best['deploys'],
        )
        bt_detail = run_full_backtest(best_strat, verbose=True)
        trim_desc = ", ".join([f"+{t.gain_pct}%->{t.cash_target_pct}%" for t in best['trims']])
        deploy_desc = ", ".join([f"-{d.drawdown_pct}%->{d.deploy_pct_of_cash}%" for d in best['deploys']])
        decay_desc = f"{best['decay']}mo" if best['decay'] > 0 else "OFF"
        print_results(bt_detail, f"BEST: Age={best['age']}mo, Decay={decay_desc}, Trims=[{trim_desc}], Deploy=[{deploy_desc}]")

    else:
        print("\n*** NO STRATEGIES FOUND WITH 100% NON-NEGATIVE ALPHA ***")
        print("Showing best losers...")

        # Try to find strategies with min_alpha closest to 0
        # Re-run but collect all
        all_results = []
        for age in age_gates:
            for decay in decay_options:
                for ti, trims in enumerate(trim_configs):
                    for di, deploys in enumerate(deploy_configs):
                        min_a, avg_a, cum_a, wins, bt = test_strategy(age, trims, decay, deploys)
                        all_results.append({
                            'age': age, 'decay': decay,
                            'trim_config': ti, 'deploy_config': di,
                            'trims': trims, 'deploys': deploys,
                            'min_alpha': min_a, 'avg_alpha': avg_a,
                            'cum_alpha_cagr': cum_a, 'wins': wins, 'bt': bt,
                        })

        all_results.sort(key=lambda x: x['min_alpha'], reverse=True)
        print(f"\nBest 10 by min_alpha:")
        for s in all_results[:10]:
            trim_desc = ", ".join([f"+{t.gain_pct}%->{t.cash_target_pct}%" for t in s['trims']])
            deploy_desc = ", ".join([f"-{d.drawdown_pct}%->{d.deploy_pct_of_cash}%" for d in s['deploys']])
            decay_desc = f"{s['decay']}mo" if s['decay'] > 0 else "OFF"
            print(f"  Age={s['age']}mo, Decay={decay_desc}, Trims=[{trim_desc}], Deploy=[{deploy_desc}]")
            print(f"    Min alpha: {s['min_alpha']:+.4f}%, Avg: {s['avg_alpha']:+.4f}%, Cum CAGR: {s['cum_alpha_cagr']:+.4f}%")


if __name__ == "__main__":
    main()
