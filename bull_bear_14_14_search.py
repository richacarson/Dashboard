#!/usr/bin/env python3
"""
Focused search for 14/14 strategies.

The key tension:
- To fix 2020-22 (21.3-month bull, +114.4%): need age_gate <= ~20 AND first threshold <= ~100%
- To keep 1942-46 (49-month bull, +157.7%): lower age gate + lower threshold causes EARLY trim
  in this cycle, creating cash drag. The delta from baseline must stay >= +0.001 to keep it as a win.

Hybrid #8 found: ag=18, tiers=[(75,2),(150,3),(250,5),(350,7),(500,9)]
This works because the +75% tier only trims 2%, a small amount.

Let me search more systematically for 14/14 solutions.
"""

import sys
sys.path.insert(0, '/home/user/Dashboard')
from bull_bear_sim_final import (
    CYCLES, StrategyParams, run_strategy, get_baseline_raw
)

def search_14_14():
    get_baseline_raw()

    results_14 = []

    # The key: need a first tier low enough for 2020-22 to trigger
    # 2020-22: 21.3 months, +114.4%. With ag=20, gain at month 20 = 104.6%
    # So first tier must be <= ~104% with age_gate <= 20

    # But also: 1942-46 has 49 months, +157.7%, and the baseline delta must be >= 0.001

    # Approach: test with 5 tiers (add a low early tier) and also 4 tiers
    # with low first threshold

    for ag in [12, 15, 18, 21]:
        for first_thresh in [50, 60, 75, 80, 90, 100]:
            for first_pct in [1, 1.5, 2, 2.5, 3]:
                # Try with additional early tier before the main tiers
                for main_start_thresh in [125, 150, 175, 200, 250]:
                    for main_tiers in [
                        [(main_start_thresh, 3), (main_start_thresh+100, 5), (main_start_thresh+200, 7), (main_start_thresh+350, 9)],
                        [(main_start_thresh, 3), (main_start_thresh+100, 5), (main_start_thresh+250, 7)],
                        [(main_start_thresh, 4), (main_start_thresh+100, 6), (main_start_thresh+200, 8)],
                        [(main_start_thresh, 3), (main_start_thresh+100, 5), (main_start_thresh+200, 7)],
                        [(main_start_thresh, 3), (main_start_thresh+150, 5), (main_start_thresh+300, 7)],
                    ]:
                        tiers = [(first_thresh, first_pct)] + main_tiers
                        for decay in [18, 21, 24, 30, 36]:
                            for deploy in [
                                [(20, 50), (35, 50)],
                                [(25, 50), (40, 50)],
                                [(20, 50), (35, 100)],
                                [(15, 50), (30, 50)],
                                [(25, 50), (40, 100)],
                            ]:
                                params = StrategyParams(ag, tiers, decay, deploy)
                                s = run_strategy(params)
                                if s['wins'] == 14 and s['total_alpha'] > 0:
                                    results_14.append(s)

    print(f"Found {len(results_14)} strategies with 14/14 wins and positive alpha")

    results_14.sort(key=lambda x: -x['total_alpha'])

    # Show top 25
    print(f"\n{'='*100}")
    print("TOP 25 STRATEGIES WITH 14/14 WIN RATE")
    print(f"{'='*100}")

    for i, s in enumerate(results_14[:25]):
        p = s['params']
        print(f"\n#{i+1}: Alpha={s['total_alpha']:.2f}% ({s['alpha_bps_yr']:.1f} bps/yr), "
              f"DD_red={s['avg_dd_reduction']:.2f}pp")
        print(f"   ag={p.age_gate_mo}, decay={p.decay_mo}")
        print(f"   tiers={p.trim_tiers}")
        print(f"   deploy={p.deploy_triggers}")

        # Show weakest cycle alphas
        cycle_alphas = [(r['cycle'], r['alpha']) for r in s['results']]
        cycle_alphas.sort(key=lambda x: x[1])
        weakest = ", ".join(f"{c}:{a:.2f}%" for c, a in cycle_alphas[:3])
        print(f"   Weakest cycles: {weakest}")

    return results_14


def show_best_detail(results):
    """Show detailed view of the best 14/14 strategy."""
    if not results:
        return

    best = results[0]

    print(f"\n{'='*100}")
    print("DETAILED VIEW: BEST 14/14 STRATEGY")
    print(f"{'='*100}")

    run_strategy(best['params'], verbose=True)

    # Comparison table
    print(f"\n  CYCLE-BY-CYCLE COMPARISON vs BASELINE")
    print(f"  {'Cycle':<12} {'New':>8} {'Base':>8} {'Change':>8} {'Status':>12}")
    print(f"  {'-'*12} {'-'*8} {'-'*8} {'-'*8} {'-'*12}")
    for r, c in zip(best['results'], CYCLES):
        improve = r['alpha'] - c.baseline_alpha
        old = "W" if c.baseline_is_win else "L"
        new = "W" if r['is_win'] else "L"
        st = f"{old}->{new}"
        if old == "L" and new == "W":
            st += " FLIP!"
        print(f"  {r['cycle']:<12} {r['alpha']:>7.2f}% {c.baseline_alpha:>7.2f}% "
              f"{improve:>+7.2f}% {st:>12}")

    # Summary
    old_wins = sum(1 for c in CYCLES if c.baseline_is_win)
    old_alpha = sum(c.baseline_alpha for c in CYCLES)
    new_alpha = best['total_alpha']
    print(f"\n  SUMMARY STATISTICS:")
    print(f"  Win rate: {old_wins}/14 ({old_wins/14*100:.1f}%) -> 14/14 (100.0%)")
    print(f"  Total alpha: {old_alpha:.2f}% -> {new_alpha:.2f}%")
    print(f"  Alpha bps/yr: {old_alpha/94*100:.1f} -> {new_alpha/94*100:.1f}")
    print(f"  Avg DD reduction (active cycles): {best['avg_dd_reduction']:.2f}pp")
    print(f"  Active cycles (with trimming): {best['active_cycles']}")


def show_robustness(results):
    """Check minimum alpha across cycles for top strategies."""
    if not results:
        return

    print(f"\n{'='*100}")
    print("ROBUSTNESS CHECK: MINIMUM CYCLE ALPHA FOR TOP 10")
    print(f"{'='*100}")

    for i, s in enumerate(results[:10]):
        p = s['params']
        min_alpha = min(r['alpha'] for r in s['results'])
        min_cycle = min(s['results'], key=lambda r: r['alpha'])
        avg_active_alpha = sum(r['alpha'] for r in s['results'] if r['total_trimmed_pct'] > 0.01) / max(1, sum(1 for r in s['results'] if r['total_trimmed_pct'] > 0.01))

        print(f"\n  #{i+1}: Total={s['total_alpha']:.2f}%, "
              f"Min={min_alpha:.3f}% ({min_cycle['cycle']}), "
              f"AvgActive={avg_active_alpha:.2f}%")
        print(f"    ag={p.age_gate_mo}, decay={p.decay_mo}, tiers={p.trim_tiers}")
        print(f"    deploy={p.deploy_triggers}")


if __name__ == "__main__":
    results = search_14_14()
    show_best_detail(results)
    show_robustness(results)
