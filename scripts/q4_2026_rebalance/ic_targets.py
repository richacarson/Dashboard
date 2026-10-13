"""
IC Proposal Q4 2026 Rebalance — Target Weights and Execution Prices
Rebalance executed mid-day 2026-10-13 (settles 2026-10-14).
Source: public/research/IC-Proposal-Q4-2026-Rebalance-2026-10-09.md
"""

REBALANCE_DATE_ISO = "2026-10-13"  # date the trades are booked

DIVIDEND_EXITS = ["PCAR", "NEE", "CHD"]
GROWTH_EXITS = ["MARA", "TOL"]

# Invested weights (fractions of the 99% invested portion).
DIVIDEND_TARGETS = {
    "AVGO": 0.0725,
    "SSNC": 0.06, "ADP": 0.06, "SPGI": 0.06, "CEG": 0.06, "TEL": 0.06,
    "WM": 0.0575,
    "SYK": 0.055,
    "QCOM": 0.05,
    "LMT": 0.04, "CL": 0.04, "GD": 0.04, "ORI": 0.04, "ABT": 0.04,
    "NWG": 0.035, "LRCX": 0.035, "ADI": 0.035, "CAT": 0.035, "YOU": 0.035,
    "GPC": 0.015, "STLD": 0.015, "NTR": 0.015, "FAST": 0.015, "DGX": 0.015, "ATO": 0.015,
}

GROWTH_TARGETS = {
    "NOW": 0.08,
    "NVDA": 0.065, "FCX": 0.065, "VST": 0.065,
    "HOOD": 0.055,
    "AEM": 0.05,
    "CRDO": 0.0425,
    "SOFI": 0.04, "MRVL": 0.04, "TSM": 0.04, "KEYS": 0.04, "NXPI": 0.04,
    "HRMY": 0.04, "ATAT": 0.04, "GNRC": 0.04, "VRT": 0.04,
    "YMM": 0.03, "AMD": 0.03,
    "FTNT": 0.0225, "HUT": 0.0225, "CVX": 0.0225, "CNX": 0.0225, "OKE": 0.0225,
    "PGY": 0.0225, "SYF": 0.0225,
}

CASH_TARGET = 0.01

# Real cash at the open of 10/13 (base + dividend-ledger credits), from the
# scheduled build at 2026-10-13 07:52 ET.
MORNINGSTAR_CASH = {
    "dividend": 9581.86,
    "growth":   1489.63,
}

# Actual fills from Carson's 10/13 order screenshots: ticker -> (side, price).
FILLS = {
    "dividend": {
        "LRCX": ("BUY", 297.18), "ABT": ("BUY", 102.90), "TEL": ("BUY", 215.89),
        "ORI": ("BUY", 38.2691), "CAT": ("BUY", 770.4999), "YOU": ("BUY", 43.6675),
        "WM": ("BUY", 212.4195), "AVGO": ("BUY", 357.8284),
        "NTR": ("SELL", 69.2420), "FAST": ("SELL", 51.2938), "ATO": ("SELL", 163.8001),
        "GPC": ("SELL", 130.0433), "DGX": ("SELL", 232.2351), "STLD": ("SELL", 240.1034),
        "PCAR": ("SELL", 107.4717), "NEE": ("SELL", 78.3116), "CHD": ("SELL", 99.8599),
    },
    "growth": {
        "FCX": ("SELL", 72.22), "SOFI": ("SELL", 15.195), "AEM": ("SELL", 186.56),
        "YMM": ("SELL", 8.7206), "NOW": ("SELL", 139.1101), "CVX": ("SELL", 217.945),
        "FTNT": ("SELL", 191.4601), "MARA": ("SELL", 9.1806), "TOL": ("SELL", 133.24),
        "PGY": ("BUY", 17.555), "HRMY": ("BUY", 37.02), "NXPI": ("BUY", 226.425),
        "ATAT": ("BUY", 32.6395), "CRDO": ("BUY", 197.19), "VRT": ("BUY", 237.2899),
        "GNRC": ("BUY", 212.8396),
    },
}

# Names not in the screenshots are brought to target at the price when the
# screenshot orders actually executed. Matching each fill to 5-minute bars puts
# 31 of the 33 inside the 14:35-14:40 ET bar (CHD filled by 14:30, YOU and NOW
# in the 14:40 bar), so each untraded name uses the midpoint of the open and
# close of its 14:35 bar. (First booked at 12:00 ET prices, which ran up to
# 1.6% stale against the fills after a mid-day rally.)
EXEC_PRICES = {
    "SSNC": 81.4075, "ADP": 275.8931, "SPGI": 412.355, "CEG": 297.9599, "SYK": 283.92, "QCOM": 177.6743,
    "LMT": 505.66, "CL": 89.975, "GD": 332.93, "NWG": 17.6599, "ADI": 413.96, "NVDA": 227.315,
    "VST": 162.5025, "HOOD": 110.9834, "MRVL": 266.6272, "TSM": 443.2925, "KEYS": 367.34, "AMD": 597.3886,
    "HUT": 84.28, "CNX": 35.325, "OKE": 92.865, "SYF": 73.4125,
}

NEW_COMPANY_NAMES = {
    "Broadcom Inc": "AVGO",
    "Waste Management Inc": "WM",
    "Clear Secure Inc": "YOU",
    "Vertiv Holdings Co": "VRT",
    "Generac Holdings Inc": "GNRC",
}


def _verify():
    for name, t in (("Dividend", DIVIDEND_TARGETS), ("Growth", GROWTH_TARGETS)):
        assert abs(sum(t.values()) - 1.0) < 1e-9, f"{name} targets sum to {sum(t.values())}"
        assert len(t) == 25, f"{name} has {len(t)} holdings"
    for sleeve, targets in (("dividend", DIVIDEND_TARGETS), ("growth", GROWTH_TARGETS)):
        exits = DIVIDEND_EXITS if sleeve == "dividend" else GROWTH_EXITS
        for t in list(targets) + exits:
            assert t in FILLS[sleeve] or t in EXEC_PRICES, f"no price for {t}"


_verify()
