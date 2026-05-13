#!/usr/bin/env python3
"""
Final analysis: Run the best strategies found and produce the definitive report.
This script tests specific parameter combinations identified by the optimizer.
"""

import sys
sys.path.insert(0, '/home/user/Dashboard')
from backtest_22bears import (
    Cycle, CYCLES_22, TrimTier, DeployTier, Strategy,
    simulate_cycle, run_full_backtest, print_results,
)


def test_and_print(name, age, trims, decay, deploys, verbose=True):
    """Test a strategy and print results."""
    s = Strategy(age_gate_months=age, trim_tiers=trims,
                 time_decay_months=decay, deploy_tiers=deploys)
    bt = run_full_backtest(s, verbose=verbose)
    print_results(bt, name)
    return bt


def main():
    print("=" * 120)
    print("FINAL ANALYSIS: 22-BEAR / 21-CYCLE DATASET")
    print("=" * 120)

    # ── Strategy 1: CURRENT (broken) ──
    print("\n\n" + "=" * 120)
    print("STRATEGY A: CURRENT (has Dot-Com loss)")
    print("=" * 120)
    bt_current = test_and_print(
        "CURRENT: Age=21, Decay=24, Deploy=-25/50% -30/100%",
        age=21,
        trims=[TrimTier(75, 1), TrimTier(150, 3), TrimTier(250, 5),
               TrimTier(350, 7), TrimTier(500, 9)],
        decay=24,
        deploys=[DeployTier(25, 50), DeployTier(30, 100)],
        verbose=False,
    )

    # ── Strategy 2: Minimal fix (just change deploy) ──
    print("\n\n" + "=" * 120)
    print("STRATEGY B: MINIMAL FIX (3-tranche deploy)")
    print("=" * 120)
    bt_fix = test_and_print(
        "MINIMAL FIX: Age=21, Decay=24, Deploy=-20/33% -30/50% -40/100%",
        age=21,
        trims=[TrimTier(75, 1), TrimTier(150, 3), TrimTier(250, 5),
               TrimTier(350, 7), TrimTier(500, 9)],
        decay=24,
        deploys=[DeployTier(20, 33), DeployTier(30, 50), DeployTier(40, 100)],
        verbose=False,
    )

    # ── Strategy 3: Optimized (from fine search -- higher cash, deeper deploys) ──
    # Testing several promising configurations from the optimizer
    print("\n\n" + "=" * 120)
    print("STRATEGY C: OPTIMIZED CANDIDATES")
    print("=" * 120)

    candidates = [
        # Higher cash targets
        ("C1: Higher cash targets",
         21, [TrimTier(60, 1.5), TrimTier(125, 4), TrimTier(250, 5), TrimTier(350, 7), TrimTier(500, 9)],
         24, [DeployTier(20, 33), DeployTier(30, 50), DeployTier(40, 100)]),

        ("C2: Lower thresholds, moderate cash",
         21, [TrimTier(60, 1.0), TrimTier(125, 3), TrimTier(250, 5), TrimTier(350, 7), TrimTier(500, 9)],
         24, [DeployTier(20, 40), DeployTier(30, 60), DeployTier(40, 100)]),

        ("C3: Age=18, aggressive entry",
         18, [TrimTier(60, 1.5), TrimTier(125, 4), TrimTier(250, 5), TrimTier(350, 7), TrimTier(500, 9)],
         24, [DeployTier(20, 25), DeployTier(30, 50), DeployTier(40, 100)]),

        ("C4: Age=15, early trim, deep deploy",
         15, [TrimTier(60, 1.5), TrimTier(125, 4), TrimTier(250, 5), TrimTier(350, 7), TrimTier(500, 9)],
         24, [DeployTier(20, 33), DeployTier(35, 50), DeployTier(45, 100)]),

        ("C5: Higher cash, 3-tier deploy deeper",
         21, [TrimTier(75, 1.5), TrimTier(150, 4), TrimTier(250, 5), TrimTier(350, 7), TrimTier(500, 9)],
         24, [DeployTier(20, 25), DeployTier(35, 50), DeployTier(50, 100)]),

        ("C6: Lower age, higher cash everywhere",
         18, [TrimTier(75, 1.5), TrimTier(150, 4), TrimTier(250, 5), TrimTier(350, 7), TrimTier(500, 9)],
         24, [DeployTier(20, 33), DeployTier(30, 50), DeployTier(40, 100)]),

        ("C7: Very low first trim threshold",
         21, [TrimTier(60, 1.0), TrimTier(150, 3), TrimTier(250, 5), TrimTier(350, 7), TrimTier(500, 9)],
         24, [DeployTier(20, 33), DeployTier(30, 50), DeployTier(40, 100)]),

        ("C8: Age=18, first trim at 60%",
         18, [TrimTier(60, 1.0), TrimTier(150, 3), TrimTier(250, 5), TrimTier(350, 7), TrimTier(500, 9)],
         21, [DeployTier(20, 33), DeployTier(30, 50), DeployTier(40, 100)]),

        # Test no decay
        ("C9: No decay, same trims, 3-tranche deploy",
         21, [TrimTier(75, 1), TrimTier(150, 3), TrimTier(250, 5), TrimTier(350, 7), TrimTier(500, 9)],
         0, [DeployTier(20, 33), DeployTier(30, 50), DeployTier(40, 100)]),

        # Test larger cash with no decay
        ("C10: No decay, larger cash",
         21, [TrimTier(75, 2), TrimTier(150, 5), TrimTier(250, 8), TrimTier(350, 11), TrimTier(500, 14)],
         0, [DeployTier(20, 33), DeployTier(30, 50), DeployTier(40, 100)]),

        # Higher t1 cash with age 15
        ("C11: Age=15, t1=60->1.5, 3 deploy deep",
         15, [TrimTier(60, 1.5), TrimTier(125, 4), TrimTier(250, 5), TrimTier(350, 7), TrimTier(500, 9)],
         24, [DeployTier(20, 25), DeployTier(35, 50), DeployTier(50, 100)]),

        # Current trims but deploy at -25/-35/-45
        ("C12: Current trims, deeper deploy",
         21, [TrimTier(75, 1), TrimTier(150, 3), TrimTier(250, 5), TrimTier(350, 7), TrimTier(500, 9)],
         24, [DeployTier(25, 33), DeployTier(35, 50), DeployTier(45, 100)]),
    ]

    results = []
    for name, age, trims, decay, deploys in candidates:
        bt = test_and_print(name, age, trims, decay, deploys, verbose=False)
        results.append((name, bt))

    # ── Summary comparison ──
    print("\n\n" + "=" * 120)
    print("SUMMARY COMPARISON")
    print("=" * 120)
    print(f"\n{'Strategy':<55} {'Win':>5} {'MinA%':>8} {'AvgA%':>8} {'CumCAGR':>10} {'bps/yr':>8}")
    print("-" * 100)

    for name, bt in [("A: CURRENT (broken)", bt_current),
                     ("B: MINIMAL FIX", bt_fix)] + results:
        status = "OK" if bt['min_alpha'] >= 0 else "FAIL"
        print(f"{name:<55} {bt['wins']:>3}/21 {bt['min_alpha']:>+8.4f} {bt['avg_alpha']:>+8.4f} "
              f"{bt['cum_alpha_cagr']:>+10.4f} {bt['cum_alpha_cagr']*100:>+8.1f} [{status}]")


if __name__ == "__main__":
    main()
