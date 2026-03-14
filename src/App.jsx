import { useState, useEffect, useCallback, useRef, useMemo } from "react";

const SLEEVES = {
  dividend: { name: "Dividend", short: "DIV", symbols: ["ABT","A","ADI","ATO","ADP","BKH","CAT","CHD","CL","FAST","GD","GPC","LRCX","LMT","MATX","NEE","ORI","PCAR","QCOM","DGX","SSNC","STLD","SYK","TEL","VLO"], tag: "#2D5016" },
  growth: { name: "Growth Hybrid", short: "GRO", symbols: ["AMD","AEM","ATAT","CVX","CWAN","CNX","COIN","EIX","FINV","FTNT","GFI","SUPV","HRMY","HUT","KEYS","MARA","NVDA","NXPI","OKE","PDD","HOOD","SYF","TSM","TOL"], tag: "#1E4A2E" },
  digital: { name: "Digital Assets", short: "ETF", symbols: ["IBIT","ETHA"], tag: "#1A3D3D" },
};
const ALL = [...SLEEVES.dividend.symbols, ...SLEEVES.growth.symbols, ...SLEEVES.digital.symbols];
const DIMS = [
  { k: "innovation", l: "Innovation", i: "💡" }, { k: "inspiration", l: "Inspiration", i: "✨" },
  { k: "infrastructure", l: "Infrastructure", i: "🏗️" }, { k: "aiResilience", l: "AI Resilience", i: "🤖" },
  { k: "moatStrength", l: "Moat Strength", i: "🏰" }, { k: "erosionProtection", l: "Erosion Prot.", i: "🛡️" },
  { k: "socialArbitrage", l: "Social Arb.", i: "📡" }, { k: "dividendSafety", l: "Div. Safety", i: "💰" },
];
const GAME = { k: "gameType", l: "Infinite vs Finite" };
const BASE = "https://data.alpaca.markets";
const PAPER = "https://paper-api.alpaca.markets";
const EK = import.meta.env.VITE_ALPACA_KEY || "";
const ES = import.meta.env.VITE_ALPACA_SECRET || "";
const ACCESS_CODE = "ResearchSows";

const fmt = n => (n == null || isNaN(n)) ? "--" : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = n => (n == null || isNaN(n)) ? "--" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
const vol = n => !n ? "--" : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : `${n}`;

const mono = "'JetBrains Mono', monospace";
const sans = "'Inter', -apple-system, sans-serif";

const C = {
  bg: "#080C04", card: "rgba(18,26,12,0.7)", border: "rgba(122,143,90,0.1)",
  t1: "#E8EDE0", t2: "#B0C494", t3: "#6B7F55", t4: "#3D4D2D",
  up: "#4ADE80", dn: "#F87171", accent: "#7A8F5A",
};

export default function App() {
  const [unlocked, setUnlocked] = useState(false);
  const [code, setCode] = useState("");
  const [codeErr, setCodeErr] = useState(false);
  const [apiKey, setApiKey] = useState(EK);
  const [apiSecret, setApiSecret] = useState(ES);
  const [authed, setAuthed] = useState(false);
  const [authErr, setAuthErr] = useState("");
  const [quotes, setQuotes] = useState({});
  const [bars, setBars] = useState({});
  const [loading, setLoading] = useState(false);
  const [lastUp, setLastUp] = useState(null);
  const [tab, setTab] = useState("home");
  const [sleeve, setSleeve] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState({ f: "symbol", d: "asc" });
  const [scores, setScores] = useState({});
  const [sel, setSel] = useState(null);
  const [refresh, setRefresh] = useState(30);
  const iRef = useRef(null);

  const hdrs = useMemo(() => ({ "APCA-API-KEY-ID": apiKey, "APCA-API-SECRET-KEY": apiSecret }), [apiKey, apiSecret]);

  const fetchData = useCallback(async () => {
    if (!apiKey || !apiSecret) return;
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/v2/stocks/snapshots?symbols=${ALL.join(",")}&feed=iex`, { headers: hdrs });
      if (!r.ok) throw new Error("fail");
      const d = await r.json();
      const nq = {}, nb = {};
      for (const [s, snap] of Object.entries(d)) {
        if (snap.latestTrade) nq[s] = { p: snap.latestTrade.p, t: snap.latestTrade.t };
        if (snap.dailyBar) nb[s] = { o: snap.dailyBar.o, h: snap.dailyBar.h, l: snap.dailyBar.l, c: snap.dailyBar.c, v: snap.dailyBar.v, vw: snap.dailyBar.vw };
        if (snap.prevDailyBar) { if (!nb[s]) nb[s] = {}; nb[s].pc = snap.prevDailyBar.c; }
      }
      setQuotes(nq); setBars(nb); setLastUp(new Date());
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [apiKey, apiSecret, hdrs]);

  const auth = async () => {
    setAuthErr("");
    try {
      const r = await fetch(`${PAPER}/v2/account`, { headers: hdrs });
      if (!r.ok) throw new Error("fail");
      setAuthed(true); fetchData();
    } catch { setAuthErr("Invalid API keys."); }
  };

  useEffect(() => { if (EK && ES && !authed && unlocked) auth(); }, [unlocked]);
  useEffect(() => {
    if (authed && refresh) { iRef.current = setInterval(fetchData, refresh * 1000); return () => clearInterval(iRef.current); }
  }, [authed, refresh, fetchData]);

  const chg = s => { const q = quotes[s], b = bars[s]; return (q && b?.pc) ? ((q.p - b.pc) / b.pc) * 100 : null; };
  const sleeveOf = s => { for (const [k, v] of Object.entries(SLEEVES)) if (v.symbols.includes(s)) return { k, ...v }; return null; };
  const sleeveStats = k => {
    const syms = SLEEVES[k].symbols, cs = syms.map(chg).filter(c => c !== null);
    return { avg: cs.length ? cs.reduce((a, b) => a + b, 0) / cs.length : null, up: cs.filter(c => c > 0).length, dn: cs.filter(c => c < 0).length, n: syms.length };
  };
  const composite = s => { const sc = scores[s]; if (!sc) return null; const v = DIMS.map(d => sc[d.k]).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };

  const filtered = () => {
    let syms = sleeve === "all" ? ALL : SLEEVES[sleeve]?.symbols || [];
    if (search) syms = syms.filter(s => s.toLowerCase().includes(search.toLowerCase()));
    return syms.sort((a, b) => {
      let va, vb;
      if (sort.f === "symbol") { va = a; vb = b; }
      else if (sort.f === "price") { va = quotes[a]?.p || 0; vb = quotes[b]?.p || 0; }
      else if (sort.f === "change") { va = chg(a) || 0; vb = chg(b) || 0; }
      else if (sort.f === "volume") { va = bars[a]?.v || 0; vb = bars[b]?.v || 0; }
      else { va = a; vb = b; }
      if (typeof va === "string") return sort.d === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      return sort.d === "asc" ? va - vb : vb - va;
    });
  };

  const toggleSort = f => setSort(prev => prev.f === f ? { f, d: prev.d === "asc" ? "desc" : "asc" } : { f, d: f === "change" ? "desc" : "asc" });

  // ── PASSWORD GATE ──
  if (!unlocked) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: sans }}>
        <div style={{ width: "100%", maxWidth: 340, textAlign: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: 4, color: C.t3, textTransform: "uppercase", marginBottom: 6 }}>IOWN</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: C.t1, marginBottom: 32 }}>Portfolio Dashboard</div>
          <div style={{ marginBottom: 16 }}>
            <input
              type="password" value={code} onChange={e => { setCode(e.target.value); setCodeErr(false); }}
              onKeyDown={e => { if (e.key === "Enter") { if (code === ACCESS_CODE) setUnlocked(true); else setCodeErr(true); } }}
              placeholder="Enter access code"
              style={{ width: "100%", padding: "14px 16px", background: C.card, border: `1px solid ${codeErr ? C.dn + "66" : C.border}`, borderRadius: 10, color: C.t1, fontSize: 15, fontFamily: sans, outline: "none", boxSizing: "border-box", textAlign: "center", letterSpacing: 2 }}
            />
          </div>
          <button onClick={() => { if (code === ACCESS_CODE) setUnlocked(true); else setCodeErr(true); }}
            style={{ width: "100%", padding: 14, background: "linear-gradient(135deg, #3D5A1E, #2C4A0F)", border: "none", borderRadius: 10, color: C.t1, fontSize: 14, fontWeight: 600, fontFamily: sans, cursor: "pointer", letterSpacing: 1 }}>
            Enter
          </button>
          {codeErr && <div style={{ marginTop: 12, color: C.dn, fontSize: 13, fontFamily: sans }}>Incorrect code</div>}
          <div style={{ marginTop: 24, fontSize: 11, color: C.t4, fontFamily: sans }}>For authorized IOWN team members only</div>
        </div>
      </div>
    );
  }

  // ── API KEY SCREEN ──
  if (!authed) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: sans }}>
        <div style={{ width: "100%", maxWidth: 380, textAlign: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: 4, color: C.t3, textTransform: "uppercase", marginBottom: 6 }}>IOWN</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: C.t1, marginBottom: 32 }}>Connect Market Data</div>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "24px 20px", textAlign: "left" }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.t3, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>API Key</label>
            <input type="text" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="APCA-API-KEY-ID"
              style={{ width: "100%", padding: "12px 14px", background: "rgba(8,12,4,0.8)", border: `1px solid ${C.border}`, borderRadius: 8, color: C.t1, fontSize: 14, fontFamily: mono, outline: "none", boxSizing: "border-box", marginBottom: 14 }} />
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.t3, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Secret</label>
            <input type="password" value={apiSecret} onChange={e => setApiSecret(e.target.value)} placeholder="APCA-API-SECRET-KEY"
              style={{ width: "100%", padding: "12px 14px", background: "rgba(8,12,4,0.8)", border: `1px solid ${C.border}`, borderRadius: 8, color: C.t1, fontSize: 14, fontFamily: mono, outline: "none", boxSizing: "border-box", marginBottom: 20 }} />
            <button onClick={auth} style={{ width: "100%", padding: 14, background: "linear-gradient(135deg, #3D5A1E, #2C4A0F)", border: "none", borderRadius: 10, color: C.t1, fontSize: 14, fontWeight: 600, fontFamily: sans, cursor: "pointer" }}>Connect</button>
            {authErr && <div style={{ marginTop: 10, color: C.dn, fontSize: 13, textAlign: "center" }}>{authErr}</div>}
          </div>
        </div>
      </div>
    );
  }

  // ── DERIVED ──
  const allC = ALL.map(chg).filter(c => c !== null);
  const avgC = allC.length ? allC.reduce((a, b) => a + b, 0) / allC.length : null;
  const gainers = ALL.filter(s => chg(s) !== null).sort((a, b) => chg(b) - chg(a)).slice(0, 5);
  const losers = ALL.filter(s => chg(s) !== null).sort((a, b) => chg(a) - chg(b)).slice(0, 5);
  const fsyms = filtered();

  // ── COMPONENTS ──
  const Pill = ({ on, children, onClick, s: style }) => (
    <button onClick={onClick} style={{ padding: "6px 12px", background: on ? "rgba(122,143,90,0.18)" : "transparent", border: on ? "1px solid rgba(122,143,90,0.35)" : `1px solid ${C.border}`, borderRadius: 18, color: on ? C.t1 : C.t3, fontSize: 12, fontWeight: 500, fontFamily: sans, cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s", ...style }}>{children}</button>
  );

  const Ticker = ({ s }) => {
    const q = quotes[s], b = bars[s], c = chg(s), sl = sleeveOf(s), open = sel === s;
    return (
      <div onClick={() => setSel(open ? null : s)} style={{ background: C.card, border: `1px solid ${open ? "rgba(122,143,90,0.25)" : C.border}`, borderRadius: 12, padding: "12px 14px", cursor: "pointer", transition: "all 0.12s" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.t1, fontFamily: mono, letterSpacing: 0.5 }}>{s}</span>
            <span style={{ fontSize: 9, fontWeight: 600, color: C.t3, background: sl?.tag + "33", padding: "2px 5px", borderRadius: 4, letterSpacing: 0.5 }}>{sl?.short}</span>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.t1, fontFamily: mono }}>${fmt(q?.p)}</div>
            <div style={{ fontSize: 12, fontWeight: 600, fontFamily: mono, color: c > 0 ? C.up : c < 0 ? C.dn : C.t3 }}>{pct(c)}</div>
          </div>
        </div>
        {open && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}`, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {[["Open", fmt(b?.o)], ["High", fmt(b?.h)], ["Low", fmt(b?.l)], ["Prev Cl", fmt(b?.pc)], ["VWAP", fmt(b?.vw)], ["Volume", vol(b?.v)]].map(([l, v]) => (
              <div key={l}>
                <div style={{ fontSize: 10, fontWeight: 500, color: C.t4, letterSpacing: 0.5, textTransform: "uppercase" }}>{l}</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.t2, fontFamily: mono, marginTop: 2 }}>{v}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const Mover = ({ s, rank }) => {
    const q = quotes[s], c = chg(s), sl = sleeveOf(s);
    return (
      <div onClick={() => { setSel(s); setTab("list"); }} style={{ display: "flex", alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${C.border}`, cursor: "pointer" }}>
        <span style={{ fontSize: 10, color: C.t4, fontFamily: mono, width: 18 }}>{rank}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: mono, flex: 1 }}>{s}</span>
        <span style={{ fontSize: 13, fontWeight: 500, color: C.t3, fontFamily: mono, marginRight: 10 }}>${fmt(q?.p)}</span>
        <span style={{ fontSize: 13, fontWeight: 700, fontFamily: mono, color: c > 0 ? C.up : c < 0 ? C.dn : C.t3, minWidth: 60, textAlign: "right" }}>{pct(c)}</span>
      </div>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: sans, color: C.t1, paddingBottom: 72 }}>
      {/* HEADER */}
      <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${C.border}`, background: "rgba(8,12,4,0.92)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: 2, color: C.t1 }}>IOWN</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {loading && <div style={{ width: 6, height: 6, borderRadius: 3, background: C.up, opacity: 0.7, animation: "pulse 1s infinite" }} />}
          {lastUp && <span style={{ fontSize: 10, color: C.t4, fontFamily: mono }}>{lastUp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
          <button onClick={fetchData} disabled={loading} style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(122,143,90,0.08)", border: `1px solid ${C.border}`, borderRadius: 8, color: C.t3, fontSize: 13, cursor: "pointer" }}>↻</button>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "14px 14px" }}>

        {/* ── HOME ── */}
        {tab === "home" && (<div>
          {/* Portfolio avg */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 16px", marginBottom: 14, textAlign: "center" }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: C.t3, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Portfolio Avg</div>
            <div style={{ fontSize: 28, fontWeight: 700, fontFamily: mono, color: avgC > 0 ? C.up : avgC < 0 ? C.dn : C.t1 }}>{pct(avgC)}</div>
            <div style={{ fontSize: 12, color: C.t4, marginTop: 6, fontFamily: mono }}>
              {ALL.length} holdings&nbsp;&nbsp;·&nbsp;&nbsp;
              <span style={{ color: C.up }}>{allC.filter(c => c > 0).length} up</span>&nbsp;&nbsp;·&nbsp;&nbsp;
              <span style={{ color: C.dn }}>{allC.filter(c => c < 0).length} down</span>
            </div>
          </div>

          {/* Sleeves */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto", paddingBottom: 2 }}>
            {Object.entries(SLEEVES).map(([k, s]) => {
              const st = sleeveStats(k);
              return (
                <div key={k} onClick={() => { setSleeve(k); setTab("list"); }}
                  style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 14px", cursor: "pointer", flex: "1 1 0", minWidth: 130 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.t1, marginBottom: 2 }}>{s.name}</div>
                  <div style={{ fontSize: 10, color: C.t4, fontFamily: mono, marginBottom: 8 }}>{st.n} positions</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: mono, color: st.avg > 0 ? C.up : st.avg < 0 ? C.dn : C.t3, marginBottom: 6 }}>{pct(st.avg)}</div>
                  <div style={{ display: "flex", gap: 10, fontSize: 11, fontFamily: mono }}>
                    <span style={{ color: C.up }}>{st.up} ↑</span>
                    <span style={{ color: C.dn }}>{st.dn} ↓</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Heat Map */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.t3, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>Heat Map</div>
            {Object.entries(SLEEVES).map(([key, sl]) => (
              <div key={key} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: C.t4, fontWeight: 500, marginBottom: 5 }}>{sl.name}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                  {sl.symbols.map(s => {
                    const c = chg(s), i = c ? Math.min(Math.abs(c) / 3, 1) : 0;
                    const bg = c > 0 ? `rgba(74,222,128,${0.1 + i * 0.35})` : c < 0 ? `rgba(248,113,113,${0.1 + i * 0.35})` : "rgba(122,143,90,0.06)";
                    return (
                      <div key={s} onClick={() => { setSel(s); setTab("list"); }}
                        style={{ padding: "5px 6px", background: bg, borderRadius: 6, cursor: "pointer", minWidth: 48, textAlign: "center" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: C.t1, fontFamily: mono }}>{s}</div>
                        <div style={{ fontSize: 9, fontFamily: mono, color: c > 0 ? C.up : c < 0 ? C.dn : C.t4, marginTop: 1 }}>{pct(c)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Top Movers - horizontal scroll on mobile */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.up, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Top Gainers</div>
              {gainers.map((s, i) => <Mover key={s} s={s} rank={i + 1} />)}
            </div>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.dn, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Top Decliners</div>
              {losers.map((s, i) => <Mover key={s} s={s} rank={i + 1} />)}
            </div>
          </div>
        </div>)}

        {/* ── HOLDINGS LIST ── */}
        {tab === "list" && (<div>
          <input type="text" placeholder="Search ticker..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: "100%", padding: "10px 14px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, color: C.t1, fontSize: 14, fontFamily: sans, fontWeight: 500, outline: "none", boxSizing: "border-box", marginBottom: 10 }} />
          <div style={{ display: "flex", gap: 5, overflowX: "auto", marginBottom: 8, paddingBottom: 2 }}>
            <Pill on={sleeve === "all"} onClick={() => setSleeve("all")}>All {ALL.length}</Pill>
            {Object.entries(SLEEVES).map(([k, s]) => <Pill key={k} on={sleeve === k} onClick={() => setSleeve(k)}>{s.short} {s.symbols.length}</Pill>)}
          </div>
          <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
            {[{ f: "symbol", l: "A-Z" }, { f: "price", l: "Price" }, { f: "change", l: "Chg" }, { f: "volume", l: "Vol" }].map(({ f, l }) => (
              <Pill key={f} on={sort.f === f} onClick={() => toggleSort(f)} s={{ fontSize: 11, padding: "4px 10px" }}>
                {l}{sort.f === f ? (sort.d === "asc" ? " ↑" : " ↓") : ""}
              </Pill>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{fsyms.map(s => <Ticker key={s} s={s} />)}</div>
        </div>)}

        {/* ── SCREENER ── */}
        {tab === "screen" && (<div>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.t3, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>Excellence Evaluation</div>
          <div style={{ fontSize: 13, color: C.t4, marginBottom: 14 }}>Score 1–10 across 8 dimensions. Tap to expand.</div>
          <div style={{ display: "flex", gap: 5, overflowX: "auto", marginBottom: 12, paddingBottom: 2 }}>
            <Pill on={sleeve === "all"} onClick={() => setSleeve("all")}>All</Pill>
            {Object.entries(SLEEVES).map(([k, s]) => <Pill key={k} on={sleeve === k} onClick={() => setSleeve(k)}>{s.short}</Pill>)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(sleeve === "all" ? ALL : SLEEVES[sleeve]?.symbols || []).map(s => {
              const sc = scores[s] || {}, comp = composite(s), open = sel === s;
              const filled = DIMS.filter(d => sc[d.k] != null).length;
              return (
                <div key={s} onClick={() => setSel(open ? null : s)}
                  style={{ background: C.card, border: `1px solid ${open ? "rgba(122,143,90,0.25)" : C.border}`, borderRadius: 12, padding: "12px 14px", cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.t1, fontFamily: mono }}>{s}</span>
                      <span style={{ fontSize: 9, fontWeight: 600, color: C.t3, background: sleeveOf(s)?.tag + "33", padding: "2px 5px", borderRadius: 4 }}>{sleeveOf(s)?.short}</span>
                      <span style={{ fontSize: 10, color: C.t4, fontFamily: mono }}>{filled}/8</span>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, fontFamily: mono, color: comp ? (comp >= 7 ? C.up : comp >= 5 ? "#FBBF24" : C.dn) : C.t4 }}>
                      {comp ? comp.toFixed(1) : "--"}
                    </div>
                  </div>
                  {/* Mini bar */}
                  <div style={{ display: "flex", gap: 2, marginTop: 8 }}>
                    {DIMS.map(d => <div key={d.k} style={{ flex: 1, height: 3, borderRadius: 2, background: sc[d.k] ? `rgba(74,222,128,${sc[d.k] / 10})` : "rgba(122,143,90,0.06)" }} />)}
                  </div>
                  {open && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        {DIMS.map(d => (
                          <div key={d.k} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 13 }}>{d.i}</span>
                            <span style={{ fontSize: 11, fontWeight: 500, color: C.t3, flex: 1 }}>{d.l}</span>
                            <input type="number" min="1" max="10" value={sc[d.k] || ""} onChange={e => { const v = parseInt(e.target.value); if (v >= 1 && v <= 10) setScores(p => ({ ...p, [s]: { ...(p[s] || {}), [d.k]: v } })); else if (!e.target.value) setScores(p => ({ ...p, [s]: { ...(p[s] || {}), [d.k]: undefined } })); }}
                              style={{ width: 38, padding: "5px 2px", background: sc[d.k] ? "rgba(74,222,128,0.1)" : "rgba(8,12,4,0.6)", border: `1px solid ${sc[d.k] ? C.up + "33" : C.border}`, borderRadius: 6, color: C.t1, fontSize: 14, fontFamily: mono, textAlign: "center", outline: "none" }} />
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 500, color: C.t3, flex: 1 }}>♾️ {GAME.l}</span>
                        <div style={{ display: "flex", gap: 3 }}>
                          {[{ v: "infinite", l: "♾️" }, { v: "finite", l: "⏳" }, { v: "mixed", l: "🔄" }].map(({ v, l }) => (
                            <button key={v} onClick={() => setScores(p => ({ ...p, [s]: { ...(p[s] || {}), [GAME.k]: sc[GAME.k] === v ? undefined : v } }))}
                              style={{ padding: "4px 8px", background: sc[GAME.k] === v ? "rgba(122,143,90,0.2)" : "transparent", border: `1px solid ${sc[GAME.k] === v ? C.accent + "55" : C.border}`, borderRadius: 6, color: sc[GAME.k] === v ? C.t1 : C.t4, fontSize: 12, cursor: "pointer" }}>{l}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>)}

        {/* ── SETTINGS ── */}
        {tab === "settings" && (<div>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.t3, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 14 }}>Settings</div>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 14px" }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.t2, marginBottom: 8 }}>Auto-Refresh</div>
              <div style={{ display: "flex", gap: 5 }}>
                {[{ v: null, l: "Off" }, { v: 15, l: "15s" }, { v: 30, l: "30s" }, { v: 60, l: "60s" }].map(({ v, l }) => <Pill key={l} on={refresh === v} onClick={() => setRefresh(v)}>{l}</Pill>)}
              </div>
            </div>
            <div style={{ paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.t2, marginBottom: 6 }}>Connection</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: 3, background: C.up }} />
                <span style={{ fontSize: 12, color: C.t3, fontFamily: mono }}>{Object.keys(quotes).length} symbols · IEX feed</span>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 24, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: C.t4, letterSpacing: 2 }}>IOWN · INTENTIONAL OWNERSHIP</div>
            <div style={{ fontSize: 10, color: C.t4, marginTop: 4 }}>A Registered Investment Advisor under Paradiem</div>
          </div>
        </div>)}
      </div>

      {/* BOTTOM TAB BAR */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(8,12,4,0.96)", backdropFilter: "blur(16px)", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-around", padding: "5px 0 env(safe-area-inset-bottom, 6px)", zIndex: 100 }}>
        {[{ id: "home", i: "⌂", l: "Home" }, { id: "list", i: "☰", l: "Holdings" }, { id: "screen", i: "◇", l: "Screen" }, { id: "settings", i: "⚙", l: "Settings" }].map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setSel(null); }}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1, padding: "5px 14px", background: "transparent", border: "none", cursor: "pointer", color: tab === t.id ? C.accent : C.t4 }}>
            <span style={{ fontSize: 17 }}>{t.i}</span>
            <span style={{ fontSize: 9, fontWeight: 500, letterSpacing: 0.5 }}>{t.l}</span>
          </button>
        ))}
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}*{-webkit-tap-highlight-color:transparent}input::placeholder{color:${C.t4}}`}</style>
    </div>
  );
}
