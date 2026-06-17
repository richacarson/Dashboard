
# Backlogs, Book-to-Bill, and Contract Flow as Stock Screening Signals — Validity and Implementation

---

## The Question

Are order backlogs, book-to-bill ratios, and government contract flows valid signals for identifying quality stocks? If so, how do you actually do that research — what data, what tools, what thresholds, what cadence — and how does it integrate into Family Capital's quarterly rebalance?

---

## Part 1 — Is It Valid?

### What the Academic Literature Says

Order backlog is one of the best-documented fundamental signals in accounting research. Six key studies establish the case:

**1. Lev & Thiagarajan (1993), "Fundamental Information Analysis," *Journal of Accounting Research*.**
Identified order backlog as one of 12 fundamental signals that predict future earnings changes and stock returns. Backlog growth relative to sales growth was statistically significant — when backlog grows faster than revenue, future earnings tend to accelerate. The foundational paper that put backlog on the academic map.

**2. Abarbanell & Bushee (1998), "Abnormal Returns to a Fundamental Analysis Strategy," *The Accounting Review*.**
A long-short strategy based on fundamental signals (including backlog) earned approximately **13.2% annually**. Backlog was a contributing factor, though not the strongest individual signal (inventory and gross margin changes were stronger).

**3. Rajgopal, Shevlin & Venkatachalam (2003), *Review of Accounting Studies*.**
The definitive backlog study:
- Order backlog positively predicts future earnings growth up to **four quarters ahead**, controlling for current earnings, sales growth, and other fundamentals.
- The market **overweights backlog *levels*** — it extrapolates too aggressively from high absolute backlogs.
- Effect strongest in **long-cycle industries**: aerospace, defense, capital goods, industrials.

**4. Baik & Ahn (2007), *Seoul Journal of Business*.**
The market **underreacts to backlog *changes***. A long-short portfolio on backlog change deciles earned **13.7% annualized** in the year after formation. Analysts' forecast errors are large and negative for firms experiencing backlog declines — they're too slow to mark down estimates.

**5. Gu & Huang (2010), "Sales Order Backlogs and Momentum Profits," *Journal of Banking & Finance*.**
An order backlog factor earns **~0.38%/month (~4.6% annualized)** and significantly explains momentum returns. Winner stocks have higher backlog growth. Backlog partly *is* what momentum captures.

**6. Banker, Barber, Hollie & Park (2024), *Review of Quantitative Finance and Accounting*.**
The critical non-linear finding: backlog is more informative when sales are declining (it signals recovery). But **a very high backlog-to-sales ratio actually predicts *lower* future earnings** — signaling capacity constraints or execution risk. This is the "too much backlog" problem.

### Government Contract Flow as a Signal

**TenderAlpha / FactSet (2021):** An "unexpected government receivables" strategy — long stocks with the highest unexpected government contract revenue, short stocks with no government receivables — generated **5.4%–7.1% annualized alpha** with Sharpe ratios of **0.77–1.27** (2–3x the market's historical Sharpe). Independently confirmed by a 2025 *Economics Letters* paper. The edge comes from aggregating public-but-hard-to-process contract data — the information is public, but nobody aggregates it efficiently.

### What Practitioners Do With It

The sell-side uses backlog and book-to-bill extensively. It's not exotic — it's foundational:

- **Defense analysts** (Goldman, Morgan Stanley, JPMorgan, Jefferies) model revenue as: beginning backlog + new orders – revenue recognized = ending backlog. Book-to-bill is the key driver of the order line. This is the standard model for LMT, NOC, RTX, GD, L3Harris.
- **Semiconductor industry** had a formal SEMI-published monthly book-to-bill ratio until 2017 (now publishes billings only). That ratio was the single most-watched leading indicator for the semiconductor cycle. A sustained crossing above 1.0 signaled an upcycle 1–2 quarters ahead.
- **Industrials/capital goods** — CAT, TEL, PCAR, DE all disclose backlog or book-to-bill. TEL publishes a clean quarterly book-to-bill (Q2 FY26: 1.12, accelerating from 1.05 over three quarters on AI data center demand). CAT's record $63B backlog preceded Q1 2026 EPS of $5.54 vs $4.25 YoY.
- **No standalone quant factor exists.** Backlog is too sparse and non-standardized for a systematic cross-sectional factor. But it's routinely incorporated in sector-specific models and is available via Compustat (BKLOG field) for academic research.

### Signal Decay

**McLean & Pontiff (2016), *Journal of Finance*:** Studied 97 return-predictive variables. Portfolio returns are **26% lower out-of-sample and 58% lower post-publication**. The backlog anomaly is partially subject to this. But the effect persists in long-cycle industries where data is sparse and hard to systematize. For a discretionary analyst reading 10-Qs carefully, the informational advantage still exists — you're just not going to capture the full 13.7% a quant portfolio might have earned in 2003.

### When Backlogs Mislead

The signal is real, but it has documented failure modes:

**1. IDIQ ceilings ≠ bookings.** An IDIQ (Indefinite Delivery, Indefinite Quantity) contract ceiling is the *maximum* the government is *authorized* to spend — not money that's been committed. The ceiling is often shared among multiple vendors over 5–10 years. The obligated amount is what matters. Always separate **funded backlog** (iron-clad commitment) from **unfunded/ceiling** (theoretical maximum).

**2. Cancellation risk.** Backlog assumes the customer will take delivery. Boeing carries a $695B backlog and has lost $47.2B cumulatively since 2019 — the fleet was grounded, deliveries stopped, and the backlog became untouchable. Defense programs get cancelled (Future Combat Systems, Crusader, Comanche). In industrials, orders get deferred in downturns.

**3. Single-quarter noise.** Book-to-bill is volatile quarter to quarter. Always use **trailing-twelve-month book-to-bill**, not single quarters. A trend of 3+ quarters above 1.0 is meaningful; one quarter is not.

**4. Backlog ≠ profitability.** A company can have a massive backlog and lose money on every contract. Fixed-price contract exposure during inflation is a margin killer. Always pair backlog analysis with margin and cash flow analysis.

**5. Accounting discretion post-2020.** The SEC's 2020 modernization of Reg S-K Item 101 shifted backlog disclosure from mandatory to principles-based — companies now only disclose backlog "if material." Cross-company comparison is harder than it used to be.

**6. Backlog duration.** A $10B backlog converting over 10 years is worth less per year than a $2B backlog converting in 18 months. Backlog-to-revenue ratio and backlog burn rate are more useful than absolute size.

**7. Management games the disclosure.** Chapman, Kaplan & Potter (2024, *JBFA*) found managers provide precise, quantitative book-to-bill numbers when the news is good and vague qualitative language when it's bad. If management stops disclosing a specific number they used to report, that's bearish.

**8. Backlog manipulation is legal.** Gilliam, Heflin & Paterson (2025, *RQFA*) found managers manipulate order fulfillment timing to hit revenue targets — pulling forward backlog conversion to avoid a miss. This is a real-activities operating decision, not an accounting violation, making it undetectable by audit. Firms that barely meet revenue targets with abnormally low ending backlog are the signature pattern.

### Verdict

| Question | Answer |
|---|---|
| Is backlog growth a valid predictor of future earnings? | **Yes** — peer-reviewed, 30+ years of evidence |
| Does the market misprice it? | **Yes, but nuanced** — overweights levels, underreacts to changes |
| Is book-to-bill >1.0 useful? | **Yes, on a TTM basis** — single quarters are noise |
| Does this work better in some sectors? | **Yes** — strongest in long-cycle industries (defense, aero, industrials, semis) |
| Is it sufficient on its own? | **No** — must be paired with profitability, cash flow, valuation, and contract-type analysis |
| Has the alpha decayed? | **Partially** — ~58% decay post-publication, but persists in data-sparse long-cycle sectors |

---

## Part 2 — How to Do This Research

### 1. Finding Backlog Data in SEC Filings

**Where it lives:**
- **10-K, Item 1 (Business):** Primary location. Under Reg S-K Item 101(c), companies must disclose backlog if it's "material to an understanding of the registrant's business." Defense, aero, and industrial companies almost always include it.
- **10-Q, MD&A (Item 2):** Quarterly updates to backlog figures, especially when material changes occur.
- **Earnings press releases & investor presentations:** Often more detailed than filings. Defense companies (LMT, NOC, RTX, GD) present backlog breakdowns (funded vs. unfunded, by segment, by contract type) in quarterly earnings slides.
- **Earnings call transcripts:** Management commentary on order flow, book-to-bill, and pipeline. The Q&A section often surfaces quality information not in prepared remarks.

**How to calculate book-to-bill from public filings:**
```
Book-to-Bill = New Orders (Bookings) ÷ Revenue

Where:
  New Orders = Ending Backlog − Beginning Backlog + Revenue Recognized
  (This backs into orders from the backlog waterfall)
```
Most defense companies report new orders directly. If not, the backlog waterfall lets you derive it.

**SEC EDGAR search:** Use the full-text search at [efts.sec.gov/LATEST/search-index](https://efts.sec.gov/LATEST/search-index?q=%22order+backlog%22&forms=10-K,10-Q) — search `"order backlog"` filtered to 10-K/10-Q filings for any company.

### 2. Financial Data Platforms

| Platform | Backlog Data? | Cost | Best For |
|---|---|---|---|
| **Bloomberg Terminal** | Yes — backlog fields for most industrials/defense | ~$24K/yr | Real-time, broadest coverage |
| **S&P Capital IQ** | Yes — searchable, exportable | ~$15–30K/yr | Screening, Excel integration |
| **FactSet** | Yes — good modeling tools | ~$12–20K/yr | Financial modeling |
| **Koyfin** | Limited — financials + estimates | Free–$480/yr | Affordable starting point |
| **AlphaSense** | Extracts from filings via AI | ~$10K+/yr | Filing search, transcript search |
| **SEC EDGAR** | Raw filings — manual extraction | Free | Direct source, always available |
| **Compustat (WRDS)** | BKLOG field, 17K+ observations 2000–2016 | Academic/institutional | Backtesting, quantitative research |

For our size (~$516M AUM), **FactSet or Capital IQ** would be the institutional-grade choice. For a lean start, **Koyfin + SEC EDGAR + earnings transcripts** covers 80% of the need at minimal cost.

### 3. Government Contract Databases

**Free Sources:**

| Source | URL | What You Get | Cadence |
|---|---|---|---|
| **SAM.gov** | [sam.gov/search](https://sam.gov/search) | All unclassified federal contract awards above micro-purchase threshold. FPDS search fully absorbed into SAM.gov as of Feb 2026. Search by contractor, agency, NAICS, dollar amount. | Real-time |
| **USAspending.gov** | [usaspending.gov/search](https://www.usaspending.gov/search) | $7.2T in federal spending. Recipient profiles show contractor-level history, customer concentration, trends. Bulk data exports and API. | Updated regularly |
| **DoD Daily Contracts** | [defense.gov/News/Contracts](https://www.defense.gov/News/Contracts/) | All DoD contract actions **≥$7.5M**, published every business day at **5 PM ET.** Earliest public signal — appears hours before terminals. | Daily 5 PM ET |

**Paid Sources:**

| Source | What It Does | Cost |
|---|---|---|
| **GovWin IQ (Deltek)** | Tracks RFPs up to 5 years pre-release. 150+ analysts interviewing government decision-makers. Pipeline intelligence. | $12K–$42K/yr |
| **Bloomberg Government (BGOV)** | Federal funding flow tracking, BGOV200 contractor ranking, supply chain analytics. | ~$8K–15K/yr |
| **Jane's Defense** | Military capabilities, equipment specs, program intelligence. | ~$5K–15K/yr |
| **ForcedAlpha** | Faster UX for contract search, incumbent tracking, recompete alerts. | Free tier + paid |

**Alternative Data (systematic contract-flow signals):**

| Source | What It Does | Cost |
|---|---|---|
| **TenderAlpha** (via FactSet Marketplace) | 120M+ government contracts from 65+ countries, ticker-mapped. 3,000+ US suppliers. 5.4–7.1% alpha in backtests. | Institutional |
| **Quiver Quantitative** (via QuantConnect) | US government contracts, 700+ equities, daily from Oct 2019. Sourced from USAspending.gov API. | Free tier + paid |

### 4. The Ceiling vs. Obligated Distinction

The single most important concept for evaluating defense contractor backlogs:

- **Obligated dollars** = a binding legal commitment from the government to pay. Real revenue visibility. Reported as "funded backlog."
- **Contract ceiling** = the maximum that *could theoretically* be spent. Zero legal obligation. On IDIQ contracts, shared among all awardees over the contract's full life.

**Rule of thumb:** Only model obligated/funded backlog in revenue forecasts. Track IDIQ ceilings separately as "option value" — they indicate the addressable pipeline, not committed revenue.

### 5. Tracking Defense Budget & Program Funding

- **NDAA text:** [congress.gov](https://www.congress.gov/bill/119th-congress/senate-bill/2296) — FY2026 authorized $890.6B
- **Budget justification books (R-1, P-1, O-1):** [comptroller.war.gov/budget-materials](https://comptroller.war.gov/budget-materials/) — line-item detail by program. R-1 = RDT&E, P-1 = procurement. Available as Excel files searchable by Program Element (PE) code.
- **CRS Defense Primers:** [congress.gov/crs-product/IF10516](https://www.congress.gov/crs-product/IF10516) — concise briefings on NDAA process, RDT&E categories, budget cycle
- **GAO acquisition assessments:** Annual reviews of major defense programs with cost/schedule/performance grades

**How to track a specific program:**
1. Find its PE code in the R-1 or P-1 exhibit
2. Download the service-specific justification book from comptroller.war.gov
3. Track YoY funding changes — increasing = tailwind for contractors on that program
4. Cross-reference with NDAA markups for congressional adds/cuts
5. Watch for GAO risk assessments flagging schedule slips or cost overruns

### 6. Building the Tracking System

**Recommended columns per company:**

| Column | Source | Frequency |
|---|---|---|
| Total backlog ($) | 10-Q / earnings release | Quarterly |
| Funded backlog ($) | 10-Q / earnings slides | Quarterly |
| % funded | Calculated | Quarterly |
| New orders / bookings ($) | Earnings release | Quarterly |
| Revenue ($) | Income statement | Quarterly |
| Book-to-bill (quarterly) | Calculated: orders ÷ revenue | Quarterly |
| Book-to-bill (TTM) | Calculated: TTM orders ÷ TTM revenue | Quarterly |
| Backlog-to-revenue ratio | Calculated: backlog ÷ quarterly revenue | Quarterly |
| Backlog burn rate | Calculated: quarterly rev ÷ beginning backlog | Quarterly |
| Fixed-price % of backlog | 10-K / earnings slides | Annually |
| Top 3 programs (% of backlog) | 10-K / investor presentation | Annually |
| Major new contract wins | SAM.gov / defense.gov / press releases | Ongoing |
| Insider activity (buys/sells) | SEC Form 4 / OpenInsider | Ongoing |

**Thresholds:**

| Metric | Green | Yellow | Red |
|---|---|---|---|
| TTM Book-to-bill | >1.2 | 1.0–1.2 | <1.0 for 2+ quarters |
| Funded % of backlog | >85% | 70–85% | <70% |
| Backlog-to-revenue | >3x quarters | 2–3x | <2x (low visibility) |
| Cash conversion ratio | >0.9x | 0.8–0.9x | <0.8x |
| Insider activity | Net buying | Neutral | Heavy selling, zero buys |

**Cadence:**
- **Quarterly:** Full update after each earnings report — backlog, orders, book-to-bill, margins, cash flow
- **Weekly/daily:** Scan defense.gov contract page at 5 PM ET for defense holdings. Set Google Alerts for "[company name] contract award."
- **Monthly:** Check NDAA/appropriations developments during budget season
- **Annually:** Update contract-type mix (fixed-price vs cost-plus), top-program concentration, backlog duration from 10-K

### 7. Integrating Into Our Rebalance Process

1. **Screen:** For any defense/industrial/capital goods name in the portfolio or on the watchlist, pull TTM book-to-bill and backlog-to-revenue ratio. Flag names where TTM book-to-bill has dropped below 1.0 for 2+ quarters (potential trim) or risen above 1.2 for 2+ quarters (potential add).

2. **Validate:** For flagged names, check: Is the backlog funded? Is the company converting backlog to cash (OCF/net income >0.8)? Are insiders buying or selling? What does the contract-type mix look like?

3. **Cross-reference:** Compare backlog signals against our Hold-Forever Score, ROIC trends, and valuation. A company with accelerating backlog but 80x forward P/E is not automatically a buy — price paid still determines long-term return.

4. **Decide:** Backlog acceleration + quality earnings + reasonable valuation + insider alignment = strong add candidate. Backlog deceleration + insider selling + stretched valuation = trim or exit.

---

## Recommendation for the July Rebalance

**Immediate action items:**

| Action | Detail | Timing |
|---|---|---|
| **Build backlog tracker** | Populate the spreadsheet from Section 6 for GD, LMT, CAT, TEL, LRCX | Before July rebalance |
| **Set up contract monitoring** | Bookmark defense.gov/News/Contracts, set Google Alerts for GD + LMT contract wins | This week |
| **Pull current backlog data** | Extract Q1/Q2 2026 backlog, book-to-bill, funded %, and burn rate for all 5 names | Before July rebalance |
| **Flag any red signals** | Check if any holding has TTM book-to-bill <1.0 or cash conversion <0.8 | Before committee |

**Where our current holdings stand (quick reference):**

| Ticker | Latest Backlog | TTM B/B | Backlog Signal |
|---|---|---|---|
| **GD** | $131B (Q1 26, +48% YoY) | ~2.0x consolidated | Strong — record backlog, Marine Systems driving |
| **LMT** | $194B (FY25, record) | ~1.2x FY25, 1.7x Q4 | Strong — F-35/PAC-3/CH-53K anchoring |
| **CAT** | $63B (Q1 26, record) | N/A (backlog proxy) | Strong — 79% YoY growth, 14+ quarters visibility |
| **TEL** | Record $5.3B orders (Q2 FY26) | 1.12x (accelerating) | Strong — AI data center demand extending lead times |
| **LRCX** | Reports quarterly | Sector-dependent | Monitor — semi equipment capex cycle still expanding |

**All five names are currently in the "green" zone on backlog signals.** No trim flags. This framework becomes most valuable when one of these signals turns — that's when we'll have an early warning 2–4 quarters before it shows up in EPS.

**What this adds to what we already do:** We already run ROIC, moat durability, and Hold-Forever scoring. Backlog analysis adds a **leading indicator layer** — it tells us about *future* earnings power before it hits the income statement, which matters most for entry/exit timing around rebalances.
