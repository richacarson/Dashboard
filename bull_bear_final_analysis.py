#!/usr/bin/env python3
"""
Final analysis: detailed view of best strategies and robustness testing.
"""

import sys
sys.path.insert(0, '/home/user/Dashboard')
from bull_bear_sim_final import (
    CYCLES, StrategyParams, run_strategy, get_baseline_raw, simulate_cycle_calibrated
)

def detailed_top_strategies():
    """Show full cycle-by-cycle for the top 3 strategies."""
    get_baseline_raw()

    strategies = [
        ("STRATEGY A (Best Alpha, Fine-tuned)",
         StrategyParams(
             age_gate_mo=48,
             trim_tiers=[(150, 3), (250, 5), (350, 7), (500, 9)],
             decay_mo=24,
             deploy_triggers=[(25, 50), (40, 50)],
         )),
        ("STRATEGY B (Best from Initial Sweep)",
         StrategyParams(
             age_gate_mo=48,
             trim_tiers=[(150, 3), (250, 5), (350, 7), (450, 9)],
             decay_mo=24,
             deploy_triggers=[(20, 50), (35, 50)],
         )),
        ("STRATEGY C (Lower Age Gate variant)",
         StrategyParams(
             age_gate_mo=42,
             trim_tiers=[(150, 3), (250, 5), (350, 7), (500, 9)],
             decay_mo=24,
             deploy_triggers=[(25, 50), (40, 50)],
         )),
        ("STRATEGY D (3-tranche deploy)",
         StrategyParams(
             age_gate_mo=48,
             trim_tiers=[(150, 3), (250, 5), (350, 7), (500, 9)],
             decay_mo=24,
             deploy_triggers=[(20, 33), (30, 50), (40, 100)],
         )),
    ]

    for name, params in strategies:
        print(f"\n{'='*85}")
        print(f"  {name}")
        s = run_strategy(params, verbose=True)

        # Comparison
        print(f"\n  FLIPPED CYCLES:")
        for r, c in zip(s['results'], CYCLES):
            old_win = c.baseline_is_win
            new_win = r['is_win']
            if old_win != new_win:
                direction = "L->W" if new_win else "W->L"
                print(f"    {r['cycle']}: {c.baseline_alpha:+.2f}% -> {r['alpha']:+.2f}% ({direction})")


def test_2020_fix():
    """
    Can we fix 2020-22 without hurting anything?

    The 2020-22 cycle has a ground truth alpha of -0.06%. This is baked into our
    calibration. The only way to change it is to have the strategy behave differently
    in 2020-22 vs baseline (i.e., produce a positive delta).

    For 2020-22:
    - Bull: +114.4%, 21.3 months
    - With threshold 100% and age_gate <= 20: gain exceeds 100% at month ~19-20
    - Trim 3% at ~+104.6% gain
    - Then bear: -25.4%. Deploy at triggers.

    With age_gate=18, thresh=100: delta = +1.134% (our analysis showed).
    But we need to check: with age_gate=18 for ALL cycles, what breaks?

    Actually, looking at the 2020-22 analysis output:
    - ag=21, thresh=100: alpha=1.290%, delta=1.350%

    BUT our winning strategy uses thresh=150 as first tier. At 21.3 months,
    max gain = 114.4%. So 150% threshold NEVER triggers regardless of age gate.

    We'd need to LOWER the first threshold to ~100% AND lower the age gate.
    This is a fundamentally different strategy.

    Let me test: can we use a "hybrid" approach where we have a lower first
    threshold (100%) with a low age gate, and higher subsequent thresholds?
    """
    get_baseline_raw()

    print(f"\n{'='*85}")
    print("TESTING HYBRID STRATEGIES TO FIX 2020-22")
    print(f"{'='*85}")

    # Key idea: first tier at +100% with age gate low enough for 2020-22
    # Subsequent tiers at higher levels
    hybrids = [
        StrategyParams(18, [(100, 3), (250, 5), (350, 7), (500, 9)], 24, [(25, 50), (40, 50)]),
        StrategyParams(18, [(100, 2), (250, 5), (350, 7), (500, 9)], 24, [(25, 50), (40, 50)]),
        StrategyParams(15, [(100, 3), (250, 5), (350, 7), (500, 9)], 24, [(25, 50), (40, 50)]),
        StrategyParams(18, [(100, 3), (200, 5), (350, 7), (500, 9)], 24, [(25, 50), (40, 50)]),
        StrategyParams(18, [(100, 3), (250, 5), (350, 7), (450, 9)], 24, [(25, 50), (40, 50)]),
        StrategyParams(18, [(100, 3), (250, 5), (350, 7), (450, 9)], 24, [(20, 50), (35, 50)]),
        StrategyParams(21, [(100, 3), (250, 5), (350, 7), (500, 9)], 24, [(25, 50), (40, 50)]),
        StrategyParams(18, [(75, 2), (150, 3), (250, 5), (350, 7), (500, 9)], 24, [(25, 50), (40, 50)]),
        StrategyParams(18, [(100, 2), (200, 4), (350, 6), (500, 8)], 24, [(25, 50), (40, 50)]),
    ]

    best_14_14 = None

    for i, params in enumerate(hybrids):
        s = run_strategy(params)
        losing = [r for r in s['results'] if not r['is_win']]
        loss_str = ", ".join(f"{r['cycle']}:{r['alpha']:.2f}%" for r in losing) if losing else "NONE"

        print(f"\n  Hybrid #{i+1}: ag={params.age_gate_mo}, tiers={params.trim_tiers}")
        print(f"    deploy={params.deploy_triggers}, decay={params.decay_mo}")
        print(f"    Wins={s['wins']}/14, Alpha={s['total_alpha']:.2f}%, "
              f"bps/yr={s['alpha_bps_yr']:.1f}, DD_red={s['avg_dd_reduction']:.2f}pp")
        print(f"    Losses: {loss_str}")

        if s['wins'] == 14 and (best_14_14 is None or s['total_alpha'] > best_14_14['total_alpha']):
            best_14_14 = s

    if best_14_14:
        print(f"\n{'='*85}")
        print("FOUND 14/14 STRATEGY!")
        print(f"{'='*85}")
        run_strategy(best_14_14['params'], verbose=True)
    else:
        print("\nNo 14/14 strategy found among hybrids.")


def exhaustive_14_14_search():
    """
    Try to find any 14/14 strategy through systematic search.
    Key constraint: need age_gate <= 20 and first threshold <= 114 to affect 2020-22.
    """
    get_baseline_raw()

    print(f"\n{'='*85}")
    print("EXHAUSTIVE SEARCH FOR 14/14 STRATEGIES")
    print(f"{'='*85}")

    results_14 = []

    for ag in [12, 15, 18, 21]:
        for first_thresh in [50, 75, 100]:
            for first_pct in [1, 2, 3]:
                for rest_tiers in [
                    [(200, 4), (350, 6), (500, 8)],
                    [(250, 5), (350, 7), (500, 9)],
                    [(200, 5), (350, 7)],
                    [(250, 5), (350, 7), (450, 9)],
                    [(200, 4), (300, 6), (450, 8)],
                    [(250, 4), (400, 6)],
                    [(200, 3), (350, 5), (500, 7)],
                    [(300, 5), (500, 7)],
                    [(250, 5), (400, 7)],
                ]:
                    for decay in [18, 21, 24, 30]:
                        for deploy in [
                            [(20, 50), (35, 50)],
                            [(25, 50), (40, 50)],
                            [(20, 50), (35, 100)],
                            [(25, 50), (40, 100)],
                            [(15, 50), (30, 50)],
                        ]:
                            tiers = [(first_thresh, first_pct)] + rest_tiers
                            params = StrategyParams(ag, tiers, decay, deploy)
                            s = run_strategy(params)

                            if s['wins'] >= 14:
                                results_14.append(s)
                            elif s['wins'] >= 13 and s['total_alpha'] > 45:
                                results_14.append(s)  # save very high alpha 13-win too

    if results_14:
        results_14.sort(key=lambda x: (-x['wins'], -x['total_alpha']))
        print(f"\nFound {sum(1 for r in results_14 if r['wins']==14)} strategies with 14/14 wins")
        print(f"Found {sum(1 for r in results_14 if r['wins']==13)} strategies with 13/14 wins (alpha>45)")

        for i, s in enumerate(results_14[:10]):
            p = s['params']
            losing = [r for r in s['results'] if not r['is_win']]
            loss_str = ", ".join(f"{r['cycle']}:{r['alpha']:.2f}%" for r in losing) if losing else "NONE"
            print(f"\n  #{i+1}: Wins={s['wins']}/14, Alpha={s['total_alpha']:.2f}%, "
                  f"bps/yr={s['alpha_bps_yr']:.1f}, DD_red={s['avg_dd_reduction']:.2f}pp")
            print(f"     ag={p.age_gate_mo}, decay={p.decay_mo}, tiers={p.trim_tiers}")
            print(f"     deploy={p.deploy_triggers}")
            print(f"     Losses: {loss_str}")

        # Show detailed view of best
        best = results_14[0]
        print(f"\n{'='*85}")
        print(f"DETAILED VIEW: BEST {'14/14' if best['wins']==14 else '13/14'} STRATEGY")
        print(f"{'='*85}")
        run_strategy(best['params'], verbose=True)

        # Show comparison
        print(f"\n  CYCLE-BY-CYCLE COMPARISON: NEW vs BASELINE")
        print(f"  {'Cycle':<12} {'New':>8} {'Base':>8} {'Improve':>8} {'Status':>12}")
        print(f"  {'-'*12} {'-'*8} {'-'*8} {'-'*8} {'-'*12}")
        for r, c in zip(best['results'], CYCLES):
            improve = r['alpha'] - c.baseline_alpha
            old_win = "W" if c.baseline_is_win else "L"
            new_win = "W" if r['is_win'] else "L"
            status = f"{old_win}->{new_win}"
            if old_win == "L" and new_win == "W":
                status += " FLIP!"
            elif old_win == "W" and new_win == "L":
                status += " REGR!"
            print(f"  {r['cycle']:<12} {r['alpha']:>7.2f}% {c.baseline_alpha:>7.2f}% "
                  f"{improve:>+7.2f}% {status:>12}")

    else:
        print("\nNo 14/14 strategies found. Best achievable is 13/14.")


if __name__ == "__main__":
    detailed_top_strategies()
    test_2020_fix()
    exhaustive_14_14_search()
