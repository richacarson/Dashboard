import { useState, useEffect, useCallback, useRef, useMemo } from "react";

/* ═══════════════════════════════════════════════════════════════════
   IOWN PORTFOLIO COMMAND CENTER v3
   - Robinhood-style collapsible sleeve lists
   - Live news feed from Alpaca/Benzinga
   - Company names from /v2/assets
   - Historical bars for richer sparklines
   - WebSocket real-time streaming
   ═══════════════════════════════════════════════════════════════════ */

const DEFAULT_SLEEVES = {
  dividend: { name: "Dividend Strategy", symbols: ["ABT","A","ADI","ATO","ADP","BKH","CAT","CHD","CL","FAST","GD","GPC","LRCX","LMT","MATX","NEE","ORI","PCAR","QCOM","DGX","SSNC","STLD","SYK","TEL","VLO"], icon: "💰" },
  growth: { name: "Growth Strategy", symbols: ["AMD","AEM","ATAT","CVX","CWAN","CNX","COIN","EIX","FINV","FTNT","GFI","SUPV","HRMY","HUT","KEYS","MARA","NVDA","NXPI","OKE","PDD","HOOD","SYF","TSM","TOL"], icon: "🚀" },
  digital: { name: "Digital Assets", symbols: ["IBIT","ETHA"], icon: "₿" },
};
const loadSleeves = () => {
  try {
    const s = localStorage.getItem("iown_sleeves");
    if (!s) return DEFAULT_SLEEVES;
    const parsed = JSON.parse(s);
    // Migrate old icons to new defaults if user hasn't customized
    const oldIcons = ["🏌️", "⏳", "💣"];
    for (const [k, def] of Object.entries(DEFAULT_SLEEVES)) {
      if (parsed[k] && oldIcons.includes(parsed[k].icon)) parsed[k].icon = def.icon;
    }
    return parsed;
  } catch { return DEFAULT_SLEEVES; }
};
const saveSleeves = s => { try { localStorage.setItem("iown_sleeves", JSON.stringify(s)); } catch {} };
const getAllSyms = sleeves => [...new Set(Object.values(sleeves).flatMap(s => s.symbols))];
const CORE_KEYS = ["dividend", "growth", "digital"];
const getCoreSyms = sleeves => [...new Set(CORE_KEYS.flatMap(k => sleeves[k]?.symbols || []))];
const BENCHMARKS = [
  { sym: "IUSG", name: "IUSG" },
  { sym: "DVY", name: "DVY" },
  { sym: "IWS", name: "IWS" },
  { sym: "SPY", name: "SPY" },
  { sym: "QQQ", name: "QQQ" },
  { sym: "DIA", name: "DIA" },
];
const BM_SYMS = BENCHMARKS.map(b => b.sym);
const BASE = "https://data.alpaca.markets";
const PAPER = "https://paper-api.alpaca.markets";
const EK = import.meta.env.VITE_ALPACA_KEY || "";
const ES = import.meta.env.VITE_ALPACA_SECRET || "";
const FK = import.meta.env.VITE_FMP_KEY || "";
const FH = import.meta.env.VITE_FINNHUB_KEY || "";
const ACCESS_CODE = "ResearchSows";

const pct = n => (n == null || isNaN(n)) ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
const vol = n => !n ? "—" : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : `${n}`;
const ago = d => { const s = (Date.now() - new Date(d)) / 1000; if (s < 60) return "just now"; if (s < 3600) return `${Math.floor(s/60)}m ago`; if (s < 86400) return `${Math.floor(s/3600)}h ago`; return `${Math.floor(s/86400)}d ago`; };

/* ── Market hours helper (all times ET) ── */
function getMarketStatus() {
  const now = new Date();
  // Convert to ET
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = et.getDay(); // 0=Sun, 6=Sat
  const h = et.getHours(), m = et.getMinutes();
  const mins = h * 60 + m;

  if (day === 0 || day === 6) return { status: "closed", label: "Weekend", color: "#F87171" };
  if (mins < 240) return { status: "closed", label: "Closed", color: "#F87171" }; // before 4am
  if (mins < 570) return { status: "premarket", label: "Pre-Market", color: "#FBBF24" }; // 4am-9:30am
  if (mins < 960) return { status: "open", label: "Open", color: "#34D399" }; // 9:30am-4pm
  if (mins < 1200) return { status: "afterhours", label: "After Hours", color: "#FBBF24" }; // 4pm-8pm
  return { status: "closed", label: "Closed", color: "#F87171" }; // after 8pm
}

const C = {
  bg: "#080B05", surface: "#0E120A", card: "#141A0F", cardHover: "#1B2315", elevated: "#1F2918",
  border: "rgba(120,140,88,0.07)", borderHover: "rgba(120,140,88,0.18)", borderActive: "rgba(120,140,88,0.30)",
  t1: "#EBF0E1", t2: "#B8C9A0", t3: "#6E8450", t4: "#3A4A28",
  up: "#34D399", upSoft: "#34D39920", upGlow: "#34D39940",
  dn: "#F87171", dnSoft: "#F8717120", dnGlow: "#F8717140",
  accent: "#6E8450", accentSoft: "rgba(110,132,80,0.10)", accentGlow: "rgba(110,132,80,0.30)",
};

/* ── Sparkline from intraday bars array ── */
function Sparkline({ points, chg, width = 90, height = 32 }) {
  if (!points || points.length < 2) return <div style={{ width, height }} />;
  const mn = Math.min(...points), mx = Math.max(...points), rng = mx - mn || 1;
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${(i / (points.length - 1)) * width},${height - 2 - ((p - mn) / rng) * (height - 4)}`).join(" ");
  const color = (chg != null ? chg : 0) >= 0 ? C.up : C.dn;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block", flexShrink: 0 }}>
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Portfolio Heatmap ── */
function Heatmap({ sleeves, chgFn, namesFn, onTap }) {
  // Build cells from all sleeves
  const cells = [];
  for (const [k, sleeve] of Object.entries(sleeves)) {
    for (const s of sleeve.symbols) {
      const c = chgFn(s);
      cells.push({ sym: s, chg: c ?? 0, name: namesFn[s] || s, sleeve: sleeve.name });
    }
  }
  // Sort by absolute change (biggest blocks first) for treemap feel
  cells.sort((a, b) => Math.abs(b.chg) - Math.abs(a.chg));

  const maxAbs = Math.max(...cells.map(c => Math.abs(c.chg)), 1);

  const getColor = (chg) => {
    const intensity = Math.min(Math.abs(chg) / Math.max(maxAbs, 2), 1);
    if (chg > 0) {
      const r = Math.round(8 + intensity * 10);
      const g = Math.round(30 + intensity * 100);
      const b2 = Math.round(15 + intensity * 40);
      return `rgb(${r},${g},${b2})`;
    } else if (chg < 0) {
      const r = Math.round(50 + intensity * 150);
      const g = Math.round(15 + intensity * 15);
      const b2 = Math.round(15 + intensity * 15);
      return `rgb(${r},${g},${b2})`;
    }
    return C.card;
  };

  if (!cells.length) return null;

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))",
      gap: 3, borderRadius: 14, overflow: "hidden",
    }}>
      {cells.map(cell => (
        <div key={cell.sym} onClick={() => onTap(cell.sym)} style={{
          background: getColor(cell.chg),
          padding: "10px 6px", cursor: "pointer",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          minHeight: 64, borderRadius: 4, transition: "opacity 0.15s",
        }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#fff", letterSpacing: 0.3, textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>{cell.sym}</div>
          <div style={{
            fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.85)",
            marginTop: 2, fontVariantNumeric: "tabular-nums",
            textShadow: "0 1px 2px rgba(0,0,0,0.4)",
          }}>{cell.chg >= 0 ? "+" : ""}{cell.chg.toFixed(1)}%</div>
        </div>
      ))}
    </div>
  );
}

/* ── TradingView Chart Overlay ── */
function ChartOverlay({ symbol, onClose }) {
  const containerRef = useRef(null);
  const [intv, setIntv] = useState("D");
  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = "";
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript"; script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true, symbol, interval: intv, timezone: "Etc/UTC", theme: "dark",
      style: "1", locale: "en", backgroundColor: C.bg,
      gridColor: "rgba(110,132,80,0.05)", allow_symbol_change: true,
      hide_volume: false, support_host: "https://www.tradingview.com",
    });
    containerRef.current.appendChild(script);
  }, [symbol, intv]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: C.bg, display: "flex", flexDirection: "column", paddingTop: "env(safe-area-inset-top, 0px)", animation: "slideUp 0.3s cubic-bezier(0.16,1,0.3,1)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: 1, color: C.t1 }}>{symbol}</span>
          <div style={{ display: "flex", gap: 4 }}>
            {[["1","1m"],["5","5m"],["15","15m"],["D","1D"],["W","1W"],["M","1M"]].map(([v,l]) => (
              <button key={v} onClick={() => setIntv(v)} style={{ padding: "5px 10px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, background: intv === v ? C.accentSoft : "transparent", color: intv === v ? C.t1 : C.t4 }}>{l}</button>
            ))}
          </div>
        </div>
        <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 10, background: C.surface, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.t2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>
      <div ref={containerRef} style={{ flex: 1, width: "100%", paddingBottom: "env(safe-area-inset-bottom, 0px)" }} className="tradingview-widget-container" />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
export default function App() {
  const [unlocked, setUnlocked] = useState(() => {
    try { return localStorage.getItem("iown_remembered") === "true"; } catch { return false; }
  });
  const [code, setCode] = useState("");
  const [codeErr, setCodeErr] = useState(false);
  const [codeFocused, setCodeFocused] = useState(false);
  const [apiKey, setApiKey] = useState(EK);
  const [apiSecret, setApiSecret] = useState(ES);
  const [authed, setAuthed] = useState(false);
  const [authErr, setAuthErr] = useState("");
  const [quotes, setQuotes] = useState({});
  const [bars, setBars] = useState({});
  const [bmQuotes, setBmQuotes] = useState({});
  const [bmBars, setBmBars] = useState({});
  const [intradayPts, setIntradayPts] = useState({});
  const [names, setNames] = useState({});
  const [sleeves, setSleeves] = useState(loadSleeves);
  const [news, setNews] = useState([]);
  const [fundamentals, setFundamentals] = useState({}); // { SYM: { pe, peFwd, peg, roe, de, ... } }
  const [loading, setLoading] = useState(false);
  const [lastUp, setLastUp] = useState(null);
  const [tab, setTab] = useState("home");
  const [openSleeves, setOpenSleeves] = useState({});
  const [chartSymbol, setChartSymbol] = useState(null);
  const [refresh, setRefresh] = useState(30);
  const [mounted, setMounted] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editIconFor, setEditIconFor] = useState(null);
  const [iconInput, setIconInput] = useState("");
  const [marketStatus, setMarketStatus] = useState(getMarketStatus);
  const [addTickerFor, setAddTickerFor] = useState(null); // sleeve key
  const [tickerInput, setTickerInput] = useState("");
  const [showAddList, setShowAddList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListIcon, setNewListIcon] = useState("📊");
  const [sleeveSort, setSleeveSort] = useState({}); // { [key]: "alpha" | "chgUp" | "chgDn" }
  const [researchView, setResearchView] = useState("dividend"); // "dividend" | "growth"
  const [newsMode, setNewsMode] = useState("holdings"); // "holdings" | "broad"
  const [broadNews, setBroadNews] = useState([]);
  const iRef = useRef(null);
  const wsRef = useRef(null);

  const ALL = useMemo(() => getAllSyms(sleeves), [sleeves]);
  const coreSyms = useMemo(() => getCoreSyms(sleeves), [sleeves]);

  // Persist sleeves changes
  useEffect(() => { saveSleeves(sleeves); }, [sleeves]);

  // CRUD for sleeves
  const addList = () => {
    if (!newListName.trim()) return;
    const key = newListName.toLowerCase().replace(/[^a-z0-9]/g, "_") + "_" + Date.now();
    setSleeves(p => ({ ...p, [key]: { name: newListName.trim(), symbols: [], icon: newListIcon } }));
    setNewListName(""); setNewListIcon("📊"); setShowAddList(false);
  };
  const removeList = k => { setSleeves(p => { const n = { ...p }; delete n[k]; return n; }); };
  const addSymbol = (k, sym) => {
    const s = sym.toUpperCase().trim();
    if (!s) return;
    setSleeves(p => {
      if (p[k]?.symbols.includes(s)) return p;
      return { ...p, [k]: { ...p[k], symbols: [...p[k].symbols, s] } };
    });
    setTickerInput(""); setAddTickerFor(null);
  };
  const removeSymbol = (k, sym) => {
    setSleeves(p => ({ ...p, [k]: { ...p[k], symbols: p[k].symbols.filter(s => s !== sym) } }));
  };
  const updateIcon = (k, icon) => {
    if (!icon) return;
    setSleeves(p => ({ ...p, [k]: { ...p[k], icon } }));
    setEditIconFor(null); setIconInput("");
  };

  useEffect(() => { requestAnimationFrame(() => setMounted(true)); }, []);
  useEffect(() => {
    const t = setInterval(() => setMarketStatus(getMarketStatus()), 30000);
    return () => clearInterval(t);
  }, []);

  const hdrs = useMemo(() => ({ "APCA-API-KEY-ID": apiKey, "APCA-API-SECRET-KEY": apiSecret }), [apiKey, apiSecret]);

  /* ── Fetch asset names ── */
  const fetchNames = useCallback(async () => {
    try {
      const results = {};
      for (const s of ALL) {
        try {
          const r = await fetch(`${PAPER}/v2/assets/${s}`, { headers: hdrs });
          if (r.ok) { const d = await r.json(); results[s] = d.name; }
        } catch {}
      }
      setNames(prev => ({ ...prev, ...results }));
    } catch {}
  }, [hdrs, ALL]);

  /* ── Fetch snapshot data ── */
  const fetchData = useCallback(async () => {
    if (!apiKey || !apiSecret) return;
    setLoading(true);
    try {
      // Fetch portfolio + benchmark snapshots in parallel
      const allSyms = [...ALL, ...BM_SYMS];
      const r = await fetch(`${BASE}/v2/stocks/snapshots?symbols=${allSyms.join(",")}&feed=iex`, { headers: hdrs });
      if (!r.ok) throw new Error("fail");
      const d = await r.json();
      const nq = {}, nb = {}, bq = {}, bb = {};
      for (const [s, snap] of Object.entries(d)) {
        const isBM = BM_SYMS.includes(s);
        const tq = isBM ? bq : nq;
        const tb = isBM ? bb : nb;
        if (snap.latestTrade) tq[s] = { p: snap.latestTrade.p, t: snap.latestTrade.t };
        if (snap.dailyBar) tb[s] = { o: snap.dailyBar.o, h: snap.dailyBar.h, l: snap.dailyBar.l, c: snap.dailyBar.c, v: snap.dailyBar.v, vw: snap.dailyBar.vw };
        if (snap.prevDailyBar) { if (!tb[s]) tb[s] = {}; tb[s].pc = snap.prevDailyBar.c; }
      }
      setQuotes(nq); setBars(nb); setBmQuotes(bq); setBmBars(bb); setLastUp(new Date());
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [apiKey, apiSecret, hdrs, ALL]);

  /* ── Fetch intraday bars for sparklines ── */
  const fetchIntraday = useCallback(async () => {
    if (!apiKey || !apiSecret) return;
    try {
      const today = new Date().toISOString().split("T")[0];
      const r = await fetch(`${BASE}/v2/stocks/bars?symbols=${ALL.join(",")}&timeframe=30Min&start=${today}T04:00:00Z&feed=iex&limit=1000`, { headers: hdrs });
      if (!r.ok) return;
      const d = await r.json();
      const pts = {};
      if (d.bars) {
        for (const [s, barArr] of Object.entries(d.bars)) {
          pts[s] = barArr.map(b => b.c);
        }
      }
      setIntradayPts(pts);
    } catch {}
  }, [apiKey, apiSecret, hdrs]);

  /* ── Fetch news ── */
  const fetchNews = useCallback(async () => {
    if (!apiKey || !apiSecret) return;
    try {
      // Holdings news: only core portfolio symbols
      const holdingsR = await fetch(`${BASE}/v1beta1/news?symbols=${coreSyms.join(",")}&limit=30&sort=desc`, { headers: hdrs });
      if (holdingsR.ok) { const d = await holdingsR.json(); setNews(d.news || []); }
      // Broad market news: no symbol filter
      const broadR = await fetch(`${BASE}/v1beta1/news?limit=30&sort=desc`, { headers: hdrs });
      if (broadR.ok) { const d = await broadR.json(); setBroadNews(d.news || []); }
    } catch {}
  }, [apiKey, apiSecret, hdrs, coreSyms]);

    /* ── Fetch fundamentals via Finnhub (1 call/symbol, 60/min free) ── */
  const [fmpStatus, setFmpStatus] = useState("");
  const fetchFundamentals = useCallback(async (force = false) => {
    const key = FH || FK;
    if (!key) { setFmpStatus("No API key — add FINNHUB_KEY secret"); return; }
    if (!force) {
      try {
        const old = JSON.parse(localStorage.getItem("iown_metrics_cache") || "{}");
        const age = Date.now() - (old._ts || 0);
        const hasData = Object.entries(old).some(([k, v]) => k !== "_ts" && v?.peTTM != null);
        if (age < 6 * 3600000 && hasData) { setFundamentals(old); setFmpStatus("Loaded from cache"); return; }
      } catch {}
    }

    const results = {};
    let success = 0;

    for (let i = 0; i < coreSyms.length; i++) {
      const sym = coreSyms[i];
      if (i % 5 === 0) setFmpStatus(`Finnhub: ${i + 1}/${coreSyms.length}… (${success} ok)`);
      try {
        const r = await fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${sym}&metric=all&token=${key}`);
        if (!r.ok) {
          if (r.status === 429) { setFmpStatus(`Rate limited at ${i}. Waiting…`); await new Promise(r => setTimeout(r, 61000)); i--; continue; }
          continue;
        }
        const d = await r.json();
        const m = d?.metric || {};

        results[sym] = {
          industry: null,
          avgVol: m["3MonthAverageTradingVolume"] ? m["3MonthAverageTradingVolume"] * 1e6 : null,
          peTTM: m.peTTM ?? m.peBasicExclExtraTTM ?? null,
          peFwd: m.peAnnual ?? null,
          pegTTM: m.pegTTM ?? null,
          yieldFwd: m.dividendYieldIndicatedAnnual ?? null,
          payoutRatio: m.payoutRatioTTM ?? m.payoutRatioAnnual ?? null,
          revenueYoY: m.revenueGrowthQuarterlyYoy ?? m.revenueGrowthTTMYoy ?? null,
          revenue5Y: m.revenueGrowth5Y ?? null,
          profitMargin: m.netProfitMarginTTM ?? m.netProfitMarginAnnual ?? null,
          roe: m.roeTTM ?? m.roeAnnual ?? null,
          de: m["totalDebt/totalEquityQuarterly"] ?? m["longTermDebt/equityQuarterly"] ?? null,
          debtToFCF: null,
          roic: m.roicTTM ?? m.roicAnnual ?? null,
          lastQtr: m["13WeekPriceReturnDaily"] ?? null,
        };
        if (results[sym].peTTM != null) success++;
        if (i === 0) setFmpStatus(`Fetching… keys ok`);
      } catch (e) { console.warn("Finnhub", sym, e.message); }
    }

    results._ts = Date.now();
    setFmpStatus(`Done: ${success}/${coreSyms.length} via Finnhub`);
    setFundamentals(results);
    try { localStorage.setItem("iown_metrics_cache", JSON.stringify(results)); } catch {}
  }, [coreSyms]);

  /* ── WebSocket streaming ── */
  const connectWS = useCallback(() => {
    if (!apiKey || !apiSecret) return;
    try {
      const ws = new WebSocket("wss://stream.data.alpaca.markets/v2/iex");
      wsRef.current = ws;
      ws.onopen = () => {
        ws.send(JSON.stringify({ action: "auth", key: apiKey, secret: apiSecret }));
      };
      ws.onmessage = (evt) => {
        const msgs = JSON.parse(evt.data);
        for (const msg of msgs) {
          if (msg.T === "success" && msg.msg === "authenticated") {
            ws.send(JSON.stringify({ action: "subscribe", trades: ALL }));
          }
          if (msg.T === "t") {
            setQuotes(prev => ({ ...prev, [msg.S]: { p: msg.p, t: msg.t } }));
          }
        }
      };
      ws.onclose = () => { setTimeout(connectWS, 5000); };
    } catch {}
  }, [apiKey, apiSecret]);

  const auth = async () => {
    setAuthErr("");
    try {
      const r = await fetch(`${PAPER}/v2/account`, { headers: hdrs });
      if (!r.ok) throw new Error("fail");
      setAuthed(true);
      fetchData();
      fetchIntraday();
      fetchNames();
      fetchNews();
      fetchFundamentals();
      connectWS();
    } catch { setAuthErr("Invalid API keys."); }
  };

  useEffect(() => { if (EK && ES && !authed && unlocked) auth(); }, [unlocked]);
  useEffect(() => {
    if (authed && refresh) {
      iRef.current = setInterval(() => { fetchData(); fetchNews(); }, refresh * 1000);
      return () => clearInterval(iRef.current);
    }
  }, [authed, refresh, fetchData, fetchNews]);

  const chg = s => { const q = quotes[s], b = bars[s]; return (q && b?.pc) ? ((q.p - b.pc) / b.pc) * 100 : null; };
  const bmChg = s => { const q = bmQuotes[s], b = bmBars[s]; return (q && b?.pc) ? ((q.p - b.pc) / b.pc) * 100 : null; };

  const toggleSleeve = k => setOpenSleeves(p => ({ ...p, [k]: !p[k] }));

  /* ━━━ PASSWORD GATE ━━━ */
  if (!unlocked) {
    const handleUnlock = () => {
      if (code === ACCESS_CODE) {
        setUnlocked(true);
        try { localStorage.setItem("iown_remembered", "true"); } catch {}
      } else { setCodeErr(true); }
    };

    return (
      <div style={{ minHeight: "100dvh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, paddingTop: "env(safe-area-inset-top, 24px)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "20%", left: "50%", transform: "translate(-50%, -50%)", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(110,132,80,0.06) 0%, transparent 70%)", pointerEvents: "none", filter: "blur(60px)" }} />
        <div style={{ width: "100%", maxWidth: 380, textAlign: "center", opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(20px)", transition: "all 0.8s cubic-bezier(0.16,1,0.3,1)" }}>
          {/* Logo from public folder */}
          <img src="icon-512x512.png" alt="IOWN" style={{ width: 100, height: 100, borderRadius: 28, margin: "0 auto 28px", display: "block", boxShadow: "0 8px 40px rgba(0,0,0,0.5)" }} />
          <p style={{ fontSize: 15, color: C.t3, marginBottom: 40, lineHeight: 1.5, fontStyle: "italic", letterSpacing: 0.2 }}>Research Reveals Opportunities</p>
          <div style={{ background: C.surface, borderRadius: 20, padding: 28, border: `1px solid ${codeFocused ? C.borderActive : C.border}`, boxShadow: "0 16px 64px rgba(0,0,0,0.3)", transition: "border-color 0.3s" }}>
            <input type="password" value={code} onChange={e => { setCode(e.target.value); setCodeErr(false); }} onKeyDown={e => { if (e.key === "Enter") handleUnlock(); }} onFocus={() => setCodeFocused(true)} onBlur={() => setCodeFocused(false)} placeholder="Access code" style={{ width: "100%", padding: "18px 20px", background: C.bg, border: `1px solid ${codeErr ? C.dn+"66" : C.border}`, borderRadius: 14, color: C.t1, fontSize: 16, outline: "none", boxSizing: "border-box", textAlign: "center", letterSpacing: 4, fontFamily: "inherit" }} />
            <button onClick={handleUnlock} style={{ width: "100%", padding: 18, marginTop: 16, background: "linear-gradient(135deg, #4A6B25, #2D4A12)", border: "none", borderRadius: 14, color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 24px rgba(74,107,37,0.3)" }}>Continue</button>
            {codeErr && <div style={{ marginTop: 16, color: C.dn, fontSize: 13, fontWeight: 500, animation: "shake 0.4s" }}>Incorrect access code</div>}
          </div>
          <div style={{ marginTop: 40, fontSize: 12, color: C.t4 }}>Authorized IOWN team members only</div>
        </div>
        <GS />
      </div>
    );
  }

  /* ━━━ API KEY SCREEN ━━━ */
  if (!authed) {
    return (
      <div style={{ minHeight: "100dvh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ width: "100%", maxWidth: 420, textAlign: "center", animation: "fadeIn 0.6s ease" }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: C.t1, marginBottom: 8 }}>Connect Market Data</h1>
          <p style={{ fontSize: 14, color: C.t3, marginBottom: 36 }}>Link your Alpaca API keys to begin</p>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: 28, textAlign: "left", boxShadow: "0 16px 64px rgba(0,0,0,0.3)" }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t3, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>API Key</label>
            <input type="text" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="APCA-API-KEY-ID" style={{ width: "100%", padding: "16px 18px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, color: C.t1, fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 20, fontFamily: "inherit" }} />
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t3, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>Secret Key</label>
            <input type="password" value={apiSecret} onChange={e => setApiSecret(e.target.value)} placeholder="APCA-API-SECRET-KEY" style={{ width: "100%", padding: "16px 18px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, color: C.t1, fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 28, fontFamily: "inherit" }} />
            <button onClick={auth} style={{ width: "100%", padding: 18, background: "linear-gradient(135deg, #4A6B25, #2D4A12)", border: "none", borderRadius: 14, color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 24px rgba(74,107,37,0.3)" }}>Connect</button>
            {authErr && <div style={{ marginTop: 14, color: C.dn, fontSize: 13, fontWeight: 500, textAlign: "center" }}>{authErr}</div>}
          </div>
        </div>
        <GS />
      </div>
    );
  }

  /* ━━━ MAIN DASHBOARD ━━━ */

  /* ── Robinhood-style Ticker Row ── */
  const TickerRow = ({ s }) => {
    const q = quotes[s], b = bars[s], c = chg(s);
    const nm = names[s] || "";
    const pts = intradayPts[s];
    const shortName = nm.length > 18 ? nm.slice(0, 18) + "…" : nm;
    return (
      <div onClick={() => setChartSymbol(s)} style={{ display: "flex", alignItems: "center", padding: "14px 0", cursor: "pointer" }}>
        {/* Left: ticker + company name */}
        <div style={{ flex: "0 0 auto", width: 100, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.t1 }}>{s}</div>
          <div style={{ fontSize: 12, color: C.t4, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shortName}</div>
        </div>
        {/* Center: sparkline */}
        <div style={{ flex: 1, display: "flex", justifyContent: "center", padding: "0 8px" }}>
          <Sparkline points={pts} chg={c} />
        </div>
        {/* Right: change badge */}
        <div style={{
          padding: "6px 12px", borderRadius: 6, minWidth: 80, textAlign: "center",
          fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums",
          color: c > 0 ? C.up : c < 0 ? C.dn : C.t3,
          border: `1px solid ${c > 0 ? C.up + "55" : c < 0 ? C.dn + "55" : C.border}`,
        }}>{pct(c)}</div>
      </div>
    );
  };

  /* ── Robinhood-style Sleeve Section (collapsible) ── */
  const SleeveSection = ({ k, sleeve }) => {
    const isOpen = openSleeves[k];
    // Calculate average change for this sleeve
    const changes = sleeve.symbols.map(chg).filter(c => c !== null);
    const avgChg = changes.length ? changes.reduce((a, b) => a + b, 0) / changes.length : null;
    const isAddingTicker = addTickerFor === k;

    return (
      <div>
        {/* Sleeve header row */}
        <div style={{ display: "flex", alignItems: "center", padding: "18px 0" }}>
          {/* Edit mode: delete list button */}
          {editMode && (
            <div onClick={() => { if (confirm(`Delete "${sleeve.name}"?`)) removeList(k); }} style={{ width: 28, height: 28, borderRadius: 14, background: C.dn + "22", border: `1px solid ${C.dn}44`, display: "flex", alignItems: "center", justifyContent: "center", marginRight: 10, cursor: "pointer", flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.dn} strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
            </div>
          )}
          <div onClick={() => toggleSleeve(k)} style={{ display: "flex", alignItems: "center", flex: 1, cursor: "pointer" }}>
            {/* Icon — tappable in edit mode to change */}
            {editMode && editIconFor === k ? (
              <div style={{ marginRight: 16, display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                <input type="text" value={iconInput} onChange={e => setIconInput(e.target.value)} autoFocus
                  onKeyDown={e => { if (e.key === "Enter") updateIcon(k, iconInput); if (e.key === "Escape") setEditIconFor(null); }}
                  placeholder="😀" style={{ width: 50, height: 50, padding: 0, background: C.card, border: `1px solid ${C.borderActive}`, borderRadius: 14, color: C.t1, fontSize: 26, textAlign: "center", outline: "none", fontFamily: "inherit" }} />
                <button onClick={(e) => { e.stopPropagation(); updateIcon(k, iconInput); }} style={{ padding: "8px 10px", background: C.accentSoft, border: `1px solid ${C.borderActive}`, borderRadius: 8, color: C.t1, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Set</button>
              </div>
            ) : (
              <div onClick={(e) => { if (editMode) { e.stopPropagation(); setEditIconFor(k); setIconInput(sleeve.icon); } }} style={{
                width: 56, height: 56, borderRadius: 14, marginRight: 16,
                background: C.card, border: `1px solid ${editMode ? C.borderActive : C.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 26, flexShrink: 0, position: "relative",
              }}>
                {sleeve.icon}
                {editMode && <div style={{ position: "absolute", bottom: -2, right: -2, width: 18, height: 18, borderRadius: 9, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg></div>}
              </div>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: C.t1 }}>{sleeve.name}</div>
              <div style={{ fontSize: 13, color: C.t4, marginTop: 2 }}>{sleeve.symbols.length} items</div>
            </div>
          </div>
          {/* Right side: avg change + chevron */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {avgChg != null && (
              <span style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: avgChg >= 0 ? C.up : C.dn }}>{pct(avgChg)}</span>
            )}
            <div onClick={() => toggleSleeve(k)} style={{
              width: 40, height: 40, borderRadius: 20, border: `1px solid ${C.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
              cursor: "pointer",
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.t3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
            </div>
          </div>
        </div>
        {/* Expanded ticker list */}
        {isOpen && (
          <div style={{ paddingLeft: 4, paddingRight: 4, animation: "fadeIn 0.2s ease" }}>
            {/* Sort pills */}
            <div style={{ display: "flex", gap: 6, paddingBottom: 8, overflowX: "auto" }}>
              {[
                { v: "alpha", l: "A–Z" },
                { v: "chgDn", l: "% ↓" },
                { v: "chgUp", l: "% ↑" },
              ].map(({ v, l }) => {
                const active = (sleeveSort[k] || "alpha") === v;
                return (
                  <button key={v} onClick={() => setSleeveSort(p => ({ ...p, [k]: v }))} style={{
                    padding: "5px 12px", borderRadius: 8, border: `1px solid ${active ? C.borderActive : C.border}`,
                    background: active ? C.accentSoft : "transparent",
                    color: active ? C.t1 : C.t4, fontSize: 11, fontWeight: 600,
                    cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                  }}>{l}</button>
                );
              })}
            </div>
            {(() => {
              const sortMode = sleeveSort[k] || "alpha";
              const sorted = [...sleeve.symbols].sort((a, b) => {
                if (sortMode === "chgDn") return (chg(b) ?? -999) - (chg(a) ?? -999);
                if (sortMode === "chgUp") return (chg(a) ?? 999) - (chg(b) ?? 999);
                return a.localeCompare(b);
              });
              return sorted.map((s, i) => (
                <div key={s}>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    {editMode && (
                      <div onClick={() => removeSymbol(k, s)} style={{ width: 24, height: 24, borderRadius: 12, background: C.dn + "22", border: `1px solid ${C.dn}44`, display: "flex", alignItems: "center", justifyContent: "center", marginRight: 8, cursor: "pointer", flexShrink: 0 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.dn} strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
                      </div>
                    )}
                    <div style={{ flex: 1 }}><TickerRow s={s} /></div>
                  </div>
                  {i < sorted.length - 1 && <div style={{ height: 1, background: C.border }} />}
                </div>
              ));
            })()}
            {/* Add ticker row */}
            {editMode && (
              <div style={{ padding: "12px 0" }}>
                {isAddingTicker ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="text" value={tickerInput} onChange={e => setTickerInput(e.target.value.toUpperCase())}
                      onKeyDown={e => { if (e.key === "Enter") addSymbol(k, tickerInput); if (e.key === "Escape") { setAddTickerFor(null); setTickerInput(""); } }}
                      placeholder="AAPL" autoFocus
                      style={{ flex: 1, padding: "10px 14px", background: C.bg, border: `1px solid ${C.borderActive}`, borderRadius: 10, color: C.t1, fontSize: 14, fontWeight: 600, outline: "none", fontFamily: "inherit", letterSpacing: 1 }} />
                    <button onClick={() => addSymbol(k, tickerInput)} style={{ padding: "10px 16px", background: C.accentSoft, border: `1px solid ${C.borderActive}`, borderRadius: 10, color: C.t1, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Add</button>
                    <button onClick={() => { setAddTickerFor(null); setTickerInput(""); }} style={{ padding: "10px 12px", background: "transparent", border: `1px solid ${C.border}`, borderRadius: 10, color: C.t4, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
                  </div>
                ) : (
                  <div onClick={() => setAddTickerFor(k)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", cursor: "pointer", color: C.t3, fontSize: 14, fontWeight: 600 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: C.accentSoft, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.t3} strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    </div>
                    Add ticker
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        <div style={{ height: 1, background: C.border }} />
      </div>
    );
  };

  return (
    <div style={{ minHeight: "100dvh", background: C.bg, color: C.t1, paddingBottom: 90, overflowY: "auto" }}>

      {/* HEADER */}
      <div style={{
        padding: "12px 18px", paddingTop: "calc(env(safe-area-inset-top, 12px) + 12px)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: `1px solid ${C.border}`,
        background: "rgba(8,11,5,0.88)", backdropFilter: "blur(24px) saturate(1.2)", WebkitBackdropFilter: "blur(24px) saturate(1.2)",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Market status pill */}
          <div style={{
            padding: "4px 10px", borderRadius: 8,
            fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
            color: marketStatus.color,
            border: `1px solid ${marketStatus.color}44`,
            background: marketStatus.color + "12",
          }}>{marketStatus.label}</div>
          {loading && <div style={{ width: 6, height: 6, borderRadius: 3, background: C.up, boxShadow: `0 0 8px ${C.upGlow}`, animation: "pulse 1.2s ease-in-out infinite" }} />}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {lastUp && <span style={{ fontSize: 11, color: C.t4 }}>{lastUp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
          <button onClick={() => { fetchData(); fetchNews(); fetchIntraday(); }} disabled={loading} style={{
            width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center",
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, cursor: "pointer",
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.t3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: loading ? "spin 1s linear infinite" : "none" }}>
              <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 18px" }}>

        {/* Stale data banner when market is not open */}
        {marketStatus.status !== "open" && Object.keys(quotes).length > 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", marginTop: 12,
            background: marketStatus.color + "08", border: `1px solid ${marketStatus.color}22`,
            borderRadius: 12,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: marketStatus.color, flexShrink: 0 }} />
            <div style={{ fontSize: 12, color: C.t2, lineHeight: 1.4 }}>
              {marketStatus.status === "premarket" && "Pre-market hours — prices shown are from yesterday's close. Upgrade to SIP feed for live pre-market data."}
              {marketStatus.status === "afterhours" && "After-hours trading — prices shown are from today's close. Upgrade to SIP feed for live after-hours data."}
              {marketStatus.status === "closed" && "Market is closed — prices shown are from the last trading session."}
            </div>
          </div>
        )}

        {/* ━━━ HOME — Robinhood Lists Style ━━━ */}
        {tab === "home" && (
          <div style={{ animation: "fadeIn 0.3s ease" }}>

            {/* Benchmark Banner */}
            {Object.keys(bmQuotes).length > 0 && (
              <div style={{ margin: "16px -18px 0", padding: "0 18px", overflow: "hidden" }}>
                <div style={{
                  display: "flex", gap: 0, overflowX: "auto", paddingBottom: 6,
                  WebkitOverflowScrolling: "touch", scrollbarWidth: "none",
                }}>
                  {BENCHMARKS.map((bm, i) => {
                    const c = bmChg(bm.sym);
                    const q = bmQuotes[bm.sym];
                    return (
                      <div key={bm.sym} onClick={() => setChartSymbol(bm.sym)} style={{
                        flex: "0 0 auto", padding: "12px 16px", cursor: "pointer",
                        borderRight: i < BENCHMARKS.length - 1 ? `1px solid ${C.border}` : "none",
                        minWidth: 100,
                      }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: C.t3, marginBottom: 4, whiteSpace: "nowrap" }}>{bm.name}</div>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                          {q && <span style={{ fontSize: 14, fontWeight: 700, color: C.t1, fontVariantNumeric: "tabular-nums" }}>{q.p.toFixed(2)}</span>}
                          <span style={{
                            fontSize: 12, fontWeight: 700, fontVariantNumeric: "tabular-nums",
                            color: c > 0 ? C.up : c < 0 ? C.dn : C.t3,
                          }}>{pct(c)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ height: 1, background: C.border }} />
              </div>
            )}
            {/* Lists header with edit toggle */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 0 8px" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: C.t1 }}>Lists</div>
              <button onClick={() => setEditMode(!editMode)} style={{
                padding: "6px 14px", borderRadius: 8, border: `1px solid ${editMode ? C.borderActive : C.border}`,
                background: editMode ? C.accentSoft : "transparent",
                color: editMode ? C.t1 : C.t3, fontSize: 13, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
              }}>{editMode ? "Done" : "Edit"}</button>
            </div>

            {/* Create watchlist button */}
            {editMode && !showAddList && (
              <div onClick={() => setShowAddList(true)} style={{ display: "flex", alignItems: "center", padding: "16px 0", cursor: "pointer", borderBottom: `1px solid ${C.border}` }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, marginRight: 16, background: C.card, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.t3} strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                </div>
                <div style={{ fontSize: 17, fontWeight: 700, color: C.t1 }}>Create watchlist</div>
              </div>
            )}

            {/* Add list form */}
            {showAddList && (
              <div style={{ padding: "16px 0", borderBottom: `1px solid ${C.border}`, animation: "fadeIn 0.2s ease" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                  <input type="text" value={newListIcon} onChange={e => setNewListIcon(e.target.value)} style={{ width: 50, padding: "10px 4px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, color: C.t1, fontSize: 22, textAlign: "center", outline: "none", fontFamily: "inherit" }} />
                  <input type="text" value={newListName} onChange={e => setNewListName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") addList(); }}
                    placeholder="List name" autoFocus
                    style={{ flex: 1, padding: "12px 14px", background: C.bg, border: `1px solid ${C.borderActive}`, borderRadius: 10, color: C.t1, fontSize: 15, fontWeight: 600, outline: "none", fontFamily: "inherit" }} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={addList} style={{ flex: 1, padding: "12px 0", background: C.accentSoft, border: `1px solid ${C.borderActive}`, borderRadius: 10, color: C.t1, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Create</button>
                  <button onClick={() => { setShowAddList(false); setNewListName(""); }} style={{ padding: "12px 16px", background: "transparent", border: `1px solid ${C.border}`, borderRadius: 10, color: C.t4, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                </div>
              </div>
            )}

            {/* Sleeve sections */}
            {Object.entries(sleeves).map(([k, sleeve]) => (
              <SleeveSection key={k} k={k} sleeve={sleeve} />
            ))}

            {/* Top Movers */}
            <div style={{ paddingTop: 28 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.t1, marginBottom: 16 }}>Top Movers</div>
              <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: "0 16px" }}>
                {coreSyms.filter(s => chg(s) != null).sort((a, b) => Math.abs(chg(b)) - Math.abs(chg(a))).slice(0, 6).map((s, i, arr) => (
                  <div key={s}>
                    <TickerRow s={s} />
                    {i < arr.length - 1 && <div style={{ height: 1, background: C.border }} />}
                  </div>
                ))}
              </div>
            </div>

            {/* Heatmap */}
            {Object.keys(quotes).length > 0 && (
              <div style={{ paddingTop: 28, paddingBottom: 20 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: C.t1, marginBottom: 16 }}>Heatmap</div>
                <Heatmap sleeves={Object.fromEntries(CORE_KEYS.filter(k => sleeves[k]).map(k => [k, sleeves[k]]))} chgFn={chg} namesFn={names} onTap={s => setChartSymbol(s)} />
              </div>
            )}
          </div>
        )}

        {/* ━━━ NEWS TAB ━━━ */}
        {tab === "news" && (
          <div style={{ animation: "fadeIn 0.3s ease", paddingTop: 20 }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: C.t1, marginBottom: 16 }}>News</div>
            {/* Toggle: Holdings / Broad Market */}
            <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
              {[{ v: "holdings", l: "Holdings" }, { v: "broad", l: "Broad Market" }].map(({ v, l }) => (
                <button key={v} onClick={() => setNewsMode(v)} style={{
                  flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${newsMode === v ? C.borderActive : C.border}`,
                  background: newsMode === v ? C.accentSoft : "transparent",
                  color: newsMode === v ? C.t1 : C.t3, fontSize: 14, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                }}>{l}</button>
              ))}
            </div>
            {(() => {
              const articles = newsMode === "holdings"
                ? news.filter(a => a.symbols?.some(s => coreSyms.includes(s)))
                : broadNews;
              if (!articles.length) return (
                <div style={{ textAlign: "center", padding: "40px 0", color: C.t4, fontSize: 14 }}>
                  {loading ? "Loading news…" : "No news available"}
                </div>
              );
              return articles.map((article, i) => (
                <div key={article.id || i} onClick={() => article.url && window.open(article.url, "_blank")}
                  style={{
                    padding: "16px 0", borderBottom: `1px solid ${C.border}`,
                    cursor: article.url ? "pointer" : "default",
                  }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                    {article.images?.[0]?.url && (
                      <img src={article.images[0].url} alt="" style={{
                        width: 72, height: 72, borderRadius: 10, objectFit: "cover",
                        flexShrink: 0, background: C.card,
                      }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: 0.5 }}>{article.source}</span>
                        <span style={{ fontSize: 11, color: C.t4 }}>{ago(article.created_at || article.updated_at)}</span>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: C.t1, lineHeight: 1.4, marginBottom: 6,
                        display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
                      }}>{article.headline}</div>
                      {article.symbols?.length > 0 && (
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {article.symbols.filter(s => coreSyms.includes(s)).slice(0, 4).map(s => (
                            <span key={s} style={{
                              fontSize: 10, fontWeight: 700, color: C.t3, background: C.accentSoft,
                              padding: "2px 6px", borderRadius: 4, letterSpacing: 0.3,
                            }}>{s}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ));
            })()}
          </div>
        )}

        {/* ━━━ METRICS ━━━ */}
        {tab === "research" && (
          <div style={{ animation: "fadeIn 0.3s ease", paddingTop: 20 }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: C.t1, marginBottom: 16 }}>Metrics</div>
            {/* Toggle dividend / growth */}
            <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
              {[{ v: "dividend", l: "💰 Dividend" }, { v: "growth", l: "🚀 Growth" }].map(({ v, l }) => (
                <button key={v} onClick={() => setResearchView(v)} style={{
                  flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${researchView === v ? C.borderActive : C.border}`,
                  background: researchView === v ? C.accentSoft : "transparent",
                  color: researchView === v ? C.t1 : C.t3, fontSize: 14, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                }}>{l}</button>
              ))}
            </div>
            {Object.keys(fundamentals).length <= 1 && (
              <div style={{ textAlign: "center", padding: "40px 0", color: C.t4, fontSize: 14 }}>
                {FK ? (fmpStatus || "Tap 'Fetch Metrics' in Settings") : "FMP API key not configured. Add VITE_FMP_KEY to your environment."}
                {FK && <button onClick={() => fetchFundamentals(true)} style={{ display: "block", margin: "16px auto 0", padding: "10px 24px", background: C.accentSoft, border: `1px solid ${C.borderActive}`, borderRadius: 10, color: C.t1, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Fetch Now</button>}
              </div>
            )}
            {fmpStatus && Object.keys(fundamentals).length > 1 && (
              <div style={{ fontSize: 11, color: C.t4, marginBottom: 12, textAlign: "center" }}>{fmpStatus}</div>
            )}
            {/* Seeking Alpha-style scrollable table */}
            {(() => {
              const syms = researchView === "dividend" ? (sleeves.dividend?.symbols || []) : (sleeves.growth?.symbols || []);
              const fmtV = v => v == null ? "—" : Number(v).toFixed(1);
              const fmtP = v => v == null ? "—" : `${Number(v).toFixed(1)}%`;

              const divCols = [
                { l: "Avg Vol", w: 70, fn: d => vol(d.avgVol) },
                { l: "Last Qtr", w: 72, fn: d => d.lastQtr != null ? `${d.lastQtr >= 0 ? "+" : ""}${d.lastQtr.toFixed(1)}%` : "—", color: d => (d.lastQtr||0) > 0 ? C.up : (d.lastQtr||0) < 0 ? C.dn : C.t3 },
                { l: "Yield FWD", w: 72, fn: d => d.yieldFwd != null ? `${d.yieldFwd.toFixed(2)}%` : "—" },
                { l: "Payout", w: 62, fn: d => d.payoutRatio != null ? `${d.payoutRatio.toFixed(0)}%` : "—" },
                { l: "P/E TTM", w: 62, fn: d => fmtV(d.peTTM) },
                { l: "P/E FWD", w: 62, fn: d => fmtV(d.peFwd) },
                { l: "Rev YoY", w: 68, fn: d => fmtP(d.revenueYoY), color: d => (d.revenueYoY||0) > 0 ? C.up : C.dn },
                { l: "Rev 5Y", w: 62, fn: d => fmtP(d.revenue5Y), color: d => (d.revenue5Y||0) > 0 ? C.up : C.dn },
                { l: "ROE", w: 58, fn: d => fmtP(d.roe) },
                { l: "D/E", w: 50, fn: d => fmtV(d.de) },
              ];
              const groCols = [
                { l: "Avg Vol", w: 70, fn: d => vol(d.avgVol) },
                { l: "Last Qtr", w: 72, fn: d => d.lastQtr != null ? `${d.lastQtr >= 0 ? "+" : ""}${d.lastQtr.toFixed(1)}%` : "—", color: d => (d.lastQtr||0) > 0 ? C.up : (d.lastQtr||0) < 0 ? C.dn : C.t3 },
                { l: "P/E TTM", w: 62, fn: d => fmtV(d.peTTM) },
                { l: "P/E FWD", w: 62, fn: d => fmtV(d.peFwd) },
                { l: "PEG", w: 50, fn: d => fmtV(d.pegTTM) },
                { l: "Rev YoY", w: 68, fn: d => fmtP(d.revenueYoY), color: d => (d.revenueYoY||0) > 0 ? C.up : C.dn },
                { l: "Rev 5Y", w: 62, fn: d => fmtP(d.revenue5Y), color: d => (d.revenue5Y||0) > 0 ? C.up : C.dn },
                { l: "Margin", w: 62, fn: d => fmtP(d.profitMargin) },
                { l: "ROE", w: 58, fn: d => fmtP(d.roe) },
                { l: "D/E", w: 50, fn: d => fmtV(d.de) },
              ];
              const cols = researchView === "dividend" ? divCols : groCols;
              const sortedSyms = [...syms].sort((a, b) => a.localeCompare(b));

              return (
                <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden" }}>
                  <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                    <table style={{ borderCollapse: "collapse", minWidth: 140 + cols.reduce((s, c) => s + c.w, 0) }}>
                      {/* Header */}
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                          <th style={{ position: "sticky", left: 0, zIndex: 2, background: C.card, padding: "12px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.t3, letterSpacing: 0.3, minWidth: 140, borderRight: `1px solid ${C.border}` }}>Symbol</th>
                          {cols.map(col => (
                            <th key={col.l} style={{ padding: "12px 8px", textAlign: "right", fontSize: 10, fontWeight: 700, color: C.t4, letterSpacing: 0.3, whiteSpace: "nowrap", minWidth: col.w }}>{col.l}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sortedSyms.map((s, ri) => {
                          const d = fundamentals[s] || {};
                          const nm = names[s] || "";
                          const shortNm = nm.length > 16 ? nm.slice(0, 16) + "…" : nm;
                          return (
                            <tr key={s} onClick={() => setChartSymbol(s)} style={{ borderBottom: ri < sortedSyms.length - 1 ? `1px solid ${C.border}` : "none", cursor: "pointer" }}>
                              <td style={{ position: "sticky", left: 0, zIndex: 1, background: C.card, padding: "10px 12px", borderRight: `1px solid ${C.border}` }}>
                                <div style={{ fontSize: 14, fontWeight: 800, color: C.accent }}>{s}</div>
                                <div style={{ fontSize: 11, color: C.t4, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>{shortNm}</div>
                              </td>
                              {cols.map(col => {
                                const val = col.fn(d);
                                const clr = col.color ? col.color(d) : C.t2;
                                return (
                                  <td key={col.l} style={{ padding: "10px 8px", textAlign: "right", fontSize: 13, fontWeight: 600, color: clr, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{val}</td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ━━━ SETTINGS ━━━ */}
        {tab === "settings" && (
          <div style={{ animation: "fadeIn 0.3s ease", paddingTop: 20 }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: C.t1, marginBottom: 20 }}>Settings</div>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: "22px 20px", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginBottom: 12 }}>Auto-Refresh Interval</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[{ v: null, l: "Off" }, { v: 15, l: "15s" }, { v: 30, l: "30s" }, { v: 60, l: "60s" }].map(({ v, l }) => (
                  <button key={l} onClick={() => setRefresh(v)} style={{
                    padding: "7px 14px", background: refresh === v ? C.accentSoft : "transparent",
                    border: `1px solid ${refresh === v ? C.borderActive : C.border}`,
                    borderRadius: 10, color: refresh === v ? C.t1 : C.t3, fontSize: 12, fontWeight: 600,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>{l}</button>
                ))}
              </div>
            </div>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: "22px 20px", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginBottom: 12 }}>Connection Status</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: C.up, boxShadow: `0 0 8px ${C.upGlow}` }} />
                <span style={{ fontSize: 13, color: C.t2 }}>{Object.keys(quotes).length} symbols via REST</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: wsRef.current?.readyState === 1 ? C.up : C.dn, boxShadow: wsRef.current?.readyState === 1 ? `0 0 8px ${C.upGlow}` : `0 0 8px ${C.dnGlow}` }} />
                <span style={{ fontSize: 13, color: C.t2 }}>WebSocket {wsRef.current?.readyState === 1 ? "connected" : "disconnected"}</span>
              </div>
              <div style={{ fontSize: 12, color: C.t4, marginTop: 8 }}>Data: IEX · Alpaca Markets · News: Benzinga</div>
            </div>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: "22px 20px", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginBottom: 12 }}>Data Loaded</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div style={{ fontSize: 12, color: C.t3 }}>Company names: <span style={{ color: C.t2 }}>{Object.keys(names).length}/{ALL.length}</span></div>
                <div style={{ fontSize: 12, color: C.t3 }}>Intraday charts: <span style={{ color: C.t2 }}>{Object.keys(intradayPts).length}/{ALL.length}</span></div>
                <div style={{ fontSize: 12, color: C.t3 }}>News articles: <span style={{ color: C.t2 }}>{news.length}</span></div>
                <div style={{ fontSize: 12, color: C.t3 }}>Live quotes: <span style={{ color: C.t2 }}>{Object.keys(quotes).length}</span></div>
                <div style={{ fontSize: 12, color: C.t3 }}>Metrics: <span style={{ color: Object.entries(fundamentals).some(([k,v]) => k !== "_ts" && v?.peTTM != null) ? C.up : C.dn }}>{Object.entries(fundamentals).filter(([k,v]) => k !== "_ts" && v?.peTTM != null).length}/{coreSyms.length}</span></div>
                <div style={{ fontSize: 12, color: C.t3 }}>Metrics key: <span style={{ color: (FH || FK) ? C.up : C.dn }}>{FH ? "Finnhub" : FK ? "FMP" : "missing"}</span></div>
              </div>
              {fmpStatus && <div style={{ fontSize: 11, color: C.t2, marginTop: 8, padding: "6px 8px", background: C.bg, borderRadius: 6 }}>{fmpStatus}</div>}
              {!(FH || FK) && <div style={{ fontSize: 11, color: C.dn, marginTop: 8 }}>Add FINNHUB_KEY secret to GitHub repo, then re-deploy to enable metrics.</div>}
              {(FH || FK) && (
                <button onClick={() => { try { localStorage.removeItem("iown_metrics_cache"); localStorage.removeItem("iown_fmp_cache"); } catch {} setFundamentals({}); fetchFundamentals(true); }} style={{ marginTop: 10, width: "100%", padding: "10px 0", background: C.accentSoft, border: `1px solid ${C.borderActive}`, borderRadius: 10, color: C.t1, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  {Object.keys(fundamentals).length <= 1 ? "Fetch Metrics" : "Refresh Metrics (clear cache)"}
                </button>
              )}
            </div>
            {/* Lock / Reset */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: "22px 20px", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginBottom: 12 }}>Security</div>
              <button onClick={() => {
                try { localStorage.removeItem("iown_remembered"); } catch {}
                setUnlocked(false); setAuthed(false); setCode("");
              }} style={{
                width: "100%", padding: "14px 0", background: "transparent",
                border: `1px solid ${C.dn}44`, borderRadius: 12,
                color: C.dn, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.dn} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                Lock App
              </button>
              <div style={{ fontSize: 11, color: C.t4, marginTop: 8, textAlign: "center" }}>Locks the app and requires the access code to re-enter</div>
            </div>
            <div style={{ marginTop: 40, textAlign: "center", paddingBottom: 20 }}>
              <img src="icon-192x192.png" alt="IOWN" style={{ width: 48, height: 48, borderRadius: 14, margin: "0 auto 16px", display: "block" }} />
              <div style={{ fontSize: 13, color: C.t4 }}>Intentional Ownership</div>
              <div style={{ fontSize: 11, color: C.t4, marginTop: 4 }}>A Registered Investment Advisor under Paradiem</div>
            </div>
          </div>
        )}
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
          { id: "research", label: "Metrics", icon: (a) => <svg width="21" height="21" viewBox="0 0 24 24" fill={a ? C.accentSoft : "none"} stroke={a ? C.t1 : C.t4} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg> },
          { id: "news", label: "News", icon: (a) => <svg width="21" height="21" viewBox="0 0 24 24" fill={a ? C.accentSoft : "none"} stroke={a ? C.t1 : C.t4} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" /><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" /></svg> },
          { id: "settings", label: "Settings", icon: (a) => <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={a ? C.t1 : C.t4} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg> },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            padding: "6px 24px", background: "transparent", border: "none", cursor: "pointer",
          }}>
            {t.icon(tab === t.id)}
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.3, color: tab === t.id ? C.t1 : C.t4 }}>{t.label}</span>
            <div style={{ width: tab === t.id ? 4 : 0, height: 4, borderRadius: 2, background: C.accent, marginTop: -2, transition: "width 0.2s cubic-bezier(0.16,1,0.3,1)", boxShadow: tab === t.id ? `0 0 8px ${C.accentGlow}` : "none" }} />
          </button>
        ))}
      </div>

      {chartSymbol && <ChartOverlay symbol={chartSymbol} onClose={() => setChartSymbol(null)} />}
      <GS />
    </div>
  );
}

function GS() {
  return (
    <style>{`
      @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.3 } }
      @keyframes spin { 0% { transform: rotate(0deg) } 100% { transform: rotate(360deg) } }
      @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
      @keyframes slideUp { from { opacity: 0; transform: translateY(40px) } to { opacity: 1; transform: translateY(0) } }
      @keyframes shake { 0%, 100% { transform: translateX(0) } 20%, 60% { transform: translateX(-6px) } 40%, 80% { transform: translateX(6px) } }
      * { -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
      input::placeholder { color: #3A4A28 !important; }
      input:focus { border-color: rgba(120,140,88,0.30) !important; }
      ::-webkit-scrollbar { width: 4px; height: 4px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: rgba(110,132,80,0.15); border-radius: 4px; }
      @media (min-width: 768px) { .tradingview-widget-container { min-height: 500px; } }
    `}</style>
  );
}
