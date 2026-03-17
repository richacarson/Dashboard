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
const vol = n => !n ? "—" : n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : `${n}`;
const fmtEps = n => n != null ? `$${Number(n).toFixed(2)}` : null;
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

const DARK = {
  bg: "#080B05", surface: "#0E120A", card: "#141A0F", cardHover: "#1B2315", elevated: "#1F2918",
  border: "rgba(120,140,88,0.07)", borderHover: "rgba(120,140,88,0.18)", borderActive: "rgba(120,140,88,0.30)",
  t1: "#EBF0E1", t2: "#B8C9A0", t3: "#6E8450", t4: "#3A4A28",
  up: "#34D399", upSoft: "#34D39920", upGlow: "#34D39940",
  dn: "#F87171", dnSoft: "#F8717120", dnGlow: "#F8717140",
  accent: "#6E8450", accentSoft: "rgba(110,132,80,0.10)", accentGlow: "rgba(110,132,80,0.30)",
  shadow: "none",
};
const LIGHT = {
  bg: "#F5F5F0", surface: "#FFFFFF", card: "#FFFFFF", cardHover: "#F0F2EC", elevated: "#FFFFFF",
  border: "rgba(80,100,60,0.12)", borderHover: "rgba(80,100,60,0.22)", borderActive: "rgba(80,100,60,0.40)",
  t1: "#1A2010", t2: "#3A4A28", t3: "#6E8450", t4: "#9DAF88",
  up: "#16A34A", upSoft: "#16A34A18", upGlow: "#16A34A30",
  dn: "#DC2626", dnSoft: "#DC262618", dnGlow: "#DC262630",
  accent: "#4A6B25", accentSoft: "rgba(74,107,37,0.08)", accentGlow: "rgba(74,107,37,0.20)",
  shadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
};
let C = DARK;

/* ── Sparkline from intraday bars array ── */
function Sparkline({ points, chg, width = 100, height = 36 }) {
  if (!points || points.length < 2) return <div style={{ width, height }} />;
  const mn = Math.min(...points), mx = Math.max(...points), rng = mx - mn || 1;
  const pad = 10; // enough room for the pulsing dot glow
  const drawW = width - pad * 2;
  const drawH = height - pad * 2;
  const pts = points.map((p, i) => [
    pad + (i / (points.length - 1)) * drawW,
    pad + ((mx - p) / rng) * drawH
  ]);
  // Smooth curve using cardinal spline
  const tension = 0.3;
  let pathD = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1[0] + (p2[0] - p0[0]) * tension;
    const cp1y = p1[1] + (p2[1] - p0[1]) * tension;
    const cp2x = p2[0] - (p3[0] - p1[0]) * tension;
    const cp2y = p2[1] - (p3[1] - p1[1]) * tension;
    pathD += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`;
  }
  const color = (chg != null ? chg : 0) >= 0 ? C.up : C.dn;
  const id = `sp${Math.random().toString(36).slice(2, 8)}`;
  // Fill path: close to bottom
  const fillD = pathD + ` L${pts[pts.length-1][0]},${height - pad} L${pts[0][0]},${height - pad} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block", flexShrink: 0 }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={fillD} fill={`url(#${id})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {/* Pulsing dot at last point */}
      <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="5" fill={color} opacity="0.15">
        <animate attributeName="r" values="3;7;3" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.2;0.05;0.2" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="2.5" fill={color} />
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
        <div key={cell.sym} onClick={() => onTap(cell.sym)} data-heatmap={cell.sym} style={{
          background: getColor(cell.chg),
          padding: "10px 6px", cursor: "pointer",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          minHeight: 64, borderRadius: 4, transition: "background 0.6s ease-out",
        }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#fff", letterSpacing: 0.3, textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>{cell.sym}</div>
          <div data-heatmap-chg={cell.sym} style={{
            fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.85)",
            marginTop: 2, fontVariantNumeric: "tabular-nums",
            textShadow: "0 1px 2px rgba(0,0,0,0.4)",
          }}>{cell.chg >= 0 ? "+" : ""}{cell.chg.toFixed(1)}%</div>
        </div>
      ))}
    </div>
  );
}

/* ── Stock Logo with fallback ── */
function StockLogo({ symbol, size = 32 }) {
  const [errCount, setErrCount] = useState(0);
  // Map tickers to company domains for logo lookup
  const domainMap = {
    AAPL:"apple.com",MSFT:"microsoft.com",GOOGL:"google.com",GOOG:"google.com",AMZN:"amazon.com",
    META:"meta.com",NVDA:"nvidia.com",TSLA:"tesla.com",JPM:"jpmorganchase.com",V:"visa.com",
    JNJ:"jnj.com",WMT:"walmart.com",PG:"pg.com",MA:"mastercard.com",HD:"homedepot.com",
    DIS:"disney.com",NFLX:"netflix.com",ADBE:"adobe.com",CRM:"salesforce.com",PYPL:"paypal.com",
    INTC:"intel.com",VZ:"verizon.com",KO:"coca-cola.com",PEP:"pepsico.com",ABT:"abbott.com",
    MRK:"merck.com",TMO:"thermofisher.com",COST:"costco.com",NKE:"nike.com",LLY:"lilly.com",
    AVGO:"broadcom.com",TXN:"ti.com",QCOM:"qualcomm.com",LOW:"lowes.com",SBUX:"starbucks.com",
    AMD:"amd.com",AMAT:"appliedmaterials.com",CAT:"caterpillar.com",GS:"goldmansachs.com",
    BLK:"blackrock.com",AXP:"americanexpress.com",BA:"boeing.com",MMM:"3m.com",IBM:"ibm.com",
    GE:"ge.com",F:"ford.com",GM:"gm.com",UBER:"uber.com",SQ:"squareup.com",SNAP:"snap.com",
    SPOT:"spotify.com",ABNB:"airbnb.com",COIN:"coinbase.com",HOOD:"robinhood.com",
    PLTR:"palantir.com",RBLX:"roblox.com",SHOP:"shopify.com",NET:"cloudflare.com",
    ZM:"zoom.us",DOCU:"docusign.com",OKTA:"okta.com",SNOW:"snowflake.com",DDOG:"datadoghq.com",
    CRWD:"crowdstrike.com",ZS:"zscaler.com",MDB:"mongodb.com",U:"unity.com",
    // Dividend / Value tickers
    O:"realtyincome.com",STLD:"steeldynamics.com",VLO:"valero.com",CNX:"cnx.com",
    BKH:"blackhillscorp.com",AEM:"agnicoeagle.com",GFI:"goldfields.com",
    SUPV:"gruposupervielle.com",MARA:"maraholdings.com",ATAT:"atni.com",
    DVY:"ishares.com",IUSG:"ishares.com",IWS:"ishares.com",SPY:"ssga.com",QQQ:"invesco.com",DIA:"ssga.com",
    IBIT:"ishares.com",ETHA:"ishares.com",
    // More
    PFE:"pfizer.com",ABBV:"abbvie.com",UNH:"unitedhealthgroup.com",CVX:"chevron.com",
    XOM:"exxonmobil.com",T:"att.com",MCD:"mcdonalds.com",WFC:"wellsfargo.com",C:"citigroup.com",
    BAC:"bankofamerica.com",MS:"morganstanley.com",SCHW:"schwab.com",USB:"usbank.com",
    PNC:"pnc.com",TFC:"truist.com",COF:"capitalone.com",ADP:"adp.com",FIS:"fisglobal.com",
    FISV:"fiserv.com",ICE:"ice.com",CME:"cmegroup.com",SPGI:"spglobal.com",MCO:"moodys.com",
    AON:"aon.com",MMC:"mmc.com",TRV:"travelers.com",CB:"chubb.com",AFL:"aflac.com",
  };
  const domain = domainMap[symbol];
  const srcs = [
    ...(domain ? [`https://logo.clearbit.com/${domain}`, `https://www.google.com/s2/favicons?sz=128&domain=${domain}`] : []),
    `https://logo.synthfinance.com/ticker/${symbol}`,
    `https://eodhd.com/img/logos/US/${symbol}.png`,
  ];
  if (errCount >= srcs.length) {
    const colors = ["#4A6B25","#3B82F6","#8B5CF6","#EC4899","#F59E0B","#10B981","#6366F1","#F97316"];
    const bg = colors[symbol.charCodeAt(0) % colors.length];
    return (
      <div style={{ width: size, height: size, borderRadius: size / 2, background: bg + "22", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <span style={{ fontSize: size * 0.4, fontWeight: 800, color: bg }}>{symbol.slice(0, 2)}</span>
      </div>
    );
  }
  return (
    <img
      src={srcs[errCount]}
      alt={symbol}
      onError={() => setErrCount(n => n + 1)}
      style={{ width: size, height: size, borderRadius: size / 2, objectFit: "contain", background: C.surface, flexShrink: 0 }}
    />
  );
}
function ChartOverlay({ symbol, onClose, hdrs, names, theme, quotesRef, barsRef }) {
  const containerRef = useRef(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const touchStart = useRef(null);

  const handleTouchStart = (e) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, edge: t.clientX < 30 };
  };
  const handleTouchMove = (e) => {
    if (!touchStart.current?.edge) return;
    const dx = e.touches[0].clientX - touchStart.current.x;
    if (dx > 10) { setDragging(true); setDragX(Math.max(0, dx)); e.preventDefault(); }
  };
  const handleTouchEnd = () => {
    if (dragX > 120) onClose();
    setDragX(0); setDragging(false); touchStart.current = null;
  };

  const isDark = theme === "dark";

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = "";
    const widgetDiv = document.createElement("div");
    widgetDiv.className = "tradingview-widget-container__widget";
    widgetDiv.style.height = "100%";
    widgetDiv.style.width = "100%";
    containerRef.current.appendChild(widgetDiv);
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: symbol,
      interval: "W",
      timezone: "America/New_York",
      theme: isDark ? "dark" : "light",
      style: "1",
      locale: "en",
      backgroundColor: isDark ? "#080B05" : "#F5F5F0",
      gridColor: isDark ? "rgba(110,132,80,0.04)" : "rgba(80,100,60,0.04)",
      allow_symbol_change: false,
      hide_volume: false,
      hide_top_toolbar: false,
      hide_legend: false,
      hide_side_toolbar: false,
      save_image: false,
      calendar: false,
      withdateranges: true,
      details: false,
      hotlist: false,
      show_popup_button: false,
      favorite_intervals: ["1", "5", "15", "60", "240", "D"],
      overrides: {
        "mainSeriesProperties.candleStyle.upColor": isDark ? "#34D399" : "#16A34A",
        "mainSeriesProperties.candleStyle.downColor": isDark ? "#F87171" : "#DC2626",
        "mainSeriesProperties.candleStyle.wickUpColor": isDark ? "#34D399" : "#16A34A",
        "mainSeriesProperties.candleStyle.wickDownColor": isDark ? "#F87171" : "#DC2626",
        "mainSeriesProperties.candleStyle.borderUpColor": isDark ? "#34D399" : "#16A34A",
        "mainSeriesProperties.candleStyle.borderDownColor": isDark ? "#F87171" : "#DC2626",
        "paneProperties.background": isDark ? "#080B05" : "#F5F5F0",
        "paneProperties.backgroundType": "solid",
      },
      support_host: "https://www.tradingview.com",
    });
    containerRef.current.appendChild(script);
  }, [symbol, theme]);

  // Live price
  const livePriceRef = useRef(null);
  const livePctRef = useRef(null);
  useEffect(() => {
    const timer = setInterval(() => {
      const q = quotesRef?.current?.[symbol];
      if (q?.p && livePriceRef.current) livePriceRef.current.textContent = `$${q.p.toFixed(2)}`;
      const b = barsRef?.current?.[symbol];
      if (q?.p && b?.pc && livePctRef.current) {
        const c = ((q.p - b.pc) / b.pc) * 100;
        livePctRef.current.textContent = `${c >= 0 ? "+" : ""}${c.toFixed(2)}%`;
        livePctRef.current.style.color = c >= 0 ? C.up : C.dn;
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [symbol]);

  return (
    <div onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
      background: C.bg, display: "flex", flexDirection: "column",
      paddingTop: "env(safe-area-inset-top, 0px)",
      paddingBottom: "env(safe-area-inset-bottom, 0px)",
      transform: dragX > 0 ? `translateX(${dragX}px)` : "none",
      transition: dragging ? "none" : "transform 0.3s cubic-bezier(0.16,1,0.3,1)",
      overflow: "hidden",
    }}>
      {/* Minimal header — compact, blends with chart */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "6px 16px 6px", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <StockLogo symbol={symbol} size={32} />
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: 17, fontWeight: 800, color: C.t1, letterSpacing: 0.3 }}>{symbol}</span>
              <span ref={livePriceRef} style={{ fontSize: 15, fontWeight: 700, color: C.t2 }}></span>
              <span ref={livePctRef} style={{ fontSize: 12, fontWeight: 700, color: C.t3 }}></span>
            </div>
            <div style={{ fontSize: 11, color: C.t4, marginTop: 1 }}>{names?.[symbol] || ""}</div>
          </div>
        </div>
        <button onClick={onClose} style={{
          width: 32, height: 32, borderRadius: 16, background: C.t4 + "15",
          border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.t3} strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>
      {/* Chart — takes all remaining space, no borders */}
      <div ref={containerRef} style={{ flex: 1, width: "100%", marginBottom: -2 }} className="tradingview-widget-container" />
      {/* Hide TradingView copyright bar with CSS */}
      <style>{`
        .tradingview-widget-copyright { display: none !important; }
        .tradingview-widget-container iframe { border: none !important; }
      `}</style>
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
  const sleevesRef = useRef(sleeves);
  useEffect(() => { sleevesRef.current = sleeves; }, [sleeves]);
  const [news, setNews] = useState([]);
  const [fundamentals, setFundamentals] = useState({}); // { SYM: { pe, peFwd, peg, roe, de, ... } }
  const [loading, setLoading] = useState(false);
  const [lastUp, setLastUp] = useState(null);
  const lastUpRef = useRef(null);
  const [tab, setTab] = useState("home");
  const [briefView, setBriefView] = useState(null); // null = picker, "morning" | "commentary" | "report"
  const contentRef = useRef(null);
  const tabSwipeRef = useRef(null);
  const tabIds = ["home", "research", "calendar", "news", "settings"];
  // Swipe between tabs on mobile
  const handleTabSwipeStart = (e) => {
    if (isDesktop) return;
    const x = e.touches[0].clientX;
    const w = window.innerWidth;
    // Only activate from left or right 30px edge
    if (x > 30 && x < w - 30) return;
    tabSwipeRef.current = { x, y: e.touches[0].clientY, edge: x <= 30 ? "left" : "right" };
  };
  const handleTabSwipeEnd = (e) => {
    if (!tabSwipeRef.current || isDesktop) return;
    const dx = e.changedTouches[0].clientX - tabSwipeRef.current.x;
    const dy = e.changedTouches[0].clientY - tabSwipeRef.current.y;
    const edge = tabSwipeRef.current.edge;
    tabSwipeRef.current = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const idx = tabIds.indexOf(tab);
    // Swipe right from left edge → previous tab
    if (edge === "left" && dx > 60 && idx > 0) setTab(tabIds[idx - 1]);
    // Swipe left from right edge → next tab
    if (edge === "right" && dx < -60 && idx < tabIds.length - 1) setTab(tabIds[idx + 1]);
  };
  // Double-tap tab bar to scroll to top
  const lastTabTap = useRef({});
  const handleTabTap = (id) => {
    const now = Date.now();
    if (id === tab && now - (lastTabTap.current[id] || 0) < 400) {
      contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
    lastTabTap.current[id] = now;
    setTab(id);
  };
  const [openSleeves, setOpenSleeves] = useState({});
  const [chartSymbol, setChartSymbol] = useState(null);
  const [refresh, setRefresh] = useState(null); // null = smart auto
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("iown_theme") || "light"; } catch { return "light"; }
  });
  C = theme === "light" ? LIGHT : DARK;
  const toggleTheme = (t) => { setTheme(t); try { localStorage.setItem("iown_theme", t); } catch {} };
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== "undefined" && window.innerWidth >= 768);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = e => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
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
  const [researchView, setResearchView] = useState("dividend"); // sleeve key
  const [metricSort, setMetricSort] = useState({ col: null, dir: "desc" }); // { col: "peTTM", dir: "asc"|"desc" }
  const [metricsEditMode, setMetricsEditMode] = useState(false);
  const [peerSymbol, setPeerSymbol] = useState(null); // for peer comparison overlay
  const [metricsSubView, setMetricsSubView] = useState("table"); // "table" | "attribution" | "peers"
  const [metricsTickerInput, setMetricsTickerInput] = useState("");
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
    const t = setInterval(() => {
      const ms = getMarketStatus();
      // Only trigger re-render if status actually changed (open/closed transition)
      setMarketStatus(prev => prev.status === ms.status ? prev : ms);
    }, 30000);
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
  const [priceFlash, setPriceFlash] = useState({});
  const quotesRef = useRef({}); // Store quotes in ref to avoid re-renders on poll
  const barsRef = useRef({});

  const fetchData = useCallback(async (showLoading = false) => {
    if (!apiKey || !apiSecret) return;
    if (showLoading) setLoading(true);
    try {
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

      const prevQ = quotesRef.current;
      const prevB = barsRef.current;
      const isFirstLoad = Object.keys(prevQ).length === 0;

      // Direct DOM updates for prices — no React re-render needed
      const hmColor = (chg) => {
        const maxA = 5;
        const intensity = Math.min(Math.abs(chg) / maxA, 1);
        if (chg > 0) return `rgb(${Math.round(8+intensity*10)},${Math.round(30+intensity*100)},${Math.round(15+intensity*40)})`;
        if (chg < 0) return `rgb(${Math.round(50+intensity*150)},${Math.round(15+intensity*15)},${Math.round(15+intensity*15)})`;
        return C.card;
      };
      const flashes = {};
      let anyQuoteChanged = false;
      for (const s of Object.keys(nq)) {
        if (!prevQ[s] || prevQ[s].p !== nq[s]?.p) {
          anyQuoteChanged = true;
          if (prevQ[s] && nq[s]) flashes[s] = nq[s].p > prevQ[s].p ? "up" : "dn";
          const pc = nb[s]?.pc || prevB[s]?.pc;
          if (nq[s] && pc) {
            const c = ((nq[s].p - pc) / pc) * 100;
            // Ticker row change badge
            const el = document.querySelector(`[data-ticker-chg="${s}"]`);
            if (el) {
              el.textContent = `${c >= 0 ? "+" : ""}${c.toFixed(2)}%`;
              el.style.color = c > 0 ? C.up : c < 0 ? C.dn : C.t3;
              el.style.borderColor = c > 0 ? C.up + "55" : c < 0 ? C.dn + "55" : C.border;
            }
            // Heatmap cell
            const hmChg = document.querySelector(`[data-heatmap-chg="${s}"]`);
            if (hmChg) hmChg.textContent = `${c >= 0 ? "+" : ""}${c.toFixed(1)}%`;
            const hmCell = document.querySelector(`[data-heatmap="${s}"]`);
            if (hmCell) hmCell.style.background = hmColor(c);
            // Metrics Day column
            const metDay = document.querySelector(`[data-metric-day="${s}"]`);
            if (metDay) {
              metDay.textContent = `${c >= 0 ? "+" : ""}${c.toFixed(2)}%`;
              metDay.style.color = c > 0 ? C.up : c < 0 ? C.dn : C.t3;
            }
          }
        }
      }
      // Update benchmark DOM directly
      for (const s of Object.keys(bq)) {
        const el = document.querySelector(`[data-bm-price="${s}"]`);
        const elChg = document.querySelector(`[data-bm-chg="${s}"]`);
        if (el && bq[s]) el.textContent = bq[s].p?.toFixed(2) || "";
        if (elChg && bq[s] && bb[s]?.pc) {
          const c = ((bq[s].p - bb[s].pc) / bb[s].pc) * 100;
          elChg.textContent = `${c >= 0 ? "+" : ""}${c.toFixed(2)}%`;
          elChg.style.color = c > 0 ? C.up : c < 0 ? C.dn : C.t3;
        }
      }

      // Store in refs (no re-render)
      quotesRef.current = nq;
      barsRef.current = { ...prevB, ...nb };

      // Update sleeve average % changes via DOM
      for (const [k, sleeve] of Object.entries(sleeves)) {
        const changes = sleeve.symbols.map(s => {
          const q = nq[s], pc = (nb[s]?.pc || barsRef.current[s]?.pc);
          return (q?.p && pc) ? ((q.p - pc) / pc) * 100 : null;
        }).filter(c => c !== null);
        const avg = changes.length ? changes.reduce((a, b) => a + b, 0) / changes.length : null;
        const el = document.querySelector(`[data-sleeve-chg="${k}"]`);
        if (el && avg != null) {
          el.textContent = `${avg >= 0 ? "+" : ""}${avg.toFixed(2)}%`;
          el.style.color = avg >= 0 ? C.up : C.dn;
        }
      }

      // Flash effect
      if (Object.keys(flashes).length) {
        for (const [s, dir] of Object.entries(flashes)) {
          const el = document.querySelector(`[data-ticker-chg="${s}"]`);
          if (el) {
            el.style.background = dir === "up" ? C.up + "30" : C.dn + "30";
            setTimeout(() => { if (el) el.style.background = "transparent"; }, 600);
          }
        }
      }

      // Only trigger React re-render on first load or manual refresh
      if (isFirstLoad || showLoading) {
        setQuotes(nq); setBars(nb); setBmQuotes(bq); setBmBars(bb);
      }
      // Update bmQuotes/bmBars refs for benchmarks
      if (Object.keys(bq).length) setBmQuotes(prev => isFirstLoad || showLoading ? { ...prev, ...bq } : prev);
      if (Object.keys(bb).length) setBmBars(prev => isFirstLoad || showLoading ? { ...prev, ...bb } : prev);

      // Update timestamp via ref + DOM (no re-render)
      const now = new Date();
      if (!lastUpRef.current || now - lastUpRef.current > 3000) {
        lastUpRef.current = now;
        const el = document.querySelector("[data-last-updated]");
        if (el) el.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        if (isFirstLoad || showLoading) setLastUp(now);
      }
    } catch (e) { console.error(e); } finally { if (showLoading) setLoading(false); }
  }, [apiKey, apiSecret, hdrs, ALL]);

  /* ── Fetch intraday bars for sparklines ── */
  const intradayRef = useRef({});
  const fetchIntraday = useCallback(async () => {
    if (!apiKey || !apiSecret) return;
    try {
      const today = new Date().toISOString().split("T")[0];
      const r = await fetch(`${BASE}/v2/stocks/bars?symbols=${ALL.join(",")}&timeframe=5Min&start=${today}T04:00:00Z&feed=iex&limit=10000`, { headers: hdrs });
      if (!r.ok) return;
      const d = await r.json();
      const pts = {};
      if (d.bars) {
        for (const [s, barArr] of Object.entries(d.bars)) {
          pts[s] = barArr.map(b => b.c);
        }
      }
      // Only update React state if the number of data points changed (new bar appeared)
      const prev = intradayRef.current;
      const changed = Object.keys(pts).some(s => (pts[s]?.length || 0) !== (prev[s]?.length || 0));
      intradayRef.current = pts;
      if (changed || Object.keys(prev).length === 0) setIntradayPts(pts);
    } catch {}
  }, [apiKey, apiSecret, hdrs]);

  /* ── Fetch news ── */
  const fetchNews = useCallback(async () => {
    if (!apiKey || !apiSecret) return;
    try {
      // Holdings news: only core portfolio symbols
      const holdingsR = await fetch(`${BASE}/v1beta1/news?symbols=${coreSyms.join(",")}&limit=30&sort=desc`, { headers: hdrs });
      if (holdingsR.ok) { const d = await holdingsR.json(); const newNews = d.news || []; setNews(prev => prev.length === newNews.length && prev[0]?.id === newNews[0]?.id ? prev : newNews); }
      // Broad market news: no symbol filter
      const broadR = await fetch(`${BASE}/v1beta1/news?limit=30&sort=desc`, { headers: hdrs });
      if (broadR.ok) { const d = await broadR.json(); setBroadNews(d.news || []); }
    } catch {}
  }, [apiKey, apiSecret, hdrs, coreSyms]);

    /* ── Fetch fundamentals via Finnhub (1 call/symbol, 60/min free) ── */
  const [fmpStatus, setFmpStatus] = useState("");
  const [earningsCalendar, setEarningsCalendar] = useState([]);
  const [econCalendar, setEconCalendar] = useState([]);
  const [calendarView, setCalendarView] = useState("economic");
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
    const curQtr = Math.floor(new Date().getMonth() / 3);

    // Quarter date boundaries
    const now = new Date();
    const year = now.getFullYear();
    const curQtrStart = new Date(year, curQtr * 3, 1);
    const prevQtrStartDate = curQtr === 0 ? new Date(year - 1, 9, 1) : new Date(year, (curQtr - 1) * 3, 1);
    const ytdStartDate = new Date(year, 0, 1);
    const fmtDate = d => d.toISOString().slice(0, 10);

    // Fetch Alpaca daily bars for all core symbols covering prev quarter through now
    let alpacaBars = {};
    if (apiKey && apiSecret) {
      try {
        const startDate = fmtDate(prevQtrStartDate);
        // Alpaca allows max 200 symbols per request, batch if needed
        for (let batch = 0; batch < coreSyms.length; batch += 50) {
          const chunk = coreSyms.slice(batch, batch + 50);
          const url = `${BASE}/v2/stocks/bars?symbols=${chunk.join(",")}&timeframe=1Day&start=${startDate}&feed=iex&limit=10000&adjustment=split`;
          const r = await fetch(url, { headers: hdrs });
          if (r.ok) {
            const data = await r.json();
            if (data.bars) Object.assign(alpacaBars, data.bars);
          }
        }
        if (Object.keys(alpacaBars).length > 0) setFmpStatus(`Alpaca bars: ${Object.keys(alpacaBars).length} symbols loaded`);
      } catch (e) { console.warn("Alpaca bars fetch failed:", e.message); }
    }

    for (let i = 0; i < coreSyms.length; i++) {
      const sym = coreSyms[i];
      if (i % 5 === 0) setFmpStatus(`Finnhub: ${i + 1}/${coreSyms.length}… (${success} ok)`);
      try {
        // Fetch metrics + company profile in parallel
        const [metR, profR] = await Promise.all([
          fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${sym}&metric=all&token=${key}`),
          fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${sym}&token=${key}`).catch(() => null),
        ]);
        if (!metR.ok) {
          if (metR.status === 429) { setFmpStatus(`Rate limited at ${i}. Waiting…`); await new Promise(r => setTimeout(r, 61000)); i--; continue; }
          continue;
        }
        const d = await metR.json();
        const m = d?.metric || {};
        // Profile: industry from Finnhub
        let profileIndustry = null, profileSector = null, profileName = null;
        if (profR?.ok) {
          const prof = await profR.json();
          profileIndustry = prof?.finnhubIndustry || null;
          profileName = prof?.name || null;
          // Map Finnhub industries to broader sectors
          const ind = (profileIndustry || "").toLowerCase();
          if (ind.includes("tech") || ind.includes("software") || ind.includes("semiconductor") || ind.includes("internet") || ind.includes("electronic")) profileSector = "Technology";
          else if (ind.includes("bank") || ind.includes("financ") || ind.includes("insurance") || ind.includes("capital") || ind.includes("invest")) profileSector = "Financials";
          else if (ind.includes("pharma") || ind.includes("biotech") || ind.includes("health") || ind.includes("medical")) profileSector = "Healthcare";
          else if (ind.includes("oil") || ind.includes("gas") || ind.includes("energy") || ind.includes("coal") || ind.includes("solar")) profileSector = "Energy";
          else if (ind.includes("retail") || ind.includes("consumer") || ind.includes("apparel") || ind.includes("auto") || ind.includes("restaurant") || ind.includes("entertainment") || ind.includes("media")) profileSector = "Consumer";
          else if (ind.includes("industr") || ind.includes("aerospace") || ind.includes("defense") || ind.includes("machin") || ind.includes("construct")) profileSector = "Industrials";
          else if (ind.includes("real estate") || ind.includes("reit")) profileSector = "Real Estate";
          else if (ind.includes("metal") || ind.includes("mining") || ind.includes("steel") || ind.includes("chemical") || ind.includes("material")) profileSector = "Materials";
          else if (ind.includes("telecom") || ind.includes("communication")) profileSector = "Communication";
          else if (ind.includes("utilit") || ind.includes("electric") || ind.includes("water") || ind.includes("power")) profileSector = "Utilities";
          else if (ind.includes("food") || ind.includes("beverage") || ind.includes("household") || ind.includes("tobacco")) profileSector = "Staples";
          else if (ind.includes("crypto") || ind.includes("digital") || ind.includes("blockchain")) profileSector = "Digital Assets";
          else profileSector = profileIndustry ? "Other" : null;
        }

        // Calculate quarter returns from Alpaca daily bars
        let lastQtrCalc = null, thisQtrCalc = null, ytdCalc = null;
        const bars = alpacaBars[sym];
        if (bars && bars.length > 1) {
          // bars are sorted chronologically, each has { t: "2025-10-01T...", c: 123.45, ... }
          const findPrice = (targetDate) => {
            const target = fmtDate(targetDate);
            // Find closest bar on or before the target date
            let best = null;
            for (const bar of bars) {
              const barDate = bar.t.slice(0, 10);
              if (barDate <= target) best = bar.c;
            }
            return best;
          };
          // Find closest bar on or after for start-of-period prices
          const findPriceAfter = (targetDate) => {
            const target = fmtDate(targetDate);
            for (const bar of bars) {
              const barDate = bar.t.slice(0, 10);
              if (barDate >= target) return bar.c;
            }
            return null;
          };

          const pPrevStart = findPriceAfter(prevQtrStartDate); // first trading day on/after Oct 1
          const pPrevEnd = findPrice(curQtrStart);               // last trading day before Jan 1
          const pCurStart = findPriceAfter(curQtrStart);         // first trading day on/after Jan 1
          const pYtdStart = findPriceAfter(ytdStartDate);        // first trading day on/after Jan 1
          const pNow = bars[bars.length - 1].c;                  // latest close

          if (pPrevStart && pPrevEnd) lastQtrCalc = ((pPrevEnd - pPrevStart) / pPrevStart) * 100;
          if (pCurStart && pNow) thisQtrCalc = ((pNow - pCurStart) / pCurStart) * 100;
          if (pYtdStart && pNow) ytdCalc = ((pNow - pYtdStart) / pYtdStart) * 100;
        }

        results[sym] = {
          companyName: profileName,
          sector: profileSector,
          industry: profileIndustry,
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
          lastQtr: lastQtrCalc,
          thisQtr: thisQtrCalc ?? (curQtr === 0 ? (m["yearToDatePriceReturnDaily"] ?? null) : null),
          ytd: ytdCalc ?? m["yearToDatePriceReturnDaily"] ?? null,
        };
        if (results[sym].peTTM != null) success++;
        // Also set company name from Finnhub profile
        if (profileName) setNames(prev => prev[sym] ? prev : { ...prev, [sym]: profileName });
        if (i === 0) setFmpStatus(`Fetching… keys ok`);
      } catch (e) { console.warn("Finnhub", sym, e.message); }
    }

    results._ts = Date.now();
    setFmpStatus(`Done: ${success}/${coreSyms.length} via Finnhub`);
    setFundamentals(results);
    try { localStorage.setItem("iown_metrics_cache", JSON.stringify(results)); } catch {}
  }, [coreSyms, apiKey, apiSecret, hdrs]);

  /* ── Fetch economic + earnings calendar ── */
  const fetchCalendar = useCallback(async () => {
    try {
      let events = [];
      // Try static JSON first — add cache buster to avoid stale data
      const cacheBust = `?t=${Math.floor(Date.now() / 60000)}`;
      const staticUrls = [
        `https://raw.githubusercontent.com/richacarson/Dashboard/main/public/economic-calendar.json${cacheBust}`,
        `${import.meta.env.BASE_URL || "/"}economic-calendar.json${cacheBust}`,
        `./economic-calendar.json${cacheBust}`,
      ];
      for (const url of staticUrls) {
        try {
          const r = await fetch(url).catch(() => null);
          if (r?.ok) {
            const data = await r.json();
            if (Array.isArray(data) && data.length > 0) { events = data; break; }
          }
        } catch {}
      }
      // ALWAYS try live feed to get fresh actuals (even if static has events)
      const liveUrls = [
        ["https://nfs.faireconomy.media/ff_calendar_thisweek.json", "https://nfs.faireconomy.media/ff_calendar_nextweek.json"],
      ];
      for (const [thisUrl, nextUrl] of liveUrls) {
        try {
          const [thisR, nextR] = await Promise.all([fetch(thisUrl).catch(() => null), fetch(nextUrl).catch(() => null)]);
          const thisW = thisR?.ok ? await thisR.json() : [];
          const nextW = nextR?.ok ? await nextR.json() : [];
          const combined = [...(Array.isArray(thisW) ? thisW : []), ...(Array.isArray(nextW) ? nextW : [])];
          const liveFiltered = combined.filter(e => e.country === "USD" && (e.impact === "High" || e.impact === "Medium"));
          if (liveFiltered.length > 0) {
            if (events.length === 0) {
              events = liveFiltered;
            } else {
              // Merge live actuals into static data
              const liveMap = {};
              liveFiltered.forEach(e => { liveMap[e.title + "|" + (e.date || "").slice(0, 10)] = e; });
              events = events.map(e => {
                const key = e.title + "|" + (e.date || "").slice(0, 10);
                const live = liveMap[key];
                if (live && live.actual) return { ...e, actual: live.actual };
                return e;
              });
            }
            break;
          }
        } catch {}
      }
      events.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
      setEconCalendar(events);
    } catch (e) { console.warn("Econ calendar fetch failed:", e.message); }

    // Earnings: Finnhub (free endpoint)
    const key = FH || FK;
    if (!key) return;
    const today = new Date();
    const from = new Date(today); from.setDate(from.getDate() - 3);
    const to = new Date(today); to.setDate(to.getDate() + 30);
    const fmt = d => d.toISOString().slice(0, 10);
    try {
      const r = await fetch(`https://finnhub.io/api/v1/calendar/earnings?from=${fmt(from)}&to=${fmt(to)}&token=${key}`);
      if (r.ok) {
        const data = await r.json();
        const raw = data.earningsCalendar || data.result || data.data || [];
        const list = Array.isArray(raw) ? raw : (raw.result || raw.data || []);
        const earnings = list
          .filter(e => coreSyms.includes(e.symbol))
          .map(e => ({
            ...e,
            epsEstimate: e.epsEstimate ?? e.estimate ?? e.eps_estimate ?? null,
            epsActual: e.epsActual ?? e.actual ?? e.eps_actual ?? null,
            revenueEstimate: e.revenueEstimate ?? e.revenue_estimate ?? null,
            revenueActual: e.revenueActual ?? e.revenue_actual ?? null,
          }))
          .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

        // Cache estimates — Finnhub removes them after earnings are reported
        let cache = {};
        try { cache = JSON.parse(localStorage.getItem("iown_earnings_est") || "{}"); } catch {}
        for (const e of earnings) {
          const key = `${e.symbol}|${e.date}`;
          if (e.epsEstimate != null) cache[key] = { eps: e.epsEstimate, rev: e.revenueEstimate };
          else if (cache[key]) {
            // Restore cached estimates that Finnhub has removed
            e.epsEstimate = cache[key].eps;
            if (e.revenueEstimate == null) e.revenueEstimate = cache[key].rev;
          }
        }
        try { localStorage.setItem("iown_earnings_est", JSON.stringify(cache)); } catch {}

        setEarningsCalendar(earnings);
      }
    } catch (e) { console.warn("Earnings fetch failed:", e.message); }
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
          if (msg.T === "t" && msg.S && msg.p) {
            // Update via DOM, not React state
            const prev = quotesRef.current[msg.S];
            quotesRef.current[msg.S] = { p: msg.p, t: msg.t };
            const bars = barsRef.current[msg.S];
            if (bars?.pc) {
              const c = ((msg.p - bars.pc) / bars.pc) * 100;
              const el = document.querySelector(`[data-ticker-chg="${msg.S}"]`);
              if (el) {
                el.textContent = `${c >= 0 ? "+" : ""}${c.toFixed(2)}%`;
                el.style.color = c > 0 ? C.up : c < 0 ? C.dn : C.t3;
                el.style.borderColor = c > 0 ? C.up + "55" : c < 0 ? C.dn + "55" : C.border;
                // Flash
                if (prev && prev.p !== msg.p) {
                  const dir = msg.p > prev.p ? C.up : C.dn;
                  el.style.background = dir + "30";
                  setTimeout(() => { if (el) el.style.background = "transparent"; }, 600);
                }
              }
              // Update benchmark if applicable
              const bmEl = document.querySelector(`[data-bm-price="${msg.S}"]`);
              if (bmEl) bmEl.textContent = msg.p.toFixed(2);
              const bmChgEl = document.querySelector(`[data-bm-chg="${msg.S}"]`);
              if (bmChgEl) {
                bmChgEl.textContent = `${c >= 0 ? "+" : ""}${c.toFixed(2)}%`;
                bmChgEl.style.color = c > 0 ? C.up : c < 0 ? C.dn : C.t3;
              }
              // Heatmap
              const hmChg = document.querySelector(`[data-heatmap-chg="${msg.S}"]`);
              if (hmChg) hmChg.textContent = `${c >= 0 ? "+" : ""}${c.toFixed(1)}%`;
              const hmCell = document.querySelector(`[data-heatmap="${msg.S}"]`);
              if (hmCell) {
                const maxA = 5, intensity = Math.min(Math.abs(c) / maxA, 1);
                hmCell.style.background = c > 0 ? `rgb(${Math.round(8+intensity*10)},${Math.round(30+intensity*100)},${Math.round(15+intensity*40)})` : c < 0 ? `rgb(${Math.round(50+intensity*150)},${Math.round(15+intensity*15)},${Math.round(15+intensity*15)})` : C.card;
              }
              // Metrics Day column
              const metDay = document.querySelector(`[data-metric-day="${msg.S}"]`);
              if (metDay) { metDay.textContent = `${c >= 0 ? "+" : ""}${c.toFixed(2)}%`; metDay.style.color = c > 0 ? C.up : c < 0 ? C.dn : C.t3; }
              // Sleeve averages
              for (const [k, sleeve] of Object.entries(sleevesRef.current)) {
                if (!sleeve.symbols.includes(msg.S)) continue;
                const changes = sleeve.symbols.map(s => {
                  const q = quotesRef.current[s], pc = barsRef.current[s]?.pc;
                  return (q?.p && pc) ? ((q.p - pc) / pc) * 100 : null;
                }).filter(v => v !== null);
                const avg = changes.length ? changes.reduce((a, b) => a + b, 0) / changes.length : null;
                const el = document.querySelector(`[data-sleeve-chg="${k}"]`);
                if (el && avg != null) { el.textContent = `${avg >= 0 ? "+" : ""}${avg.toFixed(2)}%`; el.style.color = avg >= 0 ? C.up : C.dn; }
              }
            }
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
      fetchData(true);
      fetchIntraday();
      fetchNames();
      fetchNews();
      fetchFundamentals();
      fetchCalendar();
      // Preload ExcelJS for export
      if (!window.ExcelJS) { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js"; document.head.appendChild(s); }
      connectWS();
    } catch { setAuthErr("Invalid API keys."); }
  };

  useEffect(() => { if (EK && ES && !authed && unlocked) auth(); }, [unlocked]);
  useEffect(() => {
    if (!authed) return;
    const getInterval = () => {
      if (refresh === 0) return null;
      if (refresh > 0) return refresh * 1000;
      return marketStatus.status === "open" ? 1000 : null;
    };
    const ms = getInterval();
    if (ms) {
      // Price polling — fast, no re-renders
      iRef.current = setInterval(() => { fetchData(); }, ms);
      // News polling — slow, separate timer
      const newsTimer = setInterval(() => { fetchNews(); }, 60000);
      // Sparkline refresh every 30s (new 5min bar appears every 5min, but check frequently)
      const sparkTimer = setInterval(() => { fetchIntraday(); }, 30000);
      // Calendar refresh every 5 min to pick up actuals from GitHub Action
      const calTimer = setInterval(() => { fetchCalendar(); }, 300000);
      return () => { clearInterval(iRef.current); clearInterval(newsTimer); clearInterval(sparkTimer); clearInterval(calTimer); };
    }
  }, [authed, refresh, fetchData, fetchNews, marketStatus.status]);

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
          <img src="iown-logo.png" alt="IOWN" style={{ width: 240, height: "auto", margin: "0 auto 28px", display: "block" }} />
          <p style={{ fontSize: 15, color: C.t3, marginBottom: 40, lineHeight: 1.5, fontStyle: "italic", letterSpacing: 0.2 }}>Research Reveals Opportunities</p>
          <div style={{ background: C.surface, borderRadius: 20, padding: 28, border: `1px solid ${codeFocused ? C.borderActive : C.border}`, boxShadow: "0 16px 64px rgba(0,0,0,0.3)", transition: "border-color 0.3s" }}>
            <input type="password" value={code} onChange={e => { setCode(e.target.value); setCodeErr(false); }} onKeyDown={e => { if (e.key === "Enter") handleUnlock(); }} onFocus={() => setCodeFocused(true)} onBlur={() => setCodeFocused(false)} placeholder="Access code" style={{ width: "100%", padding: "18px 20px", background: C.bg, border: `1px solid ${codeErr ? C.dn+"66" : C.border}`, borderRadius: 14, color: C.t1, fontSize: 16, outline: "none", boxSizing: "border-box", textAlign: "center", letterSpacing: 4, fontFamily: "inherit" }} />
            <button onClick={handleUnlock} style={{ width: "100%", padding: 18, marginTop: 16, background: "linear-gradient(135deg, #4A6B25, #2D4A12)", border: "none", borderRadius: 14, color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 24px rgba(74,107,37,0.3)" }}>Continue</button>
            {codeErr && <div style={{ marginTop: 16, color: C.dn, fontSize: 13, fontWeight: 500, animation: "shake 0.4s" }}>Incorrect access code</div>}
          </div>
          <div style={{ marginTop: 40, fontSize: 12, color: C.t4 }}>Authorized IOWN team members only</div>
        </div>
        <GS theme={theme} />
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
        <GS theme={theme} />
      </div>
    );
  }

  /* ━━━ MAIN DASHBOARD ━━━ */

  /* ── Ticker Row — renders from external stable component ── */
  const renderTickerRow = (s) => {
    const q = quotes[s], b = bars[s], c = chg(s);
    const nm = names[s] || "";
    const pts = intradayPts[s];
    const shortName = nm.length > 18 ? nm.slice(0, 18) + "…" : nm;
    return (
      <div key={s} onClick={() => setChartSymbol(s)} className="ticker-row"
        style={{ display: "flex", alignItems: "center", padding: "14px 0", cursor: "pointer" }}>
        <div style={{ marginRight: 10, flexShrink: 0, width: 34, height: 34 }}>
          <StockLogo symbol={s} size={34} />
        </div>
        <div style={{ flex: "0 0 auto", width: 90, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.t1 }}>{s}</div>
          <div style={{ fontSize: 11, color: C.t4, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shortName}</div>
        </div>
        <div style={{ flex: 1, display: "flex", justifyContent: "center", padding: "0 8px" }}>
          <Sparkline points={pts} chg={c} />
        </div>
        <div data-ticker-chg={s} style={{
          padding: "6px 12px", borderRadius: 6, minWidth: 80, textAlign: "center",
          fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums",
          color: c > 0 ? C.up : c < 0 ? C.dn : C.t3,
          border: `1px solid ${c > 0 ? C.up + "55" : c < 0 ? C.dn + "55" : C.border}`,
          transition: "background 0.6s ease-out",
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
              <span data-sleeve-chg={k} style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: avgChg >= 0 ? C.up : C.dn }}>{pct(avgChg)}</span>
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
              const sortMode = sleeveSort[k] || "chgDn";
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
                    <div style={{ flex: 1 }}>{ renderTickerRow(s) }</div>
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

  const navItems = [
    { id: "home", label: "Home", icon: (a) => <svg width="21" height="21" viewBox="0 0 24 24" fill={a ? C.accentSoft : "none"} stroke={a ? C.t1 : C.t4} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg> },
    { id: "research", label: "Metrics", icon: (a) => <svg width="21" height="21" viewBox="0 0 24 24" fill={a ? C.accentSoft : "none"} stroke={a ? C.t1 : C.t4} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg> },
    { id: "calendar", label: "Calendar", icon: (a) => <svg width="21" height="21" viewBox="0 0 24 24" fill={a ? C.accentSoft : "none"} stroke={a ? C.t1 : C.t4} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg> },
    { id: "news", label: "News", icon: (a) => <svg width="21" height="21" viewBox="0 0 24 24" fill={a ? C.accentSoft : "none"} stroke={a ? C.t1 : C.t4} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" /><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" /></svg> },
    { id: "briefs", label: "Briefs", icon: (a) => <svg width="21" height="21" viewBox="0 0 24 24" fill={a ? C.accentSoft : "none"} stroke={a ? C.t1 : C.t4} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg> },
    { id: "settings", label: "Settings", icon: (a) => <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={a ? C.t1 : C.t4} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg> },
  ];

  return (
    <div ref={contentRef} onTouchStart={handleTabSwipeStart} onTouchEnd={handleTabSwipeEnd} style={{ minHeight: "100dvh", background: C.bg, color: C.t1, display: isDesktop ? "flex" : "block", paddingBottom: isDesktop ? 0 : 90, overflowY: "auto" }}>

      {/* DESKTOP SIDEBAR */}
      {isDesktop && (
        <div style={{
          width: 240, flexShrink: 0, position: "sticky", top: 0, height: "100dvh",
          background: C.surface, borderRight: `1px solid ${C.border}`,
          display: "flex", flexDirection: "column",
        }}>
          <div style={{ padding: "20px 20px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src="iown-logo.png" alt="IOWN" style={{ width: "80%", height: "auto" }} />
          </div>
          <nav style={{ flex: 1, padding: "12px 0" }}>
            {navItems.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                display: "flex", alignItems: "center", gap: 14, width: "100%",
                padding: "14px 24px", background: tab === t.id ? C.accentSoft : "transparent",
                border: "none", borderLeft: tab === t.id ? `3px solid ${C.accent}` : "3px solid transparent",
                cursor: "pointer", transition: "all 0.15s",
              }}>
                {t.icon(tab === t.id)}
                <span style={{ fontSize: 14, fontWeight: tab === t.id ? 700 : 500, color: tab === t.id ? C.t1 : C.t3 }}>{t.label}</span>
              </button>
            ))}
          </nav>
          <div style={{ padding: "20px 24px", borderTop: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: marketStatus.color, boxShadow: `0 0 6px ${marketStatus.color}66` }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: C.t2 }}>{marketStatus.label}</span>
            </div>
            <div data-last-updated style={{ fontSize: 11, color: C.t4 }}>{lastUp ? `Updated ${lastUp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}</div>
            {loading && <div style={{ fontSize: 11, color: C.t3, marginTop: 4 }}>Refreshing…</div>}
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <div style={{ flex: 1, minWidth: 0 }}>

      {/* MOBILE HEADER — hidden on desktop */}
      {!isDesktop && (
      <div style={{
        padding: "12px 18px", paddingTop: "calc(env(safe-area-inset-top, 12px) + 12px)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: `1px solid ${C.border}`,
        background: theme === "dark" ? "rgba(8,11,5,0.88)" : "rgba(245,245,240,0.92)", backdropFilter: "blur(24px) saturate(1.2)", WebkitBackdropFilter: "blur(24px) saturate(1.2)",
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
          {lastUp && <span data-last-updated style={{ fontSize: 11, color: C.t4 }}>{lastUp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
          <button onClick={() => { fetchData(true); fetchNews(); fetchIntraday(); }} disabled={loading} style={{
            width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center",
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, cursor: "pointer",
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.t3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: loading ? "spin 1s linear infinite" : "none" }}>
              <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>
      </div>
      )}

      {/* Desktop header bar */}
      {isDesktop && (
        <div style={{
          padding: "16px 40px", display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: `1px solid ${C.border}`, background: C.bg,
          position: "sticky", top: 0, zIndex: 100,
        }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.t1 }}>
            {tab === "home" ? "Home" : tab === "research" ? "Metrics" : tab === "calendar" ? "Calendar" : tab === "news" ? "News" : tab === "briefs" ? "Briefs" : "Settings"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {lastUp && <span data-last-updated style={{ fontSize: 12, color: C.t4 }}>{lastUp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
            <button onClick={() => { fetchData(true); fetchNews(); fetchIntraday(); }} disabled={loading} style={{
              padding: "8px 16px", display: "flex", alignItems: "center", gap: 8,
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.t3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: loading ? "spin 1s linear infinite" : "none" }}>
                <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
              </svg>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.t3 }}>Refresh</span>
            </button>
          </div>
        </div>
      )}

      <div style={{ maxWidth: isDesktop ? 1400 : 960, margin: "0 auto", padding: isDesktop ? "0 40px" : "0 18px" }}>

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

            {/* Benchmark Banner — card grid on desktop */}
            {Object.keys(bmQuotes).length > 0 && (
              <div style={{ margin: isDesktop ? "24px 0 0" : "16px -18px 0", padding: isDesktop ? 0 : "0 18px", overflow: "hidden" }}>
                <div style={{
                  display: isDesktop ? "grid" : "flex",
                  gridTemplateColumns: isDesktop ? "repeat(6, 1fr)" : undefined,
                  gap: isDesktop ? 12 : 0,
                  overflowX: isDesktop ? "visible" : "auto", paddingBottom: isDesktop ? 0 : 6,
                  WebkitOverflowScrolling: "touch", scrollbarWidth: "none",
                }}>
                  {BENCHMARKS.map((bm, i) => {
                    const c = bmChg(bm.sym);
                    const q = bmQuotes[bm.sym];
                    return (
                      <div key={bm.sym} onClick={() => setChartSymbol(bm.sym)} style={{
                        flex: isDesktop ? undefined : "0 0 auto",
                        padding: isDesktop ? "16px" : "12px 16px",
                        cursor: "pointer",
                        borderRight: !isDesktop && i < BENCHMARKS.length - 1 ? `1px solid ${C.border}` : "none",
                        minWidth: isDesktop ? undefined : 100,
                        background: isDesktop ? C.card : "transparent",
                        border: isDesktop ? `1px solid ${C.border}` : "none",
                        borderRadius: isDesktop ? 14 : 0,
                        transition: "border-color 0.15s",
                      }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: C.t3, marginBottom: 6, whiteSpace: "nowrap" }}>{bm.name}</div>
                        <div style={{ display: "flex", alignItems: isDesktop ? "center" : "baseline", gap: 8, flexWrap: isDesktop ? "wrap" : "nowrap" }}>
                          {q && <span data-bm-price={bm.sym} style={{ fontSize: isDesktop ? 18 : 14, fontWeight: 700, color: C.t1, fontVariantNumeric: "tabular-nums" }}>{q.p.toFixed(2)}</span>}
                          <span data-bm-chg={bm.sym} style={{
                            fontSize: 12, fontWeight: 700, fontVariantNumeric: "tabular-nums",
                            color: c > 0 ? C.up : c < 0 ? C.dn : C.t3,
                          }}>{pct(c)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {!isDesktop && <div style={{ height: 1, background: C.border }} />}
              </div>
            )}
            {/* Desktop: 2-column layout for Lists + Right panel */}
            <div style={{ display: isDesktop ? "grid" : "block", gridTemplateColumns: isDesktop ? "1fr 380px" : undefined, gap: isDesktop ? 32 : 0, marginTop: isDesktop ? 8 : 0 }}>
              {/* Left column: Lists */}
              <div>
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
              </div> {/* end left column */}

              {/* Right column: Top Movers + Heatmap */}
              <div style={{ position: isDesktop ? "sticky" : "static", top: isDesktop ? 80 : "auto", alignSelf: "start" }}>

            {/* Top Movers */}
            <div style={{ paddingTop: 28 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.t1, marginBottom: 16 }}>Top Movers</div>
              <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: "0 16px" }}>
                {coreSyms.filter(s => chg(s) != null).sort((a, b) => Math.abs(chg(b)) - Math.abs(chg(a))).slice(0, 6).map((s, i, arr) => (
                  <div key={s}>
                    { renderTickerRow(s) }
                    {i < arr.length - 1 && <div style={{ height: 1, background: C.border }} />}
                  </div>
                ))}
              </div>
            </div>

            {/* Heatmap */}
              </div> {/* end right column */}
            </div> {/* end desktop grid */}
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
            {!isDesktop && <div style={{ fontSize: 24, fontWeight: 800, color: C.t1, marginBottom: 16 }}>News</div>}
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
              return (<div style={{ display: isDesktop ? "grid" : "block", gridTemplateColumns: isDesktop ? "repeat(2, 1fr)" : undefined, gap: isDesktop ? 16 : 0 }}>
              {articles.map((article, i) => (
                <div key={article.id || i} onClick={() => article.url && window.open(article.url, "_blank")}
                  style={{
                    padding: isDesktop ? "20px" : "16px 0",
                    borderBottom: isDesktop ? "none" : `1px solid ${C.border}`,
                    background: isDesktop ? C.card : "transparent",
                    border: isDesktop ? `1px solid ${C.border}` : "none",
                    borderRadius: isDesktop ? 14 : 0,
                    cursor: article.url ? "pointer" : "default",
                    transition: "border-color 0.15s",
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
              ))}
              </div>);
            })()}
          </div>
        )}

        {/* ━━━ CALENDAR ━━━ */}
        {tab === "calendar" && (
          <div style={{ animation: "fadeIn 0.3s ease", paddingTop: 20 }}>
            {!isDesktop && <div style={{ fontSize: 24, fontWeight: 800, color: C.t1, marginBottom: 16 }}>Calendar</div>}
            {/* Toggle: Economic / Earnings */}
            <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
              {[{ v: "economic", l: "📊 Economic" }, { v: "earnings", l: "💰 Earnings" }].map(({ v, l }) => (
                <button key={v} onClick={() => setCalendarView(v)} style={{
                  flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${calendarView === v ? C.borderActive : C.border}`,
                  background: calendarView === v ? C.accentSoft : "transparent",
                  color: calendarView === v ? C.t1 : C.t3, fontSize: 14, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                }}>{l}</button>
              ))}
            </div>

            {calendarView === "economic" && (() => {
              if (!econCalendar.length) return (
                <div style={{ textAlign: "center", padding: "40px 0", color: C.t4, fontSize: 14 }}>
                  No economic events loaded.
                  <button onClick={fetchCalendar} style={{ display: "block", margin: "16px auto 0", padding: "10px 24px", background: C.accentSoft, border: `1px solid ${C.borderActive}`, borderRadius: 10, color: C.t1, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Load Calendar</button>
                  <div style={{ marginTop: 12, fontSize: 11, color: C.t4 }}>Calendar data is fetched from a live source and cached daily via GitHub Actions. If empty, the data source may be temporarily unavailable.</div>
                </div>
              );

              const categorize = (title) => {
                const t = (title || "").toLowerCase();
                if (t.includes("fomc") || t.includes("fed chair") || t.includes("interest rate") || t.includes("fed speak")) return "Fed";
                if (t.includes("cpi") || t.includes("ppi") || t.includes("pce") || t.includes("inflation")) return "Inflation";
                if (t.includes("payroll") || t.includes("employment") || t.includes("unemployment") || t.includes("jobless") || t.includes("nonfarm") || t.includes("non-farm")) return "Jobs";
                if (t.includes("gdp")) return "Growth";
                if (t.includes("retail") || t.includes("consumer") || t.includes("confidence") || t.includes("michigan") || t.includes("sentiment") || t.includes("spending")) return "Consumer";
                if (t.includes("ism") || t.includes("pmi") || t.includes("manufacturing") || t.includes("services") || t.includes("empire state") || t.includes("philly fed")) return "Business";
                if (t.includes("housing") || t.includes("home") || t.includes("building")) return "Housing";
                if (t.includes("president") || t.includes("speaks") || t.includes("speech") || t.includes("testimony") || t.includes("press conference")) return "Policy";
                if (t.includes("treasury") || t.includes("bond") || t.includes("auction") || t.includes("yield")) return "Bonds";
                if (t.includes("trade") || t.includes("tariff") || t.includes("import") || t.includes("export")) return "Trade";
                return null;
              };
              const catIcon = (cat) => ({ Fed: "🏛️", Inflation: "📈", Jobs: "👷", Growth: "🇺🇸", Consumer: "🛒", Business: "🏭", Housing: "🏠", Policy: "🎤", Bonds: "📜", Trade: "🌐" }[cat] || "📊");
              const catColors = { Fed: "#6366F1", Inflation: "#F59E0B", Jobs: "#3B82F6", Growth: "#10B981", Consumer: "#8B5CF6", Business: "#EC4899", Housing: "#F97316", Bonds: "#6B7280", Policy: "#DC2626", Trade: "#0EA5E9" };

              const todayStr = new Date().toISOString().slice(0, 10);
              // Show from start of current week (Monday)
              const today = new Date();
              const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon
              const monday = new Date(today);
              monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
              const weekStartStr = monday.toISOString().slice(0, 10);

              // Group by date — show full week
              const grouped = {};
              econCalendar.forEach(e => {
                const date = (e.date || "").slice(0, 10);
                if (!date || date < weekStartStr) return;
                if (!grouped[date]) grouped[date] = [];
                grouped[date].push(e);
              });

              return Object.entries(grouped).slice(0, 14).map(([date, events]) => {
                const isToday = date === todayStr;
                const daysAway = Math.ceil((new Date(date) - new Date(todayStr)) / 86400000);
                const isPast = daysAway < 0;
                const relLabel = daysAway === 0 ? "Today" : daysAway === 1 ? "Tomorrow" : daysAway < 0 ? `${Math.abs(daysAway)}d ago` : `${daysAway}d away`;
                const dayLabel = new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

                return (
                  <div key={date} style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0 8px", borderBottom: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: isToday ? C.t1 : C.t2 }}>{dayLabel}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: isToday ? C.up : C.t4, padding: "2px 8px", borderRadius: 6, background: isToday ? C.up + "18" : "transparent" }}>{relLabel}</div>
                    </div>
                    {events.map((evt, i) => {
                      const cat = categorize(evt.title);
                      const cc = catColors[cat] || C.t4;
                      const impactColor = evt.impact === "High" ? C.dn : "#F59E0B";
                      const time = (evt.date || "").slice(11, 16);
                      return (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0", borderBottom: i < events.length - 1 ? `1px solid ${C.border}` : "none" }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: cc + "14", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                            {catIcon(cat)}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: C.t1 }}>{evt.title}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 3, flexWrap: "wrap" }}>
                              {time && <span style={{ fontSize: 12, color: C.t4 }}>{time} ET</span>}
                              <span style={{ fontSize: 10, fontWeight: 700, color: impactColor, padding: "1px 6px", borderRadius: 4, background: impactColor + "14", textTransform: "uppercase" }}>{evt.impact}</span>
                              {cat && <span style={{ fontSize: 11, color: cc, fontWeight: 600 }}>{cat}</span>}
                            </div>
                            <div style={{ display: "flex", gap: 14, marginTop: 5, fontSize: 12 }}>
                              {evt.previous != null && evt.previous !== "" && <span style={{ color: C.t4 }}>Prev: <span style={{ color: C.t2 }}>{evt.previous}</span></span>}
                              {evt.forecast != null && evt.forecast !== "" && <span style={{ color: C.t4 }}>Est: <span style={{ color: C.t2 }}>{evt.forecast}</span></span>}
                              {evt.actual != null && evt.actual !== "" && <span style={{ color: C.t4 }}>Act: <span style={{ color: C.up, fontWeight: 700 }}>{evt.actual}</span></span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              });
            })()}
            {calendarView === "earnings" && (() => {
              if (!earningsCalendar.length) return (
                <div style={{ textAlign: "center", padding: "40px 0", color: C.t4, fontSize: 14 }}>
                  {FH ? "No upcoming earnings for your holdings." : "Add FINNHUB_KEY to enable earnings calendar."}
                  <button onClick={fetchCalendar} style={{ display: "block", margin: "16px auto 0", padding: "10px 24px", background: C.accentSoft, border: `1px solid ${C.borderActive}`, borderRadius: 10, color: C.t1, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Fetch Earnings</button>
                </div>
              );
              const grouped = {};
              earningsCalendar.forEach(e => {
                const date = e.date || "Unknown";
                if (!grouped[date]) grouped[date] = [];
                grouped[date].push(e);
              });
              return Object.entries(grouped).map(([date, events]) => (
                <div key={date} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.t3, marginBottom: 10, padding: "8px 0", borderBottom: `1px solid ${C.border}`, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    {new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                    {date === new Date().toISOString().slice(0, 10) && <span style={{ marginLeft: 8, fontSize: 11, color: C.up, fontWeight: 700 }}>TODAY</span>}
                  </div>
                  <div style={{ display: isDesktop ? "grid" : "block", gridTemplateColumns: isDesktop ? "repeat(2, 1fr)" : undefined, gap: isDesktop ? 12 : 0 }}>
                  {events.map((evt, i) => {
                    const hasBeat = evt.epsActual != null && evt.epsEstimate != null;
                    const epsBeat = hasBeat ? evt.epsActual >= evt.epsEstimate : null;
                    const hasReported = evt.epsActual != null;
                    return (
                    <div key={i} onClick={() => setChartSymbol(evt.symbol)} style={{
                      padding: isDesktop ? "16px" : "14px 0",
                      borderBottom: isDesktop ? "none" : `1px solid ${C.border}`,
                      background: isDesktop ? C.card : "transparent",
                      border: isDesktop ? `1px solid ${C.border}` : "none",
                      borderRadius: isDesktop ? 12 : 0,
                      cursor: "pointer",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <StockLogo symbol={evt.symbol} size={28} />
                          <div style={{ fontSize: 16, fontWeight: 800, color: C.accent }}>{evt.symbol}</div>
                          {hasReported && (
                            <span style={{
                              fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 6,
                              background: epsBeat ? C.up + "18" : C.dn + "18",
                              color: epsBeat ? C.up : C.dn,
                            }}>{epsBeat ? "BEAT" : "MISS"}</span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: C.t4, textTransform: "uppercase" }}>
                          {hasReported ? "Reported" : evt.hour === "bmo" ? "Before Open" : evt.hour === "amc" ? "After Close" : evt.hour || ""}
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: C.t3, marginBottom: 8 }}>{names[evt.symbol] || fundamentals[evt.symbol]?.companyName || ""}</div>
                      <div style={{ display: "flex", gap: 12, fontSize: 12, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span style={{ fontSize: 10, color: C.t4, fontWeight: 600 }}>EPS</span>
                          <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                            {evt.epsEstimate != null && <span style={{ color: C.t4 }}>Est: <span style={{ color: C.t2 }}>{fmtEps(evt.epsEstimate)}</span></span>}
                            {evt.epsActual != null && <span style={{ color: C.t4 }}>Act: <span style={{ color: epsBeat ? C.up : C.dn, fontWeight: 700 }}>{fmtEps(evt.epsActual)}</span></span>}
                            {hasBeat && <span style={{ fontSize: 11, color: epsBeat ? C.up : C.dn, fontWeight: 700 }}>({epsBeat ? "+" : ""}{((evt.epsActual - evt.epsEstimate) / Math.abs(evt.epsEstimate) * 100).toFixed(1)}%)</span>}
                          </div>
                        </div>
                        {(evt.revenueEstimate != null || evt.revenueActual != null) && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <span style={{ fontSize: 10, color: C.t4, fontWeight: 600 }}>Revenue</span>
                            <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                              {evt.revenueEstimate != null && <span style={{ color: C.t4 }}>Est: <span style={{ color: C.t2 }}>{vol(evt.revenueEstimate)}</span></span>}
                              {evt.revenueActual != null && <span style={{ color: C.t4 }}>Act: <span style={{ color: C.t2, fontWeight: 700 }}>{vol(evt.revenueActual)}</span></span>}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    );
                  })}
                  </div>
                </div>
              ));
            })()}
          </div>
        )}

        {/* ━━━ METRICS ━━━ */}
        {tab === "research" && (
          <div style={{ animation: "fadeIn 0.3s ease", paddingTop: 20 }}>
            {!isDesktop && <div style={{ fontSize: 24, fontWeight: 800, color: C.t1, marginBottom: 16 }}>Metrics</div>}
            {/* Portfolio selector — all sleeves */}
            <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto", paddingBottom: 4 }}>
              {Object.entries(sleeves).map(([k, sl]) => (
                <button key={k} onClick={() => { setResearchView(k); setMetricSort({ col: null, dir: "desc" }); }} style={{
                  flex: "0 0 auto", padding: "9px 16px", borderRadius: 10, border: `1px solid ${researchView === k ? C.borderActive : C.border}`,
                  background: researchView === k ? C.accentSoft : "transparent",
                  color: researchView === k ? C.t1 : C.t3, fontSize: 13, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                }}>{sl.icon} {sl.name}</button>
              ))}
            </div>
            {/* Sub-view toggle */}
            <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
              {[{ v: "table", l: "📊 Table" }, { v: "attribution", l: "📈 Attribution" }, { v: "peers", l: "🔍 Peer Compare" }].map(({ v, l }) => (
                <button key={v} onClick={() => setMetricsSubView(v)} style={{
                  flex: 1, padding: "9px 0", borderRadius: 10, border: `1px solid ${metricsSubView === v ? C.borderActive : C.border}`,
                  background: metricsSubView === v ? C.accentSoft : "transparent",
                  color: metricsSubView === v ? C.t1 : C.t3, fontSize: 13, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                }}>{l}</button>
              ))}
            </div>

            {/* ── PERFORMANCE ATTRIBUTION ── */}
            {metricsSubView === "attribution" && (() => {
              const syms = sleeves[researchView]?.symbols || [];
              const contributions = syms
                .map(s => {
                  const d = fundamentals[s] || {};
                  const qtd = d.thisQtr ?? d.ytd ?? null;
                  return { sym: s, qtd, name: names[s] || d.companyName || s };
                })
                .filter(c => c.qtd != null)
                .sort((a, b) => b.qtd - a.qtd);

              if (!contributions.length) return <div style={{ textAlign: "center", padding: "40px 0", color: C.t4 }}>No performance data available. Refresh metrics first.</div>;

              const maxAbs = Math.max(...contributions.map(c => Math.abs(c.qtd)), 1);
              const avgReturn = contributions.reduce((s, c) => s + c.qtd, 0) / contributions.length;

              return (
                <div>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: C.t1 }}>Quarter-to-Date Attribution</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: avgReturn >= 0 ? C.up : C.dn }}>{avgReturn >= 0 ? "+" : ""}{avgReturn.toFixed(1)}% avg</div>
                  </div>
                  {contributions.map((c, i) => {
                    const barWidth = Math.abs(c.qtd) / maxAbs * 100;
                    const isPos = c.qtd >= 0;
                    return (
                      <div key={c.sym} onClick={() => setChartSymbol(c.sym)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", cursor: "pointer", borderBottom: i < contributions.length - 1 ? `1px solid ${C.border}` : "none" }}>
                        <div style={{ width: 48, fontSize: 13, fontWeight: 700, color: C.accent, flexShrink: 0 }}>{c.sym}</div>
                        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 0 }}>
                          {/* Left side (negative) */}
                          <div style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
                            {!isPos && <div style={{ height: 20, borderRadius: 4, background: C.dn + "30", border: `1px solid ${C.dn}55`, width: `${barWidth}%`, minWidth: 4, transition: "width 0.5s cubic-bezier(0.16,1,0.3,1)" }} />}
                          </div>
                          {/* Center line */}
                          <div style={{ width: 2, height: 24, background: C.t4 + "40", flexShrink: 0, margin: "0 2px" }} />
                          {/* Right side (positive) */}
                          <div style={{ flex: 1 }}>
                            {isPos && <div style={{ height: 20, borderRadius: 4, background: C.up + "30", border: `1px solid ${C.up}55`, width: `${barWidth}%`, minWidth: 4, transition: "width 0.5s cubic-bezier(0.16,1,0.3,1)" }} />}
                          </div>
                        </div>
                        <div style={{ width: 58, textAlign: "right", fontSize: 13, fontWeight: 700, color: isPos ? C.up : C.dn, flexShrink: 0 }}>
                          {isPos ? "+" : ""}{c.qtd.toFixed(1)}%
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ marginTop: 16, padding: "14px 0", borderTop: `2px solid ${C.accent}`, display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>Portfolio Average</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: avgReturn >= 0 ? C.up : C.dn }}>{avgReturn >= 0 ? "+" : ""}{avgReturn.toFixed(2)}%</span>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 11, color: C.t4 }}>
                    Top: {contributions[0]?.sym} ({contributions[0]?.qtd >= 0 ? "+" : ""}{contributions[0]?.qtd.toFixed(1)}%) · Bottom: {contributions[contributions.length - 1]?.sym} ({contributions[contributions.length - 1]?.qtd >= 0 ? "+" : ""}{contributions[contributions.length - 1]?.qtd.toFixed(1)}%)
                  </div>
                </div>
              );
            })()}

            {/* ── PEER COMPARISON ── */}
            {metricsSubView === "peers" && (() => {
              const syms = sleeves[researchView]?.symbols || [];
              // If no peer selected, show selector
              if (!peerSymbol || !syms.includes(peerSymbol)) {
                return (
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: C.t1, marginBottom: 12 }}>Select a stock to compare</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {[...syms].sort().map(s => (
                        <button key={s} onClick={() => setPeerSymbol(s)} style={{
                          padding: "10px 16px", borderRadius: 10, border: `1px solid ${C.border}`,
                          background: C.card, cursor: "pointer", fontFamily: "inherit",
                          display: "flex", alignItems: "center", gap: 8,
                        }}>
                          <StockLogo symbol={s} size={22} />
                          <span style={{ fontSize: 13, fontWeight: 700, color: C.accent }}>{s}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              }

              // Find peers: same industry
              const d = fundamentals[peerSymbol] || {};
              const industry = d.industry;
              const allSymsInSleeve = syms;
              let peers = industry
                ? allSymsInSleeve.filter(s => s !== peerSymbol && fundamentals[s]?.industry === industry)
                : [];
              // If not enough peers in same industry, grab closest by sector
              if (peers.length < 2) {
                const sector = d.sector;
                peers = allSymsInSleeve.filter(s => s !== peerSymbol && fundamentals[s]?.sector === sector).slice(0, 5);
              }
              // Still not enough? Just use top 5 alphabetically (excluding self)
              if (peers.length === 0) peers = allSymsInSleeve.filter(s => s !== peerSymbol).slice(0, 5);

              const compareSyms = [peerSymbol, ...peers.slice(0, 5)];
              const metrics = [
                { l: "This Qtr", k: "thisQtr", fmt: v => v != null ? `${v >= 0 ? "+" : ""}${v.toFixed(1)}%` : "—", colorize: true },
                { l: "YTD", k: "ytd", fmt: v => v != null ? `${v >= 0 ? "+" : ""}${v.toFixed(1)}%` : "—", colorize: true },
                { l: "P/E TTM", k: "peTTM", fmt: v => v != null ? v.toFixed(1) : "—", lower: true },
                { l: "P/E FWD", k: "peFwd", fmt: v => v != null ? v.toFixed(1) : "—", lower: true },
                { l: "PEG", k: "pegTTM", fmt: v => v != null ? v.toFixed(1) : "—", lower: true },
                { l: "Rev YoY", k: "revenueYoY", fmt: v => v != null ? `${v.toFixed(1)}%` : "—", colorize: true },
                { l: "ROE", k: "roe", fmt: v => v != null ? `${v.toFixed(1)}%` : "—" },
                { l: "D/E", k: "de", fmt: v => v != null ? v.toFixed(1) : "—", lower: true },
              ];
              if (researchView === "dividend") {
                metrics.splice(2, 0, { l: "Yield", k: "yieldFwd", fmt: v => v != null ? `${v.toFixed(2)}%` : "—" });
                metrics.splice(3, 0, { l: "Payout", k: "payoutRatio", fmt: v => v != null ? `${v.toFixed(0)}%` : "—" });
              }

              // Find best value per metric
              const bestIdx = metrics.map(m => {
                const vals = compareSyms.map(s => fundamentals[s]?.[m.k] ?? null);
                const valid = vals.map((v, i) => [v, i]).filter(([v]) => v != null && isFinite(v));
                if (!valid.length) return -1;
                if (m.lower) return valid.reduce((best, [v, i]) => v < best[0] ? [v, i] : best, [Infinity, -1])[1];
                return valid.reduce((best, [v, i]) => v > best[0] ? [v, i] : best, [-Infinity, -1])[1];
              });

              return (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <StockLogo symbol={peerSymbol} size={32} />
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: C.t1 }}>{peerSymbol}</div>
                        <div style={{ fontSize: 12, color: C.t4 }}>{d.industry || "No industry"} · vs {peers.length} peer{peers.length !== 1 ? "s" : ""}</div>
                      </div>
                    </div>
                    <button onClick={() => setPeerSymbol(null)} style={{
                      padding: "6px 14px", borderRadius: 8, border: `1px solid ${C.border}`,
                      background: "transparent", color: C.t3, fontSize: 12, fontWeight: 600,
                      cursor: "pointer", fontFamily: "inherit",
                    }}>Change</button>
                  </div>

                  {/* Comparison table */}
                  <div style={{ overflowX: "auto", borderRadius: 14, border: `1px solid ${C.border}` }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr>
                          <th style={{ padding: "12px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.t4, background: C.surface, position: "sticky", left: 0, zIndex: 2, borderBottom: `2px solid ${C.accent}` }}>Metric</th>
                          {compareSyms.map((s, i) => (
                            <th key={s} onClick={() => setChartSymbol(s)} style={{
                              padding: "12px 10px", textAlign: "center", fontWeight: 700, cursor: "pointer",
                              color: i === 0 ? C.accent : C.t2, fontSize: i === 0 ? 14 : 12,
                              background: i === 0 ? C.accentSoft : C.surface,
                              borderBottom: `2px solid ${C.accent}`, whiteSpace: "nowrap",
                            }}>{s}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {metrics.map((m, mi) => (
                          <tr key={m.k}>
                            <td style={{ padding: "10px 10px", fontSize: 12, fontWeight: 600, color: C.t3, background: C.surface, position: "sticky", left: 0, zIndex: 1, borderBottom: `1px solid ${C.border}` }}>{m.l}</td>
                            {compareSyms.map((s, si) => {
                              const val = fundamentals[s]?.[m.k] ?? null;
                              const isBest = bestIdx[mi] === si;
                              let color = C.t1;
                              if (m.colorize && val != null) color = val > 0 ? C.up : val < 0 ? C.dn : C.t3;
                              return (
                                <td key={s} style={{
                                  padding: "10px 10px", textAlign: "center", fontVariantNumeric: "tabular-nums",
                                  fontWeight: isBest ? 800 : 500, color,
                                  background: si === 0 ? C.accentSoft : (isBest ? (C.up + "10") : "transparent"),
                                  borderBottom: `1px solid ${C.border}`,
                                }}>
                                  {m.fmt(val)}
                                  {isBest && <span style={{ fontSize: 9, marginLeft: 3, color: C.up }}>★</span>}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ marginTop: 10, fontSize: 11, color: C.t4 }}>★ = best in group{metrics.some(m => m.lower) ? " (lower is better for P/E, PEG, D/E)" : ""}</div>
                </div>
              );
            })()}

            {/* ── TABLE VIEW (existing metrics table) ── */}
            {metricsSubView === "table" && (<>
            {/* Edit toggle + download + add ticker */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: C.t4 }}>{sleeves[researchView]?.symbols?.length || 0} stocks</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={async () => {
                  try {
                  const syms = sleeves[researchView]?.symbols || [];
                  const isDivView = researchView === "dividend";
                  const slName = sleeves[researchView]?.name || researchView;
                  const dateStr = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

                  // ExcelJS should be preloaded; if not, try loading now
                  if (!window.ExcelJS) {
                    const s = document.createElement("script");
                    s.src = "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js";
                    document.head.appendChild(s);
                    await new Promise((res, rej) => { s.onload = res; s.onerror = rej; setTimeout(rej, 5000); });
                  }
                  if (!window.ExcelJS) { alert("Could not load export library. Please try again."); return; }

                  const wb = new window.ExcelJS.Workbook();
                  wb.creator = "IOWN Portfolio Dashboard";
                  const ws = wb.addWorksheet(slName);

                  // Colors (Template A: Dark Executive)
                  const brandGreen = "4A6B25";
                  const headerBg = "1B2A12";
                  const headerText = "FFFFFF";
                  const altRowBg = "F7F9F4";
                  const greenText = "16A34A";
                  const redText = "DC2626";
                  const borderColor = "E0E5D8";
                  const avgBg = "E8EDE0";
                  const darkText = "333333";

                  // Column definitions with format types
                  // fmt: "pct" = percentage (stored as decimal, displayed 0.0%), "ratio" = 0.0, "vol" = #,##0, "text" = string
                  const colDefs = [
                    { h: "Symbol", k: "sym", fmt: "text", w: 9 },
                    { h: "Industry", k: "industry", fmt: "text", w: 20 },
                    { h: "Last Qtr", k: "lastQtr", fmt: "pct", w: 11 },
                    { h: "This Qtr", k: "thisQtr", fmt: "pct", w: 11 },
                    { h: "YTD", k: "ytd", fmt: "pct", w: 10 },
                  ];
                  if (isDivView) {
                    colDefs.push({ h: "Yield FWD", k: "yieldFwd", fmt: "pct", w: 11 });
                    colDefs.push({ h: "Payout", k: "payoutRatio", fmt: "pct", w: 10 });
                  }
                  colDefs.push(
                    { h: "P/E TTM", k: "peTTM", fmt: "ratio", w: 10 },
                    { h: "P/E FWD", k: "peFwd", fmt: "ratio", w: 10 },
                    { h: "PEG", k: "pegTTM", fmt: "ratio", w: 8 },
                  );
                  if (!isDivView) colDefs.push({ h: "Margin", k: "profitMargin", fmt: "pct", w: 10 });
                  colDefs.push(
                    { h: "Rev YoY", k: "revenueYoY", fmt: "pct", w: 10 },
                    { h: "Rev 5Y", k: "revenue5Y", fmt: "pct", w: 10 },
                    { h: "ROE", k: "roe", fmt: "pct", w: 9 },
                    { h: "D/E", k: "de", fmt: "ratio", w: 8 },
                    { h: "Avg Vol", k: "avgVol", fmt: "vol", w: 13 },
                  );

                  const numFmts = { pct: "0.0%", ratio: "0.0", vol: "#,##0" };
                  const isTextCol = (ci) => ci <= 2;

                  // Header row (row 1)
                  const hRow = ws.addRow(colDefs.map(c => c.h));
                  hRow.height = 28;
                  hRow.eachCell((cell, ci) => {
                    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: headerText } };
                    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: headerBg } };
                    cell.alignment = { horizontal: isTextCol(ci) ? "left" : "center", vertical: "middle" };
                    cell.border = { bottom: { style: "medium", color: { argb: brandGreen } } };
                  });

                  // Data rows (starting row 2)
                  const sortedSyms = [...syms].sort((a, b) => a.localeCompare(b));
                  sortedSyms.forEach((s, idx) => {
                    const d = fundamentals[s] || {};
                    const rowVals = colDefs.map(col => {
                      if (col.k === "sym") return s;
                      if (col.fmt === "text") return d[col.k] || "";
                      const raw = d[col.k];
                      if (raw == null || raw === "" || isNaN(raw) || !isFinite(raw)) return "";
                      const num = Number(raw);
                      if (col.fmt === "pct") return num / 100;
                      if (col.fmt === "vol") return Math.round(num);
                      return Math.round(num * 100) / 100;
                    });

                    const row = ws.addRow(rowVals);
                    row.height = 24;
                    const isAlt = idx % 2 === 1;
                    row.eachCell({ includeEmpty: true }, (cell, ci) => {
                      const def = colDefs[ci - 1];
                      cell.font = { name: "Calibri", size: 10, color: { argb: darkText } };
                      if (isAlt) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: altRowBg } };
                      cell.alignment = { horizontal: isTextCol(ci) ? "left" : "center", vertical: "middle" };
                      cell.border = { bottom: { style: "hair", color: { argb: borderColor } } };

                      // Number format
                      if (def && numFmts[def.fmt]) cell.numFmt = numFmts[def.fmt];

                      // Green/red for numeric values
                      const v = cell.value;
                      if (typeof v === "number" && !isTextCol(ci)) {
                        if (v > 0) cell.font = { name: "Calibri", size: 10, color: { argb: greenText } };
                        else if (v < 0) cell.font = { name: "Calibri", size: 10, color: { argb: redText } };
                      }
                      // Ticker bold green
                      if (ci === 1) cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: brandGreen } };
                      // Industry italic gray
                      if (ci === 3) cell.font = { name: "Calibri", size: 10, color: { argb: "777777" } };
                    });
                  });

                  // Averages row — after a spacer so it's excluded from auto-filter sort
                  const getColLetter = (n) => {
                    let s = ""; n++;
                    while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); }
                    return s;
                  };
                  ws.addRow([]); // spacer row between data and averages
                  const avgVals = [];
                  const startRow = 2, endRow = 1 + sortedSyms.length;
                  for (let ci = 0; ci < colDefs.length; ci++) {
                    if (ci === 0) { avgVals.push("AVERAGE"); continue; }
                    if (colDefs[ci].fmt === "text") { avgVals.push(""); continue; }
                    const colLetter = getColLetter(ci);
                    avgVals.push({ formula: `AVERAGE(${colLetter}${startRow}:${colLetter}${endRow})` });
                  }
                  const aRow = ws.addRow(avgVals);
                  aRow.height = 28;
                  aRow.eachCell({ includeEmpty: true }, (cell, ci) => {
                    const def = colDefs[ci - 1];
                    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: headerBg } };
                    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: avgBg } };
                    cell.alignment = { horizontal: isTextCol(ci) ? "left" : "center", vertical: "middle" };
                    cell.border = { top: { style: "medium", color: { argb: brandGreen } }, bottom: { style: "medium", color: { argb: brandGreen } } };
                    if (def && numFmts[def.fmt]) cell.numFmt = numFmts[def.fmt];
                  });

                  // Column widths
                  colDefs.forEach((c, i) => { ws.getColumn(i + 1).width = c.w; });

                  // Grid lines off, freeze panes, auto-filter (excludes averages row)
                  ws.views = [{ state: "frozen", ySplit: 1, xSplit: 1, showGridLines: false }];
                  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: endRow, column: colDefs.length } };

                  // Download — mobile-friendly approach
                  const buf = await wb.xlsx.writeBuffer();
                  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
                  const fileName = `IOWN_${slName}_Metrics_${new Date().toISOString().slice(0,10)}.xlsx`;
                  // Use navigator.share on mobile if available, otherwise fallback to link click
                  if (navigator.share && /mobile|iphone|ipad|android/i.test(navigator.userAgent)) {
                    try {
                      const file = new File([blob], fileName, { type: blob.type });
                      await navigator.share({ files: [file], title: fileName });
                    } catch {
                      // Share cancelled or failed — fallback to download
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a"); a.href = url; a.download = fileName;
                      document.body.appendChild(a); a.click(); document.body.removeChild(a);
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                    }
                  } else {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a"); a.href = url; a.download = fileName;
                    document.body.appendChild(a); a.click(); document.body.removeChild(a);
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                  }
                  } catch (e) { console.error("Export error:", e); alert("Export failed: " + e.message); }
                }} style={{
                  padding: "6px 14px", borderRadius: 8, border: `1px solid ${C.border}`,
                  background: "transparent", color: C.t3, fontSize: 12, fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6,
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                  Export
                </button>
                <button onClick={() => setMetricsEditMode(!metricsEditMode)} style={{
                  padding: "6px 14px", borderRadius: 8, border: `1px solid ${metricsEditMode ? C.borderActive : C.border}`,
                  background: metricsEditMode ? C.accentSoft : "transparent",
                  color: metricsEditMode ? C.t1 : C.t3, fontSize: 12, fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit",
                }}>{metricsEditMode ? "Done" : "Edit"}</button>
              </div>
            </div>
            {metricsEditMode && (
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <input type="text" value={metricsTickerInput} onChange={e => setMetricsTickerInput(e.target.value.toUpperCase())}
                  onKeyDown={e => { if (e.key === "Enter" && metricsTickerInput) { addSymbol(researchView, metricsTickerInput); setMetricsTickerInput(""); } }}
                  placeholder="Add ticker…" style={{ flex: 1, padding: "10px 14px", background: C.bg, border: `1px solid ${C.borderActive}`, borderRadius: 10, color: C.t1, fontSize: 14, fontWeight: 600, outline: "none", fontFamily: "inherit", letterSpacing: 1 }} />
                <button onClick={() => { if (metricsTickerInput) { addSymbol(researchView, metricsTickerInput); setMetricsTickerInput(""); } }} style={{ padding: "10px 16px", background: C.accentSoft, border: `1px solid ${C.borderActive}`, borderRadius: 10, color: C.t1, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Add</button>
              </div>
            )}
            {Object.keys(fundamentals).length <= 1 && (
              <div style={{ textAlign: "center", padding: "40px 0", color: C.t4, fontSize: 14 }}>
                {(FH || FK) ? "Loading metrics…" : "Add FINNHUB_KEY secret to enable metrics."}
                {(FH || FK) && <button onClick={() => fetchFundamentals(true)} style={{ display: "block", margin: "16px auto 0", padding: "10px 24px", background: C.accentSoft, border: `1px solid ${C.borderActive}`, borderRadius: 10, color: C.t1, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Fetch Now</button>}
              </div>
            )}
            {/* Seeking Alpha-style scrollable table */}
            {(() => {
              const syms = sleeves[researchView]?.symbols || [];
              const fmtV = v => v == null ? "—" : Number(v).toFixed(1);
              const fmtP = v => v == null ? "—" : `${Number(v).toFixed(1)}%`;

              const pctCol = (label, key, w = 72) => ({
                l: label, w, k: key,
                fn: d => d[key] != null ? `${d[key] >= 0 ? "+" : ""}${d[key].toFixed(1)}%` : "—",
                color: d => (d[key]||0) > 0 ? C.up : (d[key]||0) < 0 ? C.dn : C.t3,
              });

              const textCol = (label, key, w = 80) => ({
                l: label, w, k: key,
                fn: d => d[key] || "—",
                noAvg: true, // skip in averages
              });

              // Day change computed live from quotesRef
              const dayChg = (sym) => {
                const q = quotesRef.current[sym];
                const b = barsRef.current[sym];
                if (q?.p && b?.pc) return ((q.p - b.pc) / b.pc) * 100;
                return null;
              };

              const dayCol = {
                l: "Day", w: 65, k: "_day",
                fn: (d, sym) => { const c = dayChg(sym); return c != null ? `${c >= 0 ? "+" : ""}${c.toFixed(2)}%` : "—"; },
                color: (d, sym) => { const c = dayChg(sym); return (c||0) > 0 ? C.up : (c||0) < 0 ? C.dn : C.t3; },
                live: true, // flag for data attribute
              };

              const divCols = [
                textCol("Industry", "industry", 110),
                dayCol,
                { l: "Avg Vol", w: 70, k: "avgVol", fn: d => vol(d.avgVol) },
                pctCol("Last Qtr", "lastQtr"),
                pctCol("This Qtr", "thisQtr"),
                pctCol("YTD", "ytd", 60),
                { l: "Yield FWD", w: 72, k: "yieldFwd", fn: d => d.yieldFwd != null ? `${d.yieldFwd.toFixed(2)}%` : "—" },
                { l: "Payout", w: 62, k: "payoutRatio", fn: d => d.payoutRatio != null ? `${d.payoutRatio.toFixed(0)}%` : "—" },
                { l: "P/E TTM", w: 62, k: "peTTM", fn: d => fmtV(d.peTTM) },
                { l: "P/E FWD", w: 62, k: "peFwd", fn: d => fmtV(d.peFwd) },
                { l: "PEG", w: 50, k: "pegTTM", fn: d => fmtV(d.pegTTM) },
                { l: "Rev YoY", w: 68, k: "revenueYoY", fn: d => fmtP(d.revenueYoY), color: d => (d.revenueYoY||0) > 0 ? C.up : C.dn },
                { l: "Rev 5Y", w: 62, k: "revenue5Y", fn: d => fmtP(d.revenue5Y), color: d => (d.revenue5Y||0) > 0 ? C.up : C.dn },
                { l: "ROE", w: 58, k: "roe", fn: d => fmtP(d.roe) },
                { l: "D/E", w: 50, k: "de", fn: d => fmtV(d.de) },
              ];
              const groCols = [
                textCol("Industry", "industry", 110),
                dayCol,
                { l: "Avg Vol", w: 70, k: "avgVol", fn: d => vol(d.avgVol) },
                pctCol("Last Qtr", "lastQtr"),
                pctCol("This Qtr", "thisQtr"),
                pctCol("YTD", "ytd", 60),
                { l: "P/E TTM", w: 62, k: "peTTM", fn: d => fmtV(d.peTTM) },
                { l: "P/E FWD", w: 62, k: "peFwd", fn: d => fmtV(d.peFwd) },
                { l: "PEG", w: 50, k: "pegTTM", fn: d => fmtV(d.pegTTM) },
                { l: "Rev YoY", w: 68, k: "revenueYoY", fn: d => fmtP(d.revenueYoY), color: d => (d.revenueYoY||0) > 0 ? C.up : C.dn },
                { l: "Rev 5Y", w: 62, k: "revenue5Y", fn: d => fmtP(d.revenue5Y), color: d => (d.revenue5Y||0) > 0 ? C.up : C.dn },
                { l: "Margin", w: 62, k: "profitMargin", fn: d => fmtP(d.profitMargin) },
                { l: "ROE", w: 58, k: "roe", fn: d => fmtP(d.roe) },
                { l: "D/E", w: 50, k: "de", fn: d => fmtV(d.de) },
              ];
              const cols = (researchView === "dividend") ? divCols : groCols;

              // Sort
              const sorted = [...syms].sort((a, b) => {
                if (!metricSort.col) return a.localeCompare(b);
                // Special handling for live Day column
                if (metricSort.col === "_day") {
                  const av = dayChg(a); const bv = dayChg(b);
                  if (av == null && bv == null) return 0; if (av == null) return 1; if (bv == null) return -1;
                  return metricSort.dir === "asc" ? av - bv : bv - av;
                }
                const av = fundamentals[a]?.[metricSort.col] ?? null;
                const bv = fundamentals[b]?.[metricSort.col] ?? null;
                if (av == null && bv == null) return 0;
                if (av == null) return 1;
                if (bv == null) return -1;
                // String comparison for text columns
                if (typeof av === "string" && typeof bv === "string") return metricSort.dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
                return metricSort.dir === "asc" ? av - bv : bv - av;
              });

              const toggleSort = (k) => {
                if (metricSort.col === k) setMetricSort({ col: k, dir: metricSort.dir === "desc" ? "asc" : "desc" });
                else setMetricSort({ col: k, dir: "desc" });
              };

              return (
                <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden" }}>
                  <div style={{ overflowX: "auto", maxHeight: "calc(100vh - 280px)", overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
                    <table style={{ borderCollapse: "collapse", minWidth: (metricsEditMode ? 180 : 140) + cols.reduce((s, c) => s + c.w, 0) }}>
                      {/* Header — sticky top + left */}
                      <thead style={{ position: "sticky", top: 0, zIndex: 3 }}>
                        <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                          <th style={{ position: "sticky", left: 0, zIndex: 4, background: C.card, padding: "12px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.t3, letterSpacing: 0.3, minWidth: metricsEditMode ? 180 : 140, borderRight: `1px solid ${C.border}` }}>Symbol</th>
                          {cols.map(col => (
                            <th key={col.l} onClick={() => toggleSort(col.k)} style={{ padding: "12px 8px", textAlign: "right", fontSize: 10, fontWeight: 700, background: C.card, color: metricSort.col === col.k ? C.t1 : C.t4, letterSpacing: 0.3, whiteSpace: "nowrap", minWidth: col.w, cursor: "pointer", userSelect: "none" }}>
                              {col.l} {metricSort.col === col.k ? (metricSort.dir === "desc" ? "↓" : "↑") : ""}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sorted.map((s, ri) => {
                          const d = fundamentals[s] || {};
                          const nm = names[s] || "";
                          const shortNm = nm.length > 16 ? nm.slice(0, 16) + "…" : nm;
                          return (
                            <tr key={s} style={{ borderBottom: `1px solid ${C.border}` }}>
                              <td style={{ position: "sticky", left: 0, zIndex: 1, background: C.card, padding: "10px 12px", borderRight: `1px solid ${C.border}` }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  {metricsEditMode && (
                                    <div onClick={() => removeSymbol(researchView, s)} style={{ width: 22, height: 22, borderRadius: 11, background: C.dn + "22", border: `1px solid ${C.dn}44`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.dn} strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
                                    </div>
                                  )}
                                  <div onClick={() => setChartSymbol(s)} style={{ cursor: "pointer" }}>
                                    <div style={{ fontSize: 14, fontWeight: 800, color: C.accent }}>{s}</div>
                                    <div style={{ fontSize: 11, color: C.t4, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>{shortNm}</div>
                                  </div>
                                </div>
                              </td>
                              {cols.map(col => {
                                const val = col.fn(d, s);
                                const clr = col.color ? col.color(d, s) : C.t2;
                                const dataAttr = col.live ? { "data-metric-day": s } : {};
                                return (
                                  <td key={col.l} {...dataAttr} style={{ padding: "10px 8px", textAlign: "right", fontSize: 13, fontWeight: 600, color: clr, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", transition: "background 0.6s ease-out" }}>{val}</td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                      {/* Averages footer */}
                      <tfoot style={{ position: "sticky", bottom: 0, zIndex: 3 }}>
                        <tr style={{ borderTop: `2px solid ${C.accent}` }}>
                          <td style={{ position: "sticky", left: 0, zIndex: 4, background: C.surface, padding: "10px 12px", borderRight: `1px solid ${C.border}`, fontSize: 12, fontWeight: 800, color: C.t1 }}>Avg</td>
                          {cols.map(col => {
                            if (col.noAvg) return <td key={col.l} style={{ padding: "10px 8px", textAlign: "right", fontSize: 13, color: C.t4, background: C.surface }}>—</td>;
                            if (col.k === "_day") {
                              const dayVals = sorted.map(s => dayChg(s)).filter(v => v != null);
                              const avg = dayVals.length ? dayVals.reduce((a, b) => a + b, 0) / dayVals.length : null;
                              return <td key={col.l} style={{ padding: "10px 8px", textAlign: "right", fontSize: 13, fontWeight: 800, color: avg > 0 ? C.up : avg < 0 ? C.dn : C.t1, background: C.surface, fontVariantNumeric: "tabular-nums" }}>{avg != null ? `${avg >= 0 ? "+" : ""}${avg.toFixed(2)}%` : "—"}</td>;
                            }
                            const vals = sorted.map(s => fundamentals[s]?.[col.k]).filter(v => v != null && isFinite(v));
                            const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
                            const avgD = { [col.k]: avg };
                            const val = avg != null ? col.fn(avgD) : "—";
                            return (
                              <td key={col.l} style={{ padding: "10px 8px", textAlign: "right", fontSize: 13, fontWeight: 800, color: C.t1, background: C.surface, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{val}</td>
                            );
                          })}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              );
            })()}
            </>)}
          </div>
        )}

        {/* ━━━ BRIEFS ━━━ */}
        {tab === "briefs" && (() => {
          const BRIEFS = [
            { id: "morning", title: "Morning Brief", icon: "☀️", desc: "Daily pre-market analysis", url: "https://richacarson.github.io/rich-report/morning-briefs.html", color: theme === "dark" ? "#F59E0B" : "#D97706" },
            { id: "commentary", title: "Market Commentary", icon: "📊", desc: "Market outlook & strategy", url: "https://richacarson.github.io/iown-data", color: theme === "dark" ? "#34D399" : "#16A34A" },
            { id: "report", title: "The Rich Report", icon: "📰", desc: "Macro insights & thesis", url: "https://richacarson.github.io/rich-report/The_Rich_Report.html", color: theme === "dark" ? "#6366F1" : "#4F46E5" },
          ];
          const active = BRIEFS.find(b => b.id === briefView);

          return (
            <div style={{ animation: "fadeIn 0.3s ease", paddingTop: 20, display: "flex", flexDirection: "column", height: briefView ? "calc(100dvh - 140px)" : "auto" }}>
              {!isDesktop && !briefView && <div style={{ fontSize: 24, fontWeight: 800, color: C.t1, marginBottom: 16 }}>Briefs</div>}
              
              {/* Toggle pills — always visible */}
              <div style={{ display: "flex", gap: 6, marginBottom: briefView ? 0 : 16, flexShrink: 0, overflowX: "auto", paddingBottom: 4 }}>
                {BRIEFS.map(b => (
                  <button key={b.id} onClick={() => setBriefView(briefView === b.id ? null : b.id)} style={{
                    flex: "0 0 auto", padding: "10px 16px", borderRadius: 12,
                    border: `1px solid ${briefView === b.id ? b.color + "66" : C.border}`,
                    background: briefView === b.id ? b.color + "15" : C.card,
                    cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8,
                    transition: "all 0.2s",
                  }}>
                    <span style={{ fontSize: 18 }}>{b.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: briefView === b.id ? C.t1 : C.t3 }}>{b.title}</span>
                  </button>
                ))}
              </div>

              {/* Content: cards or embedded iframe */}
              {!briefView ? (
                <div style={{ display: isDesktop ? "grid" : "flex", gridTemplateColumns: isDesktop ? "repeat(3, 1fr)" : undefined, flexDirection: isDesktop ? undefined : "column", gap: 14 }}>
                  {BRIEFS.map(b => (
                    <div key={b.id} onClick={() => setBriefView(b.id)} style={{
                      background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
                      padding: isDesktop ? "28px 24px" : "20px 18px",
                      cursor: "pointer", transition: "border-color 0.2s, transform 0.15s",
                      position: "relative", overflow: "hidden",
                    }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = b.color + "66"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = "none"; }}
                    >
                      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${b.color}, ${b.color}44)` }} />
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                        <div style={{
                          width: 48, height: 48, borderRadius: 14,
                          background: b.color + "15", display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 24, flexShrink: 0,
                        }}>{b.icon}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 16, fontWeight: 800, color: C.t1, marginBottom: 4 }}>{b.title}</div>
                          <div style={{ fontSize: 12, color: C.t4, lineHeight: 1.4 }}>{b.desc}</div>
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.t4} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 4 }}>
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ flex: 1, borderRadius: 14, overflow: "hidden", border: `1px solid ${C.border}`, marginTop: 12, background: "#fff" }}>
                  <iframe
                    src={active.url}
                    title={active.title}
                    style={{ width: "100%", height: "100%", border: "none", display: "block" }}
                    sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads"
                  />
                </div>
              )}
            </div>
          );
        })()}

        {/* ━━━ SETTINGS ━━━ */}
        {tab === "settings" && (
          <div style={{ animation: "fadeIn 0.3s ease", paddingTop: 20 }}>
            {!isDesktop && <div style={{ fontSize: 24, fontWeight: 800, color: C.t1, marginBottom: 20 }}>Settings</div>}
            <div style={{ display: isDesktop ? "grid" : "block", gridTemplateColumns: isDesktop ? "1fr 1fr" : undefined, gap: isDesktop ? 16 : 0 }}>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: "22px 20px", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginBottom: 12 }}>Appearance</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[{ v: "dark", l: "🌙 Dark" }, { v: "light", l: "☀️ Light" }].map(({ v, l }) => (
                  <button key={v} onClick={() => toggleTheme(v)} style={{
                    flex: 1, padding: "10px 0", borderRadius: 10,
                    border: `1px solid ${theme === v ? C.borderActive : C.border}`,
                    background: theme === v ? C.accentSoft : "transparent",
                    color: theme === v ? C.t1 : C.t3, fontSize: 13, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>{l}</button>
                ))}
              </div>
            </div>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: "22px 20px", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginBottom: 6 }}>Auto-Refresh</div>
              <div style={{ fontSize: 11, color: C.t4, marginBottom: 10 }}>{refresh === null ? "Smart: 1s when market open, paused when closed" : refresh === 0 ? "Manual refresh only" : `Every ${refresh}s`}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[{ v: null, l: "Smart" }, { v: 0, l: "Off" }, { v: 1, l: "1s" }, { v: 5, l: "5s" }, { v: 15, l: "15s" }, { v: 30, l: "30s" }].map(({ v, l }) => (
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
            </div> {/* end settings grid */}
            <div style={{ marginTop: 40, textAlign: "center", paddingBottom: 20 }}>
              <div style={{ fontSize: 13, color: C.t4, marginTop: 4 }}>Intentional Ownership</div>
              <div style={{ fontSize: 11, color: C.t4, marginTop: 4 }}>A Registered Investment Advisor under Paradiem</div>
            </div>
          </div>
        )}
      </div> {/* end maxWidth content */}
      </div> {/* end main content area */}

      {/* MOBILE BOTTOM TAB BAR — hidden on desktop */}
      {!isDesktop && (
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
        background: theme === "dark" ? "rgba(8,11,5,0.88)" : "rgba(245,245,240,0.92)", backdropFilter: "blur(28px) saturate(1.4)", WebkitBackdropFilter: "blur(28px) saturate(1.4)",
        borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-around",
        padding: "6px 0", paddingBottom: "calc(env(safe-area-inset-bottom, 8px) + 6px)",
      }}>
        {navItems.map(t => (
          <button key={t.id} onClick={() => handleTabTap(t.id)} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            padding: "6px 24px", background: "transparent", border: "none", cursor: "pointer",
          }}>
            {t.icon(tab === t.id)}
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.3, color: tab === t.id ? C.t1 : C.t4 }}>{t.label}</span>
            <div style={{ width: tab === t.id ? 4 : 0, height: 4, borderRadius: 2, background: C.accent, marginTop: -2, transition: "width 0.2s cubic-bezier(0.16,1,0.3,1)", boxShadow: tab === t.id ? `0 0 8px ${C.accentGlow}` : "none" }} />
          </button>
        ))}
      </div>
      )}

      {chartSymbol && <ChartOverlay symbol={chartSymbol} onClose={() => setChartSymbol(null)} hdrs={hdrs} names={names} theme={theme} quotesRef={quotesRef} barsRef={barsRef} />}
      <GS theme={theme} />
    </div>
  );
}

function GS({ theme }) {
  const isDark = theme === "dark";
  return (
    <style>{`
      @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.3 } }
      @keyframes spin { 0% { transform: rotate(0deg) } 100% { transform: rotate(360deg) } }
      @keyframes fadeIn { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
      @keyframes slideUp { from { opacity: 0; transform: translateY(100%) } to { opacity: 1; transform: translateY(0) } }
      @keyframes shake { 0%, 100% { transform: translateX(0) } 20%, 60% { transform: translateX(-6px) } 40%, 80% { transform: translateX(6px) } }
      @keyframes slideInRight { from { opacity: 0; transform: translateX(30px) } to { opacity: 1; transform: translateX(0) } }
      @keyframes slideInLeft { from { opacity: 0; transform: translateX(-30px) } to { opacity: 1; transform: translateX(0) } }
      * { -webkit-tap-highlight-color: transparent; }
      input::placeholder { color: ${isDark ? "#3A4A28" : "#9DAF88"} !important; }
      input:focus { border-color: rgba(${isDark ? "120,140,88" : "74,107,37"},0.30) !important; }
      ::-webkit-scrollbar { width: 6px; height: 6px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: rgba(${isDark ? "110,132,80,0.2" : "80,100,60,0.2"}); border-radius: 6px; }
      ::-webkit-scrollbar-thumb:hover { background: rgba(${isDark ? "110,132,80,0.35" : "80,100,60,0.35"}); }
      body { background: ${isDark ? "#080B05" : "#F5F5F0"}; overscroll-behavior-x: none; }
      .ticker-row { transition: transform 0.15s cubic-bezier(0.16,1,0.3,1), opacity 0.15s; }
      .ticker-row:active { transform: scale(0.97); opacity: 0.85; }
      @media (min-width: 768px) {
        .tradingview-widget-container { min-height: 500px; }
        tr:hover td { background: rgba(${isDark ? "110,132,80,0.04" : "74,107,37,0.06"}) !important; }
        button:hover { opacity: 0.85; }
      }
    `}</style>
  );
}
