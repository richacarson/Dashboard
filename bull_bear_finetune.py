#!/usr/bin/env python3
"""
Fine-tuning the top strategies found in the broad sweep.

Best from sweep:
- age_gate=48, decay=24, tiers=[(150,3),(250,5),(350,7),(450,9)], deploy=[(20,50),(35,50)]
- 13/14 wins, only loss is 2020-22 (-0.06%)
- Total alpha: 37.33%

Key questions:
1. Can we fix 2020-22? It's a 21.3-month bull with +114.4% gain.
   The -0.06% loss is from the ground truth. With ANY age gate >= 22 months,
   no trimming happens, so alpha = ground truth = -0.06%.
   Only way to fix: use age_gate <= 21 months. But that risks other cycles.

2. Fine-tune around the winning params for maximum alpha.

3. Understand the mechanics of why this works:
   - Higher trim thresholds (150/250/350/450 vs 100/200/300/400) mean:
     * Later trimming in the bull
     * Less total trim (only trims that reach these higher levels)
     * In particular, the Dot-Com mega-bull still reaches all 4 tiers,
       but the decay pattern changes
   - Lower trim percentages (3/5/7/9 vs 3/6/9/12) mean:
     * Less cash drag during bulls
     * Less exposure to sell-low-rebuy-high decay cycles
   - Deploy at -20%/-35% (vs -15%/-30%) means:
     * More patient deployment during bears
     * Better entry prices when deploying
"""

import sys
sys.path.insert(0, '/home/user/Dashboard')
from bull_bear_sim_final import (
    CYCLES, StrategyParams, run_strategy, get_baseline_raw, simulate_cycle_calibrated
)

def fine_tune_sweep():
    """Fine-grained sweep around the best parameters."""
    get_baseline_raw()

    results = []

    # Fine-grained age gates
    age_gates = [36, 39, 42, 45, 48, 51, 54, 57, 60]

    # Fine-grained decay
    decay_periods = [18, 20, 21, 22, 24, 26, 28, 30, 36]

    # Trim tier variations around the winner
    trim_structures = [
        # Winning structure and close variants
        [(150, 3), (250, 5), (350, 7), (450, 9)],
        [(150, 3), (250, 5), (350, 7)],
        [(150, 2), (250, 4), (350, 6), (450, 8)],
        [(150, 4), (250, 6), (350, 8)],
        [(125, 3), (250, 5), (350, 7), (450, 9)],
        [(175, 3), (275, 5), (375, 7), (475, 9)],
        [(150, 3), (275, 5), (400, 7)],
        [(150, 3), (250, 4), (350, 5), (450, 6)],
        [(150, 3), (250, 5), (400, 7)],
        [(150, 2), (250, 3), (350, 5), (450, 7)],
        [(125, 2), (225, 4), (325, 6), (425, 8)],
        [(150, 3), (300, 5), (450, 7)],
        [(175, 3), (300, 5), (425, 7)],
        [(200, 3), (300, 5), (400, 7)],
        [(200, 3), (300, 5), (400, 7), (500, 9)],
        [(150, 3), (250, 5), (350, 7), (500, 9)],
        # Even more conservative
        [(200, 2), (300, 4), (400, 6)],
        [(200, 3), (350, 5), (500, 7)],
        [(175, 3), (250, 5), (350, 7)],
        [(150, 3), (250, 6), (350, 8)],
    ]

    # Deploy variations
    deploy_structures = [
        [(20, 50), (35, 50)],  # winner
        [(20, 50), (40, 50)],
        [(20, 50), (30, 50)],
        [(15, 50), (35, 50)],
        [(25, 50), (40, 50)],
        [(25, 50), (35, 50)],
        [(20, 40), (35, 60)],
        [(20, 60), (35, 40)],
        [(15, 33), (25, 50), (35, 100)],
        [(20, 33), (30, 50), (40, 100)],
        [(15, 50), (25, 50), (35, 100)],
        [(20, 50), (35, 100)],
        [(25, 50), (40, 100)],
        [(20, 50), (30, 50), (40, 100)],
    ]

    total = len(age_gates) * len(decay_periods) * len(trim_structures) * len(deploy_structures)
    print(f"Fine-tuning: {total} combinations...")

    for ag in age_gates:
        for decay in decay_periods:
            for trims in trim_structures:
                for deploys in deploy_structures:
                    params = StrategyParams(ag, trims, decay, deploys)
                    s = run_strategy(params)
                    if s['wins'] >= 10:
                        results.append(s)

    results.sort(key=lambda x: (-x['wins'], -x['total_alpha']))

    print(f"\nFound {len(results)} strategies with 10+ wins")
    print(f"Best win rate: {results[0]['wins']}/14" if results else "None found")

    # Show top 20
    print(f"\n{'='*100}")
    print("TOP 20 FINE-TUNED STRATEGIES")
    print(f"{'='*100}")

    for i, s in enumerate(results[:20]):
        p = s['params']
        print(f"\n#{i+1}: Wins={s['wins']}/14 ({s['win_rate']:.1f}%), "
              f"Alpha={s['total_alpha']:.2f}% ({s['alpha_bps_yr']:.1f} bps/yr), "
              f"DD_red={s['avg_dd_reduction']:.2f}pp")
        print(f"   age_gate={p.age_gate_mo}, decay={p.decay_mo}, "
              f"tiers={p.trim_tiers}")
        print(f"   deploy={p.deploy_triggers}")
        losing = [r for r in s['results'] if not r['is_win']]
        if losing:
            loss_str = ", ".join(f"{r['cycle']}:{r['alpha']:.2f}%" for r in losing)
            print(f"   Losses: {loss_str}")

    return results


def analyze_2020_22():
    """
    The 2020-22 cycle is the hardest to fix because:
    - Bull: +114.4%, only 21.3 months
    - Bear: -25.4%
    - Ground truth alpha: -0.06%

    With ANY age gate > 21 months, no trimming occurs (alpha = -0.06%).
    With age gate <= 21 months AND first threshold <= 114.4%:
    - Could trim late in the bull
    - But this might hurt other cycles

    The -0.06% is in the ground truth and is essentially noise.
    Let's check what happens with very low age gates.
    """
    get_baseline_raw()

    print(f"\n{'='*85}")
    print("ANALYSIS: CAN WE FIX 2020-22?")
    print(f"{'='*85}")

    # 2020-22: 21.3 month bull, +114.4%
    # With age gate 18 and threshold 100: trim at month ~18-20
    # Price at month 18: (1+1.144)^(18/21.3) = 2.144^0.845 = ?
    import math
    p18 = 2.144 ** (18/21.3)
    print(f"  Price at month 18 of 21.3-month bull: {p18:.3f} (gain: +{(p18-1)*100:.1f}%)")
    p20 = 2.144 ** (20/21.3)
    print(f"  Price at month 20: {p20:.3f} (gain: +{(p20-1)*100:.1f}%)")
    p21 = 2.144 ** (21/21.3)
    print(f"  Price at month 21: {p21:.3f} (gain: +{(p21-1)*100:.1f}%)")

    print(f"\n  With 100% threshold: triggers if gain >= 100%")
    print(f"  Month 18 gain = {(p18-1)*100:.1f}% -> {'triggers' if (p18-1)*100 >= 100 else 'no trigger'}")
    print(f"  Month 20 gain = {(p20-1)*100:.1f}% -> {'triggers' if (p20-1)*100 >= 100 else 'no trigger'}")

    # The ground truth -0.06% loss is baked in from the user's model.
    # In our calibration, this is: calibrated = -0.06 + delta.
    # Even if delta > 0 (from trimming), we need delta >= 0.06 to flip it.
    # But trimming in a short bull with immediate bear doesn't help much.

    # Let's test age_gate=18 with various thresholds
    print(f"\n  Testing low age gates on 2020-22:")

    for ag in [12, 15, 18, 21]:
        for thresh in [75, 100, 114]:
            params = StrategyParams(
                age_gate_mo=ag,
                trim_tiers=[(thresh, 3)],
                decay_mo=24,
                deploy_triggers=[(20, 50), (35, 50)],
            )
            r = simulate_cycle_calibrated(CYCLES[13], params)  # 2020-22 is index 13
            print(f"    ag={ag}, thresh={thresh}: alpha={r['alpha']:.3f}%, "
                  f"trim={r['total_trimmed_pct']:.1f}%, delta={r['delta']:.3f}%")


def test_with_low_age_gate():
    """
    Test what happens if we use a VERY low age gate to catch 2020-22,
    but check impact on all other cycles.
    """
    get_baseline_raw()

    print(f"\n{'='*85}")
    print("TESTING LOW AGE GATES (to catch 2020-22)")
    print(f"{'='*85}")

    # With the best trim structure but lower age gate
    for ag in [15, 18, 21]:
        params = StrategyParams(
            age_gate_mo=ag,
            trim_tiers=[(150, 3), (250, 5), (350, 7), (450, 9)],
            decay_mo=24,
            deploy_triggers=[(20, 50), (35, 50)],
        )
        s = run_strategy(params, verbose=True)


def comprehensive_analysis():
    """Detailed analysis of the #1 strategy."""
    get_baseline_raw()

    print(f"\n{'='*85}")
    print("COMPREHENSIVE ANALYSIS: RECOMMENDED STRATEGY")
    print(f"{'='*85}")

    # #1 from sweep
    params = StrategyParams(
        age_gate_mo=48,
        trim_tiers=[(150, 3), (250, 5), (350, 7), (450, 9)],
        decay_mo=24,
        deploy_triggers=[(20, 50), (35, 50)],
    )
    s = run_strategy(params, verbose=True)

    # Compare cycle by cycle vs baseline
    print(f"\n  CYCLE-BY-CYCLE COMPARISON: NEW vs BASELINE")
    print(f"  {'Cycle':<12} {'New':>8} {'Base':>8} {'Improve':>8} {'Status':>12}")
    print(f"  {'-'*12} {'-'*8} {'-'*8} {'-'*8} {'-'*12}")
    for r, c in zip(s['results'], CYCLES):
        improve = r['alpha'] - c.baseline_alpha
        old_win = "W" if c.baseline_is_win else "L"
        new_win = "W" if r['is_win'] else "L"
        status = f"{old_win}->{new_win}"
        if old_win == "L" and new_win == "W":
            status += " FLIPPED!"
        elif old_win == "W" and new_win == "L":
            status += " REGRESS!"
        print(f"  {r['cycle']:<12} {r['alpha']:>7.2f}% {c.baseline_alpha:>7.2f}% "
              f"{improve:>+7.2f}% {status:>12}")

    # Summary
    old_wins = sum(1 for c in CYCLES if c.baseline_is_win)
    old_alpha = sum(c.baseline_alpha for c in CYCLES)
    new_wins = s['wins']
    new_alpha = s['total_alpha']

    print(f"\n  SUMMARY:")
    print(f"  Win rate: {old_wins}/14 ({old_wins/14*100:.1f}%) -> {new_wins}/14 ({new_wins/14*100:.1f}%)")
    print(f"  Total alpha: {old_alpha:.2f}% -> {new_alpha:.2f}%")
    print(f"  Alpha bps/yr: {old_alpha/94*100:.1f} -> {new_alpha/94*100:.1f}")
    print(f"  Avg DD reduction: {s['avg_dd_reduction']:.2f}pp")


if __name__ == "__main__":
    analyze_2020_22()
    fine_tune_results = fine_tune_sweep()
    comprehensive_analysis()
