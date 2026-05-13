#!/usr/bin/env python3
"""
Targeted optimization around the best safe strategies found so far.

Best safe strategies:
- C5: Age=21, trims 75/1.5 150/4 250/5 350/7 500/9, decay=24, deploy -20/25 -35/50 -50/100
  => 8.1 bps/yr
- C10: Age=21, trims 75/2 150/5 250/8 350/11 500/14, decay=0, deploy -20/33 -30/50 -40/100
  => 8.0 bps/yr
- C12: Age=21, trims current, decay=24, deploy -25/33 -35/50 -45/100
  => 7.0 bps/yr

Key insight: Deeper deployment (waiting until -35% or -50% for later tranches)
helps in mega-bear cycles. Higher cash targets help more but risk underperforming
in shallow bears if deploy thresholds aren't reached.

The Dot-Com problem specifically: trimmed ~8% cash, then deployed at -25% and -30%,
but the bear went to -49%. Deploying too early in a deep bear = buying more declining
equity. The 3-tranche with deeper thresholds means some cash is held longer and
deployed at lower prices.
"""

import sys
sys.path.insert(0, '/home/user/Dashboard')
from backtest_22bears import (
    Cycle, CYCLES_22, TrimTier, DeployTier, Strategy,
    run_full_backtest, print_results,
)


def main():
    print("=" * 100)
    print("TARGETED OPTIMIZATION")
    print("=" * 100)

    best_results = []
    count = 0

    # Search around C5 parameters
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
                                    for decay in [0, 24, 30, 36]:
                                        for d1_dd in [20, 25]:
                                            for d1_pct in [20, 25, 33]:
                                                for d2_dd in [30, 35, 40]:
                                                    if d2_dd <= d1_dd:
                                                        continue
                                                    for d2_pct in [40, 50, 60]:
                                                        for d3_dd in [40, 45, 50]:
                                                            if d3_dd <= d2_dd:
                                                                continue

                                                            trims = [
                                                                TrimTier(t1g, t1c),
                                                                TrimTier(t2g, t2c),
                                                                TrimTier(250, t3c),
                                                                TrimTier(350, t4c),
                                                                TrimTier(500, t5c),
                                                            ]
                                                            deploys = [
                                                                DeployTier(d1_dd, d1_pct),
                                                                DeployTier(d2_dd, d2_pct),
                                                                DeployTier(d3_dd, 100),
                                                            ]

                                                            s = Strategy(age_gate_months=age, trim_tiers=trims,
                                                                         time_decay_months=decay, deploy_tiers=deploys)
                                                            bt = run_full_backtest(s)
                                                            count += 1

                                                            if bt['min_alpha'] >= 0:
                                                                best_results.append({
                                                                    'age': age, 'decay': decay,
                                                                    'trims': trims, 'deploys': deploys,
                                                                    'bt': bt,
                                                                })

                                                            if count % 50000 == 0:
                                                                best_so_far = max(r['bt']['cum_alpha_cagr'] for r in best_results) if best_results else -999
                                                                print(f"  Tested {count}... {len(best_results)} safe found... best: {best_so_far:+.4f}%")

    print(f"\nTotal tested: {count}")
    print(f"Safe strategies: {len(best_results)}")

    if not best_results:
        print("No safe strategies found!")
        return

    # Sort by cum alpha CAGR
    best_results.sort(key=lambda x: x['bt']['cum_alpha_cagr'], reverse=True)

    print(f"\n{'='*120}")
    print("TOP 15 STRATEGIES")
    print(f"{'='*120}")
    print(f"\n{'#':<4} {'Age':>3} {'Decay':>5} {'T1':>10} {'T2':>10} {'T3':>8} {'T4':>8} {'T5':>8} "
          f"{'D1':>10} {'D2':>10} {'D3':>10} {'Win':>5} {'MinA':>8} {'AvgA':>8} {'CumBps':>8}")
    print("-" * 140)

    for rank, r in enumerate(best_results[:15], 1):
        t = r['trims']
        d = r['deploys']
        bt = r['bt']
        t1 = f"+{t[0].gain_pct}/{t[0].cash_target_pct}%"
        t2 = f"+{t[1].gain_pct}/{t[1].cash_target_pct}%"
        t3 = f"+250/{t[2].cash_target_pct}%"
        t4 = f"+350/{t[3].cash_target_pct}%"
        t5 = f"+500/{t[4].cash_target_pct}%"
        d1 = f"-{d[0].drawdown_pct}/{d[0].deploy_pct_of_cash}%"
        d2 = f"-{d[1].drawdown_pct}/{d[1].deploy_pct_of_cash}%"
        d3 = f"-{d[2].drawdown_pct}/100%"
        decay_s = f"{r['decay']}" if r['decay'] > 0 else "OFF"
        print(f"{rank:<4} {r['age']:>3} {decay_s:>5} {t1:>10} {t2:>10} {t3:>8} {t4:>8} {t5:>8} "
              f"{d1:>10} {d2:>10} {d3:>10} {bt['wins']:>3}/21 "
              f"{bt['min_alpha']:>+8.4f} {bt['avg_alpha']:>+8.4f} {bt['cum_alpha_cagr']*100:>+8.1f}")

    # Print detailed results for #1
    best = best_results[0]
    print(f"\n\n{'='*120}")
    print("DETAILED RESULTS FOR #1")
    print(f"{'='*120}")
    s = Strategy(age_gate_months=best['age'], trim_tiers=best['trims'],
                 time_decay_months=best['decay'], deploy_tiers=best['deploys'])
    bt = run_full_backtest(s, verbose=True)

    t = best['trims']
    d = best['deploys']
    trim_desc = ", ".join([f"+{ti.gain_pct}%->{ti.cash_target_pct}%" for ti in t])
    deploy_desc = ", ".join([f"-{di.drawdown_pct}%->{di.deploy_pct_of_cash}%" for di in d])
    decay_desc = f"{best['decay']}mo" if best['decay'] > 0 else "OFF"

    print_results(bt, f"OPTIMIZED: Age={best['age']}mo, Decay={decay_desc}, Trims=[{trim_desc}], Deploy=[{deploy_desc}]")


if __name__ == "__main__":
    main()
