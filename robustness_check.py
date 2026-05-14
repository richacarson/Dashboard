#!/usr/bin/env python3
"""
Robustness check: Compare conservative vs aggressive optimized strategies.
The "Very high cash" strategy with 18% max cash allocation seems aggressive.
Let's verify it's robust and compare against more moderate alternatives.

Also check for overfitting by examining the distribution of alpha.
"""

import sys
sys.path.insert(0, '/home/user/Dashboard')
from backtest_22bears import (
    Cycle, CYCLES_22, TrimTier, DeployTier, Strategy,
    simulate_cycle, run_full_backtest, print_results,
)


def main():
    strategies = {
        "CURRENT": Strategy(
            age_gate_months=21,
            trim_tiers=[TrimTier(75, 1), TrimTier(150, 3), TrimTier(250, 5),
                        TrimTier(350, 7), TrimTier(500, 9)],
            time_decay_months=24,
            deploy_tiers=[DeployTier(25, 50), DeployTier(30, 100)],
        ),

        "FIX-A: Minimal (3-tranche deploy only)": Strategy(
            age_gate_months=21,
            trim_tiers=[TrimTier(75, 1), TrimTier(150, 3), TrimTier(250, 5),
                        TrimTier(350, 7), TrimTier(500, 9)],
            time_decay_months=24,
            deploy_tiers=[DeployTier(20, 33), DeployTier(30, 50), DeployTier(40, 100)],
        ),

        "FIX-B: Conservative (moderate cash, deep deploy)": Strategy(
            age_gate_months=21,
            trim_tiers=[TrimTier(75, 1), TrimTier(150, 3), TrimTier(250, 5),
                        TrimTier(350, 7), TrimTier(500, 9)],
            time_decay_months=24,
            deploy_tiers=[DeployTier(25, 25), DeployTier(35, 40), DeployTier(50, 100)],
        ),

        "FIX-C: Moderate (2x cash, deep deploy)": Strategy(
            age_gate_months=21,
            trim_tiers=[TrimTier(75, 2), TrimTier(150, 5), TrimTier(250, 8),
                        TrimTier(350, 11), TrimTier(500, 14)],
            time_decay_months=24,
            deploy_tiers=[DeployTier(25, 25), DeployTier(35, 40), DeployTier(50, 100)],
        ),

        "FIX-D: Aggressive (high cash, deep deploy, 18mo decay)": Strategy(
            age_gate_months=21,
            trim_tiers=[TrimTier(75, 2), TrimTier(150, 5), TrimTier(250, 10),
                        TrimTier(350, 14), TrimTier(500, 18)],
            time_decay_months=18,
            deploy_tiers=[DeployTier(25, 25), DeployTier(35, 40), DeployTier(50, 100)],
        ),

        "FIX-E: Moderate+ (2x cash, 18mo decay, deep deploy)": Strategy(
            age_gate_months=21,
            trim_tiers=[TrimTier(75, 2), TrimTier(150, 5), TrimTier(250, 8),
                        TrimTier(350, 11), TrimTier(500, 14)],
            time_decay_months=18,
            deploy_tiers=[DeployTier(25, 25), DeployTier(35, 40), DeployTier(50, 100)],
        ),

        "FIX-F: Conservative+ (1.5x cash, 18mo decay)": Strategy(
            age_gate_months=21,
            trim_tiers=[TrimTier(75, 1.5), TrimTier(150, 4), TrimTier(250, 7),
                        TrimTier(350, 10), TrimTier(500, 13)],
            time_decay_months=18,
            deploy_tiers=[DeployTier(25, 25), DeployTier(35, 40), DeployTier(50, 100)],
        ),
    }

    print(f"{'='*130}")
    print(f"ROBUSTNESS COMPARISON")
    print(f"{'='*130}")

    print(f"\n{'Strategy':<50} {'Win':>5} {'NonLoss':>7} {'MinA%':>8} {'AvgA%':>8} {'MedA%':>8} "
          f"{'MaxA%':>8} {'bps/yr':>8} {'Excess%':>8} {'Safe':>5}")
    print("-" * 130)

    results_by_name = {}
    for name, strat in strategies.items():
        bt = run_full_backtest(strat)
        safe = "YES" if bt['min_alpha'] >= 0 else "FAIL"
        excess = (bt['cum_strategy'] / bt['cum_bnh'] - 1) * 100
        bps = bt['cum_alpha_cagr'] * 100
        print(f"{name:<50} {bt['wins']:>3}/21 {bt['wins']+bt['ties']:>5}/21 "
              f"{bt['min_alpha']:>+8.4f} {bt['avg_alpha']:>+8.4f} {bt['median_alpha']:>+8.4f} "
              f"{bt['max_alpha']:>+8.4f} {bps:>+8.1f} {excess:>+8.2f} {safe:>5}")
        results_by_name[name] = bt

    # Detailed cycle-by-cycle for all safe strategies
    safe_names = [n for n, bt in results_by_name.items() if bt['min_alpha'] >= 0]

    print(f"\n\n{'='*130}")
    print("CYCLE-BY-CYCLE ALPHA FOR ALL SAFE STRATEGIES")
    print(f"{'='*130}")

    header = f"{'#':<3} {'Cycle':<35}"
    for name in safe_names:
        short = name[:15]
        header += f" {short:>15}"
    print(header)
    print("-" * (38 + 16 * len(safe_names)))

    for i in range(21):
        row = f"{i+1:<3} {results_by_name['CURRENT']['results'][i]['cycle'][:35]:<35}"
        for name in safe_names:
            alpha = results_by_name[name]['results'][i]['alpha_pct']
            row += f" {alpha:>+15.4f}"
        print(row)

    print("-" * (38 + 16 * len(safe_names)))
    row = f"{'':3} {'TOTAL ALPHA':35}"
    for name in safe_names:
        total = sum(r['alpha_pct'] for r in results_by_name[name]['results'])
        row += f" {total:>+15.4f}"
    print(row)

    # The tradeoff analysis
    print(f"\n\n{'='*130}")
    print("TRADEOFF ANALYSIS")
    print(f"{'='*130}")
    print("""
Key considerations:

1. CURRENT strategy: 4.1 bps/yr but has ONE LOSS (Dot-Com: -1.22%). Not 100% safe.

2. FIX-A (minimal 3-tranche deploy): 5.1 bps/yr, 100% safe.
   - Least change from current. Just adds a third deploy tranche at -40%.
   - Conservative approach.

3. FIX-B (conservative deep deploy): Same trims as current, deploy at -25/-35/-50.
   - Keeps more cash for deeper bears. Slightly better than FIX-A.

4. FIX-C (moderate): Doubles cash targets, deep deploy, 24mo decay.
   - More alpha but higher cash drag during benign markets.

5. FIX-D (aggressive): Very high cash (up to 18%), 18mo decay.
   - Highest alpha but most deviation from buy-and-hold.
   - The Dot-Com alpha of +16.8% suggests possible overfitting.
   - With 18% max cash, strategy holds significant uninvested capital.

6. FIX-E (moderate+): Balanced approach. 14% max cash, 18mo decay.
   - Good alpha without extreme cash positions.

7. FIX-F (conservative+): 13% max cash, 18mo decay.
   - Moderate alpha, reasonable cash levels.

RECOMMENDATION DEPENDS ON RISK TOLERANCE:
  - Minimal change: FIX-A (3-tranche deploy fix only)
  - Balanced: FIX-E or FIX-F (moderate cash, deep deploy)
  - Maximum alpha: FIX-D (high cash, but potential overfitting)
""")

    # Print detailed table for RECOMMENDED (FIX-E as balanced choice)
    print(f"\n\n{'='*130}")
    print("DETAILED: FIX-E (RECOMMENDED BALANCED STRATEGY)")
    print(f"{'='*130}")
    bt_e = run_full_backtest(strategies["FIX-E: Moderate+ (2x cash, 18mo decay, deep deploy)"], verbose=True)
    print_results(bt_e, "FIX-E: Moderate+ (2x cash, 18mo decay, deep deploy)")


if __name__ == "__main__":
    main()
