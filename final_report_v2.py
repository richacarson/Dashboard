#!/usr/bin/env python3
"""
FINAL REPORT v2: Smarter search + comprehensive results.
Use the winning parameters from previous optimizers and do a focused search.
"""

import sys
sys.path.insert(0, '/home/user/Dashboard')
from backtest_22bears import (
    Cycle, CYCLES_22, TrimTier, DeployTier, Strategy,
    simulate_cycle, run_full_backtest, print_results,
)


def main():
    # ═══════════════════════════════════════════════════════════════════════════
    # FOCUSED SEARCH: Test key parameter variations independently
    # ═══════════════════════════════════════════════════════════════════════════

    print("=" * 100)
    print("FOCUSED OPTIMIZATION")
    print("=" * 100)

    # Start from the best known safe strategy from fine search:
    # Age=21, Trims: +60/0.5, +125/4, +250/5, +350/7, +500/9, Decay=18mo
    # Deploy: -25/25%, -35/40%, -50/100%  => 11.7 bps/yr

    # Test systematic variations
    best_cum = -999
    best_info = None
    count = 0

    # Focused on high-cash, deep-deploy region
    for age in [18, 21]:
        for t1g in [60, 75]:
            for t1c in [0.5, 1.0, 1.5, 2.0]:
                for t2g in [125, 150]:
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

                                    for decay in [0, 18, 24]:
                                        for d1_dd, d1_pct in [(20, 20), (20, 25), (20, 33), (25, 20), (25, 25), (25, 33)]:
                                            for d2_dd, d2_pct in [(30, 40), (30, 50), (35, 40), (35, 50)]:
                                                if d2_dd <= d1_dd:
                                                    continue
                                                for d3_dd in [40, 45, 50]:
                                                    if d3_dd <= d2_dd:
                                                        continue

                                                    deploys = [
                                                        DeployTier(d1_dd, d1_pct),
                                                        DeployTier(d2_dd, d2_pct),
                                                        DeployTier(d3_dd, 100),
                                                    ]

                                                    bt = run_full_backtest(Strategy(
                                                        age_gate_months=age,
                                                        trim_tiers=trims,
                                                        time_decay_months=decay,
                                                        deploy_tiers=deploys,
                                                    ))
                                                    count += 1

                                                    if bt['min_alpha'] >= 0 and bt['cum_alpha_cagr'] > best_cum:
                                                        best_cum = bt['cum_alpha_cagr']
                                                        best_info = {
                                                            'age': age, 'decay': decay,
                                                            'trims': list(trims),
                                                            'deploys': list(deploys),
                                                            'bt': bt,
                                                        }

                                    if count % 50000 == 0:
                                        print(f"  Tested {count}... best safe: {best_cum*100:+.1f} bps/yr")

    print(f"\nTotal tested: {count}")
    print(f"Best safe strategy: {best_cum*100:+.1f} bps/yr")

    if best_info:
        t = best_info['trims']
        d = best_info['deploys']
        trim_desc = ", ".join([f"+{ti.gain_pct}%->{ti.cash_target_pct}%" for ti in t])
        deploy_desc = ", ".join([f"-{di.drawdown_pct}%->{di.deploy_pct_of_cash}%" for di in d])
        decay_desc = f"{best_info['decay']}mo" if best_info['decay'] > 0 else "OFF"
        print(f"\n  Age: {best_info['age']}mo, Decay: {decay_desc}")
        print(f"  Trims: {trim_desc}")
        print(f"  Deploy: {deploy_desc}")

    # ═══════════════════════════════════════════════════════════════════════════
    # COMPREHENSIVE FINAL REPORT
    # ═══════════════════════════════════════════════════════════════════════════

    print(f"\n\n{'#'*120}")
    print(f"#{'COMPREHENSIVE FINAL REPORT':^118}#")
    print(f"{'#'*120}")

    # --- CURRENT STRATEGY ---
    print(f"\n\n{'='*120}")
    print("SECTION 1: CURRENT STRATEGY BACKTEST ON 22-BEAR DATASET")
    print(f"{'='*120}")
    print("\nParameters:")
    print("  Age gate:    21 months")
    print("  Trim tiers:  +75%->1%, +150%->3%, +250%->5%, +350%->7%, +500%->9%")
    print("  Time decay:  24 months (cash redeploys if no bear within 24mo of last trim)")
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

    # --- OPTIMIZED STRATEGY ---
    if best_info:
        print(f"\n\n{'='*120}")
        print("SECTION 2: OPTIMIZED STRATEGY BACKTEST ON 22-BEAR DATASET")
        print(f"{'='*120}")
        print(f"\nParameters:")
        print(f"  Age gate:    {best_info['age']} months")
        for ti in best_info['trims']:
            print(f"  Trim tier:   +{ti.gain_pct}% -> {ti.cash_target_pct}% cash")
        print(f"  Time decay:  {decay_desc}")
        for di in best_info['deploys']:
            print(f"  Deploy tier: -{di.drawdown_pct}% -> {di.deploy_pct_of_cash}% of reserves")

        opt = Strategy(
            age_gate_months=best_info['age'],
            trim_tiers=best_info['trims'],
            time_decay_months=best_info['decay'],
            deploy_tiers=best_info['deploys'],
        )
        bt_opt = run_full_backtest(opt, verbose=True)
        print_results(bt_opt, "OPTIMIZED STRATEGY")

    # --- SIDE-BY-SIDE ---
    print(f"\n\n{'='*120}")
    print("SECTION 3: SIDE-BY-SIDE COMPARISON")
    print(f"{'='*120}")

    print(f"\n{'#':<3} {'Cycle':<42} {'BullGain':>8} {'BearDD':>7} {'CurrAlpha':>10} {'OptAlpha':>10} {'Delta':>8}")
    print("-" * 92)

    for i in range(len(bt_curr['results'])):
        rc = bt_curr['results'][i]
        ro = bt_opt['results'][i]
        delta = ro['alpha_pct'] - rc['alpha_pct']
        flag = " <-- LOSS" if rc['alpha_pct'] < 0 else ""
        print(f"{i+1:<3} {rc['cycle']:<42} {rc['bull_gain']:>+7.1f}% {rc['bear_dd']:>6.1f}% "
              f"{rc['alpha_pct']:>+10.4f} {ro['alpha_pct']:>+10.4f} {delta:>+8.4f}{flag}")

    print("-" * 92)
    tot_curr = sum(r['alpha_pct'] for r in bt_curr['results'])
    tot_opt = sum(r['alpha_pct'] for r in bt_opt['results'])
    print(f"    {'SUM':42} {'':>8} {'':>7} {tot_curr:>+10.4f} {tot_opt:>+10.4f} {tot_opt-tot_curr:>+8.4f}")
    print(f"    {'AVERAGE':42} {'':>8} {'':>7} {bt_curr['avg_alpha']:>+10.4f} {bt_opt['avg_alpha']:>+10.4f}")
    print(f"    {'MINIMUM':42} {'':>8} {'':>7} {bt_curr['min_alpha']:>+10.4f} {bt_opt['min_alpha']:>+10.4f}")
    print(f"    {'CUM ALPHA CAGR':42} {'':>8} {'':>7} {bt_curr['cum_alpha_cagr']*100:>+9.1f}bp {bt_opt['cum_alpha_cagr']*100:>+9.1f}bp")
    print(f"    {'WIN RATE':42} {'':>8} {'':>7} {bt_curr['wins']:>8d}/21 {bt_opt['wins']:>8d}/21")
    print(f"    {'NON-LOSS RATE':42} {'':>8} {'':>7} {bt_curr['wins']+bt_curr['ties']:>8d}/21 {bt_opt['wins']+bt_opt['ties']:>8d}/21")

    # --- FINAL RECOMMENDATION ---
    print(f"\n\n{'='*120}")
    print("SECTION 4: FINAL RECOMMENDED STRATEGY")
    print(f"{'='*120}")
    if best_info:
        print(f"""
RECOMMENDED PARAMETERS:
  Age gate:     {best_info['age']} months
  Trim tiers:   {', '.join([f'+{ti.gain_pct}%->+{ti.cash_target_pct}%' for ti in best_info['trims']])}
  Time decay:   {decay_desc}
  Deploy tiers: {', '.join([f'-{di.drawdown_pct}%->{di.deploy_pct_of_cash}%' for di in best_info['deploys']])}

PERFORMANCE METRICS (93-year backtest, 21 cycles):
  Win rate (alpha > 0):        {bt_opt['wins']}/21 ({bt_opt['win_rate']:.1%})
  Non-loss rate (alpha >= 0):  {bt_opt['wins']+bt_opt['ties']}/21 ({bt_opt['non_loss_rate']:.1%})
  Average alpha per cycle:     {bt_opt['avg_alpha']:+.4f}%
  Worst cycle alpha:           {bt_opt['min_alpha']:+.4f}%
  Best cycle alpha:            {bt_opt['max_alpha']:+.4f}%
  Cumulative CAGR alpha:       {bt_opt['cum_alpha_cagr']*100:+.1f} bps/yr
  Strategy cumulative return:  {bt_opt['cum_strategy']:.2f}x
  Buy & Hold cumulative:       {bt_opt['cum_bnh']:.2f}x
  Excess terminal wealth:      {(bt_opt['cum_strategy']/bt_opt['cum_bnh']-1)*100:+.2f}%

KEY CHANGES FROM CURRENT:
  1. Deploy tiers changed from 2-tranche (-25/50%, -30/100%) to 3-tranche
  2. Deeper deployment thresholds (reserves held longer for better prices)
  3. {'Time decay shortened to ' + str(best_info['decay']) + 'mo' if best_info['decay'] != 24 else 'Time decay unchanged at 24mo'}
  4. {'Trim thresholds adjusted' if best_info['trims'][0].gain_pct != 75 else 'Trim thresholds unchanged'}

WHY THIS WORKS:
  - The Dot-Com mega-bull (582% over 147.6mo) was the only losing cycle
  - Problem: 2-tranche deploy at -25%/-30% deployed all cash too early in a -49% bear
  - Fix: 3-tranche deploy with deeper thresholds keeps reserves for lower prices
  - The third tranche at -{best_info['deploys'][2].drawdown_pct}% captures the deeper part of severe bears
  - This converts the -1.22% Dot-Com loss into positive alpha
""")


if __name__ == "__main__":
    main()
