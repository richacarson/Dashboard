#!/usr/bin/env python3
"""
Alpha experiments: can ANY rule structure produce real alpha vs buy-and-hold?

Tests four strategies against 14 historical bull-bear pairs (1932-2024):

  1. PRODUCTION         — current trim-on-bull-gain, deploy-on-bear-depth rules
  2. ORACLE 12mo        — perfect foresight: raise cash in last 12mo of bull
  3. ORACLE 6mo         — perfect 6-month foresight (closer to LR model lead)
  4. BOND-DEPLOY        — 25% bonds at all times (yield 4%), deploy bonds during
                          bear. The "free deploy alpha" case for retiree clients.

Methodology: full-cycle numerical simulator (shares + cash + bond accruals),
metric = recovery_net vs B&H at peak recovery.

Goal: establish what's even POSSIBLE before designing a deployable strategy.
If ORACLE 6mo can't produce alpha, no real-world bear-prob signal can either
(the LR model's lead time is similar). If BOND-DEPLOY produces alpha for
retirees, that's the recommendation regardless of trim rules.
"""

import numpy as np
from dataclasses import dataclass

# =============================================================================
# DATA (same 14 pairs as walkforward_playbook.py)
# =============================================================================

@dataclass
class BearMarket:
    name: str; drawdown_pct: float; duration_months: float; recovery_months: float

@dataclass
class BullMarket:
    name: str; gain_pct: float; duration_months: float

BEARS = [
    BearMarket("Great Depression",    -86.2, 33.0, 267.0),
    BearMarket("1937-38 Recession",   -54.5, 12.8,  95.6),
    BearMarket("WWII",                -34.5, 17.6,  25.2),
    BearMarket("Post-WWII",           -28.8, 11.6,  39.5),
    BearMarket("Eisenhower",          -21.6, 14.7,  11.0),
    BearMarket("Kennedy Slide",       -28.0,  6.5,  14.3),
    BearMarket("Credit Crunch",       -22.2,  7.9,   6.9),
    BearMarket("Vietnam",             -36.1, 17.9,  21.4),
    BearMarket("OPEC",                -48.2, 20.7,  69.5),
    BearMarket("Volcker",             -27.1, 20.5,   2.8),
    BearMarket("Black Monday",        -33.5,  3.3,  19.7),
    BearMarket("Dot-Com",             -49.1, 30.5,  55.6),
    BearMarket("GFC",                 -56.8, 17.0,  48.8),
    BearMarket("COVID",               -33.9,  1.1,   4.9),
    BearMarket("2022 Inflation",      -25.4,  9.3,  15.3),
]

BULLS = [
    BullMarket("1932-1937",   324.8,  57.0),
    BullMarket("1938-1938",    62.2,   7.3),
    BullMarket("1942-1946",   157.7,  49.0),
    BullMarket("1947-1956",   267.0,  86.0),
    BullMarket("1957-1961",    86.3,  49.7),
    BullMarket("1962-1966",    79.8,  43.5),
    BullMarket("1966-1968",    48.0,  25.7),
    BullMarket("1970-1973",    73.5,  31.5),
    BullMarket("1974-1980",   125.6,  73.9),
    BullMarket("1982-1987",   228.8,  60.4),
    BullMarket("1987-2000",   582.0, 147.6),
    BullMarket("2002-2007",   101.5,  60.0),
    BullMarket("2009-2020",   400.5, 131.4),
    BullMarket("2020-2022",   114.4,  21.3),
]

PAIRS = list(zip(BULLS, BEARS[1:]))

PROD_TRIM = [(75, 0.02), (150, 0.05), (250, 0.08), (350, 0.11), (500, 0.14)]
PROD_DEPLOY = [(-25, 0.25), (-35, 0.40), (-50, 1.0)]

BOND_YIELD_ANN = 0.04  # 4% nominal — conservative

# =============================================================================
# STRATEGY 1: PRODUCTION (trim-on-bull-gain with 18mo decay) — from walkforward
# =============================================================================

DECAY_MONTHS = 18

def simulate_production(bull, bear):
    G = bull.gain_pct / 100; D = bull.duration_months
    if D <= 0 or G <= 0: return 0.0
    r = (1 + G) ** (1 / D) - 1
    DD = abs(bear.drawdown_pct) / 100

    events = [(np.log(1+t/100)/np.log(1+r), c, t) for t, c in PROD_TRIM if G >= t/100]
    shares, cash = 1.0, 0.0
    last_trim = None
    for fire_month, target_cum, _ in events:
        if last_trim is not None and last_trim + DECAY_MONTHS < fire_month:
            decay_price = (1+r) ** (last_trim + DECAY_MONTHS)
            shares += cash / decay_price; cash = 0; last_trim = None
        share_price = (1+r) ** fire_month
        portfolio = shares * share_price + cash
        target_cash = target_cum * portfolio
        if target_cash > cash:
            delta = target_cash - cash
            shares -= delta / share_price; cash += delta
        last_trim = fire_month
    if last_trim is not None and last_trim + DECAY_MONTHS < D:
        decay_price = (1+r) ** (last_trim + DECAY_MONTHS)
        shares += cash / decay_price; cash = 0

    bear_start_cash = cash
    for L_pct, frac in sorted(PROD_DEPLOY, key=lambda x: abs(x[0])):
        L = abs(L_pct)/100
        if DD < L: continue
        price = (1+G) * (1-L)
        amount = min(bear_start_cash * frac, cash)
        if amount <= 0: continue
        cash -= amount; shares += amount / price

    strat_recovery = shares * (1+G) + cash
    bh_recovery = 1 + G
    return strat_recovery - bh_recovery

# =============================================================================
# STRATEGY 2/3: ORACLE foresight — raise cash in last N months of bull
# =============================================================================
# Assumes perfect knowledge that a bear starts at end of bull. Trim is one-shot
# at month (D - foresight): move target_cash_pct of portfolio to cash.

def simulate_oracle(bull, bear, foresight_months, target_cash_pct):
    G = bull.gain_pct / 100; D = bull.duration_months
    if D <= 0 or G <= 0: return 0.0
    r = (1 + G) ** (1 / D) - 1
    DD = abs(bear.drawdown_pct) / 100

    # Trim at month (D - foresight). If foresight >= D, trim at month 0 (worst case).
    trim_month = max(0, D - foresight_months)
    shares, cash = 1.0, 0.0
    share_price = (1+r) ** trim_month
    portfolio = shares * share_price + cash
    target_cash = target_cash_pct * portfolio
    if target_cash > cash:
        delta = target_cash - cash
        shares -= delta / share_price; cash += delta
    # No decay — oracle knows the bear is coming, holds cash through to bear.

    # Deploy with production schedule
    bear_start_cash = cash
    for L_pct, frac in sorted(PROD_DEPLOY, key=lambda x: abs(x[0])):
        L = abs(L_pct)/100
        if DD < L: continue
        price = (1+G) * (1-L)
        amount = min(bear_start_cash * frac, cash)
        if amount <= 0: continue
        cash -= amount; shares += amount / price

    strat_recovery = shares * (1+G) + cash
    bh_recovery = 1 + G
    return strat_recovery - bh_recovery

# =============================================================================
# STRATEGY 4: BOND-DEPLOY — 25% bonds always, deploy bonds during bear
# =============================================================================
# Models retiree case: 25% in bonds throughout bull (yield 4%), deploy bonds in
# bear at PROD_DEPLOY tranches. Comparing to 100% equity B&H. Bond drag during
# bull is the cost; deploy alpha at discount is the gain.

def simulate_bond_deploy(bull, bear, bond_pct=0.25, deploy_fracs=PROD_DEPLOY,
                          baseline="100_equity"):
    """Bond-deploy strategy vs a baseline.

    baseline = "100_equity":  compare to 100% equity B&H (apples vs oranges
                               for retirees, since they can't actually be 100%
                               equity). Shows the bond-drag.
    baseline = "bonds_passive": compare to same 25% bonds but NO deploy during
                                bear. Shows the pure deploy alpha for retirees
                                who hold bonds regardless.
    """
    G = bull.gain_pct / 100; D = bull.duration_months
    if D <= 0 or G <= 0: return 0.0
    DD = abs(bear.drawdown_pct) / 100

    bond_yield_monthly = BOND_YIELD_ANN / 12
    bond_value_at_peak = bond_pct * (1 + bond_yield_monthly) ** D
    equity_shares_at_peak = (1 - bond_pct)
    equity_value_at_peak = equity_shares_at_peak * (1 + G)

    # Deploy bonds during bear
    bear_start_cash = bond_value_at_peak
    cash = bear_start_cash
    shares = equity_shares_at_peak
    for L_pct, frac in sorted(deploy_fracs, key=lambda x: abs(x[0])):
        L = abs(L_pct)/100
        if DD < L: continue
        price = (1+G) * (1-L)
        amount = min(bear_start_cash * frac, cash)
        if amount <= 0: continue
        cash -= amount; shares += amount / price

    strat_recovery = shares * (1+G) + cash

    if baseline == "100_equity":
        bh_recovery = 1 + G
    elif baseline == "bonds_passive":
        # Same 25% bonds, same equity, but bonds NOT deployed — held through bear
        # At recovery: equity returns to peak, bonds keep compounding at yield
        bonds_passive_recovery_value = bond_pct * (1 + bond_yield_monthly) ** (
            D + bear.duration_months + bear.recovery_months
        )
        equity_passive_recovery_value = equity_shares_at_peak * (1 + G)
        bh_recovery = equity_passive_recovery_value + bonds_passive_recovery_value
    else:
        raise ValueError(baseline)
    return strat_recovery - bh_recovery

# =============================================================================
# RUN COMPARISON
# =============================================================================

def main():
    print("=" * 110)
    print("ALPHA EXPERIMENTS — recovery_net vs B&H, % of original $1 portfolio")
    print("=" * 110)

    strategies = [
        ("Production (current)",                 lambda b, br: simulate_production(b, br)),
        ("Oracle 12mo @ 25% trim",               lambda b, br: simulate_oracle(b, br, 12, 0.25)),
        ("Oracle 12mo @ 50% trim",               lambda b, br: simulate_oracle(b, br, 12, 0.50)),
        ("Oracle 12mo @ 100% trim",              lambda b, br: simulate_oracle(b, br, 12, 1.00)),
        ("Oracle 6mo @ 25% trim",                lambda b, br: simulate_oracle(b, br, 6, 0.25)),
        ("Oracle 6mo @ 50% trim",                lambda b, br: simulate_oracle(b, br, 6, 0.50)),
        ("Oracle 6mo @ 100% trim",               lambda b, br: simulate_oracle(b, br, 6, 1.00)),
        ("Bond-deploy vs 100% eq [unfair]",       lambda b, br: simulate_bond_deploy(b, br, 0.25, PROD_DEPLOY, "100_equity")),
        ("Bond-deploy vs 25%-bonds-passive",      lambda b, br: simulate_bond_deploy(b, br, 0.25, PROD_DEPLOY, "bonds_passive")),
        ("Bond-deploy aggressive 30/50/100 vs passive",
                                                  lambda b, br: simulate_bond_deploy(b, br, 0.25, [(-25, 0.30), (-35, 0.50), (-50, 1.0)], "bonds_passive")),
        ("Bond-deploy FULL @ -25% vs passive",    lambda b, br: simulate_bond_deploy(b, br, 0.25, [(-25, 1.0), (-35, 0), (-50, 0)], "bonds_passive")),
    ]

    print(f"\n  {'Strategy':<40} | {'Mean':>7} | {'Median':>7} | "
          f"{'Worst':>7} | {'Best':>7} | {'% Pos':>5}")
    print("  " + "-" * 90)

    all_nets = {}
    for name, fn in strategies:
        nets = [fn(b, br) for b, br in PAIRS]
        all_nets[name] = nets
        print(f"  {name:<40} | {np.mean(nets)*100:>+6.2f}% | "
              f"{np.median(nets)*100:>+6.2f}% | {min(nets)*100:>+6.2f}% | "
              f"{max(nets)*100:>+6.2f}% | {sum(1 for n in nets if n > 0)/len(nets)*100:>4.0f}%")

    # Detailed per-cycle for the most promising strategies
    print("\n" + "=" * 110)
    print("PER-CYCLE BREAKDOWN — best three strategies")
    print("=" * 110)
    sorted_strats = sorted(strategies, key=lambda x: -np.mean(all_nets[x[0]]))[:3]

    print(f"\n  {'Cycle':<38} | " + " | ".join(f"{s[0][:25]:>25}" for s in sorted_strats))
    print("  " + "-" * 110)
    for i, (bull, bear) in enumerate(PAIRS):
        row = f"  {bull.name:<14} → {bear.name:<20} | "
        row += " | ".join(f"{all_nets[s[0]][i]*100:>+24.2f}%" for s in sorted_strats)
        print(row)
    print("  " + "-" * 110)
    print(f"  {'MEAN':<38} | " + " | ".join(
        f"{np.mean(all_nets[s[0]])*100:>+24.2f}%" for s in sorted_strats))

    # Bootstrap CIs for top strategies
    print("\n" + "=" * 110)
    print("BOOTSTRAP CI (10K draws) — top 3 strategies")
    print("=" * 110)
    rng = np.random.default_rng(42)
    n_sims = 10_000
    print(f"\n  {'Strategy':<40} | {'5th':>7} | {'50th':>7} | {'95th':>7} | {'P(>0)':>6} | {'P(>1%)':>7}")
    print("  " + "-" * 90)
    for name, _ in sorted_strats:
        nets = np.array(all_nets[name])
        means = np.empty(n_sims)
        for s in range(n_sims):
            idx = rng.integers(0, len(nets), size=len(nets))
            means[s] = nets[idx].mean()
        print(f"  {name:<40} | {np.percentile(means, 5)*100:>+6.2f}% | "
              f"{np.percentile(means, 50)*100:>+6.2f}% | {np.percentile(means, 95)*100:>+6.2f}% | "
              f"{(means > 0).mean()*100:>5.1f}% | {(means > 0.01).mean()*100:>6.1f}%")

if __name__ == "__main__":
    main()
