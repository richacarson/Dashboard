#!/usr/bin/env python3
"""
Portfolio-blended fundamentals + S&P 500 valuation history.

For each sleeve, blend its holdings' per-quarter fundamentals (from
public/fundamentals/<ticker>.json) by current market weight into a portfolio
time series: blended P/E, P/S, P/FCF (weighted harmonic means), and gross /
operating / net margins and revenue / EPS YoY growth (weighted means).

Also pulls the S&P 500 monthly P/E and P/S history from multpl.com so the UI
can overlay the market's multiple on the portfolio's — the benchmark
comparison (index ETFs have no EDGAR statements of their own).

Writes public/portfolio-fundamentals-<sleeve>.json and
public/benchmark-fundamentals.json.
"""
import json, re, time, urllib.request
from datetime import datetime, timezone, date
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
PUB = REPO / "public"
FUND = PUB / "fundamentals"
SLEEVES = ["dividend", "growth", "fci100", "fciValues"]
UA = {"User-Agent": "Mozilla/5.0"}


# ─────────────────────────── S&P 500 (multpl) ───────────────────────────
def multpl(slug):
    """Monthly [{'m': 'YYYY-MM', 'v': float}] from a multpl.com table page."""
    try:
        html = urllib.request.urlopen(
            urllib.request.Request(f"https://www.multpl.com/{slug}/table/by-month", headers=UA), timeout=30
        ).read().decode("utf-8", "ignore")
    except Exception as e:
        print("  multpl fail", slug, e)
        return []
    m = re.search(r'<table id="datatable".*?</table>', html, re.S)
    if not m:
        return []
    out = []
    def clean(s):  # drop tags AND html entities (e.g. &#x2002; en-space, whose "2002" would parse as a value)
        return re.sub(r"&[#\w]+;", " ", re.sub(r"<[^>]+>", "", s))
    for dcell, vcell in re.findall(r"<tr[^>]*>\s*<td[^>]*>(.*?)</td>\s*<td[^>]*>(.*?)</td>", m.group(0), re.S):
        ds = clean(dcell).strip()
        vm = re.search(r"-?\d+\.?\d*", clean(vcell))
        if not vm:
            continue
        try:
            dt = datetime.strptime(ds, "%b %d, %Y")
        except Exception:
            continue
        out.append({"m": dt.strftime("%Y-%m"), "v": float(vm.group(0))})
    out.sort(key=lambda r: r["m"])
    # de-dup by month (keep last)
    seen = {}
    for r in out:
        seen[r["m"]] = r["v"]
    return [{"m": k, "v": v} for k, v in sorted(seen.items())]


# ─────────────────────────── blending ───────────────────────────
def cq(iso):
    """Map a fiscal quarter-end to its calendar-quarter key YYYY-MM (03/06/09/12)."""
    y, mo = int(iso[:4]), int(iso[5:7])
    qm = min(12, ((mo - 1) // 3 + 1) * 3)
    return f"{y}-{qm:02d}"


def load_holdings(sleeve):
    p = PUB / f"portfolio-history-{sleeve}.json"
    if not p.exists():
        return {}
    return json.load(open(p)).get("holdings") or {}


def w_harmonic(pairs):
    """Weighted harmonic mean of positive multiples: Σw / Σ(w/x)."""
    num = sum(w for w, x in pairs)
    den = sum(w / x for w, x in pairs if x and x > 0)
    return (num / den) if den else None


def w_mean(pairs):
    num = sum(w * x for w, x in pairs)
    den = sum(w for w, x in pairs)
    return (num / den) if den else None


def build_sleeve(sleeve):
    holdings = load_holdings(sleeve)
    funds, weight = {}, {}
    for t, sh in holdings.items():
        fp = FUND / f"{t}.json"
        if not fp.exists() or not sh:
            continue
        d = json.load(open(fp))
        px = (d.get("price") or [{}])[-1].get("c")
        if not px:
            continue
        funds[t] = d
        weight[t] = sh * px  # market value
    if not funds:
        return None
    tw = sum(weight.values())
    for t in weight:
        weight[t] /= tw
    covered_w = 1.0
    coverage = round(len(funds) / len(holdings), 3) if holdings else None  # fraction of names covered

    # per-holding calendar-quarter maps
    perq = {}   # t -> {cqkey: {pe,ps,pfcf,gm,om,nm,rev,eps}}
    for t, d in funds.items():
        mp = {}
        for a in d.get("quarterly", []):
            mp[cq(a["date"])] = a
        perq[t] = mp

    all_cq = sorted({k for mp in perq.values() for k in mp})
    series = []
    for k in all_cq:
        pe_p, ps_p, pf_p, gm_p, om_p, nm_p = [], [], [], [], [], []
        rg_p, eg_p = [], []
        # YoY: same-quarter last year key
        y, mo = int(k[:4]), int(k[5:7])
        prev = f"{y-1}-{mo:02d}"
        for t, mp in perq.items():
            a = mp.get(k)
            if not a:
                continue
            w = weight[t]
            # clamp individual multiples into a sane band so one extreme name
            # can't dominate the harmonic mean (a P/S of ~0 would collapse it)
            if a.get("pe") and a["pe"] > 0:
                pe_p.append((w, min(80.0, max(5.0, a["pe"]))))
            if a.get("ps") and a["ps"] > 0:
                ps_p.append((w, min(30.0, max(0.4, a["ps"]))))
            if a.get("pfcf") and a["pfcf"] > 0:
                pf_p.append((w, min(80.0, max(5.0, a["pfcf"]))))
            if a.get("gm") is not None:
                gm_p.append((w, a["gm"]))
            if a.get("om") is not None:
                om_p.append((w, a["om"]))
            if a.get("nm") is not None:
                nm_p.append((w, a["nm"]))
            b = mp.get(prev)
            if b and a.get("rev") and b.get("rev") and b["rev"] > 0:
                rg_p.append((w, (a["rev"] - b["rev"]) / b["rev"]))
            if b and a.get("eps") is not None and b.get("eps") and abs(b["eps"]) > 0.05:
                eg_p.append((w, (a["eps"] - b["eps"]) / abs(b["eps"])))
        rec = {"date": k + "-01"}
        for key, pairs, fn in (("pe", pe_p, w_harmonic), ("ps", ps_p, w_harmonic), ("pfcf", pf_p, w_harmonic),
                               ("gm", gm_p, w_mean), ("om", om_p, w_mean), ("nm", nm_p, w_mean),
                               ("revYoY", rg_p, w_mean), ("epsYoY", eg_p, w_mean)):
            v = fn(pairs)
            rec[key] = round(v, 4) if v is not None else None
        # require a reasonable amount of weight present
        if sum(w for w, _ in pe_p) >= 0.5 * covered_w:
            series.append(rec)

    # live blended (current price / TTM per-share)
    live = {}
    clampb = {"pe": (5.0, 80.0), "ps": (0.4, 30.0), "pfcf": (5.0, 80.0)}
    for key, num in (("pe", "eps"), ("ps", "revps"), ("pfcf", "fcfps")):
        lo, hi = clampb[key]
        pairs = []
        for t, d in funds.items():
            px = (d.get("price") or [{}])[-1].get("c")
            per = d.get("ttm", {}).get(num)
            if px and per and per > 0:
                pairs.append((weight[t], min(hi, max(lo, px / per))))
        v = w_harmonic(pairs)
        live[key] = round(v, 2) if v is not None else None

    return {
        "sleeve": sleeve,
        "asof": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "holdings": len(holdings), "covered": len(funds), "coverage": coverage,
        "live": live,
        "series": series,
    }


def main():
    print("Fetching S&P 500 valuation history (multpl)…")
    bench = {"SPY": {"pe": multpl("s-p-500-pe-ratio"), "ps": multpl("s-p-500-price-to-sales")}}
    (PUB / "benchmark-fundamentals.json").write_text(json.dumps({
        "source": "multpl.com (S&P 500)", "generated": datetime.now(timezone.utc).isoformat(),
        "benchmarks": bench,
    }, separators=(",", ":")))
    print(f"  SPY P/E {len(bench['SPY']['pe'])} months, P/S {len(bench['SPY']['ps'])} months")

    for sl in SLEEVES:
        d = build_sleeve(sl)
        if not d:
            print(f"  {sl}: no data"); continue
        (PUB / f"portfolio-fundamentals-{sl}.json").write_text(json.dumps(d, separators=(",", ":")))
        lv = d["live"]
        print(f"  {sl}: {d['covered']}/{d['holdings']} holdings ({int((d['coverage'] or 0)*100)}% wt) | "
              f"live P/E {lv.get('pe')} P/S {lv.get('ps')} P/FCF {lv.get('pfcf')} | {len(d['series'])} quarters")


if __name__ == "__main__":
    main()
