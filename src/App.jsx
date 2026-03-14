import { useState, useEffect, useCallback, useRef, useMemo } from "react";

const SLEEVES = {
  dividend: { name: "Dividend", short: "DIV", symbols: ["ABT","A","ADI","ATO","ADP","BKH","CAT","CHD","CL","FAST","GD","GPC","LRCX","LMT","MATX","NEE","ORI","PCAR","QCOM","DGX","SSNC","STLD","SYK","TEL","VLO"], tag: "#2D5016", icon: "💎" },
  growth: { name: "Growth Hybrid", short: "GRO", symbols: ["AMD","AEM","ATAT","CVX","CWAN","CNX","COIN","EIX","FINV","FTNT","GFI","SUPV","HRMY","HUT","KEYS","MARA","NVDA","NXPI","OKE","PDD","HOOD","SYF","TSM","TOL"], tag: "#1E4A2E", icon: "🚀" },
  digital: { name: "Digital Assets", short: "ETF", symbols: ["IBIT","ETHA"], tag: "#1A3D3D", icon: "₿" },
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

const fmt = n => (n == null || isNaN(n)) ? "\u2014" : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = n => (n == null || isNaN(n)) ? "\u2014" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
const vol = n => !n ? "\u2014" : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : `${n}`;

const mono = "'JetBrains Mono', 'SF Mono', monospace";
const sans = "'Inter', -apple-system, sans-serif";

const C = {
  bg: "#0A0E06", surface: "#131A0D", card: "#1A2212", cardHover: "#1F2918",
  border: "rgba(122,143,90,0.08)", borderActive: "rgba(122,143,90,0.25)",
  t1: "#F0F4E8", t2: "#C5D4A8", t3: "#7A8F5A", t4: "#3D4D2D",
  up: "#4ADE80", upBg: "rgba(74,222,128,0.08)", upBorder: "rgba(74,222,128,0.15)",
  dn: "#F87171", dnBg: "rgba(248,113,113,0.08)", dnBorder: "rgba(248,113,113,0.15)",
  accent: "#7A8F5A", accentBg: "rgba(122,143,90,0.1)",
  gold: "#D4A857",
};

/* SVG Icons */
const TabIcon = ({ id, active }) => {
  const color = active ? C.t1 : C.t4;
  const fill = active ? C.accent + "33" : "none";
  if (id === "home") return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" fill={fill} /><polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
  if (id === "list") return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" />
    </svg>
  );
  if (id === "screen") return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" fill={fill} /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
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

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PASSWORD GATE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (!unlocked) {
    return (
      <div style={{ minHeight: "100dvh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: sans }}>
        <div style={{ width: "100%", maxWidth: 360, textAlign: "center" }}>
          <div style={{
            width: 72, height: 72, borderRadius: 20,
            background: `linear-gradient(145deg, ${C.card}, ${C.surface})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 28px", border: `1px solid ${C.border}`,
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.t3} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: C.t1, marginBottom: 6, letterSpacing: -0.5 }}>Welcome to IOWN</div>
          <div style={{ fontSize: 14, color: C.t3, marginBottom: 36 }}>Enter your access code to continue</div>
          <div style={{ background: C.surface, borderRadius: 16, padding: 24, border: `1px solid ${C.border}` }}>
            <input
              type="password" value={code} onChange={e => { setCode(e.target.value); setCodeErr(false); }}
              onKeyDown={e => { if (e.key === "Enter") { if (code === ACCESS_CODE) setUnlocked(true); else setCodeErr(true); } }}
              placeholder="Access code"
              style={{
                width: "100%", padding: "16px 18px", background: C.bg,
                border: `1px solid ${codeErr ? C.dn + "66" : C.border}`,
                borderRadius: 12, color: C.t1, fontSize: 16, fontFamily: sans, outline: "none",
                boxSizing: "border-box", textAlign: "center", letterSpacing: 3,
              }}
            />
            <button onClick={() => { if (code === ACCESS_CODE) setUnlocked(true); else setCodeErr(true); }}
              style={{
                width: "100%", padding: 16, marginTop: 14,
                background: "linear-gradient(135deg, #4A6B25, #2D4A12)",
                border: "none", borderRadius: 12, color: "#fff", fontSize: 15,
                fontWeight: 600, fontFamily: sans, cursor: "pointer", letterSpacing: 0.5,
                boxShadow: "0 4px 20px rgba(74,107,37,0.25)",
              }}>Continue</button>
            {codeErr && <div style={{ marginTop: 14, color: C.dn, fontSize: 13, fontWeight: 500 }}>Incorrect access code</div>}
          </div>
          <div style={{ marginTop: 32, fontSize: 12, color: C.t4 }}>Authorized IOWN team members only</div>
        </div>
      </div>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // API KEY SCREEN
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (!authed) {
    return (
      <div style={{ minHeight: "100dvh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: sans }}>
        <div style={{ width: "100%", maxWidth: 400, textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: C.t1, marginBottom: 6, letterSpacing: -0.5 }}>Connect Market Data</div>
          <div style={{ fontSize: 14, color: C.t3, marginBottom: 32 }}>Link your Alpaca API keys to get started</div>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, textAlign: "left" }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.t3, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>API Key</label>
            <input type="text" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="APCA-API-KEY-ID"
              style={{ width: "100%", padding: "14px 16px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, color: C.t1, fontSize: 14, fontFamily: mono, outline: "none", boxSizing: "border-box", marginBottom: 18 }} />
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.t3, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Secret Key</label>
            <input type="password" value={apiSecret} onChange={e => setApiSecret(e.target.value)} placeholder="APCA-API-SECRET-KEY"
              style={{ width: "100%", padding: "14px 16px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, color: C.t1, fontSize: 14, fontFamily: mono, outline: "none", boxSizing: "border-box", marginBottom: 24 }} />
            <button onClick={auth} style={{
              width: "100%", padding: 16, background: "linear-gradient(135deg, #4A6B25, #2D4A12)",
              border: "none", borderRadius: 12, color: "#fff", fontSize: 15, fontWeight: 600,
              fontFamily: sans, cursor: "pointer", boxShadow: "0 4px 20px rgba(74,107,37,0.25)",
            }}>Connect</button>
            {authErr && <div style={{ marginTop: 12, color: C.dn, fontSize: 13, fontWeight: 500, textAlign: "center" }}>{authErr}</div>}
          </div>
        </div>
      </div>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // MAIN DASHBOARD
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const allC = ALL.map(chg).filter(c => c !== null);
  const avgC = allC.length ? allC.reduce((a, b) => a + b, 0) / allC.length : null;
  const gainers = ALL.filter(s => chg(s) !== null).sort((a, b) => chg(b) - chg(a)).slice(0, 5);
  const losers = ALL.filter(s => chg(s) !== null).sort((a, b) => chg(a) - chg(b)).slice(0, 5);
  const fsyms = filtered();

  const Pill = ({ on, children, onClick, s: style }) => (
    <button onClick={onClick} style={{
      padding: "8px 16px", background: on ? C.accentBg : "transparent",
      border: on ? `1px solid ${C.borderActive}` : `1px solid ${C.border}`,
      borderRadius: 20, color: on ? C.t1 : C.t3, fontSize: 13, fontWeight: 500,
      fontFamily: sans, cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.2s", ...style,
    }}>{children}</button>
  );

  const Section = ({ title, sub, right, children }) => (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14, paddingTop: 4 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.t1, letterSpacing: -0.3 }}>{title}</div>
          {sub && <div style={{ fontSize: 12, color: C.t4, marginTop: 2 }}>{sub}</div>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );

  const Ticker = ({ s }) => {
    const q = quotes[s], b = bars[s], c = chg(s), sl = sleeveOf(s), open = sel === s;
    return (
      <div onClick={() => setSel(open ? null : s)} style={{
        background: open ? C.cardHover : C.card,
        border: `1px solid ${open ? C.borderActive : C.border}`,
        borderRadius: 14, padding: "14px 16px", cursor: "pointer", transition: "all 0.15s",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12, background: sl?.tag + "22",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 800, color: C.t2, fontFamily: mono,
              border: `1px solid ${sl?.tag}33`,
            }}>{s.slice(0, 2)}</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.t1, fontFamily: mono, letterSpacing: 0.5 }}>{s}</div>
              <div style={{ fontSize: 11, color: C.t4, fontWeight: 500, marginTop: 2 }}>{sl?.name}</div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.t1, fontFamily: mono }}>${fmt(q?.p)}</div>
            <div style={{
              fontSize: 13, fontWeight: 600, fontFamily: mono, marginTop: 3,
              color: c > 0 ? C.up : c < 0 ? C.dn : C.t3,
              background: c > 0 ? C.upBg : c < 0 ? C.dnBg : "transparent",
              padding: "2px 8px", borderRadius: 6, display: "inline-block",
            }}>{pct(c)}</div>
          </div>
        </div>
        {open && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}`, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {[["Open", fmt(b?.o)], ["High", fmt(b?.h)], ["Low", fmt(b?.l)], ["Prev Cl", fmt(b?.pc)], ["VWAP", fmt(b?.vw)], ["Volume", vol(b?.v)]].map(([l, v]) => (
              <div key={l}>
                <div style={{ fontSize: 10, fontWeight: 600, color: C.t4, letterSpacing: 0.5, textTransform: "uppercase" }}>{l}</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: C.t2, fontFamily: mono, marginTop: 3 }}>{v}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const MoverRow = ({ s, rank }) => {
    const q = quotes[s], c = chg(s);
    return (
      <div onClick={() => { setSel(s); setTab("list"); }} style={{
        display: "flex", alignItems: "center", padding: "12px 0",
        borderBottom: `1px solid ${C.border}`, cursor: "pointer",
      }}>
        <span style={{ fontSize: 11, color: C.t4, fontFamily: mono, width: 20 }}>{rank}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: C.t1, fontFamily: mono, flex: 1 }}>{s}</span>
        <span style={{ fontSize: 14, fontWeight: 500, color: C.t3, fontFamily: mono, marginRight: 12 }}>${fmt(q?.p)}</span>
        <span style={{
          fontSize: 13, fontWeight: 700, fontFamily: mono,
          color: c > 0 ? C.up : c < 0 ? C.dn : C.t3,
          background: c > 0 ? C.upBg : c < 0 ? C.dnBg : "transparent",
          padding: "3px 8px", borderRadius: 6, minWidth: 72, textAlign: "right",
        }}>{pct(c)}</span>
      </div>
    );
  };

  return (
    <div style={{ minHeight: "100dvh", background: C.bg, fontFamily: sans, color: C.t1, paddingBottom: 84 }}>

      {/* HEADER */}
      <div style={{
        padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: `1px solid ${C.border}`, background: "rgba(10,14,6,0.94)",
        backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: 1.5, color: C.t1 }}>IOWN</div>
          {loading && <div style={{ width: 6, height: 6, borderRadius: 3, background: C.up, animation: "pulse 1.2s ease-in-out infinite" }} />}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {lastUp && <span style={{ fontSize: 11, color: C.t4, fontFamily: mono }}>{lastUp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
          <button onClick={fetchData} disabled={loading} style={{
            width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center",
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, cursor: "pointer",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.t3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "16px 16px" }}>

        {/* ━━━ HOME ━━━ */}
        {tab === "home" && (<div>

          {/* Hero Card */}
          <div style={{
            background: `linear-gradient(160deg, ${C.card} 0%, rgba(45,80,22,0.15) 50%, ${C.card} 100%)`,
            border: `1px solid ${C.border}`, borderRadius: 20, padding: "28px 22px", marginBottom: 24,
            position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", top: -40, right: -40, width: 150, height: 150, borderRadius: "50%", background: "rgba(74,222,128,0.04)", filter: "blur(40px)", pointerEvents: "none" }} />
            <div style={{ fontSize: 13, fontWeight: 500, color: C.t3, marginBottom: 6 }}>Portfolio Average</div>
            <div style={{ fontSize: 40, fontWeight: 800, fontFamily: mono, color: avgC > 0 ? C.up : avgC < 0 ? C.dn : C.t1, letterSpacing: -1, lineHeight: 1 }}>{pct(avgC)}</div>
            <div style={{ display: "flex", gap: 16, marginTop: 16, fontSize: 13, fontFamily: mono }}>
              <span style={{ color: C.t3 }}>{ALL.length} holdings</span>
              <span style={{ color: C.up }}>{"\u25B2"} {allC.filter(c => c > 0).length}</span>
              <span style={{ color: C.dn }}>{"\u25BC"} {allC.filter(c => c < 0).length}</span>
            </div>
          </div>

          {/* Strategies — horizontal scroll */}
          <Section title="Strategies" right={
            <span onClick={() => setTab("list")} style={{ fontSize: 13, color: C.t3, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              View all <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.t4} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
            </span>
          }>
            <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6, scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}>
              {Object.entries(SLEEVES).map(([k, s]) => {
                const st = sleeveStats(k);
                return (
                  <div key={k} onClick={() => { setSleeve(k); setTab("list"); }} style={{
                    background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
                    padding: "18px 18px", cursor: "pointer", minWidth: 160, flex: "0 0 auto",
                    scrollSnapAlign: "start",
                  }}>
                    <div style={{ fontSize: 22, marginBottom: 8 }}>{s.icon}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, marginBottom: 2 }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: C.t4, fontFamily: mono, marginBottom: 12 }}>{st.n} positions</div>
                    <div style={{
                      fontSize: 20, fontWeight: 800, fontFamily: mono, marginBottom: 8,
                      color: st.avg > 0 ? C.up : st.avg < 0 ? C.dn : C.t3,
                    }}>{pct(st.avg)}</div>
                    <div style={{ display: "flex", height: 3, borderRadius: 2, overflow: "hidden", gap: 2 }}>
                      <div style={{ flex: st.up || 0, background: C.up, borderRadius: 2, minWidth: st.up ? 4 : 0 }} />
                      <div style={{ flex: st.dn || 0, background: C.dn, borderRadius: 2, minWidth: st.dn ? 4 : 0 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>

          {/* Heat Map */}
          <Section title="Heat Map" sub="Color intensity = magnitude of change">
            {Object.entries(SLEEVES).map(([key, sl]) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: C.t3, fontWeight: 600, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <span>{sl.icon}</span> {sl.name}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {sl.symbols.map(s => {
                    const c = chg(s), intensity = c ? Math.min(Math.abs(c) / 3, 1) : 0;
                    const bg = c > 0 ? `rgba(74,222,128,${0.08 + intensity * 0.3})` : c < 0 ? `rgba(248,113,113,${0.08 + intensity * 0.3})` : "rgba(122,143,90,0.04)";
                    const bc = c > 0 ? `rgba(74,222,128,${0.1 + intensity * 0.2})` : c < 0 ? `rgba(248,113,113,${0.1 + intensity * 0.2})` : C.border;
                    return (
                      <div key={s} onClick={() => { setSel(s); setTab("list"); }} style={{
                        padding: "6px 8px", background: bg, borderRadius: 8, cursor: "pointer",
                        minWidth: 52, textAlign: "center", border: `1px solid ${bc}`,
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: C.t1, fontFamily: mono }}>{s}</div>
                        <div style={{ fontSize: 10, fontFamily: mono, color: c > 0 ? C.up : c < 0 ? C.dn : C.t4, marginTop: 2 }}>{pct(c)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </Section>

          {/* Top Movers */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "16px 16px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.up, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 16 }}>{"\u25B2"}</span> Top Gainers
              </div>
              {gainers.map((s, i) => <MoverRow key={s} s={s} rank={i + 1} />)}
            </div>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "16px 16px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.dn, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 16 }}>{"\u25BC"}</span> Top Decliners
              </div>
              {losers.map((s, i) => <MoverRow key={s} s={s} rank={i + 1} />)}
            </div>
          </div>

        </div>)}

        {/* ━━━ HOLDINGS ━━━ */}
        {tab === "list" && (<div>
          <Section title="Holdings" sub={`${fsyms.length} positions`}>
            {/* Search */}
            <div style={{ position: "relative", marginBottom: 12 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.t4} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}>
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input type="text" placeholder="Search ticker..." value={search} onChange={e => setSearch(e.target.value)}
                style={{
                  width: "100%", padding: "12px 14px 12px 40px", background: C.surface,
                  border: `1px solid ${C.border}`, borderRadius: 12, color: C.t1, fontSize: 14,
                  fontFamily: sans, fontWeight: 500, outline: "none", boxSizing: "border-box",
                }} />
            </div>
            <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 10, paddingBottom: 4 }}>
              <Pill on={sleeve === "all"} onClick={() => setSleeve("all")}>All {ALL.length}</Pill>
              {Object.entries(SLEEVES).map(([k, s]) => <Pill key={k} on={sleeve === k} onClick={() => setSleeve(k)}>{s.icon} {s.short} {s.symbols.length}</Pill>)}
            </div>
            <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
              {[{ f: "symbol", l: "A-Z" }, { f: "price", l: "Price" }, { f: "change", l: "Change" }, { f: "volume", l: "Vol" }].map(({ f, l }) => (
                <Pill key={f} on={sort.f === f} onClick={() => toggleSort(f)} s={{ fontSize: 12, padding: "6px 12px" }}>
                  {l}{sort.f === f ? (sort.d === "asc" ? " \u2191" : " \u2193") : ""}
                </Pill>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {fsyms.map(s => <Ticker key={s} s={s} />)}
            </div>
          </Section>
        </div>)}

        {/* ━━━ SCREENER ━━━ */}
        {tab === "screen" && (<div>
          <Section title="Excellence Screener" sub="Score 1\u201310 across 8 dimensions \u00B7 Tap to expand">
            <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 14, paddingBottom: 4 }}>
              <Pill on={sleeve === "all"} onClick={() => setSleeve("all")}>All</Pill>
              {Object.entries(SLEEVES).map(([k, s]) => <Pill key={k} on={sleeve === k} onClick={() => setSleeve(k)}>{s.icon} {s.short}</Pill>)}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(sleeve === "all" ? ALL : SLEEVES[sleeve]?.symbols || []).map(s => {
                const sc = scores[s] || {}, comp = composite(s), open = sel === s;
                const filled = DIMS.filter(d => sc[d.k] != null).length;
                return (
                  <div key={s} onClick={() => setSel(open ? null : s)} style={{
                    background: open ? C.cardHover : C.card,
                    border: `1px solid ${open ? C.borderActive : C.border}`,
                    borderRadius: 14, padding: "14px 16px", cursor: "pointer", transition: "all 0.15s",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: C.t1, fontFamily: mono }}>{s}</span>
                        <span style={{ fontSize: 10, fontWeight: 600, color: C.t3, background: sleeveOf(s)?.tag + "33", padding: "3px 7px", borderRadius: 6 }}>{sleeveOf(s)?.short}</span>
                        <span style={{ fontSize: 11, color: C.t4, fontFamily: mono }}>{filled}/8</span>
                      </div>
                      <div style={{
                        fontSize: 18, fontWeight: 800, fontFamily: mono,
                        color: comp ? (comp >= 7 ? C.up : comp >= 5 ? C.gold : C.dn) : C.t4,
                      }}>{comp ? comp.toFixed(1) : "\u2014"}</div>
                    </div>
                    <div style={{ display: "flex", gap: 3, marginTop: 10 }}>
                      {DIMS.map(d => (
                        <div key={d.k} style={{
                          flex: 1, height: 4, borderRadius: 2,
                          background: sc[d.k] ? `rgba(74,222,128,${sc[d.k] / 10})` : "rgba(122,143,90,0.05)",
                        }} />
                      ))}
                    </div>
                    {open && (
                      <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          {DIMS.map(d => (
                            <div key={d.k} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 15 }}>{d.i}</span>
                              <span style={{ fontSize: 12, fontWeight: 500, color: C.t3, flex: 1 }}>{d.l}</span>
                              <input type="number" min="1" max="10" value={sc[d.k] || ""} onChange={e => {
                                const v = parseInt(e.target.value);
                                if (v >= 1 && v <= 10) setScores(p => ({ ...p, [s]: { ...(p[s] || {}), [d.k]: v } }));
                                else if (!e.target.value) setScores(p => ({ ...p, [s]: { ...(p[s] || {}), [d.k]: undefined } }));
                              }}
                                style={{
                                  width: 42, padding: "6px 4px",
                                  background: sc[d.k] ? "rgba(74,222,128,0.08)" : C.bg,
                                  border: `1px solid ${sc[d.k] ? C.up + "33" : C.border}`,
                                  borderRadius: 8, color: C.t1, fontSize: 15, fontFamily: mono,
                                  textAlign: "center", outline: "none",
                                }} />
                            </div>
                          ))}
                        </div>
                        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 500, color: C.t3, flex: 1 }}>{"\u267E\uFE0F"} {GAME.l}</span>
                          <div style={{ display: "flex", gap: 4 }}>
                            {[{ v: "infinite", l: "\u267E\uFE0F" }, { v: "finite", l: "\u231B" }, { v: "mixed", l: "\uD83D\uDD04" }].map(({ v, l }) => (
                              <button key={v} onClick={() => setScores(p => ({ ...p, [s]: { ...(p[s] || {}), [GAME.k]: sc[GAME.k] === v ? undefined : v } }))}
                                style={{
                                  padding: "5px 10px",
                                  background: sc[GAME.k] === v ? C.accentBg : "transparent",
                                  border: `1px solid ${sc[GAME.k] === v ? C.borderActive : C.border}`,
                                  borderRadius: 8, color: sc[GAME.k] === v ? C.t1 : C.t4,
                                  fontSize: 14, cursor: "pointer",
                                }}>{l}</button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>
        </div>)}

        {/* ━━━ SETTINGS ━━━ */}
        {tab === "settings" && (<div>
          <Section title="Settings">
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "20px 18px", marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.t1, marginBottom: 10 }}>Auto-Refresh Interval</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[{ v: null, l: "Off" }, { v: 15, l: "15s" }, { v: 30, l: "30s" }, { v: 60, l: "60s" }].map(({ v, l }) =>
                  <Pill key={l} on={refresh === v} onClick={() => setRefresh(v)}>{l}</Pill>
                )}
              </div>
            </div>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "20px 18px", marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.t1, marginBottom: 10 }}>Connection Status</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: C.up, boxShadow: `0 0 8px ${C.up}44` }} />
                <span style={{ fontSize: 13, color: C.t2, fontFamily: mono }}>{Object.keys(quotes).length} symbols connected</span>
              </div>
              <div style={{ fontSize: 12, color: C.t4, marginTop: 6 }}>Data feed: IEX \u00B7 Alpaca Markets</div>
            </div>
          </Section>
          <div style={{ marginTop: 24, textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.t3, letterSpacing: 2, marginBottom: 4 }}>IOWN</div>
            <div style={{ fontSize: 12, color: C.t4 }}>Intentional Ownership</div>
            <div style={{ fontSize: 11, color: C.t4, marginTop: 2 }}>A Registered Investment Advisor under Paradiem</div>
          </div>
        </div>)}

      </div>

      {/* BOTTOM TAB BAR */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
        background: "rgba(10,14,6,0.92)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
        borderTop: `1px solid ${C.border}`,
        display: "flex", justifyContent: "space-around",
        padding: "6px 0 env(safe-area-inset-bottom, 8px)",
      }}>
        {[
          { id: "home", label: "Home" },
          { id: "list", label: "Holdings" },
          { id: "screen", label: "Screen" },
          { id: "settings", label: "Settings" },
        ].map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setSel(null); }} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            padding: "6px 18px", background: "transparent", border: "none", cursor: "pointer",
          }}>
            <TabIcon id={t.id} active={tab === t.id} />
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.3, color: tab === t.id ? C.t1 : C.t4 }}>{t.label}</span>
            {tab === t.id && <div style={{ width: 4, height: 4, borderRadius: 2, background: C.accent, marginTop: -1 }} />}
          </button>
        ))}
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.3 } }
        * { -webkit-tap-highlight-color: transparent; }
        input::placeholder { color: ${C.t4}; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(122,143,90,0.2); border-radius: 4px; }
      `}</style>
    </div>
  );
}
