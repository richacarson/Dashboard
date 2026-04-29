
# Dividend Portfolio Capture Ratio Optimization via Dynamic Beta Management

## Thesis

IOWN's dividend portfolio currently captures 95.9% of up markets and 95.6% of down markets versus SPY. The goal is asymmetric capture: **>100% upside capture and <100% downside capture**. With a portfolio beta of 0.8 (8 stocks above 1.0, 17 below 1.0), a static beta cannot achieve this — beta is symmetric by definition. The solution is **dynamic beta management**: systematically shifting portfolio weights toward higher-beta names during confirmed bull regimes and toward lower-beta/defensive names during bear regimes, combined with quality factor tilts and optional options overlays. This report provides the math, the signals, and the implementation framework.

## Why Static Beta Can't Solve This

A portfolio with static beta 1.2 captures roughly 120% up and 120% down — symmetric amplification. A beta of 0.8 captures ~80% both ways. Traditional beta is a single number that applies symmetrically to both directions.

Achieving >100% up / <100% down requires **dual-beta decomposition** — separate upside beta (B+) and downside beta (B-). You need B+ > 1.0 and B- < 1.0 simultaneously. This demands:

1. **Increasing beta** when the market is rising or about to rise
2. **Decreasing beta** when the market is falling or about to fall
3. **Selecting stocks** with naturally asymmetric return profiles (quality dividend growers that participate in rallies but have earnings floors that cushion declines)

This is fundamentally a **timing and selection problem**, not a static allocation problem.

## Current Portfolio Math

### Starting Position
- 25 dividend stocks
- 8 high-beta names (average β ≈ 1.25)
- 17 low-beta names (average β ≈ 0.75)
- Current portfolio beta: **0.8**
- Current equal-weight allocation: ~4% per stock

### Bull Phase Target: Portfolio β = 1.05–1.10

Let W_h = total weight in high-beta names, W_l = 1 - W_h:

| Target β | W_h (High-Beta Weight) | Per-Stock High-β | Per-Stock Low-β |
|---|---|---|---|
| **1.05** | 60% | ~7.5% each (8 stocks) | ~2.35% each (17 stocks) |
| **1.10** | 70% | ~8.75% each (8 stocks) | ~1.75% each (17 stocks) |

**Translation:** To push portfolio beta from 0.8 to 1.05, you shift from equal weight to roughly 60/40 favoring the 8 high-beta names. Each high-beta stock goes from 4% to ~7.5%. Each low-beta stock drops from 4% to ~2.35%.

### Bear Phase Target: Portfolio β = 0.65–0.70

**Problem:** With average low-beta at 0.75, you mathematically cannot reach 0.65 portfolio beta just by underweighting high-beta names — even zeroing them out leaves you at 0.75.

**Solutions:**

| Approach | Target β | Method |
|---|---|---|
| **Cash allocation** | 0.70 | Hold 20% cash (β=0), remaining 80% at β=0.875 (25% in high-beta, 75% in low-beta) |
| **Swap holdings** | 0.65 | Replace 2-3 high-beta names with utilities/staples (β 0.4–0.6) |
| **Protective puts** | ~0.60 | Buy SPY puts to synthetically reduce beta without selling |
| **Collar strategy** | ~0.65 | Sell covered calls + buy puts for near-zero cost hedging |

**Recommended bear phase approach:** 10-15% cash position + underweight high-beta names to ~15% total weight. This achieves ~0.70 portfolio beta without excessive turnover.

## Regime Detection Signals — When to Shift Beta

### Primary Signals (Use 2 of 3 Confirming)

| Signal | Bull Regime (Increase β) | Bear Regime (Decrease β) | Reliability |
|---|---|---|---|
| **S&P 500 vs 200-day SMA** | Price above 200 DMA for 10+ consecutive days | Price below 200 DMA for 10+ consecutive days | Highest — Faber's research shows equity-like returns with bond-like drawdowns over 100+ years |
| **50/200 SMA Cross** | Golden cross (50 crosses above 200) | Death cross (50 crosses below 200) | Good — ~60-65% of bear markets since 1950, but ~1 in 3 are false signals |
| **Market Breadth** | >70% of S&P 500 above 200 DMA | <50% above 200 DMA (warning); <30% (confirmed bear) | Very high — led the 2007 and 2020 downturns by weeks |

### Secondary Signals (Confirming / Fine-Tuning)

| Signal | Aggressive Positioning | Defensive Positioning |
|---|---|---|
| **VIX** | < 15 (low-vol bull) | > 25 sustained 30+ days (bear); > 35 (crisis) |
| **RSI (14-day, monthly)** | 40-80 range in bull regime; buy dips at RSI 40 | 20-60 range in bear regime; reduce at RSI 60 |
| **MACD** | MACD line crosses above signal with both below zero = early bull (shift aggressive) | MACD crosses below signal with both above zero = early distribution (go defensive) |
| **Put/Call Ratio** | > 1.2 = excessive fear = contrarian buy, increase β | < 0.6 = excessive complacency = contrarian warning, reduce β |
| **Yield Curve (10Y-2Y)** | Positive and steepening | Inverted (6-18 month recession lead); un-inversion = imminent recession |
| **ISM Manufacturing** | Above 50 for 2+ months | Below 50 for 2+ months (warning); below 45 = always recession |

### RSI Range Shift Rules (Cardwell Method)

This is particularly useful for fine-tuning within a regime:

- **Bull regime** (price above 200 SMA): RSI oscillates 40-80. Buy dips at RSI 40. Trim/reduce beta at RSI 80.
- **Bear regime** (price below 200 SMA): RSI oscillates 20-60. Buy dips at RSI 20. Reduce exposure at RSI 60.
- **Range shift:** When RSI breaks out of its regime range (e.g., pushes above 60 in a bear), it signals a potential trend change — this is when you start shifting beta.

### Bollinger Band Signals

- Price riding the upper band with expanding bandwidth = strong trend (stay aggressive, high β)
- Price breaking below lower band after contraction = potential breakdown (go defensive)
- Bandwidth squeeze (narrowing bands) = regime change imminent; prepare for directional move

## Implementation Framework

### The IOWN Beta Regime System

**Step 1: Monthly Regime Check (First Tuesday of Each Month)**

Score the following (1 point each for bull, 0 for bear):

| Check | Bull = 1 | Bear = 0 |
|---|---|---|
| S&P 500 above 200 DMA? | Yes | No |
| >60% of S&P 500 above 200 DMA? | Yes | No |
| 50 DMA above 200 DMA? | Yes | No |
| VIX below 20? | Yes | No |
| ISM Manufacturing above 50? | Yes | No |
| 10Y-2Y spread positive? | Yes | No |

**Step 2: Set Target Beta Based on Score**

| Score | Regime | Target β | Action |
|---|---|---|---|
| 5-6 | Strong Bull | 1.05-1.10 | Overweight high-beta names to ~60-70% |
| 3-4 | Neutral / Transitional | 0.85-0.95 | Near equal weight, slight quality tilt |
| 1-2 | Bear / Risk-Off | 0.70-0.75 | Underweight high-beta to ~15-20%, consider 10% cash |
| 0 | Crisis | 0.60-0.65 | Maximum defense: 15-20% cash, collar on concentrated positions |

**Step 3: Rebalance at Next Scheduled Rebalance (Not Immediately)**

This is critical — do NOT rebalance on every signal change. Only adjust weights at the next quarterly/regular rebalance unless the score drops by 3+ points in a single month (emergency shift).

### Practical Weight Table for IOWN Dividend Portfolio

| Regime | High-β Stocks (8) | Low-β Stocks (17) | Cash | Portfolio β |
|---|---|---|---|---|
| **Strong Bull** | 7.5% each = 60% | 2.35% each = 40% | 0% | ~1.05 |
| **Neutral** | 4.5% each = 36% | 3.75% each = 64% | 0% | ~0.85 |
| **Bear** | 2.0% each = 16% | 4.5% each = 76.5% | 7.5% | ~0.72 |
| **Crisis** | 1.5% each = 12% | 4.0% each = 68% | 20% | ~0.62 |

## Beyond Beta: Additional Levers

### 1. Quality + Dividend Growth Screening (Highest Impact, Lowest Cost)

Dividend growth portfolios (emphasizing growth rate over yield) tend toward ~95% up / ~80% down — the best natural capture profile among dividend approaches. High-yield strategies often show ~75% up / ~85% down because yield traps drag performance in rallies.

**Key screens that improve natural asymmetry:**
- High ROE (>15%) with low debt
- Consistent earnings growth (5+ years)
- Dividend growth rate > 7% annually
- Payout ratio < 60% (room to grow and cushion)

This is the single highest-impact lever and requires no timing skill. Tilting the existing 25 stocks toward dividend *growth* quality rather than pure yield improves the baseline capture before any beta timing.

### 2. Sector Rotation Within the Portfolio

Historical sector betas (long-run averages):

| Higher Beta (Bull Overweight) | Beta | Lower Beta (Bear Overweight) | Beta |
|---|---|---|---|
| Technology | 1.15–1.30 | Utilities | 0.40–0.65 |
| Financials | 1.10–1.25 | Consumer Staples | 0.60–0.75 |
| Consumer Discretionary | 1.05–1.20 | Healthcare | 0.70–0.90 |
| Industrials | 1.00–1.15 | REITs | 0.65–0.85 |

Overweighting staples + healthcare + utilities by 10% each (vs. market weight) and underweighting tech + discretionary has historically improved down capture by 8–12 percentage points while sacrificing only 3–5 points of up capture.

### 3. Options Overlays

| Strategy | Up Capture Impact | Down Capture Impact | Cost | Best Used When |
|---|---|---|---|---|
| **Covered calls** (BXM-style) | Caps at ~65-70% | Reduces to ~75-80% | Premium income (positive) | Range-bound / neutral regime |
| **Protective puts** | No impact | Floors downside | 2-4% annual drag | Crisis regime only |
| **Collars** (sell call + buy put) | Caps at +5-8% per quarter | Floors at -3-5% | Near zero cost | Transitional / uncertain regime |
| **Cash-secured puts on watchlist** | Adds income in bull | N/A (cash position) | Premium income | Bear regime (get paid to wait) |

**Recommendation:** Use collars selectively in "Neutral" regime on the 3-4 largest positions. Don't use covered calls in strong bull (they cap the upside you're trying to capture).

### 4. Momentum Overlay

Avoiding stocks with negative 6-12 month momentum has historically improved down capture by 5-10 points. At each rebalance:
- Check 6-month and 12-month relative momentum of each holding vs. SPY
- If a stock has negative relative momentum on both timeframes, reduce to minimum weight (or replace)
- This naturally rotates out of deteriorating names before they drag

### 5. Risk Parity Weighting (Alternative to Equal Weight)

Weighting by inverse volatility (1/σ) rather than equal weight naturally overweights defensive sectors. A risk-parity equity portfolio has historically achieved β ~0.70–0.80 with capture ratios of ~90% up / ~70% down. This could replace equal weight as the "neutral" baseline.

## Funds That Have Achieved Asymmetric Capture

| Strategy | Approach | Up Capture | Down Capture | Ratio |
|---|---|---|---|---|
| **Dividend Aristocrats** | Quality + 25yr dividend growth | ~85-95% | ~70-85% | 1.10-1.25x |
| **SCHD** | Quality + dividend growth screen | ~90-95% | ~75-85% | ~1.15x |
| **VIG** | Dividend growth focus | ~90% | ~75-80% | ~1.15x |
| **Ossiam Shiller CAPE US Sector Value** | CAPE-based sector rotation | ~120% | ~100% | 1.20x |
| **Allianz Best Styles US** | Multi-factor quality/value/momentum | ~118% | ~100% | 1.18x |

**Key takeaway:** Pure dividend strategies rarely exceed 95% up capture. Getting above 100% while keeping downside below 100% likely requires combining dividend growth selection with dynamic beta timing — which is exactly what this framework does.

## Risks and Honest Assessment

### Academic Research Is Skeptical

A comprehensive study of tactical allocation funds found **negative monthly alpha of -0.16%** across the full sample. TAA funds with $65B in AUM were **destroying approximately $1.25 billion in value annually**, underperforming passive indexes by 1.8% to 5.2% per year.

**However**, these studies examined complex, frequent-trading TAA strategies. The simple monthly 200-day SMA rule (Meb Faber's research) applied at the asset class level did produce positive results over 100+ years.

### Specific Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Whipsaw** | High in choppy markets | Require 2-of-3 signal confirmation before acting; monthly checks only |
| **Transaction costs** | Moderate | Limit rebalancing to quarterly; shift weights gradually, not all at once |
| **Tax drag** | High in taxable accounts | Execute in IRA/qualified accounts where possible; use tax-loss harvesting to offset |
| **Signal lag** | Inherent | Moving averages are lagging by design; accept that you'll miss the first 10-15% of moves |
| **Tracking error** | Moderate-High | Psychologically difficult when underperforming in a raging bull you've gone defensive on |
| **Complexity** | Moderate | Keep rules simple; automate the monthly scoring checklist |

### The Key Insight from Research

**The more complex and frequent the beta timing, the worse the outcomes net of costs.** If pursuing this:
- Keep it **simple** (monthly regime checks, not daily)
- Keep it **rules-based** (no discretionary overrides)
- Keep it **infrequent** (rebalance quarterly at most, unless emergency)
- Keep it **modest** (shift beta by 0.15-0.25 per adjustment, not wholesale restructuring)

## Recommended Action Plan

### Phase 1: Foundation (Now)
- [ ] Score current regime using the 6-signal checklist above — determine current target beta
- [ ] Classify all 25 holdings by beta, quality score, and dividend growth rate
- [ ] Identify which high-beta names have the best quality characteristics (these get overweighted first in bull)
- [ ] Identify any low-quality high-yield traps that are hurting capture — candidates for replacement

### Phase 2: First Implementation (Next Rebalance)
- [ ] Adjust weights according to current regime score rather than equal-weighting
- [ ] Tilt toward dividend *growth* quality over raw yield for any stock swaps
- [ ] Document the regime score and weight allocation for tracking
- [ ] Set calendar reminder for first Tuesday of each month: regime check

### Phase 3: Enhancement (3-6 Months)
- [ ] Track monthly capture ratios after implementing to measure improvement
- [ ] Evaluate adding collar strategy on top 3-4 largest positions in neutral regime
- [ ] Consider momentum overlay — flag stocks with negative 6/12-month relative momentum at each rebalance
- [ ] Back-test the regime scoring system against IOWN's historical holdings to validate

### Phase 4: Refinement (6-12 Months)
- [ ] Compare actual capture improvement vs. theoretical
- [ ] Decide if risk-parity weighting (inverse volatility) should replace equal weight as baseline
- [ ] Evaluate whether the complexity is justified by the capture improvement — if not, simplify further

## Bottom Line

Getting from 95.9% up / 95.6% down to >100% up / <100% down is achievable but requires three things working together:

1. **Stock selection** — Tilt toward dividend growth + quality, away from yield traps. This alone could improve the baseline to ~95% up / ~80% down.
2. **Dynamic beta** — Monthly regime scoring with quarterly weight adjustments. Shift beta from ~1.05 in confirmed bulls to ~0.70 in confirmed bears. This adds the timing component that pushes up capture above 100%.
3. **Discipline** — Rules-based, infrequent, simple. The research is clear: complex frequent timing destroys value. Simple monthly rules with quarterly execution is the sweet spot.

The realistic near-term target with this framework: **100-105% up capture / 80-90% down capture** — a capture ratio of 1.15-1.25x. The current 95.9/95.6 (ratio of 1.003x) has significant room for improvement.

---

*Sources: Ang et al. (2006) "The Cross-Section of Volatility and Expected Returns," Novy-Marx (2013) "The Other Side of Value," Meb Faber (2007) "A Quantitative Approach to Tactical Asset Allocation," Andrew Cardwell RSI Range Rules, CBOE BuyWrite Index (BXM) methodology, Fidelity/Morningstar capture ratio data, Research Affiliates, Wall Street Prep. Data as of April 2026.*
