#!/usr/bin/env python3
"""
DEFINITIVE FINAL REPORT: 22-Bear / 21-Cycle Strategy Backtest
==============================================================
Compares current strategy vs. optimized strategy across complete dataset.

From optimization:
- Best from fine search (864K combos): 11.7 bps/yr
  Age=21, Trims: +60/0.5, +125/4, +250/5, +350/7, +500/9, Decay=18mo
  Deploy: -25/25%, -35/40%, -50/100%

- Best from targeted search (1M+ combos): 14.9 bps/yr
  Parameters need to be identified from the top-15 list

Let's test the best candidates and also run a small focused search
to identify the exact best-in-class parameters.
"""

import sys
sys.path.insert(0, '/home/user/Dashboard')
from backtest_22bears import (
    Cycle, CYCLES_22, TrimTier, DeployTier, Strategy,
    simulate_cycle, run_full_backtest, print_results,
)


def test_quick(age, trims, decay, deploys):
    s = Strategy(age_gate_months=age, trim_tiers=trims,
                 time_decay_months=decay, deploy_tiers=deploys)
    return run_full_backtest(s)


def main():
    # First, let's identify the best targeted strategy by searching around
    # the region that produced 14.9 bps/yr
    # From the targeted search, age=18 or 21, higher cash, deeper deploy

    print("=" * 100)
    print("IDENTIFYING BEST STRATEGY FROM TARGETED SEARCH REGION")
    print("=" * 100)

    best_cum = -999
    best_info = None
    count = 0

    for age in [18, 21, 24]:
        for t1g in [75, 90, 100]:
            for t1c in [1.0, 1.5, 2.0]:
                for t2g in [150, 175, 200]:
                    for t2c in [3, 4, 5]:
                        for t3c in [5, 6, 7, 8]:
                            for t4c in [7, 8, 9, 10, 11]:
                                if t4c <= t3c:
                                    continue
                                for t5c in [9, 10, 11, 12, 13, 14]:
                                    if t5c <= t4c:
                                        continue
                                    trims = [
                                        TrimTier(t1g, t1c),
                                        TrimTier(t2g, t2c),
                                        TrimTier(250, t3c),
                                        TrimTier(350, t4c),
                                        TrimTier(500, t5c),
                                    ]
                                    for decay in [0, 18, 24, 30]:
                                        for d1_dd in [20, 25]:
                                            for d1_pct in [20, 25, 33]:
                                                for d2_dd in [30, 35, 40]:
                                                    if d2_dd <= d1_dd:
                                                        continue
                                                    for d2_pct in [40, 50, 60]:
                                                        for d3_dd in [40, 45, 50]:
                                                            if d3_dd <= d2_dd:
                                                                continue
                                                            deploys = [
                                                                DeployTier(d1_dd, d1_pct),
                                                                DeployTier(d2_dd, d2_pct),
                                                                DeployTier(d3_dd, 100),
                                                            ]
                                                            bt = test_quick(age, trims, decay, deploys)
                                                            count += 1

                                                            if bt['min_alpha'] >= 0 and bt['cum_alpha_cagr'] > best_cum:
                                                                best_cum = bt['cum_alpha_cagr']
                                                                best_info = {
                                                                    'age': age, 'decay': decay,
                                                                    'trims': list(trims),
                                                                    'deploys': list(deploys),
                                                                    'bt': bt,
                                                                }

                                    if count % 100000 == 0:
                                        print(f"  Tested {count}... best: {best_cum*100:+.1f} bps/yr")

    print(f"\nSearched {count} combinations. Best: {best_cum*100:+.1f} bps/yr")

    if best_info:
        t = best_info['trims']
        d = best_info['deploys']
        trim_desc = ", ".join([f"+{ti.gain_pct}%->{ti.cash_target_pct}%" for ti in t])
        deploy_desc = ", ".join([f"-{di.drawdown_pct}%->{di.deploy_pct_of_cash}%" for di in d])
        decay_desc = f"{best_info['decay']}mo" if best_info['decay'] > 0 else "OFF"

        print(f"\n  BEST OPTIMIZED STRATEGY:")
        print(f"  Age gate:    {best_info['age']} months")
        print(f"  Trim tiers:  {trim_desc}")
        print(f"  Time decay:  {decay_desc}")
        print(f"  Deploy:      {deploy_desc}")
        print(f"  Cum Alpha:   {best_cum*100:+.1f} bps/yr")

    # ═══════════════════════════════════════════════════════════════════════════
    # FINAL COMPARISON
    # ═══════════════════════════════════════════════════════════════════════════
    print(f"\n\n{'='*120}")
    print("FINAL COMPREHENSIVE REPORT")
    print(f"{'='*120}")

    # 1. CURRENT strategy
    print(f"\n{'='*120}")
    print("1. CURRENT STRATEGY (as specified)")
    print(f"{'='*120}")
    print("   Age gate: 21 months")
    print("   Trim tiers: +75%->1%, +150%->3%, +250%->5%, +350%->7%, +500%->9%")
    print("   Time decay: 24 months")
    print("   Deploy: -25%->50%, -30%->100%")
    current_strat = Strategy(
        age_gate_months=21,
        trim_tiers=[TrimTier(75, 1), TrimTier(150, 3), TrimTier(250, 5),
                    TrimTier(350, 7), TrimTier(500, 9)],
        time_decay_months=24,
        deploy_tiers=[DeployTier(25, 50), DeployTier(30, 100)],
    )
    bt_current = run_full_backtest(current_strat, verbose=True)
    print_results(bt_current, "CURRENT STRATEGY")

    # 2. OPTIMIZED strategy
    if best_info:
        print(f"\n\n{'='*120}")
        print("2. OPTIMIZED STRATEGY")
        print(f"{'='*120}")
        print(f"   Age gate: {best_info['age']} months")
        print(f"   Trim tiers: {trim_desc}")
        print(f"   Time decay: {decay_desc}")
        print(f"   Deploy: {deploy_desc}")
        opt_strat = Strategy(
            age_gate_months=best_info['age'],
            trim_tiers=best_info['trims'],
            time_decay_months=best_info['decay'],
            deploy_tiers=best_info['deploys'],
        )
        bt_opt = run_full_backtest(opt_strat, verbose=True)
        print_results(bt_opt, "OPTIMIZED STRATEGY")

    # 3. Side-by-side table
    print(f"\n\n{'='*120}")
    print("SIDE-BY-SIDE COMPARISON TABLE")
    print(f"{'='*120}")

    print(f"\n{'#':<3} {'Cycle':<42} {'Curr Alpha%':>12} {'Opt Alpha%':>12} {'Improvement':>12}")
    print("-" * 85)

    for i in range(len(bt_current['results'])):
        rc = bt_current['results'][i]
        ro = bt_opt['results'][i] if best_info else rc
        imp = ro['alpha_pct'] - rc['alpha_pct']
        marker = " ***" if rc['alpha_pct'] < 0 else ""
        print(f"{i+1:<3} {rc['cycle']:<42} {rc['alpha_pct']:>+12.4f} {ro['alpha_pct']:>+12.4f} {imp:>+12.4f}{marker}")

    print("-" * 85)
    print(f"{'':3} {'TOTAL ALPHA':42} {sum(r['alpha_pct'] for r in bt_current['results']):>+12.4f} "
          f"{sum(r['alpha_pct'] for r in bt_opt['results']):>+12.4f}")
    print(f"{'':3} {'AVG ALPHA':42} {bt_current['avg_alpha']:>+12.4f} {bt_opt['avg_alpha']:>+12.4f}")
    print(f"{'':3} {'MIN ALPHA':42} {bt_current['min_alpha']:>+12.4f} {bt_opt['min_alpha']:>+12.4f}")
    print(f"{'':3} {'CUM ALPHA CAGR (bps/yr)':42} {bt_current['cum_alpha_cagr']*100:>+12.1f} {bt_opt['cum_alpha_cagr']*100:>+12.1f}")
    print(f"{'':3} {'WIN RATE':42} {'%d/21' % bt_current['wins']:>12} {'%d/21' % bt_opt['wins']:>12}")
    print(f"{'':3} {'NON-LOSS RATE':42} {'%d/21' % (bt_current['wins']+bt_current['ties']):>12} "
          f"{'%d/21' % (bt_opt['wins']+bt_opt['ties']):>12}")

    # 4. Final summary
    print(f"\n\n{'='*120}")
    print("FINAL RECOMMENDED STRATEGY")
    print(f"{'='*120}")
    if best_info:
        print(f"\n  Age gate:     {best_info['age']} months")
        for ti in best_info['trims']:
            print(f"  Trim tier:    +{ti.gain_pct}% -> {ti.cash_target_pct}% cash target")
        print(f"  Time decay:   {decay_desc}")
        for di in best_info['deploys']:
            print(f"  Deploy tier:  -{di.drawdown_pct}% -> deploy {di.deploy_pct_of_cash}% of cash reserves")
        print(f"\n  PERFORMANCE:")
        print(f"  Win rate (positive alpha):    {bt_opt['wins']}/21 ({bt_opt['win_rate']:.1%})")
        print(f"  Non-loss rate (alpha >= 0):   {bt_opt['wins']+bt_opt['ties']}/21 ({bt_opt['non_loss_rate']:.1%})")
        print(f"  Average alpha per cycle:      {bt_opt['avg_alpha']:+.4f}%")
        print(f"  Worst cycle alpha:            {bt_opt['min_alpha']:+.4f}%")
        print(f"  Best cycle alpha:             {bt_opt['max_alpha']:+.4f}%")
        print(f"  Cumulative CAGR alpha:        {bt_opt['cum_alpha_cagr']:+.4f}% ({bt_opt['cum_alpha_cagr']*100:+.1f} bps/yr)")
        print(f"  Total span:                   {bt_opt['total_years']:.1f} years")
        print(f"  Cumulative strategy return:   {bt_opt['cum_strategy']:.2f}x")
        print(f"  Cumulative B&H return:        {bt_opt['cum_bnh']:.2f}x")
        print(f"  Excess cumulative return:     {(bt_opt['cum_strategy']/bt_opt['cum_bnh']-1)*100:+.2f}%")


if __name__ == "__main__":
    main()
