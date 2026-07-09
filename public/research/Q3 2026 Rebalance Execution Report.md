# Q3 2026 Rebalance — Execution Report

**Mode:** EXECUTED
**Executed:** 2026-07-09 20:53 UTC
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
**Book entry only — not a real cash movement.** A one-time **WITHDRAWAL** of **$1,815.49** is recorded on 2026-07-09 to align the app's replayed cash with the actual Morningstar brokerage balance. This absorbs historical DRIP-vs-cash drift (the app treats DRIP as cash; Morningstar reinvested into shares) and any dividends paid in the gap period (already in Morningstar's current balance). Eric does not actually deposit or withdraw this amount.

### Phase 1 — Dividend gap fill
_Skipped — Morningstar reconciliation above already captures gap-period dividends._

### Phase 2 — Valuation (7/8/26 close)
- Stock value: **$625,037.14**
- Effective cash: **$8,147.33**
- **Total sleeve value: $633,184.47**

### Phase 3 — Rebalance trades
Generated **29** trades:

| Ticker | Action | Type | Shares | Price | Amount |
|---|---|---|---|---|---|
| ABT | ADD | PURCHASE | 12.9205 | $95.18 | $1,229.77 |
| ADI | ADD | PURCHASE | 8.4392 | $385.40 | $3,252.45 |
| ADP | ADD | PURCHASE | 81.9522 | $241.37 | $19,780.79 |
| LMT | ADD | PURCHASE | 17.1060 | $527.96 | $9,031.30 |
| LRCX | ADD | PURCHASE | 0.6587 | $333.15 | $219.44 |
| PCAR | ADD | PURCHASE | 11.4386 | $122.50 | $1,401.23 |
| QCOM | ADD | PURCHASE | 57.6437 | $186.56 | $10,754.00 |
| SSNC | ADD | PURCHASE | 367.3534 | $65.42 | $24,032.26 |
| SYK | ADD | PURCHASE | 63.0012 | $326.85 | $20,591.95 |
| TEL | ADD | PURCHASE | 66.9404 | $196.24 | $13,136.37 |
| BKH | EXIT | SALE | 316.3589 | $72.90 | $23,062.56 |
| DVN | EXIT | SALE | 810.2142 | $43.31 | $35,090.38 |
| MATX | EXIT | SALE | 0.3334 | $204.73 | $68.26 |
| VLO | EXIT | SALE | 160.6367 | $282.88 | $45,440.91 |
| CEG | NEW | PURCHASE | 153.8163 | $244.52 | $37,611.16 |
| NWG | NEW | PURCHASE | 1431.9877 | $17.51 | $25,074.10 |
| SPGI | NEW | PURCHASE | 87.3074 | $430.79 | $37,611.16 |
| ATO | TRIM | SALE | 40.0330 | $177.09 | $7,089.44 |
| CAT | TRIM | SALE | 10.1599 | $948.08 | $9,632.37 |
| CHD | TRIM | SALE | 109.0842 | $96.17 | $10,490.63 |
| CL | TRIM | SALE | 147.1619 | $93.04 | $13,691.94 |
| DGX | TRIM | SALE | 1.3463 | $208.21 | $280.30 |
| FAST | TRIM | SALE | 122.0071 | $46.51 | $5,674.55 |
| GD | TRIM | SALE | 12.2644 | $374.31 | $4,590.69 |
| GPC | TRIM | SALE | 9.9617 | $124.73 | $1,242.53 |
| NEE | TRIM | SALE | 45.8664 | $87.44 | $4,010.56 |
| NTR | TRIM | SALE | 215.0759 | $66.76 | $14,358.47 |
| ORI | TRIM | SALE | 111.4807 | $41.50 | $4,626.45 |
| STLD | TRIM | SALE | 98.6207 | $228.76 | $22,560.48 |

- Sale proceeds: **$201,910.52**
- Purchase outlay: **$203,725.98**
- Projected cash post-rebalance: **$6,331.87** (1.00% of sleeve)
- Cash target: **$6,331.84** (1.00%)

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
- Effective cash: **$1,150.14**
- **Total sleeve value: $128,815.18**

### Phase 3 — Rebalance trades
Generated **28** trades:

| Ticker | Action | Type | Shares | Price | Amount |
|---|---|---|---|---|---|
| AEM | ADD | PURCHASE | 12.9707 | $144.89 | $1,879.33 |
| ATAT | ADD | PURCHASE | 9.7215 | $31.84 | $309.53 |
| FCX | ADD | PURCHASE | 46.8622 | $57.50 | $2,694.58 |
| HOOD | ADD | PURCHASE | 24.1426 | $113.53 | $2,740.91 |
| KEYS | ADD | PURCHASE | 0.4480 | $317.24 | $142.13 |
| MARA | ADD | PURCHASE | 23.8324 | $12.02 | $286.47 |
| NVDA | ADD | PURCHASE | 18.0282 | $204.12 | $3,679.92 |
| SYF | ADD | PURCHASE | 3.1057 | $68.26 | $211.99 |
| TOL | ADD | PURCHASE | 2.9950 | $145.57 | $435.98 |
| VST | ADD | PURCHASE | 7.6305 | $154.82 | $1,181.35 |
| COIN | EXIT | SALE | 16.5544 | $159.36 | $2,638.11 |
| CWAN | EXIT | SALE | 188.8940 | $24.56 | $4,639.24 |
| SUPV | EXIT | SALE | 348.8943 | $9.56 | $3,335.43 |
| NOW | NEW | PURCHASE | 94.6573 | $107.78 | $10,202.16 |
| SOFI | NEW | PURCHASE | 467.5272 | $17.73 | $8,289.26 |
| YMM | NEW | PURCHASE | 594.5316 | $8.58 | $5,101.08 |
| AMD | TRIM | SALE | 8.9650 | $517.41 | $4,638.60 |
| CNX | TRIM | SALE | 21.6844 | $33.18 | $719.49 |
| CRDO | TRIM | SALE | 8.6228 | $258.69 | $2,230.63 |
| CVX | TRIM | SALE | 6.6349 | $175.97 | $1,167.54 |
| EIX | TRIM | SALE | 53.9221 | $74.78 | $4,032.30 |
| FTNT | TRIM | SALE | 31.2347 | $156.71 | $4,894.79 |
| HRMY | TRIM | SALE | 51.3907 | $38.08 | $1,956.96 |
| HUT | TRIM | SALE | 9.5480 | $106.11 | $1,013.13 |
| MRVL | TRIM | SALE | 10.5875 | $231.71 | $2,453.22 |
| NXPI | TRIM | SALE | 5.3546 | $283.81 | $1,519.69 |
| OKE | TRIM | SALE | 19.5618 | $91.16 | $1,783.25 |
| TSM | TRIM | SALE | 0.6186 | $436.98 | $270.32 |

- Sale proceeds: **$37,292.70**
- Purchase outlay: **$37,154.69**
- Projected cash post-rebalance: **$1,288.15** (1.00% of sleeve)
- Cash target: **$1,288.15** (1.00%)

---
