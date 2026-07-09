# Q3 2026 Rebalance — Execution Report

**Mode:** EXECUTED
**Executed:** 2026-07-09 21:26 UTC
**Rebalance Date:** 07-09-26 (rebalance executed AM)
**Pricing Source:** Yahoo Finance close for 2026-07-08 (trades booked 2026-07-09)
**IC Proposal:** [IC Proposal Q3 2026 (Carson target sheet)](./Research%20-%20IC%20Proposal%20Q2%202026%20Rebalance.md)

---

## Dividend Sleeve

### Pre-rebalance state
- Last recorded cash inflow: **2026-04-17**
- App cash (replay): **$8,147.33**
- Holdings: **26**

### Phase 1.5 — Morningstar cash reconciliation
**Book entry only — not a real cash movement.** A one-time **WITHDRAWAL** of **$5,388.76** is recorded on 2026-07-09 to align the app's replayed cash with the actual Morningstar brokerage balance. This absorbs historical DRIP-vs-cash drift (the app treats DRIP as cash; Morningstar reinvested into shares) and any dividends paid in the gap period (already in Morningstar's current balance). Eric does not actually deposit or withdraw this amount.

### Phase 1 — Dividend gap fill
_Skipped — Morningstar reconciliation above already captures gap-period dividends._

### Phase 2 — Valuation (7/8/26 close)
- Stock value: **$625,037.14**
- Effective cash: **$11,756.70**
- **Total sleeve value: $636,793.84**

### Phase 3 — Rebalance trades
Generated **29** trades:

| Ticker | Action | Type | Shares | Price | Amount |
|---|---|---|---|---|---|
| ABT | ADD | PURCHASE | 14.0468 | $95.18 | $1,336.97 |
| ADI | ADD | PURCHASE | 8.7173 | $385.40 | $3,359.65 |
| ADP | ADD | PURCHASE | 82.8404 | $241.37 | $19,995.19 |
| LMT | ADD | PURCHASE | 17.3768 | $527.96 | $9,174.23 |
| LRCX | ADD | PURCHASE | 0.9805 | $333.15 | $326.64 |
| PCAR | ADD | PURCHASE | 12.3137 | $122.50 | $1,508.43 |
| QCOM | ADD | PURCHASE | 58.6013 | $186.56 | $10,932.66 |
| SSNC | ADD | PURCHASE | 370.6307 | $65.42 | $24,246.66 |
| SYK | ADD | PURCHASE | 63.6572 | $326.85 | $20,806.34 |
| TEL | ADD | PURCHASE | 67.6687 | $196.24 | $13,279.31 |
| BKH | EXIT | SALE | 316.3589 | $72.90 | $23,062.56 |
| DVN | EXIT | SALE | 810.2142 | $43.31 | $35,090.38 |
| MATX | EXIT | SALE | 0.3334 | $204.73 | $68.26 |
| VLO | EXIT | SALE | 160.6367 | $282.88 | $45,440.91 |
| CEG | NEW | PURCHASE | 154.6931 | $244.52 | $37,825.55 |
| NWG | NEW | PURCHASE | 1440.1505 | $17.51 | $25,217.04 |
| SPGI | NEW | PURCHASE | 87.8051 | $430.79 | $37,825.55 |
| ATO | TRIM | SALE | 39.5285 | $177.09 | $7,000.11 |
| CAT | TRIM | SALE | 10.0468 | $948.08 | $9,525.17 |
| CHD | TRIM | SALE | 107.5980 | $96.17 | $10,347.70 |
| CL | TRIM | SALE | 145.6256 | $93.04 | $13,549.01 |
| DGX | TRIM | SALE | 0.8314 | $208.21 | $173.10 |
| FAST | TRIM | SALE | 119.7023 | $46.51 | $5,567.35 |
| GD | TRIM | SALE | 11.9303 | $374.31 | $4,465.62 |
| GPC | TRIM | SALE | 8.8158 | $124.73 | $1,099.60 |
| NEE | TRIM | SALE | 44.6405 | $87.44 | $3,903.36 |
| NTR | TRIM | SALE | 212.9350 | $66.76 | $14,215.54 |
| ORI | TRIM | SALE | 108.8976 | $41.50 | $4,519.25 |
| STLD | TRIM | SALE | 97.9959 | $228.76 | $22,417.54 |

- Sale proceeds: **$200,445.46**
- Purchase outlay: **$205,834.22**
- Projected cash post-rebalance: **$6,367.94** (1.00% of sleeve)
- Cash target: **$6,367.94** (1.00%)

---

## Growth Sleeve

### Pre-rebalance state
- Last recorded cash inflow: **2026-03-25**
- App cash (replay): **$1,150.14**
- Holdings: **25**

### Phase 1 — Dividend gap fill
_No dividends found in gap period._

### Phase 2 — Valuation (7/8/26 close)
- Stock value: **$127,665.04**
- Effective cash: **$1,828.93**
- **Total sleeve value: $129,493.97**

### Phase 3 — Rebalance trades
Generated **28** trades:

| Ticker | Action | Type | Shares | Price | Amount |
|---|---|---|---|---|---|
| AEM | ADD | PURCHASE | 13.2026 | $144.89 | $1,912.93 |
| ATAT | ADD | PURCHASE | 10.2492 | $31.84 | $326.33 |
| FCX | ADD | PURCHASE | 47.6218 | $57.50 | $2,738.26 |
| HOOD | ADD | PURCHASE | 24.4682 | $113.53 | $2,777.87 |
| KEYS | ADD | PURCHASE | 0.5222 | $317.24 | $165.65 |
| MARA | ADD | PURCHASE | 25.5096 | $12.02 | $306.63 |
| NVDA | ADD | PURCHASE | 18.2422 | $204.12 | $3,723.60 |
| SYF | ADD | PURCHASE | 3.3518 | $68.26 | $228.79 |
| TOL | ADD | PURCHASE | 3.1335 | $145.57 | $456.14 |
| VST | ADD | PURCHASE | 7.8909 | $154.82 | $1,221.67 |
| COIN | EXIT | SALE | 16.5544 | $159.36 | $2,638.11 |
| CWAN | EXIT | SALE | 188.8940 | $24.56 | $4,639.24 |
| SUPV | EXIT | SALE | 348.8943 | $9.56 | $3,335.43 |
| NOW | NEW | PURCHASE | 95.1561 | $107.78 | $10,255.92 |
| SOFI | NEW | PURCHASE | 469.9908 | $17.73 | $8,332.94 |
| YMM | NEW | PURCHASE | 597.6645 | $8.58 | $5,127.96 |
| AMD | TRIM | SALE | 8.9261 | $517.41 | $4,618.44 |
| CNX | TRIM | SALE | 21.1781 | $33.18 | $702.69 |
| CRDO | TRIM | SALE | 8.5189 | $258.69 | $2,203.75 |
| CVX | TRIM | SALE | 6.5394 | $175.97 | $1,150.74 |
| EIX | TRIM | SALE | 53.6975 | $74.78 | $4,015.50 |
| FTNT | TRIM | SALE | 31.1060 | $156.71 | $4,874.63 |
| HRMY | TRIM | SALE | 50.8613 | $38.08 | $1,936.80 |
| HUT | TRIM | SALE | 9.3580 | $106.11 | $992.97 |
| MRVL | TRIM | SALE | 10.4715 | $231.71 | $2,426.34 |
| NXPI | TRIM | SALE | 5.2717 | $283.81 | $1,496.17 |
| OKE | TRIM | SALE | 19.3775 | $91.16 | $1,766.45 |
| TSM | TRIM | SALE | 0.5571 | $436.98 | $243.44 |

- Sale proceeds: **$37,040.70**
- Purchase outlay: **$37,574.69**
- Projected cash post-rebalance: **$1,294.94** (1.00% of sleeve)
- Cash target: **$1,294.94** (1.00%)

---
