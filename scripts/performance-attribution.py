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

import json, os, math, time, bisect, statistics
import urllib.request, urllib.error
from datetime import datetime, timedelta, timezone

PUB = "public"
STEWARDSHIP_START = "2025-01-15"   # Carson's first decision
PRIMARY_BM = {"dividend": "DVY", "growth": "IUSG"}
SLEEVES = ["dividend", "growth"]
RISK_FREE_ANNUAL = 0.043           # ~3-month T-bill, for Sharpe/Sortino excess return
TRADING_DAYS = 252

def load(p):
    with open(p) as f: return json.load(f)

# ---------------------------------------------------------------- risk metrics
def _daily_rets(vals):
    return [vals[i] / vals[i - 1] - 1 for i in range(1, len(vals)) if vals[i - 1]]

def _monthly_rets(pairs):
    """pairs = [(date, value)] ascending -> month-over-month returns (last value per month)."""
    bym = {}
    for d, v in pairs:
        if v: bym[d[:7]] = v   # ascending, so last day of month wins
    keys = sorted(bym); vals = [bym[k] for k in keys]
    return [vals[i] / vals[i - 1] - 1 for i in range(1, len(vals)) if vals[i - 1]]

def risk_metrics(port, bm_series, steward):
    """Risk-adjusted + consistency metrics from the since-stewardship daily value
    series vs the (total-return) primary benchmark."""
    p = [(x["date"], x["value"]) for x in port if x.get("date", "") >= steward and x.get("value")]
    if len(p) < 20:
        return None
    pv = [v for _, v in p]
    bm_sorted = sorted(((x["date"], x["close"]) for x in (bm_series or []) if x.get("close")), key=lambda z: z[0])
    bm_dates = [d for d, _ in bm_sorted]; bm_vals = [v for _, v in bm_sorted]
    def bm_on(date):
        i = bisect.bisect_right(bm_dates, date) - 1
        return bm_vals[i] if i >= 0 else None
    bv = [bm_on(d) for d, _ in p]

    # drawdown (running peak; final peak == max so current dd is vs all-time high)
    peak = pv[0]; maxdd = 0.0
    for v in pv:
        peak = max(peak, v); maxdd = min(maxdd, v / peak - 1)
    cur_dd = pv[-1] / max(pv) - 1

    rp = _daily_rets(pv)
    years = len(rp) / TRADING_DAYS if rp else 0
    ann_vol = statistics.pstdev(rp) * math.sqrt(TRADING_DAYS) if len(rp) > 1 else None
    cagr = (pv[-1] / pv[0]) ** (1 / years) - 1 if years > 0 and pv[0] > 0 else None
    sharpe = (cagr - RISK_FREE_ANNUAL) / ann_vol if (ann_vol and cagr is not None) else None
    downs = [r for r in rp if r < 0]
    dvol = statistics.pstdev(downs) * math.sqrt(TRADING_DAYS) if len(downs) > 1 else None
    sortino = (cagr - RISK_FREE_ANNUAL) / dvol if (dvol and cagr is not None) else None

    # vs benchmark (aligned daily)
    rb_full = [bv[i] / bv[i - 1] - 1 if (bv[i - 1] and bv[i]) else 0 for i in range(1, len(bv))]
    m = min(len(rp), len(rb_full)); rp2, rb2 = rp[:m], rb_full[:m]
    active = [rp2[i] - rb2[i] for i in range(m)]
    te = statistics.pstdev(active) * math.sqrt(TRADING_DAYS) if m > 1 else None
    bm_cagr = (bv[-1] / bv[0]) ** (1 / years) - 1 if (years > 0 and bv and bv[0]) else None
    info_ratio = ((cagr - bm_cagr) / te) if (te and cagr is not None and bm_cagr is not None) else None
    try:
        beta = statistics.covariance(rp2, rb2) / statistics.variance(rb2) if m > 2 else None
        corr = statistics.correlation(rp2, rb2) if m > 2 else None
    except Exception:
        beta = corr = None
    up_p = up_b = dn_p = dn_b = 1.0; nu = nd = 0
    for i in range(m):
        if rb2[i] > 0: up_p *= (1 + rp2[i]); up_b *= (1 + rb2[i]); nu += 1
        elif rb2[i] < 0: dn_p *= (1 + rp2[i]); dn_b *= (1 + rb2[i]); nd += 1
    up_cap = ((up_p - 1) / (up_b - 1) * 100) if (nu and up_b != 1) else None
    dn_cap = ((dn_p - 1) / (dn_b - 1) * 100) if (nd and dn_b != 1) else None

    pm = _monthly_rets(p)
    bmm = _monthly_rets([(d, bm_on(d)) for d, _ in p])
    mm = min(len(pm), len(bmm))
    batting = round(sum(1 for i in range(mm) if pm[i] > bmm[i]) / mm * 100, 1) if mm else None

    rnd = lambda v, n=2: round(v, n) if isinstance(v, (int, float)) else None
    return {
        "max_drawdown": rnd(maxdd * 100), "current_drawdown": rnd(cur_dd * 100),
        "annualized_volatility": rnd(ann_vol * 100) if ann_vol else None,
        "annualized_return": rnd(cagr * 100) if cagr is not None else None,
        "sharpe": rnd(sharpe), "sortino": rnd(sortino),
        "information_ratio": rnd(info_ratio), "tracking_error": rnd(te * 100) if te else None,
        "beta": rnd(beta), "correlation": rnd(corr),
        "up_capture": rnd(up_cap), "down_capture": rnd(dn_cap),
        "batting_average": batting,
        "best_month": rnd(max(pm) * 100) if pm else None,
        "worst_month": rnd(min(pm) * 100) if pm else None,
        "months": mm, "risk_free_annual": RISK_FREE_ANNUAL * 100,
    }

# ---------------------------------------------------------------- income / dividends
def fetch_div_history(ticker):
    """Yahoo events=div over ~2.5y -> sorted [(ex_date, dps)]. Keyless."""
    p2 = int(datetime.now(timezone.utc).timestamp()) + 86400
    p1 = p2 - int(2.6 * 365 * 86400)
    url = (f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
           f"?period1={p1}&period2={p2}&interval=1d&events=div")
    for _ in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=20) as r:
                data = json.loads(r.read())
            ev = ((data.get("chart", {}).get("result") or [{}])[0].get("events", {}) or {}).get("dividends", {}) or {}
            out = []
            for _, v in ev.items():
                ts, amt = v.get("date"), v.get("amount")
                if ts is not None and amt:
                    out.append((datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d"), float(amt)))
            return sorted(out)
        except urllib.error.HTTPError as e:
            if e.code == 429: time.sleep(1.2); continue
            return []
        except Exception:
            time.sleep(0.6)
    return []

def income_metrics(holdings, cb, prices, today):
    """Forward income, yield-on-cost, current yield, dividend growth, received YTD/QTD."""
    ytd0 = f"{today.year}-01-01"
    qtr0 = datetime(today.year, 3 * ((today.month - 1) // 3) + 1, 1).date().isoformat()
    d365 = (today - timedelta(days=365)).isoformat()
    d730 = (today - timedelta(days=730)).isoformat()
    ttm_inc = prior_inc = cost = mktval = recv_ytd = recv_qtr = 0.0
    payers = 0
    for t, shares in (holdings or {}).items():
        if not shares or shares <= 0: continue
        divs = fetch_div_history(t)
        if not divs: continue
        ttm = sum(a for dt, a in divs if d365 <= dt <= today.isoformat())
        prior = sum(a for dt, a in divs if d730 <= dt < d365)
        if ttm <= 0: continue
        payers += 1
        ttm_inc += shares * ttm
        prior_inc += shares * prior
        c = (cb.get(t) or {}).get("total_cost")
        if c: cost += c
        px = prices.get(t)
        if px: mktval += shares * px
        recv_ytd += shares * sum(a for dt, a in divs if ytd0 <= dt <= today.isoformat())
        recv_qtr += shares * sum(a for dt, a in divs if qtr0 <= dt <= today.isoformat())
    if payers == 0:
        return None
    rnd = lambda v: round(v, 2) if isinstance(v, (int, float)) else None
    return {
        "projected_annual_income": rnd(ttm_inc),
        "yield_on_cost": rnd(ttm_inc / cost * 100) if cost else None,
        "current_yield": rnd(ttm_inc / mktval * 100) if mktval else None,
        "dividend_growth_yoy": rnd((ttm_inc / prior_inc - 1) * 100) if prior_inc else None,
        "received_ytd": rnd(recv_ytd), "received_qtr": rnd(recv_qtr),
        "paying_positions": payers,
        "basis": "trailing-12mo dividends per share (Yahoo) x current shares; received uses current shares",
    }

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
            "Active return is computed on a MATCHED total-return basis (bm_basis = 'total_return'): the portfolio value series already reflects dividends (booked as cash deposits and reinvested via purchases in the Morningstar export), and the benchmark uses the split + dividend adjusted `benchmarks_tr` series. Both sides include dividends, so active return is like-for-like. (Benchmark TR is reconstructed from adjusted close and can differ from official NAV total return by ~1-2pt in heavy-distribution years.)",
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
        # The portfolio value series is already total return: in the Morningstar "By
        # Security" export, dividends are booked as cash DEPOSITs and reinvested via
        # PURCHASEs, so received-and-reinvested income is captured in `value`. To compare
        # like-for-like we use the total-return benchmark series (`benchmarks_tr`,
        # split + dividend adjusted). Falls back to price-only if TR is absent.
        bms = d.get("benchmarks_tr") or d.get("benchmarks") or {}
        bm_basis = "total_return" if d.get("benchmarks_tr") else "price_only"
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

        # risk-adjusted + consistency, computed vs BOTH the primary TR benchmark and SPY
        prim = PRIMARY_BM.get(s)
        rm = {}
        for bmk in [prim, "SPY"]:
            if bmk and bms.get(bmk):
                r = risk_metrics(port, bms[bmk], steward)
                if r: rm[bmk] = r
        rm = rm or None
        # income / dividends (Yahoo TTM dividends x current shares)
        print(f"  {s}: computing income from dividends…")
        inc = income_metrics(holdings, cb, prices, today)

        out["sleeves"][s] = {
            "stewardship_start": steward,
            "stewardship_label": steward_label,
            "data_start": data_start,
            "current_value": round(port[-1]["value"], 2) if port else None,
            "returns": rets,
            "bm_basis": bm_basis,
            "benchmarks": bm_block,
            "risk_metrics": rm,
            "income": inc,
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
