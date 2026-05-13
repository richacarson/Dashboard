#!/usr/bin/env python3
"""
FINAL REPORT v3: Direct comparison using known best parameters.
No search phase - just run the strategies we've already identified.
"""

import sys
sys.path.insert(0, '/home/user/Dashboard')
from backtest_22bears import (
    Cycle, CYCLES_22, TrimTier, DeployTier, Strategy,
    simulate_cycle, run_full_backtest, print_results,
)


def main():
    print(f"{'#'*120}")
    print(f"#{'COMPREHENSIVE FINAL REPORT: 22-BEAR / 21-CYCLE DATASET':^118}#")
    print(f"{'#'*120}")

    # ═══════════════════════════════════════════════════════════════════════════
    # SECTION 1: CURRENT STRATEGY
    # ═══════════════════════════════════════════════════════════════════════════
    print(f"\n\n{'='*120}")
    print("SECTION 1: CURRENT STRATEGY BACKTEST")
    print(f"{'='*120}")
    print("\nParameters:")
    print("  Age gate:    21 months")
    print("  Trim tiers:  +75%->1%, +150%->3%, +250%->5%, +350%->7%, +500%->9%")
    print("  Time decay:  24 months")
    print("  Deploy:      -25%->50% of reserves, -30%->remaining 100%")

    current = Strategy(
        age_gate_months=21,
        trim_tiers=[TrimTier(75, 1), TrimTier(150, 3), TrimTier(250, 5),
                    TrimTier(350, 7), TrimTier(500, 9)],
        time_decay_months=24,
        deploy_tiers=[DeployTier(25, 50), DeployTier(30, 100)],
    )
    bt_curr = run_full_backtest(current, verbose=True)
    print_results(bt_curr, "CURRENT STRATEGY")

    # ═══════════════════════════════════════════════════════════════════════════
    # Quick test of top candidates to find the actual best
    # ═══════════════════════════════════════════════════════════════════════════
    print(f"\n\n{'='*120}")
    print("SECTION 1.5: TESTING TOP CANDIDATE STRATEGIES")
    print(f"{'='*120}")

    candidates = [
        # From fine optimizer: 11.7 bps/yr
        ("Fine-opt (11.7bps)",
         21, [TrimTier(60, 0.5), TrimTier(125, 4), TrimTier(250, 5), TrimTier(350, 7), TrimTier(500, 9)],
         18, [DeployTier(25, 25), DeployTier(35, 40), DeployTier(50, 100)]),

        # Variation: higher t1c
        ("Var: t1c=1.0",
         21, [TrimTier(60, 1.0), TrimTier(125, 4), TrimTier(250, 5), TrimTier(350, 7), TrimTier(500, 9)],
         18, [DeployTier(25, 25), DeployTier(35, 40), DeployTier(50, 100)]),

        # Higher cash targets overall
        ("Higher cash t3-5",
         21, [TrimTier(60, 0.5), TrimTier(125, 4), TrimTier(250, 7), TrimTier(350, 10), TrimTier(500, 13)],
         18, [DeployTier(25, 25), DeployTier(35, 40), DeployTier(50, 100)]),

        # Even higher cash
        ("Higher cash all",
         21, [TrimTier(60, 1.0), TrimTier(125, 4), TrimTier(250, 8), TrimTier(350, 11), TrimTier(500, 14)],
         18, [DeployTier(25, 25), DeployTier(35, 40), DeployTier(50, 100)]),

        # Age 18
        ("Age=18",
         18, [TrimTier(60, 0.5), TrimTier(125, 4), TrimTier(250, 5), TrimTier(350, 7), TrimTier(500, 9)],
         18, [DeployTier(25, 25), DeployTier(35, 40), DeployTier(50, 100)]),

        # Decay=24
        ("Decay=24",
         21, [TrimTier(60, 0.5), TrimTier(125, 4), TrimTier(250, 5), TrimTier(350, 7), TrimTier(500, 9)],
         24, [DeployTier(25, 25), DeployTier(35, 40), DeployTier(50, 100)]),

        # No decay
        ("No decay",
         21, [TrimTier(60, 0.5), TrimTier(125, 4), TrimTier(250, 5), TrimTier(350, 7), TrimTier(500, 9)],
         0, [DeployTier(25, 25), DeployTier(35, 40), DeployTier(50, 100)]),

        # Deploy at -20 first
        ("Deploy -20/25/35/50",
         21, [TrimTier(60, 0.5), TrimTier(125, 4), TrimTier(250, 5), TrimTier(350, 7), TrimTier(500, 9)],
         18, [DeployTier(20, 25), DeployTier(35, 40), DeployTier(50, 100)]),

        # Deploy variation
        ("Deploy -25/20/40/50",
         21, [TrimTier(60, 0.5), TrimTier(125, 4), TrimTier(250, 5), TrimTier(350, 7), TrimTier(500, 9)],
         18, [DeployTier(25, 20), DeployTier(40, 50), DeployTier(50, 100)]),

        # Higher cash + Age 18
        ("Age18 + high cash",
         18, [TrimTier(60, 1.0), TrimTier(125, 4), TrimTier(250, 7), TrimTier(350, 10), TrimTier(500, 13)],
         18, [DeployTier(25, 25), DeployTier(35, 40), DeployTier(50, 100)]),

        # t1g=75 with high cash
        ("t1g=75, high cash",
         21, [TrimTier(75, 1.0), TrimTier(150, 4), TrimTier(250, 7), TrimTier(350, 10), TrimTier(500, 13)],
         18, [DeployTier(25, 25), DeployTier(35, 40), DeployTier(50, 100)]),

        # t1g=75 moderate cash
        ("t1g=75 mod cash",
         21, [TrimTier(75, 1.5), TrimTier(150, 4), TrimTier(250, 5), TrimTier(350, 7), TrimTier(500, 9)],
         18, [DeployTier(25, 25), DeployTier(35, 40), DeployTier(50, 100)]),

        # Higher cash + deeper deploy
        ("High cash deep dply",
         21, [TrimTier(75, 1.5), TrimTier(150, 4), TrimTier(250, 7), TrimTier(350, 10), TrimTier(500, 14)],
         24, [DeployTier(25, 20), DeployTier(35, 40), DeployTier(50, 100)]),

        # C5 from earlier (was 8.1 bps)
        ("C5 earlier",
         21, [TrimTier(75, 1.5), TrimTier(150, 4), TrimTier(250, 5), TrimTier(350, 7), TrimTier(500, 9)],
         24, [DeployTier(20, 25), DeployTier(35, 50), DeployTier(50, 100)]),

        # High cash with 3-tranche -25/-35/-45
        ("High3tr -25/35/45",
         21, [TrimTier(75, 2), TrimTier(150, 5), TrimTier(250, 8), TrimTier(350, 11), TrimTier(500, 14)],
         24, [DeployTier(25, 33), DeployTier(35, 50), DeployTier(45, 100)]),

        # Moderate cash + deep deploy d3=50
        ("Mod cash d3=50",
         21, [TrimTier(75, 1), TrimTier(150, 3), TrimTier(250, 5), TrimTier(350, 7), TrimTier(500, 9)],
         24, [DeployTier(25, 25), DeployTier(35, 40), DeployTier(50, 100)]),

        # Test the exact winning fine-opt params but with t2g=150 instead of 125
        ("Fine-opt t2g=150",
         21, [TrimTier(60, 0.5), TrimTier(150, 4), TrimTier(250, 5), TrimTier(350, 7), TrimTier(500, 9)],
         18, [DeployTier(25, 25), DeployTier(35, 40), DeployTier(50, 100)]),

        # Very high cash
        ("Very high cash",
         21, [TrimTier(75, 2), TrimTier(150, 5), TrimTier(250, 10), TrimTier(350, 14), TrimTier(500, 18)],
         18, [DeployTier(25, 25), DeployTier(35, 40), DeployTier(50, 100)]),
    ]

    print(f"\n{'Name':<25} {'Win':>5} {'MinA%':>8} {'AvgA%':>8} {'bps/yr':>8} {'Safe':>5}")
    print("-" * 65)

    best_safe = None
    best_safe_bps = -999

    for name, age, trims, decay, deploys in candidates:
        s = Strategy(age_gate_months=age, trim_tiers=trims,
                     time_decay_months=decay, deploy_tiers=deploys)
        bt = run_full_backtest(s)
        safe = "YES" if bt['min_alpha'] >= 0 else "no"
        bps = bt['cum_alpha_cagr'] * 100
        print(f"{name:<25} {bt['wins']:>3}/21 {bt['min_alpha']:>+8.4f} {bt['avg_alpha']:>+8.4f} {bps:>+8.1f} {safe:>5}")
        if bt['min_alpha'] >= 0 and bps > best_safe_bps:
            best_safe_bps = bps
            best_safe = (name, age, trims, decay, deploys)

    # ═══════════════════════════════════════════════════════════════════════════
    # SECTION 2: OPTIMIZED STRATEGY
    # ═══════════════════════════════════════════════════════════════════════════
    print(f"\n\n{'='*120}")
    print(f"SECTION 2: OPTIMIZED STRATEGY (best safe: {best_safe[0]}, {best_safe_bps:+.1f} bps/yr)")
    print(f"{'='*120}")

    opt_name, opt_age, opt_trims, opt_decay, opt_deploys = best_safe
    decay_desc = f"{opt_decay}mo" if opt_decay > 0 else "OFF"
    print(f"\nParameters:")
    print(f"  Age gate:    {opt_age} months")
    for ti in opt_trims:
        print(f"  Trim tier:   +{ti.gain_pct}% -> {ti.cash_target_pct}% cash")
    print(f"  Time decay:  {decay_desc}")
    for di in opt_deploys:
        print(f"  Deploy tier: -{di.drawdown_pct}% -> {di.deploy_pct_of_cash}% of reserves")

    opt = Strategy(
        age_gate_months=opt_age,
        trim_tiers=opt_trims,
        time_decay_months=opt_decay,
        deploy_tiers=opt_deploys,
    )
    bt_opt = run_full_backtest(opt, verbose=True)
    print_results(bt_opt, f"OPTIMIZED STRATEGY ({opt_name})")

    # ═══════════════════════════════════════════════════════════════════════════
    # SECTION 3: SIDE-BY-SIDE
    # ═══════════════════════════════════════════════════════════════════════════
    print(f"\n\n{'='*120}")
    print("SECTION 3: SIDE-BY-SIDE COMPARISON")
    print(f"{'='*120}")

    print(f"\n{'#':<3} {'Cycle':<42} {'Bull%':>6} {'Bear%':>6} {'AgeBlk':>6} "
          f"{'C.Trims':>7} {'C.Cash%':>7} {'C.Alpha':>9} "
          f"{'O.Trims':>7} {'O.Cash%':>7} {'O.Alpha':>9}")
    print("-" * 120)

    for i in range(len(bt_curr['results'])):
        rc = bt_curr['results'][i]
        ro = bt_opt['results'][i]
        ab = "YES" if rc['age_blocked'] else "no"
        print(f"{i+1:<3} {rc['cycle']:<42} {rc['bull_gain']:>+5.1f} {rc['bear_dd']:>6.1f} {ab:>6} "
              f"{rc['n_trims']:>7} {rc['pre_bear_cash_pct']:>7.1f} {rc['alpha_pct']:>+9.4f} "
              f"{ro['n_trims']:>7} {ro['pre_bear_cash_pct']:>7.1f} {ro['alpha_pct']:>+9.4f}")

    print("-" * 120)

    # Summary row
    print(f"\n  {'Metric':<40} {'Current':>15} {'Optimized':>15}")
    print(f"  {'-'*70}")
    print(f"  {'Win rate (alpha > 0)':<40} {bt_curr['wins']:>13d}/21 {bt_opt['wins']:>13d}/21")
    print(f"  {'Non-loss rate (alpha >= 0)':<40} {bt_curr['wins']+bt_curr['ties']:>13d}/21 {bt_opt['wins']+bt_opt['ties']:>13d}/21")
    print(f"  {'Average alpha per cycle':<40} {bt_curr['avg_alpha']:>+14.4f}% {bt_opt['avg_alpha']:>+14.4f}%")
    print(f"  {'Worst cycle alpha':<40} {bt_curr['min_alpha']:>+14.4f}% {bt_opt['min_alpha']:>+14.4f}%")
    print(f"  {'Best cycle alpha':<40} {bt_curr['max_alpha']:>+14.4f}% {bt_opt['max_alpha']:>+14.4f}%")
    print(f"  {'Cumulative CAGR alpha':<40} {bt_curr['cum_alpha_cagr']*100:>+13.1f}bp {bt_opt['cum_alpha_cagr']*100:>+13.1f}bp")
    print(f"  {'Cumulative strategy return':<40} {bt_curr['cum_strategy']:>14.2f}x {bt_opt['cum_strategy']:>14.2f}x")
    print(f"  {'Cumulative B&H return':<40} {bt_curr['cum_bnh']:>14.2f}x {bt_opt['cum_bnh']:>14.2f}x")
    excess_curr = (bt_curr['cum_strategy'] / bt_curr['cum_bnh'] - 1) * 100
    excess_opt = (bt_opt['cum_strategy'] / bt_opt['cum_bnh'] - 1) * 100
    print(f"  {'Excess terminal wealth':<40} {excess_curr:>+13.2f}% {excess_opt:>+13.2f}%")

    # ═══════════════════════════════════════════════════════════════════════════
    # SECTION 4: FINAL RECOMMENDATION
    # ═══════════════════════════════════════════════════════════════════════════
    print(f"\n\n{'='*120}")
    print("SECTION 4: FINAL RECOMMENDED STRATEGY")
    print(f"{'='*120}")
    print(f"""
RECOMMENDED PARAMETERS:
  Age gate:     {opt_age} months
  Trim tiers:""")
    for ti in opt_trims:
        print(f"    +{ti.gain_pct}% gain -> move to {ti.cash_target_pct}% cash allocation")
    print(f"  Time decay:   {decay_desc} (if no bear within {opt_decay}mo of last trim, redeploy all cash)")
    print(f"  Deploy tiers:")
    for di in opt_deploys:
        print(f"    -{di.drawdown_pct}% drawdown -> deploy {di.deploy_pct_of_cash}% of cash reserves")

    print(f"""
PERFORMANCE (93-year backtest across 21 bull-bear cycles, 1929-2022):
  100% non-loss rate: Every cycle produces alpha >= 0
  Win rate:           {bt_opt['wins']}/21 positive-alpha cycles ({bt_opt['win_rate']:.1%})
  Cumulative alpha:   {bt_opt['cum_alpha_cagr']*100:+.1f} bps/yr CAGR
  Terminal excess:    {excess_opt:+.2f}% more wealth than buy-and-hold over 93 years

KEY INSIGHT:
  The critical change is the deployment structure. The original 2-tranche deploy
  (-25%/50%, -30%/100%) deployed all reserves by -30% drawdown, which is suboptimal
  when bears go much deeper (e.g., Dot-Com -49%, GFC -57%, Depression -83%).
  The optimized 3-tranche deploy with a deep third tranche keeps reserves for
  the worst part of severe bears, buying equity at much lower prices.
""")


if __name__ == "__main__":
    main()
