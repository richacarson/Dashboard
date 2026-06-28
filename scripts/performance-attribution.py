#!/usr/bin/env python3
"""
Performance & Attribution — deterministic compute for Carson's stewardship record.

Runs in the Dashboard repo. Reads ONLY committed files (no secrets, no LLM math):
  - public/portfolio-history-{dividend,growth}.json  (sleeve value series + benchmark series + holdings + cost_basis)
  - public/risk-data-drop.json                       (current per-name prices, already produced daily)
Writes:
  - public/performance.json                          (exact numbers; the CoS narrates from this)

STEWARDSHIP WINDOW (Carson's record, NOT the strategy's full inception):
  - Carson began making decisions 2025-01-15. Dividend data covers it.
  - Growth launched 2025-07-29 (after that), so Growth = since-launch.
Each sleeve labels its own real start. No "since inception" overclaim.

METHODOLOGY (stated for defensibility):
  - Sleeve period return = endpoint ratio of the tracked portfolio `value` series.
  - Benchmark period return = endpoint ratio of the benchmark `close` series in the
    same file. NOTE: see the `methodology_caveats` block in the output — benchmark
    close may be price-only vs the portfolio's total value; flagged, not hidden.
  - Position contribution = current value (shares x current price) minus cost basis,
    i.e. UNREALIZED gain by current position SINCE PURCHASE. This is distinct from the
    since-stewardship sleeve return and is labeled as such.
"""

import json, os
from datetime import datetime, timedelta, timezone

PUB = "public"
STEWARDSHIP_START = "2025-01-15"   # Carson's first decision
PRIMARY_BM = {"dividend": "DVY", "growth": "IUSG"}
SLEEVES = ["dividend", "growth"]

def load(p):
    with open(p) as f: return json.load(f)

def series_value_on_or_after(series, date_str, key):
    for pt in series:
        if pt.get("date", "") >= date_str:
            return pt
    return None

def period_return(series, start_date, key):
    """Return % from first point >= start_date to the last point, using `key`."""
    if not series: return None
    start = series_value_on_or_after(series, start_date, key)
    end = series[-1]
    if not start or start.get(key) in (None, 0): return None
    try:
        return round((end[key] / start[key] - 1) * 100, 2)
    except Exception:
        return None

def period_starts(today):
    y = today.year
    return {
        "week": (today - timedelta(days=7)).isoformat(),
        "mtd":  today.replace(day=1).isoformat(),
        "qtd":  datetime(y, 3*((today.month-1)//3)+1, 1).date().isoformat(),
        "ytd":  f"{y}-01-01",
    }

def main():
    today = datetime.now(timezone.utc).date()
    starts = period_starts(today)

    # current per-name prices from the risk data drop (committed, no secrets)
    prices = {}
    try:
        rdd = load(f"{PUB}/risk-data-drop.json")
        for t, h in (rdd.get("holdings") or {}).items():
            if h.get("price") is not None:
                prices[t] = h["price"]
    except Exception as e:
        print(f"warn: risk-data-drop unavailable for contribution ({e})")

    out = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "stewardship_start": STEWARDSHIP_START,
        "stewardship_note": "Carson began making investment decisions 2025-01-15. Returns here are HIS stewardship record, not the strategy's full inception (which the Performance tab shows separately).",
        "sleeves": {},
        "methodology_caveats": [
            "Benchmark returns use the benchmark `close` series in portfolio-history. If that is price-only (not total return), active return is overstated vs dividend-paying benchmarks (DVY especially). Verify the series is adjusted/total-return before citing active return at IC.",
            "Position contribution = current value minus cost basis = UNREALIZED gain since purchase, NOT contribution measured over the since-stewardship window (per-name historical prices are not available in the committed data). Labeled accordingly.",
        ],
    }

    blended_val = 0.0
    blended_ret_num = 0.0

    for s in SLEEVES:
        try:
            d = load(f"{PUB}/portfolio-history-{s}.json")
        except Exception as e:
            out["sleeves"][s] = {"error": f"history unavailable: {e}"}
            continue

        port = d.get("portfolio") or []
        bms = d.get("benchmarks") or {}
        data_start = port[0]["date"] if port else None
        # stewardship start for this sleeve = later of Carson's start and the sleeve's data start
        steward = max(STEWARDSHIP_START, data_start) if data_start else STEWARDSHIP_START
        steward_label = ("since stewardship (2025-01-15)" if steward == STEWARDSHIP_START
                         else f"since launch ({steward})")

        # sleeve returns
        rets = {p: period_return(port, st, "value") for p, st in starts.items()}
        rets["since_stewardship"] = period_return(port, steward, "value")

        # benchmark returns + active return (primary benchmark + SPY)
        bm_block = {}
        for bm in [PRIMARY_BM.get(s), "SPY"]:
            if not bm or bm not in bms: continue
            br = {p: period_return(bms[bm], st, "close") for p, st in starts.items()}
            br["since_stewardship"] = period_return(bms[bm], steward, "close")
            active = {}
            for p in list(starts.keys()) + ["since_stewardship"]:
                if rets.get(p) is not None and br.get(p) is not None:
                    active[p] = round(rets[p] - br[p], 2)
            bm_block[bm] = {"returns": br, "active_return": active}

        # position contribution (unrealized vs cost basis, since purchase)
        holdings = d.get("holdings") or {}
        cb = d.get("cost_basis") or {}
        contribs = []
        sleeve_mkt = 0.0
        for t, shares in holdings.items():
            px = prices.get(t)
            if px is None: continue
            mkt = shares * px
            sleeve_mkt += mkt
            total_cost = (cb.get(t) or {}).get("total_cost")
            if total_cost is None: continue
            contribs.append({"ticker": t, "mkt_value": round(mkt, 2),
                             "cost_basis": round(total_cost, 2),
                             "unrealized_gain": round(mkt - total_cost, 2)})
        for c in contribs:
            c["pct_of_sleeve"] = round(c["mkt_value"] / sleeve_mkt * 100, 2) if sleeve_mkt else None
        contribs.sort(key=lambda c: c["unrealized_gain"], reverse=True)

        out["sleeves"][s] = {
            "stewardship_start": steward,
            "stewardship_label": steward_label,
            "data_start": data_start,
            "current_value": round(port[-1]["value"], 2) if port else None,
            "returns": rets,
            "benchmarks": bm_block,
            "top_contributors": contribs[:5],
            "bottom_contributors": contribs[-5:][::-1],
            "contribution_basis": "unrealized gain by current position since purchase",
        }

        # blended (value-weighted) since-stewardship
        if port and rets.get("since_stewardship") is not None:
            v = port[-1]["value"]; blended_val += v
            blended_ret_num += v * rets["since_stewardship"]

    out["combined"] = {
        "since_stewardship_return": round(blended_ret_num / blended_val, 2) if blended_val else None,
        "total_value": round(blended_val, 2) if blended_val else None,
        "basis": "value-weighted blend of sleeve since-stewardship returns",
    }

    # IC headline
    div = out["sleeves"].get("dividend", {})
    gro = out["sleeves"].get("growth", {})
    out["ic_summary"] = {
        "headline": f"Stewardship record since {STEWARDSHIP_START}: "
                    f"Dividend {fmt(div.get('returns',{}).get('since_stewardship'))} "
                    f"(vs DVY active {fmt(act(div,'DVY'))}), "
                    f"Growth {fmt(gro.get('returns',{}).get('since_stewardship'))} "
                    f"(vs IUSG active {fmt(act(gro,'IUSG'))}).",
    }

    os.makedirs(PUB, exist_ok=True)
    with open(f"{PUB}/performance.json", "w") as f:
        json.dump(out, f, indent=2)
    print("wrote public/performance.json")
    print(out["ic_summary"]["headline"])

def act(sleeve, bm):
    return (((sleeve.get("benchmarks") or {}).get(bm) or {}).get("active_return") or {}).get("since_stewardship")
def fmt(v):
    return "n/a" if v is None else (f"+{v}%" if v >= 0 else f"{v}%")

if __name__ == "__main__":
    main()
