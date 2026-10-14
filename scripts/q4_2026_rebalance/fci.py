#!/usr/bin/env python3
"""
Q4 2026 FCI reconstitution, booked 2026-10-14.

FCI 100 holds the top 100 names by Stock-Screener overall_score. FCI Values 100
holds the top 100 with an Inspire impact score of -49 or higher (names with no
score are eligible, as in July). Ties at the cutoff go to current holdings first,
then screener order. Rosters: fci_rosters.json, built from the 10/14 manifest.

Every name is set to 1% of the sleeve: NAV / 100 at the 2:35 PM ET price, the
midpoint of the open and close of each name's 14:35 ET 5-minute bar (Yahoo),
checked within 2.4% of the FMP close for all 173 names. That is the same
execution time as the 10/13 dividend/growth rebalance.

Holdings come from the builder's ledger replay; cash from the published JSON
(base plus dividend credits), as in July's scripts/reconstitute-fci.py.

Usage:  python3 -m scripts.q4_2026_rebalance.fci [--write]
"""
import importlib.util, json, re, sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
TRADE_DATE = "10-14-26"
WRITE = "--write" in sys.argv

spec = importlib.util.spec_from_file_location("bph", REPO / "scripts" / "build-portfolio-history.py")
bph = importlib.util.module_from_spec(spec); spec.loader.exec_module(bph)

ROSTERS = json.load(open(HERE / "fci_rosters.json"))
PRICES = json.load(open(HERE / "fci_prices_1435.json"))

# Company names for tickers the builder's name map doesn't know yet (By Activity
# rows are keyed by company name). From the Stock-Screener manifest.
NEW_NAMES = {
    "AAON": "AAON Inc", "ABT": "Abbott Laboratories", "ADSK": "Autodesk Inc",
    "ALNY": "Alnylam Pharmaceuticals Inc", "ARIS": "Aris Mining Corp", "AVAV": "AeroVironment Inc",
    "BHP": "BHP Group Ltd ADR", "BN": "Brookfield Corp", "CALX": "Calix Inc", "CME": "CME Group Inc",
    "COHR": "Coherent Corp", "DAL": "Delta Air Lines Inc", "DUOL": "Duolingo Inc", "DXCM": "DexCom Inc",
    "EMR": "Emerson Electric Co", "ESTC": "Elastic NV", "FNV": "Franco-Nevada Corp", "FSLR": "First Solar Inc",
    "GEHC": "GE HealthCare Technologies Inc", "GNTX": "Gentex Corp", "GWRE": "Guidewire Software Inc",
    "HSY": "The Hershey Co", "LDOS": "Leidos Holdings Inc", "LNTH": "Lantheus Holdings Inc",
    "MELI": "MercadoLibre Inc", "MWH": "SOLV Energy Inc", "NOC": "Northrop Grumman Corp",
    "NYT": "The New York Times Co", "OSCR": "Oscar Health Inc", "PLD": "Prologis Inc",
    "PM": "Philip Morris International Inc", "PSN": "Parsons Corp", "SLB": "SLB NV",
    "SLDE": "Slide Insurance Holdings Inc", "SMTC": "Semtech Corp", "SRE": "Sempra",
    "TRI": "Thomson Reuters Corp", "ULS": "UL Solutions Inc", "UPST": "Upstart Holdings Inc",
    "WCN": "Waste Connections Inc",
}


def company_names():
    rev = {}
    for name, tk in bph.NAME_TO_TICKER.items():
        rev.setdefault(tk, name)   # first name wins, as in July
    for tk, name in NEW_NAMES.items():
        if tk in rev:
            continue
        assert name not in bph.NAME_TO_TICKER, f"{name} already maps to {bph.NAME_TO_TICKER[name]}"
        rev[tk] = name
    return rev


def plan(sleeve):
    txs, _, _, _ = bph.parse_transactions(str(REPO / "transactions" / f"{sleeve}_strategy_transactions.txt"))
    assert not any(t["date"] >= "2026-10-14" for t in txs), f"{sleeve} already has 10/14 trades"
    cur = {t: s for t, s in bph.replay_holdings(txs).items() if s > 0.0001}
    cash = json.load(open(REPO / "public" / f"portfolio-history-{sleeve}.json"))["cash"]
    roster = set(ROSTERS[sleeve]["roster"])
    assert len(roster) == 100
    nav = sum(s * PRICES[t] for t, s in cur.items()) + cash
    tgt = nav / 100.0
    trades = []
    for t in sorted(set(cur) | roster):
        p = PRICES[t]
        want = tgt / p if t in roster else 0.0
        delta = want - cur.get(t, 0.0)
        if t in roster and abs(delta * p) < 1.0:
            continue
        sh = round(abs(delta), 4) if t in roster else round(cur[t], 4)
        kind = "PURCHASE" if delta > 0 else "SALE"
        reason = "NEW" if t not in cur else "EXIT" if t not in roster else "ADD" if delta > 0 else "TRIM"
        trades.append({"ticker": t, "type": kind, "reason": reason, "shares": sh, "price": p,
                       "amount": round(sh * p, 2)})
    proceeds = sum(x["amount"] for x in trades if x["type"] == "SALE")
    outlay = sum(x["amount"] for x in trades if x["type"] == "PURCHASE")
    return {"cur": cur, "cash": cash, "nav": nav, "tgt": tgt, "trades": trades,
            "proceeds": proceeds, "outlay": outlay, "post_cash": cash + proceeds - outlay}


def blocks(trades, names):
    f = lambda n, d: f"{n:,.{d}f}"
    return "".join(f" \t{TRADE_DATE}\t\n{x['type']}{names[x['ticker']]}\n"
                   f"{f(x['shares'], 4)}\t{f(x['price'], 4)}\t{f(x['amount'], 2)}\tEdit\t \n"
                   for x in trades)


def report(results):
    out = ["# Q4 2026 FCI Reconstitution — Execution Report", "",
           "**Trade Date:** 10-14-26, 2:35 PM ET", "",
           "**Rules.** FCI 100 holds the top 100 names by Stock-Screener score. FCI Values 100 holds "
           "the top 100 with an Inspire impact score of −49 or higher; names without an Inspire score "
           "are eligible. Ties at the cutoff go to current holdings first, then screener order. Every "
           "name is set to 1% of the sleeve.", "",
           "**Pricing.** Each name's 2:35 PM ET price: the midpoint of the open and close of its "
           "14:35 ET 5-minute bar, the same execution time as the 10/13 dividend and growth "
           "rebalance.", "",
           "**Excluded.** The screener carries a duplicate TE Connectivity report under ticker TE, "
           "which trades as T1 Energy. TE Connectivity is held as TEL.", "", "---", ""]
    for sl, label in (("fci100", "FCI 100"), ("fciValues", "FCI Values 100")):
        r, ro = results[sl], ROSTERS[sl]
        out += [f"## {label}", "",
                f"- Value at execution prices: **${r['nav']:,.2f}** (cash before ${r['cash']:,.2f})",
                f"- Per-name target: **${r['tgt']:,.2f}**",
                f"- Score cutoff **{ro['cutoff']}**: {ro['above']} names above it, "
                f"{len(ro['picked'])} of {len(ro['tied'])} tied names taken",
                f"- **Adds ({len(ro['adds'])}):** {', '.join(ro['adds'])}",
                f"- **Exits ({len(ro['drops'])}):** {', '.join(ro['drops'])}",
                f"- Sale proceeds ${r['proceeds']:,.2f}, purchases ${r['outlay']:,.2f}, "
                f"cash after ${r['post_cash']:,.2f}", "",
                "| Ticker | Action | Type | Shares | Price | Amount |", "|---|---|---|---|---|---|"]
        for x in sorted(r["trades"], key=lambda x: (x["reason"], x["ticker"])):
            out.append(f"| {x['ticker']} | {x['reason']} | {x['type']} | {x['shares']:,.4f} | "
                       f"${x['price']:,.4f} | ${x['amount']:,.2f} |")
        out += ["", "---", ""]
    (REPO / "public" / "research" / "Q4 2026 FCI Reconstitution Report.md").write_text("\n".join(out))


def main():
    names = company_names()
    results = {}
    for sl in ("fci100", "fciValues"):
        r = plan(sl); results[sl] = r
        post = dict(r["cur"])
        for x in r["trades"]:
            post[x["ticker"]] = post.get(x["ticker"], 0) + (x["shares"] if x["type"] == "PURCHASE" else -x["shares"])
        post = {t: s for t, s in post.items() if s > 0.0001}
        w = [post[t] * PRICES[t] / r["nav"] for t in post]
        assert set(post) == set(ROSTERS[sl]["roster"]), set(post) ^ set(ROSTERS[sl]["roster"])
        print(f"{sl}: NAV ${r['nav']:,.2f}  target/name ${r['tgt']:,.2f}  trades {len(r['trades'])}  "
              f"weights {min(w)*100:.4f}%-{max(w)*100:.4f}%  cash ${r['cash']:,.2f} -> ${r['post_cash']:,.2f}")
    if not WRITE:
        print("[dry run]"); return
    missing = {t for sl in results for t in (x["ticker"] for x in results[sl]["trades"])} - set(names)
    assert not missing, missing
    add = {names[t]: t for t in NEW_NAMES if names[t] not in bph.NAME_TO_TICKER}
    if add:
        p = REPO / "scripts" / "build-portfolio-history.py"
        src = p.read_text()
        ins = "    # Q4 2026 FCI reconstitution additions\n" + "".join(f'    "{n}": "{t}",\n' for n, t in sorted(add.items(), key=lambda kv: kv[1]))
        src, k = re.subn(r"(NAME_TO_TICKER\s*=\s*\{\n)", lambda m: m.group(1) + ins, src, count=1)
        assert k == 1
        p.write_text(src)
    for sl in ("fci100", "fciValues"):
        f = REPO / "transactions" / f"{sl}_strategy_transactions.txt"
        lines = f.read_text().splitlines(keepends=True)
        idx = max(i for i, l in enumerate(lines) if l.startswith("As of"))
        lines[idx:idx] = [blocks(results[sl]["trades"], names)]
        f.write_text("".join(lines))
    report(results)
    print("[wrote transactions, name map, report]")


if __name__ == "__main__":
    main()
