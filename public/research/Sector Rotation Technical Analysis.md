
# Sector Rotation — Technical Analysis for Sector Weighting

> [!research] How moving averages and technical signals translate into sector allocation decisions

This note extends the Sector Tilt Signal Framework's "Technical Momentum" category (15% weight) into a standalone, implementable system. The goal: a repeatable process for using technical analysis — particularly moving averages — to influence sector weighting in IOWN's portfolios.

---

## 1. Moving Average Systems for Sector ETFs

### 1.1 The Core Setup: 50-Day and 200-Day SMA

The two moving averages that matter most at the sector level:

| Moving Average | Purpose | Signal |
|---|---|---|
| **50-day SMA** | Intermediate trend | Price above = healthy, below = weakening |
| **200-day SMA** | Long-term trend | Price above = bull regime, below = bear regime |

**For each sector ETF (XLK, XLF, XLE, XLV, XLP, XLU, XLI, XLB, XLRE, XLC, XLY):**

- **Price > 50 DMA > 200 DMA** → Strong uptrend. Full allocation or overweight.
- **Price > 200 DMA, but < 50 DMA** → Pullback within uptrend. Hold, potential add.
- **Price < 200 DMA, but > 50 DMA** → Bounce within downtrend. Caution, don't chase.
- **Price < 50 DMA < 200 DMA** → Full downtrend. Underweight.

### 1.2 Golden Cross / Death Cross

- **Golden Cross** (50 DMA crosses above 200 DMA): Historically signals the start of a multi-month sector uptrend. On sector ETFs, golden crosses have preceded 6-12 month outperformance ~65% of the time.
- **Death Cross** (50 DMA crosses below 200 DMA): Signals sustained weakness. Sector tends to underperform for 3-6 months after.

**Implementation rule:** When a sector ETF prints a golden cross AND the S&P 500 is above its own 200 DMA, that sector gets a +1 score on the technical momentum component. Death cross = -1.

### 1.3 Slope of the 200-Day MA

The direction of the 200 DMA matters as much as the price's position relative to it:

- **Rising 200 DMA** = Structural uptrend intact. This sector has earned a full allocation.
- **Flattening 200 DMA** = Trend exhaustion. Watch for distribution. Reduce to neutral.
- **Falling 200 DMA** = Structural downtrend. Underweight until slope turns.

**Measurement:** Calculate the 20-day rate of change of the 200 DMA itself. Positive = rising, negative = falling. This is a second-derivative signal — it catches trend changes before the cross.

---

## 2. Breadth as a Sector Health Indicator

Breadth answers: "Is the sector trend broad-based or driven by a few names?"

### 2.1 % of Stocks Above 50 DMA (by sector)

| Reading | Interpretation | Action |
|---|---|---|
| **>70%** | Broad strength, healthy trend | Overweight — the whole sector is participating |
| **50-70%** | Moderate breadth | Neutral — trend is real but narrowing |
| **30-50%** | Deteriorating breadth | Caution — leadership is concentrated |
| **<30%** | Breadth collapse | Underweight — even if the ETF looks OK, the internals are broken |

### 2.2 % of Stocks Above 200 DMA (by sector)

Same framework, but for the long-term trend. This is the more important signal for quarterly rebalancing:

- **>60% above 200 DMA** → Sector is in a structural bull market. Lean in.
- **<40% above 200 DMA** → Sector is in a structural bear market. Lean away.
- **Crossing 50% threshold** (in either direction) → Major regime change. This is a high-conviction rebalancing trigger.

### 2.3 Breadth Divergence

The most powerful signal: **when the sector ETF makes a new high but breadth makes a lower high.**

Example: XLK hits an all-time high, but only 55% of tech stocks are above their 50 DMA (down from 75% at the prior ATH). This divergence is a warning that the move is narrowing and a correction or rotation is likely within 2-6 weeks.

**IOWN application:** Before adding to any sector overweight, check that breadth confirms the move. If breadth diverges, hold rather than add, regardless of the price action.

---

## 3. Relative Strength Moving Averages

Raw price MAs tell you if a sector is going up. Relative strength MAs tell you if it's going up **faster than the market.** This is the signal that actually drives sector weighting.

### 3.1 Building the RS Line

For each sector ETF, calculate:
```
RS Line = Sector ETF Price / S&P 500 Price
```

Then apply a **40-week (200-day) moving average** to the RS line itself.

- **RS Line above its 40-week MA** → Sector is outperforming the market on a trend basis. Overweight.
- **RS Line below its 40-week MA** → Sector is underperforming. Underweight.
- **RS Line crossing above its 40-week MA** → Rotation signal. Begin building overweight.
- **RS Line crossing below its 40-week MA** → Exit signal. Reduce to neutral or underweight.

### 3.2 RS Ranking System

Each quarter, rank all 11 sectors by their RS line position relative to its moving average. The formula:

```
RS Score = (Current RS - 200-day MA of RS) / 200-day MA of RS × 100
```

This gives a percentage deviation. Sort descending:
- **Top 3-4 sectors**: Candidates for overweight
- **Middle 4-5 sectors**: Neutral
- **Bottom 3-4 sectors**: Candidates for underweight

### 3.3 Mansfield Relative Strength (MRS)

A normalized version used by Stan Weinstein practitioners:

```
MRS = (RS Line / 52-week MA of RS Line - 1) × 100
```

- **MRS > 0** → Sector outperforming over the past year. Bullish.
- **MRS < 0** → Sector underperforming over the past year. Bearish.
- **MRS crossing zero** → Major rotation inflection point.

---

## 4. Translating Technical Signals into Sector Weights

### 4.1 Technical Scoring Matrix

For each sector, score the following five signals (each 1-5):

| Signal | 5 (Strong OW) | 3 (Neutral) | 1 (Strong UW) |
|---|---|---|---|
| **Price vs MAs** | Price > 50 > 200, both rising | Price near 200 DMA, flat MAs | Price < 50 < 200, both falling |
| **Golden/Death Cross** | Recent golden cross | No cross in 3 months | Recent death cross |
| **Breadth (% > 50 DMA)** | >70% | 50-70% | <30% |
| **RS vs 40-week MA** | RS above and rising | RS near MA | RS below and falling |
| **Breadth Divergence** | No divergence, broad | N/A | Price new high, breadth lower high |

**Technical Composite = Average of 5 signals (range: 1.0 to 5.0)**

This feeds directly into the "Technical Momentum" row of the Sector Tilt Scorecard (15% weight).

### 4.2 Weight Adjustment Rules

Using the Tilt Scorecard's existing framework, the Technical Composite maps to allocation adjustments:

| Technical Composite | Tilt |
|---|---|
| **4.5 - 5.0** | +200-300 bps (max technical overweight) |
| **3.5 - 4.4** | +100-200 bps |
| **2.5 - 3.4** | No technical adjustment |
| **1.5 - 2.4** | -100-200 bps |
| **1.0 - 1.4** | -200-300 bps (max technical underweight) |

**Constraint:** Technical signals alone should not override the full scorecard. If a sector scores 5.0 on technicals but 1.5 on fundamentals (earnings, valuation), the technical signal is a **hold** at best, not an add.

### 4.3 Confirmation Hierarchy

When signals conflict, resolve in this order:
1. **200 DMA trend direction** (most important — defines the regime)
2. **RS vs 40-week MA** (relative performance is what matters for allocation)
3. **Breadth** (confirms whether the trend is real)
4. **50 DMA signals** (shorter-term, used for timing within the trend)
5. **Golden/Death cross** (lagging confirmation, not a leading signal)

---

## 5. Practical Implementation for IOWN

### 5.1 Quarterly Rebalance Checklist (Technical Component)

Run this on the first Monday of each quarter, alongside the full Tilt Scorecard:

- [ ] Pull 50/200 DMA data for all 11 sector ETFs
- [ ] Note price position relative to both MAs and MA slope direction
- [ ] Check for any golden/death crosses in the prior quarter
- [ ] Pull breadth data: % of stocks above 50 DMA and 200 DMA per sector
- [ ] Check for breadth divergences vs. price action
- [ ] Calculate RS line vs 40-week MA for each sector
- [ ] Rank sectors by RS Score
- [ ] Score each sector on the 5-signal Technical Scoring Matrix
- [ ] Input Technical Composite into the Sector Tilt Scorecard
- [ ] Flag any sectors where technical and fundamental signals diverge

### 5.2 Mid-Quarter Monitoring Triggers

Between quarterly rebalances, watch for these signals that warrant an IC discussion:

1. **Death cross on a sector you're overweight** → Discuss reducing before next rebalance
2. **Breadth collapse (<30% above 50 DMA) in an overweight sector** → Same
3. **Golden cross + RS breakout in an underweight sector** → Discuss adding early
4. **Breadth divergence at market highs** → Risk management alert for the full portfolio

### 5.3 Data Sources

| Signal | Free Source | Update Frequency |
|---|---|---|
| Sector ETF price & moving averages | TradingView, StockCharts (free tier) | Daily |
| % stocks above 50/200 DMA by sector | Barchart.com, MarketInOut.com | Daily |
| Relative strength lines | StockCharts ($SECTOR:$SPX ratio charts) | Daily |
| Golden/death cross alerts | TradingView alerts (free) | Set once, runs auto |

### 5.4 IOWN Holdings Cross-Reference

When a sector technical signal fires, these are the IOWN holdings affected:

| Sector | IOWN Tickers | Key ETF |
|---|---|---|
| Technology | AMD, NVDA, TSM, NXPI, ADI, LRCX, QCOM, KEYS, FTNT, CWAN, DOCU | XLK |
| Industrials | CAT, GD, LMT, FAST, PCAR, MATX, TEL, TOL | XLI |
| Energy | VLO, CVX, OKE, CNX | XLE |
| Financials | COIN, SYF, HOOD, SSNC, FINV, SUPV | XLF |
| Healthcare | ABT, SYK, DGX, HRMY, A | XLV |
| Utilities | NEE, ATO, EIX, BKH | XLU |
| Materials | STLD, ATAT | XLB |
| Mining/Gold | AEM, GFI | GDX |
| Crypto/Digital | MARA, HUT, IBIT, ETHA | N/A (custom basket) |
| Consumer Staples | CHD, CL | XLP |
| Consumer Disc. | PDD | XLY |

---

## 6. What the Academic Evidence Says About Technical Signals for Sectors

From the Sector Rotation Academic Review:

- **Momentum-based rotation (Moskowitz & Grinblatt, 1999):** 6-12 month lookback relative strength is the strongest technical signal. This aligns with the RS vs 40-week MA approach above.
- **Conover et al. (2008):** Monetary policy direction acts as a macro confirmation overlay for technical rotation signals.
- **Molchanov & Stangl (2024):** Pure business-cycle rotation (which is fundamentally-driven) underperforms. The implication: **technical/momentum signals add more value than fundamental cycle-timing alone.**
- **DWS CROCI (live since 2015):** Combining valuation with momentum confirmation outperforms either signal alone.

The evidence supports using technical analysis as a **confirmation and timing layer** on top of the fundamental scorecard — not as a standalone system.

---

## Next Steps

- [ ] Build a live sector RS ranking spreadsheet (quarterly update)
- [ ] Set TradingView alerts for golden/death crosses on all 11 sector ETFs
- [ ] Run the Technical Scoring Matrix on current data as a dry run
- [ ] Compare technical scores vs. current IOWN sector weights — identify mismatches
- [ ] Present the full TA overlay framework to Eric at next IC meeting

---

*Research compiled 2026-03-27 | Extended from Quick Capture request*
*Links: [[Research - Sector Tilt Signal Framework]] | [[Research - Sector Rotation Academic Review]]*
