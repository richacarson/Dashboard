"""
IC Proposal Q3 2026 Rebalance — Target Weights
Rebalance executed the morning of 2026-07-09.
Source: Carson's Q3 target-weight sheet (Dividend + Growth).
"""

REBALANCE_DATE = "07-09-26"  # MM-DD-YY format matching Morningstar

# Exits (for reference; script computes exits automatically from targets —
# any current holding not in the target map is fully sold, incl. fractional dust
# like MATX).
DIVIDEND_EXITS = ["BKH", "DVN", "VLO", "MATX"]
GROWTH_EXITS = ["CWAN", "SUPV", "COIN"]

# Target weights (decimal fractions of total sleeve value; the "invested" weights).
# 1% cash reserve is layered on top: position_$ = total_$ × (1 - CASH_TARGET) × weight.
DIVIDEND_TARGETS = {
    "SYK": 0.06, "SSNC": 0.06, "ADP": 0.06, "SPGI": 0.06, "CEG": 0.06,
    "QCOM": 0.05,
    "GPC": 0.04, "STLD": 0.04, "NTR": 0.04, "LMT": 0.04, "TEL": 0.04,
    "CHD": 0.04, "CL": 0.04, "NWG": 0.04,
    "GD": 0.035,
    "NEE": 0.03, "LRCX": 0.03, "FAST": 0.03, "PCAR": 0.03, "ADI": 0.03,
    "CAT": 0.03, "ORI": 0.03, "ABT": 0.03, "DGX": 0.03,
    "ATO": 0.025,
}

GROWTH_TARGETS = {
    "NOW": 0.08,
    "NVDA": 0.065, "SOFI": 0.065, "FCX": 0.065,
    "VST": 0.06,
    "HOOD": 0.055,
    "AEM": 0.05,
    "MRVL": 0.04, "TSM": 0.04, "CRDO": 0.04, "YMM": 0.04,
    "KEYS": 0.035, "NXPI": 0.035,
    "AMD": 0.03, "FTNT": 0.03, "HRMY": 0.03, "TOL": 0.03, "HUT": 0.03, "MARA": 0.03,
    "CVX": 0.025, "ATAT": 0.025, "CNX": 0.025, "OKE": 0.025, "EIX": 0.025, "SYF": 0.025,
}

# Target cash reserve as fraction of total sleeve value (1%).
CASH_TARGET = 0.01

# Ground-truth cash balances used as the starting cash (supersedes replay).
# These are the REAL 7/9-morning cash balances (base cash + dividend credits
# accrued through 7/9), taken from the scheduled build that ran 7/9 05:16 ET —
# i.e. "what it was when the rebalance took place". Using the full real cash
# (not just the base) makes the deployment leg withdraw enough that, once the
# builder re-adds the dividend credits, both sleeves land at exactly 1%.
MORNINGSTAR_CASH = {
    "dividend": 11756.70,
    "growth":   1828.93,
}

# Company-name mapping for NEW additions (required so the "By Activity" growth
# parser can resolve them; harmless for the "By Security" dividend file).
NEW_COMPANY_NAMES = {
    # Dividend additions
    "S&P Global Inc": "SPGI",
    "Constellation Energy Corp": "CEG",
    "NatWest Group plc": "NWG",
    # Growth additions
    "ServiceNow Inc": "NOW",
    "SoFi Technologies Inc": "SOFI",
    "Full Truck Alliance Co Ltd": "YMM",
}


def _verify():
    div_sum = sum(DIVIDEND_TARGETS.values())
    grw_sum = sum(GROWTH_TARGETS.values())
    assert abs(div_sum - 1.0) < 0.001, f"Dividend targets sum to {div_sum:.4f}, expected 1.0"
    assert abs(grw_sum - 1.0) < 0.001, f"Growth targets sum to {grw_sum:.4f}, expected 1.0"
    assert len(DIVIDEND_TARGETS) == 25, f"Dividend has {len(DIVIDEND_TARGETS)} holdings, expected 25"
    assert len(GROWTH_TARGETS) == 25, f"Growth has {len(GROWTH_TARGETS)} holdings, expected 25"


_verify()
