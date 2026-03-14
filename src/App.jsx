import { useState, useEffect, useCallback, useRef, useMemo } from "react";

/* ═══════════════════════════════════════════════════════════════════
   IOWN PORTFOLIO COMMAND CENTER
   ═══════════════════════════════════════════════════════════════════ */

const SLEEVES = {
  dividend: { name: "Dividend", short: "DIV", symbols: ["ABT","A","ADI","ATO","ADP","BKH","CAT","CHD","CL","FAST","GD","GPC","LRCX","LMT","MATX","NEE","ORI","PCAR","QCOM","DGX","SSNC","STLD","SYK","TEL","VLO"], tag: "#5B8C3E", icon: "💎" },
  growth: { name: "Growth Hybrid", short: "GRO", symbols: ["AMD","AEM","ATAT","CVX","CWAN","CNX","COIN","EIX","FINV","FTNT","GFI","SUPV","HRMY","HUT","KEYS","MARA","NVDA","NXPI","OKE","PDD","HOOD","SYF","TSM","TOL"], tag: "#3D7A5A", icon: "🚀" },
  digital: { name: "Digital Assets", short: "ETF", symbols: ["IBIT","ETHA"], tag: "#2A6B6B", icon: "₿" },
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

const fmt = n => (n == null || isNaN(n)) ? "—" : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = n => (n == null || isNaN(n)) ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
const vol = n => !n ? "—" : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : `${n}`;

/* ── Design Tokens ── */
const C = {
  bg: "#080B05",
  surface: "#0E120A",
  card: "#141A0F",
  cardHover: "#1B2315",
  elevated: "#1F2918",
  border: "rgba(120,140,88,0.07)",
  borderHover: "rgba(120,140,88,0.18)",
  borderActive: "rgba(120,140,88,0.30)",
  t1: "#EBF0E1",
  t2: "#B8C9A0",
  t3: "#6E8450",
  t4: "#3A4A28",
  up: "#34D399",
  upSoft: "#34D39920",
  upGlow: "#34D39940",
  dn: "#F87171",
  dnSoft: "#F8717120",
  dnGlow: "#F8717140",
  accent: "#6E8450",
  accentSoft: "rgba(110,132,80,0.10)",
  accentGlow: "rgba(110,132,80,0.30)",
  gold: "#D4A857",
  goldSoft: "rgba(212,168,87,0.10)",
};

/* ── Mini Sparkline (generates from OHLC) ── */
function Sparkline({ bar, chg, width = 56, height = 24 }) {
  if (!bar || !bar.o) return <div style={{ width, height }} />;
  const pts = [bar.o, (bar.o + bar.h) / 2, bar.h, (bar.h + bar.l) / 2, bar.l, (bar.l + bar.c) / 2, bar.c];
  const mn = Math.min(...pts), mx = Math.max(...pts), rng = mx - mn || 1;
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${(i / (pts.length - 1)) * width},${height - 2 - ((p - mn) / rng) * (height - 4)}`).join(" ");
  const color = chg >= 0 ? C.up : C.dn;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block", flexShrink: 0 }}>
      <defs>
        <linearGradient id={`sg-${chg >= 0 ? "up" : "dn"}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${width},${height} L0,${height} Z`} fill={`url(#sg-${chg >= 0 ? "up" : "dn"})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── TradingView Chart Overlay ── */
function ChartOverlay({ symbol, onClose }) {
  const containerRef = useRef(null);
  const [interval, setInterval_] = useState("D");

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = "";
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true, symbol, interval, timezone: "Etc/UTC", theme: "dark",
      style: "1", locale: "en", backgroundColor: C.bg,
      gridColor: "rgba(110,132,80,0.05)", allow_symbol_change: true,
      hide_volume: false, support_host: "https://www.tradingview.com",
    });
    containerRef.current.appendChild(script);
  }, [symbol, interval]);

  const intervals = [
    { v: "1", l: "1m" }, { v: "5", l: "5m" }, { v: "15", l: "15m" },
    { v: "D", l: "1D" }, { v: "W", l: "1W" }, { v: "M", l: "1M" },
  ];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000, background: C.bg,
      display: "flex", flexDirection: "column",
      paddingTop: "env(safe-area-inset-top, 0px)",
      animation: "slideUp 0.3s cubic-bezier(0.16,1,0.3,1)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 18px", borderBottom: `1px solid ${C.border}`, flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: 1, color: C.t1 }}>{symbol}</span>
          <div style={{ display: "flex", gap: 4 }}>
            {intervals.map(({ v, l }) => (
              <button key={v} onClick={() => setInterval_(v)} style={{
                padding: "5px 10px", borderRadius: 8, border: "none", cursor: "pointer",
                fontSize: 11, fontWeight: 600, letterSpacing: 0.5,
                background: interval === v ? C.accentSoft : "transparent",
                color: interval === v ? C.t1 : C.t4,
                transition: "all 0.2s",
              }}>{l}</button>
            ))}
          </div>
        </div>
        <button onClick={onClose} style={{
          width: 36, height: 36, borderRadius: 10, background: C.surface,
          border: `1px solid ${C.border}`, display: "flex", alignItems: "center",
          justifyContent: "center", cursor: "pointer", transition: "all 0.15s",
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.t2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div ref={containerRef} style={{ flex: 1, width: "100%", paddingBottom: "env(safe-area-inset-bottom, 0px)" }} className="tradingview-widget-container" />
    </div>
  );
}

/* ── Pull to Refresh ── */
function usePullToRefresh(onRefresh, enabled) {
  const [pulling, setPulling] = useState(false);
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const scrollRef = useRef(null);
  const threshold = 80;

  const onTouchStart = useCallback((e) => {
    if (!enabled) return;
    const el = scrollRef.current;
    if (el && el.scrollTop <= 0) { startY.current = e.touches[0].clientY; setPulling(true); }
  }, [enabled]);

  const onTouchMove = useCallback((e) => {
    if (!pulling || refreshing) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0) setPullY(Math.min(delta * 0.5, 120));
  }, [pulling, refreshing]);

  const onTouchEnd = useCallback(async () => {
    if (!pulling) return;
    if (pullY >= threshold && !refreshing) { setRefreshing(true); await onRefresh(); setRefreshing(false); }
    setPulling(false); setPullY(0);
  }, [pulling, pullY, refreshing, onRefresh]);

  return { pullY, refreshing, scrollRef, onTouchStart, onTouchMove, onTouchEnd };
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════════════════════════════ */
export default function App() {
  const [unlocked, setUnlocked] = useState(false);
  const [code, setCode] = useState("");
  const [codeErr, setCodeErr] = useState(false);
  const [codeFocused, setCodeFocused] = useState(false);
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
  const [chartSymbol, setChartSymbol] = useState(null);
  const [mounted, setMounted] = useState(false);
  const iRef = useRef(null);

  useEffect(() => { requestAnimationFrame(() => setMounted(true)); }, []);

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

  const { pullY, refreshing, scrollRef, onTouchStart, onTouchMove, onTouchEnd } = usePullToRefresh(fetchData, authed);

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

  /* ━━━ PASSWORD GATE ━━━ */
  if (!unlocked) {
    return (
      <div style={{
        minHeight: "100dvh", background: C.bg, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", padding: 24,
        paddingTop: "env(safe-area-inset-top, 24px)",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: "20%", left: "50%", transform: "translate(-50%, -50%)",
          width: 500, height: 500, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(110,132,80,0.06) 0%, transparent 70%)",
          pointerEvents: "none", filter: "blur(60px)",
        }} />
        <div style={{
          width: "100%", maxWidth: 380, textAlign: "center",
          opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(20px)",
          transition: "all 0.8s cubic-bezier(0.16,1,0.3,1)",
        }}>
          <div style={{
            width: 80, height: 80, borderRadius: 24, margin: "0 auto 32px",
            background: `linear-gradient(160deg, ${C.card} 0%, ${C.elevated} 100%)`,
            border: `1px solid ${C.borderHover}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 8px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)`,
          }}>
            <span style={{ fontSize: 28, fontWeight: 900, letterSpacing: 2, color: C.t3 }}>I</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: C.t1, marginBottom: 8, letterSpacing: -0.5, lineHeight: 1.2 }}>Welcome to IOWN</h1>
          <p style={{ fontSize: 14, color: C.t3, marginBottom: 40, lineHeight: 1.5 }}>Enter your access code to continue</p>
          <div style={{
            background: C.surface, borderRadius: 20, padding: 28,
            border: `1px solid ${codeFocused ? C.borderActive : C.border}`,
            boxShadow: `0 16px 64px rgba(0,0,0,0.3)`,
            transition: "border-color 0.3s",
          }}>
            <input type="password" value={code}
              onChange={e => { setCode(e.target.value); setCodeErr(false); }}
              onKeyDown={e => { if (e.key === "Enter") { if (code === ACCESS_CODE) setUnlocked(true); else setCodeErr(true); } }}
              onFocus={() => setCodeFocused(true)} onBlur={() => setCodeFocused(false)}
              placeholder="Access code"
              style={{
                width: "100%", padding: "18px 20px", background: C.bg,
                border: `1px solid ${codeErr ? C.dn + "66" : C.border}`,
                borderRadius: 14, color: C.t1, fontSize: 16, outline: "none",
                boxSizing: "border-box", textAlign: "center", letterSpacing: 4,
                transition: "border-color 0.2s", fontFamily: "inherit",
              }} />
            <button onClick={() => { if (code === ACCESS_CODE) setUnlocked(true); else setCodeErr(true); }}
              style={{
                width: "100%", padding: 18, marginTop: 16,
                background: `linear-gradient(135deg, #4A6B25, #2D4A12)`,
                border: "none", borderRadius: 14, color: "#fff", fontSize: 15,
                fontWeight: 600, cursor: "pointer", letterSpacing: 0.5, fontFamily: "inherit",
                boxShadow: "0 4px 24px rgba(74,107,37,0.3), inset 0 1px 0 rgba(255,255,255,0.1)",
                transition: "all 0.2s",
              }}>Continue</button>
            {codeErr && <div style={{ marginTop: 16, color: C.dn, fontSize: 13, fontWeight: 500, animation: "shake 0.4s ease-in-out" }}>Incorrect access code</div>}
          </div>
          <div style={{ marginTop: 40, fontSize: 12, color: C.t4, letterSpacing: 0.3 }}>Authorized IOWN team members only</div>
        </div>
        <GlobalStyles />
      </div>
    );
  }

  /* ━━━ API KEY SCREEN ━━━ */
  if (!authed) {
    return (
      <div style={{ minHeight: "100dvh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, paddingTop: "env(safe-area-inset-top, 24px)" }}>
        <div style={{ width: "100%", maxWidth: 420, textAlign: "center", animation: "fadeIn 0.6s cubic-bezier(0.16,1,0.3,1)" }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: C.t1, marginBottom: 8, letterSpacing: -0.5 }}>Connect Market Data</h1>
          <p style={{ fontSize: 14, color: C.t3, marginBottom: 36, lineHeight: 1.5 }}>Link your Alpaca API keys to begin</p>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: 28, textAlign: "left", boxShadow: `0 16px 64px rgba(0,0,0,0.3)` }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t3, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>API Key</label>
            <input type="text" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="APCA-API-KEY-ID"
              style={{ width: "100%", padding: "16px 18px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, color: C.t1, fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 20, transition: "border-color 0.2s", fontFamily: "inherit" }} />
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t3, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>Secret Key</label>
            <input type="password" value={apiSecret} onChange={e => setApiSecret(e.target.value)} placeholder="APCA-API-SECRET-KEY"
              style={{ width: "100%", padding: "16px 18px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, color: C.t1, fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 28, transition: "border-color 0.2s", fontFamily: "inherit" }} />
            <button onClick={auth} style={{ width: "100%", padding: 18, background: "linear-gradient(135deg, #4A6B25, #2D4A12)", border: "none", borderRadius: 14, color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 24px rgba(74,107,37,0.3), inset 0 1px 0 rgba(255,255,255,0.1)", transition: "all 0.2s" }}>Connect</button>
            {authErr && <div style={{ marginTop: 14, color: C.dn, fontSize: 13, fontWeight: 500, textAlign: "center" }}>{authErr}</div>}
          </div>
        </div>
        <GlobalStyles />
      </div>
    );
  }

  /* ━━━ MAIN DASHBOARD ━━━ */
  const allC = ALL.map(chg).filter(c => c !== null);
  const fsyms = filtered();

  const Pill = ({ on, children, onClick, s: style }) => (
    <button onClick={onClick} style={{
      padding: "7px 14px", background: on ? C.accentSoft : "transparent",
      border: on ? `1px solid ${C.borderActive}` : `1px solid ${C.border}`,
      borderRadius: 10, color: on ? C.t1 : C.t3, fontSize: 12, fontWeight: 600,
      cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit",
      transition: "all 0.2s cubic-bezier(0.16,1,0.3,1)",
      letterSpacing: 0.3, ...style,
    }}>{children}</button>
  );

  const Section = ({ title, sub, right, children }) => (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14, paddingTop: 4 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.t1, letterSpacing: -0.3 }}>{title}</div>
          {sub && <div style={{ fontSize: 12, color: C.t4, marginTop: 3 }}>{sub}</div>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );

  const Ticker = ({ s, idx }) => {
    const q = quotes[s], b = bars[s], c = chg(s), sl = sleeveOf(s), open = sel === s;
    return (
      <div
        onClick={() => setSel(open ? null : s)}
        style={{ cursor: "pointer", animation: `fadeSlideIn 0.3s cubic-bezier(0.16,1,0.3,1) ${Math.min(idx * 0.02, 0.3)}s both` }}
      >
        {/* Main row — Robinhood style: name | sparkline | change badge */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 0",
        }}>
          <div style={{ minWidth: 0, flex: "0 0 auto", width: 90 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.t1, letterSpacing: 0.3 }}>{s}</div>
            <div style={{ fontSize: 12, color: C.t4, fontWeight: 500, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sl?.name}</div>
          </div>
          <div style={{ flex: 1, display: "flex", justifyContent: "center", padding: "0 12px" }}>
            <Sparkline bar={b} chg={c || 0} width={80} height={28} />
          </div>
          <div style={{
            padding: "6px 12px", borderRadius: 8, minWidth: 78, textAlign: "center",
            fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums",
            color: c > 0 ? C.up : c < 0 ? C.dn : C.t3,
            border: `1px solid ${c > 0 ? C.up + "44" : c < 0 ? C.dn + "44" : C.border}`,
            background: c > 0 ? C.upSoft : c < 0 ? C.dnSoft : "transparent",
          }}>{pct(c)}</div>
        </div>
        {/* Expanded detail panel */}
        {open && (
          <div style={{ paddingBottom: 14, animation: "fadeIn 0.25s ease" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
              {[["Open", fmt(b?.o)], ["High", fmt(b?.h)], ["Low", fmt(b?.l)], ["Prev Cl", fmt(b?.pc)], ["VWAP", fmt(b?.vw)], ["Volume", vol(b?.v)]].map(([l, v]) => (
                <div key={l} style={{ padding: "8px 10px", background: C.card, borderRadius: 10, border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.t4, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 4 }}>{l}</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: C.t2, fontVariantNumeric: "tabular-nums" }}>{v}</div>
                </div>
              ))}
            </div>
            <button onClick={(e) => { e.stopPropagation(); setChartSymbol(s); }} style={{
              width: "100%", padding: "13px 0", background: C.accentSoft,
              border: `1px solid ${C.borderActive}`, borderRadius: 12,
              color: C.t1, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "all 0.2s",
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.t2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              Open Chart
            </button>
          </div>
        )}
        {/* Divider line */}
        {!open && <div style={{ height: 1, background: C.border }} />}
      </div>
    );
  };

  return (
    <div ref={scrollRef} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      style={{ minHeight: "100dvh", background: C.bg, color: C.t1, paddingBottom: 90, overflowY: "auto" }}>

      {/* Pull to refresh */}
      {(pullY > 0 || refreshing) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: pullY > 0 ? pullY : 50, overflow: "hidden", transition: pullY > 0 ? "none" : "height 0.3s ease", paddingTop: "env(safe-area-inset-top, 0px)" }}>
          <div style={{ width: 24, height: 24, borderRadius: 12, border: `2px solid ${C.border}`, borderTopColor: refreshing ? C.up : (pullY >= 80 ? C.up : C.t4), animation: refreshing ? "spin 0.7s linear infinite" : "none", transition: "border-color 0.2s" }} />
        </div>
      )}

      {/* HEADER */}
      <div style={{
        padding: "12px 18px", paddingTop: "calc(env(safe-area-inset-top, 12px) + 12px)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: `1px solid ${C.border}`,
        background: "rgba(8,11,5,0.88)", backdropFilter: "blur(24px) saturate(1.2)", WebkitBackdropFilter: "blur(24px) saturate(1.2)",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: 2.5, color: C.t1 }}>IOWN</span>
          {loading && <div style={{ width: 6, height: 6, borderRadius: 3, background: C.up, boxShadow: `0 0 8px ${C.upGlow}`, animation: "pulse 1.2s ease-in-out infinite" }} />}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {lastUp && <span style={{ fontSize: 11, color: C.t4, letterSpacing: 0.3 }}>{lastUp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
          <button onClick={fetchData} disabled={loading} style={{
            width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center",
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, cursor: "pointer", transition: "all 0.15s",
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.t3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: loading ? "spin 1s linear infinite" : "none" }}>
              <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "16px 16px" }}>

        {/* ━━━ HOME ━━━ */}
        {tab === "home" && (<div style={{ animation: "fadeIn 0.35s ease" }}>

          {/* Strategies */}
          <Section title="Strategies" right={
            <span onClick={() => setTab("list")} style={{ fontSize: 12, color: C.t3, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontWeight: 500, transition: "color 0.2s" }}>
              View all <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
            </span>
          }>
            <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8, scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", marginLeft: -4, paddingLeft: 4 }}>
              {Object.entries(SLEEVES).map(([k, s], i) => {
                const st = sleeveStats(k);
                return (
                  <div key={k} onClick={() => { setSleeve(k); setTab("list"); }} style={{
                    background: C.card, border: `1px solid ${C.border}`, borderRadius: 18,
                    padding: "20px 20px", cursor: "pointer", minWidth: 170, flex: "0 0 auto",
                    scrollSnapAlign: "start", transition: "all 0.2s",
                    animation: `fadeSlideIn 0.4s cubic-bezier(0.16,1,0.3,1) ${i * 0.08}s both`,
                    position: "relative", overflow: "hidden",
                  }}>
                    <div style={{ position: "absolute", top: 0, left: 20, right: 20, height: 2, borderRadius: "0 0 2px 2px", background: `linear-gradient(90deg, transparent, ${s.tag}66, transparent)` }} />
                    <div style={{ fontSize: 24, marginBottom: 10 }}>{s.icon}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, marginBottom: 2, letterSpacing: -0.2 }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: C.t4, fontWeight: 500, marginBottom: 14 }}>{st.n} positions</div>
                    <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 10, letterSpacing: -0.5, color: st.avg > 0 ? C.up : st.avg < 0 ? C.dn : C.t3 }}>{pct(st.avg)}</div>
                    <div style={{ display: "flex", height: 3, borderRadius: 2, overflow: "hidden", gap: 2 }}>
                      <div style={{ flex: st.up || 0, background: C.up, borderRadius: 2, minWidth: st.up ? 4 : 0, transition: "flex 0.5s ease" }} />
                      <div style={{ flex: st.dn || 0, background: C.dn, borderRadius: 2, minWidth: st.dn ? 4 : 0, transition: "flex 0.5s ease" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>

          {/* Top Movers */}
          <Section title="Top Movers" sub="Biggest moves today">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[...allC.length ? ALL.filter(s => chg(s) != null).sort((a, b) => Math.abs(chg(b)) - Math.abs(chg(a))).slice(0, 6) : []].map((s, i) => {
                const c = chg(s), q = quotes[s];
                return (
                  <div key={s} onClick={() => setChartSymbol(s)} style={{
                    background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
                    padding: "14px 14px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
                    transition: "all 0.2s", animation: `fadeSlideIn 0.3s ease ${i * 0.04}s both`,
                  }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>{s}</div>
                      <div style={{ fontSize: 12, color: C.t3, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>${fmt(q?.p)}</div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: c > 0 ? C.up : C.dn, background: c > 0 ? C.upSoft : C.dnSoft, padding: "4px 10px", borderRadius: 8 }}>{pct(c)}</div>
                  </div>
                );
              })}
            </div>
          </Section>
        </div>)}

        {/* ━━━ HOLDINGS ━━━ */}
        {tab === "list" && (<div style={{ animation: "fadeIn 0.3s ease" }}>
          <Section title="Holdings" sub={`${fsyms.length} positions`}>
            <div style={{ position: "relative", marginBottom: 12 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.t4} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}>
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input type="text" placeholder="Search ticker..." value={search} onChange={e => setSearch(e.target.value)}
                style={{ width: "100%", padding: "13px 14px 13px 42px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, color: C.t1, fontSize: 14, fontWeight: 500, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s", fontFamily: "inherit" }} />
            </div>
            <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 10, paddingBottom: 4 }}>
              <Pill on={sleeve === "all"} onClick={() => setSleeve("all")}>All {ALL.length}</Pill>
              {Object.entries(SLEEVES).map(([k, s]) => <Pill key={k} on={sleeve === k} onClick={() => setSleeve(k)}>{s.icon} {s.short} {s.symbols.length}</Pill>)}
            </div>
            <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
              {[{ f: "symbol", l: "A–Z" }, { f: "price", l: "Price" }, { f: "change", l: "Change" }, { f: "volume", l: "Vol" }].map(({ f, l }) => (
                <Pill key={f} on={sort.f === f} onClick={() => toggleSort(f)} s={{ fontSize: 11, padding: "6px 10px" }}>
                  {l}{sort.f === f ? (sort.d === "asc" ? " ↑" : " ↓") : ""}
                </Pill>
              ))}
            </div>
            <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: "0 16px" }}>
              {fsyms.map((s, i) => <Ticker key={s} s={s} idx={i} />)}
            </div>
          </Section>
        </div>)}

        {/* ━━━ SCREENER ━━━ */}
        {tab === "screen" && (<div style={{ animation: "fadeIn 0.3s ease" }}>
          <Section title="Excellence Screener" sub="Score 1–10 across 8 dimensions · Tap to expand">
            <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 14, paddingBottom: 4 }}>
              <Pill on={sleeve === "all"} onClick={() => setSleeve("all")}>All</Pill>
              {Object.entries(SLEEVES).map(([k, s]) => <Pill key={k} on={sleeve === k} onClick={() => setSleeve(k)}>{s.icon} {s.short}</Pill>)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 8 }}>
              {(sleeve === "all" ? ALL : SLEEVES[sleeve]?.symbols || []).map((s, idx) => {
                const sc = scores[s] || {}, comp = composite(s), open = sel === s;
                const filled = DIMS.filter(d => sc[d.k] != null).length;
                return (
                  <div key={s} onClick={() => setSel(open ? null : s)} style={{
                    background: open ? C.cardHover : C.card, border: `1px solid ${open ? C.borderActive : C.border}`,
                    borderRadius: 16, padding: "14px 16px", cursor: "pointer",
                    transition: "all 0.2s cubic-bezier(0.16,1,0.3,1)",
                    animation: `fadeSlideIn 0.3s ease ${Math.min(idx * 0.02, 0.3)}s both`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: C.t1, letterSpacing: 0.5 }}>{s}</span>
                        <span style={{ fontSize: 10, fontWeight: 600, color: C.t3, letterSpacing: 0.5, background: sleeveOf(s)?.tag + "22", padding: "3px 8px", borderRadius: 6 }}>{sleeveOf(s)?.short}</span>
                        <span style={{ fontSize: 11, color: C.t4 }}>{filled}/8</span>
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.5, color: comp ? (comp >= 7 ? C.up : comp >= 5 ? C.gold : C.dn) : C.t4 }}>
                        {comp ? comp.toFixed(1) : "—"}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 3, marginTop: 10 }}>
                      {DIMS.map(d => (<div key={d.k} style={{ flex: 1, height: 4, borderRadius: 2, background: sc[d.k] ? `rgba(52,211,153,${sc[d.k] / 10})` : "rgba(110,132,80,0.06)", transition: "background 0.3s" }} />))}
                    </div>
                    {open && (
                      <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}`, animation: "fadeIn 0.25s ease" }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          {DIMS.map(d => (
                            <div key={d.k} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 10, background: sc[d.k] ? C.accentSoft : "transparent", transition: "background 0.2s" }}>
                              <span style={{ fontSize: 15 }}>{d.i}</span>
                              <span style={{ fontSize: 12, fontWeight: 500, color: C.t3, flex: 1 }}>{d.l}</span>
                              <input type="number" min="1" max="10" value={sc[d.k] || ""} onChange={e => {
                                const v = parseInt(e.target.value);
                                if (v >= 1 && v <= 10) setScores(p => ({ ...p, [s]: { ...(p[s] || {}), [d.k]: v } }));
                                else if (!e.target.value) setScores(p => ({ ...p, [s]: { ...(p[s] || {}), [d.k]: undefined } }));
                              }}
                                style={{ width: 42, padding: "7px 4px", background: sc[d.k] ? C.upSoft : C.bg, border: `1px solid ${sc[d.k] ? C.up + "33" : C.border}`, borderRadius: 8, color: C.t1, fontSize: 15, textAlign: "center", outline: "none", transition: "all 0.2s", fontFamily: "inherit" }} />
                            </div>
                          ))}
                        </div>
                        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 500, color: C.t3, flex: 1 }}>♾️ {GAME.l}</span>
                          <div style={{ display: "flex", gap: 4 }}>
                            {[{ v: "infinite", l: "♾️" }, { v: "finite", l: "⏳" }, { v: "mixed", l: "🔄" }].map(({ v, l }) => (
                              <button key={v} onClick={() => setScores(p => ({ ...p, [s]: { ...(p[s] || {}), [GAME.k]: sc[GAME.k] === v ? undefined : v } }))}
                                style={{ padding: "6px 12px", background: sc[GAME.k] === v ? C.accentSoft : "transparent", border: `1px solid ${sc[GAME.k] === v ? C.borderActive : C.border}`, borderRadius: 8, color: sc[GAME.k] === v ? C.t1 : C.t4, fontSize: 14, cursor: "pointer", transition: "all 0.2s" }}>{l}</button>
                            ))}
                          </div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); setChartSymbol(s); }} style={{
                          width: "100%", padding: "13px 0", marginTop: 12, background: C.accentSoft,
                          border: `1px solid ${C.borderActive}`, borderRadius: 12,
                          color: C.t1, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.2s",
                        }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.t2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
                          Open Chart
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>
        </div>)}

        {/* ━━━ SETTINGS ━━━ */}
        {tab === "settings" && (<div style={{ animation: "fadeIn 0.3s ease" }}>
          <Section title="Settings">
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: "22px 20px", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginBottom: 12, letterSpacing: -0.2 }}>Auto-Refresh Interval</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[{ v: null, l: "Off" }, { v: 15, l: "15s" }, { v: 30, l: "30s" }, { v: 60, l: "60s" }].map(({ v, l }) =>
                  <Pill key={l} on={refresh === v} onClick={() => setRefresh(v)}>{l}</Pill>
                )}
              </div>
            </div>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: "22px 20px", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginBottom: 12, letterSpacing: -0.2 }}>Connection Status</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: C.up, boxShadow: `0 0 8px ${C.upGlow}` }} />
                <span style={{ fontSize: 13, color: C.t2, fontWeight: 500 }}>{Object.keys(quotes).length} symbols connected</span>
              </div>
              <div style={{ fontSize: 12, color: C.t4, marginTop: 6 }}>Data feed: IEX · Alpaca Markets</div>
            </div>
          </Section>
          <div style={{ marginTop: 40, textAlign: "center", paddingBottom: 20 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, margin: "0 auto 16px", background: C.card, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 18, fontWeight: 900, color: C.t3, letterSpacing: 2 }}>I</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.t3, letterSpacing: 3, marginBottom: 6 }}>IOWN</div>
            <div style={{ fontSize: 13, color: C.t4, lineHeight: 1.5 }}>Intentional Ownership</div>
            <div style={{ fontSize: 11, color: C.t4, marginTop: 4 }}>A Registered Investment Advisor under Paradiem</div>
          </div>
        </div>)}
      </div>

      {/* BOTTOM TAB BAR */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
        background: "rgba(8,11,5,0.88)", backdropFilter: "blur(28px) saturate(1.4)", WebkitBackdropFilter: "blur(28px) saturate(1.4)",
        borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-around",
        padding: "6px 0", paddingBottom: "calc(env(safe-area-inset-bottom, 8px) + 6px)",
      }}>
        {[
          { id: "home", label: "Home", icon: (a) => <svg width="21" height="21" viewBox="0 0 24 24" fill={a ? C.accentSoft : "none"} stroke={a ? C.t1 : C.t4} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg> },
          { id: "list", label: "Holdings", icon: (a) => <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={a ? C.t1 : C.t4} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" /></svg> },
          { id: "screen", label: "Screen", icon: (a) => <svg width="21" height="21" viewBox="0 0 24 24" fill={a ? C.accentSoft : "none"} stroke={a ? C.t1 : C.t4} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg> },
          { id: "settings", label: "Settings", icon: (a) => <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={a ? C.t1 : C.t4} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg> },
        ].map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setSel(null); }} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            padding: "6px 20px", background: "transparent", border: "none", cursor: "pointer", transition: "all 0.2s",
          }}>
            {t.icon(tab === t.id)}
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.3, color: tab === t.id ? C.t1 : C.t4, transition: "color 0.2s" }}>{t.label}</span>
            <div style={{
              width: tab === t.id ? 4 : 0, height: 4, borderRadius: 2,
              background: C.accent, marginTop: -2,
              transition: "width 0.2s cubic-bezier(0.16,1,0.3,1)",
              boxShadow: tab === t.id ? `0 0 8px ${C.accentGlow}` : "none",
            }} />
          </button>
        ))}
      </div>

      {chartSymbol && <ChartOverlay symbol={chartSymbol} onClose={() => setChartSymbol(null)} />}
      <GlobalStyles />
    </div>
  );
}

function GlobalStyles() {
  return (
    <style>{`
      @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.3 } }
      @keyframes spin { 0% { transform: rotate(0deg) } 100% { transform: rotate(360deg) } }
      @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
      @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
      @keyframes slideUp { from { opacity: 0; transform: translateY(40px) } to { opacity: 1; transform: translateY(0) } }
      @keyframes shake { 0%, 100% { transform: translateX(0) } 20%, 60% { transform: translateX(-6px) } 40%, 80% { transform: translateX(6px) } }
      * { -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
      input::placeholder { color: ${C.t4} !important; }
      input:focus { border-color: ${C.borderActive} !important; }
      ::-webkit-scrollbar { width: 4px; height: 4px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: rgba(110,132,80,0.15); border-radius: 4px; }
      ::-webkit-scrollbar-thumb:hover { background: rgba(110,132,80,0.25); }
      @media (min-width: 768px) { .tradingview-widget-container { min-height: 500px; } }
    `}</style>
  );
}
