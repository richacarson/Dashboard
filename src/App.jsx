import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from "react";

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
const NON_IEX_BM = ["IUSG", "DVY", "IWS"];
const IEX_BM = BM_SYMS.filter(s => !NON_IEX_BM.includes(s));
const BASE = "https://data.alpaca.markets";
const PAPER = "https://paper-api.alpaca.markets";
const EK = import.meta.env.VITE_ALPACA_KEY || "";
const ES = import.meta.env.VITE_ALPACA_SECRET || "";
const FK = import.meta.env.VITE_FMP_KEY || "";
const FH = import.meta.env.VITE_FINNHUB_KEY || "";
const CLAUDE_KEY = import.meta.env.VITE_ANTHROPIC_KEY || "";
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
  bg: "#0C1018", surface: "#121722", card: "#171D2A", cardHover: "#1E2536", elevated: "#232B3D",
  border: "rgba(140,160,130,0.08)", borderHover: "rgba(140,160,130,0.16)", borderActive: "rgba(140,160,130,0.28)",
  t1: "#EDF0E8", t2: "#B0BDA0", t3: "#7A8E68", t4: "#3D4A32",
  up: "#34D399", upSoft: "#34D39920", upGlow: "#34D39940",
  dn: "#F87171", dnSoft: "#F8717120", dnGlow: "#F8717140",
  accent: "#8FA878", accentSoft: "rgba(143,168,120,0.10)", accentGlow: "rgba(143,168,120,0.25)",
  shadow: "0 2px 8px rgba(0,0,0,0.3)",
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
function Heatmap({ sleeves, chgFn, namesFn, onTap, onContext }) {
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
      {cells.map(cell => {
        let lpTimer = null;
        return (
        <div key={cell.sym} 
          onClick={() => onTap(cell.sym)} 
          onContextMenu={(e) => { e.preventDefault(); onContext?.(cell.sym, e.clientX, e.clientY); }}
          onTouchStart={(e) => { const t = e.touches[0]; lpTimer = setTimeout(() => onContext?.(cell.sym, t.clientX, t.clientY), 500); }}
          onTouchEnd={() => { if (lpTimer) clearTimeout(lpTimer); }}
          onTouchMove={() => { if (lpTimer) clearTimeout(lpTimer); }}
          data-heatmap={cell.sym} style={{
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
        );
      })}
    </div>
  );
}

/* ── Stock Logo with sequential fallback ── */
const LOGO_DOMAINS = {
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
  O:"realtyincome.com",STLD:"steeldynamics.com",VLO:"valero.com",CNX:"cnx.com",
  BKH:"blackhillscorp.com",AEM:"agnicoeagle.com",GFI:"goldfields.com",
  SUPV:"gruposupervielle.com",MARA:"maraholdings.com",ATAT:"atourlifestyle.com",
  DVY:"ishares.com",IUSG:"ishares.com",IWS:"ishares.com",SPY:"ssga.com",DIA:"ssga.com",
  IBIT:"ishares.com",ETHA:"ishares.com",
  A:"agilent.com",ADI:"analog.com",ATO:"atmosenergy.com",CHD:"churchdwight.com",
  CL:"colgatepalmolive.com",CWAN:"clearwateranalytics.com",DGX:"questdiagnostics.com",
  EIX:"edison.com",FAST:"fastenal.com",FINV:"finvgroup.com",FTNT:"fortinet.com",
  GD:"gd.com",GPC:"genpt.com",HRMY:"harmonybiosciences.com",HUT:"hut8.com",
  KEYS:"keysight.com",LMT:"lockheedmartin.com",LRCX:"lamresearch.com",
  MATX:"matson.com",NEE:"nexteraenergy.com",NXPI:"nxp.com",OKE:"oneok.com",
  ORI:"oldrepublic.com",PCAR:"paccar.com",PDD:"pinduoduo.com",CVX:"chevron.com",
  SSNC:"ssctech.com",SYF:"synchrony.com",SYK:"stryker.com",
  TEL:"te.com",TOL:"tollbrothers.com",TSM:"tsmc.com",
  PFE:"pfizer.com",ABBV:"abbvie.com",UNH:"unitedhealthgroup.com",
  XOM:"exxonmobil.com",T:"att.com",MCD:"mcdonalds.com",WFC:"wellsfargo.com",C:"citigroup.com",
  BAC:"bankofamerica.com",MS:"morganstanley.com",SCHW:"schwab.com",USB:"usbank.com",
  PNC:"pnc.com",TFC:"truist.com",COF:"capitalone.com",ADP:"adp.com",FIS:"fisglobal.com",
  FISV:"fiserv.com",ICE:"ice.com",CME:"cmegroup.com",SPGI:"spglobal.com",MCO:"moodys.com",
  AON:"aon.com",MMC:"mmc.com",TRV:"travelers.com",CB:"chubb.com",AFL:"aflac.com",
};
const logoCache = {};
function tryLoadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}
const StockLogo = React.memo(function StockLogo({ symbol, size = 32, logoUrl }) {
  const [src, setSrc] = useState(logoCache[symbol] || null);
  const [fallback, setFallback] = useState(false);
  const domain = LOGO_DOMAINS[symbol];
  useEffect(() => {
    if (logoCache[symbol]) { setSrc(logoCache[symbol]); setFallback(false); return; }
    let cancelled = false;
    setSrc(null); setFallback(false);
    const sources = [];
    if (logoUrl) sources.push(logoUrl);
    if (domain) sources.push(`https://logos-api.apistemic.com/domain:${domain}`);
    if (domain) sources.push(`https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=128`);
    (async () => {
      for (const url of sources) {
        if (cancelled) return;
        const ok = await tryLoadImage(url);
        if (ok && !cancelled) { logoCache[symbol] = url; setSrc(url); return; }
      }
      if (!cancelled) setFallback(true);
    })();
    return () => { cancelled = true; };
  }, [symbol, domain, logoUrl]);
  if (fallback || (!src && !domain)) {
    const colors = ["#4A6B25","#3B82F6","#8B5CF6","#EC4899","#F59E0B","#10B981","#6366F1","#F97316"];
    const bg = colors[symbol.charCodeAt(0) % colors.length];
    return (
      <div style={{ width: size, height: size, borderRadius: size / 2, background: bg + "22", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <span style={{ fontSize: size * 0.4, fontWeight: 800, color: bg }}>{symbol.slice(0, 2)}</span>
      </div>
    );
  }
  if (!src) return <div style={{ width: size, height: size, borderRadius: size / 2, background: C.surface, flexShrink: 0 }} />;
  return <img src={src} alt={symbol} onError={() => { delete logoCache[symbol]; setFallback(true); }} style={{ width: size, height: size, borderRadius: size / 2, objectFit: "contain", flexShrink: 0, background: "#fff" }} />;
});
function StockProfile({ symbol, initTab, onClose, hdrs, names, theme, quotesRef, barsRef, fundamentals, news, coreSyms }) {
  const [profileTab, setProfileTab] = useState(initTab || "overview");
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [recommendation, setRecommendation] = useState(null);
  const [earnings, setEarnings] = useState([]);
  const [financials, setFinancials] = useState(null);
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

  // Fetch profile data
  useEffect(() => {
    const fetchProfile = async () => {
      setProfileLoading(true);
      try {
        // Load static company description
        try {
          const descR = await fetch(`${import.meta.env.BASE_URL}company-descriptions.json`);
          if (descR.ok) {
            const descs = await descR.json();
            if (descs[symbol]) setProfile(p => ({ ...p, description: descs[symbol] }));
          }
        } catch {}
        // Finnhub data
        if (FH) {
          const [profR, recR, earnR, finR] = await Promise.all([
            fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${FH}`),
            fetch(`https://finnhub.io/api/v1/stock/recommendation?symbol=${symbol}&token=${FH}`),
            fetch(`https://finnhub.io/api/v1/stock/earnings?symbol=${symbol}&limit=8&token=${FH}`),
            fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${FH}`),
          ]);
          if (profR.ok) { const d = await profR.json(); if (d.name) setProfile(p => ({ ...p, ...d })); }
          if (recR.ok) { const d = await recR.json(); if (Array.isArray(d) && d.length) setRecommendation(d); }
          if (earnR.ok) { const d = await earnR.json(); if (Array.isArray(d)) setEarnings(d); }
          if (finR.ok) { const d = await finR.json(); if (d.metric) setFinancials(d.metric); }
        }
      } catch {}
      setProfileLoading(false);
    };
    fetchProfile();
  }, [symbol]);

  // TradingView chart is now an inline iframe — no script loading needed

  // Track which section is visible and update tab indicator
  const scrollContainerRef = useRef(null);
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const sections = ["overview", "financials", "news"];
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.intersectionRatio > 0.3) {
          const id = entry.target.id?.replace("section-", "");
          if (id && sections.includes(id)) setProfileTab(id);
        }
      }
    }, { root: container, threshold: 0.3 });
    sections.forEach(id => {
      const el = container.querySelector(`#section-${id}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [symbol]);

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

  const q = quotesRef?.current?.[symbol];
  const b = barsRef?.current?.[symbol];
  const price = q?.p;
  const pc = b?.pc;
  const dayChg = price && pc ? ((price - pc) / pc) * 100 : null;
  const f = fundamentals?.[symbol] || {};
  const fm = financials || {};
  const vol = (v) => { if (!v) return "—"; if (v >= 1e12) return `$${(v/1e12).toFixed(2)}T`; if (v >= 1e9) return `$${(v/1e9).toFixed(2)}B`; if (v >= 1e6) return `$${(v/1e6).toFixed(1)}M`; return `$${v.toLocaleString()}`; };
  const fmt = (v, d=2) => v != null ? v.toFixed(d) : "—";
  const pct = (v) => v != null ? `${v >= 0 ? "+" : ""}${v.toFixed(2)}%` : "—";

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "chart", label: "Chart" },
  ];

  // Stat row helper
  const StatRow = ({ label, value, color }) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontSize: 13, color: C.t3 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: color || C.t1, fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );

  // Card helper
  const Card = ({ title, children, grade }) => (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, marginBottom: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: C.t1 }}>{title}</span>
        {grade && <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 6, background: grade.color + "22", color: grade.color }}>{grade.label}</span>}
      </div>
      {children}
    </div>
  );

  // Analyst consensus
  const latestRec = recommendation?.[0];
  const totalAnalysts = latestRec ? (latestRec.strongBuy + latestRec.buy + latestRec.hold + latestRec.sell + latestRec.strongSell) : 0;
  const consensusLabel = latestRec ? (
    (latestRec.strongBuy + latestRec.buy) > totalAnalysts * 0.6 ? "Buy" :
    (latestRec.strongSell + latestRec.sell) > totalAnalysts * 0.4 ? "Sell" : "Hold"
  ) : null;
  const consensusColor = consensusLabel === "Buy" ? C.up : consensusLabel === "Sell" ? C.dn : "#F59E0B";

  // Ticker news
  const tickerNews = [...(news || [])].filter(a => a.symbols?.includes(symbol)).slice(0, 15);

  return (
    <div onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
      background: C.bg, display: "flex", flexDirection: "column",
      paddingTop: "env(safe-area-inset-top, 0px)",
      transform: dragX > 0 ? `translateX(${dragX}px)` : "none",
      transition: dragging ? "none" : "transform 0.3s cubic-bezier(0.16,1,0.3,1)",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{ padding: "8px 16px", flexShrink: 0, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: C.t1 }}>{symbol}</span>
                <span ref={livePriceRef} style={{ fontSize: 17, fontWeight: 700, color: C.t2 }}>{price ? `$${price.toFixed(2)}` : ""}</span>
                <span ref={livePctRef} style={{ fontSize: 13, fontWeight: 700, color: dayChg >= 0 ? C.up : C.dn }}>{dayChg != null ? pct(dayChg) : ""}</span>
              </div>
              <div style={{ fontSize: 12, color: C.t4, marginTop: 1 }}>{names?.[symbol] || profile?.name || ""}</div>
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 16, background: C.t4 + "15",
            border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.t3} strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        {/* Tab bar — scrolls to section */}
        <div style={{ display: "flex", gap: 0 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => {
              setProfileTab(t.id);
              const el = document.getElementById(`section-${t.id}`);
              if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
            }} style={{
              flex: 1, padding: "10px 0", background: "none", border: "none",
              borderBottom: profileTab === t.id ? `2px solid ${C.accent}` : "2px solid transparent",
              color: profileTab === t.id ? C.t1 : C.t4, fontSize: 13, fontWeight: profileTab === t.id ? 700 : 500,
              cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* CHART TAB — full screen */}
      {profileTab === "chart" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <iframe
            src={`https://s.tradingview.com/widgetembed/?frameElementId=tv_chart&symbol=${symbol}&interval=W&hidesidetoolbar=1&symboledit=0&saveimage=0&toolbarbg=${isDark ? "171D2A" : "F5F5F0"}&studies=[]&theme=${isDark ? "dark" : "light"}&style=1&timezone=America%2FNew_York&withdateranges=1&showpopupbutton=0&studies_overrides={}&overrides={}&enabled_features=[]&disabled_features=[]&locale=en&utm_source=&utm_medium=widget&utm_campaign=chart`}
            style={{ flex: 1, width: "100%", border: "none", display: "block" }}
            title={`${symbol} Chart`}
            sandbox="allow-scripts allow-same-origin allow-popups"
          />
        </div>
      )}

      {/* OVERVIEW + FINANCIALS + NEWS — scrollable */}
      {profileTab !== "chart" && (
      <div ref={scrollContainerRef} style={{ flex: 1, overflowY: "auto", padding: "16px", paddingBottom: "calc(env(safe-area-inset-bottom, 20px) + 80px)", WebkitOverflowScrolling: "touch" }}>
        <div style={{ display: "grid", gridTemplateColumns: window.innerWidth >= 768 ? "1fr 1fr" : "1fr", gap: 12, alignItems: "stretch" }}>

          {/* ── OVERVIEW ── */}
          <div id="section-overview" style={{ display: "contents" }}>
          {profile && (
            <div style={{ gridColumn: "1 / -1" }}>
                <Card title="Company Profile">
                  {/* Logo + name + tags */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 14 }}>
                    {profile.logo && (
                      <img src={profile.logo || profile.image} alt="" style={{ width: 48, height: 48, borderRadius: 10, objectFit: "contain", background: "#fff", padding: 4, border: `1px solid ${C.border}` }} onError={(e) => { e.target.style.display = "none"; }} />
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: C.t1, marginBottom: 4 }}>{profile.name || profile.companyName || names?.[symbol] || symbol}</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {(profile.finnhubIndustry || profile.sector || profile.industry) && <span style={{ fontSize: 11, fontWeight: 600, color: C.accent, background: C.accentSoft, padding: "2px 8px", borderRadius: 4 }}>{profile.finnhubIndustry || profile.sector || profile.industry}</span>}
                        {profile.exchange && <span style={{ fontSize: 11, color: C.t4, background: C.surface, padding: "2px 8px", borderRadius: 4, border: `1px solid ${C.border}` }}>{profile.exchange}</span>}
                      </div>
                    </div>
                  </div>
                  {/* Full description */}
                  {profile.description && (
                    <div style={{ fontSize: 13, lineHeight: 1.65, color: C.t3, marginBottom: 14 }}>
                      {profile.description}
                    </div>
                  )}
                  {/* Company details grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                    {(profile.country || profile.city) && <StatRow label="Location" value={[profile.city, profile.state, profile.country].filter(Boolean).join(", ")} />}
                    {(profile.ipo || profile.ipoDate) && <StatRow label="IPO Date" value={profile.ipoDate || profile.ipo} />}
                    {(profile.fullTimeEmployees || profile.employees) && <StatRow label="Employees" value={(profile.fullTimeEmployees || profile.employees)?.toLocaleString?.()} />}
                    {profile.ceo && <StatRow label="CEO" value={profile.ceo} />}
                    {(profile.weburl || profile.website) && (
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                        <span style={{ fontSize: 13, color: C.t3 }}>Website</span>
                        <a href={profile.weburl || profile.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600, color: C.accent, textDecoration: "none" }}>{(profile.website || profile.weburl || "").replace(/https?:\/\/(www\.)?/, "")}</a>
                      </div>
                    )}
                  </div>
                </Card>
            </div>
              )}

              {/* Key Stats */}
              <Card title="Key Statistics">
                <StatRow label="Market Cap" value={profile?.marketCapitalization ? vol(profile.marketCapitalization * 1e6) : (fm["marketCapitalization"] ? vol(fm["marketCapitalization"]) : "—")} />
                <StatRow label="P/E (TTM)" value={fmt(f.peTTM || fm["peNormalizedAnnual"])} />
                <StatRow label="P/E (FWD)" value={fmt(f.peFwd || fm["peTTM"])} />
                <StatRow label="EPS (TTM)" value={fmt(fm["epsNormalizedAnnual"] || f.epsTTM)} />
                <StatRow label="Dividend Yield" value={fm["dividendYieldIndicatedAnnual"] != null ? `${fm["dividendYieldIndicatedAnnual"].toFixed(2)}%` : (f.divYield != null ? `${f.divYield.toFixed(2)}%` : "—")} />
                <StatRow label="52-Week High" value={fm["52WeekHigh"] != null ? `$${fmt(fm["52WeekHigh"])}` : "—"} />
                <StatRow label="52-Week Low" value={fm["52WeekLow"] != null ? `$${fmt(fm["52WeekLow"])}` : "—"} />
                <StatRow label="Beta" value={fmt(fm["beta"])} />
                <StatRow label="Volume" value={b?.v ? b.v.toLocaleString() : "—"} />
              </Card>

              {/* Momentum */}
              {(fm["3MonthPriceReturnDaily"] != null || fm["6MonthPriceReturnDaily"] != null) && (
                <Card title="Momentum">
                  <StatRow label="3 Month Return" value={pct(fm["3MonthPriceReturnDaily"])} color={fm["3MonthPriceReturnDaily"] >= 0 ? C.up : C.dn} />
                  <StatRow label="6 Month Return" value={pct(fm["6MonthPriceReturnDaily"])} color={fm["6MonthPriceReturnDaily"] >= 0 ? C.up : C.dn} />
                  <StatRow label="1 Year Return" value={pct(fm["yearToDatePriceReturnDaily"])} color={fm["yearToDatePriceReturnDaily"] >= 0 ? C.up : C.dn} />
                </Card>
              )}

              {profileLoading && <div style={{ textAlign: "center", padding: "40px 0", color: C.t4, fontSize: 14 }}>Loading profile...</div>}
          </div>

          {/* ── FINANCIALS ── */}
          <div id="section-financials" style={{ display: "contents" }}>
              {/* Valuation */}
              <Card title="Valuation">
                <StatRow label="P/E (TTM)" value={fmt(f.peTTM || fm["peNormalizedAnnual"])} />
                <StatRow label="P/E (FWD)" value={fmt(f.peFwd)} />
                <StatRow label="PEG Ratio" value={fmt(f.peg || fm["pegAnnual"])} />
                <StatRow label="Price/Book" value={fmt(fm["pbAnnual"])} />
                <StatRow label="Price/Sales" value={fmt(fm["psAnnual"])} />
                <StatRow label="EV/EBITDA" value={fmt(fm["currentEv/freeCashFlowAnnual"])} />
              </Card>

              {/* Profitability */}
              <Card title="Profitability">
                <StatRow label="Gross Margin" value={fm["grossMarginTTM"] != null ? `${fmt(fm["grossMarginTTM"])}%` : "—"} />
                <StatRow label="Operating Margin" value={fm["operatingMarginTTM"] != null ? `${fmt(fm["operatingMarginTTM"])}%` : "—"} />
                <StatRow label="Net Margin" value={fm["netProfitMarginTTM"] != null ? `${fmt(fm["netProfitMarginTTM"])}%` : "—"} />
                <StatRow label="ROE" value={fm["roeTTM"] != null ? `${fmt(fm["roeTTM"])}%` : (f.roe != null ? `${fmt(f.roe)}%` : "—")} />
                <StatRow label="ROA" value={fm["roaTTM"] != null ? `${fmt(fm["roaTTM"])}%` : "—"} />
              </Card>

              {/* Growth */}
              <Card title="Growth">
                <StatRow label="Revenue Growth (YoY)" value={fm["revenueGrowthQuarterlyYoy"] != null ? `${fmt(fm["revenueGrowthQuarterlyYoy"])}%` : "—"} color={fm["revenueGrowthQuarterlyYoy"] >= 0 ? C.up : C.dn} />
                <StatRow label="EPS Growth (YoY)" value={fm["epsGrowthQuarterlyYoy"] != null ? `${fmt(fm["epsGrowthQuarterlyYoy"])}%` : "—"} color={fm["epsGrowthQuarterlyYoy"] >= 0 ? C.up : C.dn} />
                <StatRow label="Revenue Growth (3Y CAGR)" value={fm["revenueGrowth3Y"] != null ? `${fmt(fm["revenueGrowth3Y"])}%` : "—"} />
                <StatRow label="EPS Growth (3Y CAGR)" value={fm["epsGrowth3Y"] != null ? `${fmt(fm["epsGrowth3Y"])}%` : "—"} />
              </Card>

              {/* Dividends */}
              <Card title="Dividends">
                <StatRow label="Dividend Yield" value={fm["dividendYieldIndicatedAnnual"] != null ? `${fm["dividendYieldIndicatedAnnual"].toFixed(2)}%` : (f.divYield != null ? `${f.divYield.toFixed(2)}%` : "—")} />
                <StatRow label="Dividend Per Share" value={fm["dividendPerShareAnnual"] != null ? `$${fmt(fm["dividendPerShareAnnual"])}` : "—"} />
                <StatRow label="Payout Ratio" value={fm["payoutRatioAnnual"] != null ? `${fmt(fm["payoutRatioAnnual"])}%` : "—"} />
                <StatRow label="5Y Avg Dividend Yield" value={fm["dividendYield5Y"] != null ? `${fmt(fm["dividendYield5Y"])}%` : "—"} />
              </Card>

              {/* Balance Sheet Strength */}
              <Card title="Balance Sheet">
                <StatRow label="Debt/Equity" value={fmt(f.de || fm["totalDebt/totalEquityQuarterly"])} />
                <StatRow label="Current Ratio" value={fmt(fm["currentRatioQuarterly"])} />
                <StatRow label="Quick Ratio" value={fmt(fm["quickRatioQuarterly"])} />
                <StatRow label="Book Value/Share" value={fm["bookValuePerShareQuarterly"] != null ? `$${fmt(fm["bookValuePerShareQuarterly"])}` : "—"} />
              </Card>

              {/* Earnings History */}
              {earnings.length > 0 && (
                <Card title="Earnings History">
                  <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8 }}>
                    {earnings.slice(0, 8).reverse().map((e, i) => {
                      const beat = e.actual != null && e.estimate != null && e.actual >= e.estimate;
                      const miss = e.actual != null && e.estimate != null && e.actual < e.estimate;
                      return (
                        <div key={i} style={{ flex: "0 0 auto", minWidth: 80, padding: "10px 8px", background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`, textAlign: "center" }}>
                          <div style={{ fontSize: 10, color: C.t4, marginBottom: 6 }}>{e.period}</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, marginBottom: 2 }}>{e.actual != null ? e.actual.toFixed(2) : "—"}</div>
                          <div style={{ fontSize: 10, color: C.t4 }}>Est: {e.estimate != null ? e.estimate.toFixed(2) : "—"}</div>
                          {(beat || miss) && (
                            <div style={{ fontSize: 10, fontWeight: 700, color: beat ? C.up : C.dn, marginTop: 4 }}>
                              {beat ? "BEAT" : "MISS"} {e.surprise != null ? `${e.surprise >= 0 ? "+" : ""}${(e.surprisePercent || 0).toFixed(1)}%` : ""}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}

              {/* Analyst Ratings */}
              {latestRec && (
                <Card title="Analyst Ratings">
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: consensusColor, padding: "4px 14px", borderRadius: 8, background: consensusColor + "18", border: `1px solid ${consensusColor}44` }}>{consensusLabel}</span>
                    <span style={{ fontSize: 12, color: C.t4 }}>{totalAnalysts} analysts</span>
                  </div>
                  {[
                    { label: "Strong Buy", val: latestRec.strongBuy, color: "#16A34A" },
                    { label: "Buy", val: latestRec.buy, color: "#34D399" },
                    { label: "Hold", val: latestRec.hold, color: "#F59E0B" },
                    { label: "Sell", val: latestRec.sell, color: "#F87171" },
                    { label: "Strong Sell", val: latestRec.strongSell, color: "#DC2626" },
                  ].map(r => (
                    <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: C.t3, width: 80 }}>{r.label}</span>
                      <div style={{ flex: 1, height: 8, background: C.border, borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ width: `${totalAnalysts ? (r.val / totalAnalysts) * 100 : 0}%`, height: "100%", background: r.color, borderRadius: 4, transition: "width 0.3s" }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.t2, width: 20, textAlign: "right" }}>{r.val}</span>
                    </div>
                  ))}
                  {/* Price target */}
                  {fm["targetMedianPrice"] && (
                    <div style={{ marginTop: 14, padding: "12px 0 0", borderTop: `1px solid ${C.border}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: C.t4 }}>Price Target</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>${fmt(fm["targetMedianPrice"])}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.t4 }}>
                        <span>Low: ${fmt(fm["targetLowPrice"])}</span>
                        <span>High: ${fmt(fm["targetHighPrice"])}</span>
                      </div>
                    </div>
                  )}
                </Card>
              )}
          </div>

          {/* ── NEWS ── */}
          <div id="section-news" style={{ display: "contents" }}>
            <div style={{ gridColumn: "1 / -1" }}>
              {tickerNews.length === 0 ? (
                <Card title="News"><div style={{ textAlign: "center", padding: "20px 0", color: C.t4, fontSize: 14 }}>No recent news for {symbol}</div></Card>
              ) : (
                <Card title="News">
                {tickerNews.map((article, i) => (
                <div key={article.id || i} style={{
                  padding: "14px 0", borderBottom: i < tickerNews.length - 1 ? `1px solid ${C.border}` : "none",
                  cursor: "pointer",
                }} onClick={() => article.url && window.open(article.url, "_blank")}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    {article.images?.[0]?.url && (
                      <img src={article.images[0].url} alt="" style={{ width: 60, height: 60, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: C.t4, marginBottom: 4 }}>
                        {article.created_at ? (() => { const d = Date.now() - new Date(article.created_at).getTime(); const m = Math.floor(d/60000); if (m < 60) return `${m}m ago`; const h = Math.floor(m/60); if (h < 24) return `${h}h ago`; return `${Math.floor(h/24)}d ago`; })() : ""}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.t1, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {article.headline}
                      </div>
                      {article.summary && (
                        <div style={{ fontSize: 12, color: C.t3, marginTop: 4, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {article.summary}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
                </Card>
              )}
            </div>
          </div>

        </div>{/* end maxWidth wrapper */}
      </div>)}{/* end scrollable container + profileTab conditional */}
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
  const [ghToken, setGhToken] = useState(() => localStorage.getItem("iown_gh_token") || "");
  useEffect(() => { if (ghToken) localStorage.setItem("iown_gh_token", ghToken); }, [ghToken]);
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
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [articleContent, setArticleContent] = useState(null);
  const [articleLoading, setArticleLoading] = useState(false);

  // Fetch full article content via Claude when requested
  const fetchArticleContent = useCallback(async (article) => {
    if (!CLAUDE_KEY || !article.url) return;
    setArticleLoading(true);
    try {
      const summary = article.summary || "";
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": CLAUDE_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 2000,
          messages: [{ role: "user", content: `You are a financial news editor. Based on the following article details, write a comprehensive, detailed article summary in clean paragraphs. Expand on the key points, provide context, and explain the market implications.

Headline: "${article.headline}"
Source: ${article.source}
Summary: ${summary}
Symbols mentioned: ${(article.symbols || []).join(", ")}

Instructions:
- Write 4-6 detailed paragraphs expanding on the news
- Include relevant market context and implications
- Keep a professional, objective financial news tone
- At the end, add "## Key Takeaways" with 3-4 bullet points starting with "- "
- Do NOT include any preamble — start directly with the article content
- Do NOT ask questions or offer to help further` }],
        }),
      });
      if (r.ok) {
        const d = await r.json();
        // Claude summary received
        const text = d.content?.filter(b => b.type === "text").map(b => b.text).join("\n") || "";
        if (text) setArticleContent(text);
      } else {
        const err = await r.text();
        console.error("Claude API error:", r.status, err);
      }
    } catch (e) { console.error("Article fetch error:", e); }
    setArticleLoading(false);
  }, []);
  const [fundamentals, setFundamentals] = useState({}); // { SYM: { pe, peFwd, peg, roe, de, ... } }
  const [loading, setLoading] = useState(false);
  const [lastUp, setLastUp] = useState(null);
  const lastUpRef = useRef(null);
  const [tab, setTab] = useState("home");
  const [moreMenu, setMoreMenu] = useState(false);
  const [briefView, setBriefView] = useState(null); // null = picker, "morning" | "commentary" | "report"
  const contentRef = useRef(null);
  const tabSwipeRef = useRef(null);
  const tabIds = ["home", "performance", "research", "calendar", "news", "clients", "settings"];
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
  const [profileInitTab, setProfileInitTab] = useState("overview");
  const [ctxMenu, setCtxMenu] = useState(null); // { sym, x, y }

  // Open stock profile with specific tab
  const openStock = (sym, tab = "overview") => { setProfileInitTab(tab); setChartSymbol(sym); setCtxMenu(null); };

  // Context menu handler (right-click on desktop, long-press on mobile)
  const stockContextHandlers = (sym) => {
    let longPressTimer = null;
    return {
      onClick: () => openStock(sym),
      onContextMenu: (e) => { e.preventDefault(); setCtxMenu({ sym, x: e.clientX, y: e.clientY }); },
      onTouchStart: (e) => {
        const touch = e.touches[0];
        longPressTimer = setTimeout(() => { setCtxMenu({ sym, x: touch.clientX, y: touch.clientY }); }, 500);
      },
      onTouchEnd: () => { if (longPressTimer) clearTimeout(longPressTimer); },
      onTouchMove: () => { if (longPressTimer) clearTimeout(longPressTimer); },
    };
  };
  const [refresh, setRefresh] = useState(null); // null = smart auto
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("iown_theme");
      if (saved) return saved;
      // Default: dark after 4pm ET (3pm CST / market close), light during market hours
      const now = new Date();
      const etHour = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" })).getHours();
      return (etHour >= 16 || etHour < 7) ? "dark" : "light";
    } catch { return "dark"; }
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
  const [homeView, setHomeView] = useState("lists"); // "holdings" | "lists"
  const [holdingsSort, setHoldingsSort] = useState({ col: "weight", dir: "desc" }); // sortable holdings table
  const [showTxModal, setShowTxModal] = useState(false); // add transaction modal
  const [showRebalModal, setShowRebalModal] = useState(false); // rebalance modal
  const [txForm, setTxForm] = useState({ type: "PURCHASE", ticker: "", shares: "", price: "", amount: "", date: new Date().toISOString().slice(0, 10) });
  const [showTxHistory, setShowTxHistory] = useState(false); // transaction history panel
  const [expandedHolding, setExpandedHolding] = useState(null); // mobile holdings expand
  const [expandedMetric, setExpandedMetric] = useState(null); // mobile metrics expand
  const [newsMode, setNewsMode] = useState("holdings"); // "holdings" | "broad"
  const [broadNews, setBroadNews] = useState([]);
  // Performance tab state
  const [perfData, setPerfData] = useState(null); // { portfolio: [...], benchmarks: { SPY: [...], ... }, holdings: {}, cash: 0 }
  const [perfRange, setPerfRange] = useState("ALL"); // "1Y" | "3Y" | "5Y" | "10Y" | "ALL"
  const [perfHover, setPerfHover] = useState(null); // { idx, x, y } for tooltip
  const [perfLoading, setPerfLoading] = useState(false);
  const [perfBmToggles, setPerfBmToggles] = useState({ IWS: true, DVY: true, SPY: false, DIA: false });
  const [liveValue, setLiveValue] = useState(null); // { value, stocks, cash } — live portfolio total from WebSocket
  const [intradayPortfolio, setIntradayPortfolio] = useState({}); // { "1D": [{date, value}], "1W": [...], "1M": [...] }
  const [intradayBenchmarks, setIntradayBenchmarks] = useState({}); // { "1D": { SPY: [{date, close}], ... }, "1W": ..., "1M": ... }
  const perfSvgRef = useRef(null);
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
  const quotesRef = useRef({});
  const barsRef = useRef({});

  const fetchData = useCallback(async (showLoading = false) => {
    if (!apiKey || !apiSecret) return;
    if (showLoading) setLoading(true);
    try {
      const allSyms = [...ALL, ...IEX_BM];
      const r = await fetch(`${BASE}/v2/stocks/snapshots?symbols=${allSyms.join(",")}&feed=iex`, { headers: hdrs });
      if (!r.ok) throw new Error("fail");
      const d = await r.json();
      const nq = {}, nb = {};
      for (const [s, snap] of Object.entries(d)) {
        if (snap.latestTrade) nq[s] = { p: snap.latestTrade.p, t: snap.latestTrade.t };
        if (snap.dailyBar) nb[s] = { o: snap.dailyBar.o, h: snap.dailyBar.h, l: snap.dailyBar.l, c: snap.dailyBar.c, v: snap.dailyBar.v, vw: snap.dailyBar.vw };
        if (snap.prevDailyBar) { if (!nb[s]) nb[s] = {}; nb[s].pc = snap.prevDailyBar.c; }
      }
      // Non-IEX benchmarks: use Finnhub on first load, then rely on poller + cached refs
      const isFirstFetch = Object.keys(quotesRef.current).length === 0;
      if (isFirstFetch && FH) {
        await Promise.all(NON_IEX_BM.map(async (s) => {
          try {
            const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${s}&token=${FH}`);
            if (r.ok) {
              const q = await r.json();
              if (q.c) nq[s] = { p: q.c, t: new Date().toISOString() };
              if (q.pc) nb[s] = { ...nb[s], pc: q.pc, o: q.o, h: q.h, l: q.l, c: q.c };
            }
          } catch {}
        }));
      }
      // Fill from cached refs (kept fresh by Finnhub poller)
      for (const s of NON_IEX_BM) {
        if (!nq[s] && quotesRef.current[s]) nq[s] = quotesRef.current[s];
        if (!nb[s]?.pc && barsRef.current[s]?.pc) nb[s] = { ...nb[s], ...barsRef.current[s] };
      }
      

      const prevQ = quotesRef.current;
      const prevB = barsRef.current;
      const isFirstLoad = Object.keys(prevQ).length === 0;

      // Direct DOM updates for prices — no React re-render needed
      const hmColor = (chg) => {
        const maxA = 5;
        const intensity = Math.min(Math.abs(chg) / maxA, 1);
        if (chg > 0) return `rgb(${Math.round(14+intensity*8)},${Math.round(24+intensity*90)},${Math.round(20+intensity*35)})`;
        if (chg < 0) return `rgb(${Math.round(40+intensity*130)},${Math.round(14+intensity*12)},${Math.round(18+intensity*14)})`;
        return C.card;
      };
      const flashes = {};
      let anyQuoteChanged = false;
      for (const s of Object.keys(nq)) {
        const priceChanged = prevQ[s] && nq[s] && prevQ[s].p !== nq[s].p;
        if (priceChanged) {
          anyQuoteChanged = true;
          flashes[s] = nq[s].p > prevQ[s].p ? "up" : "dn";
        }
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
          const priceEl = document.querySelector(`[data-ticker-price="${s}"]`);
          if (priceEl) priceEl.textContent = `$${nq[s].p.toFixed(2)}`;
          // Heatmap cell
          const hmChg = document.querySelector(`[data-heatmap-chg="${s}"]`);
          if (hmChg) hmChg.textContent = `${c >= 0 ? "+" : ""}${c.toFixed(1)}%`;
          const hmCell = document.querySelector(`[data-heatmap="${s}"]`);
          if (hmCell) {
            hmCell.style.background = hmColor(c);
            // Flash on price change
            if (priceChanged) {
              hmCell.style.transition = "none";
              hmCell.style.boxShadow = c >= 0 ? `inset 0 0 20px rgba(52,211,153,0.5)` : `inset 0 0 20px rgba(248,113,113,0.5)`;
              hmCell.style.filter = "brightness(1.4)";
              setTimeout(() => {
                if (hmCell) {
                  hmCell.style.transition = "all 0.6s ease-out";
                  hmCell.style.boxShadow = "none";
                  hmCell.style.filter = "brightness(1)";
                }
              }, 500);
            }
          }
          // Metrics Day column
          const metDay = document.querySelector(`[data-metric-day="${s}"]`);
          if (metDay) {
            metDay.textContent = `${c >= 0 ? "+" : ""}${c.toFixed(2)}%`;
            metDay.style.color = c > 0 ? C.up : c < 0 ? C.dn : C.t3;
          }
          // Benchmark price + change
          const bmEl = document.querySelector(`[data-bm-price="${s}"]`);
          if (bmEl) bmEl.textContent = nq[s].p.toFixed(2);
          const bmChgEl = document.querySelector(`[data-bm-chg="${s}"]`);
          if (bmChgEl) {
            bmChgEl.textContent = `${c >= 0 ? "+" : ""}${c.toFixed(2)}%`;
            bmChgEl.style.color = c > 0 ? C.up : c < 0 ? C.dn : C.t3;
          }
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

      if (isFirstLoad || showLoading) {
        const pq = {}, pb = {}, bmq = {}, bmb = {};
        for (const s of Object.keys(nq)) {
          if (BM_SYMS.includes(s)) bmq[s] = nq[s]; else pq[s] = nq[s];
        }
        for (const s of Object.keys(nb)) {
          if (BM_SYMS.includes(s)) bmb[s] = nb[s]; else pb[s] = nb[s];
        }
        setQuotes(pq); setBars(pb); setBmQuotes(prev => ({ ...prev, ...bmq })); setBmBars(prev => ({ ...prev, ...bmb }));
      }

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
      const start = new Date();
      start.setDate(start.getDate() - 2);
      const startStr = start.toISOString().split("T")[0];
      const today = new Date().toISOString().split("T")[0];
      const r = await fetch(`${BASE}/v2/stocks/bars?symbols=${ALL.join(",")}&timeframe=5Min&start=${startStr}T04:00:00Z&feed=iex&limit=10000`, { headers: hdrs });
      if (!r.ok) return;
      const d = await r.json();
      const pts = {};
      if (d.bars) {
        for (const [s, barArr] of Object.entries(d.bars)) {
          const todayBars = barArr.filter(b => b.t.startsWith(today)).map(b => b.c);
          const allCloses = barArr.map(b => b.c);
          if (todayBars.length >= 5) {
            pts[s] = todayBars;
          } else {
            pts[s] = allCloses.length > 78 ? allCloses.slice(-78) : allCloses;
          }
        }
      }
      // Stocks missing from IEX intraday — fetch 30-day daily bars as sparkline fallback
      const missing = ALL.filter(s => !pts[s] || pts[s].length < 2);
      if (missing.length > 0) {
        // Try Alpaca daily bars without feed restriction
        try {
          const d30 = new Date(); d30.setDate(d30.getDate() - 35);
          const dailyR = await fetch(`${BASE}/v2/stocks/bars?symbols=${missing.join(",")}&timeframe=1Day&start=${d30.toISOString().slice(0,10)}&limit=30&adjustment=split`, { headers: hdrs });
          if (dailyR.ok) {
            const dailyD = await dailyR.json();
            if (dailyD.bars) {
              for (const [s, barArr] of Object.entries(dailyD.bars)) {
                if (barArr.length >= 2) pts[s] = barArr.map(b => b.c);
              }
            }
          }
        } catch {}
      }
      // Still missing — use Finnhub candles as final fallback
      const stillMissing = ALL.filter(s => !pts[s] || pts[s].length < 2);
      if (stillMissing.length > 0 && FH) {
        const now = Math.floor(Date.now() / 1000);
        const from = now - 30 * 86400;
        for (const s of stillMissing) {
          try {
            const r = await fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${s}&resolution=D&from=${from}&to=${now}&token=${FH}`);
            if (r.ok) {
              const d = await r.json();
              if (d.s === "ok" && d.c && d.c.length >= 2) {
                pts[s] = d.c;
              }
            }
          } catch {}
        }
      }
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
  const [rtContacts, setRtContacts] = useState([]);
  const [rtActivities, setRtActivities] = useState([]);
  const [rtCalendar, setRtCalendar] = useState([]);
  const [rtSearch, setRtSearch] = useState("");
  const [rtLoading, setRtLoading] = useState(false);
  const [rtTab, setRtTab] = useState("contacts"); // contacts | tasks | calendar
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
        let profileIndustry = null, profileSector = null, profileName = null, profileLogo = null;
        if (profR?.ok) {
          const prof = await profR.json();
          profileIndustry = prof?.finnhubIndustry || null;
          profileName = prof?.name || null;
          profileLogo = prof?.logo || null;
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
          logo: profileLogo,
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
      
      // PRIMARY: FairEconomy — free, reliable, includes actuals
      const ffUrls = [
        "https://nfs.faireconomy.media/ff_calendar_thisweek.json",
        "https://nfs.faireconomy.media/ff_calendar_nextweek.json",
      ];
      try {
        const [thisR, nextR] = await Promise.all(ffUrls.map(u => fetch(u).catch(() => null)));
        const thisW = thisR?.ok ? await thisR.json() : [];
        const nextW = nextR?.ok ? await nextR.json() : [];
        const combined = [...(Array.isArray(thisW) ? thisW : []), ...(Array.isArray(nextW) ? nextW : [])];
        const usEvents = combined.filter(e => e.country === "USD" && (e.impact === "High" || e.impact === "Medium"));
        if (usEvents.length > 0) {
          events = usEvents;
          try { localStorage.setItem("iown_econ_calendar", JSON.stringify(usEvents)); } catch {}
        }
      } catch {}
      
      // ACTUALS OVERLAY: Finnhub economic calendar (faster actuals than FairEconomy)
      if (events.length > 0 && FH) {
        try {
          const today = new Date();
          const localDay = today.getDay();
          const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (localDay === 0 ? 6 : localDay - 1));
          const friday = new Date(monday); friday.setDate(friday.getDate() + 4);
          const fhUrl = `https://finnhub.io/api/v1/calendar/economic?from=${monday.toISOString().slice(0,10)}&to=${friday.toISOString().slice(0,10)}&token=${FH}`;
          const r = await fetch(fhUrl).catch(() => null);
          if (r?.ok) {
            const data = await r.json();
            const fhEvents = data?.economicCalendar || data?.result || [];
            if (Array.isArray(fhEvents) && fhEvents.length > 0) {
              const norm = (t) => (t || "").toLowerCase().replace(/[^a-z0-9]/g, "");
              const fhByDate = {};
              fhEvents.filter(e => e.country === "US" && e.actual != null && String(e.actual).trim() !== "").forEach(e => {
                const d = (e.time || e.date || "").slice(0, 10);
                if (!fhByDate[d]) fhByDate[d] = [];
                fhByDate[d].push(e);
              });
              let filled = 0;
              events = events.map(e => {
                if (e.actual && String(e.actual).trim()) return e; // Already has actual
                const d = (e.date || "").slice(0, 10);
                const candidates = fhByDate[d] || [];
                const nt = norm(e.title);
                let match = candidates.find(c => norm(c.event) === nt);
                if (!match) match = candidates.find(c => { const cn = norm(c.event); return nt.includes(cn) || cn.includes(nt); });
                if (!match) match = candidates.find(c => norm(c.event).slice(0, 10) === nt.slice(0, 10));
                if (match) { filled++; return { ...e, actual: String(match.actual) }; }
                return e;
              });
              if (filled > 0) console.log(`Calendar: filled ${filled} actuals from Finnhub`);
            }
          }
        } catch {}
      }
      
      // FALLBACK 1: FMP economic calendar (if FairEconomy failed)
      if (events.length === 0 && FK) {
        try {
          const today = new Date();
          const localDay = today.getDay();
          const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (localDay === 0 ? 6 : localDay - 1));
          const endDate = new Date(monday); endDate.setDate(endDate.getDate() + 13);
          const fmpUrl = `https://financialmodelingprep.com/api/v3/economic_calendar?from=${monday.toISOString().slice(0,10)}&to=${endDate.toISOString().slice(0,10)}&apikey=${FK}`;
          const r = await fetch(fmpUrl).catch(() => null);
          if (r?.ok) {
            const data = await r.json();
            if (Array.isArray(data)) {
              events = data
                .filter(e => e.country === "US" && ["high","medium"].includes((e.impact||"").toLowerCase()))
                .map(e => ({
                  title: e.event, date: e.date, country: "USD",
                  impact: (e.impact || "").charAt(0).toUpperCase() + (e.impact || "").slice(1).toLowerCase(),
                  actual: e.actual != null ? String(e.actual) : "",
                  previous: e.previous != null ? String(e.previous) : "",
                  forecast: e.estimate != null ? String(e.estimate) : "",
                }));
              if (events.length > 0) try { localStorage.setItem("iown_econ_calendar", JSON.stringify(events)); } catch {}
            }
          }
        } catch {}
      }
      
      // FALLBACK 2: Static JSON from GitHub (cached by GitHub Action)
      if (events.length === 0) {
        const cacheBust = `?t=${Math.floor(Date.now() / 60000)}`;
        for (const url of [
          `${import.meta.env.BASE_URL || "/"}economic-calendar.json${cacheBust}`,
          `https://raw.githubusercontent.com/richacarson/Dashboard/main/public/economic-calendar.json${cacheBust}`,
        ]) {
          try {
            const r = await fetch(url).catch(() => null);
            if (r?.ok) { const data = await r.json(); if (Array.isArray(data) && data.length > 0) { events = data; break; } }
          } catch {}
        }
      }
      
      // FALLBACK 3: localStorage cache (last resort)
      if (events.length === 0) {
        try {
          const cached = localStorage.getItem("iown_econ_calendar");
          if (cached) events = JSON.parse(cached);
        } catch {}
      }
      
      events.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
      setEconCalendar(events);
    } catch (e) { console.warn("Econ calendar fetch failed:", e.message); }

    // Earnings: merge FMP + Finnhub for best coverage
    const today = new Date();
    const from = new Date(today); from.setDate(from.getDate() - 7);
    const to = new Date(today); to.setDate(to.getDate() + 60);
    const fmt = d => d.toISOString().slice(0, 10);
    const earningsMap = {}; // key: symbol|date → merged earnings object

    // Finnhub first (broader coverage)
    const fhKey = FH || FK;
    if (fhKey) {
      try {
        const r = await fetch(`https://finnhub.io/api/v1/calendar/earnings?from=${fmt(from)}&to=${fmt(to)}&token=${fhKey}`);
        if (r.ok) {
          const data = await r.json();
          const raw = data.earningsCalendar || data.result || data.data || [];
          const list = Array.isArray(raw) ? raw : (raw.result || raw.data || []);
          list.filter(e => coreSyms.includes(e.symbol)).forEach(e => {
            const key = `${e.symbol}|${e.date}`;
            earningsMap[key] = {
              symbol: e.symbol, date: e.date, hour: e.hour || "",
              epsEstimate: e.epsEstimate ?? e.estimate ?? null,
              epsActual: e.epsActual ?? null,
              revenueEstimate: e.revenueEstimate ?? null,
              revenueActual: e.revenueActual ?? null,
            };
          });
        }
      } catch (e) { console.warn("Finnhub earnings:", e.message); }
    }

    // FMP overlay (better estimates, persists after reporting)
    if (FK) {
      try {
        const r = await fetch(`https://financialmodelingprep.com/api/v3/earning_calendar?from=${fmt(from)}&to=${fmt(to)}&apikey=${FK}`);
        if (r.ok) {
          const data = await r.json();
          if (Array.isArray(data)) {
            data.filter(e => coreSyms.includes(e.symbol)).forEach(e => {
              const key = `${e.symbol}|${e.date}`;
              const existing = earningsMap[key] || { symbol: e.symbol, date: e.date, hour: "" };
              // FMP overrides: fill in any missing fields
              if (e.epsEstimated != null) existing.epsEstimate = e.epsEstimated;
              if (e.eps != null) existing.epsActual = e.eps;
              if (e.revenueEstimated != null) existing.revenueEstimate = e.revenueEstimated;
              if (e.revenue != null) existing.revenueActual = e.revenue;
              if (e.time) existing.hour = e.time === "bmo" ? "bmo" : e.time === "amc" ? "amc" : e.time;
              earningsMap[key] = existing;
            });
          }
        }
      } catch (e) { console.warn("FMP earnings:", e.message); }
    }

    let earnings = Object.values(earningsMap).sort((a, b) => (a.date || "").localeCompare(b.date || ""));

    // Cache estimates in localStorage
    let cache = {};
    try { cache = JSON.parse(localStorage.getItem("iown_earnings_est") || "{}"); } catch {}
    for (const e of earnings) {
      const key = `${e.symbol}|${e.date}`;
      if (e.epsEstimate != null) cache[key] = { eps: e.epsEstimate, rev: e.revenueEstimate };
      else if (cache[key]) {
        e.epsEstimate = cache[key].eps;
        if (e.revenueEstimate == null) e.revenueEstimate = cache[key].rev;
      }
    }
    try { localStorage.setItem("iown_earnings_est", JSON.stringify(cache)); } catch {}

    setEarningsCalendar(earnings);
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
            ws.send(JSON.stringify({ action: "subscribe", trades: [...ALL, ...IEX_BM] }));
          }
          if (msg.T === "t" && msg.S && msg.p) {
            // All symbols (portfolio + benchmarks) in same refs
            const prev = quotesRef.current[msg.S];
            quotesRef.current[msg.S] = { p: msg.p, t: msg.t };
            const pc = barsRef.current[msg.S]?.pc;
            if (pc) {
              const c = ((msg.p - pc) / pc) * 100;
              // Ticker row change badge (portfolio)
              const el = document.querySelector(`[data-ticker-chg="${msg.S}"]`);
              if (el) {
                el.textContent = `${c >= 0 ? "+" : ""}${c.toFixed(2)}%`;
                el.style.color = c > 0 ? C.up : c < 0 ? C.dn : C.t3;
                el.style.borderColor = c > 0 ? C.up + "55" : c < 0 ? C.dn + "55" : C.border;
              }
              const priceEl = document.querySelector(`[data-ticker-price="${msg.S}"]`);
              if (priceEl) priceEl.textContent = `$${msg.p.toFixed(2)}`;
              // Benchmark
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
                hmCell.style.background = c > 0 ? `rgb(${Math.round(14+intensity*8)},${Math.round(24+intensity*90)},${Math.round(20+intensity*35)})` : c < 0 ? `rgb(${Math.round(40+intensity*130)},${Math.round(14+intensity*12)},${Math.round(18+intensity*14)})` : C.card;
                // Flash only if price actually changed from previous
                if (prev && prev.p !== msg.p) {
                  hmCell.style.transition = "none";
                  hmCell.style.boxShadow = c >= 0 ? `inset 0 0 20px rgba(52,211,153,0.5)` : `inset 0 0 20px rgba(248,113,113,0.5)`;
                  hmCell.style.filter = "brightness(1.4)";
                  setTimeout(() => {
                    if (hmCell) {
                      hmCell.style.transition = "all 0.6s ease-out";
                      hmCell.style.boxShadow = "none";
                      hmCell.style.filter = "brightness(1)";
                    }
                  }, 500);
                }
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

  // Finnhub REST polling for non-IEX benchmarks (every 5s)
  const fhTimerRef = useRef(null);
  const pollFinnhubBenchmarks = useCallback(async () => {
    if (!FH) return;
    const batchQ = {}, batchB = {};
    for (const sym of NON_IEX_BM) {
      try {
        const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${FH}`);
        if (!r.ok) continue;
        const q = await r.json();
        if (!q.c) continue;
        const price = q.c;
        const pc = q.pc || barsRef.current[sym]?.pc;
        // Update refs
        const quoteVal = { p: price, t: new Date().toISOString() };
        quotesRef.current[sym] = quoteVal;
        batchQ[sym] = quoteVal;
        if (pc) {
          const barVal = { ...barsRef.current[sym], pc };
          barsRef.current[sym] = barVal;
          batchB[sym] = barVal;
        }
        // DOM updates
        const bmEl = document.querySelector(`[data-bm-price="${sym}"]`);
        if (bmEl) bmEl.textContent = price.toFixed(2);
        if (pc) {
          const c = ((price - pc) / pc) * 100;
          const bmChgEl = document.querySelector(`[data-bm-chg="${sym}"]`);
          if (bmChgEl) {
            bmChgEl.textContent = `${c >= 0 ? "+" : ""}${c.toFixed(2)}%`;
            bmChgEl.style.color = c > 0 ? C.up : c < 0 ? C.dn : C.t3;
          }
        }
      } catch {}
    }
    // Sync React state so re-renders don't revert to stale values
    if (Object.keys(batchQ).length) setBmQuotes(prev => ({ ...prev, ...batchQ }));
    if (Object.keys(batchB).length) setBmBars(prev => ({ ...prev, ...batchB }));
  }, []);
  const startFinnhubPolling = useCallback(() => {
    pollFinnhubBenchmarks();
    fhTimerRef.current = setInterval(pollFinnhubBenchmarks, 5000);
  }, [pollFinnhubBenchmarks]);

  // ── Performance tab: fetch portfolio history + benchmark bars ──
  const fetchPerfData = useCallback(async () => {
    if (perfData || perfLoading) return;
    setPerfLoading(true);
    try {
      // Load portfolio history JSON
      const pRes = await fetch(`${import.meta.env.BASE_URL}portfolio-history-dividend.json`);
      if (!pRes.ok) throw new Error("No portfolio history");
      const pJson = await pRes.json();
      const portfolio = pJson.portfolio || [];
      if (!portfolio.length) { setPerfLoading(false); return; }

      // Use pre-computed benchmarks from JSON if available, otherwise fetch live
      const bmSyms = ["IWS", "DVY", "SPY", "DIA"];
      const startDate = portfolio[0].date;
      const jsonBm = pJson.benchmarks || {};
      const hasPrebaked = bmSyms.some(s => Array.isArray(jsonBm[s]) && jsonBm[s].length > 10);

      let benchmarks = {};

      if (hasPrebaked) {
        // Convert pre-computed array format to date->price map for chart
        for (const sym of bmSyms) {
          if (Array.isArray(jsonBm[sym])) {
            benchmarks[sym] = {};
            jsonBm[sym].forEach(pt => { benchmarks[sym][pt.date] = pt.close; });
          }
        }
      } else if (apiKey && apiSecret) {
        // Fetch live from Alpaca in yearly chunks
        for (const sym of bmSyms) {
          benchmarks[sym] = {};
          let yearStart = new Date(startDate);
          const end = new Date();
          while (yearStart < end) {
            const yearEnd = new Date(Math.min(yearStart.getTime() + 365 * 24 * 60 * 60 * 1000, end.getTime()));
            const alpacaEnd = new Date(Math.min(yearEnd.getTime(), new Date("2024-12-31").getTime()));
            if (yearStart <= alpacaEnd) {
              try {
                const url = `${BASE}/v2/stocks/bars?symbols=${sym}&timeframe=1Week&start=${yearStart.toISOString().slice(0,10)}&end=${alpacaEnd.toISOString().slice(0,10)}&limit=10000&adjustment=split`;
                const r = await fetch(url, { headers: hdrs });
                if (r.ok) {
                  const d = await r.json();
                  if (d.bars?.[sym]) d.bars[sym].forEach(b => { benchmarks[sym][b.t.slice(0,10)] = b.c; });
                }
              } catch {}
            }
            yearStart = yearEnd;
          }
        }

        // Polygon for 2024+ if env key available
        const polyKey = import.meta.env.VITE_POLYGON_KEY;
        if (polyKey) {
          for (const sym of bmSyms) {
            try {
              const url = `https://api.polygon.io/v2/aggs/ticker/${sym}/range/1/week/2024-01-01/${new Date().toISOString().slice(0,10)}?adjusted=true&sort=asc&limit=50000&apiKey=${polyKey}`;
              const r = await fetch(url);
              if (r.ok) {
                const d = await r.json();
                if (d.results) d.results.forEach(b => { benchmarks[sym][new Date(b.t).toISOString().slice(0,10)] = b.c; });
              }
            } catch {}
          }
        }
      }

      setPerfData({ portfolio, benchmarks, startBalance: pJson.start_balance || 100000, holdings: pJson.holdings || {}, cash: pJson.cash || 0, costBasis: pJson.cost_basis || {}, transactions: pJson.transactions || [], annualReturns: pJson.annual_returns || {}, bmAnnualReturns: pJson.bm_annual_returns || {} });
    } catch (e) {
      console.error("Performance fetch error:", e);
    }
    setPerfLoading(false);
  }, [perfData, perfLoading, apiKey, apiSecret, hdrs]);

  // Load perf data when tab is opened
  useEffect(() => {
    if ((tab === "performance" || tab === "home") && authed && !perfData && !perfLoading) fetchPerfData();
  }, [tab, authed, perfData, perfLoading, fetchPerfData]);

  // Compute live portfolio value from WebSocket prices every 2s
  useEffect(() => {
    if (!perfData?.holdings || !authed) return;
    const calc = () => {
      const h = perfData.holdings;
      const cash = perfData.cash || 0;
      let stocks = 0, priced = 0, total = Object.keys(h).length;
      for (const [ticker, shares] of Object.entries(h)) {
        const q = quotesRef.current[ticker];
        if (q && q.p > 0) { stocks += shares * q.p; priced++; }
      }
      // Only update if we have prices for most holdings and value actually changed
      if (priced >= total * 0.8) {
        const newVal = Math.round((stocks + cash) * 100) / 100;
        const newStocks = Math.round(stocks * 100) / 100;
        setLiveValue(prev => {
          if (prev && prev.value === newVal && prev.stocks === newStocks && prev.cash === cash && prev.holdings === total) return prev;
          return { value: newVal, stocks: newStocks, cash, holdings: total };
        });
      }
    };
    calc(); // Initial
    const t = setInterval(calc, 2000);
    return () => clearInterval(t);
  }, [perfData, authed]);

  // Fetch intraday bars for 1D (5min), 1W (30min), 1M (4hr) portfolio chart
  useEffect(() => {
    if (!perfData?.holdings || !authed || !apiKey) return;
    const holdings = perfData.holdings;
    const cash = perfData.cash || 0;
    const tickers = Object.keys(holdings);
    if (!tickers.length) return;

    const fetchIntraday = async (timeframe, startDate, key) => {
      try {
        // Alpaca limits symbols per request; chunk if needed
        const allBars = {};
        for (let i = 0; i < tickers.length; i += 30) {
          const chunk = tickers.slice(i, i + 30);
          const url = `${BASE}/v2/stocks/bars?symbols=${chunk.join(",")}&timeframe=${timeframe}&start=${startDate}&limit=10000&adjustment=split&feed=iex`;
          const r = await fetch(url, { headers: hdrs });
          if (!r.ok) continue;
          const d = await r.json();
          if (d.bars) {
            for (const [sym, bars] of Object.entries(d.bars)) {
              allBars[sym] = (allBars[sym] || []).concat(bars);
            }
          }
        }

        // Collect all unique timestamps and sort
        const tsSet = new Set();
        for (const bars of Object.values(allBars)) {
          bars.forEach(b => tsSet.add(b.t));
        }
        const timestamps = [...tsSet].sort();
        if (!timestamps.length) return [];

        // Seed lastPrice with previous close so all holdings are valued from the start
        const lastPrice = {};
        for (const ticker of tickers) {
          const pc = barsRef.current[ticker]?.pc;
          if (pc) lastPrice[ticker] = pc;
        }

        // For each timestamp, compute portfolio value = sum(shares × close) + cash
        const portfolioPoints = [];
        for (const ts of timestamps) {
          for (const [sym, bars] of Object.entries(allBars)) {
            const bar = bars.find(b => b.t === ts);
            if (bar) lastPrice[sym] = bar.c;
          }
          let stocks = 0;
          let priced = 0;
          for (const [ticker, shares] of Object.entries(holdings)) {
            if (lastPrice[ticker]) { stocks += shares * lastPrice[ticker]; priced++; }
          }
          // Only include points where we have prices for most holdings
          if (priced >= tickers.length * 0.8) {
            portfolioPoints.push({
              date: ts,
              value: Math.round((stocks + cash) * 100) / 100,
              stocks: Math.round(stocks * 100) / 100,
              cash,
            });
          }
        }
        return portfolioPoints;
      } catch (e) {
        console.error(`Intraday fetch error (${key}):`, e);
        return [];
      }
    };

    const run = async () => {
      const now = new Date();
      // 1D: 5Min bars, start from today 4AM ET (or yesterday if before market open)
      const d1 = new Date(now); d1.setDate(d1.getDate() - 2);
      const d1Start = d1.toISOString().slice(0, 10) + "T04:00:00Z";

      // 1W: 30Min bars, last 7 days
      const d7 = new Date(now); d7.setDate(d7.getDate() - 8);
      const d7Start = d7.toISOString().slice(0, 10) + "T04:00:00Z";

      // 1M: 1Day bars, last 30 days
      const d30 = new Date(now); d30.setDate(d30.getDate() - 32);
      const d30Start = d30.toISOString().slice(0, 10);

      const [pts1DRaw, pts1W, pts1M] = await Promise.all([
        fetchIntraday("1Min", d1Start, "1D"),
        fetchIntraday("30Min", d7Start, "1W"),
        fetchIntraday("1Day", d30Start, "1M"),
      ]);

      // For 1D, only keep the most recent trading session
      let pts1D = pts1DRaw;
      if (pts1DRaw.length > 1) {
        // Find the last trading day in the data
        const lastDate = pts1DRaw[pts1DRaw.length - 1].date.slice(0, 10);
        pts1D = pts1DRaw.filter(p => p.date.slice(0, 10) === lastDate);
        // If no points for last date (e.g. weekend), use all
        if (pts1D.length < 2) pts1D = pts1DRaw;
      }

      setIntradayPortfolio({ "1D": pts1D, "1W": pts1W, "1M": pts1M });

      // Fetch intraday benchmark bars
      // IEX benchmarks (SPY, DIA) via Alpaca
      const iexBmSyms = ["SPY", "DIA"];
      const fetchBmBars = async (syms, timeframe, startDate) => {
        try {
          const url = `${BASE}/v2/stocks/bars?symbols=${syms.join(",")}&timeframe=${timeframe}&start=${startDate}&limit=10000&adjustment=split&feed=iex`;
          const r = await fetch(url, { headers: hdrs });
          if (!r.ok) return {};
          const d = await r.json();
          const result = {};
          if (d.bars) {
            for (const [sym, bars] of Object.entries(d.bars)) {
              result[sym] = bars.map(b => ({ date: b.t, close: b.c }));
            }
          }
          return result;
        } catch { return {}; }
      };
      // Non-IEX benchmarks (DVY, IWS) via Finnhub candles
      const fhBmSyms = ["DVY", "IWS"];
      const fetchFhBmBars = async (resolution, from) => {
        if (!FH) return {};
        const result = {};
        const fromTs = Math.floor(new Date(from).getTime() / 1000);
        const toTs = Math.floor(Date.now() / 1000);
        for (const sym of fhBmSyms) {
          try {
            const url = `https://finnhub.io/api/v1/stock/candle?symbol=${sym}&resolution=${resolution}&from=${fromTs}&to=${toTs}&token=${FH}`;
            const r = await fetch(url);
            if (!r.ok) continue;
            const d = await r.json();
            if (d.s === "ok" && d.t && d.c) {
              result[sym] = d.t.map((t, i) => ({ date: new Date(t * 1000).toISOString(), close: d.c[i] }));
            }
          } catch {}
        }
        return result;
      };

      const [iex1DRaw, iex1W, iex1M, fh1DRaw, fh1W, fh1M] = await Promise.all([
        fetchBmBars(iexBmSyms, "1Min", d1Start),
        fetchBmBars(iexBmSyms, "30Min", d7Start),
        fetchBmBars(iexBmSyms, "1Day", d30Start),
        fetchFhBmBars("1", d1Start),
        fetchFhBmBars("30", d7Start),
        fetchFhBmBars("D", d30Start),
      ]);
      const bm1DRaw = { ...iex1DRaw, ...fh1DRaw };
      const bm1W = { ...iex1W, ...fh1W };
      const bm1M = { ...iex1M, ...fh1M };

      // Filter benchmark 1D bars to same trading day as portfolio
      const lastPortDate = pts1D.length ? pts1D[pts1D.length - 1].date.slice(0, 10) : null;
      const bm1D = {};
      for (const [sym, bars] of Object.entries(bm1DRaw)) {
        bm1D[sym] = lastPortDate ? bars.filter(b => b.date.slice(0, 10) === lastPortDate) : bars;
      }

      setIntradayBenchmarks({ "1D": bm1D, "1W": bm1W, "1M": bm1M });
    };

    run();
    // Refresh intraday data every 60 seconds
    const t = setInterval(run, 60000);
    return () => clearInterval(t);
  }, [perfData, authed, apiKey]);

  // GitHub API: commit transaction to repo so all users see it
  const GH_REPO = "richacarson/Dashboard";
  const GH_TX_PATH = "transactions/user_transactions.json";
  const commitTransaction = useCallback(async (newTx) => {
    if (!ghToken) return;
    try {
      // Get current file (may not exist yet)
      const ghHeaders = { Authorization: `token ${ghToken}`, Accept: "application/vnd.github.v3+json" };
      let existing = [], sha = null;
      try {
        const r = await fetch(`https://api.github.com/repos/${GH_REPO}/contents/${GH_TX_PATH}`, { headers: ghHeaders });
        if (r.ok) {
          const d = await r.json();
          sha = d.sha;
          existing = JSON.parse(atob(d.content));
        }
      } catch {}
      existing.unshift({ ...newTx, id: Date.now() });
      // Commit updated file
      const body = { message: `Add ${newTx.type} transaction${newTx.ticker ? ` for ${newTx.ticker}` : ""}`, content: btoa(JSON.stringify(existing, null, 2)) };
      if (sha) body.sha = sha;
      await fetch(`https://api.github.com/repos/${GH_REPO}/contents/${GH_TX_PATH}`, { method: "PUT", headers: { ...ghHeaders, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } catch (e) { console.error("GitHub commit failed:", e); }
  }, [ghToken]);

  const auth = async () => {
    setAuthErr("");
    try {
      const r = await fetch(`${PAPER}/v2/account`, { headers: hdrs });
      if (!r.ok) throw new Error("fail");
      setAuthed(true);
      fetchData(true);
      fetchNames();
      fetchNews();
      fetchFundamentals();
      fetchCalendar();
      // Preload ExcelJS for export
      if (!window.ExcelJS) { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js"; document.head.appendChild(s); }
      connectWS();
      startFinnhubPolling();
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
      // Calendar refresh every 5 min to pick up actuals
      const calTimer = setInterval(() => { fetchCalendar(); }, 300000);
      return () => { clearInterval(iRef.current); clearInterval(newsTimer); clearInterval(calTimer); clearInterval(fhTimerRef.current); };
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
          <img src={theme === "dark" ? "iown-logo-dark.png" : "iown-logo.png"} alt="IOWN" style={{ width: 240, height: "auto", margin: "0 auto 28px", display: "block" }} />
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
            <input type="password" value={apiSecret} onChange={e => setApiSecret(e.target.value)} placeholder="APCA-API-SECRET-KEY" style={{ width: "100%", padding: "16px 18px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, color: C.t1, fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 20, fontFamily: "inherit" }} />
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t3, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>GitHub Token <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional — for saving transactions)</span></label>
            <input type="password" value={ghToken} onChange={e => setGhToken(e.target.value)} placeholder="ghp_..." style={{ width: "100%", padding: "16px 18px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, color: C.t1, fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 28, fontFamily: "inherit" }} />
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
    const price = q?.p;
    const shortName = nm;
    return (
      <div key={s} {...stockContextHandlers(s)} className="ticker-row"
        style={{ display: "flex", alignItems: "center", padding: "14px 0", cursor: "pointer", overflow: "hidden" }}>
        <div style={{ marginRight: 10, flexShrink: 0, width: 34, height: 34 }}>
          <StockLogo symbol={s} size={34} logoUrl={fundamentals[s]?.logo} />
        </div>
        <div style={{ flex: 1, minWidth: 0, overflow: "hidden", marginRight: 6 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.t1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s}</div>
          <div style={{ fontSize: 11, color: C.t4, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{shortName}</div>
        </div>
        <div data-ticker-price={s} style={{ fontSize: isDesktop ? 15 : 13, fontWeight: 600, color: C.t2, marginRight: isDesktop ? 10 : 6, fontVariantNumeric: "tabular-nums", width: isDesktop ? 80 : 62, textAlign: "right", flexShrink: 0 }}>{price != null ? `$${price.toFixed(2)}` : ""}</div>
        <div data-ticker-chg={s} style={{
          padding: "6px 0", borderRadius: 6, width: isDesktop ? 80 : 62, textAlign: "center",
          fontSize: isDesktop ? 14 : 12, fontWeight: 700, fontVariantNumeric: "tabular-nums",
          color: c > 0 ? C.up : c < 0 ? C.dn : C.t3,
          border: `1px solid ${c > 0 ? C.up + "55" : c < 0 ? C.dn + "55" : C.border}`,
          transition: "background 0.6s ease-out", flexShrink: 0,
        }}>{pct(c)}</div>
      </div>
    );
  };

  /* ── Robinhood-style Sleeve Section (collapsible) ── */
  const renderSleeve = (k, sleeve) => {
    const isOpen = openSleeves[k];
    // Calculate value-weighted change for this sleeve (uses position sizes when available)
    const holdings = perfData?.holdings;
    let avgChg = null;
    if (holdings) {
      let totalVal = 0, weightedChgSum = 0;
      for (const sym of sleeve.symbols) {
        const c = chg(sym);
        const q = quotes[sym];
        const sh = holdings[sym];
        if (c !== null && q && sh) {
          const mv = sh * q.p;
          totalVal += mv;
          weightedChgSum += mv * c;
        }
      }
      avgChg = totalVal > 0 ? weightedChgSum / totalVal : null;
    }
    if (avgChg === null) {
      const changes = sleeve.symbols.map(chg).filter(c => c !== null);
      avgChg = changes.length ? changes.reduce((a, b) => a + b, 0) / changes.length : null;
    }
    const isAddingTicker = addTickerFor === k;

    return (
      <div>
        {/* Sleeve header row */}
        <div style={{ display: "flex", alignItems: "center", padding: "18px 0", userSelect: "none", WebkitUserSelect: "none" }}>
          {/* Edit mode: delete list button */}
          {editMode && (
            <div onClick={() => { if (confirm(`Delete "${sleeve.name}"?`)) removeList(k); }} style={{ width: 28, height: 28, borderRadius: 14, background: C.dn + "22", border: `1px solid ${C.dn}44`, display: "flex", alignItems: "center", justifyContent: "center", marginRight: 10, cursor: "pointer", flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.dn} strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
            </div>
          )}
          <div onClick={() => toggleSleeve(k)} style={{ display: "flex", alignItems: "center", flex: 1, cursor: "pointer", userSelect: "none" }}>
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
              <span data-sleeve-chg={k} style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: avgChg >= 0 ? C.up : C.dn, display: "inline-block", minWidth: 70, textAlign: "right" }}>{pct(avgChg)}</span>
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
                    <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>{ renderTickerRow(s) }</div>
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
    { id: "performance", label: "Performance", icon: (a) => <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={a ? C.t1 : C.t4} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg> },
    { id: "research", label: "Metrics", icon: (a) => <svg width="21" height="21" viewBox="0 0 24 24" fill={a ? C.accentSoft : "none"} stroke={a ? C.t1 : C.t4} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg> },
    { id: "calendar", label: "Calendar", icon: (a) => <svg width="21" height="21" viewBox="0 0 24 24" fill={a ? C.accentSoft : "none"} stroke={a ? C.t1 : C.t4} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg> },
    { id: "news", label: "News", icon: (a) => <svg width="21" height="21" viewBox="0 0 24 24" fill={a ? C.accentSoft : "none"} stroke={a ? C.t1 : C.t4} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" /><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" /></svg> },
    { id: "briefs", label: "Briefs", icon: (a) => <svg width="21" height="21" viewBox="0 0 24 24" fill={a ? C.accentSoft : "none"} stroke={a ? C.t1 : C.t4} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg> },
    { id: "clients", label: "Clients", icon: (a) => <svg width="21" height="21" viewBox="0 0 24 24" fill={a ? C.accentSoft : "none"} stroke={a ? C.t1 : C.t4} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg> },
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
            <img src={theme === "dark" ? "iown-logo-dark.png" : "iown-logo.png"} alt="IOWN" style={{ width: "80%", height: "auto" }} />
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
        background: theme === "dark" ? "rgba(12,16,24,0.88)" : "rgba(245,245,240,0.92)", backdropFilter: "blur(24px) saturate(1.2)", WebkitBackdropFilter: "blur(24px) saturate(1.2)",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Hamburger menu */}
          <button onClick={() => setMoreMenu(true)} style={{
            width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center",
            background: "transparent", border: `1px solid ${C.border}`, borderRadius: 10, cursor: "pointer",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.t2} strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
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
            {tab === "home" ? "Home" : tab === "performance" ? "Performance" : tab === "research" ? "Metrics" : tab === "calendar" ? "Calendar" : tab === "news" ? "News" : tab === "briefs" ? "Briefs" : tab === "clients" ? "Clients" : "Settings"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {lastUp && <span data-last-updated style={{ fontSize: 12, color: C.t4 }}>{lastUp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
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
              {marketStatus.status === "premarket" && "Pre-market hours — prices shown are from yesterday's close."}
              {marketStatus.status === "afterhours" && "After-hours trading — prices shown are from today's close."}
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
                      <div key={bm.sym} {...stockContextHandlers(bm.sym)} style={{
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
            {/* Holdings / Lists toggle */}
            <div style={{ display: "flex", gap: 6, marginTop: 16, marginBottom: 4 }}>
              {[{ v: "lists", l: "Lists" }, { v: "holdings", l: "Holdings" }].map(({ v, l }) => (
                <button key={v} onClick={() => setHomeView(v)} style={{
                  flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${homeView === v ? C.borderActive : C.border}`,
                  background: homeView === v ? C.accentSoft : "transparent",
                  color: homeView === v ? C.t1 : C.t3, fontSize: 14, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                }}>{l}</button>
              ))}
            </div>

            {/* ━━━ HOLDINGS VIEW ━━━ */}
            {homeView === "holdings" && perfData && (
              <div style={{ animation: "fadeIn 0.2s ease" }}>
                {/* Portfolio Summary */}
                <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(4, 1fr)" : "repeat(2, 1fr)", gap: 10, marginTop: 12, marginBottom: 16 }}>
                  {(() => {
                    const totalVal = liveValue ? liveValue.value : 0;
                    const stocksVal = liveValue ? liveValue.stocks : 0;
                    const cashVal = liveValue ? liveValue.cash : (perfData.cash || 0);
                    const holdCount = liveValue ? liveValue.holdings : Object.keys(perfData.holdings).length;
                    const startVal = perfData.portfolio?.[0]?.value || (perfData.startBalance || 100000);
                    const totalGain = totalVal - startVal;
                    const totalGainPct = startVal > 0 ? ((totalVal / startVal) - 1) * 100 : 0;
                    return [
                      { label: "Portfolio Value", value: `$${totalVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}` },
                      { label: "Cash", value: `$${cashVal.toLocaleString(undefined, { maximumFractionDigits: 2 })}` },
                      { label: "All-Time Gain/Loss", value: `${totalGain >= 0 ? "+$" : "-$"}${Math.abs(totalGain).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: totalGain >= 0 ? C.up : C.dn },
                      { label: "All-Time %", value: `${totalGainPct >= 0 ? "+" : ""}${totalGainPct.toFixed(1)}%`, color: totalGainPct >= 0 ? C.up : C.dn },
                    ];
                  })().map((s, i) => (
                    <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px" }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: C.t4, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{s.label}</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: s.color || C.t1, fontVariantNumeric: "tabular-nums" }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* Action buttons */}
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  <button onClick={() => { setShowTxModal(true); setTxForm({ type: "PURCHASE", ticker: "", shares: "", price: "", amount: "", date: new Date().toISOString().slice(0, 10) }); }} style={{
                    padding: "8px 18px", borderRadius: 10, border: `1px solid ${C.borderActive}`,
                    background: C.accentSoft, color: C.t1, fontSize: 13, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>+ Add Transaction</button>
                  <button onClick={() => setShowRebalModal(true)} style={{
                    padding: "8px 18px", borderRadius: 10, border: `1px solid ${C.border}`,
                    background: "transparent", color: C.t3, fontSize: 13, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>Rebalance</button>
                  <button onClick={() => setShowTxHistory(!showTxHistory)} style={{
                    padding: "8px 18px", borderRadius: 10, border: `1px solid ${C.border}`,
                    background: showTxHistory ? C.accentSoft : "transparent", color: showTxHistory ? C.t1 : C.t3,
                    fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                  }}>{showTxHistory ? "Hide History" : "Transaction History"}</button>
                </div>

                {/* Transaction History Panel */}
                {showTxHistory && perfData.transactions && (
                  !isDesktop ? (
                  <div style={{ maxHeight: 400, overflow: "auto", marginBottom: 16 }}>
                    {[...perfData.transactions].sort((a, b) => b.date.localeCompare(a.date)).map((tx, i) => {
                      const isStock = !!tx.ticker;
                      const typeMap = { PURCHASE: "BUY", SALE: "SELL", DIVIDEND: "DIV", DEPOSIT: "DEP", WITHDRAWAL: "WDR", SPLIT: "SPLIT" };
                      const typeColor = tx.type === "PURCHASE" || tx.type === "DEPOSIT" || tx.type === "DIVIDEND" ? C.up : tx.type === "SALE" || tx.type === "WITHDRAWAL" ? C.dn : C.t2;
                      return (
                        <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: typeColor, background: typeColor + "18", padding: "3px 6px", borderRadius: 4, flexShrink: 0 }}>{typeMap[tx.type] || tx.type}</span>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 600, color: C.t1 }}>{tx.ticker || "Cash"}</div>
                              {isStock && <div style={{ fontSize: 11, color: C.t4 }}>{tx.shares?.toFixed(2)} @ ${tx.price?.toFixed(2)}</div>}
                            </div>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 10 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: C.t1 }}>${tx.amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            <div style={{ fontSize: 11, color: C.t4 }}>{tx.date}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  ) : (
                  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, marginBottom: 16, maxHeight: 400, overflow: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
                      <thead>
                        <tr style={{ position: "sticky", top: 0, background: C.card, zIndex: 1 }}>
                          {["Date", "Type", "Symbol", "Shares", "Price", "Amount"].map(h => (
                            <th key={h} style={{ padding: "10px 12px", textAlign: h === "Date" || h === "Type" || h === "Symbol" ? "left" : "right", fontSize: 10, fontWeight: 700, color: C.t4, textTransform: "uppercase", letterSpacing: 0.5, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...perfData.transactions].sort((a, b) => b.date.localeCompare(a.date)).map((tx, i) => {
                          const isStock = !!tx.ticker;
                          const typeColor = tx.type === "PURCHASE" || tx.type === "DEPOSIT" || tx.type === "DIVIDEND" ? C.up : tx.type === "SALE" || tx.type === "WITHDRAWAL" ? C.dn : C.t2;
                          return (
                            <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                              <td style={{ padding: "8px 12px", color: C.t2 }}>{tx.date}</td>
                              <td style={{ padding: "8px 12px", color: typeColor, fontWeight: 600 }}>{tx.type}</td>
                              <td style={{ padding: "8px 12px", color: C.t1, fontWeight: 600 }}>{tx.ticker || "—"}</td>
                              <td style={{ padding: "8px 12px", textAlign: "right", color: C.t2 }}>{isStock ? tx.shares?.toFixed(4) : "—"}</td>
                              <td style={{ padding: "8px 12px", textAlign: "right", color: C.t2 }}>{isStock ? `$${tx.price?.toFixed(2)}` : "—"}</td>
                              <td style={{ padding: "8px 12px", textAlign: "right", color: C.t1, fontWeight: 600 }}>${tx.amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  )
                )}

                {/* Holdings Table / Cards */}
                {(() => {
                  const totalVal = liveValue ? liveValue.value : 1;
                  const cashVal = liveValue?.cash || perfData.cash || 0;
                  const cashWeight = liveValue ? ((cashVal / liveValue.value) * 100) : 0;
                  const rows = Object.entries(perfData.holdings).map(([ticker, shares]) => {
                    const q = quotesRef.current?.[ticker];
                    const price = q?.p || 0;
                    const pc = bars[ticker]?.pc || price;
                    const dayChg = price - pc;
                    const dayChgPct = pc > 0 ? (dayChg / pc) * 100 : 0;
                    const mktValue = shares * price;
                    const weight = totalVal > 0 ? (mktValue / totalVal) * 100 : 0;
                    const cb = perfData.costBasis[ticker] || {};
                    const avgCost = cb.avg_cost || 0;
                    const costBasis = cb.total_cost || 0;
                    const gainLoss = mktValue - costBasis;
                    const gainLossPct = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;
                    const name = names[ticker] || "";
                    return { ticker, name, shares, price, dayChg, dayChgPct, mktValue, weight, avgCost, costBasis, gainLoss, gainLossPct };
                  });
                  const { col: sc, dir: sd } = holdingsSort;
                  const sortKey = {
                    symbol: r => r.ticker, name: r => (r.name || "").toLowerCase(), shares: r => r.shares,
                    price: r => r.price, dayChg: r => r.dayChg, dayChgPct: r => r.dayChgPct,
                    mktValue: r => r.mktValue, weight: r => r.weight, avgCost: r => r.avgCost,
                    costBasis: r => r.costBasis, gainLoss: r => r.gainLoss, gainLossPct: r => r.gainLossPct,
                  }[sc] || (r => r.weight);
                  rows.sort((a, b) => {
                    const av = sortKey(a), bv = sortKey(b);
                    if (typeof av === "string") return sd === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
                    return sd === "asc" ? av - bv : bv - av;
                  });
                  // Compute averages/totals
                  const totMktVal = rows.reduce((s, r) => s + r.mktValue, 0);
                  const totCostBasis = rows.reduce((s, r) => s + r.costBasis, 0);
                  const totGainLoss = rows.reduce((s, r) => s + r.gainLoss, 0);
                  const avgDayChgPct = totMktVal > 0 ? rows.reduce((s, r) => s + r.dayChgPct * r.mktValue, 0) / totMktVal : 0;
                  const totGainLossPct = totCostBasis > 0 ? (totGainLoss / totCostBasis) * 100 : 0;
                  const avgPrice = rows.length > 0 ? rows.reduce((s, r) => s + r.price, 0) / rows.length : 0;
                  const avgDayChg = rows.length > 0 ? rows.reduce((s, r) => s + r.dayChg, 0) / rows.length : 0;

                  if (!isDesktop) {
                    // ── MOBILE: Card Layout ──
                    return (
                      <div>
                        {/* Sort pills */}
                        <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto", scrollbarWidth: "none" }}>
                          {[
                            { col: "weight", label: "Weight" },
                            { col: "gainLossPct", label: "G/L %" },
                            { col: "dayChgPct", label: "Day %" },
                            { col: "mktValue", label: "Value" },
                            { col: "symbol", label: "A-Z" },
                          ].map(s => {
                            const active = holdingsSort.col === s.col;
                            return (
                              <button key={s.col} onClick={() => setHoldingsSort(prev => ({ col: s.col, dir: prev.col === s.col && prev.dir === "desc" ? "asc" : "desc" }))} style={{
                                padding: "6px 14px", borderRadius: 8, border: `1px solid ${active ? C.borderActive : C.border}`,
                                background: active ? C.accentSoft : "transparent",
                                color: active ? C.t1 : C.t4, fontSize: 11, fontWeight: 600,
                                cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0,
                              }}>{s.label} {active ? (holdingsSort.dir === "desc" ? "▼" : "▲") : ""}</button>
                            );
                          })}
                        </div>
                        {/* Holding cards */}
                        {rows.map(r => {
                          const isExpanded = expandedHolding === r.ticker;
                          return (
                            <div key={r.ticker} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", marginBottom: 8 }}>
                              <div onClick={() => setExpandedHolding(prev => prev === r.ticker ? null : r.ticker)} style={{ cursor: "pointer" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span onClick={e => { e.stopPropagation(); openStock(r.ticker); }} style={{ fontSize: 15, fontWeight: 700, color: C.t1 }}>{r.ticker}</span>
                                    <span data-holding-weight={r.ticker} style={{ fontSize: 11, fontWeight: 600, color: C.t4, background: C.bg, padding: "1px 6px", borderRadius: 4 }}>{r.weight.toFixed(1)}%</span>
                                  </div>
                                  <span data-holding-gainpct={r.ticker} style={{ fontSize: 13, fontWeight: 700, color: r.gainLossPct >= 0 ? C.up : C.dn }}>{r.gainLossPct >= 0 ? "+" : ""}{r.gainLossPct.toFixed(1)}%</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <span style={{ fontSize: 12, color: C.t4 }}>{r.shares.toLocaleString(undefined, { maximumFractionDigits: 2 })} × <span data-holding-price={r.ticker}>${r.price.toFixed(2)}</span> = <span data-holding-mktval={r.ticker} style={{ color: C.t2, fontWeight: 600 }}>${r.mktValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></span>
                                  <span data-holding-gain={r.ticker} style={{ fontSize: 12, fontWeight: 600, color: r.gainLoss >= 0 ? C.up : C.dn }}>{r.gainLoss >= 0 ? "+$" : "-$"}{Math.abs(r.gainLoss).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                </div>
                                <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
                                  <div><span style={{ fontSize: 10, color: C.t4 }}>Day</span><div data-holding-daypct={r.ticker} style={{ fontSize: 12, fontWeight: 600, color: r.dayChgPct >= 0 ? C.up : r.dayChgPct < 0 ? C.dn : C.t3 }}>{r.dayChgPct >= 0 ? "+" : ""}{r.dayChgPct.toFixed(2)}%</div></div>
                                  <div><span style={{ fontSize: 10, color: C.t4 }}>Avg Cost</span><div style={{ fontSize: 12, fontWeight: 600, color: C.t3 }}>${r.avgCost.toFixed(2)}</div></div>
                                  <div><span style={{ fontSize: 10, color: C.t4 }}>Cost Basis</span><div style={{ fontSize: 12, fontWeight: 600, color: C.t3 }}>${r.costBasis.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div></div>
                                </div>
                              </div>
                              {isExpanded && (
                                <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}`, animation: "fadeIn 0.15s ease" }}>
                                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", fontSize: 12 }}>
                                    <div><span style={{ color: C.t4 }}>Name</span><div style={{ color: C.t2, fontWeight: 500 }}>{r.name || "—"}</div></div>
                                    <div><span style={{ color: C.t4 }}>Day Chg</span><div data-holding-daychg={r.ticker} style={{ color: r.dayChg >= 0 ? C.up : C.dn, fontWeight: 600 }}>{r.dayChg >= 0 ? "+" : ""}{r.dayChg.toFixed(2)}</div></div>
                                  </div>
                                  <button onClick={() => openStock(r.ticker)} style={{ marginTop: 10, width: "100%", padding: "10px 0", borderRadius: 8, border: `1px solid ${C.borderActive}`, background: C.accentSoft, color: C.t1, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>View Profile</button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {/* Cash card */}
                        <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", marginBottom: 8 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <div style={{ fontSize: 15, fontWeight: 700, color: C.t3 }}>CASH</div>
                              <div style={{ fontSize: 12, color: C.t4 }}>Cash & Equivalents</div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: 15, fontWeight: 700, color: C.t1 }}>${cashVal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                              <div style={{ fontSize: 12, color: C.t3 }}>{cashWeight.toFixed(1)}%</div>
                            </div>
                          </div>
                        </div>
                        {/* Totals card */}
                        <div style={{ background: C.card, border: `2px solid ${C.border}`, borderRadius: 12, padding: "14px 14px", marginTop: 4 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: C.t4, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Totals</div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", fontSize: 12 }}>
                            <div><span style={{ color: C.t4 }}>Mkt Value</span><div style={{ color: C.t1, fontWeight: 700 }}>${totMktVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div></div>
                            <div><span style={{ color: C.t4 }}>Cost Basis</span><div style={{ color: C.t3 }}>${totCostBasis.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div></div>
                            <div><span style={{ color: C.t4 }}>Total G/L</span><div style={{ color: totGainLoss >= 0 ? C.up : C.dn, fontWeight: 700 }}>{totGainLoss >= 0 ? "+$" : "-$"}{Math.abs(totGainLoss).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div></div>
                            <div><span style={{ color: C.t4 }}>G/L %</span><div style={{ color: totGainLossPct >= 0 ? C.up : C.dn, fontWeight: 700 }}>{totGainLossPct >= 0 ? "+" : ""}{totGainLossPct.toFixed(1)}%</div></div>
                            <div><span style={{ color: C.t4 }}>Avg Day %</span><div style={{ color: avgDayChgPct >= 0 ? C.up : C.dn, fontWeight: 600 }}>{avgDayChgPct >= 0 ? "+" : ""}{avgDayChgPct.toFixed(2)}%</div></div>
                            <div><span style={{ color: C.t4 }}>Holdings</span><div style={{ color: C.t1, fontWeight: 600 }}>{rows.length}</div></div>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // ── DESKTOP: Table Layout ──
                  return (
                  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
                      <thead>
                        <tr>
                          {[
                            { key: "symbol", label: "Symbol", align: "left" },
                            { key: "name", label: "Name", align: "left" },
                            { key: "shares", label: "Shares", align: "right" },
                            { key: "price", label: "Price", align: "right" },
                            { key: "dayChg", label: "Day Chg", align: "right" },
                            { key: "dayChgPct", label: "Day %", align: "right" },
                            { key: "mktValue", label: "Mkt Value", align: "right" },
                            { key: "weight", label: "Weight", align: "right" },
                            { key: "avgCost", label: "Avg Cost", align: "right" },
                            { key: "costBasis", label: "Cost Basis", align: "right" },
                            { key: "gainLoss", label: "Gain/Loss", align: "right" },
                            { key: "gainLossPct", label: "G/L %", align: "right" },
                          ].map(col => (
                            <th key={col.key} onClick={() => setHoldingsSort(prev => ({ col: col.key, dir: prev.col === col.key && prev.dir === "desc" ? "asc" : "desc" }))}
                              style={{
                                padding: "10px 12px", textAlign: col.align, fontSize: 10, fontWeight: 700,
                                color: holdingsSort.col === col.key ? C.t1 : C.t4,
                                textTransform: "uppercase", letterSpacing: 0.5, cursor: "pointer", whiteSpace: "nowrap",
                                borderBottom: `1px solid ${C.border}`, userSelect: "none",
                                position: col.key === "symbol" ? "sticky" : "static", left: col.key === "symbol" ? 0 : "auto",
                                background: C.card, zIndex: col.key === "symbol" ? 2 : 1,
                              }}>
                              {col.label} {holdingsSort.col === col.key ? (holdingsSort.dir === "desc" ? "▼" : "▲") : ""}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(r => (
                            <tr key={r.ticker} {...stockContextHandlers(r.ticker)} style={{ cursor: "pointer", borderBottom: `1px solid ${C.border}` }}
                              onMouseEnter={e => e.currentTarget.style.background = C.hover} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                              <td style={{ padding: "10px 12px", fontWeight: 700, color: C.t1, position: "sticky", left: 0, background: C.card, zIndex: 1 }}>{r.ticker}</td>
                              <td style={{ padding: "10px 12px", color: C.t2, whiteSpace: "nowrap", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</td>
                              <td style={{ padding: "10px 12px", textAlign: "right", color: C.t2 }}>{r.shares.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                              <td data-holding-price={r.ticker} style={{ padding: "10px 12px", textAlign: "right", color: C.t1, fontWeight: 600 }}>${r.price.toFixed(2)}</td>
                              <td data-holding-daychg={r.ticker} style={{ padding: "10px 12px", textAlign: "right", color: r.dayChg >= 0 ? C.up : C.dn, fontWeight: 600 }}>{r.dayChg >= 0 ? "+" : ""}{r.dayChg.toFixed(2)}</td>
                              <td data-holding-daypct={r.ticker} style={{ padding: "10px 12px", textAlign: "right", color: r.dayChgPct >= 0 ? C.up : C.dn }}>{r.dayChgPct >= 0 ? "+" : ""}{r.dayChgPct.toFixed(2)}%</td>
                              <td data-holding-mktval={r.ticker} style={{ padding: "10px 12px", textAlign: "right", color: C.t1, fontWeight: 600 }}>${r.mktValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                              <td data-holding-weight={r.ticker} style={{ padding: "10px 12px", textAlign: "right", color: C.t1 }}>{r.weight.toFixed(1)}%</td>
                              <td style={{ padding: "10px 12px", textAlign: "right", color: C.t3 }}>${r.avgCost.toFixed(2)}</td>
                              <td style={{ padding: "10px 12px", textAlign: "right", color: C.t3 }}>${r.costBasis.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                              <td data-holding-gain={r.ticker} style={{ padding: "10px 12px", textAlign: "right", color: r.gainLoss >= 0 ? C.up : C.dn, fontWeight: 600 }}>{r.gainLoss >= 0 ? "+$" : "-$"}{Math.abs(r.gainLoss).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                              <td data-holding-gainpct={r.ticker} style={{ padding: "10px 12px", textAlign: "right", color: r.gainLossPct >= 0 ? C.up : C.dn }}>{r.gainLossPct >= 0 ? "+" : ""}{r.gainLossPct.toFixed(1)}%</td>
                            </tr>
                        ))}
                        {/* Cash row */}
                        <tr style={{ borderTop: `2px solid ${C.border}`, background: C.bg }}>
                          <td style={{ padding: "10px 12px", fontWeight: 700, color: C.t3, position: "sticky", left: 0, background: C.bg }}>CASH</td>
                          <td style={{ padding: "10px 12px", color: C.t4 }}>Cash & Equivalents</td>
                          <td colSpan={4} />
                          <td style={{ padding: "10px 12px", textAlign: "right", color: C.t1, fontWeight: 600 }}>${cashVal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: C.t3 }}>{cashWeight.toFixed(1)}%</td>
                          <td colSpan={4} />
                        </tr>
                        {/* Totals row */}
                        <tr style={{ borderTop: `2px solid ${C.accent}44`, background: C.accentSoft }}>
                          <td style={{ padding: "10px 12px", fontWeight: 800, color: C.t1, position: "sticky", left: 0, background: C.accentSoft }}>TOTALS</td>
                          <td style={{ padding: "10px 12px", color: C.t4, fontSize: 11 }}>{rows.length} holdings</td>
                          <td style={{ padding: "10px 12px" }} />
                          <td style={{ padding: "10px 12px", textAlign: "right", color: C.t3 }}>${avgPrice.toFixed(2)}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: avgDayChg >= 0 ? C.up : C.dn, fontWeight: 600 }}>{avgDayChg >= 0 ? "+" : ""}{avgDayChg.toFixed(2)}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: avgDayChgPct >= 0 ? C.up : C.dn, fontWeight: 600 }}>{avgDayChgPct >= 0 ? "+" : ""}{avgDayChgPct.toFixed(2)}%</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: C.t1, fontWeight: 800 }}>${totMktVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: C.t1, fontWeight: 600 }}>100%</td>
                          <td style={{ padding: "10px 12px" }} />
                          <td style={{ padding: "10px 12px", textAlign: "right", color: C.t3, fontWeight: 600 }}>${totCostBasis.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: totGainLoss >= 0 ? C.up : C.dn, fontWeight: 800 }}>{totGainLoss >= 0 ? "+$" : "-$"}{Math.abs(totGainLoss).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: totGainLossPct >= 0 ? C.up : C.dn, fontWeight: 800 }}>{totGainLossPct >= 0 ? "+" : ""}{totGainLossPct.toFixed(1)}%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  </div>
                  );
                })()}
              </div>
            )}

            {/* ━━━ LISTS VIEW ━━━ */}
            {homeView === "lists" && (
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
              <React.Fragment key={k}>{renderSleeve(k, sleeve)}</React.Fragment>
            ))}
              </div>

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
              </div>
            </div>
            )}
            {Object.keys(quotes).length > 0 && (
              <div style={{ paddingTop: 28, paddingBottom: 20 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: C.t1, marginBottom: 16 }}>Heatmap</div>
                <Heatmap sleeves={Object.fromEntries(CORE_KEYS.filter(k => sleeves[k]).map(k => [k, sleeves[k]]))} chgFn={chg} namesFn={names} onTap={s => openStock(s)} onContext={(s, x, y) => setCtxMenu({ sym: s, x, y })} />
              </div>
            )}
            {/* Add Transaction Modal */}
            {showTxModal && (
              <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 9999, display: "flex", alignItems: isDesktop ? "center" : "flex-end", justifyContent: "center", animation: "fadeIn 0.15s ease" }}
                onClick={e => { if (e.target === e.currentTarget) setShowTxModal(false); }}>
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: isDesktop ? 18 : "18px 18px 0 0", padding: isDesktop ? 28 : "24px 20px", paddingBottom: isDesktop ? 28 : "calc(env(safe-area-inset-bottom, 8px) + 20px)", width: isDesktop ? Math.min(440, window.innerWidth - 40) : "100%", maxHeight: isDesktop ? "80vh" : "85vh", overflow: "auto", animation: isDesktop ? "none" : "slideUp 0.25s cubic-bezier(0.16,1,0.3,1)" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: C.t1, marginBottom: 20 }}>Add Transaction</div>
                  {/* Type selector */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                    {["PURCHASE", "SALE", "DIVIDEND", "DEPOSIT", "WITHDRAWAL"].map(t => (
                      <button key={t} onClick={() => setTxForm(f => ({ ...f, type: t }))} style={{
                        padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                        border: `1px solid ${txForm.type === t ? C.borderActive : C.border}`,
                        background: txForm.type === t ? C.accentSoft : "transparent",
                        color: txForm.type === t ? C.t1 : C.t3, cursor: "pointer", fontFamily: "inherit",
                      }}>{t}</button>
                    ))}
                  </div>
                  {/* Fields */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <input type="date" value={txForm.date} onChange={e => setTxForm(f => ({ ...f, date: e.target.value }))}
                      style={{ padding: "10px 14px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, color: C.t1, fontSize: 14, outline: "none", fontFamily: "inherit" }} />
                    {txForm.type !== "DEPOSIT" && txForm.type !== "WITHDRAWAL" && txForm.type !== "DIVIDEND" && (
                      <>
                        <input type="text" placeholder="Ticker (e.g. AAPL)" value={txForm.ticker}
                          onChange={e => setTxForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))}
                          style={{ padding: "10px 14px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, color: C.t1, fontSize: 14, outline: "none", fontFamily: "inherit" }} />
                        <div style={{ display: "flex", gap: 10 }}>
                          <input type="number" placeholder="Shares" value={txForm.shares}
                            onChange={e => setTxForm(f => ({ ...f, shares: e.target.value, amount: e.target.value && f.price ? (parseFloat(e.target.value) * parseFloat(f.price)).toFixed(2) : f.amount }))}
                            style={{ flex: 1, padding: "10px 14px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, color: C.t1, fontSize: 14, outline: "none", fontFamily: "inherit" }} />
                          <input type="number" placeholder="Price" value={txForm.price}
                            onChange={e => setTxForm(f => ({ ...f, price: e.target.value, amount: f.shares && e.target.value ? (parseFloat(f.shares) * parseFloat(e.target.value)).toFixed(2) : f.amount }))}
                            style={{ flex: 1, padding: "10px 14px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, color: C.t1, fontSize: 14, outline: "none", fontFamily: "inherit" }} />
                        </div>
                      </>
                    )}
                    <input type="number" placeholder="Amount ($)" value={txForm.amount}
                      onChange={e => setTxForm(f => ({ ...f, amount: e.target.value }))}
                      style={{ padding: "10px 14px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, color: C.t1, fontSize: 14, outline: "none", fontFamily: "inherit" }} />
                    <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                      <button onClick={() => {
                        const isStock = txForm.type !== "DEPOSIT" && txForm.type !== "WITHDRAWAL" && txForm.type !== "DIVIDEND";
                        if (isStock && !txForm.ticker) return;
                        if (!txForm.amount && !(txForm.shares && txForm.price)) return;
                        const shares = parseFloat(txForm.shares) || 0;
                        const price = parseFloat(txForm.price) || 0;
                        const amount = parseFloat(txForm.amount) || (shares * price);
                        const newTx = isStock
                          ? { date: txForm.date, ticker: txForm.ticker, type: txForm.type, shares, price, amount }
                          : { date: txForm.date, type: txForm.type, amount };
                        // Update perfData in memory
                        setPerfData(prev => {
                          if (!prev) return prev;
                          const updated = { ...prev, transactions: [newTx, ...prev.transactions] };
                          if (isStock) {
                            const h = { ...prev.holdings };
                            const cb = { ...prev.costBasis };
                            if (txForm.type === "PURCHASE") {
                              const oldShares = h[txForm.ticker] || 0;
                              const oldCost = cb[txForm.ticker]?.total_cost || 0;
                              h[txForm.ticker] = oldShares + shares;
                              const newTotalCost = oldCost + (shares * price);
                              cb[txForm.ticker] = { avg_cost: h[txForm.ticker] > 0 ? newTotalCost / h[txForm.ticker] : 0, total_cost: newTotalCost };
                            } else if (txForm.type === "SALE") {
                              const oldShares = h[txForm.ticker] || 0;
                              const oldCost = cb[txForm.ticker]?.total_cost || 0;
                              const avgCost = oldShares > 0 ? oldCost / oldShares : 0;
                              h[txForm.ticker] = Math.max(0, oldShares - shares);
                              cb[txForm.ticker] = { avg_cost: avgCost, total_cost: avgCost * h[txForm.ticker] };
                              if (h[txForm.ticker] <= 0) { delete h[txForm.ticker]; delete cb[txForm.ticker]; }
                            }
                            updated.holdings = h;
                            updated.costBasis = cb;
                            // Adjust cash for stock transactions
                            if (txForm.type === "PURCHASE") {
                              updated.cash = (prev.cash || 0) - amount;
                            } else if (txForm.type === "SALE") {
                              updated.cash = (prev.cash || 0) + amount;
                            }
                          } else {
                            updated.cash = (txForm.type === "DEPOSIT" || txForm.type === "DIVIDEND") ? (prev.cash || 0) + amount : (prev.cash || 0) - amount;
                          }
                          // Persist: commit to GitHub repo (shared) + localStorage backup
                          commitTransaction(newTx);
                          fetch("/api/transactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newTx) }).catch(() => {});
                          try { localStorage.setItem("iown_pending_transactions", JSON.stringify(updated.transactions.slice(0, 50))); } catch(e) {}
                          return updated;
                        });
                        setShowTxModal(false);
                      }} style={{
                        flex: 1, padding: "14px 0", borderRadius: 12, border: "none",
                        background: C.accent, color: "#fff", fontSize: 15, fontWeight: 700,
                        cursor: "pointer", fontFamily: "inherit",
                      }}>Add Transaction</button>
                      <button onClick={() => setShowTxModal(false)} style={{
                        padding: "14px 20px", borderRadius: 12, border: `1px solid ${C.border}`,
                        background: "transparent", color: C.t3, fontSize: 15, fontWeight: 600,
                        cursor: "pointer", fontFamily: "inherit",
                      }}>Cancel</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Rebalance Modal */}
            {showRebalModal && perfData && (() => {
              const h = perfData.holdings || {};
              const cash = perfData.cash || 0;
              let totalStocks = 0;
              const holdingRows = [];
              for (const [ticker, shares] of Object.entries(h)) {
                const q = quotesRef.current[ticker];
                const price = q?.p || 0;
                const mktVal = shares * price;
                totalStocks += mktVal;
                holdingRows.push({ ticker, shares, price, mktVal });
              }
              const totalPort = totalStocks + cash;
              const targetCash = totalPort * 0.01;
              const excessCash = cash - targetCash;
              const cashPct = totalPort > 0 ? (cash / totalPort) * 100 : 0;
              // Distribute excess cash proportionally to current weights
              const orders = [];
              if (excessCash > 10) {
                const totalWeight = holdingRows.reduce((s, r) => s + r.mktVal, 0);
                for (const r of holdingRows) {
                  if (r.price <= 0 || totalWeight <= 0) continue;
                  const weight = r.mktVal / totalWeight;
                  const buyAmt = excessCash * weight;
                  const buyShares = Math.floor((buyAmt / r.price) * 10000) / 10000;
                  if (buyShares > 0 && buyAmt >= 1) {
                    orders.push({ ticker: r.ticker, shares: buyShares, price: r.price, amount: Math.round(buyShares * r.price * 100) / 100 });
                  }
                }
              }
              return (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: isDesktop ? "center" : "flex-end", justifyContent: "center", zIndex: 1000 }}
                  onClick={e => { if (e.target === e.currentTarget) setShowRebalModal(false); }}>
                  <div style={{ background: C.surface, borderRadius: isDesktop ? 20 : "20px 20px 0 0", padding: 28, width: isDesktop ? 500 : "100%", maxHeight: "80vh", overflow: "auto", border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: C.t1, marginBottom: 4 }}>Rebalance to 1% Cash</div>
                    <div style={{ fontSize: 13, color: C.t3, marginBottom: 20 }}>
                      Current cash: <span style={{ fontWeight: 700, color: C.t1 }}>${cash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      <span style={{ color: C.t4 }}> ({cashPct.toFixed(2)}%)</span>
                      {" → "}Target: <span style={{ fontWeight: 700, color: C.t1 }}>${targetCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      <span style={{ color: C.t4 }}> (1.00%)</span>
                    </div>
                    {excessCash <= 10 ? (
                      <div style={{ padding: 20, background: C.bg, borderRadius: 12, textAlign: "center", color: C.t3, fontSize: 14 }}>
                        Cash is already at or below 1% target. No rebalance needed.
                      </div>
                    ) : (
                      <>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.t3, marginBottom: 10 }}>
                          Suggested orders — deploy ${excessCash.toLocaleString(undefined, { minimumFractionDigits: 2 })} across holdings:
                        </div>
                        <div style={{ background: C.bg, borderRadius: 12, overflow: "hidden", border: `1px solid ${C.border}`, marginBottom: 16 }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
                            <thead>
                              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                                <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: C.t3, fontSize: 11 }}>Ticker</th>
                                <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: C.t3, fontSize: 11 }}>Shares</th>
                                <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: C.t3, fontSize: 11 }}>Price</th>
                                <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: C.t3, fontSize: 11 }}>Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {orders.map(o => (
                                <tr key={o.ticker} style={{ borderBottom: `1px solid ${C.border}` }}>
                                  <td style={{ padding: "8px 12px", fontWeight: 700, color: C.t1 }}>{o.ticker}</td>
                                  <td style={{ padding: "8px 12px", textAlign: "right", color: C.t1 }}>{o.shares.toFixed(4)}</td>
                                  <td style={{ padding: "8px 12px", textAlign: "right", color: C.t3 }}>${o.price.toFixed(2)}</td>
                                  <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, color: C.up }}>${o.amount.toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div style={{ fontSize: 11, color: C.t4, marginBottom: 16, fontStyle: "italic" }}>
                          Orders distributed proportionally to current portfolio weights. Execute these manually in your brokerage.
                        </div>
                      </>
                    )}
                    <button onClick={() => setShowRebalModal(false)} style={{
                      width: "100%", padding: 14, borderRadius: 12, border: `1px solid ${C.border}`,
                      background: "transparent", color: C.t3, fontSize: 15, fontWeight: 600,
                      cursor: "pointer", fontFamily: "inherit",
                    }}>Close</button>
                  </div>
                </div>
              );
            })()}
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
                <div key={article.id || i} onClick={() => { setSelectedArticle(article); setArticleContent(null); setArticleLoading(false); }}
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
                      <div style={{ marginBottom: 6 }}>
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
            {(() => {
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
              // Show from start of current week (Monday) in LOCAL time
              const today = new Date();
              const localDay = today.getDay(); // 0=Sun, 1=Mon...6=Sat
              const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (localDay === 0 ? 6 : localDay - 1));
              const weekStartStr = `${monday.getFullYear()}-${String(monday.getMonth()+1).padStart(2,"0")}-${String(monday.getDate()).padStart(2,"0")}`;

              // Group by date — show full week starting Monday
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
                              {evt.actual != null && evt.actual !== "" ? (
                                <span style={{ color: C.t4 }}>Act: <span style={{ color: C.up, fontWeight: 700 }}>{evt.actual}</span></span>
                              ) : isPast ? (
                                <span style={{ fontSize: 11, color: C.t4, fontStyle: "italic" }}>Awaiting data...</span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              });
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
                      <div key={c.sym} {...stockContextHandlers(c.sym)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", cursor: "pointer", borderBottom: i < contributions.length - 1 ? `1px solid ${C.border}` : "none" }}>
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
                          <StockLogo symbol={s} size={22} logoUrl={fundamentals[s]?.logo} />
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
                      <StockLogo symbol={peerSymbol} size={32} logoUrl={fundamentals[peerSymbol]?.logo} />
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
                            <th key={s} {...stockContextHandlers(s)} style={{
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

              if (!isDesktop) {
                // ── MOBILE: Metrics Cards ──
                return (
                  <div>
                    {sorted.map(s => {
                      const d = fundamentals[s] || {};
                      const nm = names[s] || "";
                      const dc = dayChg(s);
                      const isExp = expandedMetric === s;
                      const keyMetrics = researchView === "dividend"
                        ? [
                          { l: "P/E", v: d.peTTM != null ? d.peTTM.toFixed(1) : "—" },
                          { l: "YTD", v: d.ytd != null ? `${d.ytd >= 0 ? "+" : ""}${d.ytd.toFixed(1)}%` : "—", c: (d.ytd||0) >= 0 ? C.up : C.dn },
                          { l: "Yield", v: d.yieldFwd != null ? `${d.yieldFwd.toFixed(2)}%` : "—" },
                          { l: "Payout", v: d.payoutRatio != null ? `${d.payoutRatio.toFixed(0)}%` : "—" },
                          { l: "ROE", v: d.roe != null ? `${d.roe.toFixed(1)}%` : "—" },
                          { l: "D/E", v: d.de != null ? d.de.toFixed(2) : "—" },
                        ]
                        : [
                          { l: "P/E", v: d.peTTM != null ? d.peTTM.toFixed(1) : "—" },
                          { l: "YTD", v: d.ytd != null ? `${d.ytd >= 0 ? "+" : ""}${d.ytd.toFixed(1)}%` : "—", c: (d.ytd||0) >= 0 ? C.up : C.dn },
                          { l: "Rev YoY", v: d.revenueYoY != null ? `${d.revenueYoY >= 0 ? "+" : ""}${d.revenueYoY.toFixed(1)}%` : "—", c: (d.revenueYoY||0) >= 0 ? C.up : C.dn },
                          { l: "Margin", v: d.profitMargin != null ? `${d.profitMargin.toFixed(1)}%` : "—" },
                          { l: "ROE", v: d.roe != null ? `${d.roe.toFixed(1)}%` : "—" },
                          { l: "D/E", v: d.de != null ? d.de.toFixed(2) : "—" },
                        ];
                      return (
                        <div key={s} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", marginBottom: 8 }}>
                          <div onClick={() => setExpandedMetric(prev => prev === s ? null : s)} style={{ cursor: "pointer" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                {metricsEditMode && <div onClick={e => { e.stopPropagation(); removeSymbol(researchView, s); }} style={{ width: 20, height: 20, borderRadius: 10, background: C.dn + "22", border: `1px solid ${C.dn}44`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.dn} strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /></svg></div>}
                                <div>
                                  <span onClick={e => { e.stopPropagation(); openStock(s); }} style={{ fontSize: 15, fontWeight: 800, color: C.accent }}>{s}</span>
                                  <div style={{ fontSize: 11, color: C.t4 }}>{nm}</div>
                                </div>
                              </div>
                              <span data-metric-day={s} style={{ fontSize: 13, fontWeight: 700, color: dc > 0 ? C.up : dc < 0 ? C.dn : C.t3 }}>{dc != null ? `${dc >= 0 ? "+" : ""}${dc.toFixed(2)}%` : "—"}</span>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px 12px" }}>
                              {keyMetrics.map(m => (
                                <div key={m.l}><span style={{ fontSize: 10, color: C.t4 }}>{m.l}</span><div style={{ fontSize: 12, fontWeight: 600, color: m.c || C.t2 }}>{m.v}</div></div>
                              ))}
                            </div>
                          </div>
                          {isExp && (
                            <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}`, animation: "fadeIn 0.15s ease" }}>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px 12px", fontSize: 12 }}>
                                {cols.filter(c => !["_day"].includes(c.k)).map(col => {
                                  const val = col.fn(d, s);
                                  const clr = col.color ? col.color(d, s) : C.t2;
                                  return <div key={col.l}><span style={{ color: C.t4, fontSize: 10 }}>{col.l}</span><div style={{ fontWeight: 600, color: clr }}>{val}</div></div>;
                                })}
                              </div>
                              <button onClick={() => openStock(s)} style={{ marginTop: 10, width: "100%", padding: "10px 0", borderRadius: 8, border: `1px solid ${C.borderActive}`, background: C.accentSoft, color: C.t1, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>View Profile</button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {/* Averages card */}
                    {sorted.length > 0 && (
                      <div style={{ background: C.card, border: `2px solid ${C.border}`, borderRadius: 12, padding: "14px 14px", marginTop: 4 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: C.t4, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Averages</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px 12px", fontSize: 12 }}>
                          {cols.filter(c => !c.noAvg).map(col => {
                            let avg;
                            if (col.k === "_day") {
                              const dayVals = sorted.map(s => dayChg(s)).filter(v => v != null);
                              avg = dayVals.length ? dayVals.reduce((a, b) => a + b, 0) / dayVals.length : null;
                            } else {
                              const vals = sorted.map(s => fundamentals[s]?.[col.k]).filter(v => v != null && isFinite(v));
                              avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
                            }
                            const val = avg != null ? col.fn({ [col.k]: avg }) : "—";
                            return <div key={col.l}><span style={{ color: C.t4, fontSize: 10 }}>{col.l}</span><div style={{ fontWeight: 700, color: C.t1 }}>{val}</div></div>;
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              // ── DESKTOP: Table Layout ──
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
                          const shortNm = nm;
                          return (
                            <tr key={s} style={{ borderBottom: `1px solid ${C.border}` }}>
                              <td style={{ position: "sticky", left: 0, zIndex: 1, background: C.card, padding: "10px 12px", borderRight: `1px solid ${C.border}` }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  {metricsEditMode && (
                                    <div onClick={() => removeSymbol(researchView, s)} style={{ width: 22, height: 22, borderRadius: 11, background: C.dn + "22", border: `1px solid ${C.dn}44`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.dn} strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
                                    </div>
                                  )}
                                  <div {...stockContextHandlers(s)} style={{ cursor: "pointer" }}>
                                    <div style={{ fontSize: 14, fontWeight: 800, color: C.accent }}>{s}</div>
                                    <div style={{ fontSize: 11, color: C.t4, marginTop: 1 }}>{shortNm}</div>
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

              {/* Content: cards only — iframe opens as full-screen overlay */}
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
            </div>
          );
        })()}

        {/* ━━━ CLIENTS (REDTAIL CRM) ━━━ */}
        {tab === "clients" && (
          <div style={{ animation: "fadeIn 0.3s ease", paddingTop: 20 }}>
            {!isDesktop && <div style={{ fontSize: 24, fontWeight: 800, color: C.t1, marginBottom: 16 }}>Clients</div>}
            {(() => {
              const RT_KEY = import.meta.env.VITE_REDTAIL_KEY || "";
              const rtConnected = !!RT_KEY;

              if (!rtConnected) return (
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 32, textAlign: "center" }}>
                  <div style={{ fontSize: 40, marginBottom: 16 }}>🔗</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: C.t1, marginBottom: 8 }}>Connect Redtail CRM</div>
                  <div style={{ fontSize: 13, color: C.t3, lineHeight: 1.6, maxWidth: 400, margin: "0 auto 20px" }}>
                    Link your Redtail CRM to view contacts, tasks, and appointments directly in IOWN. You'll need a Redtail API key.
                  </div>
                  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, maxWidth: 420, margin: "0 auto", textAlign: "left" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginBottom: 12 }}>Setup Instructions</div>
                    <div style={{ fontSize: 12, color: C.t3, lineHeight: 1.8 }}>
                      <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: C.accent, background: C.accentSoft, width: 22, height: 22, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>1</span>
                        <span>Request an API key at <span style={{ color: C.accent, fontWeight: 600 }}>corporate.redtailtechnology.com/api</span></span>
                      </div>
                      <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: C.accent, background: C.accentSoft, width: 22, height: 22, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>2</span>
                        <span>Add the key as a GitHub Secret: <span style={{ color: C.t2, fontWeight: 600, fontFamily: "monospace", fontSize: 11 }}>VITE_REDTAIL_KEY</span></span>
                      </div>
                      <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: C.accent, background: C.accentSoft, width: 22, height: 22, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>3</span>
                        <span>Add your Redtail user key: <span style={{ color: C.t2, fontWeight: 600, fontFamily: "monospace", fontSize: 11 }}>VITE_REDTAIL_USER_KEY</span></span>
                      </div>
                      <div style={{ display: "flex", gap: 10 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: C.accent, background: C.accentSoft, width: 22, height: 22, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>4</span>
                        <span>Re-deploy and your CRM data will appear here</span>
                      </div>
                    </div>
                  </div>
                </div>
              );

              // Connected state — show CRM data
              const rtTabs = [
                { id: "contacts", label: "Contacts", icon: "👤" },
                { id: "tasks", label: "Tasks", icon: "✅" },
                { id: "calendar", label: "Appointments", icon: "📅" },
              ];

              return (
                <div>
                  {/* Sub-tab bar */}
                  <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
                    {rtTabs.map(t => (
                      <button key={t.id} onClick={() => setRtTab(t.id)} style={{
                        padding: "8px 16px", borderRadius: 8, border: `1px solid ${rtTab === t.id ? C.borderActive : C.border}`,
                        background: rtTab === t.id ? C.accentSoft : "transparent",
                        color: rtTab === t.id ? C.t1 : C.t4, fontSize: 13, fontWeight: 600,
                        cursor: "pointer", fontFamily: "inherit",
                      }}>{t.icon} {t.label}</button>
                    ))}
                  </div>

                  {/* Search bar */}
                  {rtTab === "contacts" && (
                    <div style={{ marginBottom: 16 }}>
                      <input value={rtSearch} onChange={e => setRtSearch(e.target.value)} placeholder="Search contacts..."
                        style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: `1px solid ${C.border}`,
                          background: C.surface, color: C.t1, fontSize: 14, fontFamily: "inherit", outline: "none",
                          boxSizing: "border-box",
                        }} />
                    </div>
                  )}

                  {/* Content area */}
                  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden" }}>
                    {rtLoading ? (
                      <div style={{ padding: 40, textAlign: "center", color: C.t4 }}>Loading CRM data...</div>
                    ) : rtTab === "contacts" ? (
                      rtContacts.length === 0 ? (
                        <div style={{ padding: 40, textAlign: "center", color: C.t4 }}>
                          <div style={{ fontSize: 32, marginBottom: 8 }}>👤</div>
                          <div style={{ fontSize: 14, color: C.t3 }}>Contacts will appear here once connected</div>
                        </div>
                      ) : (
                        rtContacts.filter(c => !rtSearch || (c.name || "").toLowerCase().includes(rtSearch.toLowerCase())).map((c, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", padding: "14px 16px", borderBottom: `1px solid ${C.border}`, gap: 12 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 20, background: C.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: C.accent, flexShrink: 0 }}>
                              {(c.name || "?")[0]}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 600, color: C.t1 }}>{c.name}</div>
                              {c.email && <div style={{ fontSize: 12, color: C.t3, marginTop: 2 }}>{c.email}</div>}
                            </div>
                            {c.phone && <div style={{ fontSize: 12, color: C.t4, fontVariantNumeric: "tabular-nums" }}>{c.phone}</div>}
                          </div>
                        ))
                      )
                    ) : rtTab === "tasks" ? (
                      rtActivities.length === 0 ? (
                        <div style={{ padding: 40, textAlign: "center", color: C.t4 }}>
                          <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                          <div style={{ fontSize: 14, color: C.t3 }}>Tasks & activities will appear here</div>
                        </div>
                      ) : (
                        rtActivities.map((a, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "flex-start", padding: "14px 16px", borderBottom: `1px solid ${C.border}`, gap: 12 }}>
                            <div style={{ width: 24, height: 24, borderRadius: 6, border: `2px solid ${a.completed ? C.up : C.border}`, background: a.completed ? C.up + "18" : "transparent",
                              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                              {a.completed && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.up} strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 14, fontWeight: 600, color: a.completed ? C.t4 : C.t1, textDecoration: a.completed ? "line-through" : "none" }}>{a.subject}</div>
                              <div style={{ display: "flex", gap: 10, marginTop: 4, fontSize: 12, color: C.t4 }}>
                                {a.date && <span>{a.date}</span>}
                                {a.type && <span style={{ color: C.accent }}>{a.type}</span>}
                                {a.contact && <span>→ {a.contact}</span>}
                              </div>
                            </div>
                            {a.priority === "high" && <span style={{ fontSize: 10, fontWeight: 700, color: C.dn, padding: "2px 6px", borderRadius: 4, background: C.dnSoft }}>HIGH</span>}
                          </div>
                        ))
                      )
                    ) : (
                      rtCalendar.length === 0 ? (
                        <div style={{ padding: 40, textAlign: "center", color: C.t4 }}>
                          <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>
                          <div style={{ fontSize: 14, color: C.t3 }}>Appointments will appear here</div>
                        </div>
                      ) : (
                        rtCalendar.map((a, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "flex-start", padding: "14px 16px", borderBottom: `1px solid ${C.border}`, gap: 12 }}>
                            <div style={{ width: 44, textAlign: "center", flexShrink: 0 }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: C.accent, textTransform: "uppercase" }}>{a.month}</div>
                              <div style={{ fontSize: 22, fontWeight: 800, color: C.t1, lineHeight: 1 }}>{a.day}</div>
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 14, fontWeight: 600, color: C.t1 }}>{a.subject}</div>
                              <div style={{ display: "flex", gap: 10, marginTop: 4, fontSize: 12, color: C.t4 }}>
                                {a.time && <span>{a.time}</span>}
                                {a.location && <span>📍 {a.location}</span>}
                                {a.contact && <span>→ {a.contact}</span>}
                              </div>
                            </div>
                          </div>
                        ))
                      )
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ━━━ PERFORMANCE ━━━ */}
        {tab === "performance" && (
          <div style={{ animation: "fadeIn 0.3s ease", paddingTop: 20 }}>
            {!isDesktop && <div style={{ fontSize: 24, fontWeight: 800, color: C.t1, marginBottom: 20 }}>Performance</div>}

            {perfLoading && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 80 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
                  <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
                </svg>
                <span style={{ marginLeft: 12, color: C.t3, fontSize: 14 }}>Loading portfolio history...</span>
              </div>
            )}

            {!perfLoading && !perfData && (
              <div style={{ padding: 60, textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.4 }}>📈</div>
                <div style={{ fontSize: 16, color: C.t3, marginBottom: 8 }}>No portfolio history available</div>
                <div style={{ fontSize: 13, color: C.t4 }}>Run the portfolio history builder script to generate data</div>
              </div>
            )}

            {!perfLoading && perfData && (() => {
              const perfCash = perfData.cash || 0;
              const benchmarks = perfData.benchmarks || {};
              const startBalance = perfData.startBalance || 100000;

              // Build portfolio with live endpoint appended if we have live data
              const basePortfolio = perfData.portfolio;
              let portfolio;
              if (liveValue) {
                const today = new Date().toISOString().slice(0, 10);
                const lastDate = basePortfolio[basePortfolio.length - 1]?.date;
                if (today > lastDate) {
                  portfolio = [...basePortfolio, { date: today, value: liveValue.value, stocks: liveValue.stocks, cash: liveValue.cash, num_holdings: liveValue.holdings }];
                } else {
                  // Same day — replace the last point with live
                  portfolio = [...basePortfolio.slice(0, -1), { ...basePortfolio[basePortfolio.length - 1], value: liveValue.value, stocks: liveValue.stocks, cash: liveValue.cash }];
                }
              } else {
                portfolio = basePortfolio;
              }

              // Filter by time range — use intraday data for short periods
              const now = new Date();
              const useIntraday = (perfRange === "1D" || perfRange === "1W" || perfRange === "1M") && intradayPortfolio[perfRange]?.length > 1;
              let filtered;
              let isIntraday = false;

              if (useIntraday) {
                filtered = intradayPortfolio[perfRange];
                // Append live value as real-time trailing point (updates every ~2s via WebSocket)
                if (liveValue && perfRange === "1D") {
                  const livePoint = { date: new Date().toISOString(), value: liveValue.value, stocks: liveValue.stocks, cash: liveValue.cash };
                  const last = filtered[filtered.length - 1];
                  if (!last || Math.abs(livePoint.value - last.value) > 0.01) {
                    filtered = [...filtered, livePoint];
                  }
                }
                isIntraday = true;
              } else {
                const rangeMap = { "1W": 7, "1M": 30, "3M": 91, "1Y": 365, "3Y": 365*3, "5Y": 365*5, "10Y": 365*10 };
                const rangeDays = rangeMap[perfRange];
                let cutoff = rangeDays ? new Date(now.getTime() - rangeDays * 86400000).toISOString().slice(0,10) : null;
                if (perfRange === "1D") {
                  filtered = portfolio.slice(-2);
                } else if (perfRange === "YTD") {
                  const yearEnd = `${now.getFullYear() - 1}-12-31`;
                  const ytdStart = [...portfolio].reverse().find(p => p.date <= yearEnd);
                  filtered = ytdStart ? portfolio.filter(p => p.date >= ytdStart.date) : portfolio.filter(p => p.date >= `${now.getFullYear()}-01-01`);
                } else {
                  filtered = cutoff ? portfolio.filter(p => p.date >= cutoff) : portfolio;
                }
              }
              if (!filtered.length) return null;

              // Normalize portfolio to % change from first point (starts at 0%)
              const baseVal = filtered[0].value;
              const portNorm = filtered.map(p => ({ date: p.date, val: ((p.value / baseVal) - 1) * 100, raw: p.value }));

              // Normalize benchmarks to % change from portfolio start (base 0)
              const bmColors = { IWS: "#4CAF50", DVY: "#FF9800", SPY: "#6B8DE3", DIA: "#C76BDB" };
              const bmNorm = {};
              if (isIntraday) {
                // Use intraday benchmark bars
                const ibm = intradayBenchmarks[perfRange] || {};
                const portStartDate = filtered[0].date;
                Object.entries(ibm).forEach(([sym, pts]) => {
                  if (!perfBmToggles[sym] || !pts.length) return;
                  // Use first intraday bar as base so all lines start at 0%
                  let basePrice = pts[0].close;
                  if (!basePrice) return;
                  // Map benchmark timestamps to portfolio timestamps
                  const bmPoints = [];
                  let ptIdx = 0;
                  for (const fp of filtered) {
                    while (ptIdx < pts.length - 1 && pts[ptIdx + 1].date <= fp.date) ptIdx++;
                    if (pts[ptIdx].date <= fp.date || ptIdx === 0) {
                      bmPoints.push({ date: fp.date, val: ((pts[ptIdx].close / basePrice) - 1) * 100 });
                    }
                  }
                  if (bmPoints.length > 1) bmNorm[sym] = bmPoints;
                });
              } else Object.entries(benchmarks).forEach(([sym, priceMap]) => {
                if (!perfBmToggles[sym]) return;
                const prices = Object.entries(priceMap).sort((a,b) => a[0].localeCompare(b[0]));
                if (!prices.length) return;
                // Find first price on or after portfolio start
                const startDate = filtered[0].date;
                let basePrice = null;
                for (const [d, p] of prices) {
                  if (d >= startDate) { basePrice = p; break; }
                }
                if (!basePrice) return;
                // Map benchmark dates to portfolio dates (nearest Friday match)
                const bmPoints = [];
                let priceIdx = 0;
                for (const pt of filtered) {
                  // Find nearest benchmark price
                  while (priceIdx < prices.length - 1 && prices[priceIdx + 1][0] <= pt.date) priceIdx++;
                  if (prices[priceIdx][0] <= pt.date || priceIdx === 0) {
                    bmPoints.push({ date: pt.date, val: ((prices[priceIdx][1] / basePrice) - 1) * 100 });
                  }
                }
                if (bmPoints.length > 1) bmNorm[sym] = bmPoints;
              });

              // Chart dimensions
              const W = isDesktop ? 1200 : Math.min(window.innerWidth - 36, 900);
              const H = isDesktop ? 480 : 320;
              const PAD = { top: 30, right: 70, bottom: 50, left: 66 };
              const cw = W - PAD.left - PAD.right;
              const ch = H - PAD.top - PAD.bottom;

              // Compute Y range across all series
              let allVals = portNorm.map(p => p.val);
              Object.values(bmNorm).forEach(pts => pts.forEach(p => allVals.push(p.val)));
              const rawMin = Math.min(...allVals);
              const rawMax = Math.max(...allVals);
              const rawSpan = rawMax - rawMin || 1;
              const step = rawSpan <= 2 ? 0.5 : rawSpan <= 5 ? 1 : rawSpan <= 20 ? 2 : rawSpan <= 50 ? 5 : rawSpan <= 100 ? 10 : rawSpan <= 200 ? 20 : rawSpan <= 500 ? 50 : 100;
              const yMin = Math.floor(rawMin / step) * step;
              const yMax = Math.ceil(rawMax / step) * step;
              const yRange = yMax - yMin || 1;

              const xScale = (i) => PAD.left + (i / (portNorm.length - 1)) * cw;
              const yScale = (v) => PAD.top + ch - ((v - yMin) / yRange) * ch;

              // Build SVG path
              const buildPath = (points, key = "val") => {
                if (!points.length) return "";
                return points.map((p, i) => {
                  const x = key === "val" ? xScale(i) : xScale(portNorm.findIndex(pp => pp.date === p.date) ?? i);
                  const y = yScale(p[key] ?? p.val);
                  return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
                }).join(" ");
              };

              // Build benchmark path using portfolio index mapping
              const buildBmPath = (points) => {
                if (!points.length) return "";
                const dateToIdx = {};
                portNorm.forEach((p, i) => { dateToIdx[p.date] = i; });
                return points.map((p, i) => {
                  const idx = dateToIdx[p.date] ?? i;
                  const x = xScale(idx);
                  const y = yScale(p.val);
                  return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
                }).join(" ");
              };

              const portPath = buildPath(portNorm);

              // Grid lines
              const yTicks = [];
              const tickStep = yRange <= 2 ? 0.5 : yRange <= 5 ? 1 : yRange <= 20 ? 2 : yRange <= 50 ? 5 : yRange <= 100 ? 10 : yRange <= 200 ? 20 : yRange <= 500 ? 50 : 100;
              for (let v = yMin; v <= yMax; v += tickStep) yTicks.push(Math.round(v * 100) / 100);

              // X axis date labels
              const xLabels = [];
              const totalPts = portNorm.length;
              const labelCount = isDesktop ? 8 : 5;
              for (let i = 0; i < labelCount; i++) {
                const idx = Math.round((i / (labelCount - 1)) * (totalPts - 1));
                if (idx < totalPts) {
                  const dateStr = portNorm[idx].date;
                  const d = new Date(dateStr.length > 10 ? dateStr : dateStr + "T12:00:00");
                  let label;
                  if (isIntraday && perfRange === "1D") {
                    label = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
                  } else if (isIntraday && perfRange === "1W") {
                    label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
                  } else if (isIntraday) {
                    label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                  } else {
                    label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
                  }
                  xLabels.push({ x: xScale(idx), label });
                }
              }

              // Hover handler
              const handleMouseMove = (e) => {
                const svg = perfSvgRef.current;
                if (!svg) return;
                const rect = svg.getBoundingClientRect();
                const scale = W / rect.width;
                const mx = (e.clientX - rect.left) * scale;
                const idx = Math.round(((mx - PAD.left) / cw) * (portNorm.length - 1));
                if (idx >= 0 && idx < portNorm.length) {
                  setPerfHover({ idx, x: xScale(idx), y: yScale(portNorm[idx].val) });
                }
              };

              // Summary stats — use chart's normalized values so cards always match the chart
              const startVal = filtered[0].value;
              const endVal = isIntraday
                ? (liveValue ? liveValue.value : portfolio[portfolio.length - 1].value)
                : filtered[filtered.length - 1].value;
              const totalReturn = portNorm[portNorm.length - 1].val;
              const dollarChange = endVal - startVal;
              const years = isIntraday ? 0 : (new Date(filtered[filtered.length - 1].date) - new Date(filtered[0].date)) / (365.25 * 86400000);
              const cagr = years > 1 ? (Math.pow(endVal / startVal, 1 / years) - 1) * 100 : 0;

              const periodLabel = { "1D": "Day", "1W": "Week", "1M": "Month" }[perfRange];

              return (
                <>
                  {/* Summary cards */}
                  <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(4, 1fr)" : "repeat(2, 1fr)", gap: 12, marginBottom: 20 }}>
                    {[
                      { label: isIntraday ? "Previous Close" : "Starting Value", value: `$${startVal.toLocaleString(undefined, {maximumFractionDigits: 0})}` },
                      { label: liveValue ? "Live Value" : "Current Value", value: `$${endVal.toLocaleString(undefined, {maximumFractionDigits: 0})}` },
                      { label: isIntraday ? `${periodLabel} Change` : "Total Return", value: `${totalReturn >= 0 ? "+" : ""}${totalReturn.toFixed(2)}%`, color: totalReturn >= 0 ? C.up : C.dn },
                      isIntraday
                        ? { label: "$ Change", value: `${dollarChange >= 0 ? "+$" : "-$"}${Math.abs(dollarChange).toLocaleString(undefined, {maximumFractionDigits: 0})}`, color: dollarChange >= 0 ? C.up : C.dn }
                        : years > 1
                          ? { label: "CAGR", value: `${cagr >= 0 ? "+" : ""}${cagr.toFixed(2)}%`, color: cagr >= 0 ? C.up : C.dn }
                          : { label: "$ Change", value: `${dollarChange >= 0 ? "+$" : "-$"}${Math.abs(dollarChange).toLocaleString(undefined, {maximumFractionDigits: 0})}`, color: dollarChange >= 0 ? C.up : C.dn },
                    ].map((s, i) => (
                      <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 18px" }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: C.t4, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{s.label}</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: s.color || C.t1, fontVariantNumeric: "tabular-nums" }}>{s.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Time range selector + benchmark toggles */}
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      {["1D", "1W", "1M", "3M", "YTD", "1Y", "3Y", "5Y", "10Y", "ALL"].map(r => (
                        <button key={r} onClick={() => setPerfRange(r)} style={{
                          padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                          border: `1px solid ${perfRange === r ? C.borderActive : C.border}`,
                          background: perfRange === r ? C.accentSoft : "transparent",
                          color: perfRange === r ? C.t1 : C.t3, cursor: "pointer", fontFamily: "inherit",
                        }}>{r}</button>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: C.t4, fontWeight: 600 }}>vs</span>
                      {Object.entries(bmColors).map(([sym, color]) => (
                        <button key={sym} onClick={() => setPerfBmToggles(prev => ({ ...prev, [sym]: !prev[sym] }))} style={{
                          padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                          border: `1px solid ${perfBmToggles[sym] ? color + "66" : C.border}`,
                          background: perfBmToggles[sym] ? color + "18" : "transparent",
                          color: perfBmToggles[sym] ? color : C.t4, cursor: "pointer", fontFamily: "inherit",
                        }}>{sym}</button>
                      ))}
                    </div>
                  </div>

                  {/* Chart */}
                  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: isDesktop ? 24 : 12, overflow: "hidden" }}>
                    <div style={{ position: "relative" }}>
                    <svg
                      ref={perfSvgRef}
                      width={W} height={H}
                      viewBox={`0 0 ${W} ${H}`}
                      style={{ width: "100%", height: "auto", display: "block", cursor: "crosshair" }}
                      onMouseMove={handleMouseMove}
                      onMouseLeave={() => setPerfHover(null)}
                      onTouchMove={(e) => {
                        const touch = e.touches[0];
                        const svg = perfSvgRef.current;
                        if (!svg) return;
                        const rect = svg.getBoundingClientRect();
                        const scale = W / rect.width;
                        const mx = (touch.clientX - rect.left) * scale;
                        const idx = Math.round(((mx - PAD.left) / cw) * (portNorm.length - 1));
                        if (idx >= 0 && idx < portNorm.length) setPerfHover({ idx, x: xScale(idx), y: yScale(portNorm[idx].val) });
                      }}
                      onTouchEnd={() => setPerfHover(null)}
                    >
                      {/* Grid lines */}
                      {yTicks.map(v => (
                        <g key={v}>
                          <line x1={PAD.left} y1={yScale(v)} x2={W - PAD.right} y2={yScale(v)}
                            stroke={C.border} strokeWidth="1" />
                          <text x={PAD.left - 8} y={yScale(v) + 4} textAnchor="end"
                            fill={C.t4} fontSize="11" fontFamily="inherit" fontWeight="600">
                            {v}%
                          </text>
                        </g>
                      ))}

                      {/* Zero baseline */}
                      <line x1={PAD.left} y1={yScale(0)} x2={W - PAD.right} y2={yScale(0)}
                        stroke={C.t4} strokeWidth="1" strokeDasharray="4,4" opacity="0.5" />

                      {/* X axis labels */}
                      {xLabels.map((l, i) => (
                        <text key={i} x={l.x} y={H - 10} textAnchor="middle"
                          fill={C.t4} fontSize="11" fontFamily="inherit" fontWeight="600">
                          {l.label}
                        </text>
                      ))}

                      {/* Benchmark lines */}
                      {Object.entries(bmNorm).map(([sym, pts]) => (
                        <path key={sym} d={buildBmPath(pts)} fill="none"
                          stroke={bmColors[sym]} strokeWidth="2" strokeLinejoin="round" />
                      ))}

                      {/* Portfolio gradient fill — from line to zero baseline */}
                      <defs>
                        <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={C.accent} stopOpacity="0.25" />
                          <stop offset="100%" stopColor={C.accent} stopOpacity="0.02" />
                        </linearGradient>
                      </defs>
                      {(() => {
                        const zeroY = Math.min(Math.max(yScale(0), PAD.top), PAD.top + ch);
                        return <path d={`${portPath} L${xScale(portNorm.length-1).toFixed(1)},${zeroY.toFixed(1)} L${PAD.left.toFixed(1)},${zeroY.toFixed(1)} Z`}
                          fill="url(#perfGrad)" />;
                      })()}

                      {/* Portfolio line */}
                      <path d={portPath} fill="none" stroke={C.accent} strokeWidth="2.5" strokeLinejoin="round" />

                      {/* Hover crosshair + tooltip */}
                      {perfHover && perfHover.idx >= 0 && perfHover.idx < portNorm.length && (
                        <g>
                          <line x1={perfHover.x} y1={PAD.top} x2={perfHover.x} y2={PAD.top + ch}
                            stroke={C.t3} strokeWidth="1" strokeDasharray="3,3" opacity="0.5" />
                          <circle cx={perfHover.x} cy={perfHover.y} r="4" fill={C.accent} stroke={C.card} strokeWidth="2" />
                          {/* Benchmark dots */}
                          {Object.entries(bmNorm).map(([sym, pts]) => {
                            const pt = pts.find(p => p.date === portNorm[perfHover.idx]?.date);
                            if (!pt) return null;
                            return <circle key={sym} cx={perfHover.x} cy={yScale(pt.val)} r="3" fill={bmColors[sym]} stroke={C.card} strokeWidth="1.5" />;
                          })}
                        </g>
                      )}

                      {/* Right-side labels — show % change, de-overlap */}
                      {(() => {
                        const labels = [{ val: portNorm[portNorm.length-1].val, color: C.accent, fontSize: 11 }];
                        Object.entries(bmNorm).forEach(([sym, pts]) => {
                          labels.push({ val: pts[pts.length-1].val, color: bmColors[sym], fontSize: 10 });
                        });
                        // Sort by value descending so highest is on top
                        labels.sort((a, b) => b.val - a.val);
                        // De-overlap: ensure at least 12px between labels
                        const positions = labels.map(l => yScale(l.val) + 4);
                        for (let i = 1; i < positions.length; i++) {
                          if (positions[i] - positions[i-1] < 12) positions[i] = positions[i-1] + 12;
                        }
                        return labels.map((l, i) => (
                          <text key={i} x={W - PAD.right + 8} y={positions[i]}
                            fill={l.color} fontSize={l.fontSize} fontWeight="700" fontFamily="inherit">
                            {l.val >= 0 ? "+" : ""}{l.val.toFixed(1)}%
                          </text>
                        ));
                      })()}
                    </svg>

                    {/* Hover tooltip overlay */}
                    {perfHover && perfHover.idx >= 0 && perfHover.idx < portNorm.length && (
                      <div style={{
                        position: "absolute", top: 8, left: PAD.left,
                        pointerEvents: "none", width: cw, height: 0,
                      }}>
                        <div style={{
                          position: "absolute",
                          left: Math.min(Math.max(perfHover.x - PAD.left - 80, 0), cw - 180),
                          top: 0,
                          background: C.elevated || C.card, border: `1px solid ${C.border}`,
                          borderRadius: 10, padding: "10px 14px", minWidth: 160,
                          boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
                        }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, marginBottom: 6 }}>
                            {(() => {
                              const ds = portNorm[perfHover.idx].date;
                              const d = new Date(ds.length > 10 ? ds : ds + "T12:00:00");
                              return isIntraday
                                ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
                                : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                            })()}
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                            <span style={{ fontSize: 12, color: C.accent, fontWeight: 700 }}>Dividend</span>
                            <span style={{ fontSize: 12, color: C.t1, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                              ${portNorm[perfHover.idx].raw.toLocaleString(undefined, {maximumFractionDigits: 0})}
                              <span style={{ color: portNorm[perfHover.idx].val >= 0 ? C.up : C.dn, marginLeft: 6, fontSize: 11 }}>
                                {portNorm[perfHover.idx].val >= 0 ? "+" : ""}{portNorm[perfHover.idx].val.toFixed(1)}%
                              </span>
                            </span>
                          </div>
                          {Object.entries(bmNorm).map(([sym, pts]) => {
                            const pt = pts.find(p => p.date === portNorm[perfHover.idx]?.date);
                            if (!pt) return null;
                            return (
                              <div key={sym} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
                                <span style={{ fontSize: 12, color: bmColors[sym], fontWeight: 600 }}>{sym}</span>
                                <span style={{ fontSize: 12, color: C.t2, fontVariantNumeric: "tabular-nums" }}>
                                  {pt.val >= 0 ? "+" : ""}{pt.val.toFixed(1)}%
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    </div>
                  </div>

                  {/* Legend */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 16, padding: "0 4px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 20, height: 3, borderRadius: 2, background: C.accent }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.t2 }}>IOWN Dividend Strategy</span>
                    </div>
                    {Object.entries(bmColors).map(([sym, color]) => perfBmToggles[sym] && (
                      <div key={sym} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 20, height: 3, borderRadius: 2, background: color }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: C.t3 }}>{{ IWS: "iShares Mid-Cap Value", DVY: "iShares Dividend", SPY: "S&P 500", DIA: "Dow Jones" }[sym]}</span>
                      </div>
                    ))}
                  </div>

                  {/* Data range info */}
                  <div style={{ marginTop: 12, fontSize: 11, color: C.t4, textAlign: "center" }}>
                    {(() => {
                      const fmt = (ds) => {
                        const d = new Date(ds.length > 10 ? ds : ds + "T12:00:00");
                        return isIntraday
                          ? d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) + " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
                          : d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
                      };
                      return `${fmt(filtered[0].date)} — ${fmt(filtered[filtered.length-1].date)}`;
                    })()}
                    {" · "}{filtered.length} {isIntraday ? (perfRange === "1D" ? "1-min" : perfRange === "1W" ? "30-min" : "daily") : ""} data points
                    {liveValue ? " · Live" : ""}
                  </div>

                  {/* ── Trailing Total Returns ── */}
                  {(() => {
                    // Compute returns for various trailing periods from portfolio data
                    const end = portfolio[portfolio.length - 1];
                    if (!end) return null;
                    const endVal = end.value;
                    const endDate = new Date(end.date + "T12:00:00");

                    const trailingPeriods = [
                      { label: "1-Week", days: 7 },
                      { label: "1-Month", days: 30 },
                      { label: "3-Month", days: 91 },
                      { label: "YTD", ytd: true },
                      { label: "1-Year", days: 365 },
                      { label: "3-Year", days: 365 * 3, ann: true },
                      { label: "5-Year", days: 365 * 5, ann: true },
                      { label: "10-Year", days: 365 * 10, ann: true },
                      { label: "Since Inception", all: true, ann: true },
                    ];

                    const getReturn = (p) => {
                      let startPt;
                      if (p.ytd) {
                        const yearEnd = `${now.getFullYear() - 1}-12-31`;
                        startPt = [...portfolio].reverse().find(pt => pt.date <= yearEnd);
                      } else if (p.all) {
                        startPt = portfolio[0];
                      } else {
                        const cutoffDate = new Date(endDate.getTime() - p.days * 86400000).toISOString().slice(0, 10);
                        // Find nearest point on or after cutoff
                        startPt = portfolio.find(pt => pt.date >= cutoffDate);
                        if (!startPt) startPt = portfolio[0];
                      }
                      if (!startPt || startPt.value <= 0) return null;
                      const raw = (endVal / startPt.value - 1) * 100;
                      if (p.ann) {
                        const years = (endDate - new Date(startPt.date + "T12:00:00")) / (365.25 * 86400000);
                        return years > 1 ? (Math.pow(endVal / startPt.value, 1 / years) - 1) * 100 : raw;
                      }
                      return raw;
                    };

                    // Get benchmark returns for same periods
                    const getBmReturn = (sym, p) => {
                      const bmPrices = benchmarks[sym];
                      if (!bmPrices) return null;
                      const prices = Object.entries(bmPrices).sort((a, b) => a[0].localeCompare(b[0]));
                      if (!prices.length) return null;
                      const lastPrice = prices[prices.length - 1][1];
                      const lastDate = new Date(prices[prices.length - 1][0] + "T12:00:00");
                      let startPrice;
                      if (p.ytd) {
                        const yearEnd = `${now.getFullYear() - 1}-12-31`;
                        const found = [...prices].reverse().find(([d]) => d <= yearEnd);
                        startPrice = found ? found[1] : null;
                      } else if (p.all) {
                        startPrice = prices[0][1];
                      } else {
                        const cutoffDate = new Date(lastDate.getTime() - p.days * 86400000).toISOString().slice(0, 10);
                        const found = prices.find(([d]) => d >= cutoffDate);
                        startPrice = found ? found[1] : prices[0][1];
                      }
                      if (!startPrice || startPrice <= 0) return null;
                      const raw = (lastPrice / startPrice - 1) * 100;
                      if (p.ann) {
                        const years = (lastDate - new Date((p.all ? prices[0][0] : new Date(lastDate.getTime() - p.days * 86400000).toISOString().slice(0, 10)) + "T12:00:00")) / (365.25 * 86400000);
                        return years > 1 ? (Math.pow(lastPrice / startPrice, 1 / years) - 1) * 100 : raw;
                      }
                      return raw;
                    };

                    const fmtPct = (v) => v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
                    const pctColor = (v) => v == null ? C.t4 : v >= 0 ? C.up : C.dn;
                    const activeBms = Object.keys(perfBmToggles).filter(s => perfBmToggles[s]);

                    return (
                      <div style={{ marginTop: 28 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: C.t1, marginBottom: 14 }}>Trailing Total Returns</div>
                        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
                          <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
                              <thead>
                                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                                  <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: C.t3, fontSize: 11 }}>Return</th>
                                  {trailingPeriods.map(p => (
                                    <th key={p.label} style={{ padding: "10px 10px", textAlign: "right", fontWeight: 600, color: C.t4, fontSize: 11, whiteSpace: "nowrap" }}>
                                      {p.label}{p.ann ? " (Ann.)" : ""}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                                  <td style={{ padding: "10px 14px", fontWeight: 700, color: C.accent, fontSize: 12 }}>Total</td>
                                  {trailingPeriods.map(p => {
                                    const v = getReturn(p);
                                    return <td key={p.label} style={{ padding: "10px 10px", textAlign: "right", fontWeight: 700, color: pctColor(v) }}>{fmtPct(v)}</td>;
                                  })}
                                </tr>
                                {activeBms.map(sym => (
                                  <tr key={sym} style={{ borderBottom: `1px solid ${C.border}` }}>
                                    <td style={{ padding: "10px 14px", fontWeight: 600, color: bmColors[sym], fontSize: 12 }}>{sym}</td>
                                    {trailingPeriods.map(p => {
                                      const v = getBmReturn(sym, p);
                                      return <td key={p.label} style={{ padding: "10px 10px", textAlign: "right", fontWeight: 600, color: pctColor(v) }}>{fmtPct(v)}</td>;
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* ── Annual Return History ── */}
                        {(() => {
                          const annReturns = perfData.annualReturns || {};
                          const bmAnnReturns = perfData.bmAnnualReturns || {};
                          const years = Object.keys(annReturns).sort();
                          if (!years.length) return null;

                          return (
                            <div style={{ marginTop: 28 }}>
                              <div style={{ fontSize: 15, fontWeight: 800, color: C.t1, marginBottom: 14 }}>Annual Return History</div>
                              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
                                <div style={{ overflowX: "auto" }}>
                                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
                                    <thead>
                                      <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                                        <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: C.t3, fontSize: 11, position: "sticky", left: 0, background: C.card, zIndex: 1 }}>Return %</th>
                                        {years.map(yr => (
                                          <th key={yr} style={{ padding: "10px 10px", textAlign: "right", fontWeight: 600, color: C.t4, fontSize: 11 }}>{yr}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                                        <td style={{ padding: "10px 14px", fontWeight: 700, color: C.accent, fontSize: 12, position: "sticky", left: 0, background: C.card, zIndex: 1 }}>Dividend</td>
                                        {years.map(yr => {
                                          const v = annReturns[yr];
                                          return <td key={yr} style={{ padding: "10px 10px", textAlign: "right", fontWeight: 700, color: pctColor(v) }}>{v != null ? v.toFixed(1) : "—"}</td>;
                                        })}
                                      </tr>
                                      {activeBms.map(sym => (
                                        <tr key={sym} style={{ borderBottom: `1px solid ${C.border}` }}>
                                          <td style={{ padding: "10px 14px", fontWeight: 600, color: bmColors[sym], fontSize: 12, position: "sticky", left: 0, background: C.card, zIndex: 1 }}>{sym}</td>
                                          {years.map(yr => {
                                            const v = (bmAnnReturns[sym] || {})[yr];
                                            return <td key={yr} style={{ padding: "10px 10px", textAlign: "right", fontWeight: 600, color: pctColor(v) }}>{v != null ? v.toFixed(1) : "—"}</td>;
                                          })}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })()}
                </>
              );
            })()}
          </div>
        )}

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
            </div>
            <div style={{ marginTop: 40, textAlign: "center", paddingBottom: 20 }}>
              <div style={{ fontSize: 13, color: C.t4, marginTop: 4 }}>Intentional Ownership</div>
              <div style={{ fontSize: 11, color: C.t4, marginTop: 4 }}>A Registered Investment Advisor under Paradiem</div>
            </div>
          </div>
        )}

      </div>
      </div>

      {/* BRIEF FULL-SCREEN OVERLAY */}
      {briefView && (() => {
        const BRIEFS = [
          { id: "morning", title: "Morning Brief", url: "https://richacarson.github.io/rich-report/morning-briefs.html", color: theme === "dark" ? "#F59E0B" : "#D97706" },
          { id: "commentary", title: "Market Commentary", url: "https://richacarson.github.io/iown-data", color: theme === "dark" ? "#34D399" : "#16A34A" },
          { id: "report", title: "The Rich Report", url: "https://richacarson.github.io/rich-report/The_Rich_Report.html", color: theme === "dark" ? "#6366F1" : "#4F46E5" },
        ];
        const active = BRIEFS.find(b => b.id === briefView);
        if (!active) return null;
        return (
          <div style={{
            position: "fixed", inset: 0, zIndex: 9999, background: C.bg,
            display: "flex", flexDirection: "column",
            paddingTop: "env(safe-area-inset-top, 0px)",
          }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 16px", borderBottom: `1px solid ${C.border}`, flexShrink: 0,
            }}>
              <button onClick={() => setBriefView(null)} style={{
                background: "none", border: "none", color: C.t1, fontSize: 15, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6,
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.t1} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                Back
              </button>
              <span style={{ fontSize: 15, fontWeight: 700, color: C.t1 }}>{active.title}</span>
              <button onClick={() => window.open(active.url, "_blank")} style={{
                background: "none", border: `1px solid ${C.border}`, borderRadius: 8,
                padding: "5px 12px", color: C.t3, fontSize: 11, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
              }}>Open ↗</button>
            </div>
            <iframe
              src={`${active.url}?t=${Math.floor(Date.now() / 60000)}`}
              title={active.title}
              style={{ flex: 1, width: "100%", border: "none", display: "block" }}
              sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads"
            />
          </div>
        );
      })()}

      {/* ARTICLE READER OVERLAY */}
      {selectedArticle && (() => {
        const a = selectedArticle;
        const timeStr = a.created_at ? new Date(a.created_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "";
        return (
          <div style={{
            position: "fixed", inset: 0, zIndex: 9999, background: C.bg,
            display: "flex", flexDirection: "column",
            paddingTop: "env(safe-area-inset-top, 0px)",
          }}>
            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 18px", borderBottom: `1px solid ${C.border}`,
              flexShrink: 0,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={() => setSelectedArticle(null)} style={{
                  background: "none", border: "none", color: C.t1, fontSize: 15, fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6,
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.t1} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                  Back
                </button>
                {a.url && (
                  <button onClick={() => window.open(a.url, "_blank")} style={{
                    background: "none", border: `1px solid ${C.border}`, borderRadius: 8,
                    padding: "5px 12px", color: C.t3, fontSize: 11, fontWeight: 600,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>Open Source ↗</button>
                )}
              </div>
              {CLAUDE_KEY && (
                <button onClick={() => { setArticleContent(null); fetchArticleContent(a); }} style={{
                  background: C.accentSoft, border: `1px solid ${C.borderActive}`, borderRadius: 8,
                  padding: "6px 14px", color: C.t1, fontSize: 12, fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit",
                }}>
                  {articleLoading ? "Generating..." : articleContent ? "Regenerate" : "Generate Summary"}
                </button>
              )}
            </div>
            {/* Content */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 18px", paddingBottom: "calc(env(safe-area-inset-bottom, 20px) + 20px)" }}>
              {/* Source + time */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.accent, textTransform: "uppercase", letterSpacing: 0.5 }}>{a.source}</span>
                <span style={{ fontSize: 12, color: C.t4 }}>{timeStr}</span>
              </div>
              {/* Headline */}
              <h1 style={{ fontSize: 22, fontWeight: 800, color: C.t1, lineHeight: 1.35, margin: "0 0 16px", fontFamily: "inherit" }}>{a.headline}</h1>
              {/* Ticker tags */}
              {a.symbols?.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
                  {a.symbols.filter(s => coreSyms.includes(s)).map(s => (
                    <span key={s} onClick={(e) => { e.stopPropagation(); setSelectedArticle(null); openStock(s); }} style={{
                      fontSize: 12, fontWeight: 700, color: C.accent, background: C.accentSoft,
                      padding: "4px 10px", borderRadius: 6, cursor: "pointer",
                    }}>{s}</span>
                  ))}
                </div>
              )}
              {/* Hero image */}
              {a.images?.[0]?.url && (
                <img src={a.images[0].url} alt="" style={{
                  width: "100%", maxHeight: 280, objectFit: "cover",
                  borderRadius: 14, marginBottom: 20,
                }} />
              )}
              {/* Summary / body */}
              {articleContent ? (
                <div style={{ fontSize: 16, lineHeight: 1.75, color: C.t2, letterSpacing: 0.1 }}>
                  {articleContent.split("\n").map((p, i) => {
                    const trimmed = p.trim();
                    if (!trimmed) return null;
                    if (trimmed.startsWith("## ")) return <h2 key={i} style={{ fontSize: 18, fontWeight: 700, color: C.t1, margin: "24px 0 10px" }}>{trimmed.replace("## ", "")}</h2>;
                    if (trimmed.startsWith("**") && trimmed.endsWith("**")) return <h3 key={i} style={{ fontSize: 17, fontWeight: 700, color: C.t1, margin: "20px 0 8px" }}>{trimmed.replace(/\*\*/g, "")}</h3>;
                    if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) return <div key={i} style={{ display: "flex", gap: 8, margin: "6px 0", paddingLeft: 4 }}><span style={{ color: C.accent, fontWeight: 700 }}>•</span><span>{trimmed.replace(/^[-•]\s*/, "")}</span></div>;
                    return <p key={i} style={{ margin: "0 0 14px" }}>{trimmed}</p>;
                  })}
                </div>
              ) : (
                <>
                  {/* API summary */}
                  {a.summary && (
                    <div style={{ fontSize: 16, lineHeight: 1.7, color: C.t2, letterSpacing: 0.1, marginBottom: 20 }}>
                      {a.summary.split("\n").map((p, i) => p.trim() ? <p key={i} style={{ margin: "0 0 14px" }}>{p}</p> : null)}
                    </div>
                  )}
                  {/* Read Full Article button */}
                  {articleLoading ? (
                    <div style={{ textAlign: "center", padding: "24px 0" }}>
                      <div style={{ width: 24, height: 24, border: `3px solid ${C.border}`, borderTopColor: C.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
                      <div style={{ fontSize: 13, color: C.t4 }}>Extracting full article...</div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* MOBILE BOTTOM TAB BAR */}
      {!isDesktop && (
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
        background: theme === "dark" ? "rgba(12,16,24,0.88)" : "rgba(245,245,240,0.92)", backdropFilter: "blur(28px) saturate(1.4)", WebkitBackdropFilter: "blur(28px) saturate(1.4)",
        borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-around",
        padding: "6px 0", paddingBottom: "calc(env(safe-area-inset-bottom, 8px) + 6px)",
      }}>
        {["home", "performance", "research", "calendar", "clients"].map(id => navItems.find(t => t.id === id)).filter(Boolean).map(t => (
          <button key={t.id} onClick={() => { handleTabTap(t.id); setMoreMenu(false); }} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            padding: "6px 12px", background: "transparent", border: "none", cursor: "pointer",
          }}>
            {t.icon(tab === t.id)}
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.3, color: tab === t.id ? C.t1 : C.t4 }}>{t.label}</span>
            <div style={{ width: tab === t.id ? 4 : 0, height: 4, borderRadius: 2, background: C.accent, marginTop: -2, transition: "width 0.2s cubic-bezier(0.16,1,0.3,1)", boxShadow: tab === t.id ? `0 0 8px ${C.accentGlow}` : "none" }} />
          </button>
        ))}
      </div>
      )}
      {/* MOBILE SLIDE-OUT DRAWER */}
      {!isDesktop && moreMenu && (
        <>
          <div onClick={() => setMoreMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,0.5)" }} />
          <div style={{
            position: "fixed", top: 0, left: 0, bottom: 0, width: 280, zIndex: 9999,
            background: C.surface, borderRight: `1px solid ${C.border}`,
            display: "flex", flexDirection: "column",
            paddingTop: "calc(env(safe-area-inset-top, 20px) + 16px)",
            animation: "slideInLeft 0.25s cubic-bezier(0.16,1,0.3,1)",
          }}>
            <style>{`@keyframes slideInLeft { from { transform: translateX(-100%); } to { transform: translateX(0); } }`}</style>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px 16px", borderBottom: `1px solid ${C.border}` }}>
              <img src={theme === "dark" ? "iown-logo-dark.png" : "iown-logo.png"} alt="IOWN" style={{ height: 36 }} />
              <button onClick={() => setMoreMenu(false)} style={{
                width: 32, height: 32, borderRadius: 16, background: C.t4 + "15",
                border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.t3} strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <nav style={{ flex: 1, padding: "12px 0", overflowY: "auto" }}>
              {navItems.map(t => (
                <button key={t.id} onClick={() => { handleTabTap(t.id); setMoreMenu(false); }} style={{
                  display: "flex", alignItems: "center", gap: 14, width: "100%",
                  padding: "14px 24px", background: tab === t.id ? C.accentSoft : "transparent",
                  border: "none", borderLeft: tab === t.id ? `3px solid ${C.accent}` : "3px solid transparent",
                  cursor: "pointer", transition: "all 0.15s", fontFamily: "inherit",
                }}>
                  {t.icon(tab === t.id)}
                  <span style={{ fontSize: 14, fontWeight: tab === t.id ? 700 : 500, color: tab === t.id ? C.t1 : C.t3 }}>{t.label}</span>
                </button>
              ))}
            </nav>
            <div style={{ padding: "16px 24px", borderTop: `1px solid ${C.border}`, paddingBottom: "calc(env(safe-area-inset-bottom, 16px) + 16px)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: marketStatus.color, boxShadow: `0 0 6px ${marketStatus.color}66` }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: C.t2 }}>{marketStatus.label}</span>
              </div>
              <div style={{ fontSize: 11, color: C.t4 }}>{lastUp ? `Updated ${lastUp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}</div>
            </div>
          </div>
        </>
      )}

      {/* Context menu for stock quick-nav */}
      {ctxMenu && (
        <>
          <div onClick={() => setCtxMenu(null)} style={{ position: "fixed", inset: 0, zIndex: 10000, background: isDesktop ? "transparent" : "rgba(0,0,0,0.4)" }} />
          <div style={isDesktop ? {
            position: "fixed", left: Math.min(ctxMenu.x, window.innerWidth - 180), top: Math.min(ctxMenu.y, window.innerHeight - 220),
            zIndex: 10001, background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 12, padding: "6px 0", minWidth: 170,
            boxShadow: "0 8px 32px rgba(0,0,0,0.25)", backdropFilter: "blur(20px)",
          } : {
            position: "fixed", bottom: 0, left: 0, right: 0,
            zIndex: 10001, background: C.card, border: `1px solid ${C.border}`,
            borderRadius: "16px 16px 0 0", padding: "6px 0",
            paddingBottom: "calc(env(safe-area-inset-bottom, 8px) + 6px)",
            boxShadow: "0 -8px 32px rgba(0,0,0,0.25)", backdropFilter: "blur(20px)",
            animation: "slideUp 0.2s cubic-bezier(0.16,1,0.3,1)",
          }}>
            <div style={{ padding: isDesktop ? "8px 14px" : "12px 18px", fontSize: isDesktop ? 13 : 16, fontWeight: 700, color: C.t1, borderBottom: `1px solid ${C.border}` }}>
              {ctxMenu.sym} — {names?.[ctxMenu.sym] || ""}
            </div>
            {[
              { id: "overview", label: "Overview", icon: "📊" },
              { id: "chart", label: "Chart", icon: "📈" },
              { id: "financials", label: "Financials", icon: "💰" },
              { id: "news", label: "News", icon: "📰" },
            ].map(t => (
              <div key={t.id} onClick={() => openStock(ctxMenu.sym, t.id)} style={{
                padding: isDesktop ? "10px 14px" : "14px 18px", fontSize: isDesktop ? 14 : 16, color: C.t2, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 12,
                borderBottom: t.id !== "news" ? `1px solid ${C.border}22` : "none",
              }}
              onMouseEnter={(e) => { if (isDesktop) e.currentTarget.style.background = C.accentSoft; }}
              onMouseLeave={(e) => { if (isDesktop) e.currentTarget.style.background = "transparent"; }}>
                <span style={{ fontSize: isDesktop ? 16 : 20 }}>{t.icon}</span>
                <span style={{ fontWeight: 500 }}>{t.label}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {chartSymbol && <StockProfile symbol={chartSymbol} initTab={profileInitTab} onClose={() => { setChartSymbol(null); setProfileInitTab("overview"); }} hdrs={hdrs} names={names} theme={theme} quotesRef={quotesRef} barsRef={barsRef} fundamentals={fundamentals} news={[...news, ...broadNews]} coreSyms={coreSyms} />}
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
      #root { user-select: none; -webkit-user-select: none; }
      input, textarea, [contenteditable] { user-select: text; -webkit-user-select: text; }
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
