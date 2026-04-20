# Q2 2026 Rebalance — Execution Report

**Mode:** EXECUTED
**Executed:** 2026-04-20 04:05 UTC
**Rebalance Date:** 04-17-26 @ 2:59 PM CT
**Pricing Source:** Yahoo Finance close for 2026-04-17
**IC Proposal:** [Research - IC Proposal Q2 2026 Rebalance](./Research%20-%20IC%20Proposal%20Q2%202026%20Rebalance.md)

---

## Dividend Sleeve

### Pre-rebalance state
- Last recorded cash inflow: **2026-03-13**
- App cash (replay): **$8,049.16**
- Holdings: **25**

### Phase 1.5 — Morningstar cash reconciliation
**Book entry only — not a real cash movement.** A one-time **DEPOSIT** of **$98.17** is recorded on 2026-04-17 to align the app's replayed cash with the actual Morningstar brokerage balance. This absorbs historical DRIP-vs-cash drift (the app treats DRIP as cash; Morningstar reinvested into shares) and any dividends paid in the gap period (already in Morningstar's current balance). Eric does not actually deposit or withdraw this amount.

### Phase 1 — Dividend gap fill
_Skipped — Morningstar reconciliation above already captures gap-period dividends._

### Phase 2 — Valuation (4/17/26 close)
- Stock value: **$593,765.09**
- Effective cash: **$8,147.33**
- **Total sleeve value: $601,912.42**

### Phase 3 — Rebalance trades
Generated **27** trades:

| Ticker | Action | Type | Shares | Price | Amount |
|---|---|---|---|---|---|
| BKH | ADD | PURCHASE | 0.3589 | $76.07 | $27.31 |
| CHD | ADD | PURCHASE | 118.8111 | $96.88 | $11,510.42 |
| CL | ADD | PURCHASE | 146.6600 | $85.81 | $12,584.90 |
| FAST | ADD | PURCHASE | 1.3412 | $45.78 | $61.40 |
| GD | ADD | PURCHASE | 6.8785 | $336.29 | $2,313.17 |
| GPC | ADD | PURCHASE | 45.9888 | $113.79 | $5,233.07 |
| STLD | ADD | PURCHASE | 74.2295 | $200.32 | $14,869.65 |
| VLO | ADD | PURCHASE | 35.6367 | $223.65 | $7,970.14 |
| A | EXIT | SALE | 172.0000 | $121.87 | $20,961.64 |
| MATX | EXIT | SALE | 147.6666 | $176.55 | $26,070.54 |
| CTRA | NEW | PURCHASE | 1157.4489 | $30.89 | $35,753.60 |
| NTR | NEW | PURCHASE | 590.6617 | $70.62 | $41,712.53 |
| ABT | TRIM | SALE | 27.3414 | $96.81 | $2,646.92 |
| ADI | TRIM | SALE | 36.6442 | $371.45 | $13,611.49 |
| ADP | TRIM | SALE | 13.9624 | $200.47 | $2,799.04 |
| ATO | TRIM | SALE | 7.4735 | $186.54 | $1,394.10 |
| CAT | TRIM | SALE | 7.0047 | $794.65 | $5,566.32 |
| DGX | TRIM | SALE | 35.3335 | $195.02 | $6,890.74 |
| LMT | TRIM | SALE | 8.6136 | $592.19 | $5,100.88 |
| LRCX | TRIM | SALE | 46.2109 | $267.60 | $12,366.05 |
| NEE | TRIM | SALE | 9.0652 | $91.98 | $833.82 |
| ORI | TRIM | SALE | 29.3728 | $42.56 | $1,250.11 |
| PCAR | TRIM | SALE | 45.4237 | $126.25 | $5,734.74 |
| QCOM | TRIM | SALE | 40.6407 | $136.20 | $5,535.27 |
| SSNC | TRIM | SALE | 63.4351 | $72.11 | $4,574.31 |
| SYK | TRIM | SALE | 12.9296 | $343.32 | $4,439.00 |
| TEL | TRIM | SALE | 41.1677 | $246.14 | $10,133.01 |

- Sale proceeds: **$129,907.98**
- Purchase outlay: **$132,036.19**
- Projected cash post-rebalance: **$6,019.12** (1.00% of sleeve)
- Cash target: **$6,019.12** (1.00%)

---

## Growth Sleeve

### Pre-rebalance state
- Last recorded cash inflow: **2026-03-25**
- App cash (replay): **$4,659.16**
- Holdings: **24**

### Phase 1.5 — Morningstar cash reconciliation
**Book entry only — not a real cash movement.** A one-time **WITHDRAWAL** of **$3,514.46** is recorded on 2026-04-17 to align the app's replayed cash with the actual Morningstar brokerage balance. This absorbs historical DRIP-vs-cash drift (the app treats DRIP as cash; Morningstar reinvested into shares) and any dividends paid in the gap period (already in Morningstar's current balance). Eric does not actually deposit or withdraw this amount.

### Phase 1 — Dividend gap fill
_Skipped — Morningstar reconciliation above already captures gap-period dividends._

### Phase 2 — Valuation (4/17/26 close)
- Stock value: **$113,861.19**
- Effective cash: **$1,144.70**
- **Total sleeve value: $115,005.89**

### Phase 3 — Rebalance trades
Generated **28** trades:

| Ticker | Action | Type | Shares | Price | Amount |
|---|---|---|---|---|---|
| AEM | ADD | PURCHASE | 9.0375 | $220.10 | $1,989.15 |
| CWAN | ADD | PURCHASE | 1.8940 | $24.11 | $45.66 |
| EIX | ADD | PURCHASE | 21.5562 | $70.75 | $1,525.10 |
| HRMY | ADD | PURCHASE | 27.8584 | $29.99 | $835.47 |
| NXPI | ADD | PURCHASE | 2.0815 | $216.03 | $449.66 |
| FINV | EXIT | SALE | 897.0000 | $4.80 | $4,305.60 |
| GFI | EXIT | SALE | 88.0000 | $49.96 | $4,396.48 |
| PDD | EXIT | SALE | 43.0000 | $104.79 | $4,505.97 |
| CRDO | NEW | PURCHASE | 28.3417 | $160.69 | $4,554.23 |
| FCX | NEW | PURCHASE | 97.2988 | $70.21 | $6,831.35 |
| MRVL | NEW | PURCHASE | 32.6024 | $139.69 | $4,554.23 |
| VST | NEW | PURCHASE | 41.7922 | $163.46 | $6,831.35 |
| AMD | TRIM | SALE | 1.6408 | $278.39 | $456.79 |
| ATAT | TRIM | SALE | 29.5904 | $37.78 | $1,117.93 |
| CNX | TRIM | SALE | 4.2283 | $38.67 | $163.51 |
| COIN | TRIM | SALE | 3.4456 | $206.33 | $710.93 |
| CVX | TRIM | SALE | 2.2474 | $183.99 | $413.50 |
| FTNT | TRIM | SALE | 4.3520 | $81.84 | $356.17 |
| HOOD | TRIM | SALE | 5.3617 | $90.75 | $486.58 |
| HUT | TRIM | SALE | 31.3969 | $74.90 | $2,351.63 |
| KEYS | TRIM | SALE | 7.3784 | $334.34 | $2,466.91 |
| MARA | TRIM | SALE | 135.5453 | $11.60 | $1,572.33 |
| NVDA | TRIM | SALE | 2.4185 | $201.68 | $487.77 |
| OKE | TRIM | SALE | 5.4648 | $83.51 | $456.37 |
| SUPV | TRIM | SALE | 56.1057 | $9.79 | $549.28 |
| SYF | TRIM | SALE | 15.3993 | $78.34 | $1,206.39 |
| TOL | TRIM | SALE | 6.7134 | $146.68 | $984.73 |
| TSM | TRIM | SALE | 1.7079 | $370.50 | $632.77 |

- Sale proceeds: **$27,621.64**
- Purchase outlay: **$27,616.20**
- Projected cash post-rebalance: **$1,150.14** (1.00% of sleeve)
- Cash target: **$1,150.06** (1.00%)

---
