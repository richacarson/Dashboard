
# Should We Exit the Utilities? Testing the Rate-Sensitivity Case for ATO, NEE and EIX

*Research note — 31 August 2026. Prepared in response to a proposal to sell the full utility book on rate-sensitivity grounds. Proceeds assumed to park in RDVY until the next rebalance. Pre-tax analysis.*

---

## Summary

The proposal was to sell ATO, NEE and EIX as a block, on the view that all three are rate-sensitive and long rates are staying high. **The data does not support treating them as a block.** Measured against eight and a half years of daily total returns, the three have almost nothing in common on the dimension the thesis rests on.

| | Duration beta | Net debt / EBITDA | Interest coverage | 2022 hiking cycle |
|---|---:|---:|---:|---:|
| **ATO** | **0.08** | 3.65× | **13.4×** | **−1.7%** |
| **NEE** | **0.46** | **6.06×** | 2.44× | −18.8% |
| **EIX** | 0.41 | 5.53× | 2.54× | −14.6% |
| *S&P 500* | *0.00* | — | — | *−19.8%* |

Duration beta is the coefficient on TLT in a two-factor weekly regression that also controls for the market. It answers: *how much does this move on rates, after stripping out how much it moves with equities?*

**Recommendation, by name:**

- **ATO — HOLD.** It is the counterexample to the thesis, not an instance of it. Duration beta of 0.08 is effectively zero. In the sharpest rate shock in forty years it lost 1.7% while the S&P lost 19.8%.
- **NEE — SELL.** The thesis is correct here and the balance sheet is the reason. 6.06× leverage, 34% of EBIT consumed by interest, and negative free cash flow that must be funded externally at whatever rates prevail.
- **EIX — SELL, but the stated reason is the wrong one.** Its risk is California wildfire liability, not duration. That distinction stopped being academic **today**.

---

## Today Ran the Experiment For Us

While this note was being prepared, California's State Assembly advanced an amended wildfire bill that omits the liability protections utility investors had expected this session. Analysts characterised it as *"more focused on victim protections without any new investor protections."* Newsom had backed a provision barring insurer subrogation suits against utilities; legislators rejected it.

Monday's closing moves:

| | Change |
|---|---:|
| **EIX** | **−23.07%** |
| PG&E | −20.06% |
| Sempra | −3.10% |
| XLU (utilities sector) | −1.22% |
| **ATO** | **−0.31%** |
| **NEE** | **+0.61%** |
| TLT (long Treasuries) | −0.43% |

This is as clean a test of the "our utilities share a risk factor" premise as we could have designed. On a day one of the three lost nearly a quarter of its value, the other two were unchanged — and the rate factor itself barely moved. The gradient runs by California wildfire exposure (EIX and PG&E devastated, Sempra down 3%, everything else flat), not by duration.

The three names in this proposal do not share a risk factor. They share a GICS sector code.

---

## Testing the Premise

### Rate sensitivity, measured

Weekly total returns, 2018–2026, regressed on the S&P 500 and on TLT as the duration factor. The market control matters: utilities have equity beta, and without removing it you measure beta twice and mistake it for rate sensitivity.

| Period | | ATO | NEE | EIX | XLU | RDVY |
|---|---|---:|---:|---:|---:|---:|
| **2018–2026** | duration beta | 0.08 | 0.46 | 0.41 | 0.22 | −0.08 |
| **2022–23 hiking** | duration beta | 0.24 | 0.34 | 0.32 | 0.24 | −0.10 |
| **2024–26** | duration beta | 0.26 | 0.26 | 0.37 | 0.34 | 0.10 |

Over the full period NEE carries roughly **six times** ATO's duration exposure. That is the single most important number in this note, and it is invisible if the three are treated as one position.

A duration beta of 0.26 to 0.46 also needs scaling honestly. TLT carries roughly 17 years of duration, so a 100bp rise in long rates is about a −15% move in TLT. Applied to these betas, that is a **−4% to −7%** headwind. Real, worth sizing — but not the dominant risk in any of these names.

### Rates barely explain these stocks any more

The same regressions, reported as the share of variance the two factors *fail* to explain, 2024–2026:

| | Unexplained by market + rates |
|---|---:|
| ATO | 96% |
| NEE | 98% |
| EIX | 97% |
| XLU | 90% |
| *RDVY* | *31%* |

Between 96 and 98 percent of what has moved these three names over the past two and a half years is neither the market nor rates. RDVY, by contrast, is 69% explained — it behaves like a market instrument.

This is the second problem with the thesis. Even where duration exposure exists, it has not been the thing driving returns. Selling on rate sensitivity is optimising a variable that currently accounts for a small single-digit share of the outcome.

### What actually moved them

The worst 10-day windows for each name, with the same window's move in TLT alongside:

**EIX**

| Window | EIX | TLT | What happened |
|---|---:|---:|---|
| Mar 2020 | −34.5% | **+6.5%** | COVID crash |
| Nov 2018 | −30.8% | +0.5% | Camp Fire |

In its single worst episode, EIX fell 34.5% while long Treasuries *rallied* 6.5%. Rate sensitivity predicts the opposite sign. Its second-worst is the Camp Fire, with rates flat. Neither is a duration event.

**NEE**

| Window | NEE | TLT | What happened |
|---|---:|---:|---|
| Mar 2020 | −30.5% | −3.1% | COVID crash |
| **Sep–Oct 2023** | **−26.9%** | −2.4% | Yield spike to 5% |

NEE's worst non-COVID drawdown lands squarely on the 2023 move to 5% on the 10-year — where it fell roughly ten times TLT's move over the same window. Here the thesis holds.

### Episode returns

Total return, dividends included, through each rate shock:

| Episode | TLT | ATO | NEE | EIX | XLU | RDVY | SPY |
|---|---:|---:|---:|---:|---:|---:|---:|
| 2022 hiking cycle | −34.9% | **−1.7%** | −18.8% | −14.6% | −8.0% | −18.2% | −19.8% |
| 2023 summer yield spike | −16.5% | −9.0% | **−28.0%** | −10.1% | −11.8% | −8.6% | −6.5% |
| 2024 Q4 rate backup | −14.6% | **+2.4%** | −19.1% | −30.9%¹ | −3.0% | +6.0% | +4.1% |
| Last 12 months | +0.3% | +2.9% | +16.2% | +40.4% | +4.1% | +26.4% | +20.6% |

¹ *EIX's loss in this window is the January 2025 Eaton Fire, not the rate move. The window is labelled by the rate episode; the cause was not.*

The 2022 row is the strongest single piece of evidence against selling ATO. That was the fastest tightening cycle since the early 1980s. ATO lost 1.7%. RDVY — the proposed destination — lost 18.2%.

---

## The Balance Sheets

Price betas describe what has happened. Leverage describes what happens next, because a utility's real rate exposure is refinancing, not correlation.

| | ATO | NEE | EIX |
|---|---:|---:|---:|
| Net debt / EBITDA | **3.65×** | 6.06× | 5.53× |
| Debt / equity | **0.67** | 1.93 | 2.48 |
| Interest coverage | **13.4×** | 2.44× | 2.54× |
| Share of EBIT to interest | **7%** | **34%** | — ² |
| Free cash flow / share | −$12.00 | −$4.87 | −$1.01 |
| Dividend payout ratio | 45% | 53% | 35% |
| P/E (TTM) | 19.6 | 18.4 | **5.5** |
| Dividend yield | 2.41% | 2.96% | **6.41%** |

² *EIX's interest burden ratio exceeds 1.0, which reflects capitalised interest and AFUDC accounting rather than negative interest expense. Read the coverage ratio instead.*

All three run negative free cash flow — normal for utilities in a heavy capex cycle, and the mechanism by which higher rates actually bite: they must return to capital markets regardless of price.

**But the magnitude differs enormously.** ATO covers interest 13.4 times over and hands 7% of EBIT to lenders. NEE covers it 2.4 times and hands over 34%. That is not a difference of degree.

NEE is the name where every strand converges — the highest duration beta, the highest leverage, the thinnest coverage, and a capital programme requiring roughly $12bn of external funding a year. **The rate-sensitivity case against NEE is sound and this note endorses it.**

---

## The RDVY Question

The proposal parks proceeds in RDVY until the next rebalance. RDVY is not a neutral holding pen.

| | |
|---|---|
| Financial Services | **39.6%** |
| Technology | 23.6% |
| Industrials | 13.1% |
| Consumer Cyclical | 11.2% |
| **Utilities** | **0.0%** |
| Expense ratio | 0.47% |
| Holdings | 51 |

Two consequences the committee should price in.

**It is a rate-directional bet, not a parking place.** RDVY's duration beta is −0.08 over the full period. That is not an accident — it is 40% banks, and banks tend to benefit from higher rates. Selling ATO and NEE to buy RDVY is not reducing a rate view; it is *reversing* it. If the house view is that long rates stay high, RDVY is arguably the correct expression. But it should be adopted deliberately, not as a way station.

**It concentrates the sleeve into financials.** The dividend sleeve already carries ORI, SYF, SPGI and NWG. Adding a 40%-financials ETF on top compounds an existing tilt. The 0.47% expense ratio also runs against a book of direct holdings that costs nothing to hold.

RDVY has performed well — +64.5% over 2024–26 against SPY's +68.1%, with a −19.1% maximum drawdown. This is not an argument against the fund. It is an argument that moving 8% of the book into it is an allocation decision deserving its own paper.

### Risk and return, 2024–2026

| | Total return | Annualised vol | Max drawdown |
|---|---:|---:|---:|
| ATO | +52.7% | **16.2%** | **−12.7%** |
| NEE | +45.9% | 25.6% | −23.8% |
| EIX | +15.6% | 27.5% | **−43.9%** |
| RDVY | +64.5% | 16.8% | −19.1% |
| SPY | +68.1% | 15.7% | −18.8% |

ATO has produced a 52.7% total return with the lowest volatility and the shallowest drawdown of anything in the table, the S&P included. Selling it to buy an instrument with a deeper drawdown and higher volatility requires an argument this note has not found.

---

## Positions and Income

| | Sleeve | Target wt | Shares | Value | Yield | Income |
|---|---|---:|---:|---:|---:|---:|
| ATO | Dividend | 2.5% | 89.0 | $14,785 | 2.41% | $356 |
| NEE | Dividend | 3.0% | 216.3 | $17,810 | 2.96% | $527 |
| EIX | Growth | 2.5% | 42.9 | $2,314 | 6.41% | $148 |
| | | | | **$34,908** | **2.95%** | **$1,031** |

Note that EIX sits in the **growth** sleeve, not dividend. Exiting it is a growth-mandate decision; ATO and NEE are dividend-mandate decisions with an income test attached. The three cannot be executed as one trade even if the committee wants all three sold.

---

## Recommendation

**1. Hold ATO.** The evidence runs the other way. Duration beta of 0.08, interest coverage of 13.4×, leverage of 3.65×, and a −1.7% result through the worst rate shock in forty years while the market fell 19.8%. It is the portfolio's best demonstration that a regulated utility with a conservative balance sheet is not a bond proxy. Selling it would remove the one holding that has actually done the job the sector is meant to do.

**2. Sell NEE.** The thesis is right about this name. Highest duration beta of the three, 6.06× leverage, 2.44× interest coverage, a third of EBIT going to lenders, and negative free cash flow that forces it into capital markets on the market's terms. Its worst non-pandemic drawdown was a rate event. At 18.4× earnings it is not priced for that risk.

**3. Sell EIX — on wildfire liability, not rates.** Getting the reason right matters for what we do next. Today's legislative outcome removes the liability containment the entire California utility investment case rested on, and it does so at 2.48× debt-to-equity with 5.53× leverage. This is a permanent change to the risk profile, not a drawdown to sit through.

**The timing question is real and the committee should decide it explicitly.** The stock fell 23% today. A 6.41% yield and a 5.5× P/E say a great deal of bad news is now priced. Two considerations argue for acting anyway rather than waiting for a bounce: the impairment is structural rather than sentiment, and the position is $2,314 — the smallest in either sleeve. The optionality being preserved by waiting is worth a few hundred dollars. The tail risk being carried is not.

**4. Do not default the proceeds into RDVY.** Redeploying ~$20,000 into a 40%-financials, 0%-utilities ETF is a sector rotation and a reversal of the portfolio's rate stance. If the committee wants that bet, take it deliberately at the rebalance. Until then short-duration cash is the honest parking place — it carries no view, which is the point of a parking place.

---

## What Would Change This View

**On ATO — sell if:**
- Net debt / EBITDA passes 4.5× or interest coverage falls below 8×. The hold case rests on the balance sheet, not the sector.
- Duration beta rises above 0.30 on a rolling two-year basis, indicating the market has re-rated it as a bond proxy.
- The gas LDC regulatory compact deteriorates — an adverse rate case in Texas or Louisiana, where the rate base sits.

**On NEE — revisit if:**
- Long rates fall materially and the refinancing path clears. The case against NEE is leverage into high rates; that argument weakens if rates do.
- Leverage falls below 5× net debt / EBITDA, or free cash flow turns positive.

**On EIX — revisit if:**
- California returns to wildfire liability reform in the 2027 session with investor protections intact. Today's outcome is one session, not a permanent settlement.
- The wildfire fund is recapitalised in a way that caps utility exposure.

**On the framework itself:** if the unexplained share of variance falls back toward 50% — meaning market and rates start explaining these stocks again — the factor-based case becomes far more actionable than it is at 96–98%.

---

## Method and Limitations

**Data.** Daily dividend-adjusted total returns from FMP, 2 January 2018 to 27 August 2026 — 2,175 observations per security across ATO, NEE, EIX, XLU, RDVY, SPY and TLT. Balance-sheet and valuation figures are trailing-twelve-month as reported. Intraday quotes for 31 August 2026 are same-day. Treasury curve from FMP: 10-year at 4.67%, 30-year at 5.19% as of 27 August.

**Duration beta** is the TLT coefficient from `r = α + β_mkt·SPY + β_dur·TLT + ε` on non-overlapping weekly returns. TLT is used as the duration factor rather than the 10-year yield because it is a traded total-return series that matches the frequency and adjustment basis of the equity data. Signs are therefore inverted relative to a yield regression: a *positive* β_dur means the stock falls when Treasuries fall, i.e. when rates rise.

**Limitations worth stating.**

- The 2024–26 sub-period regressions carry R² of 0.02–0.10. The betas are estimated on very little explained variance and should be read as weak evidence, not precise measurement. This weakness is itself the finding.
- Episode windows are chosen for rate salience, which is a judgement. The 2024 Q4 window in particular conflates a rate move with the Eaton Fire for EIX, and is annotated rather than excluded because the confound is the point.
- TLT is a proxy. It embeds term premium and convexity effects a pure yield series would not.
- RDVY's holdings could not be retrieved — that endpoint requires a higher FMP tier than the current Premium subscription. Sector weights are from the fund information endpoint. The overlap analysis against existing dividend-sleeve holdings could not be completed, and the financials-concentration concern is therefore directional rather than quantified.
- No tax analysis, per instruction.
- Nothing here forecasts rates. The analysis measures sensitivity and leaves the rate view to the committee.
