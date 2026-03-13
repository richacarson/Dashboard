import { useState, useEffect, useCallback, useRef, useMemo } from "react";

// ── Data ────────────────────────────────────────────────────────────────────
const SLEEVES = {
  dividend: { name: "Dividend", short: "DIV", symbols: ["ABT","A","ADI","ATO","ADP","BKH","CAT","CHD","CL","FAST","GD","GPC","LRCX","LMT","MATX","NEE","ORI","PCAR","QCOM","DGX","SSNC","STLD","SYK","TEL","VLO"], color: "#4A7A2E", accent: "#7A8F5A", bg: "rgba(74,122,46,0.12)" },
  growth: { name: "Growth Hybrid", short: "GRO", symbols: ["AMD","AEM","ATAT","CVX","CWAN","CNX","COIN","EIX","FINV","FTNT","GFI","SUPV","HRMY","HUT","KEYS","MARA","NVDA","NXPI","OKE","PDD","HOOD","SYF","TSM","TOL"], color: "#3D6B1E", accent: "#5A6B42", bg: "rgba(61,107,30,0.12)" },
  digital: { name: "Digital Assets", short: "ETF", symbols: ["IBIT","ETHA"], color: "#2A5216", accent: "#4A5E33", bg: "rgba(42,82,22,0.12)" },
};
const ALL_SYMBOLS = [...SLEEVES.dividend.symbols, ...SLEEVES.growth.symbols, ...SLEEVES.digital.symbols];
const DIMENSIONS = [
  { key: "innovation", label: "Innovation", icon: "💡" },
  { key: "inspiration", label: "Inspiration", icon: "✨" },
  { key: "infrastructure", label: "Infrastructure", icon: "🏗️" },
  { key: "aiResilience", label: "AI Resilience", icon: "🤖" },
  { key: "moatStrength", label: "Moat Strength", icon: "🏰" },
  { key: "erosionProtection", label: "Erosion Prot.", icon: "🛡️" },
  { key: "socialArbitrage", label: "Social Arb.", icon: "📡" },
  { key: "dividendSafety", label: "Div. Safety", icon: "💰" },
];
const GAME_OVERLAY = { key: "gameType", label: "Infinite vs Finite", icon: "♾️" };

const ALPACA_BASE = "https://data.alpaca.markets";
const ALPACA_PAPER_BASE = "https://paper-api.alpaca.markets";
const ENV_API_KEY = import.meta.env.VITE_ALPACA_KEY || "";
const ENV_API_SECRET = import.meta.env.VITE_ALPACA_SECRET || "";

// ── Utils ───────────────────────────────────────────────────────────────────
const fmt = (n) => (n == null || isNaN(n)) ? "—" : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (n) => (n == null || isNaN(n)) ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
const fmtVol = (n) => !n ? "—" : n >= 1e6 ? `${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `${(n/1e3).toFixed(1)}K` : `${n}`;

// ── Shield Icon ─────────────────────────────────────────────────────────────
const ShieldIcon = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 512 512">
    <defs>
      <linearGradient id="siBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#2C4A0F" /><stop offset="100%" stopColor="#1A2610" /></linearGradient>
      <linearGradient id="siF" x1="0.3" y1="0" x2="0.7" y2="1"><stop offset="0%" stopColor="#B0C494" /><stop offset="50%" stopColor="#9AAF7A" /><stop offset="100%" stopColor="#889E68" /></linearGradient>
    </defs>
    <rect width="512" height="512" rx="108" fill="url(#siBg)" />
    <path d="M256 60 L263.5 77 L280 84.5 L263.5 92 L256 109 L248.5 92 L232 84.5 L248.5 77 Z" fill="#9AAF7A" />
    <path d="M148 160 Q136 168 136 182 L136 252 L190 244 L190 152 Q190 148 186 148 L159 148 Q155 148 152 152 Z" fill="url(#siF)" />
    <rect x="208" y="128" width="44" height="118" rx="6" ry="6" fill="url(#siF)" />
    <rect x="270" y="128" width="44" height="122" rx="6" ry="6" fill="url(#siF)" />
    <path d="M332 252 L332 152 Q332 148 336 148 L354 148 Q358 148 360 152 L364 160 Q376 168 376 182 L376 256 Z" fill="url(#siF)" />
    <path d="M128 276 L128 316 Q128 386 256 434 Q384 386 384 316 L384 260 Z" fill="url(#siF)" />
  </svg>
);

// ── Colors ──────────────────────────────────────────────────────────────────
const C = {
  bg: "#080C04", card: "rgba(22,32,14,0.65)", border: "rgba(122,143,90,0.12)",
  text: "#E8EDE0", textMid: "#9AAF7A", textDim: "#5A6B42", textFaint: "#3A4A2A",
  green: "#5CB85C", red: "#D9534F", accent: "#7A8F5A", accentBg: "rgba(122,143,90,0.08)",
};

export default function IOWNDashboard() {
  const [apiKey, setApiKey] = useState(ENV_API_KEY);
  const [apiSecret, setApiSecret] = useState(ENV_API_SECRET);
  const [authenticated, setAuthenticated] = useState(false);
  const [authError, setAuthError] = useState("");
  const [quotes, setQuotes] = useState({});
  const [bars, setBars] = useState({});
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [tab, setTab] = useState("home");
  const [activeSleeve, setActiveSleeve] = useState("all");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("symbol");
  const [sortDir, setSortDir] = useState("asc");
  const [screenScores, setScreenScores] = useState({});
  const [selectedStock, setSelectedStock] = useState(null);
  const [refreshInterval, setRefreshInterval] = useState(30);
  const intervalRef = useRef(null);

  const headers = useMemo(() => ({ "APCA-API-KEY-ID": apiKey, "APCA-API-SECRET-KEY": apiSecret }), [apiKey, apiSecret]);

  const fetchSnapshots = useCallback(async () => {
    if (!apiKey || !apiSecret) return;
    setLoading(true);
    try {
      const res = await fetch(`${ALPACA_BASE}/v2/stocks/snapshots?symbols=${ALL_SYMBOLS.join(",")}&feed=iex`, { headers });
      if (!res.ok) throw new Error(`API Error: ${res.status}`);
      const data = await res.json();
      const nq = {}, nb = {};
      for (const [sym, snap] of Object.entries(data)) {
        if (snap.latestTrade) nq[sym] = { price: snap.latestTrade.p, timestamp: snap.latestTrade.t };
        if (snap.dailyBar) nb[sym] = { open: snap.dailyBar.o, high: snap.dailyBar.h, low: snap.dailyBar.l, close: snap.dailyBar.c, volume: snap.dailyBar.v, vwap: snap.dailyBar.vw };
        if (snap.prevDailyBar) { if (!nb[sym]) nb[sym] = {}; nb[sym].prevClose = snap.prevDailyBar.c; }
      }
      setQuotes(nq); setBars(nb); setLastUpdate(new Date());
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [apiKey, apiSecret, headers]);

  const authenticate = async () => {
    setAuthError("");
    try {
      const res = await fetch(`${ALPACA_PAPER_BASE}/v2/account`, { headers });
      if (!res.ok) throw new Error("fail");
      setAuthenticated(true); fetchSnapshots();
    } catch { setAuthError("Authentication failed. Check your API keys."); }
  };

  useEffect(() => { if (ENV_API_KEY && ENV_API_SECRET && !authenticated) authenticate(); }, []);
  useEffect(() => {
    if (authenticated && refreshInterval) {
      intervalRef.current = setInterval(fetchSnapshots, refreshInterval * 1000);
      return () => clearInterval(intervalRef.current);
    }
  }, [authenticated, refreshInterval, fetchSnapshots]);

  const getChange = (sym) => { const q = quotes[sym], b = bars[sym]; return (q && b?.prevClose) ? ((q.price - b.prevClose) / b.prevClose) * 100 : null; };
  const getSleeveForSymbol = (sym) => { for (const [k, s] of Object.entries(SLEEVES)) if (s.symbols.includes(sym)) return { key: k, ...s }; return null; };
  const getSleeveStats = (key) => {
    const syms = SLEEVES[key].symbols, changes = syms.map(getChange).filter(c => c !== null);
    return { avg: changes.length ? changes.reduce((a,b)=>a+b,0)/changes.length : null, up: changes.filter(c=>c>0).length, down: changes.filter(c=>c<0).length, total: syms.length };
  };
  const getCompositeScore = (sym) => { const s = screenScores[sym]; if (!s) return null; const v = DIMENSIONS.map(d=>s[d.key]).filter(x=>x!=null); return v.length ? v.reduce((a,b)=>a+b,0)/v.length : null; };
  const updateScore = (sym, dim, val) => setScreenScores(p => ({ ...p, [sym]: { ...(p[sym]||{}), [dim]: val } }));

  const getFilteredSymbols = () => {
    let syms = activeSleeve === "all" ? ALL_SYMBOLS : SLEEVES[activeSleeve]?.symbols || [];
    if (search) syms = syms.filter(s => s.toLowerCase().includes(search.toLowerCase()));
    return syms.sort((a, b) => {
      let va, vb;
      if (sortField === "symbol") { va = a; vb = b; }
      else if (sortField === "price") { va = quotes[a]?.price||0; vb = quotes[b]?.price||0; }
      else if (sortField === "change") { va = getChange(a)||0; vb = getChange(b)||0; }
      else if (sortField === "volume") { va = bars[a]?.volume||0; vb = bars[b]?.volume||0; }
      else { va = a; vb = b; }
      if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === "asc" ? va - vb : vb - va;
    });
  };

  // ── LOGIN ─────────────────────────────────────────────────────────────────
  if (!authenticated) {
    return (
      <div style={{ minHeight: "100vh", background: `linear-gradient(160deg, ${C.bg} 0%, #111A09 50%, ${C.bg} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'EB Garamond', Georgia, serif" }}>
        <div style={{ width: "100%", maxWidth: 400, textAlign: "center" }}>
          <div style={{ marginBottom: 32 }}><ShieldIcon size={80} /></div>
          <div style={{ fontSize: 11, letterSpacing: 6, color: C.textDim, fontFamily: "monospace", textTransform: "uppercase", marginBottom: 6 }}>Intentional Ownership</div>
          <h1 style={{ fontSize: 28, color: C.text, fontWeight: 400, margin: "0 0 32px 0" }}>Portfolio Dashboard</h1>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "28px 24px", backdropFilter: "blur(20px)" }}>
            <label style={{ display: "block", fontSize: 10, color: C.textDim, letterSpacing: 2, fontFamily: "monospace", textTransform: "uppercase", marginBottom: 6, textAlign: "left" }}>API Key</label>
            <input type="text" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="APCA-API-KEY-ID"
              style={{ width: "100%", padding: "12px 14px", background: "rgba(8,12,4,0.8)", border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 14, fontFamily: "monospace", outline: "none", boxSizing: "border-box", marginBottom: 16 }} />
            <label style={{ display: "block", fontSize: 10, color: C.textDim, letterSpacing: 2, fontFamily: "monospace", textTransform: "uppercase", marginBottom: 6, textAlign: "left" }}>Secret Key</label>
            <input type="password" value={apiSecret} onChange={e => setApiSecret(e.target.value)} placeholder="APCA-API-SECRET-KEY"
              style={{ width: "100%", padding: "12px 14px", background: "rgba(8,12,4,0.8)", border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 14, fontFamily: "monospace", outline: "none", boxSizing: "border-box", marginBottom: 24 }} />
            <button onClick={authenticate}
              style={{ width: "100%", padding: 14, background: "linear-gradient(135deg, #3D5A1E, #2C4A0F)", border: `1px solid ${C.accent}44`, borderRadius: 8, color: C.text, fontSize: 13, letterSpacing: 3, fontFamily: "monospace", textTransform: "uppercase", cursor: "pointer" }}>
              Connect
            </button>
            {authError && <div style={{ marginTop: 12, color: C.red, fontSize: 12, fontFamily: "monospace" }}>{authError}</div>}
          </div>
          <div style={{ marginTop: 20, fontSize: 10, color: C.textFaint, fontFamily: "monospace", lineHeight: 1.6 }}>
            Keys stored in browser memory only. Use paper trading keys.
          </div>
        </div>
      </div>
    );
  }

  // ── DERIVED ───────────────────────────────────────────────────────────────
  const allChanges = ALL_SYMBOLS.map(getChange).filter(c => c !== null);
  const avgChange = allChanges.length ? allChanges.reduce((a,b)=>a+b,0)/allChanges.length : null;
  const topGainers = ALL_SYMBOLS.filter(s => getChange(s) !== null).sort((a,b) => getChange(b)-getChange(a)).slice(0,5);
  const topLosers = ALL_SYMBOLS.filter(s => getChange(s) !== null).sort((a,b) => getChange(a)-getChange(b)).slice(0,5);
  const filteredSymbols = getFilteredSymbols();

  // ── SUBCOMPONENTS ─────────────────────────────────────────────────────────
  const Pill = ({ active, children, onClick, style: s }) => (
    <button onClick={onClick} style={{ padding: "7px 14px", background: active ? "rgba(122,143,90,0.2)" : "transparent", border: active ? `1px solid ${C.accent}55` : `1px solid ${C.border}`, borderRadius: 20, color: active ? C.text : C.textDim, fontSize: 12, fontFamily: "monospace", cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap", ...s }}>
      {children}
    </button>
  );

  const StockCard = ({ sym }) => {
    const q = quotes[sym], b = bars[sym], change = getChange(sym), sleeve = getSleeveForSymbol(sym);
    const isOpen = selectedStock === sym;
    return (
      <div onClick={() => setSelectedStock(isOpen ? null : sym)}
        style={{ background: C.card, border: `1px solid ${isOpen ? C.accent+"44" : C.border}`, borderRadius: 12, padding: "14px 16px", cursor: "pointer", transition: "all 0.15s" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: "monospace", letterSpacing: 1 }}>{sym}</span>
            <span style={{ fontSize: 9, color: sleeve?.accent || C.textDim, fontFamily: "monospace", background: sleeve?.bg || C.accentBg, padding: "2px 6px", borderRadius: 4, letterSpacing: 1 }}>{sleeve?.short}</span>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.text, fontFamily: "monospace" }}>${fmt(q?.price)}</div>
            <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "monospace", color: change > 0 ? C.green : change < 0 ? C.red : C.textMid }}>{fmtPct(change)}</div>
          </div>
        </div>
        {isOpen && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}`, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {[{ l: "Open", v: `$${fmt(b?.open)}` }, { l: "High", v: `$${fmt(b?.high)}` }, { l: "Low", v: `$${fmt(b?.low)}` }, { l: "Prev Close", v: `$${fmt(b?.prevClose)}` }, { l: "VWAP", v: `$${fmt(b?.vwap)}` }, { l: "Volume", v: fmtVol(b?.volume) }].map(({ l, v }) => (
              <div key={l}>
                <div style={{ fontSize: 9, color: C.textDim, fontFamily: "monospace", letterSpacing: 1, textTransform: "uppercase" }}>{l}</div>
                <div style={{ fontSize: 14, color: C.text, fontFamily: "monospace", marginTop: 2 }}>{v}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const MoverRow = ({ sym, rank }) => {
    const q = quotes[sym], change = getChange(sym), sleeve = getSleeveForSymbol(sym);
    return (
      <div onClick={() => { setSelectedStock(sym); setTab("holdings"); }}
        style={{ display: "flex", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.border}`, cursor: "pointer" }}>
        <span style={{ fontSize: 11, color: C.textFaint, fontFamily: "monospace", width: 20 }}>{rank}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: "monospace", letterSpacing: 1, flex: 1 }}>{sym}</span>
        <span style={{ fontSize: 9, color: C.textDim, fontFamily: "monospace", marginRight: 12 }}>{sleeve?.short}</span>
        <span style={{ fontSize: 13, color: C.textMid, fontFamily: "monospace", marginRight: 12 }}>${fmt(q?.price)}</span>
        <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace", color: change > 0 ? C.green : change < 0 ? C.red : C.textMid, minWidth: 65, textAlign: "right" }}>{fmtPct(change)}</span>
      </div>
    );
  };

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(180deg, ${C.bg} 0%, #0C1208 50%, ${C.bg} 100%)`, fontFamily: "'EB Garamond', Georgia, serif", color: C.text, paddingBottom: 80 }}>

      {/* HEADER */}
      <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${C.border}`, background: "rgba(8,12,4,0.9)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ShieldIcon size={28} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, lineHeight: 1.1 }}>IOWN</div>
            <div style={{ fontSize: 9, color: C.textDim, fontFamily: "monospace", letterSpacing: 1 }}>PORTFOLIO</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {loading && <div style={{ width: 8, height: 8, borderRadius: 4, background: C.accent, animation: "pulse 1s infinite" }} />}
          {lastUpdate && <span style={{ fontSize: 9, color: C.textDim, fontFamily: "monospace" }}>{lastUpdate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
          <button onClick={fetchSnapshots} disabled={loading}
            style={{ padding: "5px 12px", background: C.accentBg, border: `1px solid ${C.border}`, borderRadius: 6, color: C.textMid, fontSize: 12, fontFamily: "monospace", cursor: "pointer" }}>
            ↻
          </button>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "16px 14px" }}>

        {/* HOME */}
        {tab === "home" && (<div>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "24px 20px", marginBottom: 16, textAlign: "center" }}>
            <div style={{ fontSize: 10, color: C.textDim, fontFamily: "monospace", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Portfolio Average</div>
            <div style={{ fontSize: 40, fontWeight: 300, fontFamily: "monospace", color: avgChange > 0 ? C.green : avgChange < 0 ? C.red : C.text, lineHeight: 1.1 }}>{fmtPct(avgChange)}</div>
            <div style={{ fontSize: 12, color: C.textDim, fontFamily: "monospace", marginTop: 8 }}>{ALL_SYMBOLS.length} holdings · {allChanges.filter(c=>c>0).length} up · {allChanges.filter(c=>c<0).length} down</div>
          </div>

          <div style={{ display: "flex", gap: 10, marginBottom: 20, overflowX: "auto", paddingBottom: 4 }}>
            {Object.entries(SLEEVES).map(([k, s]) => {
              const stats = getSleeveStats(k);
              return (
                <div key={k} onClick={() => { setActiveSleeve(k); setTab("holdings"); }}
                  style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "18px 16px", cursor: "pointer", flex: "1 1 0", minWidth: 140 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{s.name}</div>
                      <div style={{ fontSize: 10, color: C.textDim, fontFamily: "monospace", marginTop: 2 }}>{stats.total} positions</div>
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 600, fontFamily: "monospace", color: stats.avg > 0 ? C.green : stats.avg < 0 ? C.red : C.textMid }}>{fmtPct(stats.avg)}</div>
                  </div>
                  <div style={{ display: "flex", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 6, height: 6, borderRadius: 3, background: C.green }} /><span style={{ fontSize: 11, color: C.textMid, fontFamily: "monospace" }}>{stats.up}</span></div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 6, height: 6, borderRadius: 3, background: C.red }} /><span style={{ fontSize: 11, color: C.textMid, fontFamily: "monospace" }}>{stats.down}</span></div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: C.textDim, fontFamily: "monospace", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>Heat Map</div>
            {Object.entries(SLEEVES).map(([key, sleeve]) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: C.textFaint, fontFamily: "monospace", marginBottom: 6, letterSpacing: 1 }}>{sleeve.name}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {sleeve.symbols.map(sym => {
                    const change = getChange(sym), intensity = change ? Math.min(Math.abs(change)/3, 1) : 0;
                    const bg = change > 0 ? `rgba(92,184,92,${0.12+intensity*0.4})` : change < 0 ? `rgba(217,83,79,${0.12+intensity*0.4})` : C.accentBg;
                    return (
                      <div key={sym} onClick={() => { setSelectedStock(sym); setTab("holdings"); }}
                        style={{ padding: "6px 8px", background: bg, borderRadius: 6, cursor: "pointer", minWidth: 52, textAlign: "center" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: C.text, fontFamily: "monospace" }}>{sym}</div>
                        <div style={{ fontSize: 9, fontFamily: "monospace", color: change > 0 ? C.green : change < 0 ? C.red : C.textDim, marginTop: 1 }}>{fmtPct(change)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ fontSize: 10, color: C.green, fontFamily: "monospace", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Top Gainers</div>
              {topGainers.map((sym, i) => <MoverRow key={sym} sym={sym} rank={i+1} />)}
            </div>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ fontSize: 10, color: C.red, fontFamily: "monospace", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Top Decliners</div>
              {topLosers.map((sym, i) => <MoverRow key={sym} sym={sym} rank={i+1} />)}
            </div>
          </div>
        </div>)}

        {/* HOLDINGS */}
        {tab === "holdings" && (<div>
          <input type="text" placeholder="Search ticker..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: "100%", padding: "10px 14px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 14, fontFamily: "monospace", outline: "none", boxSizing: "border-box", marginBottom: 10 }} />
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 10 }}>
            <Pill active={activeSleeve==="all"} onClick={() => setActiveSleeve("all")}>All ({ALL_SYMBOLS.length})</Pill>
            {Object.entries(SLEEVES).map(([k,s]) => <Pill key={k} active={activeSleeve===k} onClick={() => setActiveSleeve(k)}>{s.short} ({s.symbols.length})</Pill>)}
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {[{f:"symbol",l:"A-Z"},{f:"price",l:"Price"},{f:"change",l:"Change"},{f:"volume",l:"Vol"}].map(({f,l}) => (
              <Pill key={f} active={sortField===f} onClick={() => { if (sortField===f) setSortDir(d=>d==="asc"?"desc":"asc"); else { setSortField(f); setSortDir(f==="change"?"desc":"asc"); }}} style={{ fontSize: 10, padding: "5px 10px" }}>
                {l} {sortField===f ? (sortDir==="asc" ? "↑" : "↓") : ""}
              </Pill>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{filteredSymbols.map(sym => <StockCard key={sym} sym={sym} />)}</div>
        </div>)}

        {/* SCREENER */}
        {tab === "screener" && (<div>
          <div style={{ fontSize: 11, color: C.textDim, fontFamily: "monospace", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Excellence Evaluation</div>
          <div style={{ fontSize: 13, color: C.textFaint, marginBottom: 16, lineHeight: 1.5 }}>Score each holding 1–10 across 8 dimensions.</div>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 14, paddingBottom: 4 }}>
            <Pill active={activeSleeve==="all"} onClick={() => setActiveSleeve("all")}>All</Pill>
            {Object.entries(SLEEVES).map(([k,s]) => <Pill key={k} active={activeSleeve===k} onClick={() => setActiveSleeve(k)}>{s.short}</Pill>)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(activeSleeve === "all" ? ALL_SYMBOLS : SLEEVES[activeSleeve]?.symbols || []).map(sym => {
              const scores = screenScores[sym] || {}, composite = getCompositeScore(sym), isOpen = selectedStock === sym;
              return (
                <div key={sym} onClick={() => setSelectedStock(isOpen ? null : sym)}
                  style={{ background: C.card, border: `1px solid ${isOpen ? C.accent+"44" : C.border}`, borderRadius: 12, padding: "14px 16px", cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: "monospace" }}>{sym}</span>
                      <span style={{ fontSize: 9, color: getSleeveForSymbol(sym)?.accent, fontFamily: "monospace", background: getSleeveForSymbol(sym)?.bg, padding: "2px 6px", borderRadius: 4 }}>{getSleeveForSymbol(sym)?.short}</span>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "monospace", color: composite ? (composite >= 7 ? C.green : composite >= 5 ? "#C4A83A" : C.red) : C.textFaint }}>{composite ? composite.toFixed(1) : "—"}</div>
                  </div>
                  <div style={{ display: "flex", gap: 3, marginTop: 10 }}>
                    {DIMENSIONS.map(d => <div key={d.key} style={{ flex: 1, height: 4, borderRadius: 2, background: scores[d.key] ? `rgba(92,184,92,${scores[d.key]/10})` : C.accentBg }} />)}
                  </div>
                  {isOpen && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        {DIMENSIONS.map(d => (
                          <div key={d.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 14 }}>{d.icon}</span>
                            <span style={{ fontSize: 11, color: C.textMid, fontFamily: "monospace", flex: 1 }}>{d.label}</span>
                            <input type="number" min="1" max="10" value={scores[d.key] || ""} onChange={e => { const v = parseInt(e.target.value); if (v >= 1 && v <= 10) updateScore(sym, d.key, v); else if (!e.target.value) updateScore(sym, d.key, undefined); }}
                              style={{ width: 40, padding: "5px 4px", background: scores[d.key] ? "rgba(92,184,92,0.15)" : "rgba(8,12,4,0.6)", border: `1px solid ${scores[d.key] ? C.green+"44" : C.border}`, borderRadius: 6, color: C.text, fontSize: 14, fontFamily: "monospace", textAlign: "center", outline: "none" }} />
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 14 }}>{GAME_OVERLAY.icon}</span>
                        <span style={{ fontSize: 11, color: C.textMid, fontFamily: "monospace", flex: 1 }}>{GAME_OVERLAY.label}</span>
                        <div style={{ display: "flex", gap: 4 }}>
                          {[{v:"infinite",l:"♾️ Inf"},{v:"finite",l:"⏳ Fin"},{v:"mixed",l:"🔄 Mix"}].map(({v,l}) => (
                            <button key={v} onClick={() => updateScore(sym, GAME_OVERLAY.key, scores[GAME_OVERLAY.key]===v ? undefined : v)}
                              style={{ padding: "4px 8px", background: scores[GAME_OVERLAY.key]===v ? "rgba(122,143,90,0.25)" : "transparent", border: `1px solid ${scores[GAME_OVERLAY.key]===v ? C.accent+"55" : C.border}`, borderRadius: 6, color: scores[GAME_OVERLAY.key]===v ? C.text : C.textDim, fontSize: 10, fontFamily: "monospace", cursor: "pointer" }}>{l}</button>
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

        {/* SETTINGS */}
        {tab === "settings" && (<div>
          <div style={{ fontSize: 11, color: C.textDim, fontFamily: "monospace", letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>Settings</div>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "18px 16px" }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: C.textMid, marginBottom: 8 }}>Auto-Refresh Interval</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[{v:null,l:"Off"},{v:15,l:"15s"},{v:30,l:"30s"},{v:60,l:"60s"}].map(({v,l}) => <Pill key={l} active={refreshInterval===v} onClick={() => setRefreshInterval(v)}>{l}</Pill>)}
              </div>
            </div>
            <div style={{ paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 12, color: C.textMid, marginBottom: 8 }}>Data Source</div>
              <div style={{ fontSize: 12, color: C.textDim, fontFamily: "monospace" }}>Alpaca Markets · IEX Feed · Free Tier</div>
            </div>
            <div style={{ paddingTop: 16, marginTop: 16, borderTop: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 12, color: C.textMid, marginBottom: 8 }}>Connection</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: C.green }} />
                <span style={{ fontSize: 12, color: C.textDim, fontFamily: "monospace" }}>Connected · {Object.keys(quotes).length} symbols</span>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 24, textAlign: "center" }}>
            <ShieldIcon size={48} />
            <div style={{ fontSize: 10, color: C.textFaint, fontFamily: "monospace", marginTop: 8, letterSpacing: 2 }}>IOWN · INTENTIONAL OWNERSHIP</div>
            <div style={{ fontSize: 9, color: C.textFaint, fontFamily: "monospace", marginTop: 4 }}>A Registered Investment Advisor under Paradiem</div>
          </div>
        </div>)}
      </div>

      {/* BOTTOM TAB BAR */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(8,12,4,0.95)", backdropFilter: "blur(16px)", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-around", padding: "6px 0 env(safe-area-inset-bottom, 8px)", zIndex: 100 }}>
        {[{ id: "home", icon: "◎", label: "Home" }, { id: "holdings", icon: "▤", label: "Holdings" }, { id: "screener", icon: "◈", label: "Screen" }, { id: "settings", icon: "⚙", label: "Settings" }].map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setSelectedStock(null); }}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "6px 16px", background: "transparent", border: "none", cursor: "pointer", color: tab === t.id ? C.accent : C.textDim }}>
            <span style={{ fontSize: 18 }}>{t.icon}</span>
            <span style={{ fontSize: 9, fontFamily: "monospace", letterSpacing: 1 }}>{t.label}</span>
          </button>
        ))}
      </div>

      <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.3 } } * { -webkit-tap-highlight-color:transparent } input::placeholder { color:${C.textFaint} }`}</style>
    </div>
  );
}
