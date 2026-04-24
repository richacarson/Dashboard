"""
IC Proposal Q2 2026 Rebalance — Target Weights
Source: public/research/Research - IC Proposal Q2 2026 Rebalance.md
"""

REBALANCE_DATE = "04-17-26"  # MM-DD-YY format matching Morningstar

# Exits (for reference; script computes automatically from targets)
DIVIDEND_EXITS = ["MATX", "A"]
GROWTH_EXITS = ["GFI", "FINV", "PDD"]

# Target weights (as decimal fractions of total sleeve value)
# These are the "invested" weights; add 1% cash reserve on top = 99% invested + 1% cash
DIVIDEND_TARGETS = {
    # Industrials (18%)
    "CAT":  0.04, "FAST": 0.04, "GD":   0.04, "LMT":  0.03, "PCAR": 0.03,
    # Technology (15%)
    "ADI":  0.025, "ADP":  0.025, "LRCX": 0.025, "QCOM": 0.025, "SSNC": 0.025, "TEL":  0.025,
    # Materials (14%)
    "STLD": 0.07, "NTR":  0.07,
    # Consumer Staples (12%)
    "CHD":  0.06, "CL":   0.06,
    # Utilities (12%)
    "ATO":  0.04, "BKH":  0.04, "NEE":  0.04,
    # Energy (12%)
    "CTRA": 0.06, "VLO":  0.06,
    # Healthcare (9%)
    "ABT":  0.03, "DGX":  0.03, "SYK":  0.03,
    # Consumer Discretionary (4%)
    "GPC":  0.04,
    # Financial Services (4%)
    "ORI":  0.04,
}

GROWTH_TARGETS = {
    # Technology (36%)
    "AMD":  0.04, "CRDO": 0.04, "CWAN": 0.04, "FTNT": 0.04, "KEYS": 0.04,
    "MRVL": 0.04, "NVDA": 0.04, "NXPI": 0.04, "TSM":  0.04,
    # Financials (18%)
    "COIN": 0.03, "HOOD": 0.03, "HUT":  0.03, "MARA": 0.03, "SYF":  0.03, "SUPV": 0.03,
    # Energy (12%)
    "CNX":  0.04, "CVX":  0.04, "OKE":  0.04,
    # Materials (12%)
    "AEM":  0.06, "FCX":  0.06,
    # Utilities (12%)
    "EIX":  0.06, "VST":  0.06,
    # Consumer Discretionary (6%)
    "ATAT": 0.03, "TOL":  0.03,
    # Healthcare (4%)
    "HRMY": 0.04,
}

# Target cash reserve as fraction of total sleeve value (1%)
CASH_TARGET = 0.01

# Morningstar "ground truth" cash balances as of 4/17/26 snapshot.
# These supersede the replayed cash values so the rebalance matches what
# Eric sees in the brokerage. The delta is recorded as a one-time
# WITHDRAWAL labeled "DRIP reconciliation" on 4/17/26.
MORNINGSTAR_CASH = {
    "dividend": 8147.33,
    "growth":   1144.70,
}

# Company name mapping for NEW additions (needed for Growth "By Activity" format)
# These must be added so the build-portfolio-history.py parser can resolve them
NEW_COMPANY_NAMES = {
    # Dividend additions (By Security format uses ticker headers — still add for completeness)
    "Nutrien Ltd": "NTR",
    "Coterra Energy Inc": "CTRA",
    # Growth additions (By Activity format requires this mapping)
    "Freeport-McMoRan Inc": "FCX",
    "Credo Technology Group Holding Ltd": "CRDO",
    "Vistra Corp": "VST",
    "Marvell Technology Inc": "MRVL",
}

# Verify targets sum to 100% (IC Proposal weights). Cash target (1%) is layered on top:
# position_$ = total_sleeve_$ × (1 - CASH_TARGET) × position_weight
def _verify():
    div_sum = sum(DIVIDEND_TARGETS.values())
    grw_sum = sum(GROWTH_TARGETS.values())
    assert abs(div_sum - 1.0) < 0.001, f"Dividend targets sum to {div_sum:.4f}, expected 1.0"
    assert abs(grw_sum - 1.0) < 0.001, f"Growth targets sum to {grw_sum:.4f}, expected 1.0"
    assert len(DIVIDEND_TARGETS) == 25, f"Dividend has {len(DIVIDEND_TARGETS)} holdings, expected 25"
    assert len(GROWTH_TARGETS) == 25, f"Growth has {len(GROWTH_TARGETS)} holdings, expected 25"

_verify()
