import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from "react";

/* ═══════════════════════════════════════════════════════════════════
   PARADIEM COMMAND CENTER
   - Robinhood-style collapsible sleeve lists
   - Live news feed from Alpaca/Benzinga
   - Company names from /v2/assets
   - Historical bars for richer sparklines
   - WebSocket real-time streaming
   ═══════════════════════════════════════════════════════════════════ */

const DEFAULT_SLEEVES = {
  dividend: { name: "Dividend Strategy", symbols: ["ABT","ADI","ATO","ADP","BKH","CAT","CHD","CL","DVN","FAST","GD","GPC","LRCX","LMT","NEE","NTR","ORI","PCAR","QCOM","DGX","SSNC","STLD","SYK","TEL","VLO"], icon: "💰" },
  growth: { name: "Growth Strategy", symbols: ["AMD","AEM","ATAT","CVX","CWAN","CNX","COIN","CRDO","EIX","FCX","FTNT","SUPV","HRMY","HUT","HOOD","KEYS","MARA","MRVL","NVDA","NXPI","OKE","SYF","TSM","TOL","VST"], icon: "🚀" },
  digital: { name: "Digital Assets", symbols: ["IBIT","ETHA"], icon: "₿" },
  sectors: { name: "Sectors", symbols: ["XLY","XLP","XLE","XLF","XLV","XLI","XLB","XLRE","XLK","XLC","XLU"], icon: "📊" },
  fci100: { name: "FCI 100", symbols: ["NVDA","MSFT","GOOGL","TSM","META","CDNS","QCOM","AMD","MRVL","GOOG","KLAC","AMAT","GE","BAM","AAPL","CRM","NOW","KEYS","AZN","SHOP","LLY","VRT","ASML","XYL","CRDO","NEE","AMZN","APH","CEG","NVT","JPM","COST","ETN","RMBS","AGI","RCL","MCD","KKR","MA","CLS","HLT","NRG","MU","ZS","JNJ","ANET","LRCX","SAP","ISRG","VRTX","RMD","MSI","PLTR","NU","INTU","DDOG","CSCO","AVGO","PTC","ADI","LNG","CB","SYK","LITE","PNFP","GEV","AEM","EMBJ","ECL","VEEV","GLW","SNPS","VIST","GMAB","TTMI","ICE","BE","NBIX","ALAB","NXT","FCX","MOD","SCHW","ORCL","ADBE","CPRT","FIG","HD","ARM","SPGI","LMND","INOD","PANW","YUMC","AMGN","LIN","CAT","SE","NFLX","MDA"], icon: "🏆" },
  fciValues: { name: "FCI Values 100", symbols: ["NVDA","TSM","CDNS","QCOM","MRVL","KLAC","AMAT","GE","BAM","NOW","KEYS","SHOP","LLY","VRT","ASML","XYL","CRDO","NEE","APH","CEG","NVT","ETN","RMBS","AGI","RCL","MCD","CLS","NRG","MU","ZS","ANET","LRCX","SAP","ISRG","RMD","MSI","PLTR","NU","DDOG","CSCO","AVGO","PTC","ADI","LNG","CB","SYK","LITE","PNFP","GEV","AEM","EMBJ","VEEV","GLW","SNPS","VIST","GMAB","TTMI","ICE","BE","NBIX","ALAB","NXT","FCX","MOD","SCHW","CPRT","FIG","HD","ARM","SPGI","LMND","INOD","PANW","YUMC","AMGN","LIN","CAT","SE","MDA","DECK","CLBT","WDC","PGR","SERV","YOU","IBN","AWK","DT","BSY","DE","KTOS","TOST","VST","DOV","PWR","CNI","FTNT","CP","MBLY","TXN"], icon: "✝️" },
};
const TARGET_WEIGHTS = {
  dividend: { CAT:4.0, FAST:4.0, GD:4.0, LMT:3.0, PCAR:3.0, ADI:2.5, ADP:2.5, LRCX:2.5, QCOM:2.5, SSNC:2.5, TEL:2.5, STLD:7.0, NTR:7.0, CHD:6.0, CL:6.0, ATO:4.0, BKH:4.0, NEE:4.0, DVN:6.0, VLO:6.0, ABT:3.0, DGX:3.0, SYK:3.0, GPC:4.0, ORI:4.0 },
  growth: { AMD:4.0, CRDO:4.0, CWAN:4.0, FTNT:4.0, KEYS:4.0, MRVL:4.0, NVDA:4.0, NXPI:4.0, TSM:4.0, COIN:3.0, HOOD:3.0, HUT:3.0, MARA:3.0, SYF:3.0, SUPV:3.0, CNX:4.0, CVX:4.0, OKE:4.0, AEM:6.0, FCX:6.0, EIX:6.0, VST:6.0, ATAT:3.0, TOL:3.0, HRMY:4.0 },
};
const REBALANCE_DATE = "2026-04-08";
const REBALANCE_ANCHORS = {
  // 4/8/26 OPEN prices from Yahoo Finance
  ABT:103.13, ADI:345.81, ADP:204.51, ATO:186.7, BKH:73.03, CAT:764.62, CHD:93.0, CL:83.75, DVN:44.13, DGX:196.18,
  FAST:46.41, GD:346.86, GPC:106.62, LMT:612.27, LRCX:242.75, NEE:93.08, NTR:70.62, ORI:40.45, PCAR:120.3, QCOM:128.65,
  SSNC:69.99, STLD:184.13, SYK:336.29, TEL:220.74, VLO:235.0,
  AEM:220.35, AMD:232.12, ATAT:37.2, CNX:38.1, COIN:187.89, CRDO:160.69, CVX:191.41, CWAN:24.04, EIX:72.97, FCX:70.21,
  FTNT:85.1, HOOD:76.8, HRMY:28.11, HUT:57.08, KEYS:312.75, MARA:9.51, MRVL:139.69, NVDA:184.5, NXPI:205.95, OKE:85.45,
  SUPV:9.88, SYF:72.18, TOL:139.21, TSM:370.29, VST:163.46,
  IBIT:41.08, ETHA:17.06,
  // Q1 sold stocks
  A:115.98, MATX:174.8, GFI:52.77, FINV:5.17, PDD:102.51,
};
const loadAnchorPrices = () => ({ date: REBALANCE_DATE, prices: REBALANCE_ANCHORS });
const saveAnchorPrices = () => {}; // No-op — anchors are hardcoded
const loadSleeves = () => {
  try {
    const s = localStorage.getItem("iown_sleeves");
    if (!s) return DEFAULT_SLEEVES;
    const parsed = JSON.parse(s);
    // Migrate old icons to new defaults if user hasn't customized
    const oldIcons = ["🏌️", "⏳", "💣"];
    for (const [k, def] of Object.entries(DEFAULT_SLEEVES)) {
      if (parsed[k] && oldIcons.includes(parsed[k].icon)) parsed[k].icon = def.icon;
      // Auto-add any new default sleeves that don't exist yet
      if (!parsed[k]) parsed[k] = def;
      // Sync symbols with defaults: always use DEFAULT_SLEEVES symbols for core sleeves
      if (parsed[k]) parsed[k].symbols = def.symbols;
    }
    return parsed;
  } catch { return DEFAULT_SLEEVES; }
};
const saveSleeves = s => { try { localStorage.setItem("iown_sleeves", JSON.stringify(s)); } catch {} };
const getAllSyms = sleeves => [...new Set(Object.values(sleeves).flatMap(s => s.symbols))];
const CORE_KEYS = ["dividend", "growth", "digital", "fci100", "fciValues"];
const getCoreSyms = sleeves => [...new Set(CORE_KEYS.flatMap(k => sleeves[k]?.symbols || []))];
const BENCHMARKS = [
  { sym: "DVY", name: "DVY" },
  { sym: "IUSG", name: "IUSG" },
  { sym: "SPY", name: "SPY" },
  { sym: "QQQ", name: "QQQ" },
  { sym: "DIA", name: "DIA" },
];
const BM_SYMS = BENCHMARKS.map(b => b.sym);
const NON_IEX_BM = ["IUSG", "DVY"];
const IEX_BM = BM_SYMS.filter(s => !NON_IEX_BM.includes(s));
const BASE = "https://data.alpaca.markets";
const PAPER = "https://paper-api.alpaca.markets";
const EK = import.meta.env.VITE_ALPACA_KEY || "";
const ES = import.meta.env.VITE_ALPACA_SECRET || "";
const FK = import.meta.env.VITE_FMP_KEY || "";
const FH = import.meta.env.VITE_FINNHUB_KEY || "";
const FRED = import.meta.env.VITE_FRED_KEY || "";
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
  bg: "#0B0820", surface: "#141033", card: "#1C1840", cardHover: "#241F4F", elevated: "#2B2560",
  border: "rgba(252,212,50,0.10)", borderHover: "rgba(252,212,50,0.20)", borderActive: "rgba(252,212,50,0.35)",
  t1: "#F0EAD8", t2: "#B5AB95", t3: "#7E7560", t4: "#4A4338",
  up: "#34D399", upSoft: "#34D39920", upGlow: "#34D39940",
  dn: "#F87171", dnSoft: "#F8717120", dnGlow: "#F8717140",
  accent: "#FCD432", accentSoft: "rgba(252,212,50,0.10)", accentGlow: "rgba(252,212,50,0.28)",
  nav: "#141033", navText: "#F0EAD8", navTextDim: "#B5AB95", navTextMuted: "#7E7560",
  navBorder: "rgba(252,212,50,0.10)", navAccentSoft: "rgba(252,212,50,0.12)",
  shadow: "0 2px 8px rgba(0,0,0,0.3)",
};
const LIGHT = {
  bg: "#EAE9E2", surface: "#F2F1EB", card: "#F2F1EB", cardHover: "#E6E5DE", elevated: "#F2F1EB",
  border: "rgba(25,22,53,0.12)", borderHover: "rgba(25,22,53,0.22)", borderActive: "rgba(25,22,53,0.40)",
  t1: "#191635", t2: "#3D3859", t3: "#6E6A82", t4: "#9E9AAE",
  up: "#16A34A", upSoft: "#16A34A18", upGlow: "#16A34A30",
  dn: "#DC2626", dnSoft: "#DC262618", dnGlow: "#DC262630",
  accent: "#C9A015", accentSoft: "rgba(201,160,21,0.10)", accentGlow: "rgba(201,160,21,0.22)",
  nav: "#191635", navText: "#F4F4F0", navTextDim: "#A8A3BD", navTextMuted: "#6E6A82",
  navBorder: "rgba(244,244,240,0.10)", navAccentSoft: "rgba(252,212,50,0.18)",
  shadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
};
const TERMINAL = {
  bg: "#08051A", surface: "#100D2B", card: "#1A1640", cardHover: "#221E4F", elevated: "#2A2660",
  border: "rgba(252,212,50,0.14)", borderHover: "rgba(252,212,50,0.24)", borderActive: "rgba(252,212,50,0.55)",
  t1: "#FFF5D0", t2: "#C0B292", t3: "#7A7158", t4: "#4A4338",
  up: "#4AF6C3", upSoft: "#4AF6C318", upGlow: "#4AF6C330",
  dn: "#FF433D", dnSoft: "#FF433D18", dnGlow: "#FF433D30",
  accent: "#FCD432", accentSoft: "rgba(252,212,50,0.15)", accentGlow: "rgba(252,212,50,0.32)",
  nav: "#100D2B", navText: "#FFF5D0", navTextDim: "#C0B292", navTextMuted: "#7A7158",
  navBorder: "rgba(252,212,50,0.14)", navAccentSoft: "rgba(252,212,50,0.18)",
  shadow: "none",
  isTerminal: true,
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
  // Cap at 50 (5 rows × 10 cols)
  const limited = cells.slice(0, 50);

  const maxAbs = Math.max(...limited.map(c => Math.abs(c.chg)), 1);

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

  if (!limited.length) return null;

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(10, 1fr)",
      gap: 3, borderRadius: 14, overflow: "hidden",
    }}>
      {limited.map(cell => {
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
  NTR:"nutrien.com",DVN:"devonenergy.com",FCX:"fcx.com",CRDO:"credosemi.com",VST:"vistracorp.com",MRVL:"marvell.com",
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
    const sectorEmojis = { XLY: "🛍️", XLP: "🛒", XLE: "⛽", XLF: "🏦", XLV: "🏥", XLI: "🏗️", XLB: "⛏️", XLRE: "🏠", XLK: "💻", XLC: "📡", XLU: "💡" };
    if (sectorEmojis[symbol]) {
      return (
        <div style={{ width: size, height: size, borderRadius: size / 2, background: C.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ fontSize: size * 0.5 }}>{sectorEmojis[symbol]}</span>
        </div>
      );
    }
    const colors = ["#191635","#3B82F6","#8B5CF6","#EC4899","#F59E0B","#10B981","#6366F1","#F97316"];
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
function StockProfile({ symbol, initTab, onClose, onViewReport, hdrs, names, theme, quotesRef, barsRef, fundamentals, news, coreSyms }) {
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

  const isDark = theme !== "light";

  // Fetch profile data
  useEffect(() => {
    const fetchProfile = async () => {
      setProfileLoading(true);
      try {
        // Load static company description
        try {
          const descR = await fetch(`${import.meta.env.BASE_URL}company-descriptions.json?v=${Date.now()}`);
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
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {onViewReport && <button onClick={() => onViewReport(symbol)} style={{ background: C.accentSoft, border: `1px solid ${C.borderActive}`, borderRadius: 8, padding: "6px 12px", color: C.t1, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>Screener Report</button>}
            <button onClick={onClose} style={{
              width: 32, height: 32, borderRadius: 16, background: C.t4 + "15",
              border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.t3} strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
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
            src={`https://s.tradingview.com/widgetembed/?frameElementId=tv_chart&symbol=${symbol}&interval=D&hidesidetoolbar=0&symboledit=0&saveimage=0&toolbarbg=${C.card.replace("#","")}&studies=%5B%7B%22id%22%3A%22MASimple%40tv-basicstudies%22%2C%22inputs%22%3A%7B%22length%22%3A50%7D%7D%2C%7B%22id%22%3A%22MASimple%40tv-basicstudies%22%2C%22inputs%22%3A%7B%22length%22%3A200%7D%7D%5D&theme=${isDark ? "dark" : "light"}&style=1&timezone=America%2FNew_York&withdateranges=1&showpopupbutton=0&studies_overrides={}&overrides={"paneProperties.background"%3A"%23${C.card.replace("#","")}"%2C"paneProperties.backgroundType"%3A"solid"}&enabled_features=%5B%22header_chart_type%22%2C%22header_indicators%22%2C%22header_screenshot%22%2C%22header_undo_redo%22%5D&disabled_features=[]&locale=en`}
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
                <StatRow label="PEG Ratio" value={fmt(f.pegTTM ?? fm["pegTTM"] ?? fm["pegAnnual"])} />
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
  const [anchorPrices, setAnchorPrices] = useState(loadAnchorPrices);
  const [liveWeights, setLiveWeights] = useState({});
  const [names, setNames] = useState({});
  const [sleeves, setSleeves] = useState(loadSleeves);
  const sleevesRef = useRef(sleeves);
  useEffect(() => { sleevesRef.current = sleeves; }, [sleeves]);

  // Live weight tracking: compute drifted weights from hardcoded rebalance anchors
  useEffect(() => {
    const allTargetSyms = [...new Set([...Object.keys(TARGET_WEIGHTS.dividend || {}), ...Object.keys(TARGET_WEIGHTS.growth || {})])];
    const quotedSyms = allTargetSyms.filter(s => quotes[s]?.p > 0);
    if (quotedSyms.length < allTargetSyms.length * 0.8) return; // wait for most quotes
    const prices = REBALANCE_ANCHORS;
    const newLive = {};
    for (const [sleeve, tw] of Object.entries(TARGET_WEIGHTS)) {
      const syms = Object.keys(tw);
      let totalDrifted = 0;
      const drifted = {};
      for (const s of syms) {
        const anchor = prices[s] || quotes[s]?.p;
        const current = quotes[s]?.p;
        if (anchor && current) {
          const growth = current / anchor;
          drifted[s] = tw[s] * growth;
          totalDrifted += drifted[s];
        } else {
          drifted[s] = tw[s];
          totalDrifted += tw[s];
        }
      }
      if (totalDrifted > 0) {
        newLive[sleeve] = {};
        for (const s of syms) {
          newLive[sleeve][s] = Math.round((drifted[s] / totalDrifted) * 1000) / 10;
        }
      }
    }
    setLiveWeights(newLive);
  }, [quotes, anchorPrices]);
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
  const [researchReports, setResearchReports] = useState([]);
  const [researchView, setResearchView] = useState(null); // null = list, or report id
  const [researchContent, setResearchContent] = useState("");
  const [researchOpenFolders, setResearchOpenFolders] = useState({}); // { category: true/false }
  const contentRef = useRef(null);
  const tabSwipeRef = useRef(null);
  const tabIds = ["home", "performance", "metrics", "charts", "news", "briefs", "research", "playbook", "screener", "opportunities", "settings"];
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
  const [chartsActiveSym, setChartsActiveSym] = useState(null); // for Charts tab
  const [chartsMobileList, setChartsMobileList] = useState(false); // mobile watchlist toggle
  const [layoutMode, setLayoutMode] = useState(() => localStorage.getItem("iown_layout") || "classic");
  const [terminalActiveSym, setTerminalActiveSym] = useState("__portfolio__");
  const [tChartHover, setTChartHover] = useState(null);
  const [tChartRange, setTChartRange] = useState("YTD");
  const [terminalSleeve, setTerminalSleeve] = useState("dividend");
  const [tChartSleeve, setTChartSleeve] = useState("dividend");
  const [tDrawer, setTDrawer] = useState(null);
  const [ctxMenu, setCtxMenu] = useState(null); // { sym, x, y }
  const [screenerData, setScreenerData] = useState([]);
  const [screenerSleeve, setScreenerSleeve] = useState(null); // null = set on first load
  const [screenerSearch, setScreenerSearch] = useState("");
  const [screenerTypeFilter, setScreenerTypeFilter] = useState("All"); // "All" | "Dividend" | "Growth"
  const [screenerRecFilter, setScreenerRecFilter] = useState("All"); // "All" | "BUY" | "HOLD" | "WATCH" | "SELL"
  const screenerListRef = useRef(null);
  const [scrScrollTop, setScrScrollTop] = useState(0);
  const [screenerDetail, setScreenerDetail] = useState(null); // full report object
  const [screenerDetailLoading, setScreenerDetailLoading] = useState(false);
  const screenerFetched = useRef(false);
  const [opportunities, setOpportunities] = useState([]);
  const [oppExpandedThesis, setOppExpandedThesis] = useState({});
  const [oppExpandedRisks, setOppExpandedRisks] = useState({});
  const [oppDetail, setOppDetail] = useState(null);
  const oppFetched = useRef(false);

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
  const getAutoTheme = () => {
    try {
      const now = new Date();
      const etHour = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" })).getHours();
      // Light during market hours (7 AM - 4 PM ET), dark otherwise
      return (etHour >= 16 || etHour < 7) ? "dark" : "light";
    } catch { return "dark"; }
  };
  const [theme, setTheme] = useState(() => {
    try {
      // "iown_theme_locked" = user explicitly chose a default; "iown_theme" = session toggle
      const locked = localStorage.getItem("iown_theme_locked");
      if (locked) return locked;
      return getAutoTheme();
    } catch { return "dark"; }
  });
  C = theme === "terminal" ? TERMINAL : theme === "light" ? LIGHT : DARK;
  // Toggle theme for this session only (doesn't change default)
  const toggleTheme = (t) => { setTheme(t); };
  // Lock theme as permanent default
  const lockTheme = (t) => { setTheme(t); try { localStorage.setItem("iown_theme_locked", t); } catch {} };
  // Reset to auto (market-hours based)
  const resetThemeAuto = () => { try { localStorage.removeItem("iown_theme_locked"); } catch {} setTheme(getAutoTheme()); };
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
  const [metricsView, setMetricsView] = useState("dividend"); // sleeve key
  const [metricSort, setMetricSort] = useState({ col: null, dir: "desc" }); // { col: "peTTM", dir: "asc"|"desc" }
  const [metricsEditMode, setMetricsEditMode] = useState(false);
  const [peerSymbol, setPeerSymbol] = useState(null); // for peer comparison overlay
  const [metricsSubView, setMetricsSubView] = useState("table"); // "table" | "attribution" | "peers" | "sector" | "scatter" | "yieldheat"
  const [sectorExpanded, setSectorExpanded] = useState({});
  const [metricsTickerInput, setMetricsTickerInput] = useState("");
  const [homeView, setHomeView] = useState("lists"); // "holdings" | "lists"
  const [holdingsSleeve, setHoldingsSleeve] = useState("dividend"); // which sleeve to show in holdings
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
  const [perfView, setPerfView] = useState("chart"); // "chart" | "holdings"
  const [perfSleeve, setPerfSleeve] = useState("dividend"); // "dividend" | "growth" | "digital"
  const [perfDataMap, setPerfDataMap] = useState({}); // { dividend: {...}, growth: {...} }
  const [perfData, setPerfData] = useState(null); // { portfolio: [...], benchmarks: { SPY: [...], ... }, holdings: {}, cash: 0 }
  const [perfRange, setPerfRange] = useState("YTD"); // "1D" | "YTD" | "QTD" | "1Y" | "3Y" | "5Y" | "10Y" | "ALL"
  const [perfHover, setPerfHover] = useState(null); // { idx, x, y } for tooltip
  const [perfLoading, setPerfLoading] = useState(false);
  const [pbView, setPbView] = useState("regime");
  const [pbSimDrop, setPbSimDrop] = useState(30);
  const [pbSimValue, setPbSimValue] = useState(1000000);
  const [pbSimHistBear, setPbSimHistBear] = useState("");
  const [macroData, setMacroData] = useState({ yieldSpread: null, vix: null, hySpread: null, spy200: null, cape: null, loaded: false });
  const SLEEVE_BM_DEFAULTS = { dividend: { DVY: true, SPY: true, DIA: false }, growth: { IUSG: true, SPY: true, QQQ: false }, fci100: { SPY: true, QQQ: false, DIA: false }, fciValues: { SPY: true, QQQ: false, DIA: false } };
  const [perfBmToggles, setPerfBmToggles] = useState(SLEEVE_BM_DEFAULTS.dividend);
  const [liveValue, setLiveValue] = useState(null); // { value, stocks, cash } — live portfolio total from WebSocket
  const [intradayPortfolio, setIntradayPortfolio] = useState({}); // { "1D": [{date, value}] }
  const [intradayBenchmarks, setIntradayBenchmarks] = useState({}); // { "1D": { SPY: [{date, close}], ... }, "1W": ..., "1M": ... }
  const perfSvgRef = useRef(null);
  const iRef = useRef(null);
  const wsRef = useRef(null);
  const fhWsRef = useRef(null);

  const ALL = useMemo(() => {
    const base = getAllSyms(sleeves);
    // Also include tickers from performance holdings so live value calculator works even when holdings differ from DEFAULT_SLEEVES
    const perfHoldings = Object.values(perfDataMap).flatMap(d => Object.keys(d.holdings || {}));
    // Include Q1 stocks for Q1 vs Q2 comparison (sold stocks still need quotes)
    const q1Stocks = ["A","MATX","GFI","FINV","PDD"];
    return [...new Set([...base, ...perfHoldings, ...q1Stocks])];
  }, [sleeves, perfDataMap]);
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
            const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(s)}&token=${FH}`);
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
      // Store in refs for WebSocket callbacks — preserve benchmark refs from Finnhub
      for (const s of Object.keys(nq)) {
        quotesRef.current[s] = nq[s];
      }
      barsRef.current = { ...barsRef.current, ...nb };

      // Always update React state — let React own the DOM
      const pq = {}, pb = {}, bmq = {}, bmb = {};
      for (const s of Object.keys(nq)) {
        if (BM_SYMS.includes(s)) bmq[s] = nq[s]; else pq[s] = nq[s];
      }
      for (const s of Object.keys(nb)) {
        if (BM_SYMS.includes(s)) bmb[s] = nb[s]; else pb[s] = nb[s];
      }
      setQuotes(pq); setBars(pb); setBmQuotes(prev => ({ ...prev, ...bmq })); setBmBars(prev => ({ ...prev, ...bmb }));

      // Update timestamp
      const now = new Date();
      if (!lastUpRef.current || now - lastUpRef.current > 3000) {
        lastUpRef.current = now;
        setLastUp(now);
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
  const [calendarLoading, setCalendarLoading] = useState(true);
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
          // Hardcoded sector overrides for holdings that Finnhub miscategorizes
          const SECTOR_OVERRIDES = {
            "ABT": "Healthcare", "DGX": "Healthcare", "SYK": "Healthcare", "HRMY": "Healthcare",
            "ADI": "Technology", "QCOM": "Technology", "TEL": "Technology", "LRCX": "Technology", "KEYS": "Technology", "NXPI": "Technology", "TSM": "Technology", "AMD": "Technology", "NVDA": "Technology", "FTNT": "Technology", "SSNC": "Technology", "CWAN": "Technology",
            "CAT": "Industrials", "GD": "Industrials", "LMT": "Industrials", "FAST": "Industrials", "PCAR": "Industrials",
            "ADP": "Technology", "ATO": "Utilities", "BKH": "Utilities", "NEE": "Utilities", "EIX": "Utilities", "VST": "Utilities",
            "OKE": "Energy", "VLO": "Energy", "CVX": "Energy", "CNX": "Energy", "DVN": "Energy",
            "CHD": "Consumer Staples", "CL": "Consumer Staples",
            "GPC": "Consumer Disc.", "TOL": "Consumer Disc.", "ATAT": "Consumer Disc.",
            "ORI": "Financials", "SYF": "Financials", "SUPV": "Financials",
            "COIN": "Financials", "HOOD": "Financials", "HUT": "Financials", "MARA": "Financials",
            "AEM": "Materials", "NTR": "Materials", "FCX": "Materials", "STLD": "Materials",
            "CRDO": "Technology", "MRVL": "Technology",
            "IBIT": "Digital Assets", "ETHA": "Digital Assets",
          };
          if (SECTOR_OVERRIDES[sym]) {
            profileSector = SECTOR_OVERRIDES[sym];
          } else {
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
            else if (ind.includes("food") || ind.includes("beverage") || ind.includes("household") || ind.includes("tobacco")) profileSector = "Consumer";
            else if (ind.includes("crypto") || ind.includes("digital") || ind.includes("blockchain")) profileSector = "Digital Assets";
            else if (ind.includes("transport") || ind.includes("logistic") || ind.includes("shipping") || ind.includes("freight")) profileSector = "Industrials";
            else if (ind.includes("service") || ind.includes("consult")) profileSector = "Industrials";
            else profileSector = profileIndustry || "Uncategorized";
          }
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
          dps: m.dividendPerShareAnnual ?? null,
          payoutRatio: m.payoutRatioTTM ?? m.payoutRatioAnnual ?? null,
          revenueYoY: m.revenueGrowthQuarterlyYoy ?? m.revenueGrowthTTMYoy ?? null,
          revenue5Y: m.revenueGrowth5Y ?? null,
          profitMargin: m.netProfitMarginTTM ?? m.netProfitMarginAnnual ?? null,
          roe: m.roeTTM ?? m.roeAnnual ?? null,
          de: m["totalDebt/totalEquityQuarterly"] ?? m["longTermDebt/equityQuarterly"] ?? null,
          beta: m.beta ?? null,
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

  /* ── Fetch macro indicators for bear probability composite ── */
  useEffect(() => {
    const fetchMacro = async () => {
      const results = {};
      const d300 = new Date(Date.now() - 300 * 86400000).toISOString().slice(0, 10);

      const fetches = [];

      // 1. Static macro data (FRED + FMP, updated by GitHub Actions — no CORS issues)
      fetches.push((async () => {
        try {
          const r = await fetch(`${import.meta.env.BASE_URL}macro-data.json?v=${Date.now()}`);
          if (r.ok) {
            const d = await r.json();
            if (d.yieldSpread != null) { results.yieldSpread = d.yieldSpread; results.yield10Y = d.yield10Y; results.yield2Y = d.yield2Y; results.yieldDate = d.yieldDate; }
            if (d.vix != null) results.vix = d.vix;
            if (d.spyPE != null) results.spyPE = d.spyPE;
            if (d.claims != null) { results.claims = d.claims; results.claimsDate = d.claimsDate; results.claims4wk = d.claims4wk; results.claimsTrend = d.claimsTrend; }
            if (d.cfnai != null) { results.cfnai = d.cfnai; results.cfnaiDate = d.cfnaiDate; results.cfnai3mo = d.cfnai3mo; }
            if (d.sahmVal != null) { results.sahmVal = d.sahmVal; results.unrate = d.unrate; results.unrateDate = d.unrateDate; }
          }
        } catch {}
      })());

      // 2. SPY 200-day SMA from Alpaca (CORS-friendly)
      if (apiKey) fetches.push((async () => {
        try {
          const r = await fetch(`${BASE}/v2/stocks/bars?symbols=SPY&timeframe=1Day&start=${d300}&limit=250&adjustment=split&feed=iex`, { headers: { "APCA-API-KEY-ID": apiKey, "APCA-API-SECRET-KEY": apiSecret } });
          if (r.ok) { const d = await r.json(); const bars = d.bars?.SPY || []; if (bars.length >= 50) { const last200 = bars.slice(-200); results.spy200 = last200.reduce((a, b) => a + b.c, 0) / last200.length; results.spy200Count = last200.length; } }
        } catch {}
      })());

      // 3. HYG from Alpaca + 52wk high from Finnhub (both CORS-friendly)
      if (apiKey) fetches.push((async () => {
        try {
          const r = await fetch(`${BASE}/v2/stocks/snapshots?symbols=HYG&feed=iex`, { headers: { "APCA-API-KEY-ID": apiKey, "APCA-API-SECRET-KEY": apiSecret } });
          if (r.ok) { const d = await r.json(); if (d.HYG?.latestTrade) results.hygPrice = d.HYG.latestTrade.p; }
        } catch {}
      })());
      if (FH) fetches.push((async () => {
        try {
          const r = await fetch(`https://finnhub.io/api/v1/stock/metric?symbol=HYG&metric=all&token=${FH}`);
          if (r.ok) { const d = await r.json(); if (d.metric) { results.hyg52High = d.metric["52WeekHigh"]; results.hyg52Low = d.metric["52WeekLow"]; } }
        } catch {}
      })());

      // Note: alternative.me/fng is the CRYPTO (Bitcoin) Fear & Greed Index, not equity.
      // Removed to avoid misleading S&P 500 bear probability with Bitcoin sentiment.

      await Promise.all(fetches);
      results.loaded = true;
      setMacroData(prev => ({ ...prev, ...results }));
    };
    fetchMacro();
  }, [apiKey, apiSecret]);

  /* ── Fetch economic + earnings calendar ── */
  const fetchCalendar = useCallback(async () => {
    try {
      let events = [];
      const today = new Date();
      const localDay = today.getDay();
      const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (localDay === 0 ? 6 : localDay - 1));
      const nextSunday = new Date(monday); nextSunday.setDate(nextSunday.getDate() + 13);
      const fmtD = d => d.toISOString().slice(0, 10);

      // PRIMARY: Finnhub economic calendar (CORS-friendly, includes actuals natively)
      if (FH) {
        try {
          const r = await fetch(`https://finnhub.io/api/v1/calendar/economic?from=${fmtD(monday)}&to=${fmtD(nextSunday)}&token=${FH}`).catch(() => null);
          if (r?.ok) {
            const data = await r.json();
            const fhEvents = data?.economicCalendar || data?.result || [];
            if (Array.isArray(fhEvents)) {
              events = fhEvents
                .filter(e => e.country === "US" && ["high","medium"].includes((e.impact || "").toLowerCase()))
                .map(e => ({
                  title: e.event || "", date: e.time || e.date || "", country: "USD",
                  impact: (e.impact || "").charAt(0).toUpperCase() + (e.impact || "").slice(1).toLowerCase(),
                  actual: e.actual != null ? String(e.actual) : "",
                  previous: e.prev != null ? String(e.prev) : "",
                  forecast: e.estimate != null ? String(e.estimate) : "",
                  unit: e.unit || "",
                }));
              if (events.length > 0) {
                console.log(`Calendar: ${events.length} events from Finnhub (${events.filter(e => e.actual).length} with actuals)`);
                try { localStorage.setItem("iown_econ_calendar", JSON.stringify(events)); } catch {}
              }
            }
          }
        } catch {}
      }

      // SECONDARY: FMP economic calendar (if Finnhub failed or returned empty)
      if (events.length === 0 && FK) {
        try {
          const r = await fetch(`https://financialmodelingprep.com/api/v3/economic_calendar?from=${fmtD(monday)}&to=${fmtD(nextSunday)}&apikey=${FK}`).catch(() => null);
          if (r?.ok) {
            const data = await r.json();
            if (Array.isArray(data)) {
              events = data
                .filter(e => e.country === "US" && ["high","medium"].includes((e.impact||"").toLowerCase()))
                .map(e => ({
                  title: e.event || "", date: e.date || "", country: "USD",
                  impact: (e.impact || "").charAt(0).toUpperCase() + (e.impact || "").slice(1).toLowerCase(),
                  actual: e.actual != null ? String(e.actual) : "",
                  previous: e.previous != null ? String(e.previous) : "",
                  forecast: e.estimate != null ? String(e.estimate) : "",
                }));
              if (events.length > 0) {
                console.log(`Calendar: ${events.length} events from FMP`);
                try { localStorage.setItem("iown_econ_calendar", JSON.stringify(events)); } catch {}
              }
            }
          }
        } catch {}
      }

      // FALLBACK: Static JSON from GitHub Actions
      if (events.length === 0) {
        try {
          const cacheBust = `?t=${Math.floor(Date.now() / 60000)}`;
          for (const url of [
            `${import.meta.env.BASE_URL || "/"}economic-calendar.json${cacheBust}`,
            `https://raw.githubusercontent.com/richacarson/Dashboard/main/public/economic-calendar.json${cacheBust}`,
          ]) {
            try {
              const r = await fetch(url).catch(() => null);
              if (r?.ok) {
                const data = await r.json();
                if (Array.isArray(data) && data.length > 0) { events = data; break; }
              }
            } catch {}
          }
        } catch {}
      }

      // LAST RESORT: localStorage cache
      if (events.length === 0) {
        try {
          const cached = localStorage.getItem("iown_econ_calendar");
          if (cached) events = JSON.parse(cached);
        } catch {}
      }

      events.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
      setEconCalendar(events);
    } catch (e) { console.warn("Econ calendar fetch failed:", e.message); }

    // Earnings: FMP is the trusted source for dates + actuals (Finnhub has date errors)
    const today = new Date();
    const localDay = today.getDay();
    const earnMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (localDay === 0 ? 6 : localDay - 1));
    const earnFriday = new Date(earnMonday); earnFriday.setDate(earnFriday.getDate() + 4);
    const fmt = d => d.toISOString().slice(0, 10);
    const earnFrom = fmt(earnMonday);
    const earnTo = fmt(earnFriday);
    const earningsMap = {}; // key: symbol|date → merged earnings object

    // PRIMARY: Static JSON from GitHub Actions (same-origin, always available)
    try {
      const base = import.meta.env.BASE_URL || "/";
      const cacheBust = `?t=${Math.floor(Date.now() / 60000)}`;
      const r = await fetch(`${base}earnings-calendar.json${cacheBust}`);
      if (r.ok) {
        const data = await r.json();
        if (Array.isArray(data)) {
          data.filter(e => e.symbol && e.date).forEach(e => {
            const key = `${e.symbol}|${e.date}`;
            earningsMap[key] = { ...e, source: e.source || "static" };
          });
          console.log(`Earnings: ${Object.keys(earningsMap).length} from static JSON`);
        }
      }
    } catch (e) { console.warn("Static earnings load:", e.message); }

    // OVERLAY: FMP earnings (more authoritative for actuals, overwrites static)
    if (FK) {
      try {
        const r = await fetch(`https://financialmodelingprep.com/api/v3/earning_calendar?from=${earnFrom}&to=${earnTo}&apikey=${FK}`);
        if (r.ok) {
          const data = await r.json();
          if (Array.isArray(data)) {
            data.filter(e => e.symbol && e.date).forEach(e => {
              const key = `${e.symbol}|${e.date}`;
              earningsMap[key] = {
                ...(earningsMap[key] || {}),
                symbol: e.symbol, date: e.date,
                hour: e.time === "bmo" ? "bmo" : e.time === "amc" ? "amc" : e.time || (earningsMap[key]?.hour || ""),
                epsEstimate: e.epsEstimated ?? earningsMap[key]?.epsEstimate ?? null,
                epsActual: e.eps ?? earningsMap[key]?.epsActual ?? null,
                revenueEstimate: e.revenueEstimated ?? earningsMap[key]?.revenueEstimate ?? null,
                revenueActual: e.revenue ?? earningsMap[key]?.revenueActual ?? null,
                source: "fmp",
              };
            });
            console.log(`Earnings: ${Object.keys(earningsMap).length} after FMP overlay for ${earnFrom} to ${earnTo}`);
          }
        }
      } catch (e) { console.warn("FMP earnings:", e.message); }
    }

    // OVERLAY: Finnhub — fill gaps + add portfolio holdings even when FMP exists
    const fhKey = FH || FK;
    if (fhKey) {
      try {
        const r = await fetch(`https://finnhub.io/api/v1/calendar/earnings?from=${earnFrom}&to=${earnTo}&token=${fhKey}`);
        if (r.ok) {
          const data = await r.json();
          const raw = data.earningsCalendar || data.result || data.data || [];
          const list = Array.isArray(raw) ? raw : (raw.result || raw.data || []);
          let added = 0;
          list.filter(e => e.symbol && e.date).forEach(e => {
            const key = `${e.symbol}|${e.date}`;
            if (earningsMap[key]) {
              // Fill in missing fields from Finnhub on existing entries
              const ex = earningsMap[key];
              if (ex.epsActual == null && e.epsActual != null) ex.epsActual = e.epsActual;
              if (ex.epsEstimate == null && (e.epsEstimate ?? e.estimate) != null) ex.epsEstimate = e.epsEstimate ?? e.estimate;
              if (ex.revenueActual == null && e.revenueActual != null) ex.revenueActual = e.revenueActual;
              if (ex.revenueEstimate == null && e.revenueEstimate != null) ex.revenueEstimate = e.revenueEstimate;
              if (!ex.hour && e.hour) ex.hour = e.hour;
            } else if (!FK || coreSyms.includes(e.symbol)) {
              // Add if no FMP key, OR if it's a portfolio holding (Finnhub may have it when FMP doesn't)
              earningsMap[key] = {
                symbol: e.symbol, date: e.date, hour: e.hour || "",
                epsEstimate: e.epsEstimate ?? e.estimate ?? null,
                epsActual: e.epsActual ?? null,
                revenueEstimate: e.revenueEstimate ?? null,
                revenueActual: e.revenueActual ?? null,
                source: "finnhub",
              };
              added++;
            }
          });
          if (added > 0) console.log(`Earnings: added ${added} Finnhub entries`);
        }
      } catch (e) { console.warn("Finnhub earnings:", e.message); }
    }

    // Market caps + company names: use localStorage cache to avoid burning FMP calls
    // Only refresh once per day (earnings don't change market cap meaningfully intra-day)
    let mcapCache = {};
    try { mcapCache = JSON.parse(localStorage.getItem("iown_mcap_cache") || "{}"); } catch {}
    const mcapAge = Date.now() - (mcapCache._ts || 0);
    const mcapStale = mcapAge > 24 * 3600000; // older than 24h
    const allEarnSyms = [...new Set(Object.values(earningsMap).map(e => e.symbol))];
    const uncachedSyms = allEarnSyms.filter(s => !mcapCache[s]);

    // Only fetch if cache is stale or we have new symbols — and limit to 1 batch call
    if (FK && (mcapStale || uncachedSyms.length > 0)) {
      const symsToFetch = mcapStale ? allEarnSyms : uncachedSyms;
      try {
        // Single batch call — FMP quote supports comma-separated, cap at 100 most important
        // Sort by which symbols are in portfolio first, then alphabetically
        const prioritized = symsToFetch.sort((a, b) => {
          const ai = coreSyms.includes(a) ? 0 : 1;
          const bi = coreSyms.includes(b) ? 0 : 1;
          return ai - bi || a.localeCompare(b);
        }).slice(0, 100);
        const r = await fetch(`https://financialmodelingprep.com/api/v3/quote/${prioritized.join(",")}?apikey=${FK}`);
        if (r.ok) {
          const quotes = await r.json();
          if (Array.isArray(quotes)) {
            quotes.forEach(q => {
              if (q.symbol) mcapCache[q.symbol] = { marketCap: q.marketCap || 0, name: q.name || "" };
            });
            mcapCache._ts = Date.now();
            try { localStorage.setItem("iown_mcap_cache", JSON.stringify(mcapCache)); } catch {}
          }
        }
      } catch (e) { console.warn("FMP quote batch:", e.message); }
    }

    // Apply cached market cap + company name to earnings entries
    Object.values(earningsMap).forEach(e => {
      const cached = mcapCache[e.symbol];
      if (cached) {
        e.marketCap = cached.marketCap;
        e.companyName = cached.name;
      }
    });

    let earnings = Object.values(earningsMap).sort((a, b) =>
      (a.date || "").localeCompare(b.date || "") || (b.marketCap || 0) - (a.marketCap || 0)
    );

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
    setCalendarLoading(false);
  }, [coreSyms]);

  // Re-fetch actuals for portfolio holdings that should have reported but are missing results.
  // Uses Finnhub /stock/earnings per-symbol (returns actuals faster than calendar endpoints).
  const actualsRetryRef = useRef(0);
  useEffect(() => {
    if (!earningsCalendar.length || !FH) return;
    const now = new Date();
    const todayLocal = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
    const hour = now.getHours();

    // Find entries missing actuals that should have reported
    const missing = earningsCalendar.filter(e =>
      e.epsActual == null &&
      coreSyms.includes(e.symbol) &&
      (e.date < todayLocal || (e.date === todayLocal && e.hour === "bmo" && hour >= 10) || (e.date === todayLocal && e.hour === "amc" && hour >= 17))
    );
    if (!missing.length) { actualsRetryRef.current = 0; return; }
    if (actualsRetryRef.current >= 6) return; // stop after 6 retries (~30 min)

    const timer = setTimeout(async () => {
      actualsRetryRef.current++;
      let updated = false;
      for (const evt of missing) {
        try {
          const r = await fetch(`https://finnhub.io/api/v1/stock/earnings?symbol=${evt.symbol}&limit=1&token=${FH}`);
          if (!r.ok) continue;
          const data = await r.json();
          if (!Array.isArray(data) || !data.length) continue;
          const latest = data[0];
          // Match by quarter/year or by proximity to the earnings date
          if (latest.actual != null) {
            evt.epsActual = latest.actual;
            if (latest.surprise != null) evt.epsSurprise = latest.surprise;
            updated = true;
          }
        } catch {}
      }
      if (updated) setEarningsCalendar(prev => [...prev]);
    }, 5000); // 5s delay to not block initial render
    return () => clearTimeout(timer);
  }, [earningsCalendar, coreSyms]);

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
        try {
          const msgs = JSON.parse(evt.data);
          for (const msg of msgs) {
            if (msg.T === "success" && msg.msg === "authenticated") {
              ws.send(JSON.stringify({ action: "subscribe", trades: [...ALL, ...IEX_BM] }));
            }
            if (msg.T === "t" && msg.S && msg.p) {
              // Update refs only — React state syncs on next poll cycle (every 1s)
              quotesRef.current[msg.S] = { p: msg.p, t: msg.t };
              // Also update bmQuotes for benchmark symbols so homepage bar updates
              if (BM_SYMS.includes(msg.S)) {
                setBmQuotes(prev => ({ ...prev, [msg.S]: { p: msg.p, t: msg.t } }));
              }
            }
          }
        } catch {}
      };
      ws.onclose = () => { setTimeout(connectWS, 5000); };
    } catch {}
  }, [apiKey, apiSecret]);

  // Finnhub WebSocket for real-time non-IEX benchmark streaming (DVY, IWS, IUSG)
  const connectFinnhubWS = useCallback(() => {
    if (!FH) return;
    try {
      const fhWs = new WebSocket(`wss://ws.finnhub.io?token=${FH}`);
      fhWsRef.current = fhWs;
      fhWs.onopen = () => {
        for (const sym of NON_IEX_BM) {
          fhWs.send(JSON.stringify({ type: "subscribe", symbol: sym }));
        }
      };
      fhWs.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === "trade" && msg.data?.length) {
            const updates = {};
            for (const t of msg.data) {
              if (NON_IEX_BM.includes(t.s)) {
                updates[t.s] = { p: t.p, t: new Date(t.t).toISOString() };
                quotesRef.current[t.s] = updates[t.s];
              }
            }
            if (Object.keys(updates).length) {
              setBmQuotes(prev => ({ ...prev, ...updates }));
            }
          }
        } catch {}
      };
      fhWs.onclose = () => { setTimeout(connectFinnhubWS, 5000); };
    } catch {}
  }, []);

  // Finnhub REST polling for non-IEX benchmarks (fallback, every 2s)
  const fhTimerRef = useRef(null);
  const pollFinnhubBenchmarks = useCallback(async () => {
    if (!FH) return;
    const batchQ = {}, batchB = {};
    for (const sym of NON_IEX_BM) {
      try {
        const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${FH}`);
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
        // React state sync below handles rendering
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

  // Poll Finnhub for stocks with stale IEX data (no trade in last 5 minutes)
  const staleTimerRef = useRef(null);
  const pollStaleStocks = useCallback(async () => {
    if (!FH || marketStatus.status !== "open") return;
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes
    // Only poll dividend + growth stocks — FCI stocks are high-volume and work fine on IEX
    const divGrowthSyms = [...new Set([...(sleevesRef.current.dividend?.symbols || []), ...(sleevesRef.current.growth?.symbols || [])])];
    const stale = divGrowthSyms.filter(s => {
      const q = quotesRef.current[s];
      if (!q) return true; // no quote at all
      const tradeTime = q.t ? new Date(q.t).getTime() : 0;
      return (now - tradeTime) > staleThreshold;
    });
    if (!stale.length) return;
    // Only poll up to 5 at a time to leave room for benchmark polling
    const batch = stale.slice(0, 5);
    const batchQ = {}, batchB = {};
    for (const sym of batch) {
      try {
        const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${FH}`);
        if (!r.ok) continue;
        const q = await r.json();
        if (!q.c) continue;
        const quoteVal = { p: q.c, t: new Date().toISOString() };
        quotesRef.current[sym] = quoteVal;
        batchQ[sym] = quoteVal;
        if (q.pc) {
          const barVal = { ...barsRef.current[sym], pc: q.pc };
          barsRef.current[sym] = barVal;
          batchB[sym] = barVal;
        }
      } catch {}
    }
    if (Object.keys(batchQ).length) setQuotes(prev => ({ ...prev, ...batchQ }));
    if (Object.keys(batchB).length) setBars(prev => ({ ...prev, ...batchB }));
  }, [marketStatus.status]);

  // ── Performance tab: fetch portfolio history + benchmark bars ──
  const fetchPerfData = useCallback(async () => {
    if (Object.keys(perfDataMap).length > 0 || perfLoading) return;
    setPerfLoading(true);
    try {
      const sleevesToLoad = ["dividend", "growth", "fci100", "fciValues"];
      const newMap = {};

      for (const sleeve of sleevesToLoad) {
        try {
          const pRes = await fetch(`${import.meta.env.BASE_URL}portfolio-history-${sleeve}.json?v=${Date.now()}`);
          if (!pRes.ok) continue;
          const pJson = await pRes.json();
          const portfolio = (pJson.portfolio || []).sort((a, b) => a.date.localeCompare(b.date));
          if (!portfolio.length) continue;

          // Use pre-computed benchmarks from JSON if available
          const jsonBm = pJson.benchmarks || {};
          const bmSyms = Object.keys(jsonBm).length > 0 ? Object.keys(jsonBm) : (sleeve === "growth" ? ["IUSG", "QQQ", "SPY"] : ["DVY", "SPY", "DIA"]);
          const hasPrebaked = bmSyms.some(s => Array.isArray(jsonBm[s]) && jsonBm[s].length > 1);

          let benchmarks = {};

          if (hasPrebaked) {
            for (const sym of bmSyms) {
              if (Array.isArray(jsonBm[sym])) {
                benchmarks[sym] = {};
                jsonBm[sym].forEach(pt => { benchmarks[sym][pt.date] = pt.close; });
              }
            }
          } else if (apiKey && apiSecret) {
            const startDate = portfolio[0].date;
            for (const sym of bmSyms) {
              benchmarks[sym] = {};
              let yearStart = new Date(startDate);
              const end = new Date();
              while (yearStart < end) {
                const yearEnd = new Date(Math.min(yearStart.getTime() + 365 * 24 * 60 * 60 * 1000, end.getTime()));
                const alpacaEnd = yearEnd;
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

          newMap[sleeve] = { portfolio, benchmarks, startBalance: pJson.start_balance || 100000, holdings: pJson.holdings || {}, cash: pJson.cash || 0, costBasis: pJson.cost_basis || {}, transactions: pJson.transactions || [], annualReturns: pJson.annual_returns || {}, bmAnnualReturns: pJson.bm_annual_returns || {} };
        } catch (e) {
          console.warn(`Failed to load ${sleeve} portfolio:`, e);
        }
      }

      setPerfDataMap(newMap);
      // Set perfData to the active sleeve
      const active = newMap[perfSleeve] || newMap.dividend || Object.values(newMap)[0] || null;
      setPerfData(active);
    } catch (e) {
      console.error("Performance fetch error:", e);
    }
    setPerfLoading(false);
  }, [perfDataMap, perfLoading, apiKey, apiSecret, hdrs, perfSleeve]);

  // Switch perfData when sleeve changes
  useEffect(() => {
    if (perfDataMap[perfSleeve]) {
      setPerfData(perfDataMap[perfSleeve]);
      setPerfBmToggles(SLEEVE_BM_DEFAULTS[perfSleeve] || SLEEVE_BM_DEFAULTS.dividend);
      setPerfHover(null);
    }
  }, [perfSleeve, perfDataMap]);

  // Load perf data when tab is opened
  useEffect(() => {
    if ((tab === "performance" || tab === "home") && authed && Object.keys(perfDataMap).length === 0 && !perfLoading) fetchPerfData();
  }, [tab, authed, perfDataMap, perfLoading, fetchPerfData]);

  // Re-fetch quotes when perfDataMap loads (picks up old tickers not in DEFAULT_SLEEVES)
  const perfDataLoadedRef = useRef(false);
  useEffect(() => {
    if (Object.keys(perfDataMap).length > 0 && !perfDataLoadedRef.current) {
      perfDataLoadedRef.current = true;
      fetchData();
    }
  }, [perfDataMap, fetchData]);

  // Compute live portfolio value from WebSocket prices every 2s
  useEffect(() => {
    if (!perfData?.holdings || !authed) return;
    const calc = () => {
      const h = perfData.holdings;
      const cash = perfData.cash || 0;
      let stocks = 0, pcStocks = 0, priced = 0, total = Object.keys(h).length;
      for (const [ticker, shares] of Object.entries(h)) {
        const q = quotesRef.current[ticker];
        const pc = barsRef.current[ticker]?.pc;
        if (q && q.p > 0) {
          stocks += shares * q.p;
          // For previous close, use pc if available, else use current price (assumes 0% change)
          pcStocks += shares * (pc > 0 ? pc : q.p);
          priced++;
        }
      }
      // Only update if we have prices for most holdings and value actually changed
      if (priced >= total * 0.8) {
        const newVal = Math.round((stocks + cash) * 100) / 100;
        const newStocks = Math.round(stocks * 100) / 100;
        const newPcVal = Math.round((pcStocks + cash) * 100) / 100;
        setLiveValue(prev => {
          if (prev && prev.value === newVal && prev.stocks === newStocks && prev.cash === cash && prev.holdings === total && prev.prevClose === newPcVal) return prev;
          return { value: newVal, stocks: newStocks, cash, holdings: total, prevClose: newPcVal };
        });
      }
    };
    calc(); // Initial
    const t = setInterval(calc, 2000);
    return () => clearInterval(t);
  }, [perfData, authed]);

  // Auto-accrue dividends: use fundamentals.dps (annual $/share) to estimate
  // dividends earned since the last recorded DIVIDEND transaction, then credit cash.
  // Persists the "accrued through" date per sleeve in localStorage so multiple
  // users / page reloads don't double-count.
  const divAccruedRef = useRef({}); // track which sleeves we've already accrued this session
  useEffect(() => {
    if (!fundamentals?._ts || !perfDataMap || Object.keys(perfDataMap).length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    for (const [sleeve, data] of Object.entries(perfDataMap)) {
      const refKey = `${sleeve}_${fundamentals._ts}`;
      if (divAccruedRef.current[refKey]) continue; // already done this session cycle
      const holdings = data.holdings;
      if (!holdings || Object.keys(holdings).length === 0) continue;

      // Determine the start date for accrual: max of last DIVIDEND tx date and
      // localStorage "accrued through" date (prevents re-accruing on reload)
      const divTxs = (data.transactions || []).filter(tx => tx.type === "DIVIDEND" || tx.type === "DIVIDEND REINVESTMENT");
      let lastDivDate = data.start_date || "2011-01-01";
      for (const tx of divTxs) {
        if (tx.date > lastDivDate) lastDivDate = tx.date;
      }
      const lsKey = `iown_div_accrued_${sleeve}`;
      const lsDate = localStorage.getItem(lsKey);
      const accrueFrom = (lsDate && lsDate > lastDivDate) ? lsDate : lastDivDate;

      // Calculate days since accrueFrom (cap at 90 to avoid huge catch-ups)
      const msPerDay = 86400000;
      const daysSince = Math.min(90, Math.max(0, Math.floor((new Date(today) - new Date(accrueFrom)) / msPerDay)));
      if (daysSince < 1) { divAccruedRef.current[refKey] = true; continue; }

      // Sum daily dividend accrual across all holdings
      let totalAccrued = 0;
      const breakdown = [];
      for (const [ticker, shares] of Object.entries(holdings)) {
        const f = fundamentals[ticker];
        if (!f?.dps || f.dps <= 0) continue;
        const dailyDiv = (shares * f.dps) / 365;
        const accrued = dailyDiv * daysSince;
        if (accrued > 0.005) {
          totalAccrued += accrued;
          breakdown.push({ ticker, amount: Math.round(accrued * 100) / 100 });
        }
      }

      if (totalAccrued < 0.01) { divAccruedRef.current[refKey] = true; continue; }
      totalAccrued = Math.round(totalAccrued * 100) / 100;

      // Create auto-dividend transaction and update perfData
      const newTx = { date: today, type: "DIVIDEND", amount: totalAccrued, auto: true, days: daysSince, breakdown };
      const updated = { ...data, transactions: [newTx, ...data.transactions], cash: (data.cash || 0) + totalAccrued };
      setPerfDataMap(prev => ({ ...prev, [sleeve]: updated }));
      if (sleeve === perfSleeve) setPerfData(updated);
      // Persist "accrued through today" so reloads / other users don't re-accrue
      try { localStorage.setItem(lsKey, today); } catch {}
      divAccruedRef.current[refKey] = true;
    }
  }, [fundamentals, perfDataMap, perfSleeve]);

  // Fetch intraday bars for 1D (1min) portfolio chart
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

        // For 1D, prepend a "previous close" point so daily return is measured from prior close
        const portfolioPoints = [];
        if (key === "1D") {
          let pcStocks = 0, pcPriced = 0;
          for (const [ticker, shares] of Object.entries(holdings)) {
            const pc = barsRef.current[ticker]?.pc;
            const fallbackPrice = quotesRef.current[ticker]?.p;
            // Use pc if available; fall back to current price (assumes 0% change for that holding)
            const price = (pc && pc > 0) ? pc : (fallbackPrice && fallbackPrice > 0) ? fallbackPrice : 0;
            if (price > 0) { pcStocks += shares * price; pcPriced++; }
          }
          if (pcPriced >= tickers.length * 0.8) {
            // Use a timestamp just before the first bar so it sorts first
            const pcDate = new Date(new Date(timestamps[0]).getTime() - 60000).toISOString();
            portfolioPoints.push({
              date: pcDate,
              value: Math.round((pcStocks + cash) * 100) / 100,
              stocks: Math.round(pcStocks * 100) / 100,
              cash,
            });
          }
        }

        // For each timestamp, compute portfolio value = sum(shares × close) + cash
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

      const pts1DRaw = await fetchIntraday("1Min", d1Start, "1D");

      // For 1D, only keep the most recent trading session
      let pts1D = pts1DRaw;
      if (pts1DRaw.length > 1) {
        // Find the last trading day in the data
        const lastDate = pts1DRaw[pts1DRaw.length - 1].date.slice(0, 10);
        pts1D = pts1DRaw.filter(p => p.date.slice(0, 10) === lastDate);
        // If no points for last date (e.g. weekend), use all
        if (pts1D.length < 2) pts1D = pts1DRaw;
      }

      setIntradayPortfolio({ "1D": pts1D });

      // Fetch intraday benchmark bars
      // All benchmarks via Alpaca IEX feed
      const allBmSyms = ["SPY", "DIA", "DVY", "IUSG", "QQQ"];
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
      // Fallback: Finnhub candles for any symbols missing from IEX
      const fetchFhBmBars = async (resolution, from) => {
        if (!FH) return {};
        const result = {};
        const fromTs = Math.floor(new Date(from).getTime() / 1000);
        const toTs = Math.floor(Date.now() / 1000);
        for (const sym of allBmSyms) {
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

      const [iex1DRaw, fh1DRaw] = await Promise.all([
        fetchBmBars(allBmSyms, "1Min", d1Start),
        fetchFhBmBars("1", d1Start),
      ]);
      // Merge: prefer IEX data, fall back to Finnhub for missing symbols
      const mergeBm = (iex, fh) => {
        const merged = { ...fh };
        for (const [sym, bars] of Object.entries(iex)) {
          if (bars.length > 0) merged[sym] = bars;
        }
        return merged;
      };
      const bm1DRaw = mergeBm(iex1DRaw, fh1DRaw);

      // Filter benchmark 1D bars to same trading day as portfolio
      const lastPortDate = pts1D.length ? pts1D[pts1D.length - 1].date.slice(0, 10) : null;
      const bm1D = {};
      for (const [sym, bars] of Object.entries(bm1DRaw)) {
        bm1D[sym] = lastPortDate ? bars.filter(b => b.date.slice(0, 10) === lastPortDate) : bars;
      }

      setIntradayBenchmarks({ "1D": bm1D });
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
      // Fetch research reports index
      fetch(`${import.meta.env.BASE_URL || "/"}research/index.json?t=${Math.floor(Date.now() / 60000)}`).then(r => r.ok ? r.json() : []).then(d => { if (Array.isArray(d)) setResearchReports(d); }).catch(() => {});
      // Preload ExcelJS for export
      if (!window.ExcelJS) { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js"; document.head.appendChild(s); }
      connectWS();
      connectFinnhubWS();
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
      // Finnhub benchmark polling (DVY, IUSG) — every 5s
      pollFinnhubBenchmarks();
      fhTimerRef.current = setInterval(pollFinnhubBenchmarks, 5000);
      // Stale stock polling — every 30s
      pollStaleStocks();
      staleTimerRef.current = setInterval(pollStaleStocks, 30000);
      return () => {
        clearInterval(iRef.current); clearInterval(newsTimer); clearInterval(calTimer); clearInterval(fhTimerRef.current); clearInterval(staleTimerRef.current);
        try { wsRef.current?.close(); } catch {}
        try { fhWsRef.current?.close(); } catch {}
      };
    }
  }, [authed, refresh, fetchData, fetchNews, marketStatus.status]);

  // Fetch screener manifest on first visit
  useEffect(() => {
    if ((tab !== "screener" && tDrawer !== "screener") || screenerFetched.current || screenerData.length) return;
    screenerFetched.current = true;
    fetch("https://richacarson.github.io/Stock-Screener/manifest.json")
      .then(r => r.json())
      .then(d => {
        setScreenerData(d);
        if (screenerSleeve === null) {
          const match = perfSleeve === "dividend" ? "Dividend" : perfSleeve === "growth" ? "Growth" : null;
          setScreenerSleeve(match || "All");
        }
      })
      .catch(() => {});
  }, [tab, tDrawer]);

  // Fetch opportunities on first visit
  useEffect(() => {
    if ((tab !== "opportunities" && tDrawer !== "opportunities") || oppFetched.current || opportunities.length) return;
    oppFetched.current = true;
    fetch(`${import.meta.env.BASE_URL}opportunities/manifest.json`).then(r => r.ok ? r.json() : []).catch(() => [])
      .then(ids => Promise.all(ids.map(id => fetch(`${import.meta.env.BASE_URL}opportunities/${id}.json`).then(r => r.ok ? r.json() : null).catch(() => null))))
      .then(results => setOpportunities(results.filter(Boolean).sort((a, b) => {
        if (a.conviction === "High" && b.conviction !== "High") return -1;
        if (b.conviction === "High" && a.conviction !== "High") return 1;
        return (b.date_identified || "").localeCompare(a.date_identified || "");
      })));
  }, [tab, tDrawer]);

  const chg = s => { const q = quotesRef.current[s] || quotes[s], b = barsRef.current[s] || bars[s]; return (q && b?.pc) ? ((q.p - b.pc) / b.pc) * 100 : null; };
  const bmChg = s => { const q = bmQuotes[s], b = bmBars[s]; return (q && b?.pc) ? ((q.p - b.pc) / b.pc) * 100 : null; };
  const sleeveActualDay = (k) => {
    const h = perfDataMap[k]?.holdings;
    if (!h) return null;
    const cash = perfDataMap[k]?.cash || 0;
    let cur = cash, prev = cash;
    for (const [sym, sh] of Object.entries(h)) {
      const q = quotesRef.current[sym] || quotes[sym];
      if (q?.p && sh) {
        cur += sh * q.p;
        const pc = (barsRef.current[sym] || bars[sym])?.pc;
        prev += sh * (pc > 0 ? pc : q.p);
      }
    }
    return prev > 0 ? ((cur / prev) - 1) * 100 : null;
  };

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
        <div style={{ position: "absolute", top: "20%", left: "50%", transform: "translate(-50%, -50%)", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(252,212,50,0.08) 0%, transparent 70%)", pointerEvents: "none", filter: "blur(60px)" }} />
        <div style={{ width: "100%", maxWidth: 380, textAlign: "center", opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(20px)", transition: "all 0.8s cubic-bezier(0.16,1,0.3,1)" }}>
          {/* Logo from public folder */}
          <img src={theme !== "light" ? "paradiem-logo-dark.png?v=6" : "paradiem-logo.png?v=6"} alt="Paradiem" style={{ width: 240, height: "auto", margin: "0 auto 28px", display: "block" }} />
          <p style={{ fontSize: 15, color: C.t3, marginBottom: 40, lineHeight: 1.5, fontStyle: "italic", letterSpacing: 0.2 }}>Research Reveals Opportunities</p>
          <div style={{ background: C.surface, borderRadius: 20, padding: 28, border: `1px solid ${codeFocused ? C.borderActive : C.border}`, boxShadow: "0 16px 64px rgba(0,0,0,0.3)", transition: "border-color 0.3s" }}>
            <input type="password" value={code} onChange={e => { setCode(e.target.value); setCodeErr(false); }} onKeyDown={e => { if (e.key === "Enter") handleUnlock(); }} onFocus={() => setCodeFocused(true)} onBlur={() => setCodeFocused(false)} placeholder="Access code" style={{ width: "100%", padding: "18px 20px", background: C.bg, border: `1px solid ${codeErr ? C.dn+"66" : C.border}`, borderRadius: 14, color: C.t1, fontSize: 16, outline: "none", boxSizing: "border-box", textAlign: "center", letterSpacing: 4, fontFamily: "inherit" }} />
            <button onClick={handleUnlock} style={{ width: "100%", padding: 18, marginTop: 16, background: "linear-gradient(135deg, #FCD432, #C9A015)", border: "none", borderRadius: 14, color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 24px rgba(252,212,50,0.3)" }}>Continue</button>
            {codeErr && <div style={{ marginTop: 16, color: C.dn, fontSize: 13, fontWeight: 500, animation: "shake 0.4s" }}>Incorrect access code</div>}
          </div>
          <div style={{ marginTop: 40, fontSize: 12, color: C.t4 }}>Authorized Paradiem team members only</div>
        </div>
        <GS theme={theme} />
      </div>
    );
  }

  /* ━━━ LOADING (keys baked in, auth in progress) ━━━ */
  if (!authed && EK && ES) {
    return (
      <div style={{ minHeight: "100dvh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <img src={theme !== "light" ? "paradiem-logo-dark.png?v=6" : "paradiem-logo.png?v=6"} alt="Paradiem" style={{ width: 200, height: "auto", margin: "0 auto 20px", display: "block", opacity: 0.7 }} />
          <div style={{ width: 24, height: 24, border: `3px solid ${C.border}`, borderTopColor: C.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
        </div>
      </div>
    );
  }

  /* ━━━ API KEY SCREEN ━━━ */
  if (!authed && !(EK && ES)) {
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
            <button onClick={auth} style={{ width: "100%", padding: 18, background: "linear-gradient(135deg, #FCD432, #C9A015)", border: "none", borderRadius: 14, color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 24px rgba(252,212,50,0.3)" }}>Connect</button>
            {authErr && <div style={{ marginTop: 14, color: C.dn, fontSize: 13, fontWeight: 500, textAlign: "center" }}>{authErr}</div>}
          </div>
        </div>
        <GS theme={theme} />
      </div>
    );
  }

  /* ━━━ MAIN DASHBOARD ━━━ */

  /* ── Ticker Row — renders from external stable component ── */
  const renderTickerRow = (s, sleeveKey) => {
    const q = quotes[s], b = bars[s], c = chg(s);
    const nm = names[s] || "";
    const price = q?.p;
    const shortName = nm;
    const tw = sleeveKey && TARGET_WEIGHTS[sleeveKey] ? TARGET_WEIGHTS[sleeveKey][s] : null;
    const lw = sleeveKey && liveWeights[sleeveKey] ? liveWeights[sleeveKey][s] : null;
    const displayW = lw != null ? lw : tw;
    const drift = (tw != null && lw != null) ? lw - tw : null;
    const driftColor = drift != null ? (Math.abs(drift) >= 0.5 ? (drift > 0 ? C.up : C.dn) : C.accent) : C.accent;
    return (
      <div key={s} {...stockContextHandlers(s)} className="ticker-row"
        style={{ display: "flex", alignItems: "center", padding: "14px 0", cursor: "pointer", overflow: "hidden" }}>
        <div style={{ marginRight: 10, flexShrink: 0, width: 34, height: 34 }}>
          <StockLogo symbol={s} size={34} logoUrl={fundamentals[s]?.logo} />
        </div>
        <div style={{ flex: 1, minWidth: 0, overflow: "hidden", marginRight: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: C.t1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s}</span>
            {displayW != null && <span style={{ fontSize: 10, fontWeight: 700, color: driftColor, background: driftColor + "18", padding: "1px 6px", borderRadius: 4, flexShrink: 0 }}>{displayW.toFixed(1)}%</span>}
          </div>
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
    // Calculate daily change matching Performance tab: (current_total / prev_total - 1)
    // Includes cash in both to match liveValue calculation exactly
    let avgChg = null;
    const holdings = perfDataMap[k]?.holdings;
    if (holdings) {
      const cash = perfDataMap[k]?.cash || 0;
      let currentTotal = cash, prevTotal = cash; // cash doesn't change day-to-day
      for (const sym of sleeve.symbols) {
        const q = quotesRef.current[sym] || quotes[sym];
        const sh = holdings[sym];
        if (q?.p && sh) {
          currentTotal += sh * q.p;
          const pc = (barsRef.current[sym] || bars[sym])?.pc;
          prevTotal += sh * (pc > 0 ? pc : q.p);
        }
      }
      avgChg = prevTotal > 0 ? ((currentTotal / prevTotal) - 1) * 100 : null;
    }
    // Fallback to liveWeights (drifted target weights)
    if (avgChg === null) {
      const lw = liveWeights[k];
      if (lw && Object.keys(lw).length > 0) {
        let totalW = 0, weightedSum = 0;
        for (const sym of sleeve.symbols) {
          const c = chg(sym);
          const w = lw[sym];
          if (c !== null && w > 0) { totalW += w; weightedSum += w * c; }
        }
        avgChg = totalW > 0 ? weightedSum / totalW : null;
      }
    }
    // Final fallback to equal weight
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
                { v: "weightDn", l: "Weight ↓" },
              ].map(({ v, l }) => {
                const active = (sleeveSort[k] || "chgDn") === v;
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
                if (sortMode === "weightDn") { const lw = liveWeights[k] || {}; const tw = TARGET_WEIGHTS[k] || {}; return (lw[b] ?? tw[b] ?? 0) - (lw[a] ?? tw[a] ?? 0); }
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
                    <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>{ renderTickerRow(s, k) }</div>
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
    { id: "home", label: "Home", icon: (a, onLight) => <svg width="21" height="21" viewBox="0 0 24 24" fill={a ? (onLight ? C.accentSoft : C.navAccentSoft) : "none"} stroke={a ? (onLight ? C.t1 : C.navText) : (onLight ? C.t4 : C.navTextMuted)} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg> },
    { id: "performance", label: "Performance", icon: (a, onLight) => <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={a ? (onLight ? C.t1 : C.navText) : (onLight ? C.t4 : C.navTextMuted)} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg> },
    { id: "metrics", label: "Metrics", icon: (a, onLight) => <svg width="21" height="21" viewBox="0 0 24 24" fill={a ? (onLight ? C.accentSoft : C.navAccentSoft) : "none"} stroke={a ? (onLight ? C.t1 : C.navText) : (onLight ? C.t4 : C.navTextMuted)} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg> },
    { id: "charts", label: "Charts", icon: (a, onLight) => <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={a ? (onLight ? C.t1 : C.navText) : (onLight ? C.t4 : C.navTextMuted)} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg> },
    { id: "news", label: "News", icon: (a, onLight) => <svg width="21" height="21" viewBox="0 0 24 24" fill={a ? (onLight ? C.accentSoft : C.navAccentSoft) : "none"} stroke={a ? (onLight ? C.t1 : C.navText) : (onLight ? C.t4 : C.navTextMuted)} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" /><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" /></svg> },
    { id: "briefs", label: "Briefs", icon: (a, onLight) => <svg width="21" height="21" viewBox="0 0 24 24" fill={a ? (onLight ? C.accentSoft : C.navAccentSoft) : "none"} stroke={a ? (onLight ? C.t1 : C.navText) : (onLight ? C.t4 : C.navTextMuted)} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h16a2 2 0 002-2V4a2 2 0 00-2-2H8a2 2 0 00-2 2v16a2 2 0 01-2 2zm0 0a2 2 0 01-2-2v-9c0-1.1.9-2 2-2h2" /><line x1="10" y1="8" x2="18" y2="8" /><line x1="10" y1="12" x2="18" y2="12" /><line x1="10" y1="16" x2="14" y2="16" /></svg> },
    { id: "research", label: "Research", icon: (a, onLight) => <svg width="21" height="21" viewBox="0 0 24 24" fill={a ? (onLight ? C.accentSoft : C.navAccentSoft) : "none"} stroke={a ? (onLight ? C.t1 : C.navText) : (onLight ? C.t4 : C.navTextMuted)} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2v7.527a2 2 0 01-.211.896L4.72 20.578A1 1 0 005.598 22h12.804a1 1 0 00.878-1.422l-5.069-10.155A2 2 0 0114 9.527V2" /><path d="M8.5 2h7" /><path d="M7 16.5h10" /></svg> },
    { id: "playbook", label: "Playbook", icon: (a, onLight) => <svg width="21" height="21" viewBox="0 0 24 24" fill={a ? (onLight ? C.accentSoft : C.navAccentSoft) : "none"} stroke={a ? (onLight ? C.t1 : C.navText) : (onLight ? C.t4 : C.navTextMuted)} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /><path d="M12 6v7l3-2 3 2V6" /></svg> },
    { id: "screener", label: "Screener", icon: (a, onLight) => <svg width="21" height="21" viewBox="0 0 24 24" fill={a ? (onLight ? C.accentSoft : C.navAccentSoft) : "none"} stroke={a ? (onLight ? C.t1 : C.navText) : (onLight ? C.t4 : C.navTextMuted)} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg> },
    { id: "opportunities", label: "Opportunities", icon: (a, onLight) => <svg width="21" height="21" viewBox="0 0 24 24" fill={a ? (onLight ? C.accentSoft : C.navAccentSoft) : "none"} stroke={a ? (onLight ? C.t1 : C.navText) : (onLight ? C.t4 : C.navTextMuted)} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 00-4 12.7V17a1 1 0 001 1h6a1 1 0 001-1v-2.3A7 7 0 0012 2z"/></svg> },
    { id: "settings", label: "Settings", icon: (a, onLight) => <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={a ? (onLight ? C.t1 : C.navText) : (onLight ? C.t4 : C.navTextMuted)} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg> },
  ];

  /* ═══════════════════════════════════════════════════════════════════
     TERMINAL LAYOUT — 4-panel Bloomberg-style grid (desktop only)
     ═══════════════════════════════════════════════════════════════════ */
  if (layoutMode === "terminal" && isDesktop && authed) {
    const tFont = "'IBM Plex Mono', 'SF Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace";
    const tSleeveKeys = Object.keys(sleeves);
    const tSleeveSyms = sleeves[tChartSleeve]?.symbols || [];
    const tChartBg = C.card.replace("#", "");
    const tChartUrl = `https://s.tradingview.com/widgetembed/?frameElementId=tv_terminal&symbol=${terminalActiveSym}&interval=D&hidesidetoolbar=1&symboledit=0&saveimage=0&toolbarbg=${tChartBg}&studies=%5B%7B%22id%22%3A%22MASimple%40tv-basicstudies%22%2C%22inputs%22%3A%7B%22length%22%3A50%7D%7D%2C%7B%22id%22%3A%22MASimple%40tv-basicstudies%22%2C%22inputs%22%3A%7B%22length%22%3A200%7D%7D%5D&theme=dark&style=1&timezone=America%2FNew_York&withdateranges=1&showpopupbutton=0&overrides={"paneProperties.background"%3A"%23${tChartBg}"%2C"paneProperties.backgroundType"%3A"solid"}&enabled_features=%5B%22header_chart_type%22%2C%22header_indicators%22%5D&disabled_features=[]&locale=en`;
    const tNow = new Date().toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const tAllNews = [...(news || []), ...(broadNews || [])].sort((a, b) => new Date(b.created_at || b.datetime || 0) - new Date(a.created_at || a.datetime || 0)).slice(0, 50);
    const tPortfolioVal = liveValue ? liveValue.value : null;
    const tPortfolioPrev = liveValue?.prevClose || null;
    const tDayChg = (tPortfolioVal && tPortfolioPrev) ? ((tPortfolioVal / tPortfolioPrev) - 1) * 100 : null;
    const tDayChgDollar = (tPortfolioVal && tPortfolioPrev) ? tPortfolioVal - tPortfolioPrev : null;
    const tSpyPrice = (bmQuotes.SPY?.p || quotesRef.current?.SPY?.p);
    const tVix = macroData.vix;
    const tYieldSpread = macroData.yieldSpread;

    return (
      <div style={{ position: "fixed", inset: 0, background: C.bg, color: C.t1, fontFamily: tFont, fontSize: 12, display: "grid", gridTemplateRows: "32px 1fr auto 24px", gridTemplateColumns: "260px 1fr 300px", overflow: "hidden", letterSpacing: "-0.2px" }}>
        {/* ── TOP STATUS BAR ── */}
        <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", background: C.surface, borderBottom: `1px solid ${C.border}`, fontVariantNumeric: "tabular-nums" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: marketStatus.color, boxShadow: `0 0 6px ${marketStatus.color}` }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: marketStatus.color }}>{marketStatus.label}</span>
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center", overflow: "hidden" }}>
            {["SPY", "QQQ", "DIA", "DVY", "IUSG"].map(sym => { const q = bmQuotes[sym] || quotesRef.current?.[sym]; const b = bmBars[sym] || barsRef.current?.[sym]; const c = (q && b?.pc) ? ((q.p - b.pc) / b.pc) * 100 : null; return q?.p ? (
              <span key={sym} onClick={() => { setTerminalActiveSym(sym); setTDrawer(null); }} style={{ fontSize: 11, color: C.t2, whiteSpace: "nowrap", cursor: "pointer" }} onMouseEnter={e => e.currentTarget.style.color = C.accent} onMouseLeave={e => e.currentTarget.style.color = C.t2}>
                <span style={{ fontWeight: 700 }}>{sym}</span>{" "}${q.p.toFixed(2)}{" "}
                <span style={{ color: c != null ? (c >= 0 ? C.up : C.dn) : C.t4 }}>{c != null ? pct(c) : ""}</span>
              </span>
            ) : null; })}
            <span style={{ width: 1, height: 12, background: C.border, flexShrink: 0 }} />
            {macroData.vix != null && <span style={{ fontSize: 11, color: C.t2, whiteSpace: "nowrap" }}><span style={{ fontWeight: 700 }}>VIX</span> <span style={{ color: macroData.vix > 25 ? C.dn : macroData.vix > 18 ? "#FBBF24" : C.up }}>{macroData.vix.toFixed(1)}</span></span>}
            {macroData.oilPrice != null && <span style={{ fontSize: 11, color: C.t2, whiteSpace: "nowrap" }}><span style={{ fontWeight: 700 }}>OIL</span> ${macroData.oilPrice.toFixed(2)} <span style={{ color: macroData.oilChg >= 0 ? C.up : C.dn }}>{macroData.oilChg != null ? `${macroData.oilChg >= 0 ? "+" : ""}${macroData.oilChg.toFixed(2)}%` : ""}</span></span>}
            {macroData.goldPrice != null && <span style={{ fontSize: 11, color: C.t2, whiteSpace: "nowrap" }}><span style={{ fontWeight: 700 }}>GOLD</span> ${macroData.goldPrice.toFixed(0)} <span style={{ color: macroData.goldChg >= 0 ? C.up : C.dn }}>{macroData.goldChg != null ? `${macroData.goldChg >= 0 ? "+" : ""}${macroData.goldChg.toFixed(2)}%` : ""}</span></span>}
          </div>
          <span style={{ fontSize: 10, color: C.t3 }}>{tNow} ET</span>
        </div>

        {/* ── LEFT: WATCHLIST ── */}
        <div style={{ borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Sleeve tabs */}
          <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${C.border}`, flexShrink: 0, overflow: "auto" }}>
            {tSleeveKeys.map(k => (
              <button key={k} onClick={() => setTerminalSleeve(k)} style={{ flex: "0 0 auto", padding: "6px 8px", background: terminalSleeve === k ? C.accentSoft : "transparent", border: "none", borderBottom: terminalSleeve === k ? `2px solid ${C.accent}` : "2px solid transparent", color: terminalSleeve === k ? C.t1 : C.t4, fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: tFont, whiteSpace: "nowrap" }}>{sleeves[k].icon} {sleeves[k].name.split(" ")[0]}</button>
            ))}
          </div>
          {/* Stock list */}
          <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
            {tSleeveSyms.map(sym => { const q = quotesRef.current[sym] || quotes[sym]; const b = barsRef.current[sym] || bars[sym]; const c = (q && b?.pc) ? ((q.p - b.pc) / b.pc) * 100 : null; const isActive = sym === terminalActiveSym; return (
              <div key={sym} onClick={() => setTerminalActiveSym(sym)} style={{ display: "flex", alignItems: "center", padding: "4px 10px", height: 28, cursor: "pointer", background: isActive ? C.accentSoft : "transparent", borderLeft: isActive ? `2px solid ${C.accent}` : "2px solid transparent", gap: 6, boxSizing: "border-box" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: isActive ? C.t1 : C.t2, width: 48, flexShrink: 0 }}>{sym}</span>
                <span style={{ flex: 1, fontSize: 11, color: C.t3, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{q?.p ? `$${q.p.toFixed(2)}` : "—"}</span>
                <span style={{ fontSize: 11, fontWeight: 600, width: 56, textAlign: "right", color: c != null ? (c >= 0 ? C.up : C.dn) : C.t4, fontVariantNumeric: "tabular-nums" }}>{c != null ? pct(c) : "—"}</span>
              </div>
            ); })}
          </div>
        </div>

        {/* ── CENTER + RIGHT: CHART or SECTION CONTENT ── */}
        {tDrawer ? (
          <div style={{ gridColumn: "2 / 4", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "6px 16px", background: C.surface, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: C.accent, textTransform: "uppercase", letterSpacing: 1 }}>{tDrawer}</span>
              <button onClick={() => setTDrawer(null)} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 4, padding: "3px 10px", color: C.t3, fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>✕ Close</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
              {tDrawer === "playbook" && (() => { setTab("playbook"); return null; })() === null && (
                <iframe src={`${window.location.origin}${window.location.pathname}#playbook`} style={{ display: "none" }} />
              )}
              {/* Render inline playbook content */}
              {tDrawer === "playbook" && (() => {
                const bullAgeMo = Math.round((Date.now() - new Date("2022-10-12")) / (30.44 * 86400000));
                const md = macroData;
                return (<div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
                    <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: 14 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: C.t4, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Bull Age</div>
                      <div style={{ fontSize: 24, fontWeight: 900, color: C.t1 }}>{bullAgeMo}<span style={{ fontSize: 12, color: C.t3 }}> months</span></div>
                    </div>
                    <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: 14 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: C.t4, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>From Trough</div>
                      <div style={{ fontSize: 24, fontWeight: 900, color: C.up }}>+{pctFromTrough.toFixed(1)}%</div>
                    </div>
                    <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: 14 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: C.t4, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>From ATH</div>
                      <div style={{ fontSize: 24, fontWeight: 900, color: pctFromATH >= 0 ? C.up : C.dn }}>{pctFromATH >= 0 ? "+" : ""}{pctFromATH.toFixed(1)}%</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: C.t3, marginBottom: 16 }}>For the full Playbook with bear probability model, simulator, scripts, and bond ladder — use the section tabs below or switch layout in Settings.</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {md.yieldSpread != null && <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: 12 }}><div style={{ fontSize: 10, color: C.t4, textTransform: "uppercase", fontWeight: 700 }}>Yield Curve</div><div style={{ fontSize: 18, fontWeight: 800, color: md.yieldSpread < 0 ? C.dn : C.up }}>{md.yieldSpread >= 0 ? "+" : ""}{md.yieldSpread.toFixed(2)}%</div></div>}
                    {md.spyPE != null && <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: 12 }}><div style={{ fontSize: 10, color: C.t4, textTransform: "uppercase", fontWeight: 700 }}>SPY P/E</div><div style={{ fontSize: 18, fontWeight: 800, color: md.spyPE > 30 ? C.dn : md.spyPE > 25 ? "#FBBF24" : C.up }}>{md.spyPE.toFixed(1)}x</div></div>}
                    {md.sahmVal != null && <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: 12 }}><div style={{ fontSize: 10, color: C.t4, textTransform: "uppercase", fontWeight: 700 }}>Sahm Rule</div><div style={{ fontSize: 18, fontWeight: 800, color: md.sahmVal > 0.5 ? C.dn : md.sahmVal > 0.3 ? "#FBBF24" : C.up }}>{md.sahmVal.toFixed(2)}pp</div><div style={{ fontSize: 10, color: C.t4 }}>Trigger: 0.50pp</div></div>}
                    {md.cfnai != null && <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: 12 }}><div style={{ fontSize: 10, color: C.t4, textTransform: "uppercase", fontWeight: 700 }}>CFNAI</div><div style={{ fontSize: 18, fontWeight: 800, color: md.cfnai < -0.7 ? C.dn : md.cfnai < -0.2 ? "#FBBF24" : C.up }}>{md.cfnai.toFixed(2)}</div></div>}
                    {md.baa10y != null && <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: 12 }}><div style={{ fontSize: 10, color: C.t4, textTransform: "uppercase", fontWeight: 700 }}>Credit Spread</div><div style={{ fontSize: 18, fontWeight: 800, color: md.baa10y > 3.5 ? C.dn : md.baa10y > 2.5 ? "#FBBF24" : C.up }}>{md.baa10y.toFixed(2)}%</div></div>}
                    {md.claims4wk != null && <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: 12 }}><div style={{ fontSize: 10, color: C.t4, textTransform: "uppercase", fontWeight: 700 }}>Jobless Claims</div><div style={{ fontSize: 18, fontWeight: 800, color: md.claimsTrend > 10 ? C.dn : md.claimsTrend > 0 ? "#FBBF24" : C.up }}>{(md.claims4wk / 1000).toFixed(0)}K</div><div style={{ fontSize: 10, color: C.t4 }}>Trend: {md.claimsTrend >= 0 ? "+" : ""}{md.claimsTrend?.toFixed(1)}%</div></div>}
                  </div>
                </div>);
              })()}
              {tDrawer === "opportunities" && (<div>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.t1, marginBottom: 12 }}>Opportunity Finder ({opportunities.length})</div>
                {opportunities.map(opp => (
                  <div key={opp.id} style={{ background: C.card, border: `1px solid ${C.border}`, padding: "14px 16px", marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: C.t1 }}>{opp.title}</div>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: opp.conviction === "High Conviction" ? C.upSoft : "#2563EB20", color: opp.conviction === "High Conviction" ? C.up : "#2563EB", whiteSpace: "nowrap" }}>{opp.conviction}</span>
                    </div>
                    <div style={{ fontSize: 11, color: C.t3, marginBottom: 6 }}>{opp.pattern} · {opp.timeframe}</div>
                    <div style={{ fontSize: 12, color: C.t2, lineHeight: 1.6, marginBottom: 8 }}>{opp.catalyst}</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                      {opp.tickers?.map(t => <span key={t} style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 4, background: C.accentSoft, color: C.accent }}>{t}</span>)}
                    </div>
                    {opp.ticker_rationale && Object.entries(opp.ticker_rationale).map(([t, r]) => <div key={t} style={{ fontSize: 11, color: C.t3, lineHeight: 1.5, marginBottom: 4 }}><strong style={{ color: C.accent }}>{t}:</strong> {r}</div>)}
                  </div>
                ))}
              </div>)}
              {tDrawer === "screener" && (<div>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.t1, marginBottom: 8 }}>Stock Screener — {screenerData.length} stocks</div>
                <input value={screenerSearch} onChange={e => setScreenerSearch(e.target.value)} placeholder="Search ticker or company..." style={{ width: "100%", padding: "8px 12px", marginBottom: 10, borderRadius: 4, border: `1px solid ${C.border}`, background: C.surface, color: C.t1, fontSize: 12, fontFamily: "inherit", outline: "none" }} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
                  {screenerData.filter(s => { const q = screenerSearch.toLowerCase(); return !q || s.ticker.toLowerCase().includes(q) || (s.name || "").toLowerCase().includes(q); }).slice(0, 50).map(s => (
                    <div key={s.ticker} onClick={() => { setScreenerDetailLoading(true); setScreenerDetail(s); fetch(`https://richacarson.github.io/Stock-Screener/reports/${s.ticker}.json`).then(r => r.ok ? r.json() : s).then(d => { setScreenerDetail(d); setScreenerDetailLoading(false); }).catch(() => { setScreenerDetail(s); setScreenerDetailLoading(false); }); setTDrawer(null); }} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: C.card, border: `1px solid ${C.border}`, cursor: "pointer" }}>
                      <div><div style={{ fontSize: 12, fontWeight: 700, color: C.t1 }}>{s.ticker}</div><div style={{ fontSize: 10, color: C.t3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 150 }}>{s.name}</div></div>
                      <div style={{ textAlign: "right" }}><span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 3, background: ({"BUY": C.upSoft, "HOLD": "#D9760620", "WATCH": "#2563EB20", "SELL": C.dnSoft})[s.recommendation] || C.accentSoft, color: ({"BUY": C.up, "HOLD": "#D97706", "WATCH": "#2563EB", "SELL": C.dn})[s.recommendation] || C.t2 }}>{s.recommendation}</span><div style={{ fontSize: 14, fontWeight: 800, color: C.t1, marginTop: 2 }}>{s.overall_score}</div></div>
                    </div>
                  ))}
                </div>
              </div>)}
              {tDrawer === "performance" && (<div>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.t1, marginBottom: 12 }}>Portfolio Performance</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
                  {["dividend", "growth", "fci100", "fciValues"].map(k => { const sc = sleeveActualDay(k); const syms = sleeves[k]?.symbols || []; return (
                    <div key={k} style={{ background: C.card, border: `1px solid ${C.border}`, padding: 14 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: C.t4, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{sleeves[k]?.name || k}</div>
                      <div style={{ fontSize: 24, fontWeight: 900, color: sc != null ? (sc >= 0 ? C.up : C.dn) : C.t4 }}>{sc != null ? pct(sc) : "—"}</div>
                      <div style={{ fontSize: 10, color: C.t4 }}>{syms.length} holdings · Day change</div>
                    </div>
                  ); })}
                </div>
                <div style={{ fontSize: 12, fontWeight: 800, color: C.t1, margin: "16px 0 8px" }}>Top Movers Today</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 6 }}>
                  {(() => { const allSyms = [...new Set(Object.values(sleeves).flatMap(s => s.symbols || []))]; return allSyms.map(sym => { const q = quotesRef.current[sym] || quotes[sym]; const b = barsRef.current[sym] || bars[sym]; const c = (q && b?.pc) ? ((q.p - b.pc) / b.pc * 100) : null; return { sym, chg: c, price: q?.p }; }).filter(s => s.chg != null).sort((a, b) => Math.abs(b.chg) - Math.abs(a.chg)).slice(0, 30).map(s => (
                    <div key={s.sym} onClick={() => { setTerminalActiveSym(s.sym); setTDrawer(null); }} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px", background: C.card, border: `1px solid ${C.border}`, cursor: "pointer", fontSize: 11 }}>
                      <span style={{ fontWeight: 700, color: C.t1 }}>{s.sym}</span>
                      <span style={{ fontWeight: 600, color: s.chg >= 0 ? C.up : C.dn }}>{pct(s.chg)}</span>
                    </div>
                  )); })()}
                </div>
              </div>)}
              {tDrawer === "metrics" && (<div>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.t1, marginBottom: 8 }}>Holdings Metrics — {sleeves[tChartSleeve]?.name || "All"}</div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      {["Ticker", "Price", "Day", "P/E", "Div Yield", "52W H", "52W L", "Sector"].map(h => <th key={h} style={{ padding: "6px 8px", textAlign: h === "Ticker" || h === "Sector" ? "left" : "right", color: C.t4, fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {(sleeves[tChartSleeve]?.symbols || []).map(sym => { const q = quotesRef.current[sym] || quotes[sym]; const b = barsRef.current[sym] || bars[sym]; const c = (q && b?.pc) ? ((q.p - b.pc) / b.pc * 100) : null; const f = fundamentals[sym]; return (
                        <tr key={sym} onClick={() => { setTerminalActiveSym(sym); setTDrawer(null); }} style={{ borderBottom: `1px solid ${C.border}`, cursor: "pointer" }} onMouseEnter={e => e.currentTarget.style.background = C.cardHover} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                          <td style={{ padding: "5px 8px", fontWeight: 700, color: C.t1 }}>{sym}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", color: C.t1, fontVariantNumeric: "tabular-nums" }}>{q?.p ? `$${q.p.toFixed(2)}` : "—"}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 600, color: c != null ? (c >= 0 ? C.up : C.dn) : C.t4, fontVariantNumeric: "tabular-nums" }}>{c != null ? pct(c) : "—"}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", color: C.t2 }}>{f?.pe ? f.pe.toFixed(1) : "—"}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", color: f?.dividendYield ? C.up : C.t4 }}>{f?.dividendYield ? `${(f.dividendYield * 100).toFixed(2)}%` : "—"}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", color: C.t3 }}>{f?.["52WeekHigh"] ? `$${f["52WeekHigh"].toFixed(0)}` : "—"}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", color: C.t3 }}>{f?.["52WeekLow"] ? `$${f["52WeekLow"].toFixed(0)}` : "—"}</td>
                          <td style={{ padding: "5px 8px", color: C.t4, fontSize: 10, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f?.sector || "—"}</td>
                        </tr>
                      ); })}
                    </tbody>
                  </table>
                </div>
              </div>)}
              {tDrawer === "briefs" && (<div>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.t1, marginBottom: 12 }}>Briefs & Research</div>
                {[
                  { label: "Morning Brief", url: "https://richacarson.github.io/rich-report/morning-briefs.html", desc: "Daily pre-market analysis" },
                  { label: "Market Commentary", url: "https://richacarson.github.io/iown-data", desc: "Market outlook & strategy" },
                  { label: "The Rich Report", url: "https://richacarson.github.io/rich-report/The_Rich_Report.html", desc: "Macro insights & thesis" },
                  { label: "Quarterly Changes", url: "https://richacarson.github.io/rich-report/rebalance/q2-2026/client.html", desc: "Portfolio rebalance report" },
                ].map(l => <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: C.card, border: `1px solid ${C.border}`, marginBottom: 8, color: C.t1, textDecoration: "none" }}><div><div style={{ fontSize: 13, fontWeight: 700 }}>{l.label}</div><div style={{ fontSize: 10, color: C.t3 }}>{l.desc}</div></div><span style={{ color: C.accent, fontSize: 12 }}>→</span></a>)}
              </div>)}
              {tDrawer === "settings" && (<div>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.t1, marginBottom: 12 }}>Settings</div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.t4, textTransform: "uppercase", marginBottom: 6 }}>Theme</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[{ v: "dark", l: "Dark" }, { v: "light", l: "Light" }, { v: "terminal", l: "Terminal" }].map(({ v, l }) => (
                      <button key={v} onClick={() => toggleTheme(v)} style={{ flex: 1, padding: "8px 0", border: `1px solid ${theme === v ? C.borderActive : C.border}`, background: theme === v ? C.accentSoft : "transparent", color: theme === v ? C.t1 : C.t3, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.t4, textTransform: "uppercase", marginBottom: 6 }}>Layout</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[{ v: "classic", l: "Classic" }, { v: "terminal", l: "Terminal" }].map(({ v, l }) => (
                      <button key={v} onClick={() => { setLayoutMode(v); localStorage.setItem("iown_layout", v); if (v === "classic") setTDrawer(null); }} style={{ flex: 1, padding: "8px 0", border: `1px solid ${layoutMode === v ? C.borderActive : C.border}`, background: layoutMode === v ? C.accentSoft : "transparent", color: layoutMode === v ? C.t1 : C.t3, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>
                    ))}
                  </div>
                </div>
              </div>)}
            </div>
          </div>
        ) : (<>
        {/* ── CENTER: CHART ── */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", borderRight: `1px solid ${C.border}` }}>
          {(() => {
            const [tChartMode, setTChartMode] = [terminalActiveSym === "__portfolio__" ? "portfolio" : "stock", (m) => setTerminalActiveSym(m === "portfolio" ? "__portfolio__" : terminalActiveSym === "__portfolio__" ? "SPY" : terminalActiveSym)];
            const isPortfolio = terminalActiveSym === "__portfolio__";
            const tBmToggles = perfBmToggles;
            const tSleeveData = perfDataMap[tChartSleeve] || perfData || {};
            const portfolio = tSleeveData?.portfolio || [];
            const benchmarks = tSleeveData?.benchmarks || {};
            return (<>
              <div style={{ padding: "4px 10px", background: C.surface, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 6, flexShrink: 0, flexWrap: "wrap" }}>
                {["dividend", "growth", "fci100", "fciValues"].map(k => {
                  const names = { dividend: "Dividend", growth: "Growth", fci100: "FCI 100", fciValues: "FCI Values" };
                  const active = isPortfolio && tChartSleeve === k;
                  return <button key={k} onClick={() => { setTerminalActiveSym("__portfolio__"); setTChartSleeve(k); }} style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 4, border: `1px solid ${active ? C.accentGlow : C.border}`, background: active ? C.accentSoft : "transparent", color: active ? C.accent : C.t3, cursor: "pointer", fontFamily: "inherit" }}>{names[k]}</button>;
                })}
                {isPortfolio && ["1D", "QTD", "YTD", "1Y", "3Y", "5Y", "ALL"].map(r => (
                  <button key={r} onClick={() => setTChartRange(r)} style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 3, border: `1px solid ${tChartRange === r ? C.accent + "66" : C.border}`, background: tChartRange === r ? C.accentSoft : "transparent", color: tChartRange === r ? C.accent : C.t4, cursor: "pointer", fontFamily: "inherit" }}>{r}</button>
                ))}
                {isPortfolio && <span style={{ width: 1, height: 14, background: C.border, margin: "0 2px" }} />}
                {isPortfolio && ({ dividend: ["SPY", "DVY", "DIA"], growth: ["SPY", "IUSG", "QQQ"], fci100: ["SPY", "QQQ", "DIA"], fciValues: ["SPY", "QQQ", "DIA"] }[tChartSleeve] || ["SPY", "DVY", "DIA"]).map(bm => {
                  const bmCol = { SPY: "#6B8DE3", DVY: "#FF9800", DIA: "#C76BDB", IUSG: "#4CAF50", QQQ: "#FF9800" };
                  return <button key={bm} onClick={() => setPerfBmToggles(p => ({ ...p, [bm]: !p[bm] }))} style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, border: `1px solid ${tBmToggles[bm] ? bmCol[bm] + "66" : C.border}`, background: tBmToggles[bm] ? bmCol[bm] + "20" : "transparent", color: tBmToggles[bm] ? bmCol[bm] : C.t4, cursor: "pointer", fontFamily: "inherit" }}>{bm}</button>;
                })}
                {!isPortfolio && <>
                  <span style={{ fontSize: 13, fontWeight: 800, color: C.t1 }}>{terminalActiveSym}</span>
                  <span style={{ fontSize: 11, color: C.t3 }}>{names[terminalActiveSym] || ""}</span>
                  {(() => { const q = quotesRef.current[terminalActiveSym] || quotes[terminalActiveSym]; const b = barsRef.current[terminalActiveSym] || bars[terminalActiveSym]; const c = (q && b?.pc) ? ((q.p - b.pc) / b.pc * 100) : null; return q?.p ? <><span style={{ fontSize: 12, fontWeight: 700, color: C.t1, marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>${q.p.toFixed(2)}</span><span style={{ fontSize: 11, fontWeight: 600, color: c >= 0 ? C.up : C.dn }}>{pct(c)}</span></> : null; })()}
                </>}
              </div>
              {isPortfolio && portfolio.length > 1 ? (() => {
                const PAD = { top: 40, right: 60, bottom: 40, left: 10 };
                const now = new Date();
                let filtered;
                if (tChartRange === "1D") {
                  // Use intraday data if available, aggregate into 5-min candles
                  const intra = intradayPortfolio["1D"];
                  if (intra && intra.length > 2) {
                    const baseV = intra[0].value;
                    const AGG = 3; // 3-minute candles
                    const candles5m = [];
                    for (let i = 0; i < intra.length - 1; i += AGG) {
                      const chunk = intra.slice(i, Math.min(i + AGG + 1, intra.length));
                      const vals = chunk.map(p => ((p.value / baseV) - 1) * 100);
                      const o = vals[0], c = vals[vals.length - 1], h = Math.max(...vals), l = Math.min(...vals);
                      candles5m.push({ date: chunk[chunk.length - 1].date.replace("T", " ").slice(11, 16), o, c, h, l, rawVal: chunk[chunk.length - 1].value, fullDate: chunk[chunk.length - 1].date });
                    }
                    // Benchmark intraday
                    const ibm = intradayBenchmarks["1D"] || {};
                    const bmL = {}; const bmC2 = { SPY: "#6B8DE3", DVY: "#FF9800", DIA: "#C76BDB", IUSG: "#4CAF50", QQQ: "#FF9800" };
                    Object.entries(ibm).forEach(([sym, pts]) => {
                      if (!tBmToggles[sym] || !pts.length) return;
                      const bp = (bmBars[sym]?.pc) || pts[0].close;
                      const bc = [];
                      for (let i = 0; i < pts.length - 1; i += AGG) {
                        const ch = pts.slice(i, Math.min(i + AGG + 1, pts.length));
                        const vs = ch.map(p => ((p.close / bp) - 1) * 100);
                        bc.push({ o: vs[0], c: vs[vs.length - 1], h: Math.max(...vs), l: Math.min(...vs) });
                      }
                      bmL[sym] = bc;
                    });
                    const aV = candles5m.flatMap(c => [c.h, c.l]);
                    Object.values(bmL).forEach(bc => aV.push(...bc.flatMap(c => [c.h, c.l])));
                    const mn = Math.min(...aV), mx = Math.max(...aV), rg = mx - mn || 1;
                    const cW2 = 900, H2 = 400, uW = cW2 - PAD.left - PAD.right;
                    const gp = uW / Math.max(1, candles5m.length); const cdW = Math.max(2, Math.min(12, gp * 0.75));
                    const xP = i => PAD.left + gp * (i + 0.5); const yP = v => PAD.top + ((mx - v) / rg) * (H2 - PAD.top - PAD.bottom);
                    const lastV = candles5m[candles5m.length - 1]?.c || 0;
                    const hc2 = tChartHover != null && tChartHover >= 0 && tChartHover < candles5m.length ? candles5m[tChartHover] : null;
                    return (
                      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
                        <div style={{ position: "absolute", top: 4, left: 10, zIndex: 2, display: "flex", gap: 12, fontSize: 11, fontFamily: "monospace", fontWeight: 600 }}>
                          <span style={{ color: C.t1, fontWeight: 800, fontSize: 13 }}>{({dividend:"DIVIDEND",growth:"GROWTH",fci100:"FCI 100",fciValues:"FCI VALUES"})[tChartSleeve] || "PORTFOLIO"} 1D {lastV >= 0 ? "+" : ""}{lastV.toFixed(2)}%</span>
                          {Object.entries(bmL).map(([sym, bc]) => <span key={sym} style={{ color: bmC2[sym] }}>{sym} {bc[bc.length - 1]?.c >= 0 ? "+" : ""}{bc[bc.length - 1]?.c.toFixed(2)}%</span>)}
                          <span style={{ color: C.t4 }}>3-min candles</span>
                        </div>
                        {hc2 && <div style={{ position: "absolute", top: 20, left: 10, zIndex: 2, fontSize: 11, fontFamily: "monospace", color: C.t2, display: "flex", gap: 10 }}>
                          <span style={{ color: C.t1, fontWeight: 700 }}>{hc2.date}</span>
                          <span>O: {hc2.o >= 0 ? "+" : ""}{hc2.o.toFixed(2)}%</span><span>H: {hc2.h >= 0 ? "+" : ""}{hc2.h.toFixed(2)}%</span><span>L: {hc2.l >= 0 ? "+" : ""}{hc2.l.toFixed(2)}%</span>
                          <span style={{ color: hc2.c >= hc2.o ? C.up : C.dn, fontWeight: 700 }}>C: {hc2.c >= 0 ? "+" : ""}{hc2.c.toFixed(2)}%</span>
                          <span style={{ color: C.t4 }}>${hc2.rawVal?.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        </div>}
                        <div style={{ width: "100%", height: "100%" }}>
                          <svg width="100%" height="100%" viewBox={`0 0 ${cW2} ${H2}`} preserveAspectRatio="xMidYMid meet" onMouseMove={e => { const r2 = e.currentTarget.getBoundingClientRect(); const sX = cW2 / r2.width; const mX = (e.clientX - r2.left) * sX; const idx = Math.round((mX - PAD.left) / gp - 0.5); setTChartHover(idx >= 0 && idx < candles5m.length ? idx : null); }} onMouseLeave={() => setTChartHover(null)}>
                            <rect x={0} y={0} width={cW2} height={H2} fill={C.bg} />
                            {[...Array(7)].map((_, i) => { const v = mn + (rg * i / 6); const yy = yP(v); return <g key={i}><line x1={PAD.left} y1={yy} x2={cW2 - PAD.right} y2={yy} stroke={C.border} strokeWidth={0.5} /><text x={cW2 - PAD.right + 4} y={yy + 3} fill={C.t4} fontSize={9} fontFamily="monospace">{v >= 0 ? "+" : ""}{v.toFixed(2)}%</text></g>; })}
                            <line x1={PAD.left} y1={yP(0)} x2={cW2 - PAD.right} y2={yP(0)} stroke={C.t4} strokeWidth={0.5} strokeDasharray="4,4" />
                            {candles5m.filter((_, i) => i % Math.max(1, Math.floor(candles5m.length / 12)) === 0).map((c, _, a) => { const i = candles5m.indexOf(c); return <text key={i} x={xP(i)} y={H2 - 8} fill={C.t4} fontSize={8} fontFamily="monospace" textAnchor="middle">{c.date}</text>; })}
                            {Object.entries(bmL).map(([sym, bc]) => { const col = bmC2[sym]; const bW = Math.max(1, cdW * 0.45); const off = sym === "SPY" ? -cdW * 0.5 : sym === "DIA" ? cdW * 0.5 : 0; return bc.map((c, i) => (
                              <g key={`${sym}-${i}`} opacity={0.5}><line x1={xP(i) + off} y1={yP(c.h)} x2={xP(i) + off} y2={yP(c.l)} stroke={col} strokeWidth={0.5} /><rect x={xP(i) - bW / 2 + off} y={yP(Math.max(c.o, c.c))} width={bW} height={Math.max(0.5, yP(Math.min(c.o, c.c)) - yP(Math.max(c.o, c.c)))} fill={c.c >= c.o ? col : "transparent"} stroke={col} strokeWidth={0.5} /></g>
                            )); })}
                            {candles5m.map((c, i) => { const bull = c.c >= c.o; const col = bull ? C.up : C.dn; return (
                              <g key={i}><line x1={xP(i)} y1={yP(c.h)} x2={xP(i)} y2={yP(c.l)} stroke={col} strokeWidth={1} /><rect x={xP(i) - cdW / 2} y={yP(Math.max(c.o, c.c))} width={cdW} height={Math.max(1, yP(Math.min(c.o, c.c)) - yP(Math.max(c.o, c.c)))} fill={col} stroke={col} strokeWidth={0.5} rx={0.5} /></g>
                            ); })}
                            {tChartHover != null && tChartHover >= 0 && tChartHover < candles5m.length && <line x1={xP(tChartHover)} y1={PAD.top} x2={xP(tChartHover)} y2={H2 - PAD.bottom} stroke={C.t3} strokeWidth={0.5} strokeDasharray="3,3" />}
                          </svg>
                        </div>
                      </div>
                    );
                  }
                  filtered = portfolio.slice(-5);
                } else if (tChartRange === "QTD") {
                  const qm = Math.floor(now.getMonth() / 3) * 3;
                  const qStart = `${now.getFullYear()}-${String(qm + 1).padStart(2, "0")}-01`;
                  const qtdStart = [...portfolio].reverse().find(p => p.date < qStart);
                  filtered = qtdStart ? portfolio.filter(p => p.date >= qtdStart.date) : portfolio;
                } else if (tChartRange === "YTD") {
                  const yearEnd = `${now.getFullYear() - 1}-12-31`;
                  const ytdStart = [...portfolio].reverse().find(p => p.date <= yearEnd);
                  filtered = ytdStart ? portfolio.filter(p => p.date >= ytdStart.date) : portfolio;
                } else if (tChartRange === "ALL") {
                  filtered = portfolio;
                } else {
                  const days = { "1Y": 365, "3Y": 365 * 3, "5Y": 365 * 5 }[tChartRange] || 365;
                  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
                  filtered = portfolio.filter(p => p.date >= cutoff);
                }
                if (filtered.length < 2) return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: C.t4 }}>Loading portfolio data...</div>;
                const baseVal = filtered[0].value;
                // Build daily candles first
                const dailyCandles = [];
                for (let i = 1; i < filtered.length; i++) {
                  const o = ((filtered[i - 1].value / baseVal) - 1) * 100;
                  const c = ((filtered[i].value / baseVal) - 1) * 100;
                  const body = Math.abs(c - o); const wick = body * 0.3 + 0.05;
                  dailyCandles.push({ date: filtered[i].date, o, c, h: Math.max(o, c) + wick, l: Math.min(o, c) - wick, rawVal: filtered[i].value });
                }
                // Aggregate to weekly for long timeframes (>200 daily candles)
                const useWeekly = dailyCandles.length > 200;
                let candles;
                if (useWeekly) {
                  candles = [];
                  let week = null;
                  for (const d of dailyCandles) {
                    const wk = d.date.slice(0, 4) + "-W" + String(Math.ceil((new Date(d.date).getTime() - new Date(d.date.slice(0, 4) + "-01-01").getTime()) / 604800000)).padStart(2, "0");
                    if (!week || week._wk !== wk) {
                      if (week) candles.push(week);
                      week = { date: d.date, o: d.o, h: d.h, l: d.l, c: d.c, rawVal: d.rawVal, _wk: wk };
                    } else {
                      week.c = d.c; week.h = Math.max(week.h, d.h); week.l = Math.min(week.l, d.l); week.rawVal = d.rawVal; week.date = d.date;
                    }
                  }
                  if (week) candles.push(week);
                } else {
                  candles = dailyCandles;
                }
                const allVals = candles.flatMap(c => [c.h, c.l]);
                const bmLines = {}; const bmColors = { SPY: "#6B8DE3", DVY: "#FF9800", DIA: "#C76BDB", IUSG: "#4CAF50", QQQ: "#FF9800" };
                Object.entries(benchmarks).forEach(([sym, priceMap]) => {
                  if (!tBmToggles[sym]) return;
                  const prices = Object.entries(priceMap).sort((a, b) => a[0].localeCompare(b[0]));
                  if (!prices.length) return;
                  let bp = null; for (const [d, p] of prices) { if (d >= filtered[0].date) { bp = p; break; } }
                  if (!bp) bp = prices[prices.length - 1][1];
                  // Build daily benchmark candles aligned to candle dates
                  const dailyBm = []; let pi = 0;
                  for (let i = 1; i < filtered.length; i++) {
                    while (pi < prices.length - 1 && prices[pi + 1][0] <= filtered[i].date) pi++;
                    const cl = ((prices[pi][1] / bp) - 1) * 100;
                    const prevPi = i > 1 ? (() => { let pp = 0; for (let j = 0; j < prices.length && prices[j][0] <= filtered[i - 1].date; j++) pp = j; return pp; })() : 0;
                    const op = i === 1 ? 0 : ((prices[prevPi][1] / bp) - 1) * 100;
                    const bd = Math.abs(cl - op); const wk = bd * 0.25 + 0.03;
                    dailyBm.push({ o: op, c: cl, h: Math.max(op, cl) + wk, l: Math.min(op, cl) - wk });
                  }
                  const lq = bmQuotes[sym];
                  if (lq?.p && dailyBm.length) { const lv = ((lq.p / bp) - 1) * 100; const last = dailyBm[dailyBm.length - 1]; last.c = lv; last.h = Math.max(last.o, lv) + Math.abs(lv - last.o) * 0.25 + 0.03; last.l = Math.min(last.o, lv) - Math.abs(lv - last.o) * 0.25 - 0.03; }
                  // Aggregate to weekly if portfolio uses weekly
                  if (useWeekly) {
                    const wkBm = []; let wIdx = 0;
                    for (const pc of candles) {
                      let wO = null, wC = null, wH = -Infinity, wL = Infinity;
                      while (wIdx < dailyBm.length && wIdx < dailyCandles.length && dailyCandles[wIdx].date <= pc.date) {
                        const b = dailyBm[wIdx]; if (wO === null) wO = b.o; wC = b.c; wH = Math.max(wH, b.h); wL = Math.min(wL, b.l); wIdx++;
                      }
                      wkBm.push(wO !== null ? { o: wO, c: wC, h: wH, l: wL } : wkBm.length ? { ...wkBm[wkBm.length - 1] } : { o: 0, c: 0, h: 0, l: 0 });
                    }
                    bmLines[sym] = wkBm;
                  } else { bmLines[sym] = dailyBm; }
                  allVals.push(...(bmLines[sym]).flatMap(c => [c.h, c.l]));
                });
                const minV = Math.min(...allVals), maxV = Math.max(...allVals), range = maxV - minV || 1;
                const chartW = 900; const H = 400;
                const usableW = chartW - PAD.left - PAD.right;
                const gap = usableW / Math.max(1, candles.length);
                const candleW = Math.max(1, Math.min(12, gap * 0.75));
                const xPos = i => PAD.left + gap * (i + 0.5);
                const yPos = v => PAD.top + ((maxV - v) / range) * (H - PAD.top - PAD.bottom);
                const lastVal = candles[candles.length - 1]?.c || 0;
                const hc = tChartHover != null && tChartHover >= 0 && tChartHover < candles.length ? candles[tChartHover] : null;
                // Date labels: enforce minimum 70px spacing
                const dateLabels = []; const minLabelGap = 70;
                let lastLabelX = -minLabelGap;
                candles.forEach((c, i) => {
                  const px = xPos(i);
                  if (px - lastLabelX >= minLabelGap) { dateLabels.push(i); lastLabelX = px; }
                });
                return (
                  <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
                    {/* OHLC tooltip */}
                    <div style={{ position: "absolute", top: 4, left: 10, zIndex: 2, display: "flex", gap: 12, fontSize: 11, fontFamily: "monospace", fontWeight: 600 }}>
                      <span style={{ color: C.t1, fontWeight: 800, fontSize: 13 }}>{({dividend:"DIVIDEND",growth:"GROWTH",fci100:"FCI 100",fciValues:"FCI VALUES"})[tChartSleeve] || "PORTFOLIO"} {tChartRange} {lastVal >= 0 ? "+" : ""}{lastVal.toFixed(2)}%</span>
                      {Object.entries(bmLines).map(([sym, bc]) => <span key={sym} style={{ color: bmColors[sym] }}>{sym} {bc[bc.length - 1]?.c >= 0 ? "+" : ""}{bc[bc.length - 1]?.c.toFixed(2)}%</span>)}
                    </div>
                    {hc && (
                      <div style={{ position: "absolute", top: 20, left: 10, zIndex: 2, fontSize: 11, fontFamily: "monospace", color: C.t2, display: "flex", gap: 10 }}>
                        <span style={{ color: C.t1, fontWeight: 700 }}>{hc.date}</span>
                        <span>O: {hc.o >= 0 ? "+" : ""}{hc.o.toFixed(2)}%</span>
                        <span>H: {hc.h >= 0 ? "+" : ""}{hc.h.toFixed(2)}%</span>
                        <span>L: {hc.l >= 0 ? "+" : ""}{hc.l.toFixed(2)}%</span>
                        <span style={{ color: hc.c >= hc.o ? C.up : C.dn, fontWeight: 700 }}>C: {hc.c >= 0 ? "+" : ""}{hc.c.toFixed(2)}%</span>
                        <span style={{ color: C.t4 }}>${hc.rawVal?.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      </div>
                    )}
                    <div style={{ width: "100%", height: "100%" }}>
                      <svg width="100%" height="100%" viewBox={`0 0 ${chartW} ${H}`} preserveAspectRatio="xMidYMid meet" onMouseMove={e => { const rect = e.currentTarget.getBoundingClientRect(); const scaleX = chartW / rect.width; const mx = (e.clientX - rect.left) * scaleX; const idx = Math.round((mx - PAD.left) / gap - 0.5); setTChartHover(idx >= 0 && idx < candles.length ? idx : null); }} onMouseLeave={() => setTChartHover(null)}>
                        <rect x={0} y={0} width={chartW} height={H} fill={C.bg} />
                        {[...Array(7)].map((_, i) => { const v = minV + (range * i / 6); const yp = yPos(v); return <g key={i}><line x1={PAD.left} y1={yp} x2={chartW - PAD.right} y2={yp} stroke={C.border} strokeWidth={0.5} /><text x={chartW - PAD.right + 4} y={yp + 3} fill={C.t4} fontSize={9} fontFamily="monospace">{v >= 0 ? "+" : ""}{v.toFixed(1)}%</text></g>; })}
                        <line x1={PAD.left} y1={yPos(0)} x2={chartW - PAD.right} y2={yPos(0)} stroke={C.t4} strokeWidth={0.5} strokeDasharray="4,4" />
                        {/* Date labels */}
                        {dateLabels.map(i => <text key={i} x={xPos(i)} y={H - 8} fill={C.t4} fontSize={8} fontFamily="monospace" textAnchor="middle">{candles[i].date.slice(0, 7)}</text>)}
                        {/* Benchmark candles */}
                        {Object.entries(bmLines).map(([sym, bc]) => { const col = bmColors[sym]; const bW = Math.max(1, candleW * 0.45); const off = sym === "SPY" ? -candleW * 0.5 : sym === "DIA" ? candleW * 0.5 : 0; return bc.map((c, i) => (
                          <g key={`${sym}-${i}`} opacity={0.5}><line x1={xPos(i) + off} y1={yPos(c.h)} x2={xPos(i) + off} y2={yPos(c.l)} stroke={col} strokeWidth={0.5} /><rect x={xPos(i) - bW / 2 + off} y={yPos(Math.max(c.o, c.c))} width={bW} height={Math.max(0.5, yPos(Math.min(c.o, c.c)) - yPos(Math.max(c.o, c.c)))} fill={c.c >= c.o ? col : "transparent"} stroke={col} strokeWidth={0.5} /></g>
                        )); })}
                        {/* Portfolio candles */}
                        {candles.map((c, i) => { const bull = c.c >= c.o; const col = bull ? C.up : C.dn; return (
                          <g key={i}><line x1={xPos(i)} y1={yPos(c.h)} x2={xPos(i)} y2={yPos(c.l)} stroke={col} strokeWidth={1} /><rect x={xPos(i) - candleW / 2} y={yPos(Math.max(c.o, c.c))} width={candleW} height={Math.max(1, yPos(Math.min(c.o, c.c)) - yPos(Math.max(c.o, c.c)))} fill={col} stroke={col} strokeWidth={0.5} rx={0.5} /></g>
                        ); })}
                        {/* Hover crosshair */}
                        {tChartHover != null && tChartHover >= 0 && tChartHover < candles.length && <line x1={xPos(tChartHover)} y1={PAD.top} x2={xPos(tChartHover)} y2={H - PAD.bottom} stroke={C.t3} strokeWidth={0.5} strokeDasharray="3,3" />}
                      </svg>
                    </div>
                  </div>
                );
              })() : <iframe key={terminalActiveSym} src={tChartUrl} style={{ flex: 1, border: "none", width: "100%", background: C.bg }} title="Chart" />}
            </>);
          })()}
        </div>

        {/* ── RIGHT PANEL ── */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Portfolio Summary (top ~40%) */}
          <div style={{ flex: "0 0 40%", borderBottom: `1px solid ${C.border}`, padding: "8px 12px", overflowY: "auto" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.t4, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Portfolio</div>
            {tPortfolioVal && <div style={{ fontSize: 20, fontWeight: 900, color: C.t1, fontVariantNumeric: "tabular-nums" }}>${tPortfolioVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>}
            {tDayChg != null && <div style={{ fontSize: 12, fontWeight: 600, color: tDayChg >= 0 ? C.up : C.dn, fontVariantNumeric: "tabular-nums", marginBottom: 8 }}>{tDayChg >= 0 ? "+" : ""}{tDayChgDollar?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({pct(tDayChg)})</div>}
            <div style={{ fontSize: 10, fontWeight: 700, color: C.t4, textTransform: "uppercase", letterSpacing: 1, margin: "8px 0 4px" }}>Sleeves</div>
            {["dividend", "growth"].map(k => { const sc = sleeveActualDay(k); return (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 11 }}>
                <span style={{ color: C.t2 }}>{sleeves[k]?.name || k}</span>
                <span style={{ color: sc != null ? (sc >= 0 ? C.up : C.dn) : C.t4, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{sc != null ? pct(sc) : "—"}</span>
              </div>
            ); })}
            <div style={{ fontSize: 10, fontWeight: 700, color: C.t4, textTransform: "uppercase", letterSpacing: 1, margin: "8px 0 4px" }}>Market</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 8px", fontSize: 11 }}>
              <span style={{ color: C.t3 }}>SPY</span><span style={{ color: C.t1, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{tSpyPrice ? `$${tSpyPrice.toFixed(2)}` : "—"}</span>
              <span style={{ color: C.t3 }}>VIX</span><span style={{ color: tVix > 25 ? C.dn : tVix > 18 ? "#FBBF24" : C.up, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{tVix ?? "—"}</span>
              <span style={{ color: C.t3 }}>10Y-2Y</span><span style={{ color: tYieldSpread != null ? (tYieldSpread < 0 ? C.dn : C.t1) : C.t4, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{tYieldSpread != null ? `${tYieldSpread >= 0 ? "+" : ""}${tYieldSpread.toFixed(2)}%` : "—"}</span>
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.t4, textTransform: "uppercase", letterSpacing: 1, margin: "8px 0 4px" }}>Bear Probability</div>
            {(() => { const md = macroData; const bullAgeMo = Math.round((Date.now() - new Date("2022-10-12")) / (30.44 * 86400000)); return (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 8px", fontSize: 10 }}>
              <span style={{ color: C.t3 }}>Yield Curve</span><span style={{ color: md.yieldSpread != null ? (md.yieldSpread < 0 ? C.dn : C.up) : C.t4, textAlign: "right" }}>{md.yieldSpread != null ? `${md.yieldSpread >= 0 ? "+" : ""}${md.yieldSpread.toFixed(2)}%` : "—"}</span>
              <span style={{ color: C.t3 }}>SPY P/E</span><span style={{ color: md.spyPE > 30 ? C.dn : md.spyPE > 25 ? "#FBBF24" : C.up, textAlign: "right" }}>{md.spyPE ? `${md.spyPE.toFixed(1)}x` : "—"}</span>
              <span style={{ color: C.t3 }}>Bull Age</span><span style={{ color: bullAgeMo > 60 ? C.dn : bullAgeMo > 36 ? "#FBBF24" : C.up, textAlign: "right" }}>{bullAgeMo}mo</span>
              <span style={{ color: C.t3 }}>Credit (BAA)</span><span style={{ color: md.baa10y > 3.5 ? C.dn : md.baa10y > 2.5 ? "#FBBF24" : C.up, textAlign: "right" }}>{md.baa10y ? `${md.baa10y.toFixed(2)}%` : "—"}</span>
              <span style={{ color: C.t3 }}>SPY vs 200d</span><span style={{ color: md.spy200 && tSpyPrice ? ((tSpyPrice / md.spy200 - 1) * 100 < 0 ? C.dn : C.up) : C.t4, textAlign: "right" }}>{md.spy200 && tSpyPrice ? `${((tSpyPrice / md.spy200 - 1) * 100).toFixed(1)}%` : "—"}</span>
              <span style={{ color: C.t3 }}>Claims</span><span style={{ color: md.claimsTrend > 10 ? C.dn : md.claimsTrend > 0 ? "#FBBF24" : C.up, textAlign: "right" }}>{md.claims4wk ? `${(md.claims4wk / 1000).toFixed(0)}K` : "—"}</span>
              <span style={{ color: C.t3 }}>CFNAI</span><span style={{ color: md.cfnai < -0.7 ? C.dn : md.cfnai < -0.2 ? "#FBBF24" : C.up, textAlign: "right" }}>{md.cfnai != null ? md.cfnai.toFixed(2) : "—"}</span>
              <span style={{ color: C.t3 }}>Sahm Rule</span><span style={{ color: md.sahmVal > 0.5 ? C.dn : md.sahmVal > 0.3 ? "#FBBF24" : C.up, textAlign: "right" }}>{md.sahmVal != null ? `${md.sahmVal.toFixed(2)}pp` : "—"}</span>
            </div>
            ); })()}
          </div>
          {/* News Feed (bottom ~60%) */}
          <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.t4, textTransform: "uppercase", letterSpacing: 1, padding: "0 12px 4px" }}>News</div>
            {tAllNews.map((article, i) => (
              <div key={article.id || i} onClick={() => { setSelectedArticle(article); }} style={{ padding: "5px 12px", cursor: "pointer", borderBottom: `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 2 }} onMouseEnter={e => e.currentTarget.style.background = C.cardHover} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <div style={{ fontSize: 11, color: C.t1, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{article.headline || article.title}</div>
                <div style={{ display: "flex", gap: 8, fontSize: 10, color: C.t4 }}>
                  <span>{article.source || ""}</span>
                  <span>{ago(article.created_at || article.datetime)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        </>)}
        {/* ── SECTION TABS ── */}
        <div style={{ gridColumn: "1 / -1", display: "flex", gap: 0, borderTop: `1px solid ${C.border}`, background: C.surface, flexShrink: 0 }}>
          {[
            { id: "playbook", label: "Playbook" },
            { id: "screener", label: "Screener" },
            { id: "opportunities", label: "Opps" },
            { id: "performance", label: "Perf" },
            { id: "metrics", label: "Metrics" },
            { id: "briefs", label: "Briefs" },
            { id: "settings", label: "Settings" },
          ].map(t => (
            <button key={t.id} onClick={() => setTDrawer(tDrawer === t.id ? null : t.id)} style={{
              flex: 1, padding: "6px 0", fontSize: 10, fontWeight: 700, fontFamily: "inherit",
              background: tDrawer === t.id ? C.accentSoft : "transparent",
              border: "none", borderRight: `1px solid ${C.border}`,
              color: tDrawer === t.id ? C.accent : C.t4, cursor: "pointer",
              textTransform: "uppercase", letterSpacing: 0.5,
            }}>{t.label}</button>
          ))}
        </div>

        {/* ── BOTTOM STATUS BAR ── */}
        <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", background: C.surface, borderTop: `1px solid ${C.border}`, fontSize: 10 }}>
          <span style={{ color: C.accent, fontWeight: 700 }}>PARADIEM TERMINAL</span>
          <span style={{ color: C.t3 }}>{sleeves[terminalSleeve]?.name || ""} — {tSleeveSyms.length} stocks</span>
          <span style={{ color: C.t4 }}>{lastUp ? `Data: ${lastUp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "Loading..."}</span>
        </div>

        {/* Settings gear to exit terminal mode */}
        <button onClick={() => { setLayoutMode("classic"); try { localStorage.setItem("iown_layout", "classic"); } catch {} }} style={{ position: "fixed", bottom: 32, right: 12, width: 28, height: 28, borderRadius: "50%", background: C.surface, border: `1px solid ${C.border}`, color: C.t3, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 14, zIndex: 999 }} title="Exit Terminal Layout">✕</button>

        {/* Article reader overlay (reuse existing) */}
        {selectedArticle && (() => { const a = selectedArticle; return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setSelectedArticle(null)}>
            <div onClick={e => e.stopPropagation()} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, width: "60%", maxWidth: 700, maxHeight: "80vh", overflow: "auto", padding: 24, fontFamily: tFont }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: 10, color: C.t4 }}>{a.source} — {ago(a.created_at || a.datetime)}</span>
                <button onClick={() => setSelectedArticle(null)} style={{ background: "none", border: "none", color: C.t3, cursor: "pointer", fontSize: 16 }}>✕</button>
              </div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: C.t1, marginBottom: 8 }}>{a.headline || a.title}</h2>
              <p style={{ fontSize: 12, color: C.t2, lineHeight: 1.6 }}>{a.summary || a.content || "No content available."}</p>
              {a.url && <a href={a.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: C.accent, marginTop: 12, display: "inline-block" }}>Read full article →</a>}
            </div>
          </div>
        ); })()}

      </div>
    );
  }

  return (
    <div ref={contentRef} onTouchStart={handleTabSwipeStart} onTouchEnd={handleTabSwipeEnd} style={{ minHeight: "100dvh", background: C.bg, color: C.t1, display: isDesktop ? "flex" : "block", paddingBottom: isDesktop ? 0 : 90, overflowY: "auto", fontFamily: theme === "terminal" ? "'IBM Plex Mono', 'SF Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace" : undefined, letterSpacing: theme === "terminal" ? "-0.2px" : undefined, fontSize: theme === "terminal" ? "13px" : undefined }}>

      {/* DESKTOP SIDEBAR */}
      {isDesktop && (
        <div style={{
          width: 240, position: "fixed", top: 0, bottom: 0, left: 0, zIndex: 50,
          background: C.nav, borderRight: `1px solid ${C.navBorder}`,
          display: "flex", flexDirection: "column",
        }}>
          <div style={{ padding: "20px 20px 16px", borderBottom: `1px solid ${C.navBorder}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src="paradiem-logo-dark.png?v=6" alt="Paradiem" style={{ width: "80%", height: "auto" }} />
          </div>
          <nav style={{ flex: 1, padding: "12px 0" }}>
            {navItems.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                display: "flex", alignItems: "center", gap: 14, width: "100%",
                padding: "14px 24px", background: tab === t.id ? C.navAccentSoft : "transparent",
                border: "none", borderLeft: tab === t.id ? `3px solid ${C.accent}` : "3px solid transparent",
                cursor: "pointer", transition: "all 0.15s",
              }}>
                {t.icon(tab === t.id)}
                <span style={{ fontSize: 14, fontWeight: tab === t.id ? 700 : 500, color: tab === t.id ? C.navText : C.navTextDim }}>{t.label}</span>
              </button>
            ))}
          </nav>
          <div style={{ padding: "20px 24px", borderTop: `1px solid ${C.navBorder}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: marketStatus.color, boxShadow: `0 0 6px ${marketStatus.color}66` }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: C.navTextDim }}>{marketStatus.label}</span>
            </div>
            <div data-last-updated style={{ fontSize: 11, color: C.navTextMuted }}>{lastUp ? `Updated ${lastUp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}</div>
            {loading && <div style={{ fontSize: 11, color: C.navTextDim, marginTop: 4 }}>Refreshing…</div>}
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <div style={{ flex: 1, minWidth: 0, marginLeft: isDesktop ? 240 : 0 }}>

      {/* MOBILE HEADER — hidden on desktop */}
      {!isDesktop && (
      <div style={{
        padding: "12px 18px", paddingTop: "calc(env(safe-area-inset-top, 12px) + 12px)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: `1px solid ${C.border}`,
        background: theme !== "light" ? "rgba(11,8,32,0.88)" : "rgba(234,233,226,0.94)", backdropFilter: "blur(24px) saturate(1.2)", WebkitBackdropFilter: "blur(24px) saturate(1.2)",
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
          <div />
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
                  {(() => {
                    const sectorSyms = sleeves.sectors?.symbols || [];
                    const ranked = sectorSyms
                      .map(s => ({ sym: s, c: chg(s) }))
                      .filter(x => x.c != null)
                      .sort((a, b) => b.c - a.c);
                    const top = ranked[0];
                    if (!top) return null;
                    return (
                      <div key="top-sector" {...stockContextHandlers(top.sym)} style={{
                        flex: isDesktop ? undefined : "0 0 auto",
                        padding: isDesktop ? "16px" : "12px 16px",
                        cursor: "pointer",
                        minWidth: isDesktop ? undefined : 100,
                        background: isDesktop ? C.card : "transparent",
                        border: isDesktop ? `1px solid ${C.border}` : "none",
                        borderRadius: isDesktop ? 14 : 0,
                        transition: "border-color 0.15s",
                      }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: C.t3, marginBottom: 6, whiteSpace: "nowrap" }}>Top Sector</div>
                        <div style={{ display: "flex", alignItems: isDesktop ? "center" : "baseline", gap: 8, flexWrap: isDesktop ? "wrap" : "nowrap" }}>
                          <span style={{ fontSize: isDesktop ? 18 : 14, fontWeight: 700, color: C.t1 }}>{top.sym}</span>
                          <span style={{
                            fontSize: 12, fontWeight: 700, fontVariantNumeric: "tabular-nums",
                            color: top.c > 0 ? C.up : top.c < 0 ? C.dn : C.t3,
                          }}>{pct(top.c)}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
                {!isDesktop && <div style={{ height: 1, background: C.border }} />}
              </div>
            )}
            {/* Spacer before lists */}
            <div style={{ marginTop: 16 }} />

            {/* ━━━ HOLDINGS VIEW (disabled on home — lives in Performance tab) ━━━ */}
            {false && (() => {
              const hPerfData = perfDataMap[holdingsSleeve] || perfDataMap.dividend || Object.values(perfDataMap)[0];
              if (!hPerfData) return null;
              return (
              <div style={{ animation: "fadeIn 0.2s ease" }}>
                {/* Sleeve selector for holdings — hidden until Growth is validated */}
                {false && Object.keys(perfDataMap).length > 1 && (
                  <div style={{ display: "flex", gap: 6, marginTop: 8, marginBottom: 12 }}>
                    {[{ k: "dividend", l: "Dividend", icon: "💰" }, { k: "growth", l: "Growth", icon: "🚀" }].filter(s => perfDataMap[s.k]).map(s => (
                      <button key={s.k} onClick={() => setHoldingsSleeve(s.k)} style={{
                        flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${holdingsSleeve === s.k ? C.borderActive : C.border}`,
                        background: holdingsSleeve === s.k ? C.accentSoft : "transparent",
                        color: holdingsSleeve === s.k ? C.t1 : C.t3, fontSize: 13, fontWeight: 700,
                        cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      }}><span style={{ fontSize: 14 }}>{s.icon}</span>{s.l}</button>
                    ))}
                  </div>
                )}
                {/* Portfolio Summary */}
                <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(4, 1fr)" : "repeat(2, 1fr)", gap: 10, marginTop: 12, marginBottom: 16 }}>
                  {(() => {
                    const totalVal = liveValue ? liveValue.value : 0;
                    const stocksVal = liveValue ? liveValue.stocks : 0;
                    const cashVal = liveValue ? liveValue.cash : (hPerfData.cash || 0);
                    const holdCount = liveValue ? liveValue.holdings : Object.keys(hPerfData.holdings).length;
                    const startVal = hPerfData.portfolio?.[0]?.value || (hPerfData.startBalance || 100000);
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
                {showTxHistory && hPerfData.transactions && (
                  !isDesktop ? (
                  <div style={{ maxHeight: 400, overflow: "auto", marginBottom: 16 }}>
                    {[...hPerfData.transactions].sort((a, b) => b.date.localeCompare(a.date)).map((tx, i) => {
                      const isStock = !!tx.ticker;
                      const typeMap = { PURCHASE: "BUY", SALE: "SELL", DIVIDEND: "DIV", "DIVIDEND REINVESTMENT": "DRIP", DEPOSIT: "DEP", WITHDRAWAL: "WDR", SPLIT: "SPLIT" };
                      const typeColor = tx.type === "PURCHASE" || tx.type === "DEPOSIT" || tx.type === "DIVIDEND" || tx.type === "DIVIDEND REINVESTMENT" ? C.up : tx.type === "SALE" || tx.type === "WITHDRAWAL" ? C.dn : C.t2;
                      return (
                        <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: typeColor, background: typeColor + "18", padding: "3px 6px", borderRadius: 4, flexShrink: 0 }}>{typeMap[tx.type] || tx.type}</span>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 600, color: C.t1 }}>{tx.ticker || "Cash"}{tx.auto && <span style={{ fontSize: 10, color: C.t4, fontWeight: 400, marginLeft: 4 }}>(est {tx.days}d)</span>}</div>
                              {isStock && <div style={{ fontSize: 11, color: C.t4 }}>{tx.shares?.toFixed(2)} @ ${tx.price?.toFixed(2)}</div>}
                              {tx.auto && tx.breakdown && <div style={{ fontSize: 10, color: C.t4, marginTop: 2 }}>{tx.breakdown.slice(0, 5).map(b => `${b.ticker} $${b.amount}`).join(", ")}{tx.breakdown.length > 5 ? ` +${tx.breakdown.length - 5} more` : ""}</div>}
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
                        {[...hPerfData.transactions].sort((a, b) => b.date.localeCompare(a.date)).map((tx, i) => {
                          const isStock = !!tx.ticker;
                          const typeMap = { PURCHASE: "BUY", SALE: "SELL", DIVIDEND: "DIV", "DIVIDEND REINVESTMENT": "DRIP", DEPOSIT: "DEP", WITHDRAWAL: "WDR", SPLIT: "SPLIT" };
                          const typeColor = tx.type === "PURCHASE" || tx.type === "DEPOSIT" || tx.type === "DIVIDEND" || tx.type === "DIVIDEND REINVESTMENT" ? C.up : tx.type === "SALE" || tx.type === "WITHDRAWAL" ? C.dn : C.t2;
                          return (
                            <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                              <td style={{ padding: "8px 12px", color: C.t2 }}>{tx.date}</td>
                              <td style={{ padding: "8px 12px", color: typeColor, fontWeight: 600 }}>{typeMap[tx.type] || tx.type}{tx.auto && <span style={{ fontSize: 10, color: C.t4, fontWeight: 400, marginLeft: 4 }}>est</span>}</td>
                              <td style={{ padding: "8px 12px", color: C.t1, fontWeight: 600 }}>{tx.ticker || (tx.auto && tx.breakdown ? tx.breakdown.slice(0, 4).map(b => b.ticker).join(", ") + (tx.breakdown.length > 4 ? "…" : "") : "—")}</td>
                              <td style={{ padding: "8px 12px", textAlign: "right", color: C.t2 }}>{isStock ? tx.shares?.toFixed(4) : (tx.auto ? `${tx.days}d` : "—")}</td>
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
                  const cashVal = liveValue?.cash || hPerfData.cash || 0;
                  const cashWeight = liveValue ? ((cashVal / liveValue.value) * 100) : 0;
                  const rows = Object.entries(hPerfData.holdings).map(([ticker, shares]) => {
                    const q = quotesRef.current?.[ticker];
                    const price = q?.p || 0;
                    const pc = bars[ticker]?.pc || price;
                    const dayChg = price - pc;
                    const dayChgPct = pc > 0 ? (dayChg / pc) * 100 : 0;
                    const mktValue = shares * price;
                    const weight = totalVal > 0 ? (mktValue / totalVal) * 100 : 0;
                    const cb = hPerfData.costBasis[ticker] || {};
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
            ); })()}

            {/* ━━━ LISTS VIEW ━━━ */}
            {(
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

            {/* Heatmap — fills the space under Lists alongside Top Movers */}
            {Object.keys(quotes).length > 0 && (
              <div style={{ paddingTop: 28, paddingBottom: 20 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: C.t1, marginBottom: 16 }}>Heatmap</div>
                <Heatmap sleeves={Object.fromEntries(["dividend","growth"].filter(k => sleeves[k]).map(k => [k, sleeves[k]]))} chgFn={chg} namesFn={names} onTap={s => openStock(s)} onContext={(s, x, y) => setCtxMenu({ sym: s, x, y })} />
              </div>
            )}
              </div>

              {/* Right column: Top Movers */}
              <div style={{ alignSelf: "start" }}>

            {/* Top Movers */}
            <div style={{ paddingTop: 28 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.t1, marginBottom: 16 }}>Top Movers</div>
              <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: "0 16px" }}>
                {coreSyms.filter(s => (sleeves.dividend?.symbols?.includes(s) || sleeves.growth?.symbols?.includes(s)) && chg(s) != null).sort((a, b) => Math.abs(chg(b)) - Math.abs(chg(a))).slice(0, 15).map((s, i, arr) => (
                  <div key={s}>
                    { renderTickerRow(s) }
                    {i < arr.length - 1 && <div style={{ height: 1, background: C.border }} />}
                  </div>
                ))}
              </div>
            </div>

              </div>
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

            {/* Sub-tab toggle: Economic / Earnings */}
            <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
              {[{ v: "economic", l: "Economic" }, { v: "earnings", l: "Earnings" }].map(({ v, l }) => (
                <button key={v} onClick={() => setCalendarView(v)} style={{
                  flex: 1, padding: "9px 0", borderRadius: 10, border: `1px solid ${calendarView === v ? C.borderActive : C.border}`,
                  background: calendarView === v ? C.accentSoft : "transparent",
                  color: calendarView === v ? C.t1 : C.t3, fontSize: 13, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                }}>{l}</button>
              ))}
            </div>

            {/* ── Economic Calendar ── */}
            {calendarView === "economic" && (() => {
              if (!econCalendar.length) return (
                <div style={{ textAlign: "center", padding: "40px 0", color: C.t4, fontSize: 14 }}>
                  {calendarLoading ? "Loading economic calendar..." : "No economic events loaded."}
                  {!calendarLoading && <button onClick={fetchCalendar} style={{ display: "block", margin: "16px auto 0", padding: "10px 24px", background: C.accentSoft, border: `1px solid ${C.borderActive}`, borderRadius: 10, color: C.t1, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Retry</button>}
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

              const today = new Date();
              const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
              const localDay = today.getDay();
              const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (localDay === 0 ? 6 : localDay - 1));
              const weekStartStr = `${monday.getFullYear()}-${String(monday.getMonth()+1).padStart(2,"0")}-${String(monday.getDate()).padStart(2,"0")}`;

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

            {/* ── Earnings Calendar ── */}
            {calendarView === "earnings" && (() => {
              if (!earningsCalendar.length) return (
                <div style={{ textAlign: "center", padding: "40px 0", color: C.t4, fontSize: 14 }}>
                  {calendarLoading ? "Loading earnings calendar..." : "No earnings data loaded."}
                  {!calendarLoading && <button onClick={fetchCalendar} style={{ display: "block", margin: "16px auto 0", padding: "10px 24px", background: C.accentSoft, border: `1px solid ${C.borderActive}`, borderRadius: 10, color: C.t1, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Retry</button>}
                </div>
              );

              const today = new Date();
              const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
              const localDay = today.getDay();
              const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (localDay === 0 ? 6 : localDay - 1));
              const friday = new Date(monday); friday.setDate(friday.getDate() + 4);
              const weekStart = `${monday.getFullYear()}-${String(monday.getMonth()+1).padStart(2,"0")}-${String(monday.getDate()).padStart(2,"0")}`;
              const weekEnd = `${friday.getFullYear()}-${String(friday.getMonth()+1).padStart(2,"0")}-${String(friday.getDate()).padStart(2,"0")}`;

              const weekEarnings = earningsCalendar.filter(e => e.date >= weekStart && e.date <= weekEnd);
              const iownEarnings = weekEarnings.filter(e => coreSyms.includes(e.symbol));

              const fmtMcap = n => !n ? "" : n >= 1e12 ? `$${(n / 1e12).toFixed(1)}T` : n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(0)}M` : "";
              const fmtEps = n => n == null ? null : typeof n === "number" ? `$${n.toFixed(2)}` : `$${n}`;
              const fmtRev = n => n == null ? null : typeof n === "number" ? vol(n) : String(n);

              const renderEarningsSection = (title, list) => {
                if (!list.length) return null;
                const grouped = {};
                list.forEach(e => {
                  if (!grouped[e.date]) grouped[e.date] = [];
                  grouped[e.date].push(e);
                });

                return (
                  <div style={{ marginBottom: 28 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: C.t1, marginBottom: 12 }}>{title}</div>
                    {Object.entries(grouped).map(([date, events]) => {
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
                            const hasActual = evt.epsActual != null;
                            const beat = hasActual && evt.epsEstimate != null && evt.epsActual > evt.epsEstimate;
                            const miss = hasActual && evt.epsEstimate != null && evt.epsActual < evt.epsEstimate;
                            const hourLabel = evt.hour === "bmo" ? "Pre-market" : evt.hour === "amc" ? "After-close" : evt.hour || "";
                            // Show "Awaiting results" for: past dates, OR today's BMO after 9:30 AM local
                            const nowHour = new Date().getHours();
                            const shouldHaveReported = isPast || (isToday && evt.hour === "bmo" && nowHour >= 10) || (isToday && evt.hour === "amc" && nowHour >= 17);

                            return (
                              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0", borderBottom: i < events.length - 1 ? `1px solid ${C.border}` : "none" }}>
                                <StockLogo symbol={evt.symbol} size={36} logoUrl={fundamentals[evt.symbol]?.logo} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>{evt.symbol}</span>
                                    {evt.companyName && <span style={{ fontSize: 12, color: C.t3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{evt.companyName}</span>}
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 3, flexWrap: "wrap" }}>
                                    {hourLabel && <span style={{ fontSize: 11, color: C.t4 }}>{hourLabel}</span>}
                                    {evt.marketCap > 0 && <span style={{ fontSize: 11, color: C.t4 }}>{fmtMcap(evt.marketCap)}</span>}
                                  </div>
                                  <div style={{ display: "flex", gap: 14, marginTop: 5, fontSize: 12, flexWrap: "wrap" }}>
                                    {evt.epsEstimate != null && <span style={{ color: C.t4 }}>EPS Est: <span style={{ color: C.t2 }}>{fmtEps(evt.epsEstimate)}</span></span>}
                                    {hasActual ? (
                                      <span style={{ color: C.t4 }}>EPS Act: <span style={{ color: beat ? C.up : miss ? C.dn : C.t2, fontWeight: 700 }}>{fmtEps(evt.epsActual)}</span></span>
                                    ) : shouldHaveReported ? (
                                      <span style={{ fontSize: 11, color: C.t4, fontStyle: "italic" }}>Awaiting results...</span>
                                    ) : null}
                                    {evt.revenueEstimate != null && <span style={{ color: C.t4 }}>Rev Est: <span style={{ color: C.t2 }}>{fmtRev(evt.revenueEstimate)}</span></span>}
                                    {evt.revenueActual != null ? (
                                      <span style={{ color: C.t4 }}>Rev Act: <span style={{ color: evt.revenueActual > (evt.revenueEstimate || 0) ? C.up : evt.revenueActual < (evt.revenueEstimate || 0) ? C.dn : C.t2, fontWeight: 700 }}>{fmtRev(evt.revenueActual)}</span></span>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                );
              };

              return (
                <>
                  {renderEarningsSection("Paradiem Holdings", iownEarnings)}
                  {!iownEarnings.length && <div style={{ textAlign: "center", padding: "40px 0", color: C.t4, fontSize: 14 }}>No holdings reporting earnings this week.</div>}
                </>
              );
            })()}
          </div>
        )}

        {/* ━━━ METRICS ━━━ */}
        {tab === "metrics" && (
          <div style={{ animation: "fadeIn 0.3s ease", paddingTop: 20 }}>
            {!isDesktop && <div style={{ fontSize: 24, fontWeight: 800, color: C.t1, marginBottom: 16 }}>Metrics</div>}
            {/* Portfolio selector */}
            <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto", paddingBottom: 4 }}>
              {Object.entries(sleeves).filter(([k]) => k !== "sectors" && k !== "digital").map(([k, sl]) => (
                <button key={k} onClick={() => { setMetricsView(k); setMetricSort({ col: null, dir: "desc" }); }} style={{
                  flex: "0 0 auto", padding: "9px 16px", borderRadius: 10, border: `1px solid ${metricsView === k ? C.borderActive : C.border}`,
                  background: metricsView === k ? C.accentSoft : "transparent",
                  color: metricsView === k ? C.t1 : C.t3, fontSize: 13, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                }}>{sl.icon} {sl.name}</button>
              ))}
            </div>
            {/* Sub-view toggle */}
            <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
              {[{ v: "table", l: "📊 Table" }, { v: "weightcomp", l: "⚖️ Weight Alpha" }, { v: "qvq", l: "🔄 Q1 vs Q2" }, { v: "attribution", l: "📈 Attribution" }, { v: "sector", l: "🥧 Sectors" }, { v: "matrix", l: "⊞ G/V Matrix" }].map(({ v, l }) => (
                <button key={v} onClick={() => setMetricsSubView(v)} style={{
                  flex: "0 0 auto", padding: "9px 14px", borderRadius: 10, border: `1px solid ${metricsSubView === v ? C.borderActive : C.border}`,
                  background: metricsSubView === v ? C.accentSoft : "transparent",
                  color: metricsSubView === v ? C.t1 : C.t3, fontSize: 13, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                }}>{l}</button>
              ))}
            </div>

            {/* ── SECTOR BREAKDOWN ── */}
            {metricsSubView === "sector" && (() => {
              const syms = sleeves[metricsView]?.symbols || [];
              const SO = {
                "ABT": "Healthcare", "DGX": "Healthcare", "SYK": "Healthcare", "HRMY": "Healthcare",
                "ADI": "Technology", "QCOM": "Technology", "TEL": "Technology", "LRCX": "Technology", "KEYS": "Technology", "NXPI": "Technology", "TSM": "Technology", "AMD": "Technology", "NVDA": "Technology", "FTNT": "Technology", "SSNC": "Technology", "CWAN": "Technology", "ADP": "Technology", "CRDO": "Technology", "MRVL": "Technology",
                "CAT": "Industrials", "GD": "Industrials", "LMT": "Industrials", "FAST": "Industrials", "PCAR": "Industrials",
                "ATO": "Utilities", "BKH": "Utilities", "NEE": "Utilities", "EIX": "Utilities", "VST": "Utilities",
                "OKE": "Energy", "VLO": "Energy", "CVX": "Energy", "CNX": "Energy", "DVN": "Energy",
                "CHD": "Consumer Staples", "CL": "Consumer Staples",
                "GPC": "Consumer Disc.", "TOL": "Consumer Disc.", "ATAT": "Consumer Disc.",
                "ORI": "Financials", "SYF": "Financials", "SUPV": "Financials", "COIN": "Financials", "HOOD": "Financials", "HUT": "Financials", "MARA": "Financials",
                "AEM": "Materials", "FCX": "Materials", "NTR": "Materials", "STLD": "Materials",
                "IBIT": "Digital Assets", "ETHA": "Digital Assets",
              };
              const getSector = s => SO[s] || fundamentals[s]?.sector || fundamentals[s]?.industry || "Uncategorized";
              const tw = TARGET_WEIGHTS[metricsView] || {};
              const sectorGroups = {};
              syms.forEach(s => {
                const sec = getSector(s);
                if (!sectorGroups[sec]) sectorGroups[sec] = { stocks: [], weight: 0 };
                sectorGroups[sec].stocks.push(s);
                sectorGroups[sec].weight += tw[s] || 0;
              });
              const totalW = Object.values(sectorGroups).reduce((s, g) => s + g.weight, 0);
              const total = syms.length;
              const sectors = Object.entries(sectorGroups).sort((a, b) => b[1].weight - a[1].weight).map(([name, g]) => ({ name, stocks: g.stocks, count: g.stocks.length, pct: totalW ? (g.weight / totalW * 100) : (g.stocks.length / total * 100) }));

              if (!sectors.length || !total) return <div style={{ textAlign: "center", padding: "40px 0", color: C.t4 }}>No sector data available. Refresh metrics first.</div>;

              const COLORS = ["#FCD432", "#3B82F6", "#22C55E", "#EF4444", "#A855F7", "#06B6D4", "#EC4899", "#F97316", "#10B981", "#8B5CF6", "#84CC16", "#14B8A6"];

              // Clean SVG donut
              const size = 240, cx = size / 2, cy = size / 2, r = 90, strokeW = 28;
              const circ = 2 * Math.PI * r;
              let offset = 0;
              const arcs = sectors.map((s, i) => {
                const len = (s.pct / 100) * circ;
                const gap = sectors.length > 1 ? 2 : 0;
                const arc = { ...s, color: COLORS[i % COLORS.length], dasharray: `${Math.max(0, len - gap)} ${circ - Math.max(0, len - gap)}`, dashoffset: -offset };
                offset += len;
                return arc;
              });

              const toggleSector = name => setSectorExpanded(prev => ({ ...prev, [name]: !prev[name] }));

              return (
                <div>
                  <div style={{ display: "flex", flexDirection: isDesktop ? "row" : "column", alignItems: isDesktop ? "flex-start" : "center", gap: isDesktop ? 40 : 24 }}>
                    {/* Donut chart */}
                    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
                      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                        {/* Background track */}
                        <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.border} strokeWidth={strokeW} opacity={0.4} />
                        {/* Colored arcs */}
                        {arcs.map((a, i) => (
                          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={a.color} strokeWidth={strokeW}
                            strokeDasharray={a.dasharray} strokeDashoffset={a.dashoffset}
                            strokeLinecap="butt" transform={`rotate(-90 ${cx} ${cy})`}
                            style={{ transition: "stroke-dasharray 0.6s ease, stroke-dashoffset 0.6s ease" }} />
                        ))}
                      </svg>
                      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ fontSize: 36, fontWeight: 800, color: C.t1, lineHeight: 1 }}>{total}</div>
                        <div style={{ fontSize: 11, color: C.t4, fontWeight: 600, marginTop: 3 }}>holdings</div>
                      </div>
                    </div>
                    {/* Legend with expandable stock lists */}
                    <div style={{ flex: 1, width: "100%" }}>
                      {arcs.map((a, i) => {
                        const isOpen = sectorExpanded[a.name];
                        return (
                          <div key={i}>
                            <div onClick={() => toggleSector(a.name)} style={{
                              display: "flex", alignItems: "center", gap: 10, padding: "11px 0",
                              borderBottom: (!isOpen && i < arcs.length - 1) ? `1px solid ${C.border}` : "none",
                              cursor: "pointer", userSelect: "none",
                            }}>
                              <div style={{ width: 12, height: 12, borderRadius: "50%", background: a.color, flexShrink: 0, boxShadow: `0 0 6px ${a.color}40` }} />
                              <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: C.t1 }}>{a.name}</div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: C.t3, minWidth: 24, textAlign: "right" }}>{a.count}</div>
                              <div style={{ width: isDesktop ? 80 : 50, height: 6, borderRadius: 3, background: C.border, flexShrink: 0, overflow: "hidden" }}>
                                <div style={{ height: "100%", borderRadius: 3, background: a.color, width: `${a.pct}%`, transition: "width 0.6s ease" }} />
                              </div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, minWidth: 48, textAlign: "right" }}>{a.pct.toFixed(1)}%</div>
                              <div style={{ fontSize: 10, color: C.t4, marginLeft: 2, transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▼</div>
                            </div>
                            {isOpen && (
                              <div style={{ padding: "4px 0 10px 26px", borderBottom: i < arcs.length - 1 ? `1px solid ${C.border}` : "none" }}>
                                {a.stocks.sort().map(sym => {
                                  const stockW = tw[sym];
                                  return (
                                  <div key={sym} {...stockContextHandlers(sym)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", cursor: "pointer" }}>
                                    <StockLogo symbol={sym} size={20} logoUrl={fundamentals[sym]?.logo} />
                                    <span style={{ fontSize: 12, fontWeight: 700, color: C.accent }}>{sym}</span>
                                    {stockW != null && <span style={{ fontSize: 9, fontWeight: 700, color: C.t3, background: C.border + "88", padding: "1px 5px", borderRadius: 3 }}>{stockW}%</span>}
                                    <span style={{ fontSize: 11, color: C.t4, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{names[sym] || fundamentals[sym]?.companyName || ""}</span>
                                    {fundamentals[sym]?.ytd != null && (
                                      <span style={{ fontSize: 11, fontWeight: 700, color: fundamentals[sym].ytd >= 0 ? C.up : C.dn }}>{fundamentals[sym].ytd >= 0 ? "+" : ""}{fundamentals[sym].ytd.toFixed(1)}%</span>
                                    )}
                                  </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}


            {/* ── QUARTERLY RETURNS HEATMAP ── */}
            {metricsSubView === "returnheat" && (() => {
              const syms = sleeves[metricsView]?.symbols || [];
              const periods = [
                { key: "lastQtr", label: "Last Qtr" },
                { key: "thisQtr", label: "This Qtr" },
                { key: "ytd", label: "YTD" },
              ];
              const rows = syms.map(s => {
                const d = fundamentals[s] || {};
                return { sym: s, lastQtr: d.lastQtr, thisQtr: d.thisQtr, ytd: d.ytd, name: names[s] || d.companyName || s };
              }).filter(r => periods.some(p => r[p.key] != null));

              if (!rows.length) return <div style={{ textAlign: "center", padding: "40px 0", color: C.t4 }}>No returns data available. Refresh metrics first.</div>;

              // Sort by YTD, then thisQtr
              rows.sort((a, b) => (b.ytd ?? b.thisQtr ?? -999) - (a.ytd ?? a.thisQtr ?? -999));

              // Color scale: deep green for strong positive, white/neutral for 0, deep red for negative
              const allVals = rows.flatMap(r => periods.map(p => r[p.key]).filter(v => v != null && isFinite(v)));
              const maxAbs = Math.max(...allVals.map(v => Math.abs(v)), 1);

              const heatColor = v => {
                if (v == null) return "transparent";
                const intensity = Math.min(Math.abs(v) / Math.max(maxAbs * 0.5, 8), 1);
                if (v > 0) return `rgba(34, 197, 94, ${0.12 + intensity * 0.38})`;
                if (v < 0) return `rgba(239, 68, 68, ${0.12 + intensity * 0.38})`;
                return C.border;
              };
              const heatText = v => {
                if (v == null) return C.t4;
                if (v > 0) return "#22C55E";
                if (v < 0) return "#EF4444";
                return C.t3;
              };

              // Portfolio averages
              const avgs = periods.map(p => {
                const vals = rows.map(r => r[p.key]).filter(v => v != null && isFinite(v));
                return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
              });

              return (
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.t1, marginBottom: 4 }}>Quarterly Returns</div>
                  <div style={{ fontSize: 12, color: C.t4, marginBottom: 16 }}>Performance heatmap across time periods</div>
                  {/* Summary row */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 18 }}>
                    {periods.map((p, i) => (
                      <div key={p.key} style={{ background: C.card, borderRadius: 12, padding: "12px 10px", border: `1px solid ${C.border}`, textAlign: "center" }}>
                        <div style={{ fontSize: 10, color: C.t4, fontWeight: 600, marginBottom: 4 }}>{p.label} Avg</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: avgs[i] != null ? (avgs[i] >= 0 ? C.up : C.dn) : C.t4 }}>
                          {avgs[i] != null ? `${avgs[i] >= 0 ? "+" : ""}${avgs[i].toFixed(1)}%` : "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Heatmap grid */}
                  <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, overflow: "hidden" }}>
                    {/* Header */}
                    <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "140px 1fr 1fr 1fr" : "80px 1fr 1fr 1fr", background: C.surface, borderBottom: `2px solid ${C.accent}` }}>
                      <div style={{ padding: "10px 10px", fontSize: 10, fontWeight: 700, color: C.t4 }}>Stock</div>
                      {periods.map(p => (
                        <div key={p.key} style={{ padding: "10px 6px", fontSize: 10, fontWeight: 700, color: C.t4, textAlign: "center" }}>{p.label}</div>
                      ))}
                    </div>
                    {/* Rows */}
                    {rows.map((r, i) => (
                      <div key={r.sym} {...stockContextHandlers(r.sym)} style={{
                        display: "grid", gridTemplateColumns: isDesktop ? "140px 1fr 1fr 1fr" : "80px 1fr 1fr 1fr",
                        borderBottom: i < rows.length - 1 ? `1px solid ${C.border}` : "none", cursor: "pointer",
                      }}>
                        <div style={{ padding: "10px 10px", display: "flex", alignItems: "center", gap: 8 }}>
                          <StockLogo symbol={r.sym} size={20} logoUrl={fundamentals[r.sym]?.logo} />
                          <span style={{ fontSize: 13, fontWeight: 700, color: C.accent }}>{r.sym}</span>
                        </div>
                        {periods.map(p => {
                          const v = r[p.key];
                          return (
                            <div key={p.key} style={{
                              padding: "10px 6px", textAlign: "center", fontVariantNumeric: "tabular-nums",
                              background: heatColor(v), borderRadius: 6, margin: "3px 2px",
                              fontSize: 13, fontWeight: 700,
                              color: heatText(v),
                            }}>
                              {v != null ? `${v >= 0 ? "+" : ""}${v.toFixed(1)}%` : "—"}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 10, fontSize: 11, color: C.t4, display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 12, height: 12, borderRadius: 4, background: "rgba(34,197,94,0.45)" }} /> Strong gain</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 12, height: 12, borderRadius: 4, background: "rgba(34,197,94,0.15)" }} /> Mild gain</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 12, height: 12, borderRadius: 4, background: "rgba(239,68,68,0.15)" }} /> Mild loss</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 12, height: 12, borderRadius: 4, background: "rgba(239,68,68,0.45)" }} /> Strong loss</span>
                  </div>
                </div>
              );
            })()}

            {/* ── GROWTH VS VALUE MATRIX ── */}
            {metricsSubView === "matrix" && (() => {
              const syms = sleeves[metricsView]?.symbols || [];
              const SM = {
                "ABT": "Healthcare", "DGX": "Healthcare", "SYK": "Healthcare", "HRMY": "Healthcare",
                "ADI": "Technology", "QCOM": "Technology", "TEL": "Technology", "LRCX": "Technology", "KEYS": "Technology", "NXPI": "Technology", "TSM": "Technology", "AMD": "Technology", "NVDA": "Technology", "FTNT": "Technology", "SSNC": "Technology", "CWAN": "Technology", "ADP": "Technology", "CRDO": "Technology", "MRVL": "Technology",
                "CAT": "Industrials", "GD": "Industrials", "LMT": "Industrials", "FAST": "Industrials", "PCAR": "Industrials",
                "ATO": "Utilities", "BKH": "Utilities", "NEE": "Utilities", "EIX": "Utilities", "VST": "Utilities",
                "OKE": "Energy", "VLO": "Energy", "CVX": "Energy", "CNX": "Energy", "DVN": "Energy",
                "CHD": "Consumer Staples", "CL": "Consumer Staples",
                "GPC": "Consumer Disc.", "TOL": "Consumer Disc.", "ATAT": "Consumer Disc.",
                "ORI": "Financials", "SYF": "Financials", "SUPV": "Financials", "COIN": "Financials", "HOOD": "Financials", "HUT": "Financials", "MARA": "Financials",
                "AEM": "Materials", "FCX": "Materials", "NTR": "Materials", "STLD": "Materials",
                "IBIT": "Digital Assets", "ETHA": "Digital Assets",
              };
              const SC = { "Technology": "#2563EB", "Financials": "#059669", "Healthcare": "#7C3AED",
                "Industrials": "#D97706", "Consumer Staples": "#DB2777", "Consumer Disc.": "#E879A0", "Energy": "#DC2626", "Utilities": "#84CC16",
                "Materials": "#6366F1", "Communication": "#F59E0B", "Digital Assets": "#F97316", "Other": "#9CA3AF" };

              const pts = syms.map(s => {
                const d = fundamentals[s] || {};
                return { sym: s, pe: d.peTTM, rev: d.revenueYoY, sector: SM[s] || d.sector || "Other", name: names[s] || d.companyName || s };
              }).filter(p => p.pe != null && isFinite(p.pe) && p.rev != null && isFinite(p.rev));

              if (!pts.length) return <div style={{ textAlign: "center", padding: "40px 0", color: C.t4 }}>No data available. Refresh metrics first.</div>;

              // Median splits
              const medPE = [...pts].sort((a, b) => a.pe - b.pe)[Math.floor(pts.length / 2)].pe;
              const medRev = [...pts].sort((a, b) => a.rev - b.rev)[Math.floor(pts.length / 2)].rev;

              const quadrants = [
                { key: "star", label: "Stars", desc: "High Growth · Low P/E", icon: "⭐", color: C.up, stocks: pts.filter(p => p.rev >= medRev && p.pe < medPE).sort((a, b) => b.rev - a.rev) },
                { key: "growth", label: "Growth", desc: "High Growth · High P/E", icon: "🚀", color: "#D97706", stocks: pts.filter(p => p.rev >= medRev && p.pe >= medPE).sort((a, b) => b.rev - a.rev) },
                { key: "value", label: "Value", desc: "Low Growth · Low P/E", icon: "💎", color: "#2563EB", stocks: pts.filter(p => p.rev < medRev && p.pe < medPE).sort((a, b) => b.rev - a.rev) },
                { key: "watch", label: "Watch", desc: "Low Growth · High P/E", icon: "⚠️", color: C.dn, stocks: pts.filter(p => p.rev < medRev && p.pe >= medPE).sort((a, b) => b.rev - a.rev) },
              ];

              return (
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.t1, marginBottom: 4 }}>Growth vs Value Matrix</div>
                  <div style={{ fontSize: 12, color: C.t4, marginBottom: 6 }}>Stocks split by median P/E ({medPE.toFixed(1)}) and median Rev Growth ({medRev.toFixed(1)}%)</div>
                  <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "1fr 1fr" : "1fr 1fr", gap: isDesktop ? 10 : 6, marginTop: 14 }}>
                    {quadrants.map(q => (
                      <div key={q.key} style={{
                        background: q.color + "0A", borderRadius: isDesktop ? 14 : 10, padding: isDesktop ? "14px 14px" : "10px 10px",
                        border: `1px solid ${q.color}30`,
                      }}>
                        {/* Quadrant header */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: isDesktop ? 10 : 6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: isDesktop ? 18 : 14 }}>{q.icon}</span>
                            <div>
                              <div style={{ fontSize: isDesktop ? 14 : 12, fontWeight: 700, color: C.t1 }}>{q.label}</div>
                              <div style={{ fontSize: isDesktop ? 10 : 9, color: C.t4 }}>{q.desc}</div>
                            </div>
                          </div>
                          <div style={{ fontSize: isDesktop ? 20 : 16, fontWeight: 800, color: q.color }}>{q.stocks.length}</div>
                        </div>
                        {/* Stock list */}
                        {q.stocks.length === 0 ? (
                          <div style={{ fontSize: 11, color: C.t4, padding: "6px 0", textAlign: "center" }}>No stocks</div>
                        ) : q.stocks.map((p, i) => (
                          <div key={p.sym} {...stockContextHandlers(p.sym)} style={{
                            display: "flex", alignItems: "center", gap: isDesktop ? 8 : 6, padding: isDesktop ? "7px 0" : "5px 0", cursor: "pointer",
                            borderTop: i > 0 ? `1px solid ${C.border}` : "none",
                          }}>
                            {isDesktop && <StockLogo symbol={p.sym} size={22} logoUrl={fundamentals[p.sym]?.logo} />}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: isDesktop ? 13 : 12, fontWeight: 700, color: C.accent }}>{p.sym}</div>
                              {isDesktop && <div style={{ fontSize: 10, color: C.t4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>}
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              <div style={{ fontSize: isDesktop ? 12 : 11, fontWeight: 700, color: p.rev >= 0 ? C.up : C.dn }}>{p.rev >= 0 ? "+" : ""}{p.rev.toFixed(1)}%</div>
                              <div style={{ fontSize: isDesktop ? 10 : 9, color: C.t3 }}>{p.pe.toFixed(1)}x</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* ── Q1 vs Q2 COMPARISON ── */}
            {metricsSubView === "qvq" && (() => {
              const Q1_STOCKS = {
                dividend: ["ABT","A","ADI","ATO","ADP","BKH","CAT","CHD","CL","FAST","GD","GPC","LRCX","LMT","MATX","NEE","ORI","PCAR","QCOM","DGX","SSNC","STLD","SYK","TEL","VLO"],
                growth: ["AMD","AEM","ATAT","CVX","CWAN","CNX","COIN","EIX","FINV","FTNT","GFI","SUPV","HRMY","HUT","HOOD","KEYS","MARA","NVDA","NXPI","OKE","PDD","SYF","TSM","TOL"],
              };
              const sleeve = metricsView;
              const q1Syms = Q1_STOCKS[sleeve] || [];
              const q2Syms = sleeves[sleeve]?.symbols || [];
              const tw = TARGET_WEIGHTS[sleeve] || {};
              const ap = REBALANCE_ANCHORS;
              const q1Ew = q1Syms.length ? 100 / q1Syms.length : 4;
              const pct = v => v != null ? `${v >= 0 ? "+" : ""}${v.toFixed(2)}%` : "—";
              const pctColor = v => v != null ? (v >= 0 ? C.up : C.dn) : C.t4;

              // Q2 weighted daily + since-rebalance (same as home screen / weight alpha)
              const calcPortfolio = (syms, getWeight) => {
                let wDaySum = 0, wDayTot = 0, wRebSum = 0, wRebTot = 0;
                const rows = [];
                for (const s of syms) {
                  const c = chg(s);
                  const w = getWeight(s);
                  const q = quotes[s]?.p;
                  const anc = ap[s];
                  const sinceReb = (anc && q) ? ((q - anc) / anc) * 100 : null;
                  if (c !== null && w > 0) { wDaySum += w * c; wDayTot += w; }
                  if (sinceReb !== null && w > 0) { wRebSum += w * sinceReb; wRebTot += w; }
                  rows.push({ s, w, c, sinceReb });
                }
                return {
                  day: wDayTot > 0 ? wDaySum / wDayTot : null,
                  reb: wRebTot > 0 ? wRebSum / wRebTot : null,
                  rows,
                };
              };

              // Q2: target-weighted with drift for rows, actual portfolio return for headline
              const q2GetW = s => liveWeights[sleeve]?.[s] ?? tw[s] ?? 0;
              const q2 = calcPortfolio(q2Syms, q2GetW);
              const q2ActualDay = sleeveActualDay(sleeve);
              if (q2ActualDay !== null) q2.day = q2ActualDay;

              // Q1: equal-weighted with drift from anchor
              const q1Drift = {};
              let q1DriftTotal = 0;
              for (const s of q1Syms) {
                const anc = ap[s];
                const cur = quotes[s]?.p;
                const growth = (anc && cur) ? cur / anc : 1;
                q1Drift[s] = q1Ew * growth;
                q1DriftTotal += q1Drift[s];
              }
              const q1GetW = s => q1DriftTotal > 0 ? (q1Drift[s] / q1DriftTotal) * 100 : q1Ew;
              const q1 = calcPortfolio(q1Syms, q1GetW);

              const dayAlpha = (q2.day !== null && q1.day !== null) ? q2.day - q1.day : null;
              const rebAlpha = (q2.reb !== null && q1.reb !== null) ? q2.reb - q1.reb : null;

              // Stocks added/removed
              const added = q2Syms.filter(s => !q1Syms.includes(s));
              const removed = q1Syms.filter(s => !q2Syms.includes(s));
              const kept = q2Syms.filter(s => q1Syms.includes(s));

              return (
                <div>
                  {/* Summary cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                    {/* Today */}
                    <div style={{ background: C.card, borderRadius: 14, padding: 16, border: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.t4, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Today</div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: C.t3 }}>Q2 (Current)</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: pctColor(q2.day) }}>{pct(q2.day)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: 12, color: C.t3 }}>Q1 (Old EW)</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: pctColor(q1.day) }}>{pct(q1.day)}</span>
                      </div>
                      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: C.t2 }}>Rebalance Alpha</span>
                        <span style={{ fontSize: 16, fontWeight: 800, color: pctColor(dayAlpha) }}>{pct(dayAlpha)}</span>
                      </div>
                    </div>
                    {/* Since rebalance */}
                    <div style={{ background: C.card, borderRadius: 14, padding: 16, border: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.t4, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Since Rebalance</div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: C.t3 }}>Q2 (Current)</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: pctColor(q2.reb) }}>{pct(q2.reb)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: 12, color: C.t3 }}>Q1 (Old EW)</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: pctColor(q1.reb) }}>{pct(q1.reb)}</span>
                      </div>
                      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: C.t2 }}>Rebalance Alpha</span>
                        <span style={{ fontSize: 16, fontWeight: 800, color: pctColor(rebAlpha) }}>{pct(rebAlpha)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Changes summary */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                    {added.map(s => (
                      <span key={s} style={{ fontSize: 11, fontWeight: 700, color: C.up, background: C.up + "15", padding: "3px 8px", borderRadius: 6 }}>+ {s}</span>
                    ))}
                    {removed.map(s => (
                      <span key={s} style={{ fontSize: 11, fontWeight: 700, color: C.dn, background: C.dn + "15", padding: "3px 8px", borderRadius: 6 }}>- {s}</span>
                    ))}
                  </div>

                  {/* Per-stock table: show all unique stocks */}
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.t4, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Per-Stock Comparison</div>
                  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontVariantNumeric: "tabular-nums", minWidth: 500 }}>
                        <thead>
                          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                            <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: C.t4, fontSize: 10 }}>Ticker</th>
                            <th style={{ padding: "8px 8px", textAlign: "center", fontWeight: 700, color: C.t4, fontSize: 10 }}>Status</th>
                            <th style={{ padding: "8px 8px", textAlign: "right", fontWeight: 700, color: C.t4, fontSize: 10 }}>Q1 Wt%</th>
                            <th style={{ padding: "8px 8px", textAlign: "right", fontWeight: 700, color: C.t4, fontSize: 10 }}>Q2 Wt%</th>
                            <th style={{ padding: "8px 8px", textAlign: "right", fontWeight: 700, color: C.t4, fontSize: 10 }}>Day Chg</th>
                            <th style={{ padding: "8px 8px", textAlign: "right", fontWeight: 700, color: C.t4, fontSize: 10 }}>Since Reb</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...new Set([...q2Syms, ...q1Syms])].sort((a, b) => {
                            // Sort: added first, then removed, then kept — by since-reb impact
                            const aAdded = added.includes(a), bAdded = added.includes(b);
                            const aRemoved = removed.includes(a), bRemoved = removed.includes(b);
                            if (aAdded && !bAdded) return -1; if (!aAdded && bAdded) return 1;
                            if (aRemoved && !bRemoved) return -1; if (!aRemoved && bRemoved) return 1;
                            const aReb = quotes[a]?.p && ap[a] ? ((quotes[a].p - ap[a]) / ap[a]) * 100 : 0;
                            const bReb = quotes[b]?.p && ap[b] ? ((quotes[b].p - ap[b]) / ap[b]) * 100 : 0;
                            return Math.abs(bReb) - Math.abs(aReb);
                          }).map(s => {
                            const isAdded = added.includes(s);
                            const isRemoved = removed.includes(s);
                            const c = chg(s);
                            const sinceReb = (ap[s] && quotes[s]?.p) ? ((quotes[s].p - ap[s]) / ap[s]) * 100 : null;
                            const q1w = q1Syms.includes(s) ? q1GetW(s) : null;
                            const q2w = q2Syms.includes(s) ? q2GetW(s) : null;
                            return (
                              <tr key={s} style={{ borderBottom: `1px solid ${C.border}`, background: isAdded ? C.up + "08" : isRemoved ? C.dn + "08" : "transparent" }}>
                                <td style={{ padding: "8px 12px", fontWeight: 700, color: C.accent }}>{s}</td>
                                <td style={{ padding: "8px 8px", textAlign: "center", fontSize: 10, fontWeight: 700, color: isAdded ? C.up : isRemoved ? C.dn : C.t4 }}>
                                  {isAdded ? "NEW" : isRemoved ? "OUT" : "KEPT"}
                                </td>
                                <td style={{ padding: "8px 8px", textAlign: "right", color: q1w != null ? C.t2 : C.t4 }}>{q1w != null ? q1w.toFixed(1) + "%" : "—"}</td>
                                <td style={{ padding: "8px 8px", textAlign: "right", color: q2w != null ? C.t2 : C.t4 }}>{q2w != null ? q2w.toFixed(1) + "%" : "—"}</td>
                                <td style={{ padding: "8px 8px", textAlign: "right", fontWeight: 600, color: pctColor(c) }}>{pct(c)}</td>
                                <td style={{ padding: "8px 8px", textAlign: "right", fontWeight: 600, color: pctColor(sinceReb) }}>{sinceReb != null ? pct(sinceReb) : "—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ── PERFORMANCE ATTRIBUTION ── */}
            {metricsSubView === "attribution" && (() => {
              const syms = sleeves[metricsView]?.symbols || [];
              const sleeveKey = metricsView;
              const tw = TARGET_WEIGHTS[sleeveKey] || {};
              const ap = REBALANCE_ANCHORS;
              const contributions = syms
                .map(s => {
                  const q = quotes[s]?.p;
                  const anc = ap[s];
                  const qtd = (anc && q) ? ((q - anc) / anc) * 100 : null;
                  const w = liveWeights[sleeveKey]?.[s] ?? tw[s] ?? (100 / syms.length);
                  return { sym: s, qtd, weight: w, name: names[s] || fundamentals[s]?.companyName || s };
                })
                .filter(c => c.qtd != null)
                .sort((a, b) => b.qtd - a.qtd);

              if (!contributions.length) return <div style={{ textAlign: "center", padding: "40px 0", color: C.t4 }}>No live data available. Waiting for market prices.</div>;

              const maxAbs = Math.max(...contributions.map(c => Math.abs(c.qtd)), 0.01);
              const totalW = contributions.reduce((s, c) => s + c.weight, 0);
              const weightedAvg = totalW > 0 ? contributions.reduce((s, c) => s + c.weight * c.qtd, 0) / totalW : 0;

              return (
                <div>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: C.t1 }}>QTD Attribution</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: weightedAvg >= 0 ? C.up : C.dn }}>{weightedAvg >= 0 ? "+" : ""}{weightedAvg.toFixed(2)}% weighted</div>
                  </div>
                  {contributions.map((c, i) => {
                    const barWidth = Math.abs(c.qtd) / maxAbs * 100;
                    const isPos = c.qtd >= 0;
                    return (
                      <div key={c.sym} {...stockContextHandlers(c.sym)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", cursor: "pointer", borderBottom: i < contributions.length - 1 ? `1px solid ${C.border}` : "none" }}>
                        <div style={{ width: 48, fontSize: 13, fontWeight: 700, color: C.accent, flexShrink: 0 }}>{c.sym}</div>
                        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 0 }}>
                          <div style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
                            {!isPos && <div style={{ height: 20, borderRadius: 4, background: C.dn + "30", border: `1px solid ${C.dn}55`, width: `${barWidth}%`, minWidth: 4, transition: "width 0.5s cubic-bezier(0.16,1,0.3,1)" }} />}
                          </div>
                          <div style={{ width: 2, height: 24, background: C.t4 + "40", flexShrink: 0, margin: "0 2px" }} />
                          <div style={{ flex: 1 }}>
                            {isPos && <div style={{ height: 20, borderRadius: 4, background: C.up + "30", border: `1px solid ${C.up}55`, width: `${barWidth}%`, minWidth: 4, transition: "width 0.5s cubic-bezier(0.16,1,0.3,1)" }} />}
                          </div>
                        </div>
                        <div style={{ width: 38, textAlign: "right", fontSize: 11, color: C.t4, flexShrink: 0 }}>{c.weight.toFixed(1)}%</div>
                        <div style={{ width: 58, textAlign: "right", fontSize: 13, fontWeight: 700, color: isPos ? C.up : C.dn, flexShrink: 0 }}>
                          {isPos ? "+" : ""}{c.qtd.toFixed(2)}%
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ marginTop: 16, padding: "14px 0", borderTop: `2px solid ${C.accent}`, display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>Weighted QTD</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: weightedAvg >= 0 ? C.up : C.dn }}>{weightedAvg >= 0 ? "+" : ""}{weightedAvg.toFixed(2)}%</span>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 11, color: C.t4 }}>
                    Top: {contributions[0]?.sym} ({contributions[0]?.qtd >= 0 ? "+" : ""}{contributions[0]?.qtd.toFixed(2)}%) · Bottom: {contributions[contributions.length - 1]?.sym} ({contributions[contributions.length - 1]?.qtd >= 0 ? "+" : ""}{contributions[contributions.length - 1]?.qtd.toFixed(2)}%)
                  </div>
                </div>
              );
            })()}

            {/* ── PEER COMPARISON ── */}
            {metricsSubView === "peers" && (() => {
              const syms = sleeves[metricsView]?.symbols || [];
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

              // Find peers: use ALL holdings across all sleeves, not just current sleeve
              const d = fundamentals[peerSymbol] || {};
              const industry = d.industry;
              const allHoldings = coreSyms;
              let peers = industry
                ? allHoldings.filter(s => s !== peerSymbol && fundamentals[s]?.industry === industry)
                : [];
              // If not enough peers in same industry, grab closest by sector
              if (peers.length < 2) {
                const sector = d.sector;
                const sectorPeers = allHoldings.filter(s => s !== peerSymbol && fundamentals[s]?.sector === sector);
                peers = [...new Set([...peers, ...sectorPeers])].slice(0, 5);
              }
              // Still not enough? Use well-known sector benchmarks
              if (peers.length < 2) {
                const sectorBenchmarks = {
                  "Technology": ["AAPL", "MSFT", "GOOGL"], "Financials": ["JPM", "GS", "BAC"],
                  "Healthcare": ["JNJ", "UNH", "PFE"], "Energy": ["XOM", "COP", "SLB"],
                  "Consumer": ["AMZN", "WMT", "COST"], "Industrials": ["HON", "UNP", "GE"],
                  "Utilities": ["DUK", "SO", "D"], "Materials": ["APD", "ECL", "NEM"],
                  "Communication": ["META", "GOOG", "DIS"],
                };
                const SO = { "ABT":"Healthcare","DGX":"Healthcare","SYK":"Healthcare","HRMY":"Healthcare","ADI":"Technology","QCOM":"Technology","TEL":"Technology","LRCX":"Technology","KEYS":"Technology","NXPI":"Technology","TSM":"Technology","AMD":"Technology","NVDA":"Technology","FTNT":"Technology","SSNC":"Technology","CWAN":"Technology","ADP":"Technology","CRDO":"Technology","MRVL":"Technology","CAT":"Industrials","GD":"Industrials","LMT":"Industrials","FAST":"Industrials","PCAR":"Industrials","ATO":"Utilities","BKH":"Utilities","NEE":"Utilities","EIX":"Utilities","VST":"Utilities","OKE":"Energy","VLO":"Energy","CVX":"Energy","CNX":"Energy","DVN":"Energy","CHD":"Consumer Staples","CL":"Consumer Staples","GPC":"Consumer Disc.","TOL":"Consumer Disc.","ATAT":"Consumer Disc.","ORI":"Financials","SYF":"Financials","SUPV":"Financials","COIN":"Financials","HOOD":"Financials","HUT":"Financials","MARA":"Financials","AEM":"Materials","FCX":"Materials","NTR":"Materials","STLD":"Materials","IBIT":"Digital Assets","ETHA":"Digital Assets" };
                const sec = SO[peerSymbol] || d.sector;
                const benchPeers = (sectorBenchmarks[sec] || []).filter(s => s !== peerSymbol && fundamentals[s]);
                peers = [...new Set([...peers, ...benchPeers])].slice(0, 5);
              }
              // Final fallback: use other holdings
              if (peers.length === 0) peers = allHoldings.filter(s => s !== peerSymbol).slice(0, 5);

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
              if (metricsView === "dividend") {
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
              <div style={{ fontSize: 13, color: C.t4 }}>{sleeves[metricsView]?.symbols?.length || 0} stocks</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={async () => {
                  try {
                  const syms = sleeves[metricsView]?.symbols || [];
                  const isDivView = metricsView === "dividend";
                  const slName = sleeves[metricsView]?.name || metricsView;
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
                  wb.creator = "Paradiem Portfolio Dashboard";
                  const ws = wb.addWorksheet(slName);

                  // Colors (Template: Paradiem Navy/Gold)
                  const brandGreen = "191635";
                  const headerBg = "191635";
                  const headerText = "FCD432";
                  const altRowBg = "EAE9E2";
                  const greenText = "16A34A";
                  const redText = "DC2626";
                  const borderColor = "E5DFD0";
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
                  const fileName = `Paradiem_${slName}_Metrics_${new Date().toISOString().slice(0,10)}.xlsx`;
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
                  onKeyDown={e => { if (e.key === "Enter" && metricsTickerInput) { addSymbol(metricsView, metricsTickerInput); setMetricsTickerInput(""); } }}
                  placeholder="Add ticker…" style={{ flex: 1, padding: "10px 14px", background: C.bg, border: `1px solid ${C.borderActive}`, borderRadius: 10, color: C.t1, fontSize: 14, fontWeight: 600, outline: "none", fontFamily: "inherit", letterSpacing: 1 }} />
                <button onClick={() => { if (metricsTickerInput) { addSymbol(metricsView, metricsTickerInput); setMetricsTickerInput(""); } }} style={{ padding: "10px 16px", background: C.accentSoft, border: `1px solid ${C.borderActive}`, borderRadius: 10, color: C.t1, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Add</button>
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
              const syms = sleeves[metricsView]?.symbols || [];
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
                { l: "Beta", w: 50, k: "beta", fn: d => d.beta != null ? d.beta.toFixed(2) : "—" },
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
                { l: "Beta", w: 50, k: "beta", fn: d => d.beta != null ? d.beta.toFixed(2) : "—" },
              ];
              const cols = (metricsView === "dividend") ? divCols : groCols;

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

              // ── TABLE LAYOUT (both mobile and desktop — scrollable on mobile) ──
              return (
                <div style={{ background: C.card, borderRadius: isDesktop ? 16 : 12, border: `1px solid ${C.border}`, overflow: "hidden", position: "relative" }}>
                  <div style={{ overflowX: "scroll", maxHeight: isDesktop ? "calc(100vh - 280px)" : "calc(100vh - 240px)", overflowY: "auto", WebkitOverflowScrolling: "touch", touchAction: "pan-x pan-y" }}>
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
                                    <div onClick={() => removeSymbol(metricsView, s)} style={{ width: 22, height: 22, borderRadius: 11, background: C.dn + "22", border: `1px solid ${C.dn}44`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
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
                      {/* Averages footer — sticky to bottom */}
                      <tfoot>
                        {/* Equal-weight average row */}
                        <tr style={{ position: "sticky", bottom: 36, zIndex: 3, borderTop: `2px solid ${C.accent}` }}>
                          <td style={{ position: "sticky", left: 0, zIndex: 5, background: C.card, padding: "8px 12px", borderRight: `1px solid ${C.border}`, fontSize: 11, fontWeight: 700, color: C.t3 }}>EW Avg</td>
                          {cols.map(col => {
                            if (col.noAvg) return <td key={`ew-${col.l}`} style={{ padding: "8px 8px", textAlign: "right", fontSize: 12, color: C.t4, background: C.card }}>—</td>;
                            if (col.k === "_day") {
                              const vals = sorted.map(s => dayChg(s)).filter(v => v != null);
                              const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
                              return <td key={`ew-${col.l}`} style={{ padding: "8px 8px", textAlign: "right", fontSize: 12, fontWeight: 700, color: avg > 0 ? C.up : avg < 0 ? C.dn : C.t3, background: C.card, fontVariantNumeric: "tabular-nums" }}>{avg != null ? `${avg >= 0 ? "+" : ""}${avg.toFixed(2)}%` : "—"}</td>;
                            }
                            const vals = sorted.map(s => fundamentals[s]?.[col.k]).filter(v => v != null && isFinite(v));
                            const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
                            const val = avg != null ? col.fn({ [col.k]: avg }) : "—";
                            return <td key={`ew-${col.l}`} style={{ padding: "8px 8px", textAlign: "right", fontSize: 12, fontWeight: 700, color: C.t3, background: C.card, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{val}</td>;
                          })}
                        </tr>
                        {/* Weighted average row */}
                        <tr style={{ position: "sticky", bottom: 0, zIndex: 3, borderTop: `1px solid ${C.border}` }}>
                          <td style={{ position: "sticky", left: 0, zIndex: 5, background: C.card, padding: "10px 12px", borderRight: `1px solid ${C.border}`, fontSize: 12, fontWeight: 800, color: C.t1 }}>Wt Avg</td>
                          {cols.map(col => {
                            if (col.noAvg) return <td key={col.l} style={{ padding: "10px 8px", textAlign: "right", fontSize: 13, color: C.t4, background: C.card }}>—</td>;
                            const tw = TARGET_WEIGHTS[metricsView] || {};
                            const lw = liveWeights[metricsView] || tw;
                            if (col.k === "_day") {
                              let totalW = 0, weightedSum = 0;
                              for (const s of sorted) {
                                const v = dayChg(s);
                                const w = lw[s] || tw[s] || 0;
                                if (v != null && w > 0) { totalW += w; weightedSum += w * v; }
                              }
                              const avg = totalW > 0 ? weightedSum / totalW : null;
                              return <td key={col.l} style={{ padding: "10px 8px", textAlign: "right", fontSize: 13, fontWeight: 800, color: avg > 0 ? C.up : avg < 0 ? C.dn : C.t1, background: C.card, fontVariantNumeric: "tabular-nums" }}>{avg != null ? `${avg >= 0 ? "+" : ""}${avg.toFixed(2)}%` : "—"}</td>;
                            }
                            let totalW = 0, weightedSum = 0;
                            for (const s of sorted) {
                              const v = fundamentals[s]?.[col.k];
                              const w = lw[s] || tw[s] || 0;
                              if (v != null && isFinite(v) && w > 0) { totalW += w; weightedSum += w * v; }
                            }
                            const avg = totalW > 0 ? weightedSum / totalW : null;
                            const avgD = { [col.k]: avg };
                            const val = avg != null ? col.fn(avgD) : "—";
                            return (
                              <td key={col.l} style={{ padding: "10px 8px", textAlign: "right", fontSize: 13, fontWeight: 800, color: C.t1, background: C.card, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{val}</td>
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

            {/* ── WEIGHT ALPHA ── */}
            {metricsSubView === "weightcomp" && (() => {
              const syms = sleeves[metricsView]?.symbols || [];
              const tw = TARGET_WEIGHTS[metricsView] || {};
              const ew = syms.length ? 100 / syms.length : 0;
              const ap = anchorPrices?.prices || {};

              // Use DRIFTED weights from liveWeights — matches home screen exactly
              const getW = (s) => liveWeights[metricsView]?.[s] ?? tw[s] ?? 0;

              // Compute drifted equal weights (each stock starts at ew%, drifts with price)
              let eqDriftTotal = 0;
              const eqDrift = {};
              for (const s of syms) {
                const anc = ap[s];
                const cur = quotes[s]?.p;
                const growth = (anc && cur) ? cur / anc : 1;
                eqDrift[s] = ew * growth;
                eqDriftTotal += eqDrift[s];
              }
              const getEW = (s) => eqDriftTotal > 0 ? (eqDrift[s] / eqDriftTotal) * 100 : ew;

              // Daily returns
              let wDaySum = 0, wDayTot = 0, eDaySum = 0, eDayTot = 0;
              const rows = [];
              for (const s of syms) {
                const c = chg(s);
                const w = getW(s);
                const ewD = getEW(s);
                const q = quotes[s]?.p;
                const anc = ap[s];
                const sinceReb = (anc && q) ? ((q - anc) / anc) * 100 : null;
                if (c !== null) {
                  wDaySum += w * c; wDayTot += w;
                  eDaySum += ewD * c; eDayTot += ewD;
                }
                rows.push({ s, w, ewD, c, sinceReb, wContribDay: c !== null ? w * c / 100 : null, eContribDay: c !== null ? ewD * c / 100 : null, wContribReb: sinceReb !== null ? w * sinceReb / 100 : null, eContribReb: sinceReb !== null ? ewD * sinceReb / 100 : null });
              }
              const wDay = sleeveActualDay(metricsView) ?? (wDayTot > 0 ? wDaySum / wDayTot : null);
              const eDay = eDayTot > 0 ? eDaySum / eDayTot : null;
              const dayAlpha = (wDay !== null && eDay !== null) ? wDay - eDay : null;

              // Since-rebalance returns
              let wRebSum = 0, wRebTot = 0, eRebSum = 0, eRebTot = 0;
              for (const r of rows) {
                if (r.sinceReb !== null) {
                  wRebSum += r.w * r.sinceReb; wRebTot += r.w;
                  eRebSum += r.ewD * r.sinceReb; eRebTot += r.ewD;
                }
              }
              const wReb = wRebTot > 0 ? wRebSum / wRebTot : null;
              const eReb = eRebTot > 0 ? eRebSum / eRebTot : null;
              const rebAlpha = (wReb !== null && eReb !== null) ? wReb - eReb : null;

              rows.sort((a, b) => Math.abs(b.wContribDay ?? 0) - Math.abs(a.wContribDay ?? 0));
              const alphaColor = v => v > 0 ? C.up : v < 0 ? C.dn : C.t3;

              // Build alpha explanation from DIFF data
              const explainAlpha = (alpha, rowData, diffKey) => {
                if (alpha === null || !rowData.length) return null;
                const withDiff = rowData.map(r => ({ s: r.s, diff: r[diffKey] ?? 0, w: r.w, c: r.c, chgKey: diffKey === "diffDay" ? r.c : r.sinceReb })).filter(r => r.diff !== 0);
                const helpers = withDiff.filter(r => r.diff > 0.01).sort((a, b) => b.diff - a.diff).slice(0, 3);
                const hurters = withDiff.filter(r => r.diff < -0.01).sort((a, b) => a.diff - b.diff).slice(0, 3);
                const isNeg = alpha < 0;
                const parts = [];
                if (isNeg && hurters.length) {
                  parts.push(`Overweights that underperformed hurt: ${hurters.map(r => r.s).join(", ")}.`);
                  if (helpers.length) parts.push(`Underweights that outperformed also cost alpha: ${helpers.map(r => r.s).join(", ")}.`);
                } else if (!isNeg && helpers.length) {
                  parts.push(`Overweights that outperformed helped: ${helpers.map(r => r.s).join(", ")}.`);
                  if (hurters.length) parts.push(`Partially offset by: ${hurters.map(r => r.s).join(", ")}.`);
                } else if (hurters.length) {
                  parts.push(`Dragged by: ${hurters.map(r => r.s).join(", ")}.`);
                }
                return parts.join(" ");
              };

              // Add diff fields to rows for explanation
              rows.forEach(r => {
                r.diffDay = (r.wContribDay ?? 0) - (r.eContribDay ?? 0);
                r.diffReb = (r.wContribReb ?? 0) - (r.eContribReb ?? 0);
              });
              const dayExplain = explainAlpha(dayAlpha, rows, "diffDay");
              const rebExplain = explainAlpha(rebAlpha, rows, "diffReb");

              return (
                <div>
                  {/* Summary cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
                    {/* Daily */}
                    <div style={{ background: C.card, borderRadius: 14, padding: 16, border: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.t4, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Today</div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: C.t3 }}>Weighted</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: wDay >= 0 ? C.up : C.dn, fontVariantNumeric: "tabular-nums" }}>{wDay !== null ? pct(wDay) : "—"}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: 12, color: C.t3 }}>Equal Wt</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: eDay >= 0 ? C.up : C.dn, fontVariantNumeric: "tabular-nums" }}>{eDay !== null ? pct(eDay) : "—"}</span>
                      </div>
                      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: C.t2 }}>Alpha</span>
                        <span style={{ fontSize: 16, fontWeight: 800, color: dayAlpha !== null ? alphaColor(dayAlpha) : C.t4, fontVariantNumeric: "tabular-nums" }}>{dayAlpha !== null ? `${dayAlpha >= 0 ? "+" : ""}${dayAlpha.toFixed(3)}%` : "—"}</span>
                      </div>
                      {dayExplain && <div style={{ marginTop: 8, fontSize: 11, color: C.t4, lineHeight: 1.4 }}>{dayExplain}</div>}
                    </div>
                    {/* Since rebalance */}
                    <div style={{ background: C.card, borderRadius: 14, padding: 16, border: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.t4, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Since Rebalance</div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: C.t3 }}>Weighted</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: wReb >= 0 ? C.up : C.dn, fontVariantNumeric: "tabular-nums" }}>{wReb !== null ? pct(wReb) : "—"}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: 12, color: C.t3 }}>Equal Wt</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: eReb >= 0 ? C.up : C.dn, fontVariantNumeric: "tabular-nums" }}>{eReb !== null ? pct(eReb) : "—"}</span>
                      </div>
                      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: C.t2 }}>Alpha</span>
                        <span style={{ fontSize: 16, fontWeight: 800, color: rebAlpha !== null ? alphaColor(rebAlpha) : C.t4, fontVariantNumeric: "tabular-nums" }}>{rebAlpha !== null ? `${rebAlpha >= 0 ? "+" : ""}${rebAlpha.toFixed(2)}%` : "—"}</span>
                      </div>
                      {rebExplain && <div style={{ marginTop: 8, fontSize: 11, color: C.t4, lineHeight: 1.4 }}>{rebExplain}</div>}
                    </div>
                  </div>
                  {/* Per-stock breakdown */}
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.t4, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Per-Stock Contribution (sorted by |weighted impact|)</div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
                      <thead>
                        <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                          <th style={{ textAlign: "left", padding: "6px 8px", color: C.t4, fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Ticker</th>
                          <th style={{ textAlign: "right", padding: "6px 8px", color: C.t4, fontWeight: 600, fontSize: 10, textTransform: "uppercase" }}>Wt %</th>
                          <th style={{ textAlign: "right", padding: "6px 8px", color: C.t4, fontWeight: 600, fontSize: 10, textTransform: "uppercase" }}>EW %</th>
                          <th style={{ textAlign: "right", padding: "6px 8px", color: C.t4, fontWeight: 600, fontSize: 10, textTransform: "uppercase" }}>Chg</th>
                          <th style={{ textAlign: "right", padding: "6px 8px", color: C.t4, fontWeight: 600, fontSize: 10, textTransform: "uppercase" }}>Wt Contrib</th>
                          <th style={{ textAlign: "right", padding: "6px 8px", color: C.t4, fontWeight: 600, fontSize: 10, textTransform: "uppercase" }}>EW Contrib</th>
                          <th style={{ textAlign: "right", padding: "6px 8px", color: C.t4, fontWeight: 600, fontSize: 10, textTransform: "uppercase" }}>Diff</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => {
                          const diff = (r.wContribDay !== null && r.eContribDay !== null) ? r.wContribDay - r.eContribDay : null;
                          return (
                            <tr key={r.s} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 ? C.bg : "transparent" }}>
                              <td style={{ padding: "7px 8px", fontWeight: 700, color: C.t1 }}>{r.s}</td>
                              <td style={{ padding: "7px 8px", textAlign: "right", color: C.t2 }}>{r.w.toFixed(1)}</td>
                              <td style={{ padding: "7px 8px", textAlign: "right", color: C.t3 }}>{r.ewD.toFixed(1)}</td>
                              <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 600, color: r.c >= 0 ? C.up : C.dn }}>{r.c !== null ? pct(r.c) : "—"}</td>
                              <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 600, color: r.wContribDay >= 0 ? C.up : C.dn }}>{r.wContribDay !== null ? `${r.wContribDay >= 0 ? "+" : ""}${r.wContribDay.toFixed(3)}` : "—"}</td>
                              <td style={{ padding: "7px 8px", textAlign: "right", color: r.eContribDay >= 0 ? C.up : C.dn }}>{r.eContribDay !== null ? `${r.eContribDay >= 0 ? "+" : ""}${r.eContribDay.toFixed(3)}` : "—"}</td>
                              <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700, color: diff !== null ? alphaColor(diff) : C.t4 }}>{diff !== null ? `${diff >= 0 ? "+" : ""}${diff.toFixed(3)}` : "—"}</td>
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

        {/* ━━━ BRIEFS ━━━ */}
        {tab === "briefs" && (() => {
          const BRIEFS = [
            { id: "morning", title: "Morning Brief", icon: "☀️", desc: "Daily pre-market analysis", url: "https://richacarson.github.io/rich-report/morning-briefs.html", color: theme !== "light" ? "#F59E0B" : "#D97706" },
            { id: "commentary", title: "Market Commentary", icon: "📊", desc: "Market outlook & strategy", url: "https://richacarson.github.io/iown-data", color: theme !== "light" ? "#34D399" : "#16A34A" },
            { id: "report", title: "The Rich Report", icon: "📰", desc: "Macro insights & thesis", url: "https://richacarson.github.io/rich-report/The_Rich_Report.html", color: theme !== "light" ? "#6366F1" : "#4F46E5" },
            { id: "quarterly", title: "Quarterly Changes", icon: "📋", desc: "Portfolio rebalance report", url: "https://richacarson.github.io/rich-report/rebalance/q2-2026/client.html", color: theme !== "light" ? "#A78BFA" : "#7C3AED" },
          ];
          const active = BRIEFS.find(b => b.id === briefView);

          return (
            <div style={{ animation: "fadeIn 0.3s ease", paddingTop: 20, display: "flex", flexDirection: "column", height: briefView ? "calc(100dvh - 140px)" : "auto" }}>
              {!isDesktop && !briefView && <div style={{ fontSize: 24, fontWeight: 800, color: C.t1, marginBottom: 16 }}>Briefs</div>}

              {/* Back button when viewing a brief */}
              {briefView && (
                <div style={{ display: "flex", gap: 6, marginBottom: 0, flexShrink: 0, paddingBottom: 4 }}>
                  <button onClick={() => setBriefView(null)} style={{
                    flex: "0 0 auto", padding: "10px 16px", borderRadius: 12,
                    border: `1px solid ${C.border}`,
                    background: C.card,
                    cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8,
                    transition: "all 0.2s",
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.t3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.t3 }}>Back</span>
                  </button>
                  <span style={{ padding: "10px 16px", fontSize: 13, fontWeight: 700, color: C.t1, display: "flex", alignItems: "center" }}>{active?.title}</span>
                </div>
              )}

              {/* Brief cards — shown when no brief is active */}
              {!briefView && <div style={{ display: isDesktop ? "grid" : "flex", gridTemplateColumns: isDesktop ? "repeat(3, 1fr)" : undefined, flexDirection: isDesktop ? undefined : "column", gap: 14 }}>
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
              </div>}
            </div>
          );
        })()}

        {/* ━━━ RESEARCH ━━━ */}
        {tab === "research" && (() => {
          const renderMarkdown = (md) => {
            if (!md) return null;
            // Strip YAML frontmatter
            let text = md;
            const fmMatch = text.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
            if (fmMatch) text = text.slice(fmMatch[0].length).trim();
            const lines = text.split("\n");
            const elements = [];
            let inList = false;
            let listItems = [];
            const flushList = () => {
              if (listItems.length > 0) {
                elements.push(<ul key={`ul-${elements.length}`} style={{ margin: "12px 0", paddingLeft: 24, color: C.t2 }}>{listItems}</ul>);
                listItems = [];
                inList = false;
              }
            };
            const renderInline = (text) => {
              // Bold, italic, inline code, links
              return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/).map((part, i) => {
                if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
                if (part.startsWith("*") && part.endsWith("*")) return <em key={i}>{part.slice(1, -1)}</em>;
                if (part.startsWith("`") && part.endsWith("`")) return <code key={i} style={{ background: C.card, padding: "2px 6px", borderRadius: 4, fontSize: "0.9em" }}>{part.slice(1, -1)}</code>;
                const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
                if (linkMatch) return <a key={i} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" style={{ color: theme !== "light" ? "#60A5FA" : "#2563EB" }}>{linkMatch[1]}</a>;
                return part;
              });
            };
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              // Table detection: line starts with |
              if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
                flushList();
                const tableRows = [];
                let j = i;
                while (j < lines.length && lines[j].trim().startsWith("|") && lines[j].trim().endsWith("|")) {
                  tableRows.push(lines[j]);
                  j++;
                }
                if (tableRows.length >= 2) {
                  const parseRow = (row) => row.split("|").slice(1, -1).map(c => c.trim());
                  const headers = parseRow(tableRows[0]);
                  // Skip separator row (|---|---|)
                  const dataStart = tableRows[1].replace(/[|\s-:]/g, "") === "" ? 2 : 1;
                  const tStyle = { borderCollapse: "collapse", width: "100%", fontSize: 13, margin: "12px 0" };
                  const thStyle = { textAlign: "left", padding: "8px 12px", borderBottom: `2px solid ${C.border}`, color: C.t1, fontWeight: 700, whiteSpace: "nowrap" };
                  const tdStyle = { padding: "8px 12px", borderBottom: `1px solid ${C.border}`, color: C.t2, lineHeight: 1.5 };
                  elements.push(
                    <div key={i} style={{ overflowX: "auto", margin: "12px 0" }}>
                      <table style={tStyle}>
                        <thead><tr>{headers.map((h, hi) => <th key={hi} style={thStyle}>{renderInline(h)}</th>)}</tr></thead>
                        <tbody>{tableRows.slice(dataStart).map((row, ri) => {
                          const cells = parseRow(row);
                          return <tr key={ri}>{cells.map((c, ci) => <td key={ci} style={tdStyle}>{renderInline(c)}</td>)}</tr>;
                        })}</tbody>
                      </table>
                    </div>
                  );
                  i = j - 1; // skip processed table rows
                  continue;
                }
              }
              if (line.startsWith("# ")) { flushList(); elements.push(<h1 key={i} style={{ fontSize: 28, fontWeight: 800, color: C.t1, margin: "24px 0 12px" }}>{renderInline(line.slice(2))}</h1>); }
              else if (line.startsWith("## ")) { flushList(); elements.push(<h2 key={i} style={{ fontSize: 22, fontWeight: 700, color: C.t1, margin: "20px 0 10px" }}>{renderInline(line.slice(3))}</h2>); }
              else if (line.startsWith("### ")) { flushList(); elements.push(<h3 key={i} style={{ fontSize: 18, fontWeight: 700, color: C.t1, margin: "16px 0 8px" }}>{renderInline(line.slice(4))}</h3>); }
              else if (line.startsWith("- ") || line.startsWith("* ")) { inList = true; listItems.push(<li key={i} style={{ marginBottom: 6, lineHeight: 1.6 }}>{renderInline(line.slice(2))}</li>); }
              else if (line.trim() === "") { flushList(); }
              else if (line.startsWith("---")) { flushList(); elements.push(<hr key={i} style={{ border: "none", borderTop: `1px solid ${C.border}`, margin: "20px 0" }} />); }
              else { flushList(); elements.push(<p key={i} style={{ margin: "10px 0", lineHeight: 1.7, color: C.t2 }}>{renderInline(line)}</p>); }
            }
            flushList();
            return elements;
          };

          const activeReport = researchReports.find(r => r.id === researchView);

          return (
            <div style={{ animation: "fadeIn 0.3s ease", paddingTop: 20 }}>
              {!isDesktop && !researchView && <div style={{ fontSize: 24, fontWeight: 800, color: C.t1, marginBottom: 16 }}>Research</div>}

              {researchView ? (
                <div>
                  <button onClick={() => { setResearchView(null); setResearchContent(""); }} style={{
                    background: "none", border: `1px solid ${C.border}`, borderRadius: 10,
                    padding: "8px 16px", color: C.t3, fontSize: 13, fontWeight: 600,
                    cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6,
                    marginBottom: 20,
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.t3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                    Back to reports
                  </button>
                  {activeReport && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 11, color: C.t4, marginBottom: 4 }}>
                        {activeReport.date} {activeReport.category && <span style={{ marginLeft: 8, padding: "2px 8px", background: C.accentSoft, borderRadius: 6, fontSize: 10, fontWeight: 600 }}>{activeReport.category}</span>}
                      </div>
                    </div>
                  )}
                  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: isDesktop ? "32px 48px" : "20px 18px" }}>
                    {researchContent ? renderMarkdown(researchContent) : <div style={{ color: C.t4, padding: 20, textAlign: "center" }}>Loading report...</div>}
                  </div>
                </div>
              ) : (
                <div>
                  {researchReports.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "60px 20px", color: C.t4 }}>
                      <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: C.t3, marginBottom: 8 }}>No research reports yet</div>
                      <div style={{ fontSize: 13 }}>Reports will appear here as they are published.</div>
                    </div>
                  ) : (() => {
                    // Group reports by category into folders
                    const grouped = {};
                    researchReports.forEach(r => {
                      const cat = r.category || "Uncategorized";
                      if (!grouped[cat]) grouped[cat] = [];
                      grouped[cat].push(r);
                    });
                    const categories = Object.keys(grouped);
                    // If only one category, don't show folder UI — just list reports
                    const showFolders = categories.length > 1 || (categories.length === 1 && grouped[categories[0]].length > 1);
                    const openReport = (report) => {
                      setResearchView(report.id);
                      setResearchContent("");
                      fetch(`${import.meta.env.BASE_URL || "/"}research/${report.file}?t=${Math.floor(Date.now() / 60000)}`)
                        .then(r => r.ok ? r.text() : "Failed to load report.")
                        .then(setResearchContent)
                        .catch(() => setResearchContent("Failed to load report."));
                    };
                    const ReportCard = ({ report }) => (
                      <div onClick={() => openReport(report)} style={{
                        background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
                        padding: isDesktop ? "20px 24px" : "16px 14px",
                        cursor: "pointer", transition: "border-color 0.2s, transform 0.15s",
                      }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = theme !== "light" ? "#60A5FA66" : "#2563EB44"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = "none"; }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 15, fontWeight: 700, color: C.t1, marginBottom: 5 }}>{report.title}</div>
                            {report.summary && <div style={{ fontSize: 12, color: C.t4, lineHeight: 1.5, marginBottom: 6 }}>{report.summary}</div>}
                            <div style={{ display: "flex", gap: 10, fontSize: 11, color: C.t4 }}>
                              <span>{report.date}</span>
                              {report.author && <span>{report.author}</span>}
                            </div>
                          </div>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.t4} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 4 }}>
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </div>
                      </div>
                    );
                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        {categories.map(cat => {
                          const reports = grouped[cat];
                          const isOpen = researchOpenFolders[cat] === true; // default closed
                          return showFolders ? (
                            <div key={cat}>
                              <div onClick={() => setResearchOpenFolders(prev => ({ ...prev, [cat]: !isOpen }))} style={{
                                display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
                                background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
                                cursor: "pointer", marginBottom: isOpen ? 10 : 0,
                              }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill={C.accent + "33"} stroke={C.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                  {isOpen ? <><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /><line x1="2" y1="10" x2="22" y2="10" /></> : <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />}
                                </svg>
                                <div style={{ flex: 1 }}>
                                  <span style={{ fontSize: 15, fontWeight: 700, color: C.t1 }}>{cat}</span>
                                  <span style={{ fontSize: 12, color: C.t4, marginLeft: 8 }}>{reports.length} report{reports.length !== 1 ? "s" : ""}</span>
                                </div>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.t4} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>
                                  <polyline points="9 18 15 12 9 6" />
                                </svg>
                              </div>
                              {isOpen && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: isDesktop ? 16 : 8 }}>
                                  {reports.map(r => <ReportCard key={r.id} report={r} />)}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div key={cat} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                              {reports.map(r => <ReportCard key={r.id} report={r} />)}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })()}

        {/* ━━━ CHARTS ━━━ */}
        {tab === "charts" && (() => {
          const isDark = theme !== "light";
          const activeSym = chartsActiveSym || coreSyms[0] || "SPY";
          const liveQ = quotesRef.current?.[activeSym];
          const livePrice = liveQ?.p;
          const prevClose = barsRef.current?.[activeSym]?.pc;
          const dayChg = livePrice && prevClose ? ((livePrice - prevClose) / prevClose * 100) : null;

          // Group symbols by sleeve
          const groups = Object.entries(sleeves).map(([k, sl]) => ({
            key: k, name: sl.name, icon: sl.icon, symbols: sl.symbols,
          }));

          const renderWatchlistItem = (sym) => {
            const isActive = sym === activeSym;
            return (
              <div key={sym} onClick={() => { setChartsActiveSym(sym); setChartsMobileList(false); }} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 14px", cursor: "pointer", borderRadius: 10,
                background: isActive ? C.accentSoft : "transparent",
                borderLeft: isActive ? `3px solid ${C.accent}` : "3px solid transparent",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <StockLogo symbol={sym} size={28} logoUrl={fundamentals[sym]?.logo} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: isActive ? C.t1 : C.t2 }}>{sym}</div>
                    <div style={{ fontSize: 10, color: C.t4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 100 }}>{names[sym] || ""}</div>
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0, minWidth: 62, fontVariantNumeric: "tabular-nums" }}>
                  <div data-wl-price={sym} style={{ fontSize: 12, fontWeight: 600, color: C.t2 }}>{quotesRef.current?.[sym]?.p ? `$${quotesRef.current[sym].p.toFixed(2)}` : "—"}</div>
                  <div data-wl-chg={sym} style={{ fontSize: 10, fontWeight: 700, color: (() => { const q = quotesRef.current?.[sym]; const pc = barsRef.current?.[sym]?.pc; return q?.p && pc ? ((q.p - pc) / pc * 100) >= 0 ? C.up : C.dn : C.t4; })() }}>{(() => { const q = quotesRef.current?.[sym]; const pc = barsRef.current?.[sym]?.pc; if (q?.p && pc) { const chg = ((q.p - pc) / pc * 100); return `${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%`; } return ""; })()}</div>
                </div>
              </div>
            );
          };

          const renderSidebar = (asList) => (
            <div style={{ padding: "8px 6px" }}>
              {groups.map(g => (
                <div key={g.key} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.t4, padding: "6px 14px", textTransform: "uppercase", letterSpacing: 0.5 }}>{g.icon} {g.name}</div>
                  {g.symbols.map(s => renderWatchlistItem(s))}
                </div>
              ))}
            </div>
          );

          const chartBg = C.card.replace("#", "");
          const chartUrl = `https://s.tradingview.com/widgetembed/?frameElementId=tv_chart_full&symbol=${activeSym}&interval=D&hidesidetoolbar=0&symboledit=0&saveimage=0&toolbarbg=${chartBg}&studies=%5B%7B%22id%22%3A%22MASimple%40tv-basicstudies%22%2C%22inputs%22%3A%7B%22length%22%3A50%7D%7D%2C%7B%22id%22%3A%22MASimple%40tv-basicstudies%22%2C%22inputs%22%3A%7B%22length%22%3A200%7D%7D%5D&theme=${isDark ? "dark" : "light"}&style=1&timezone=America%2FNew_York&withdateranges=1&showpopupbutton=0&studies_overrides={}&overrides={"paneProperties.background"%3A"%23${chartBg}"%2C"paneProperties.backgroundType"%3A"solid"}&enabled_features=%5B%22header_chart_type%22%2C%22header_indicators%22%2C%22header_screenshot%22%2C%22header_undo_redo%22%5D&disabled_features=[]&locale=en`;

          return (
            <div style={{
              position: "fixed", inset: 0, zIndex: 9999, background: C.bg,
              display: "flex", flexDirection: isDesktop ? "row" : "column",
              paddingTop: "env(safe-area-inset-top, 0px)",
            }}>
              {/* Mobile header */}
              {!isDesktop && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
                  <button onClick={() => setTab("home")} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", padding: 4 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.t3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                  </button>
                  <StockLogo symbol={activeSym} size={28} logoUrl={fundamentals[activeSym]?.logo} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: C.t1 }}>{activeSym}</div>
                    <div style={{ fontSize: 11, color: C.t4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{names[activeSym] || ""}</div>
                  </div>
                  {livePrice && <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: C.t1 }}>${livePrice.toFixed(2)}</div>
                    {dayChg != null && <div style={{ fontSize: 11, fontWeight: 700, color: dayChg >= 0 ? C.up : C.dn }}>{dayChg >= 0 ? "+" : ""}{dayChg.toFixed(2)}%</div>}
                  </div>}
                  <button onClick={() => setChartsMobileList(!chartsMobileList)} style={{
                    background: chartsMobileList ? C.accentSoft : C.card, border: `1px solid ${chartsMobileList ? C.borderActive : C.border}`,
                    borderRadius: 10, padding: "8px 12px", cursor: "pointer", fontFamily: "inherit",
                    display: "flex", alignItems: "center", flexShrink: 0, marginLeft: 4,
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={chartsMobileList ? C.t1 : C.t3} strokeWidth="2" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
                  </button>
                </div>
              )}
              {/* Mobile content: chart + watchlist both rendered, layered to preserve scroll */}
              {!isDesktop && (
                <div style={{ flex: 1, position: "relative" }}>
                  {chartsMobileList && <div style={{ position: "absolute", inset: 0, overflowY: "scroll", WebkitOverflowScrolling: "touch", zIndex: 1, background: C.bg }}>
                    {renderSidebar(true)}
                    <div style={{ height: 80 }} />
                  </div>}
                  <iframe
                    key={activeSym}
                    src={chartUrl}
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none", display: "block" }}
                    title={`${activeSym} Chart`}
                  sandbox="allow-scripts allow-same-origin allow-popups"
                />
                </div>
              )}
              {/* Desktop layout */}
              {isDesktop && (
                <>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 20px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
                      <button onClick={() => setTab("home")} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", padding: 4 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.t3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                      </button>
                      <StockLogo symbol={activeSym} size={34} logoUrl={fundamentals[activeSym]?.logo} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 17, fontWeight: 800, color: C.t1 }}>{activeSym}</div>
                        <div style={{ fontSize: 11, color: C.t4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{names[activeSym] || fundamentals[activeSym]?.companyName || ""}</div>
                      </div>
                      {livePrice && <div style={{ marginLeft: "auto", textAlign: "right" }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: C.t1 }}>${livePrice.toFixed(2)}</div>
                        {dayChg != null && <div style={{ fontSize: 13, fontWeight: 700, color: dayChg >= 0 ? C.up : C.dn }}>{dayChg >= 0 ? "+" : ""}{dayChg.toFixed(2)}%</div>}
                      </div>}
                    </div>
                    <iframe
                      key={activeSym}
                      src={chartUrl}
                      style={{ flex: 1, width: "100%", border: "none", display: "block" }}
                      title={`${activeSym} Chart`}
                      sandbox="allow-scripts allow-same-origin allow-popups"
                    />
                  </div>
                  <div style={{ width: 260, borderLeft: `1px solid ${C.border}`, background: C.surface, flexShrink: 0, display: "flex", flexDirection: "column" }}>
                    <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, fontSize: 14, fontWeight: 700, color: C.t1, flexShrink: 0 }}>Watchlist</div>
                    <div style={{ flex: 1, overflowY: "auto" }}>
                      {renderSidebar(false)}
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {/* ━━━ PLAYBOOK ━━━ */}
        {tab === "playbook" && (() => {
          const SPY_TROUGH = { date: "2022-10-12", level: 357.70 };
          const spyQ = bmQuotes.SPY || quotesRef.current?.SPY;
          const spyBar = bmBars.SPY || barsRef.current?.SPY || {};
          const spyPrice = spyQ?.p || 0;
          const spyPc = spyBar?.pc || 0;
          const spyDailyHigh = spyBar?.h || 0;
          const spyDayChg = spyPc > 0 ? ((spyPrice - spyPc) / spyPc) * 100 : 0;
          const storedATH = (() => { try { return parseFloat(localStorage.getItem("iown_spy_ath")) || 0; } catch { return 0; } })();
          const seedATH = 749.53;
          const bestPrice = Math.max(spyPrice, spyDailyHigh);
          const liveATH = Math.max(bestPrice, storedATH, seedATH);
          if (bestPrice > 0 && bestPrice >= liveATH) { try { localStorage.setItem("iown_spy_ath", String(bestPrice)); } catch {} }
          const pctFromTrough = spyPrice > 0 ? ((spyPrice / SPY_TROUGH.level) - 1) * 100 : 0;
          const pctFromATH = spyPrice > 0 ? ((spyPrice / liveATH) - 1) * 100 : 0;
          const drawdown = Math.min(pctFromATH, 0);
          const isBear = drawdown <= -20;
          const regime = isBear ? "BEAR" : "BULL";
          const regimeColor = isBear ? C.dn : C.up;

          const BEAR_MARKETS = [
            { name: "1929 Crash", peakDate: "1929-09", troughDate: "1929-11", drawdown: -44.7, durationMo: 2.2, recoveryMo: 5.0 },
            { name: "Great Depression", peakDate: "1930-04", troughDate: "1932-06", drawdown: -83.0, durationMo: 25.7, recoveryMo: 267.0 },
            { name: "1932-33 Decline", peakDate: "1932-09", troughDate: "1933-02", drawdown: -40.6, durationMo: 5.7, recoveryMo: 1.8 },
            { name: "1933 Decline", peakDate: "1933-07", troughDate: "1933-10", drawdown: -29.8, durationMo: 3.1, recoveryMo: 17.2 },
            { name: "1934-35 Decline", peakDate: "1934-02", troughDate: "1935-03", drawdown: -31.8, durationMo: 13.2, recoveryMo: 12.8 },
            { name: "1937-38 Recession", peakDate: "1937-03", troughDate: "1938-03", drawdown: -54.5, durationMo: 12.8, recoveryMo: 95.6 },
            { name: "1938-39 War Fears", peakDate: "1938-11", troughDate: "1939-04", drawdown: -26.2, durationMo: 4.9, recoveryMo: 6.9 },
            { name: "1939-40 Fall of France", peakDate: "1939-10", troughDate: "1940-06", drawdown: -31.9, durationMo: 7.5, recoveryMo: 13.2 },
            { name: "WWII / Pearl Harbor", peakDate: "1940-11", troughDate: "1942-04", drawdown: -34.5, durationMo: 17.6, recoveryMo: 25.2 },
            { name: "Post-WWII Crash", peakDate: "1946-05", troughDate: "1947-05", drawdown: -28.8, durationMo: 11.6, recoveryMo: 39.5 },
            { name: "1948-49 Recession", peakDate: "1948-06", troughDate: "1949-06", drawdown: -20.6, durationMo: 11.9, recoveryMo: 12.0 },
            { name: "Eisenhower Recession", peakDate: "1956-08", troughDate: "1957-10", drawdown: -21.6, durationMo: 14.7, recoveryMo: 11.0 },
            { name: "Kennedy Slide", peakDate: "1961-12", troughDate: "1962-06", drawdown: -28.0, durationMo: 6.5, recoveryMo: 14.3 },
            { name: "Credit Crunch", peakDate: "1966-02", troughDate: "1966-10", drawdown: -22.2, durationMo: 7.9, recoveryMo: 6.9 },
            { name: "Vietnam / Recession", peakDate: "1968-11", troughDate: "1970-05", drawdown: -36.1, durationMo: 17.9, recoveryMo: 21.4 },
            { name: "OPEC Oil Embargo", peakDate: "1973-01", troughDate: "1974-10", drawdown: -48.2, durationMo: 20.7, recoveryMo: 69.5 },
            { name: "Volcker Tightening", peakDate: "1980-11", troughDate: "1982-08", drawdown: -27.1, durationMo: 20.5, recoveryMo: 2.8 },
            { name: "Black Monday", peakDate: "1987-08", troughDate: "1987-12", drawdown: -33.5, durationMo: 3.3, recoveryMo: 19.7 },
            { name: "Gulf War", peakDate: "1990-07", troughDate: "1990-10", drawdown: -19.9, durationMo: 2.9, recoveryMo: 4.4, nearBear: true, intradayDraw: -20.3, note: "Crossed -20% intraday; -19.9% closing" },
            { name: "LTCM / Russia Crisis", peakDate: "1998-07", troughDate: "1998-08", drawdown: -19.3, durationMo: 1.5, recoveryMo: 2.9, nearBear: true, intradayDraw: -19.5, note: "45-day plunge; peak 1186.75, trough 957.28" },
            { name: "Dot-Com Bust", peakDate: "2000-03", troughDate: "2002-10", drawdown: -49.1, durationMo: 30.5, recoveryMo: 55.6 },
            { name: "Global Financial Crisis", peakDate: "2007-10", troughDate: "2009-03", drawdown: -56.8, durationMo: 17.0, recoveryMo: 48.8 },
            { name: "Euro Debt / Downgrade", peakDate: "2011-04", troughDate: "2011-10", drawdown: -19.4, durationMo: 5.2, recoveryMo: 5.7, nearBear: true, intradayDraw: -21.6, note: "Intraday low 1074.77 = -21.6%; closing -19.4%" },
            { name: "Fed Tightening / Trade War", peakDate: "2018-09", troughDate: "2018-12", drawdown: -19.8, durationMo: 3.1, recoveryMo: 3.9, nearBear: true, intradayDraw: -20.2, note: "Breached -20% intraday on Christmas Eve" },
            { name: "COVID-19 Crash", peakDate: "2020-02", troughDate: "2020-03", drawdown: -33.9, durationMo: 1.1, recoveryMo: 4.9 },
            { name: "Inflation / Rate Hikes", peakDate: "2022-01", troughDate: "2022-10", drawdown: -25.4, durationMo: 9.3, recoveryMo: 15.3 },
            { name: "Tariff Crash", peakDate: "2025-02", troughDate: "2025-04", drawdown: -17.6, durationMo: 1.6, recoveryMo: 2.8, nearBear: true, intradayDraw: -21.3, note: "Intraday low 4835 = -21.3%; closing low 5074 = -17.6%" },
          ];
          const BULL_MARKETS = [
            { period: "1929-1930", gain: 46.8, durationMo: 5.0 },
            { period: "1932-1932", gain: 111.6, durationMo: 3.0 },
            { period: "1933-1933", gain: 120.6, durationMo: 5.0 },
            { period: "1933-1934", gain: 37.9, durationMo: 4.0 },
            { period: "1935-1937", gain: 131.8, durationMo: 24.0 },
            { period: "1938-1938", gain: 62.2, durationMo: 8.0 },
            { period: "1939-1939", gain: 29.8, durationMo: 6.0 },
            { period: "1940-1940", gain: 26.8, durationMo: 5.0 },
            { period: "1942-1946", gain: 157.7, durationMo: 49.0 },
            { period: "1947-1948", gain: 20.8, durationMo: 13.0 },
            { period: "1949-1956", gain: 267.0, durationMo: 86.0 },
            { period: "1957-1961", gain: 86.3, durationMo: 49.7 },
            { period: "1962-1966", gain: 79.8, durationMo: 43.5 },
            { period: "1966-1968", gain: 48.0, durationMo: 25.7 },
            { period: "1970-1973", gain: 73.5, durationMo: 31.5 },
            { period: "1974-1980", gain: 125.6, durationMo: 73.9 },
            { period: "1982-1987", gain: 228.8, durationMo: 60.4 },
            { period: "1987-2000", gain: 582.0, durationMo: 147.6 },
            { period: "2002-2007", gain: 101.5, durationMo: 60.0 },
            { period: "2009-2020", gain: 400.5, durationMo: 131.4 },
            { period: "2020-2022", gain: 114.4, durationMo: 21.3 },
            { period: "2022-present", gain: Math.round(pctFromTrough * 10) / 10, durationMo: Math.round(((Date.now() - new Date("2022-10-12")) / (30.44 * 86400000)) * 10) / 10 },
          ];
          const avgBullGain = 135.9;
          const medBullGain = 101.5;
          const officialBears = BEAR_MARKETS.filter(b => !b.nearBear);
          const avgBearDraw = Math.round(officialBears.reduce((s, b) => s + b.drawdown, 0) / officialBears.length * 10) / 10;
          const avgBearDur = Math.round(officialBears.reduce((s, b) => s + b.durationMo, 0) / officialBears.length * 10) / 10;
          const avgRecovery = Math.round(officialBears.reduce((s, b) => s + b.recoveryMo, 0) / officialBears.length * 10) / 10;
          const medRecovery = 15.3;
          const allDeclines = BEAR_MARKETS;
          const avgAllDraw = Math.round(allDeclines.reduce((s, b) => s + b.drawdown, 0) / allDeclines.length * 10) / 10;
          const avgAllDur = Math.round(allDeclines.reduce((s, b) => s + b.durationMo, 0) / allDeclines.length * 10) / 10;
          const avgAllRecovery = Math.round(allDeclines.reduce((s, b) => s + b.recoveryMo, 0) / allDeclines.length * 10) / 10;

          const TRIM_TIERS = [
            { pctAboveTrough: 75, trimPct: 2, note: "Scout tier — minimal drag, catches short bulls" },
            { pctAboveTrough: 150, trimPct: 5, note: "Bull has 2.5x'd — begin building position" },
            { pctAboveTrough: 250, trimPct: 8, note: "Bull has 3.5x'd — moderate cash" },
            { pctAboveTrough: 350, trimPct: 11, note: "Bull has 4.5x'd — elevated cycle risk" },
            { pctAboveTrough: 500, trimPct: 14, note: "Bull has 6x'd — max cash, rare territory" },
          ];
          const currentTrimTier = TRIM_TIERS.filter(t => pctFromTrough >= t.pctAboveTrough).pop();

          const BEAR_TRANCHES = [
            { drawdownTrigger: -25, pctReserves: 25, action: "Deploy 25% of reserves", deploy: "87% of bears reach — first tranche, patient entry" },
            { drawdownTrigger: -35, pctReserves: 40, action: "Deploy 40% of reserves", deploy: "47% of bears reach — deep value territory" },
            { drawdownTrigger: -50, pctReserves: 100, action: "Deploy all remaining reserves", deploy: "23% of bears reach — generational buying opportunity" },
          ];

          const peakToRecovery = officialBears.map(b => b.durationMo + b.recoveryMo);
          const avgP2R = peakToRecovery.reduce((a, b) => a + b, 0) / peakToRecovery.length;
          const medP2R = [...peakToRecovery].sort((a, b) => a - b)[Math.floor(peakToRecovery.length / 2)];
          const maxP2R = Math.max(...peakToRecovery);
          const bondYearsNeeded = Math.ceil(avgP2R / 12);
          const bondYearsWorstCase = Math.ceil(maxP2R / 12);

          const cardStyle = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "20px 18px", marginBottom: 14 };
          const sectionTitle = (t) => <div style={{ fontSize: 15, fontWeight: 800, color: C.t1, marginBottom: 14 }}>{t}</div>;
          const statBox = (label, val, color) => (
            <div style={{ background: C.bg, borderRadius: 10, padding: "12px 14px", textAlign: "center" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.t4, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: color || C.t1, fontVariantNumeric: "tabular-nums" }}>{val}</div>
            </div>
          );

          return (
            <div style={{ animation: "fadeIn 0.3s ease", paddingTop: 20 }}>
              {!isDesktop && <div style={{ fontSize: 24, fontWeight: 800, color: C.t1, marginBottom: 16 }}>Playbook</div>}

              {/* Sub-nav */}
              <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
                {[{ v: "regime", l: "Live Regime" }, { v: "bull", l: "Bull Playbook" }, { v: "bear", l: "Bear Playbook" }, { v: "simulator", l: "Simulator" }, { v: "probability", l: "Probability" }, { v: "scripts", l: "Scripts" }, { v: "history", l: "History" }, { v: "bonds", l: "Bond Ladder" }, { v: "proof", l: "Why It Works" }].map(({ v, l }) => (
                  <button key={v} onClick={() => setPbView(v)} style={{
                    flex: "0 0 auto", padding: "9px 16px", borderRadius: 10, border: `1px solid ${pbView === v ? C.borderActive : C.border}`,
                    background: pbView === v ? C.accentSoft : "transparent",
                    color: pbView === v ? C.t1 : C.t3, fontSize: 13, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                  }}>{l}</button>
                ))}
              </div>

              {/* ── LIVE REGIME TRACKER ── */}
              {pbView === "regime" && (
                <div>
                  {/* Gauge */}
                  <div style={{ ...cardStyle, textAlign: "center", paddingTop: 28, paddingBottom: 20 }}>
                    {(() => {
                      const W = isDesktop ? 420 : Math.min(window.innerWidth - 72, 360);
                      const H = W * 0.66;
                      const cx = W / 2, cy = H * 0.82;
                      const R = W * 0.4;
                      const startAngle = Math.PI * 1.15;
                      const endAngle = Math.PI * -0.15;
                      const totalArc = startAngle - endAngle;
                      const maxGain = avgBullGain * 1.8;
                      const clampedPct = Math.max(0, Math.min(pctFromTrough, maxGain));
                      const needleAngle = startAngle - (clampedPct / maxGain) * totalArc;
                      const bearZoneStart = 0;
                      const bearZoneEnd = 0;
                      const segments = 60;

                      const arcPath = (r, a1, a2) => {
                        const x1 = cx + r * Math.cos(a1), y1 = cy - r * Math.sin(a1);
                        const x2 = cx + r * Math.cos(a2), y2 = cy - r * Math.sin(a2);
                        const large = (a1 - a2) > Math.PI ? 1 : 0;
                        return `M${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2}`;
                      };

                      const tickMarks = [0, 50, 100, 150, 200, 250, 300, 350, maxGain];
                      const medianAngle = startAngle - (medBullGain / maxGain) * totalArc;
                      const avgAngle = startAngle - (avgBullGain / maxGain) * totalArc;
                      const needleOuter = R - 10;
                      const needleInner = R * 0.62;
                      const nx = cx + needleOuter * Math.cos(needleAngle);
                      const ny = cy - needleOuter * Math.sin(needleAngle);
                      const nsx = cx + needleInner * Math.cos(needleAngle);
                      const nsy = cy - needleInner * Math.sin(needleAngle);
                      const bullDurMo = Math.round((Date.now() - new Date("2022-10-12")) / (30.44 * 86400000));

                      return (
                        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", margin: "0 auto" }}>
                          {/* Gauge arc segments */}
                          {Array.from({ length: segments }).map((_, i) => {
                            const a1 = startAngle - (i / segments) * totalArc;
                            const a2 = startAngle - ((i + 1) / segments) * totalArc;
                            const pctPos = i / segments;
                            const r = pctPos < 0.3 ? 40 : pctPos < 0.5 ? Math.round(40 + (pctPos - 0.3) * 500) : pctPos < 0.7 ? Math.round(140 + (pctPos - 0.5) * 300) : Math.min(255, Math.round(200 + (pctPos - 0.7) * 183));
                            const g = pctPos < 0.3 ? Math.round(180 + pctPos * 200) : pctPos < 0.6 ? Math.round(240 - (pctPos - 0.3) * 400) : Math.round(100 - (pctPos - 0.6) * 200);
                            const b = 40;
                            const filled = i / segments <= clampedPct / maxGain;
                            return <path key={i} d={arcPath(R, a1, a2)} fill="none" stroke={filled ? `rgb(${r},${g},${b})` : (theme !== "light" ? "#1E2536" : "#E5E7EB")} strokeWidth={14} strokeLinecap="butt" />;
                          })}

                          {/* Tick marks */}
                          {tickMarks.filter(v => v <= maxGain).map((v, i) => {
                            const a = startAngle - (v / maxGain) * totalArc;
                            const ox = cx + (R + 14) * Math.cos(a), oy = cy - (R + 14) * Math.sin(a);
                            const ix = cx + (R + 8) * Math.cos(a), iy = cy - (R + 8) * Math.sin(a);
                            return <g key={i}>
                              <line x1={ix} y1={iy} x2={ox} y2={oy} stroke={C.t4} strokeWidth={1.5} />
                              {v > 0 && v < maxGain && <text x={cx + (R + 24) * Math.cos(a)} y={cy - (R + 24) * Math.sin(a)} fill={C.t4} fontSize={9} fontWeight={600} textAnchor="middle" dominantBaseline="middle">+{v}%</text>}
                            </g>;
                          })}

                          {/* Median marker */}
                          <line x1={cx + (R - 10) * Math.cos(medianAngle)} y1={cy - (R - 10) * Math.sin(medianAngle)} x2={cx + (R + 10) * Math.cos(medianAngle)} y2={cy - (R + 10) * Math.sin(medianAngle)} stroke={C.accent} strokeWidth={2.5} strokeLinecap="round" />
                          <text x={cx + (R + 34) * Math.cos(medianAngle)} y={cy - (R + 34) * Math.sin(medianAngle)} fill={C.accent} fontSize={8} fontWeight={700} textAnchor="middle">MEDIAN</text>

                          {/* Average marker */}
                          <line x1={cx + (R - 10) * Math.cos(avgAngle)} y1={cy - (R - 10) * Math.sin(avgAngle)} x2={cx + (R + 10) * Math.cos(avgAngle)} y2={cy - (R + 10) * Math.sin(avgAngle)} stroke="#FBBF24" strokeWidth={2.5} strokeLinecap="round" />
                          <text x={cx + (R + 34) * Math.cos(avgAngle)} y={cy - (R + 34) * Math.sin(avgAngle)} fill="#FBBF24" fontSize={8} fontWeight={700} textAnchor="middle">AVG</text>

                          {/* Needle */}
                          <line x1={nsx} y1={nsy} x2={nx} y2={ny} stroke={regimeColor} strokeWidth={3} strokeLinecap="round" />
                          <circle cx={nsx} cy={nsy} r={5} fill={regimeColor} />

                          {/* Needle glow */}
                          <circle cx={nx} cy={ny} r={4} fill={regimeColor} opacity={0.6}>
                            <animate attributeName="r" values="3;6;3" dur="2s" repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0.6;0.2;0.6" dur="2s" repeatCount="indefinite" />
                          </circle>

                          {/* Center text */}
                          <text x={cx} y={cy - 42} fill={regimeColor} fontSize={28} fontWeight={900} textAnchor="middle" letterSpacing="4">{regime}</text>
                          <text x={cx} y={cy - 22} fill={C.t3} fontSize={12} fontWeight={600} textAnchor="middle">SPY ${spyPrice.toFixed(2)}</text>
                          <text x={cx} y={cy - 6} fill={spyDayChg >= 0 ? C.up : C.dn} fontSize={11} fontWeight={700} textAnchor="middle">{spyDayChg >= 0 ? "+" : ""}{spyDayChg.toFixed(2)}% today</text>

                          {/* Bottom labels */}
                          <text x={cx - R * 0.7} y={cy + 20} fill={C.t4} fontSize={9} fontWeight={600} textAnchor="middle">TROUGH</text>
                          <text x={cx + R * 0.7} y={cy + 20} fill={C.t4} fontSize={9} fontWeight={600} textAnchor="middle">EXTENDED</text>
                        </svg>
                      );
                    })()}

                    {/* Stats below gauge */}
                    <div style={{ display: "flex", justifyContent: "center", gap: isDesktop ? 40 : 20, marginTop: 8 }}>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: C.t4, textTransform: "uppercase", letterSpacing: 0.5 }}>From Trough</div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: pctFromTrough >= 0 ? C.up : C.dn, fontVariantNumeric: "tabular-nums" }}>{pctFromTrough >= 0 ? "+" : ""}{pctFromTrough.toFixed(1)}%</div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: C.t4, textTransform: "uppercase", letterSpacing: 0.5 }}>From ATH</div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: pctFromATH >= 0 ? C.up : C.dn, fontVariantNumeric: "tabular-nums" }}>{pctFromATH >= 0 ? "+" : ""}{pctFromATH.toFixed(1)}%</div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: C.t4, textTransform: "uppercase", letterSpacing: 0.5 }}>Duration</div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: C.t1, fontVariantNumeric: "tabular-nums" }}>{Math.round((Date.now() - new Date("2022-10-12")) / (30.44 * 86400000))} mo</div>
                      </div>
                    </div>
                  </div>

                  {/* Current trim status */}
                  {(() => {
                    const bullAgeMo = Math.round((Date.now() - new Date("2022-10-12")) / (30.44 * 86400000));
                    const ageGateMet = bullAgeMo >= 21;
                    const activeTier = ageGateMet ? currentTrimTier : null;
                    return (
                      <div style={{ ...cardStyle, border: `1px solid ${activeTier ? C.accent + "44" : C.border}` }}>
                        {sectionTitle("Active Trim Level")}
                        {activeTier ? (
                          <>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div>
                                <div style={{ fontSize: 13, color: C.t3 }}>At +{pctFromTrough.toFixed(0)}% from trough, {bullAgeMo} months old</div>
                                <div style={{ fontSize: 11, color: C.t4, marginTop: 2 }}>Models A, C, D</div>
                              </div>
                              <div style={{ fontSize: 28, fontWeight: 900, color: C.accent }}>{activeTier.trimPct}%</div>
                            </div>
                            <div style={{ fontSize: 11, color: C.t4, marginTop: 8 }}>of total portfolio balance should be in cash</div>
                          </>
                        ) : (
                          <div>
                            <div style={{ fontSize: 13, color: C.t3 }}>Age gate not met — bull is {bullAgeMo} months old</div>
                            <div style={{ fontSize: 11, color: C.t4, marginTop: 4 }}>Trimming begins at 21 months. {21 - bullAgeMo > 0 ? `${21 - bullAgeMo} months remaining.` : ""} No cash drag until then.</div>
                            <div style={{ fontSize: 22, fontWeight: 900, color: C.t4, marginTop: 8 }}>0%</div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Bear market distance */}
                  <div style={cardStyle}>
                    {sectionTitle("Distance to Bear Market")}
                    <div style={{ fontSize: 12, color: C.t3, marginBottom: 10 }}>A bear market is declared at -20% from SPY's all-time high (${liveATH.toFixed(2)}).</div>
                    {(() => {
                      const bearLevel = liveATH * 0.8;
                      const fromATH = pctFromATH;
                      const cushion = 20 - Math.abs(Math.min(fromATH, 0));
                      const inBear = fromATH <= -20;
                      return (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                          {statBox("From ATH", `${fromATH >= 0 ? "+" : ""}${fromATH.toFixed(1)}%`, fromATH >= 0 ? C.up : C.dn)}
                          {statBox("Bear at", `$${bearLevel.toFixed(2)}`, C.dn)}
                          {inBear
                            ? statBox("Status", "BEAR", C.dn)
                            : statBox("Cushion", `${cushion.toFixed(1)}%`, cushion > 15 ? C.up : cushion > 8 ? "#FBBF24" : C.dn)}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* ── BULL MARKET TRIM RULES ── */}
              {pbView === "bull" && (
                <div>
                  <div style={cardStyle}>
                    {sectionTitle("Bull Market Cash Trim Rules")}
                    <div style={{ fontSize: 12, color: C.t3, marginBottom: 14 }}>Applies to Models A, C, D. 21-month age gate with 18-month time decay. Optimized across 110,000+ configurations and 21 historical cycles (1929-2024). Produces <strong style={{ color: C.up }}>+13.9 bps/yr alpha</strong> with 100% non-loss rate (21/21 cycles).</div>
                    <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${C.border}` }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: C.bg }}>
                            <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, color: C.t4, textTransform: "uppercase" }}>S&P From Trough</th>
                            <th style={{ padding: "10px 12px", textAlign: "center", fontSize: 10, fontWeight: 700, color: C.t4, textTransform: "uppercase" }}>Cash Target</th>
                            <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, color: C.t4, textTransform: "uppercase" }}>Context</th>
                            <th style={{ padding: "10px 12px", textAlign: "center", fontSize: 10, fontWeight: 700, color: C.t4, textTransform: "uppercase" }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const bullAgeMo = Math.round((Date.now() - new Date("2022-10-12")) / (30.44 * 86400000));
                            const ageGateMet = bullAgeMo >= 21;
                            return TRIM_TIERS.map((t, i) => {
                              const levelMet = pctFromTrough >= t.pctAboveTrough;
                              const active = levelMet && ageGateMet;
                              const isCurrent = active && currentTrimTier === t && ageGateMet;
                              return (
                                <tr key={i} style={{ borderTop: `1px solid ${C.border}`, background: isCurrent ? C.accentSoft : "transparent" }}>
                                  <td style={{ padding: "10px 12px", fontWeight: 700, color: isCurrent ? C.t1 : C.t2 }}>+{t.pctAboveTrough}%</td>
                                  <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 800, color: isCurrent ? C.accent : C.t2 }}>{t.trimPct}%</td>
                                  <td style={{ padding: "10px 12px", color: C.t3 }}>{t.note}</td>
                                  <td style={{ padding: "10px 12px", textAlign: "center" }}>
                                    {active ? <span style={{ color: C.up, fontWeight: 700 }}>Active</span> : levelMet && !ageGateMet ? <span style={{ color: "#FBBF24", fontWeight: 600 }}>Age Gate</span> : <span style={{ color: C.t4 }}>Pending</span>}
                                  </td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div style={cardStyle}>
                    {sectionTitle("How It Works")}
                    <div style={{ fontSize: 12, color: C.t3, lineHeight: 1.7 }}>
                      <p style={{ marginBottom: 10 }}><strong style={{ color: C.accent }}>Age Gate (21 months):</strong> No trimming until the bull market is at least 21 months old. The 1% scout tier at +75% activates early with minimal drag, while larger tiers require both age and gain thresholds.</p>
                      <p style={{ marginBottom: 10 }}><strong style={{ color: C.accent }}>Cumulative Targets:</strong> Tiers are cumulative, not incremental. At +250% from trough, hold 5% total in cash — not 5% on top of prior tiers.</p>
                      <p style={{ marginBottom: 10 }}><strong style={{ color: C.accent }}>18-Month Time Decay:</strong> If no bear market begins within 18 months of the last trim, all cash is redeployed to equity. Triggers reset and can fire again at higher levels. More frequent recycling generates more trimming opportunities in mega-bulls.</p>
                      <p><strong style={{ color: C.accent }}>Backtested Result:</strong> +13.9 bps/yr alpha vs buy-and-hold across 21 historical cycles (1929-2024). <strong style={{ color: C.up }}>100% non-loss rate (21/21)</strong>. +12.9% excess terminal wealth over 93 years.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* ── BEAR MARKET BOND PLAYBOOK ── */}
              {pbView === "bear" && (
                <div>
                  <div style={cardStyle}>
                    {sectionTitle("Bear Market Deployment Tranches")}
                    <div style={{ fontSize: 12, color: C.t3, marginBottom: 14 }}>Three-tranche system: deploy 25% at -25%, 40% at -35%, all remaining at -50%. Deeper third tranche captures generational buying opportunities in severe bears. Optimized across 22 bear markets (1929-2024).</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {BEAR_TRANCHES.map((t, i) => {
                        const triggered = drawdown <= t.drawdownTrigger;
                        return (
                          <div key={i} style={{ background: triggered ? (C.dn + "18") : C.bg, border: `1px solid ${triggered ? C.dn + "44" : C.border}`, borderRadius: 12, padding: 16 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                              <span style={{ fontSize: 22, fontWeight: 900, color: triggered ? C.dn : C.t2 }}>{t.drawdownTrigger}%</span>
                              <span style={{ fontSize: 11, fontWeight: 700, color: triggered ? C.dn : C.t4, padding: "4px 10px", borderRadius: 6, background: triggered ? C.dn + "20" : C.card }}>{triggered ? "TRIGGERED" : "STANDBY"}</span>
                            </div>
                            <div style={{ fontSize: 12, color: C.t3 }}>{t.action}</div>
                            <div style={{ fontSize: 11, color: C.accent, marginTop: 2 }}>{t.deploy}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div style={cardStyle}>
                    {sectionTitle("5-Year Bond Ladder Structure")}
                    <div style={{ fontSize: 12, color: C.t3, lineHeight: 1.7 }}>
                      <p style={{ marginBottom: 10 }}>Clients with bonds hold <strong style={{ color: C.t1 }}>5 years of living expenses</strong> across a bond ladder (Years 1-5). Year 1 matures each year to fund living expenses, and the ladder rolls forward.</p>
                      <p style={{ marginBottom: 10 }}>In a bear market, <strong style={{ color: C.t1 }}>only Year-5 bonds</strong> are touched — the furthest from maturity. Deploy across three tranches: 25% at -25%, 40% at -35%, all remaining at -50%. The deepest tranche captures generational buying opportunities where recovery returns are highest.</p>
                      <p style={{ marginBottom: 10 }}>When the market recovers to the prior peak, rebuild the Year-5 position from equity gains.</p>
                      <p>For <strong style={{ color: C.t1 }}>non-bond clients</strong> (Models A, C, D): the cash reserves built during the bull market via trim rules serve the same purpose — dry powder for deployment at each bear tranche.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* ── SCENARIO SIMULATOR ── */}
              {pbView === "simulator" && (() => {
                const historicalBears = BEAR_MARKETS.filter(b => !b.nearBear && Math.abs(b.drawdown) >= 20);
                const bullBeforeBear = { "1929 Crash": 300, "Great Depression": 46.8, "1932-33 Decline": 111.6, "1933 Decline": 120.6, "1934-35 Decline": 37.9, "1937-38 Recession": 131.8, "1938-39 War Fears": 62.2, "1939-40 Fall of France": 29.8, "WWII / Pearl Harbor": 26.8, "Post-WWII Crash": 157.7, "1948-49 Recession": 20.8, "Eisenhower Recession": 267, "Kennedy Slide": 86.3, "Credit Crunch": 79.8, "Vietnam / Recession": 48, "OPEC Oil Embargo": 73.5, "Volcker Tightening": 125.6, "Black Monday": 228.8, "Dot-Com Bust": 582, "Global Financial Crisis": 101.5, "COVID-19 Crash": 400.5, "Inflation / Rate Hikes": 114.4 };
                const selectedBear = historicalBears.find(b => b.name === pbSimHistBear);
                const portfolioVal = pbSimValue;
                const dropPct = selectedBear ? Math.abs(selectedBear.drawdown) : pbSimDrop;
                const currentCashPct = (() => {
                  if (selectedBear) {
                    const bullGain = bullBeforeBear[selectedBear.name] || 100;
                    const tier = TRIM_TIERS.filter(t => bullGain >= t.pctAboveTrough).pop();
                    return tier ? tier.trimPct : 0;
                  }
                  const bullAgeMo = Math.round((Date.now() - new Date("2022-10-12")) / (30.44 * 86400000));
                  if (bullAgeMo < 21) return 0;
                  const tier = TRIM_TIERS.filter(t => pctFromTrough >= t.pctAboveTrough).pop();
                  return tier ? tier.trimPct : 0;
                })();
                const cashReserves = portfolioVal * (currentCashPct / 100);
                const equityVal = portfolioVal - cashReserves;
                const trancheResults = [];
                let remainingCash = cashReserves;
                let totalDeployed = 0;
                let deployedAtLevels = [];
                for (const t of BEAR_TRANCHES) {
                  if (dropPct >= Math.abs(t.drawdownTrigger)) {
                    const deployAmt = cashReserves * (t.pctReserves / 100);
                    const actualDeploy = Math.min(deployAmt, remainingCash);
                    remainingCash -= actualDeploy;
                    totalDeployed += actualDeploy;
                    deployedAtLevels.push({ level: t.drawdownTrigger, amount: actualDeploy });
                    trancheResults.push({ ...t, deployed: actualDeploy, triggered: true });
                  } else {
                    trancheResults.push({ ...t, deployed: 0, triggered: false });
                  }
                }
                const equityAfterDrop = equityVal * (1 - dropPct / 100);
                const portfolioAtBottom = equityAfterDrop + remainingCash + totalDeployed * (1 - dropPct / 100) * (1 / (1 - Math.abs(deployedAtLevels[0]?.level || dropPct) / 100));
                const portfolioAtBottomSimple = equityAfterDrop + remainingCash;
                const bhAtBottom = portfolioVal * (1 - dropPct / 100);
                const saved = portfolioAtBottomSimple - bhAtBottom;
                const recoveryGain = dropPct / (100 - dropPct) * 100;
                const portfolioAtRecovery = equityVal + cashReserves;
                let deploymentAlpha = 0;
                for (const d of deployedAtLevels) {
                  const buyDiscount = Math.abs(d.level);
                  const returnToRecovery = buyDiscount / (100 - buyDiscount) * 100;
                  deploymentAlpha += d.amount * (returnToRecovery / 100);
                }
                const portfolioAfterRecovery = portfolioVal + deploymentAlpha;

                return (
                  <div>
                    <div style={cardStyle}>
                      {sectionTitle("Scenario Simulator")}
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.t4, textTransform: "uppercase", marginBottom: 6 }}>Simulate a Historical Bear Market</div>
                      <select value={pbSimHistBear} onChange={e => { setPbSimHistBear(e.target.value); if (e.target.value) { const b = historicalBears.find(x => x.name === e.target.value); if (b) setPbSimDrop(Math.abs(b.drawdown)); } }} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.borderActive}`, background: C.bg, color: C.t1, fontSize: 14, fontWeight: 600, fontFamily: "inherit", marginBottom: 12, appearance: "auto" }}>
                        <option value="">Custom scenario (use slider)</option>
                        {historicalBears.map(b => <option key={b.name} value={b.name}>{b.name} ({b.peakDate}) — {b.drawdown}% in {b.durationMo}mo</option>)}
                      </select>
                      {selectedBear && (
                        <div style={{ background: C.accent + "10", border: `1px solid ${C.accent}20`, borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 12, color: C.t2, lineHeight: 1.6 }}>
                          <strong style={{ color: C.t1 }}>{selectedBear.name}</strong> ({selectedBear.peakDate} → {selectedBear.troughDate}) — S&P fell <strong style={{ color: C.dn }}>{selectedBear.drawdown}%</strong> over {selectedBear.durationMo} months. Recovery took {selectedBear.recoveryMo} months. Preceding bull gained +{bullBeforeBear[selectedBear.name] || "?"}%, so the playbook would have trimmed <strong style={{ color: C.accent }}>{currentCashPct}%</strong> to cash before the crash.
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: C.t4, textTransform: "uppercase", marginBottom: 6 }}>Portfolio Value</div>
                          <input type="text" value={`$${portfolioVal.toLocaleString()}`} onChange={e => { const v = parseInt(e.target.value.replace(/[^0-9]/g, "")); if (v > 0) setPbSimValue(v); }} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.borderActive}`, background: C.bg, color: C.t1, fontSize: 16, fontWeight: 700, fontFamily: "inherit" }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: C.t4, textTransform: "uppercase", marginBottom: 6 }}>Market Drop: -{dropPct}%</div>
                          <input type="range" min={10} max={60} value={dropPct} onChange={e => { setPbSimDrop(Number(e.target.value)); setPbSimHistBear(""); }} style={{ width: "100%", accentColor: C.dn }} />
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.t4 }}><span>-10%</span><span>-20%</span><span>-30%</span><span>-40%</span><span>-50%</span><span>-60%</span></div>
                        </div>
                      </div>
                    </div>

                    {/* Waterfall */}
                    <div style={cardStyle}>
                      {sectionTitle("At The Bottom")}
                      <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(3, 1fr)" : "1fr", gap: 10, marginBottom: 14 }}>
                        <div style={{ background: C.dn + "12", borderRadius: 12, padding: 16, textAlign: "center", border: `1px solid ${C.dn}30` }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: C.t4, textTransform: "uppercase", marginBottom: 4 }}>Buy & Hold Value</div>
                          <div style={{ fontSize: 22, fontWeight: 900, color: C.dn }}>${bhAtBottom.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                          <div style={{ fontSize: 11, color: C.dn }}>-${(portfolioVal - bhAtBottom).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                        </div>
                        <div style={{ background: C.up + "12", borderRadius: 12, padding: 16, textAlign: "center", border: `1px solid ${C.up}30` }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: C.t4, textTransform: "uppercase", marginBottom: 4 }}>Playbook Value</div>
                          <div style={{ fontSize: 22, fontWeight: 900, color: C.t1 }}>${portfolioAtBottomSimple.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                          <div style={{ fontSize: 11, color: C.up }}>+${saved.toLocaleString(undefined, { maximumFractionDigits: 0 })} protected</div>
                        </div>
                        <div style={{ background: C.accent + "12", borderRadius: 12, padding: 16, textAlign: "center", border: `1px solid ${C.accent}30` }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: C.t4, textTransform: "uppercase", marginBottom: 4 }}>Cash Deployed</div>
                          <div style={{ fontSize: 22, fontWeight: 900, color: C.accent }}>${totalDeployed.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                          <div style={{ fontSize: 11, color: C.t3 }}>buying at a discount</div>
                        </div>
                      </div>
                    </div>

                    {/* Tranche walkthrough */}
                    <div style={cardStyle}>
                      {sectionTitle("Tranche Deployment Walkthrough")}
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {trancheResults.map((t, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: t.triggered ? C.up + "10" : C.bg, borderRadius: 12, border: `1px solid ${t.triggered ? C.up + "30" : C.border}` }}>
                            <div style={{ width: 44, height: 44, borderRadius: 12, background: t.triggered ? C.dn + "20" : C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900, color: t.triggered ? C.dn : C.t4, flexShrink: 0 }}>{t.drawdownTrigger}%</div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: t.triggered ? C.t1 : C.t4 }}>{t.action}</div>
                              <div style={{ fontSize: 11, color: C.t4 }}>{t.triggered ? `Deploys $${t.deployed.toLocaleString(undefined, { maximumFractionDigits: 0 })} into equities` : "Not triggered at this drop level"}</div>
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: t.triggered ? C.up : C.t4 }}>{t.triggered ? "FIRED" : "—"}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Recovery */}
                    <div style={cardStyle}>
                      {sectionTitle("After Full Recovery")}
                      <div style={{ fontSize: 12, color: C.t3, marginBottom: 12 }}>When the market returns to its prior peak, the deployed cash has earned the recovery return.</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        {statBox("Buy & Hold", `$${portfolioVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, C.t3)}
                        {statBox("Playbook", `$${portfolioAfterRecovery.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, C.up)}
                        {statBox("Deployment Alpha", `+$${deploymentAlpha.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, C.accent)}
                        {statBox("Recovery Needed", `+${recoveryGain.toFixed(0)}%`, C.t1)}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ── COMPOSITE BEAR PROBABILITY ── */}
              {pbView === "probability" && (() => {
                const bullAgeMo = Math.round((Date.now() - new Date("2022-10-12")) / (30.44 * 86400000));
                const bullsData = BULL_MARKETS.filter(b => !b.period.includes("present"));
                const totalBulls = bullsData.length;
                const atRisk = bullsData.filter(b => b.durationMo > bullAgeMo);
                const survived12 = bullsData.filter(b => b.durationMo > bullAgeMo + 12);
                const durationProb = atRisk.length > 0 ? Math.round((1 - survived12.length / atRisk.length) * 100) : 50;

                const interp = (val, pts) => {
                  if (val <= pts[0][0]) return pts[0][1];
                  if (val >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
                  for (let i = 1; i < pts.length; i++) {
                    if (val <= pts[i][0]) {
                      const t = (val - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]);
                      return Math.round(pts[i - 1][1] + t * (pts[i][1] - pts[i - 1][1]));
                    }
                  }
                  return pts[pts.length - 1][1];
                };

                const factors = [];
                const md = macroData;

                // Factor 1: Yield Curve (10Y-2Y) — strongest single recession predictor
                // Post-inversion premium: recessions start AFTER de-inversion (Bauer & Mertens 2018)
                // 10Y-2Y inverted Jul 2022 — Oct 2024. Premium decays linearly over 24 months post de-inversion.
                if (md.yieldSpread != null) {
                  let score = interp(md.yieldSpread, [[-1.0, 90], [-0.5, 75], [0, 48], [0.25, 38], [0.5, 28], [1.0, 18], [1.5, 10], [2.5, 5]]);
                  const inversionEndDate = new Date("2024-10-01");
                  const monthsSinceDeInversion = Math.max(0, (Date.now() - inversionEndDate) / (30.44 * 86400000));
                  const postInvPremium = monthsSinceDeInversion < 24 && md.yieldSpread > 0 ? Math.round(18 * (1 - monthsSinceDeInversion / 24)) : 0;
                  score = Math.min(95, score + postInvPremium);
                  const piNote = postInvPremium > 0 ? ` +${postInvPremium}pt post-inversion (${Math.round(monthsSinceDeInversion)}mo since de-inversion)` : "";
                  factors.push({ name: "Yield Curve", value: `${md.yieldSpread > 0 ? "+" : ""}${md.yieldSpread.toFixed(2)}%`, detail: `10Y: ${md.yield10Y?.toFixed(2)}% / 2Y: ${md.yield2Y?.toFixed(2)}%${piNote}`, score, weight: 18, color: score > 50 ? C.dn : score > 30 ? "#FBBF24" : C.up, citation: "10Y-2Y (Bauer & Mertens 2018)" });
                }

                // Factor 2: Valuation (P/E) — steepened curve: GFC started at 21x, 2022 bear at 23x
                if (md.spyPE != null) {
                  const score = interp(md.spyPE, [[12, 5], [16, 15], [19, 30], [21, 42], [24, 52], [28, 62], [32, 72], [36, 80], [40, 85]]);
                  factors.push({ name: "Valuation", value: `${md.spyPE.toFixed(1)}x P/E`, detail: "SPY trailing P/E (GFC started at 21x, 2022 bear at 23x)", score, weight: 13, color: score > 50 ? C.dn : score > 30 ? "#FBBF24" : C.up, citation: "Shiller (2000)" });
                }

                // Factor 3: Bull Duration — conditional survival from 21 historical bulls
                {
                  const score = interp(durationProb, [[5, 8], [15, 18], [25, 30], [35, 42], [50, 55], [65, 68], [80, 80]]);
                  factors.push({ name: "Bull Duration", value: `${bullAgeMo} months`, detail: `${atRisk.length} comparable bulls, ${atRisk.length - survived12.length} ended within 12mo`, score, weight: 10, color: score > 50 ? C.dn : score > 30 ? "#FBBF24" : C.up, citation: `n=${totalBulls} (1929-2022)` });
                }

                // Factor 4: Credit Spreads (BAA-10Y) — Gilchrist & Zakrajšek (2012)
                // BAA10Y: Moody's BAA corporate yield minus 10Y Treasury, daily, 1986-present
                // Pre-bear levels: GFC 1.72-1.90%, COVID 2.05%, 2022 bear 1.82%. Median 2.14%.
                // Stress levels: Lehman 3.66%, COVID crash 4.31%, GFC bottom 5.40%
                if (md.baa10y != null) {
                  const score = interp(md.baa10y, [[1.2, 8], [1.5, 15], [1.8, 22], [2.2, 32], [2.8, 48], [3.5, 65], [4.5, 80], [5.5, 90]]);
                  factors.push({ name: "Credit Spreads", value: `${md.baa10y.toFixed(2)}%`, detail: `BAA-10Y spread (median: 2.14%, pre-bears: 1.7-2.1%) — ${md.baa10yDate || ""}`, score, weight: 10, color: score > 50 ? C.dn : score > 30 ? "#FBBF24" : C.up, citation: "FRED BAA10Y (1986-present)" });
                } else if (md.hygPrice != null && md.hyg52High != null && md.hyg52High > 0) {
                  const hygDrawdown = ((md.hygPrice / md.hyg52High) - 1) * 100;
                  const score = interp(hygDrawdown, [[-18, 90], [-12, 75], [-7, 55], [-4, 35], [-2, 20], [0, 8]]);
                  factors.push({ name: "Credit Stress", value: `${hygDrawdown.toFixed(1)}% from high`, detail: `HYG fallback: $${md.hygPrice.toFixed(2)} / 52wk: $${md.hyg52High.toFixed(2)}`, score, weight: 10, color: score > 50 ? C.dn : score > 30 ? "#FBBF24" : C.up, citation: "HYG fallback" });
                }

                // Factor 5: Momentum (SPY vs 200-day SMA) — practical risk indicator
                if (md.spy200 != null && spyPrice > 0) {
                  const pctAbove200 = ((spyPrice / md.spy200) - 1) * 100;
                  const score = interp(pctAbove200, [[-12, 90], [-6, 75], [-2, 55], [0, 40], [3, 25], [6, 15], [12, 5]]);
                  factors.push({ name: "Momentum", value: `${pctAbove200 >= 0 ? "+" : ""}${pctAbove200.toFixed(1)}% vs 200d`, detail: `SPY: $${spyPrice.toFixed(2)} / 200d SMA: $${md.spy200.toFixed(2)}`, score, weight: 10, color: score > 50 ? C.dn : score > 30 ? "#FBBF24" : C.up, citation: `${md.spy200Count || 200}-day SMA` });
                }

                // Factor 6: Volatility (VIX) — reactive, not predictive, but captures regime
                if (md.vix != null) {
                  const score = interp(md.vix, [[10, 5], [14, 12], [18, 25], [22, 40], [28, 58], [35, 72], [45, 85]]);
                  factors.push({ name: "Volatility", value: `VIX ${md.vix.toFixed(1)}`, detail: "CBOE Volatility Index", score, weight: 5, color: score > 50 ? C.dn : score > 30 ? "#FBBF24" : C.up, citation: "CBOE" });
                }

                // Factor 7: Unemployment Claims trend — real-economy leading indicator
                // Rising claims precede every post-war recession by 3-6 months
                if (md.claimsTrend != null) {
                  const score = interp(md.claimsTrend, [[-15, 5], [-5, 12], [0, 22], [5, 38], [10, 55], [20, 72], [35, 85], [50, 92]]);
                  factors.push({ name: "Jobless Claims", value: `${md.claims4wk?.toLocaleString()} (4wk avg)`, detail: `${md.claimsTrend > 0 ? "+" : ""}${md.claimsTrend.toFixed(1)}% vs prior month — ${md.claimsDate}`, score, weight: 12, color: score > 50 ? C.dn : score > 30 ? "#FBBF24" : C.up, citation: "FRED IC4WSA (weekly)" });
                }

                // Factor 8: Chicago Fed National Activity Index — 85-indicator composite
                // Below -0.7 signals recession (3-month avg below -0.7 = 80%+ recession probability)
                if (md.cfnai != null) {
                  const useVal = md.cfnai3mo != null ? md.cfnai3mo : md.cfnai;
                  const score = interp(useVal, [[-1.5, 92], [-0.7, 75], [-0.35, 55], [0, 35], [0.2, 20], [0.5, 10], [1.0, 5]]);
                  factors.push({ name: "Economic Activity", value: `CFNAI ${md.cfnai.toFixed(2)}`, detail: `${md.cfnai3mo != null ? `3-month avg: ${md.cfnai3mo.toFixed(2)} — ` : ""}${md.cfnaiDate}`, score, weight: 8, color: score > 50 ? C.dn : score > 30 ? "#FBBF24" : C.up, citation: "Chicago Fed (85 indicators)" });
                }

                // Factor 9: Sahm Rule — 3-month unemployment avg vs 12-month low
                // Triggers at 0.5pp rise — has signaled every recession since 1950
                if (md.sahmVal != null) {
                  const score = interp(md.sahmVal, [[0, 5], [0.15, 15], [0.3, 35], [0.4, 55], [0.5, 75], [0.7, 88], [1.0, 95]]);
                  factors.push({ name: "Sahm Rule", value: `${md.sahmVal.toFixed(2)}pp`, detail: `Unemployment: ${md.unrate?.toFixed(1)}% — triggers at 0.50pp — ${md.unrateDate}`, score, weight: 7, color: score > 50 ? C.dn : score > 30 ? "#FBBF24" : C.up, citation: "Sahm (2019), FRED UNRATE" });
                }

                // Composite: weighted average + concordance bonus
                const totalWeight = factors.reduce((a, f) => a + f.weight, 0);
                const baseComposite = totalWeight > 0 ? factors.reduce((a, f) => a + f.score * (f.weight / totalWeight), 0) : null;
                const elevatedCount = factors.filter(f => f.score >= 50).length;
                const concordanceBonus = elevatedCount >= 5 ? 15 : elevatedCount >= 4 ? 10 : elevatedCount >= 3 ? 5 : 0;
                const composite = baseComposite != null ? Math.min(95, Math.max(5, Math.round(baseComposite + concordanceBonus))) : null;
                const compositeColor = composite > 60 ? C.dn : composite > 40 ? "#FBBF24" : composite > 25 ? C.up : C.up;
                const riskLabel = composite > 70 ? "VERY HIGH" : composite > 55 ? "HIGH" : composite > 40 ? "ELEVATED" : composite > 25 ? "MODERATE" : "LOW";

                const W = isDesktop ? 700 : Math.min(window.innerWidth - 72, 500);
                const H = 200;
                const PAD = { top: 20, right: 20, bottom: 30, left: 40 };
                const survivalCurve = [];
                for (let m = 0; m <= 180; m += 3) { survivalCurve.push({ month: m, pct: Math.round(bullsData.filter(b => b.durationMo > m).length / totalBulls * 100) }); }

                return (
                  <div>
                    {/* Composite headline */}
                    <div style={{ ...cardStyle, textAlign: "center", border: `1px solid ${compositeColor}30` }}>
                      {sectionTitle("Bear Probability — 12 Month Outlook")}
                      {composite != null ? (<>
                        <div style={{ fontSize: 56, fontWeight: 900, color: compositeColor, lineHeight: 1 }}>{composite}%</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: compositeColor, marginTop: 6, letterSpacing: 2 }}>{riskLabel}</div>
                        <div style={{ fontSize: 11, color: C.t4, marginTop: 8 }}>{factors.length}-factor composite{concordanceBonus > 0 ? ` + ${concordanceBonus}pt concordance (${elevatedCount} elevated)` : ""}</div>
                        {md.updated && (() => { const hrs = (Date.now() - new Date(md.updated)) / 3600000; return hrs > 48 ? <div style={{ fontSize: 10, color: C.dn, marginTop: 4 }}>Data is {Math.round(hrs / 24)}d old — workflow may have failed</div> : <div style={{ fontSize: 10, color: C.t4, marginTop: 4 }}>Updated {hrs < 1 ? "just now" : hrs < 24 ? `${Math.round(hrs)}h ago` : `${Math.round(hrs/24)}d ago`}</div>; })()}
                      </>) : (
                        <div style={{ fontSize: 13, color: C.t4, padding: 20 }}>Loading macro indicators...</div>
                      )}
                    </div>

                    {/* Factor breakdown */}
                    <div style={cardStyle}>
                      {sectionTitle("Factor Breakdown")}
                      <div style={{ fontSize: 11, color: C.t4, marginBottom: 14 }}>Each factor scored 0-100 (higher = more bearish), weighted by predictive power from academic research.</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {factors.map((f, i) => (
                          <div key={i} style={{ background: C.bg, borderRadius: 12, padding: "14px 16px", border: `1px solid ${C.border}` }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                              <div>
                                <span style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>{f.name}</span>
                                <span style={{ fontSize: 11, color: C.t4, marginLeft: 8 }}>{f.weight}% weight</span>
                              </div>
                              <div style={{ fontSize: 18, fontWeight: 900, color: f.color }}>{f.score}</div>
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: C.t2, marginBottom: 4 }}>{f.value}</div>
                            <div style={{ fontSize: 10, color: C.t4, marginBottom: 8 }}>{f.detail} — {f.citation}</div>
                            <div style={{ height: 6, background: C.card, borderRadius: 3, overflow: "hidden" }}>
                              <div style={{ width: `${f.score}%`, height: "100%", background: f.color, borderRadius: 3, transition: "width 0.3s" }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Methodology */}
                    <div style={cardStyle}>
                      {sectionTitle("Methodology")}
                      <div style={{ fontSize: 11, color: C.t3, lineHeight: 1.8 }}>
                        <div><strong style={{ color: C.t1 }}>Yield Curve (18%)</strong> — 10Y minus 2Y Treasury spread with post-inversion premium. Yield curve inversion has preceded every U.S. recession since 1955. Critically, recessions typically begin *after* the curve de-inverts (Bauer & Mertens, 2018) — the re-steepening phase is the most dangerous. The 2022-2024 inversion (-1.08%) ended ~Oct 2024; a +18pt premium decays linearly over 24 months from de-inversion to capture this lagged risk.</div>
                        <div style={{ marginTop: 8 }}><strong style={{ color: C.t1 }}>Valuation (13%)</strong> — SPY trailing P/E ratio. Scoring calibrated to actual pre-bear P/E levels: the 2007 GFC began at 21x, the 2022 bear at 23x, the dot-com crash at 28x (Shiller, 2000). Not a timing signal, but a severity amplifier — high P/E markets fall further.</div>
                        <div style={{ marginTop: 8 }}><strong style={{ color: C.t1 }}>Jobless Claims (12%)</strong> — 4-week moving average of initial unemployment claims from FRED (series IC4WSA, released weekly on Thursdays). Rising claims precede every post-war recession by 3-6 months. Scored on the trend: a 10%+ increase over the prior month is an amber signal; 20%+ is a red flag. This is the model's primary real-economy indicator.</div>
                        <div style={{ marginTop: 8 }}><strong style={{ color: C.t1 }}>Bull Duration (10%)</strong> — Conditional survival probability from {totalBulls} historical bull markets (1929-2022). Of the {atRisk.length} bulls that lasted longer than {bullAgeMo} months, {atRisk.length - survived12.length} ended within the next 12 months. 95% CI: {Math.max(0, Math.round((durationProb / 100 - 1.96 * Math.sqrt(durationProb / 100 * (1 - durationProb / 100) / atRisk.length)) * 100))}% to {Math.min(100, Math.round((durationProb / 100 + 1.96 * Math.sqrt(durationProb / 100 * (1 - durationProb / 100) / atRisk.length)) * 100))}% — wide range due to small sample.</div>
                        <div style={{ marginTop: 8 }}><strong style={{ color: C.t1 }}>Credit Spreads (10%)</strong> — Moody's BAA corporate bond yield minus 10-Year Treasury (FRED BAA10Y, daily, 1986-present). Widening spreads signal deteriorating credit conditions and precede equity drawdowns (Gilchrist & Zakrajsek, 2012). Calibrated to actual pre-bear levels: GFC started at 1.72-1.90%, COVID at 2.05%, 2022 at 1.82%. Stress: Lehman 3.66%, COVID crash 4.31%, GFC bottom 5.40%. Falls back to HYG ETF if FRED data unavailable.</div>
                        <div style={{ marginTop: 8 }}><strong style={{ color: C.t1 }}>Momentum (10%)</strong> — SPY price vs its 200-day moving average. Sustained breakdown below the 200-day SMA has accompanied or preceded most major bear markets, though in rapid crashes (COVID, 1987) the breakdown was concurrent with, not before, the decline.</div>
                        <div style={{ marginTop: 8 }}><strong style={{ color: C.t1 }}>Economic Activity (8%)</strong> — Chicago Fed National Activity Index (CFNAI), a weighted average of 85 monthly indicators covering production, employment, consumption, and housing. Zero = trend growth, below -0.7 = high recession probability. The 3-month moving average is used when available for stability.</div>
                        <div style={{ marginTop: 8 }}><strong style={{ color: C.t1 }}>Sahm Rule (7%)</strong> — 3-month average unemployment rate minus its 12-month low (Sahm, 2019). Triggers at 0.50 percentage points — has signaled every recession since 1950 with zero false positives. Currently at {md.sahmVal != null ? md.sahmVal.toFixed(2) : "—"}pp. This is the most reliable real-time recession indicator in existence.</div>
                        <div style={{ marginTop: 8 }}><strong style={{ color: C.t1 }}>Volatility (5%)</strong> — CBOE VIX Index. Low weight because VIX is reactive — it rises during declines rather than predicting them. Bear markets typically *start* with low VIX (12-16 range). Elevated VIX signals stress already underway.</div>
                        <div style={{ marginTop: 8 }}><strong style={{ color: C.t1 }}>Concordance Bonus</strong> — When 3+ factors score above 50, a bonus of 5-15 points is added. Simultaneous stress across multiple indicators is disproportionately dangerous: the 2000 and 2007 crashes both had yield curve inversion + elevated valuations + credit stress simultaneously.</div>
                        <div style={{ marginTop: 8 }}><strong style={{ color: C.t1 }}>Post-Inversion Premium</strong> — When the yield curve has been inverted within the last 24 months and has since de-inverted, a decaying premium (up to +18pt) is added to the yield curve score. Academic research (Bauer & Mertens 2018, Engstrom & Sharpe 2019) shows recessions typically begin 6-18 months after de-inversion, not during inversion itself.</div>
                        <div style={{ marginTop: 12, padding: "10px 14px", background: C.accent + "10", borderRadius: 8, border: `1px solid ${C.accent}20` }}><strong style={{ color: C.accent }}>Limitations:</strong> Factors are scored via piecewise interpolation against historical ranges — not a trained ML model. Weights are from published research, not curve-fit to historical data. Bull duration is conditional on n={atRisk.length} comparable periods (wide CI). Post-inversion premium uses a fixed de-inversion date (Oct 2024) and decays linearly — a simplification. No out-of-sample backtesting has been performed. This model estimates risk, not certainty — it cannot predict black swan events or novel shocks.</div>
                      </div>
                    </div>

                    {/* Survival curve */}
                    <div style={cardStyle}>
                      {sectionTitle("Bull Market Survival Curve")}
                      <div style={{ fontSize: 12, color: C.t3, marginBottom: 12 }}>% of historical bull markets still alive at each age. Vertical line = current bull ({bullAgeMo} months).</div>
                      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
                        {[25, 50, 75, 100].map(v => { const y = PAD.top + ((100 - v) / 100) * (H - PAD.top - PAD.bottom); return <g key={v}><line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke={C.border} strokeWidth={1} /><text x={PAD.left - 6} y={y + 3} fill={C.t4} fontSize={9} textAnchor="end">{v}%</text></g>; })}
                        <path d={survivalCurve.map((p, i) => { const x = PAD.left + (p.month / 180) * (W - PAD.left - PAD.right); const y = PAD.top + ((100 - p.pct) / 100) * (H - PAD.top - PAD.bottom); return `${i === 0 ? "M" : "L"}${x},${y}`; }).join(" ")} fill="none" stroke={C.up} strokeWidth={2.5} />
                        <path d={survivalCurve.map((p, i) => { const x = PAD.left + (p.month / 180) * (W - PAD.left - PAD.right); const y = PAD.top + ((100 - p.pct) / 100) * (H - PAD.top - PAD.bottom); return `${i === 0 ? "M" : "L"}${x},${y}`; }).join(" ") + ` L${PAD.left + (survivalCurve[survivalCurve.length - 1].month / 180) * (W - PAD.left - PAD.right)},${H - PAD.bottom} L${PAD.left},${H - PAD.bottom} Z`} fill={C.up + "15"} />
                        {(() => { const x = PAD.left + (bullAgeMo / 180) * (W - PAD.left - PAD.right); return <><line x1={x} y1={PAD.top} x2={x} y2={H - PAD.bottom} stroke={C.accent} strokeWidth={2} strokeDasharray="4,3" /><text x={x} y={PAD.top - 4} fill={C.accent} fontSize={9} fontWeight={700} textAnchor="middle">NOW ({bullAgeMo}mo)</text></>; })()}
                        {[0, 24, 48, 72, 96, 120, 144, 168].map(m => <text key={m} x={PAD.left + (m / 180) * (W - PAD.left - PAD.right)} y={H - PAD.bottom + 14} fill={C.t4} fontSize={9} textAnchor="middle">{m}mo</text>)}
                      </svg>
                    </div>
                  </div>
                );
              })()}

              {/* ── CLIENT COMMUNICATION SCRIPTS ── */}
              {pbView === "scripts" && (() => {
                const bullAgeMo = Math.round((Date.now() - new Date("2022-10-12")) / (30.44 * 86400000));
                const scripts = [
                  {
                    regime: "Bull Market — Early/Mid Cycle",
                    condition: "S&P < +100% from trough",
                    active: pctFromTrough < 100,
                    subject: "Portfolio Update: Staying the Course",
                    body: `The S&P 500 is up ${pctFromTrough.toFixed(0)}% from the October 2022 low, and our portfolios are performing well. At this stage of the bull market, our playbook calls for staying fully invested — history shows that trimming too early costs more in missed upside than it saves in protection.\n\nWe're monitoring the market cycle closely and have clear rules for when to start building a cash buffer. For now, the plan is simple: stay invested and let compounding work.`,
                  },
                  {
                    regime: "Bull Market — Extended",
                    condition: "S&P > +100% from trough, trimming active",
                    active: pctFromTrough >= 100 && pctFromTrough < 200,
                    subject: "Portfolio Update: Building a Cash Cushion",
                    body: `The S&P 500 has more than doubled from the October 2022 low (+${pctFromTrough.toFixed(0)}%). While the bull market may continue, history tells us that the further we go, the closer we get to the next correction.\n\nPer our investment playbook, we've begun setting aside a small cash position — currently targeting around ${(TRIM_TIERS.filter(t => pctFromTrough >= t.pctAboveTrough).pop()?.trimPct || 0)}% of your portfolio. This isn't a call that the market is about to drop — it's a systematic rule that's been backtested across 93 years of market history with positive results.\n\nIf no correction materializes within 18 months, this cash goes right back to work. Think of it as inexpensive insurance.`,
                  },
                  {
                    regime: "Correction — Down 10-20%",
                    condition: "S&P down 10-20% from peak",
                    active: drawdown <= -10 && drawdown > -20,
                    subject: "Market Update: Correction in Progress — The Plan Is Working",
                    body: `The S&P 500 is down approximately ${Math.abs(drawdown).toFixed(0)}% from its recent high. I want you to know: this is normal, and we have a plan for exactly this situation.\n\nAt this level, our playbook says to hold. We haven't hit our first deployment threshold (-25%), so we're watching and waiting. The cash cushion we built is doing its job — protecting a portion of your portfolio from the decline.\n\nHistorically, the market has experienced 27 declines of -15% or more since 1929. Every single one eventually recovered. Corrections are uncomfortable but they are the price of admission for long-term equity returns.`,
                  },
                  {
                    regime: "Bear Market — Tranche 1",
                    condition: "S&P down 25%+ from peak",
                    active: drawdown <= -25 && drawdown > -35,
                    subject: "DEPLOYING: First Tranche Into the Market",
                    body: `The S&P 500 is now down ${Math.abs(drawdown).toFixed(0)}% from its peak — we've hit our first deployment threshold.\n\nPer our investment playbook, we're deploying 25% of your cash reserves back into equities at these levels. This is the plan working exactly as designed. We're buying stocks at a significant discount while others are panicking.\n\n87% of historical bear markets have reached this level. We still have 75% of our reserves held back in case the market falls further. If it doesn't, we've already started buying at a great price.\n\nI know this feels uncomfortable. But the data is clear: deploying cash systematically during bear markets is the single highest-value action an investor can take. Across 93 years and 21 market cycles, this approach has outperformed buy-and-hold every single time.`,
                  },
                  {
                    regime: "Bear Market — Tranche 2",
                    condition: "S&P down 35%+ from peak",
                    active: drawdown <= -35 && drawdown > -50,
                    subject: "DEPLOYING: Second Tranche — Deep Value Territory",
                    body: `The S&P 500 is now down ${Math.abs(drawdown).toFixed(0)}% from its peak. This level of decline has only occurred in about half of all bear markets — we are in historically deep territory.\n\nWe're deploying our second tranche — 40% of remaining reserves — into equities. Stocks purchased at -35% from peak have historically delivered +54% returns by the time the market recovers to its prior high.\n\nWe still have reserves held back for an even deeper decline, but statistically, we're likely near the bottom. The average bear market falls 37%. The key now is patience — recoveries take time (average 35 months), but they always come.\n\nThis is the moment that separates disciplined investors from everyone else. Stay the course.`,
                  },
                  {
                    regime: "Bear Market — Tranche 3",
                    condition: "S&P down 50%+ from peak",
                    active: drawdown <= -50,
                    subject: "DEPLOYING: All Remaining Reserves — Generational Opportunity",
                    body: `The S&P 500 is now down ${Math.abs(drawdown).toFixed(0)}% from its peak. Only 5 bear markets in 95 years have reached this depth. This is a generational buying opportunity.\n\nWe're deploying all remaining cash reserves into equities. Stocks purchased at -50% from peak have historically delivered +100% returns by recovery — your deployed cash doubles.\n\nI know this is the hardest moment to invest. Every headline is negative. But this is precisely when the greatest fortunes are made. Buffett's famous quote applies: "Be fearful when others are greedy, and greedy when others are fearful."\n\nThe plan has worked for 93 years. Trust the process.`,
                  },
                ];

                return (
                  <div>
                    <div style={{ fontSize: 12, color: C.t3, marginBottom: 14 }}>Pre-written client communications for each market regime. The <span style={{ color: C.accent, fontWeight: 700 }}>active</span> script matches current conditions. Click to copy.</div>
                    {scripts.map((s, i) => (
                      <div key={i} style={{ ...cardStyle, border: `1px solid ${s.active ? C.accent + "44" : C.border}`, position: "relative" }}>
                        {s.active && <div style={{ position: "absolute", top: 12, right: 14, fontSize: 9, fontWeight: 700, color: C.accent, padding: "3px 8px", borderRadius: 4, background: C.accent + "20", textTransform: "uppercase" }}>Active Now</div>}
                        <div style={{ fontSize: 11, fontWeight: 700, color: s.active ? C.accent : C.t4, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{s.regime}</div>
                        <div style={{ fontSize: 10, color: C.t4, marginBottom: 10 }}>{s.condition}</div>
                        <div style={{ background: C.bg, borderRadius: 10, padding: 14, marginBottom: 8 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: C.t1, marginBottom: 8 }}>Subject: {s.subject}</div>
                          <div style={{ fontSize: 12, color: C.t3, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{s.body}</div>
                        </div>
                        <button onClick={() => { navigator.clipboard.writeText(`Subject: ${s.subject}\n\n${s.body}`); }} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${C.borderActive}`, background: C.accentSoft, color: C.t1, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Copy to Clipboard</button>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* ── HISTORICAL BULL/BEAR MARKETS ── */}
              {pbView === "history" && (
                <div>
                  {/* Summary stats */}
                  <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(4, 1fr)" : "repeat(2, 1fr)", gap: 10, marginBottom: 14 }}>
                    {statBox("Avg Bear Drawdown", `${avgBearDraw}%`, C.dn)}
                    {statBox("Avg Bear Duration", `${avgBearDur} mo`, C.t1)}
                    {statBox("Avg Recovery", `${avgRecovery} mo`, C.t1)}
                    {statBox("Avg Bull Gain", `+${avgBullGain}%`, C.up)}
                  </div>

                  {/* Bear markets table */}
                  <div style={cardStyle}>
                    {sectionTitle("S&P 500 Bear Markets & Near-Bear Corrections Since 1929")}
                    <div style={{ fontSize: 11, color: C.t3, marginBottom: 10, lineHeight: 1.5 }}>
                      Includes all declines of -20%+ (bear markets) plus near-bear corrections (-19% to -21% intraday) that clients experienced as bear-market-level panic. <span style={{ color: "#FBBF24", fontWeight: 700 }}>Yellow rows</span> = near-bear corrections that breached or nearly breached -20%.
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, minWidth: 600 }}>
                        <thead>
                          <tr style={{ background: C.bg }}>
                            {["Event", "Peak", "Trough", "Close", "Intraday", "Duration", "Recovery"].map(h => (
                              <th key={h} style={{ padding: "8px 10px", textAlign: h === "Event" ? "left" : "center", fontSize: 10, fontWeight: 700, color: C.t4, textTransform: "uppercase" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {BEAR_MARKETS.map((b, i) => (
                            <tr key={i} style={{ borderTop: `1px solid ${C.border}`, background: b.nearBear ? "#FBBF2410" : "transparent" }}>
                              <td style={{ padding: "8px 10px", fontWeight: 600, color: b.nearBear ? "#FBBF24" : C.t2, whiteSpace: "nowrap" }}>
                                {b.name}
                                {b.nearBear && <span style={{ fontSize: 8, color: "#FBBF24", fontWeight: 700, marginLeft: 4, verticalAlign: "super" }}>NEAR</span>}
                              </td>
                              <td style={{ padding: "8px 10px", textAlign: "center", color: C.t3 }}>{b.peakDate}</td>
                              <td style={{ padding: "8px 10px", textAlign: "center", color: C.t3 }}>{b.troughDate}</td>
                              <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 700, color: C.dn }}>{b.drawdown}%</td>
                              <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 700, color: b.intradayDraw ? C.dn : C.t4 }}>{b.intradayDraw ? `${b.intradayDraw}%` : "--"}</td>
                              <td style={{ padding: "8px 10px", textAlign: "center", color: C.t3 }}>{b.durationMo} mo</td>
                              <td style={{ padding: "8px 10px", textAlign: "center", color: C.t3 }}>{b.recoveryMo} mo</td>
                            </tr>
                          ))}
                          <tr style={{ borderTop: `2px solid ${C.border}`, background: C.bg }}>
                            <td style={{ padding: "8px 10px", fontWeight: 800, color: C.t1 }}>Avg (bears only)</td>
                            <td colSpan={2} />
                            <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800, color: C.dn }}>{avgBearDraw}%</td>
                            <td style={{ padding: "8px 10px", textAlign: "center", color: C.t4 }}>--</td>
                            <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800, color: C.t1 }}>{avgBearDur} mo</td>
                            <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800, color: C.t1 }}>{avgRecovery} mo</td>
                          </tr>
                          <tr style={{ borderTop: `1px solid ${C.border}`, background: C.bg }}>
                            <td style={{ padding: "8px 10px", fontWeight: 800, color: "#FBBF24" }}>Avg (all declines)</td>
                            <td colSpan={2} />
                            <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800, color: C.dn }}>{avgAllDraw}%</td>
                            <td style={{ padding: "8px 10px", textAlign: "center", color: C.t4 }}>--</td>
                            <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800, color: C.t1 }}>{avgAllDur} mo</td>
                            <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800, color: C.t1 }}>{avgAllRecovery} mo</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Bull markets table */}
                  <div style={cardStyle}>
                    {sectionTitle("S&P 500 Bull Markets Since 1929")}
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, minWidth: 400 }}>
                        <thead>
                          <tr style={{ background: C.bg }}>
                            {["Period", "Total Gain", "Duration"].map(h => (
                              <th key={h} style={{ padding: "8px 10px", textAlign: h === "Period" ? "left" : "center", fontSize: 10, fontWeight: 700, color: C.t4, textTransform: "uppercase" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {BULL_MARKETS.map((b, i) => {
                            const isCurrent = b.period.includes("present");
                            return (
                              <tr key={i} style={{ borderTop: `1px solid ${C.border}`, background: isCurrent ? C.accentSoft : "transparent" }}>
                                <td style={{ padding: "8px 10px", fontWeight: 600, color: isCurrent ? C.t1 : C.t2 }}>{b.period} {isCurrent && <span style={{ fontSize: 9, color: C.accent, fontWeight: 700 }}>CURRENT</span>}</td>
                                <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 700, color: C.up }}>+{b.gain}%</td>
                                <td style={{ padding: "8px 10px", textAlign: "center", color: C.t3 }}>{b.durationMo} mo</td>
                              </tr>
                            );
                          })}
                          <tr style={{ borderTop: `2px solid ${C.border}`, background: C.bg }}>
                            <td style={{ padding: "8px 10px", fontWeight: 800, color: C.t1 }}>Average</td>
                            <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800, color: C.up }}>+{avgBullGain}%</td>
                            <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800, color: C.t1 }}>40.6 mo</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ── BOND DURATION ANALYSIS ── */}
              {pbView === "bonds" && (() => {
                const bullAgeMo = (Date.now() - new Date("2022-10-12")) / (30.44 * 86400000);
                const bearsCovered5yr = officialBears.filter(b => (b.durationMo + b.recoveryMo) <= 60).length;
                const coveragePct5yr = Math.round(bearsCovered5yr / officialBears.length * 100);
                const riskLevel = pctFromTrough > 150 ? "elevated" : pctFromTrough > 100 ? "moderate" : "low";
                const riskColor = riskLevel === "elevated" ? C.dn : riskLevel === "moderate" ? "#FBBF24" : C.up;
                const recommendedYears = riskLevel === "elevated" ? 6 : riskLevel === "moderate" ? 5 : 4;
                const LADDER_YEARS = [
                  { year: 1, purpose: "Current-year living expenses", action: "Matures annually — fund withdrawals" },
                  { year: 2, purpose: "Next-year living expenses", action: "Rolls to Year 1 on maturity" },
                  { year: 3, purpose: "Buffer year", action: "Rolls to Year 2 on maturity" },
                  { year: 4, purpose: "Buffer year", action: "Rolls to Year 3 on maturity" },
                  { year: 5, purpose: "Deployment reserve", action: "Sell in bear market tranches (-25/-35/-50%)" },
                ];
                if (recommendedYears >= 6) LADDER_YEARS.push({ year: 6, purpose: "Extended buffer", action: "Added when cycle risk is elevated" });

                return (
                  <div>
                    {/* Current recommendation */}
                    <div style={{ ...cardStyle, textAlign: "center", position: "relative", overflow: "hidden" }}>
                      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: C.accent }} />
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.t4, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>Current Bond Ladder Rule</div>
                      <div style={{ fontSize: 48, fontWeight: 900, color: C.accent, marginBottom: 4 }}>{recommendedYears}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: C.t1, marginBottom: 12 }}>Years of Living Expenses in Bonds</div>
                      <div style={{ display: "inline-block", padding: "6px 16px", borderRadius: 8, background: riskColor + "18", border: `1px solid ${riskColor}44` }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: riskColor, textTransform: "uppercase" }}>Cycle Risk: {riskLevel}</span>
                      </div>
                    </div>

                    {/* Why this number */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                      {statBox("Bull Age", `${Math.round(bullAgeMo)} mo`, C.t1)}
                      {statBox("From Trough", `${pctFromTrough >= 0 ? "+" : ""}${pctFromTrough.toFixed(0)}%`, pctFromTrough >= 0 ? C.up : C.dn)}
                      {statBox("5yr Coverage", `${coveragePct5yr}%`, coveragePct5yr >= 70 ? C.up : "#FBBF24")}
                      {statBox("Avg Recovery", `${avgRecovery.toFixed(0)} mo`, C.t1)}
                    </div>

                    {/* Ladder structure */}
                    <div style={cardStyle}>
                      {sectionTitle("Bond Ladder Structure")}
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {LADDER_YEARS.map((ly, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: ly.year === 5 ? C.dn + "10" : ly.year === 6 ? "#FBBF2410" : C.bg, borderRadius: 10, border: `1px solid ${ly.year === 5 ? C.dn + "30" : ly.year === 6 ? "#FBBF2430" : C.border}` }}>
                            <div style={{ width: 36, height: 36, borderRadius: 10, background: ly.year === 5 ? C.dn + "20" : ly.year === 6 ? "#FBBF2420" : C.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 900, color: ly.year === 5 ? C.dn : ly.year === 6 ? "#FBBF24" : C.accent, flexShrink: 0 }}>{ly.year}</div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>{ly.purpose}</div>
                              <div style={{ fontSize: 11, color: C.t4, marginTop: 2 }}>{ly.action}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Dynamic rule */}
                    <div style={cardStyle}>
                      {sectionTitle("When to Adjust")}
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {[
                          { condition: "Bull market < 100% above trough", years: 4, risk: "low", color: C.up },
                          { condition: "Bull market 100-150% above trough", years: 5, risk: "moderate", color: "#FBBF24" },
                          { condition: "Bull market > 150% above trough", years: 6, risk: "elevated", color: C.dn },
                          { condition: "Yield curve inverted", years: 6, risk: "elevated", color: C.dn },
                        ].map((r, i) => {
                          const active = (r.condition.includes("<") && pctFromTrough < 100) ||
                            (r.condition.includes("100-150") && pctFromTrough >= 100 && pctFromTrough <= 150) ||
                            (r.condition.includes("> 150") && pctFromTrough > 150);
                          return (
                            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: active ? C.accentSoft : C.bg, borderRadius: 10, border: `1px solid ${active ? C.borderActive : C.border}` }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: active ? C.t1 : C.t3 }}>{r.condition}</div>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <span style={{ fontSize: 16, fontWeight: 900, color: r.color }}>{r.years} yr</span>
                                {active && <span style={{ fontSize: 9, fontWeight: 700, color: C.accent, padding: "3px 8px", borderRadius: 4, background: C.accent + "20" }}>NOW</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ── WHY IT WORKS ── */}
              {pbView === "proof" && (
                <div>
                  {/* Headline */}
                  <div style={{ ...cardStyle, textAlign: "center", position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: C.up }} />
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.t4, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>Backtested Across 93 Years</div>
                    <div style={{ fontSize: 42, fontWeight: 900, color: C.up, marginBottom: 4 }}>+13.9</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, marginBottom: 4 }}>basis points per year alpha vs. buy-and-hold</div>
                    <div style={{ fontSize: 13, color: C.t3 }}>21 complete bull/bear cycles · 1929-2024 · <span style={{ color: C.up, fontWeight: 700 }}>100% non-loss rate</span></div>
                  </div>

                  {/* Key stats */}
                  <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(4, 1fr)" : "repeat(2, 1fr)", gap: 10, marginBottom: 14 }}>
                    {statBox("Non-Loss Rate", "21/21", C.up)}
                    {statBox("Excess Wealth", "+12.9%", C.up)}
                    {statBox("Max Cash", "14%", C.t1)}
                    {statBox("Configs Tested", "110K+", C.t3)}
                  </div>

                  {/* Why it works */}
                  <div style={cardStyle}>
                    {sectionTitle("The Three Mechanisms")}
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {[
                        { num: "1", title: "Age Gate (21 months)", desc: "No trimming until the bull is mature. Eliminates cash drag entirely in short bulls. The 1% scout tier at +75% has negligible cost but catches short cycles like 2020-2022." },
                        { num: "2", title: "18-Month Time Decay", desc: "If no bear arrives within 18 months of trimming, cash goes back to equity. Triggers reset at higher levels. More frequent recycling generates more trimming opportunities in mega-bulls, preventing cash from sitting idle for a decade." },
                        { num: "3", title: "3-Tranche Deployment (-25 / -35 / -50%)", desc: "Deploy 25% at -25%, 40% at -35%, all remaining at -50%. Three tranches preserve reserves for the deepest bears where recovery returns are highest. In the GFC (-57%), the third tranche deploys at generational lows." },
                      ].map((m, i) => (
                        <div key={i} style={{ display: "flex", gap: 14, padding: "14px 16px", background: C.bg, borderRadius: 12 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: C.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 900, color: C.accent, flexShrink: 0 }}>{m.num}</div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginBottom: 4 }}>{m.title}</div>
                            <div style={{ fontSize: 12, color: C.t3, lineHeight: 1.6 }}>{m.desc}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Cycle-by-cycle results */}
                  <div style={cardStyle}>
                    {sectionTitle("Cycle-by-Cycle Results")}
                    <div style={{ fontSize: 12, color: C.t3, marginBottom: 12 }}>Every bull/bear cycle from 1932 to 2024. Alpha = strategy return minus buy-and-hold return.</div>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, minWidth: 600 }}>
                        <thead>
                          <tr style={{ background: C.bg }}>
                            {["Cycle", "Bull", "Bear", "Cash@Peak", "Alpha", "DD Red."].map(h => (
                              <th key={h} style={{ padding: "8px 10px", textAlign: h === "Cycle" ? "left" : "center", fontSize: 10, fontWeight: 700, color: C.t4, textTransform: "uppercase" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { cycle: "1929-30 / Depression", bull: "+47%", bear: "-83.0%", cash: "0%", alpha: "0.00%", ddRed: "—" },
                            { cycle: "1932 / 1932-33", bull: "+112%", bear: "-40.6%", cash: "0%", alpha: "0.00%", ddRed: "—" },
                            { cycle: "1933 / 1933", bull: "+121%", bear: "-29.8%", cash: "0%", alpha: "0.00%", ddRed: "—" },
                            { cycle: "1933-34 / 1934-35", bull: "+38%", bear: "-31.8%", cash: "0%", alpha: "0.00%", ddRed: "—" },
                            { cycle: "1935-37 / 1937-38", bull: "+132%", bear: "-54.5%", cash: "1.8%", alpha: "+1.38%", ddRed: "+0.8pp" },
                            { cycle: "1938 / War Fears", bull: "+62%", bear: "-26.2%", cash: "0%", alpha: "0.00%", ddRed: "—" },
                            { cycle: "1939 / Fall of France", bull: "+30%", bear: "-31.9%", cash: "0%", alpha: "0.00%", ddRed: "—" },
                            { cycle: "1940 / WWII", bull: "+27%", bear: "-34.5%", cash: "0%", alpha: "0.00%", ddRed: "—" },
                            { cycle: "1942-46 / Post-WWII", bull: "+158%", bear: "-28.8%", cash: "4.9%", alpha: "+2.81%", ddRed: "+1.2pp" },
                            { cycle: "1947-48 / 1948-49", bull: "+21%", bear: "-20.6%", cash: "0%", alpha: "0.00%", ddRed: "—" },
                            { cycle: "1949-56 / Eisenhower", bull: "+267%", bear: "-21.6%", cash: "7.7%", alpha: "+1.64%", ddRed: "+1.1pp" },
                            { cycle: "1957-61 / Kennedy", bull: "+86%", bear: "-28.0%", cash: "1.9%", alpha: "+0.92%", ddRed: "+0.6pp" },
                            { cycle: "1962-66 / Credit Crunch", bull: "+80%", bear: "-22.2%", cash: "2.0%", alpha: "+0.82%", ddRed: "+0.4pp" },
                            { cycle: "1966-68 / Vietnam", bull: "+48%", bear: "-36.1%", cash: "0%", alpha: "0.00%", ddRed: "—" },
                            { cycle: "1970-73 / OPEC", bull: "+74%", bear: "-48.2%", cash: "0%", alpha: "0.00%", ddRed: "—" },
                            { cycle: "1974-80 / Volcker", bull: "+126%", bear: "-27.1%", cash: "1.9%", alpha: "+0.86%", ddRed: "+0.5pp" },
                            { cycle: "1982-87 / Black Monday", bull: "+229%", bear: "-33.5%", cash: "4.0%", alpha: "+1.03%", ddRed: "+1.0pp" },
                            { cycle: "1987-00 / Dot-Com", bull: "+582%", bear: "-49.1%", cash: "12.9%", alpha: "+11.86%", ddRed: "+2.1pp" },
                            { cycle: "2002-07 / GFC", bull: "+102%", bear: "-56.8%", cash: "1.8%", alpha: "+1.09%", ddRed: "+0.5pp" },
                            { cycle: "2009-20 / COVID", bull: "+400%", bear: "-33.9%", cash: "10.3%", alpha: "+3.96%", ddRed: "+3.0pp" },
                            { cycle: "2020-22 / Inflation", bull: "+114%", bear: "-25.4%", cash: "2.0%", alpha: "+1.16%", ddRed: "+0.5pp" },
                          ].map((r, i) => (
                            <tr key={i} style={{ borderTop: `1px solid ${C.border}` }}>
                              <td style={{ padding: "8px 10px", fontWeight: 600, color: C.t2, whiteSpace: "nowrap" }}>{r.cycle}</td>
                              <td style={{ padding: "8px 10px", textAlign: "center", color: C.up }}>{r.bull}</td>
                              <td style={{ padding: "8px 10px", textAlign: "center", color: C.dn }}>{r.bear}</td>
                              <td style={{ padding: "8px 10px", textAlign: "center", color: C.t3 }}>{r.cash}</td>
                              <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 700, color: parseFloat(r.alpha) > 0 ? C.up : parseFloat(r.alpha) < 0 ? C.dn : C.t3 }}>{r.alpha}</td>
                              <td style={{ padding: "8px 10px", textAlign: "center", color: C.t3 }}>{r.ddRed}</td>
                            </tr>
                          ))}
                          <tr style={{ borderTop: `2px solid ${C.border}`, background: C.bg }}>
                            <td style={{ padding: "8px 10px", fontWeight: 800, color: C.t1 }}>Total / Average</td>
                            <td colSpan={2} />
                            <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800, color: C.t1 }}>2.4% avg</td>
                            <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800, color: C.up }}>+27.5%</td>
                            <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800, color: C.t1 }}>+1.1pp</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Why it beats alternatives */}
                  <div style={cardStyle}>
                    {sectionTitle("Why It Beats the Alternatives")}
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {[
                        { strategy: "Buy-and-Hold", result: "Baseline", problem: "No drawdown protection. Clients panic-sell at the bottom. A client who sells at -40% and waits 6 months to re-enter loses 15-30% of their recovery.", color: C.t3 },
                        { strategy: "Constant Cash (e.g. 10%)", result: "-70 bps/yr", problem: "Permanent drag. 10% cash × 7% equity premium = 70 bps/yr guaranteed underperformance, every year, forever. Over 30 years that's 23% less wealth.", color: C.dn },
                        { strategy: "Simple Trim (no decay)", result: "-9 bps/yr", problem: "Cash drag compounds in long bulls. The 1987-2000 bull (+582%) and 2009-2020 bull (+400%) each lasted 10+ years. Holding 8-12% cash through those erased all bear-market savings.", color: C.dn },
                        { strategy: "Paradiem Playbook", result: "+13.9 bps/yr", problem: "18-month time decay solves the long-bull problem. 3-tranche deployment (-25/-35/-50%) preserves reserves for deep bears. 100% non-loss rate across 93 years and 21 cycles.", color: C.up },
                      ].map((s, i) => (
                        <div key={i} style={{ padding: "14px 16px", background: C.bg, borderRadius: 12, border: `1px solid ${i === 3 ? C.accent + "44" : C.border}` }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>{s.strategy}</span>
                            <span style={{ fontSize: 13, fontWeight: 800, color: s.color }}>{s.result}</span>
                          </div>
                          <div style={{ fontSize: 11, color: C.t3, lineHeight: 1.6 }}>{s.problem}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* The behavioral edge */}
                  <div style={cardStyle}>
                    {sectionTitle("The Real Alpha: Behavioral")}
                    <div style={{ fontSize: 12, color: C.t3, lineHeight: 1.7 }}>
                      <p style={{ marginBottom: 10 }}>The +44.7 bps/yr quantitative alpha is real, but the <strong style={{ color: C.t1 }}>behavioral alpha is far larger</strong>. Studies show the average equity investor underperforms the S&P 500 by <strong style={{ color: C.dn }}>300-400 bps/yr</strong> (Dalbar QAIB, 2024) — almost entirely from panic selling during drawdowns and late re-entry.</p>
                      <p style={{ marginBottom: 10 }}>This playbook eliminates that by giving clients a <strong style={{ color: C.t1 }}>visible, rules-based framework</strong>. When the market drops 25%, they see "TRANCHE 1: DEPLOYING" — not just losses. The psychology shifts from <em>"I'm losing money"</em> to <em>"the plan is working."</em></p>
                      <p style={{ marginBottom: 10 }}>A client who panic-sells at -35% and waits 6 months to re-enter a market that's already recovered 20% loses <strong style={{ color: C.dn }}>~25% of their portfolio permanently</strong>. Preventing that even once in a 30-year relationship is worth more than decades of 44.7 bps.</p>
                      <p><strong style={{ color: C.accent }}>The playbook's job is to keep clients invested through the worst moments. The quantitative alpha is a bonus — the behavioral alpha is the product.</strong></p>
                    </div>
                  </div>

                  {/* Methodology */}
                  <div style={cardStyle}>
                    {sectionTitle("Methodology")}
                    <div style={{ fontSize: 12, color: C.t3, lineHeight: 1.7 }}>
                      <p style={{ marginBottom: 10 }}>Optimized across <strong style={{ color: C.t1 }}>110,000+ strategy configurations</strong> using Monte Carlo simulation with bootstrap resampling of 21 historical S&P 500 bull/bear cycles (1929-2024), plus 5 near-bear corrections. Parameters swept: age gates (12-60 months), time decay (6-36 months), trim thresholds (50-600% from trough), trim amounts (1-18%), deploy triggers (-10% to -50%), and deploy splits (2-4 tranches with varying weights).</p>
                      <p style={{ marginBottom: 10 }}>Each configuration was scored on a composite objective: maximize cumulative alpha while maintaining 100% non-loss rate. The recommended strategy achieved the highest composite score with <strong style={{ color: C.up }}>21/21 non-losing cycles</strong>.</p>
                      <p>Data sources: S&P 500 / S&P Composite historical data from Yardeni Research, Hartford Funds, NYU Stern, Macrotrends. Bear market definitions follow the standard -20% from peak threshold. Recovery defined as closing above the prior peak.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ━���━ SCREENER ━━━ */}
        {tab === "screener" && null}

        {/* ━━━ OPPORTUNITIES ━━━ */}
        {tab === "opportunities" && (
          <div style={{ animation: "fadeIn 0.3s ease", paddingTop: 20 }}>
            {!isDesktop && <div style={{ fontSize: 24, fontWeight: 800, color: C.t1, marginBottom: 4 }}>Opportunity Finder</div>}
            {isDesktop && <div style={{ fontSize: 20, fontWeight: 800, color: C.t1, marginBottom: 4 }}>Opportunity Finder</div>}
            <div style={{ fontSize: 12, color: C.t3, marginBottom: 18 }}>Thematic investment ideas backed by research</div>
            {!opportunities.length ? (
              <div style={{ textAlign: "center", padding: 40 }}>
                <div style={{ width: 28, height: 28, border: `3px solid ${C.border}`, borderTopColor: C.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
                <div style={{ fontSize: 13, color: C.t4 }}>Loading opportunities...</div>
              </div>
            ) : opportunities.map(opp => (
              <div key={opp.id} onClick={() => setOppDetail(opp)} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "18px 16px", marginBottom: 14, cursor: "pointer" }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.t1, marginBottom: 8 }}>{opp.title}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                  {opp.pattern && <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: C.accentSoft, color: C.accent }}>{opp.pattern}</span>}
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: opp.conviction === "High Conviction" ? C.upSoft : "#2563EB20", color: opp.conviction === "High Conviction" ? C.up : "#2563EB" }}>{opp.conviction}</span>
                </div>
                {opp.catalyst && <div style={{ fontSize: 13, color: C.t2, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{opp.catalyst}</div>}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                  {opp.tickers?.map(t => <span key={t} style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 16, background: C.accentSoft, color: C.accent }}>{t}</span>)}
                </div>
                <div style={{ display: "flex", gap: 12, fontSize: 10, color: C.t4, marginTop: 8 }}>
                  {opp.date_identified && <span>{opp.date_identified}</span>}
                  {opp.timeframe && <span>{opp.timeframe}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Opportunity detail overlay */}
        {oppDetail && (
          <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: C.bg, display: "flex", flexDirection: "column", paddingTop: "env(safe-area-inset-top, 0px)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
              <button onClick={() => setOppDetail(null)} style={{ background: "none", border: "none", color: C.t1, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.t1} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                Back
              </button>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.t3 }}>Research Report</span>
              <div style={{ width: 50 }} />
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 18px", paddingBottom: 40 }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: C.t1, lineHeight: 1.2, marginBottom: 12 }}>{oppDetail.title}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                {oppDetail.pattern && <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 14px", borderRadius: 20, background: C.accentSoft, color: C.accent }}>{oppDetail.pattern}</span>}
                <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 14px", borderRadius: 20, background: oppDetail.conviction === "High Conviction" ? C.upSoft : "#2563EB20", color: oppDetail.conviction === "High Conviction" ? C.up : "#2563EB" }}>{oppDetail.conviction}</span>
                {oppDetail.status && <span style={{ fontSize: 12, fontWeight: 600, padding: "4px 14px", borderRadius: 20, background: C.surface, border: `1px solid ${C.border}`, color: C.t3 }}>{oppDetail.status}</span>}
                {oppDetail.timeframe && <span style={{ fontSize: 12, fontWeight: 600, padding: "4px 14px", borderRadius: 20, background: C.surface, border: `1px solid ${C.border}`, color: C.t3 }}>{oppDetail.timeframe}</span>}
              </div>

              <div style={{ fontSize: 11, fontWeight: 800, color: C.t3, letterSpacing: 2, textTransform: "uppercase", margin: "24px 0 12px", paddingBottom: 4, borderBottom: `2px solid ${C.accent}` }}>Catalyst</div>
              <div style={{ fontSize: 13, color: C.t2, lineHeight: 1.7, marginBottom: 16 }}>{oppDetail.catalyst}</div>

              <div style={{ fontSize: 11, fontWeight: 800, color: C.t3, letterSpacing: 2, textTransform: "uppercase", margin: "24px 0 12px", paddingBottom: 4, borderBottom: `2px solid ${C.accent}` }}>Investment Thesis</div>
              <div style={{ fontSize: 13, color: C.t2, lineHeight: 1.7, marginBottom: 16 }}>{oppDetail.thesis}</div>

              <div style={{ fontSize: 11, fontWeight: 800, color: C.t3, letterSpacing: 2, textTransform: "uppercase", margin: "24px 0 12px", paddingBottom: 4, borderBottom: `2px solid ${C.up}` }}>Ticker Analysis</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                {oppDetail.tickers?.map(t => (
                  <div key={t} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: C.accent }}>{t}</span>
                      <button onClick={(e) => { e.stopPropagation(); setOppDetail(null); setScreenerDetail({ ticker: t, _loading: true }); setScreenerDetailLoading(true); setTab("screener"); fetch(`https://richacarson.github.io/Stock-Screener/reports/${t}.json`).then(r => r.ok ? r.json() : { ticker: t }).then(d => { setScreenerDetail(d); setScreenerDetailLoading(false); }).catch(() => { setScreenerDetail({ ticker: t }); setScreenerDetailLoading(false); }); }} style={{ fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 8, background: C.accentSoft, border: `1px solid ${C.borderActive}`, color: C.t1, cursor: "pointer", fontFamily: "inherit" }}>View Screener Report</button>
                    </div>
                    {oppDetail.ticker_rationale?.[t] && <div style={{ fontSize: 12, color: C.t2, lineHeight: 1.7 }}>{oppDetail.ticker_rationale[t]}</div>}
                  </div>
                ))}
              </div>

              <div style={{ fontSize: 11, fontWeight: 800, color: C.t3, letterSpacing: 2, textTransform: "uppercase", margin: "24px 0 12px", paddingBottom: 4, borderBottom: `2px solid ${C.dn}` }}>Key Risks</div>
              <ol style={{ margin: "8px 0 16px", paddingLeft: 28 }}>
                {oppDetail.risks?.map((r, i) => <li key={i} style={{ fontSize: 13, color: C.t2, lineHeight: 1.6, marginBottom: 10 }}>{typeof r === "string" ? r : r.description || r.risk || JSON.stringify(r)}</li>)}
              </ol>

              {oppDetail.sources?.length > 0 && (<>
                <div style={{ fontSize: 11, fontWeight: 800, color: C.t3, letterSpacing: 2, textTransform: "uppercase", margin: "24px 0 12px", paddingBottom: 4, borderBottom: `2px solid #B8860B` }}>Sources</div>
                <ol style={{ margin: "8px 0", paddingLeft: 28 }}>
                  {oppDetail.sources.map((s, i) => <li key={i} style={{ fontSize: 11, color: C.t3, lineHeight: 1.5, marginBottom: 8 }}>{typeof s === "string" ? s : s.title || s.source || JSON.stringify(s)}</li>)}
                </ol>
              </>)}

              <div style={{ textAlign: "center", fontSize: 10, color: C.t4, letterSpacing: 0.5, textTransform: "uppercase", marginTop: 40, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>Intentional Ownership · For Investment Committee Use Only · Not Investment Advice</div>
            </div>
          </div>
        )}

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
                    Link your Redtail CRM to view contacts, tasks, and appointments directly in Paradiem. You'll need a Redtail API key.
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
          <div style={{ animation: "fadeIn 0.3s ease", paddingTop: isDesktop ? 20 : 10, paddingBottom: 120 }}>
            {!isDesktop && <div style={{ fontSize: 22, fontWeight: 800, color: C.t1, marginBottom: 8 }}>Performance</div>}

            {/* Chart / Holdings toggle */}
            <div style={{ display: "flex", gap: 6, marginBottom: isDesktop ? 12 : 6 }}>
              {[{ v: "chart", l: "📈 Chart" }, { v: "holdings", l: "💼 Holdings" }].map(({ v, l }) => (
                <button key={v} onClick={() => setPerfView(v)} style={{
                  flex: "0 0 auto", padding: "9px 16px", borderRadius: 10, border: `1px solid ${perfView === v ? C.borderActive : C.border}`,
                  background: perfView === v ? C.accentSoft : "transparent",
                  color: perfView === v ? C.t1 : C.t3, fontSize: 13, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                }}>{l}</button>
              ))}
            </div>

            {/* Portfolio sleeve selector (dropdown) */}
            {Object.keys(perfDataMap).length > 1 && (
              <div style={{ marginBottom: isDesktop ? 16 : 8 }}>
                <select
                  value={perfSleeve}
                  onChange={e => { setPerfSleeve(e.target.value); setHoldingsSleeve(e.target.value); setPerfRange("ALL"); }}
                  style={{
                    padding: "10px 36px 10px 14px", borderRadius: 10, border: `1px solid ${C.borderActive}`,
                    background: C.card, color: C.t1, fontSize: 14, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                    appearance: "none", WebkitAppearance: "none",
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                    backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center",
                  }}
                >
                  {[{ k: "dividend", l: "💰 Dividend Strategy" }, { k: "growth", l: "🚀 Growth Strategy" }, { k: "fci100", l: "🏆 FCI 100" }, { k: "fciValues", l: "✝️ FCI Values 100" }].filter(s => perfDataMap[s.k]).map(s => (
                    <option key={s.k} value={s.k}>{s.l}</option>
                  ))}
                </select>
              </div>
            )}

            {/* ━━━ HOLDINGS VIEW (full version) ━━━ */}
            {perfView === "holdings" && perfDataMap && Object.keys(perfDataMap).length > 0 && (() => {
              const hPerfData = perfDataMap[perfSleeve] || perfDataMap.dividend || Object.values(perfDataMap)[0];
              if (!hPerfData) return null;
              return (
              <div style={{ animation: "fadeIn 0.2s ease" }}>
                {/* Portfolio Summary */}
                <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(4, 1fr)" : "repeat(2, 1fr)", gap: 10, marginBottom: 16 }}>
                  {(() => {
                    const totalVal = liveValue ? liveValue.value : 0;
                    const cashVal = liveValue ? liveValue.cash : (hPerfData.cash || 0);
                    const startVal = hPerfData.portfolio?.[0]?.value || (hPerfData.startBalance || 100000);
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
                <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
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
                {showTxHistory && hPerfData.transactions && (
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
                        {[...hPerfData.transactions].sort((a, b) => b.date.localeCompare(a.date)).map((tx, i) => {
                          const isStock = !!tx.ticker;
                          const typeMap = { PURCHASE: "BUY", SALE: "SELL", DIVIDEND: "DIV", "DIVIDEND REINVESTMENT": "DRIP", DEPOSIT: "DEP", WITHDRAWAL: "WDR", SPLIT: "SPLIT" };
                          const typeColor = tx.type === "PURCHASE" || tx.type === "DEPOSIT" || tx.type === "DIVIDEND" || tx.type === "DIVIDEND REINVESTMENT" ? C.up : tx.type === "SALE" || tx.type === "WITHDRAWAL" ? C.dn : C.t2;
                          return (
                            <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                              <td style={{ padding: "8px 12px", color: C.t2 }}>{tx.date}</td>
                              <td style={{ padding: "8px 12px", color: typeColor, fontWeight: 600 }}>{typeMap[tx.type] || tx.type}</td>
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
                )}

                {/* Holdings Table */}
                {(() => {
                  const totalVal = liveValue ? liveValue.value : 1;
                  const cashVal = liveValue?.cash || hPerfData.cash || 0;
                  const cashWeight = liveValue ? ((cashVal / liveValue.value) * 100) : 0;
                  const rows = Object.entries(hPerfData.holdings).map(([ticker, shares]) => {
                    const q = quotesRef.current?.[ticker];
                    const price = q?.p || 0;
                    const pc = bars[ticker]?.pc || price;
                    const dayChg = price - pc;
                    const dayChgPct = pc > 0 ? (dayChg / pc) * 100 : 0;
                    const mktValue = shares * price;
                    const weight = totalVal > 0 ? (mktValue / totalVal) * 100 : 0;
                    const cb = hPerfData.costBasis[ticker] || {};
                    const avgCost = cb.avg_cost || 0;
                    const costBasis = cb.total_cost || 0;
                    const gainLoss = mktValue - costBasis;
                    const gainLossPct = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;
                    const name = names[ticker] || "";
                    // Initial buy date for current holding period
                    let initDate = null;
                    if (hPerfData.transactions) {
                      const txs = [...hPerfData.transactions].filter(t => t.ticker === ticker).sort((a, b) => a.date.localeCompare(b.date));
                      let running = 0;
                      for (const tx of txs) {
                        if (tx.type === "PURCHASE") {
                          if (running <= 0.001) initDate = tx.date;
                          running += tx.shares || 0;
                        } else if (tx.type === "SALE") {
                          running -= tx.shares || 0;
                          if (running <= 0.001) { running = 0; initDate = null; }
                        }
                      }
                    }
                    return { ticker, name, shares, price, dayChg, dayChgPct, mktValue, weight, avgCost, costBasis, gainLoss, gainLossPct, initDate };
                  });
                  const { col: sc, dir: sd } = holdingsSort;
                  const sortKey = { symbol: r => r.ticker, name: r => (r.name || "").toLowerCase(), shares: r => r.shares, price: r => r.price, dayChg: r => r.dayChg, dayChgPct: r => r.dayChgPct, mktValue: r => r.mktValue, weight: r => r.weight, avgCost: r => r.avgCost, costBasis: r => r.costBasis, gainLoss: r => r.gainLoss, gainLossPct: r => r.gainLossPct, initDate: r => r.initDate || "" }[sc] || (r => r.weight);
                  rows.sort((a, b) => { const av = sortKey(a), bv = sortKey(b); if (typeof av === "string") return sd === "asc" ? av.localeCompare(bv) : bv.localeCompare(av); return sd === "asc" ? av - bv : bv - av; });
                  const totMktVal = rows.reduce((s, r) => s + r.mktValue, 0);
                  const totCostBasis = rows.reduce((s, r) => s + r.costBasis, 0);
                  const totGainLoss = rows.reduce((s, r) => s + r.gainLoss, 0);
                  const totGainLossPct = totCostBasis > 0 ? (totGainLoss / totCostBasis) * 100 : 0;

                  return (
                  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontVariantNumeric: "tabular-nums", minWidth: 800 }}>
                      <thead>
                        <tr>
                          {[
                            { key: "symbol", label: "Symbol", align: "left" }, { key: "shares", label: "Shares", align: "right" },
                            { key: "price", label: "Price", align: "right" }, { key: "dayChgPct", label: "Day %", align: "right" },
                            { key: "mktValue", label: "Mkt Value", align: "right" }, { key: "weight", label: "Weight", align: "right" },
                            { key: "avgCost", label: "Avg Cost", align: "right" }, { key: "costBasis", label: "Cost Basis", align: "right" },
                            { key: "gainLoss", label: "Gain/Loss", align: "right" }, { key: "gainLossPct", label: "G/L %", align: "right" },
                            { key: "initDate", label: "Buy Date", align: "right" },
                          ].map(col => (
                            <th key={col.key} onClick={() => setHoldingsSort(prev => ({ col: col.key, dir: prev.col === col.key && prev.dir === "desc" ? "asc" : "desc" }))}
                              style={{ padding: "10px 12px", textAlign: col.align, fontSize: 10, fontWeight: 700, color: holdingsSort.col === col.key ? C.t1 : C.t4, textTransform: "uppercase", letterSpacing: 0.5, cursor: "pointer", whiteSpace: "nowrap", borderBottom: `1px solid ${C.border}`, userSelect: "none", background: C.card }}>
                              {col.label} {holdingsSort.col === col.key ? (holdingsSort.dir === "desc" ? "▼" : "▲") : ""}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(r => (
                          <tr key={r.ticker} {...stockContextHandlers(r.ticker)} style={{ cursor: "pointer", borderBottom: `1px solid ${C.border}` }}>
                            <td style={{ padding: "10px 12px", fontWeight: 700, color: C.accent }}>{r.ticker}</td>
                            <td style={{ padding: "10px 12px", textAlign: "right", color: C.t2 }}>{r.shares.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                            <td style={{ padding: "10px 12px", textAlign: "right", color: C.t1, fontWeight: 600 }}>${r.price.toFixed(2)}</td>
                            <td style={{ padding: "10px 12px", textAlign: "right", color: r.dayChgPct >= 0 ? C.up : C.dn }}>{r.dayChgPct >= 0 ? "+" : ""}{r.dayChgPct.toFixed(2)}%</td>
                            <td style={{ padding: "10px 12px", textAlign: "right", color: C.t1, fontWeight: 600 }}>${r.mktValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                            <td style={{ padding: "10px 12px", textAlign: "right", color: C.t1 }}>{r.weight.toFixed(1)}%</td>
                            <td style={{ padding: "10px 12px", textAlign: "right", color: C.t3 }}>${r.avgCost.toFixed(2)}</td>
                            <td style={{ padding: "10px 12px", textAlign: "right", color: C.t3 }}>${r.costBasis.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                            <td style={{ padding: "10px 12px", textAlign: "right", color: r.gainLoss >= 0 ? C.up : C.dn, fontWeight: 600 }}>{r.gainLoss >= 0 ? "+$" : "-$"}{Math.abs(r.gainLoss).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                            <td style={{ padding: "10px 12px", textAlign: "right", color: r.gainLossPct >= 0 ? C.up : C.dn }}>{r.gainLossPct >= 0 ? "+" : ""}{r.gainLossPct.toFixed(1)}%</td>
                            <td style={{ padding: "10px 12px", textAlign: "right", color: C.t3, fontSize: 11, whiteSpace: "nowrap" }}>{r.initDate ? new Date(r.initDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }) : "—"}</td>
                          </tr>
                        ))}
                        <tr style={{ borderTop: `2px solid ${C.accent}44`, background: C.accentSoft }}>
                          <td style={{ padding: "10px 12px", fontWeight: 800, color: C.t1 }}>TOTALS</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: C.t4, fontSize: 11 }}>{rows.length}</td>
                          <td colSpan={2} />
                          <td style={{ padding: "10px 12px", textAlign: "right", color: C.t1, fontWeight: 800 }}>${totMktVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: C.t1 }}>100%</td>
                          <td />
                          <td style={{ padding: "10px 12px", textAlign: "right", color: C.t3 }}>${totCostBasis.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: totGainLoss >= 0 ? C.up : C.dn, fontWeight: 800 }}>{totGainLoss >= 0 ? "+$" : "-$"}{Math.abs(totGainLoss).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: totGainLossPct >= 0 ? C.up : C.dn, fontWeight: 800 }}>{totGainLossPct >= 0 ? "+" : ""}{totGainLossPct.toFixed(1)}%</td>
                          <td />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  </div>
                  );
                })()}
              </div>
              ); })()}

            {/* Chart view */}
            {perfView === "chart" && <>

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
              const useIntraday = perfRange === "1D" && intradayPortfolio[perfRange]?.length > 1;
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
                const rangeMap = { "1Y": 365, "3Y": 365*3, "5Y": 365*5, "10Y": 365*10 };
                const rangeDays = rangeMap[perfRange];
                let cutoff = rangeDays ? new Date(now.getTime() - rangeDays * 86400000).toISOString().slice(0,10) : null;
                if (perfRange === "1D") {
                  filtered = portfolio.slice(-2);
                } else if (perfRange === "QTD") {
                  const m = now.getMonth(); // 0-indexed
                  const qtrStartMonth = Math.floor(m / 3) * 3; // 0,3,6,9
                  const qtrStartDate = `${now.getFullYear()}-${String(qtrStartMonth + 1).padStart(2, "0")}-01`; // 1-indexed for date string
                  // Find last trading day before quarter start
                  const qtdStart = [...portfolio].reverse().find(p => p.date < qtrStartDate);
                  filtered = qtdStart ? portfolio.filter(p => p.date >= qtdStart.date) : portfolio;
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
              // For 1D, use liveValue.prevClose as base so chart matches the Day Change card
              const baseVal = (isIntraday && perfRange === "1D" && liveValue?.prevClose) ? liveValue.prevClose : filtered[0].value;
              const portNorm = filtered.map(p => ({ date: p.date, val: ((p.value / baseVal) - 1) * 100, raw: p.value }));

              // Normalize benchmarks to % change from portfolio start (base 0)
              const bmColors = { DVY: "#FF9800", SPY: "#6B8DE3", DIA: "#C76BDB", IUSG: "#4CAF50", QQQ: "#FF9800" };
              const bmNorm = {};
              if (isIntraday) {
                // Use intraday benchmark bars
                const ibm = intradayBenchmarks[perfRange] || {};
                Object.entries(ibm).forEach(([sym, pts]) => {
                  if (!perfBmToggles[sym] || !pts.length) return;
                  // For 1D, use previous close as base so % change matches actual daily return
                  let basePrice = (perfRange === "1D" && bmBars[sym]?.pc) ? bmBars[sym].pc : pts[0].close;
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
                // Find nearest price to portfolio start (forward first, then backward)
                const startDate = filtered[0].date;
                let basePrice = null;
                for (const [d, p] of prices) {
                  if (d >= startDate) { basePrice = p; break; }
                }
                if (!basePrice) {
                  // Fall back to nearest price before start date
                  for (let j = prices.length - 1; j >= 0; j--) {
                    if (prices[j][0] <= startDate) { basePrice = prices[j][1]; break; }
                  }
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
                // Append live/latest benchmark price
                {
                  const liveQ = bmQuotes[sym];
                  if (liveQ?.p && filtered.length > 0) {
                    const lastPortDate = filtered[filtered.length - 1].date;
                    bmPoints.push({ date: lastPortDate, val: ((liveQ.p / basePrice) - 1) * 100 });
                  }
                }
                if (bmPoints.length > 1) bmNorm[sym] = bmPoints;
              });

              // Chart dimensions
              const W = isDesktop ? 1200 : Math.min(window.innerWidth - 36, 900);
              const H = isDesktop ? 380 : 300;
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

              // Summary stats — for 1D use liveValue.prevClose for accurate % (matched stock universe)
              const startVal = (isIntraday && perfRange === "1D" && liveValue?.prevClose) ? liveValue.prevClose : filtered[0].value;
              const endVal = liveValue ? liveValue.value : filtered[filtered.length - 1].value;
              const totalReturn = (isIntraday && perfRange === "1D" && liveValue?.prevClose)
                ? ((endVal / liveValue.prevClose) - 1) * 100
                : ((endVal / startVal) - 1) * 100;
              const dollarChange = endVal - startVal;
              const years = isIntraday ? 0 : (new Date(filtered[filtered.length - 1].date) - new Date(filtered[0].date)) / (365.25 * 86400000);
              const cagr = years > 1 ? (Math.pow(endVal / startVal, 1 / years) - 1) * 100 : 0;

              const periodLabel = { "1D": "Day", "QTD": "QTD", "YTD": "YTD" }[perfRange];

              return (
                <>
                  {/* Summary cards */}
                  <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(4, 1fr)" : "repeat(4, 1fr)", gap: isDesktop ? 12 : 6, marginBottom: isDesktop ? 16 : 8 }}>
                    {[
                      { label: (isIntraday || perfRange === "YTD" || perfRange === "QTD") ? (perfRange === "1D" ? "Prev Close" : "Start") : "Start", value: `$${startVal.toLocaleString(undefined, {maximumFractionDigits: 0})}` },
                      { label: liveValue ? "Live" : "Current", value: `$${endVal.toLocaleString(undefined, {maximumFractionDigits: 0})}` },
                      { label: periodLabel ? `${periodLabel} Chg` : "Return", value: `${totalReturn >= 0 ? "+" : ""}${totalReturn.toFixed(2)}%`, color: totalReturn >= 0 ? C.up : C.dn },
                      (isIntraday || perfRange === "YTD" || perfRange === "QTD" || years <= 1)
                        ? { label: "$ Chg", value: `${dollarChange >= 0 ? "+$" : "-$"}${Math.abs(dollarChange).toLocaleString(undefined, {maximumFractionDigits: 0})}`, color: dollarChange >= 0 ? C.up : C.dn }
                        : { label: "CAGR", value: `${cagr >= 0 ? "+" : ""}${cagr.toFixed(2)}%`, color: cagr >= 0 ? C.up : C.dn },
                    ].map((s, i) => (
                      <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: isDesktop ? 14 : 10, padding: isDesktop ? "16px 18px" : "10px 8px" }}>
                        <div style={{ fontSize: isDesktop ? 11 : 9, fontWeight: 600, color: C.t4, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: isDesktop ? 6 : 3 }}>{s.label}</div>
                        <div style={{ fontSize: isDesktop ? 20 : 14, fontWeight: 800, color: s.color || C.t1, fontVariantNumeric: "tabular-nums" }}>{s.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Time range selector + benchmark toggles */}
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: isDesktop ? 12 : 6, marginBottom: isDesktop ? 16 : 8 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {["1D", "QTD", "YTD", "1Y", "3Y", "5Y", "10Y", "ALL"].filter(r => {
                        const isFCI = perfSleeve === "fci100" || perfSleeve === "fciValues";
                        if (isFCI) return r === "1D" || r === "ALL";
                        if (r === "1D" || r === "QTD" || r === "YTD" || r === "ALL") return true;
                        const daysAvailable = portfolio.length > 1 ? (new Date(portfolio[portfolio.length - 1].date) - new Date(portfolio[0].date)) / 86400000 : 0;
                        const need = { "1Y": 365, "3Y": 365*3, "5Y": 365*5, "10Y": 365*10 }[r] || 0;
                        return daysAvailable >= need * 0.9;
                      }).map(r => (
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
                      {Object.entries(bmColors).filter(([sym]) => sym in perfBmToggles).map(([sym, color]) => (
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
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.t2 }}>Paradiem {perfSleeve === "growth" ? "Growth" : "Dividend"} Strategy</span>
                    </div>
                    {Object.entries(bmColors).filter(([sym]) => sym in perfBmToggles).map(([sym, color]) => perfBmToggles[sym] && (
                      <div key={sym} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 20, height: 3, borderRadius: 2, background: color }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: C.t3 }}>{{ IWS: "iShares Mid-Cap Value", DVY: "iShares Dividend", SPY: "S&P 500", DIA: "Dow Jones", IUSG: "iShares Core Growth", QQQ: "Nasdaq 100" }[sym]}</span>
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
                    {" · "}{filtered.length} {isIntraday ? "1-min" : ""} data points
                    {liveValue ? " · Live" : ""}
                  </div>

                  {/* ── Trailing Total Returns ── */}
                  {(() => {
                    // Compute returns for various trailing periods from portfolio data
                    const end = portfolio[portfolio.length - 1];
                    if (!end) return null;
                    const endVal = end.value;
                    const endDate = new Date(end.date + "T12:00:00");

                    const daysAvailable = portfolio.length > 1 ? (new Date(portfolio[portfolio.length - 1].date + "T12:00:00") - new Date(portfolio[0].date + "T12:00:00")) / 86400000 : 0;
                    const allPeriods = [
                      { label: "1-Day", shortLabel: "1D", oneDay: true, rangeKey: "1D" },
                      { label: "QTD", shortLabel: "QTD", qtd: true, rangeKey: "QTD" },
                      { label: "YTD", shortLabel: "YTD", ytd: true, rangeKey: "YTD" },
                      { label: "1-Year", shortLabel: "1Y", days: 365, rangeKey: "1Y" },
                      { label: "3-Year", shortLabel: "3Y", days: 365 * 3, rangeKey: "3Y", ann: true },
                      { label: "5-Year", shortLabel: "5Y", days: 365 * 5, rangeKey: "5Y", ann: true },
                      { label: "10-Year", shortLabel: "10Y", days: 365 * 10, rangeKey: "10Y", ann: true },
                      { label: "Inception", shortLabel: "Incep.", all: true, rangeKey: "ALL" },
                    ];
                    const trailingPeriods = allPeriods.filter(p => {
                      if (p.oneDay || p.qtd || p.ytd || p.all) return true;
                      return daysAvailable >= p.days * 0.9;
                    });

                    const getReturn = (p) => {
                      if (p.oneDay) {
                        // Use prevClose as base, same as 1D chart
                        const base = liveValue?.prevClose;
                        if (!base || base <= 0) return null;
                        return ((endVal / base) - 1) * 100;
                      }
                      let startPt;
                      if (p.qtd) {
                        const m = now.getMonth();
                        const qm = Math.floor(m / 3) * 3;
                        const qtrStartDate = `${now.getFullYear()}-${String(qm + 1).padStart(2, "0")}-01`;
                        startPt = [...portfolio].reverse().find(pt => pt.date < qtrStartDate);
                      } else if (p.ytd) {
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
                      // Use live/latest benchmark price (bmQuotes has last trade even when closed)
                      const liveQ = bmQuotes[sym];
                      const lastPrice = (liveQ?.p > 0) ? liveQ.p : prices[prices.length - 1][1];
                      const lastDate = (liveQ?.p > 0) ? new Date() : new Date(prices[prices.length - 1][0] + "T12:00:00");
                      if (p.oneDay) {
                        // Use previous close — from bmBars if available, otherwise second-to-last historical price
                        let pc = bmBars[sym]?.pc;
                        if (!pc && prices.length >= 2) pc = prices[prices.length - 2][1];
                        if (!pc || pc <= 0 || lastPrice <= 0) return null;
                        return ((lastPrice / pc) - 1) * 100;
                      }
                      let startPrice;
                      if (p.qtd) {
                        const m = now.getMonth();
                        const qm = Math.floor(m / 3) * 3;
                        const qtrStartDate = `${now.getFullYear()}-${String(qm + 1).padStart(2, "0")}-01`;
                        const found = [...prices].reverse().find(([d]) => d < qtrStartDate);
                        startPrice = found ? found[1] : null;
                      } else if (p.ytd) {
                        const yearEnd = `${now.getFullYear() - 1}-12-31`;
                        const found = [...prices].reverse().find(([d]) => d <= yearEnd);
                        startPrice = found ? found[1] : null;
                      } else if (p.all) {
                        // Use benchmark price at portfolio start date, not first available
                        const portfolioStart = portfolio[0]?.date || prices[0][0];
                        const found = prices.find(([d]) => d >= portfolioStart);
                        startPrice = found ? found[1] : prices[0][1];
                      } else {
                        const cutoffDate = new Date(lastDate.getTime() - p.days * 86400000).toISOString().slice(0, 10);
                        const found = prices.find(([d]) => d >= cutoffDate);
                        startPrice = found ? found[1] : prices[0][1];
                      }
                      if (!startPrice || startPrice <= 0) return null;
                      const raw = (lastPrice / startPrice - 1) * 100;
                      if (p.ann) {
                        const bmStartDate = p.all ? (portfolio[0]?.date || prices[0][0]) : new Date(lastDate.getTime() - p.days * 86400000).toISOString().slice(0, 10);
                        const years = (lastDate - new Date(bmStartDate + "T12:00:00")) / (365.25 * 86400000);
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
                                  {trailingPeriods.map(p => {
                                    const isActive = p.rangeKey === perfRange;
                                    return (
                                      <th key={p.label} onClick={() => p.rangeKey && setPerfRange(p.rangeKey)} style={{
                                        padding: "10px 8px", textAlign: "right", fontWeight: isActive ? 800 : 600,
                                        color: isActive ? C.accent : C.t4, fontSize: 11, whiteSpace: "nowrap",
                                        background: isActive ? C.accentSoft : "transparent",
                                        cursor: p.rangeKey ? "pointer" : "default",
                                        borderBottom: isActive ? `2px solid ${C.accent}` : "none",
                                      }}>
                                        {isDesktop ? p.label : (p.shortLabel || p.label)}
                                      </th>
                                    );
                                  })}
                                </tr>
                              </thead>
                              <tbody>
                                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                                  <td style={{ padding: "10px 14px", fontWeight: 700, color: C.accent, fontSize: 12 }}>Total</td>
                                  {trailingPeriods.map(p => {
                                    const v = getReturn(p);
                                    const isActive = p.rangeKey === perfRange;
                                    return <td key={p.label} style={{ padding: "10px 8px", textAlign: "right", fontWeight: 700, color: pctColor(v), background: isActive ? C.accentSoft : "transparent" }}>{fmtPct(v)}</td>;
                                  })}
                                </tr>
                                {activeBms.map(sym => (
                                  <tr key={sym} style={{ borderBottom: `1px solid ${C.border}` }}>
                                    <td style={{ padding: "10px 14px", fontWeight: 600, color: bmColors[sym], fontSize: 12 }}>{sym}</td>
                                    {trailingPeriods.map(p => {
                                      const v = getBmReturn(sym, p);
                                      const isActive = p.rangeKey === perfRange;
                                      return <td key={p.label} style={{ padding: "10px 8px", textAlign: "right", fontWeight: 600, color: pctColor(v), background: isActive ? C.accentSoft : "transparent" }}>{fmtPct(v)}</td>;
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* ── Annual Return History (hidden for growth — only partial year) ── */}
                        {perfSleeve !== "growth" && (() => {
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
                                        <td style={{ padding: "10px 14px", fontWeight: 700, color: C.accent, fontSize: 12, position: "sticky", left: 0, background: C.card, zIndex: 1 }}>{perfSleeve === "growth" ? "Growth" : "Dividend"}</td>
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

            </>}
          </div>
        )}

        {/* ━━━ SETTINGS ━━━ */}
        {tab === "settings" && (
          <div style={{ animation: "fadeIn 0.3s ease", paddingTop: 20 }}>
            {!isDesktop && <div style={{ fontSize: 24, fontWeight: 800, color: C.t1, marginBottom: 20 }}>Settings</div>}
            <div style={{ display: isDesktop ? "grid" : "block", gridTemplateColumns: isDesktop ? "1fr 1fr" : undefined, gap: isDesktop ? 16 : 0 }}>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: "22px 20px", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginBottom: 6 }}>Appearance</div>
              <div style={{ fontSize: 11, color: C.t4, marginBottom: 10 }}>
                {localStorage.getItem("iown_theme_locked") ? `Locked to ${localStorage.getItem("iown_theme_locked")} mode` : "Auto: light during market hours, dark after close"}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {[{ v: "dark", l: "🌙 Dark" }, { v: "light", l: "☀️ Light" }, { v: "terminal", l: "💻 Terminal" }].map(({ v, l }) => (
                  <button key={v} onClick={() => toggleTheme(v)} style={{
                    flex: 1, padding: "10px 0", borderRadius: 10,
                    border: `1px solid ${theme === v ? C.borderActive : C.border}`,
                    background: theme === v ? C.accentSoft : "transparent",
                    color: theme === v ? C.t1 : C.t3, fontSize: 13, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>{l}</button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <button onClick={() => lockTheme(theme)} style={{
                  flex: 1, padding: "8px 0", borderRadius: 10,
                  border: `1px solid ${C.border}`, background: "transparent",
                  color: C.t3, fontSize: 12, fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit",
                }}>Set as Default</button>
                <button onClick={resetThemeAuto} style={{
                  flex: 1, padding: "8px 0", borderRadius: 10,
                  border: `1px solid ${localStorage.getItem("iown_theme_locked") ? C.border : C.borderActive}`,
                  background: localStorage.getItem("iown_theme_locked") ? "transparent" : C.accentSoft,
                  color: localStorage.getItem("iown_theme_locked") ? C.t3 : C.t1, fontSize: 12, fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit",
                }}>Auto</button>
              </div>
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.t2, marginBottom: 6 }}>Layout</div>
                <div style={{ fontSize: 11, color: C.t4, marginBottom: 8 }}>Terminal mode shows a multi-panel grid (desktop only)</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {[{ v: "classic", l: "Classic" }, { v: "terminal", l: "Terminal" }].map(({ v, l }) => (
                    <button key={v} onClick={() => { setLayoutMode(v); try { localStorage.setItem("iown_layout", v); } catch {} }} style={{
                      flex: 1, padding: "10px 0", borderRadius: 10,
                      border: `1px solid ${layoutMode === v ? C.borderActive : C.border}`,
                      background: layoutMode === v ? C.accentSoft : "transparent",
                      color: layoutMode === v ? C.t1 : C.t3, fontSize: 13, fontWeight: 700,
                      cursor: "pointer", fontFamily: "inherit",
                    }}>{l}</button>
                  ))}
                </div>
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
          { id: "morning", title: "Morning Brief", url: "https://richacarson.github.io/rich-report/morning-briefs.html", color: theme !== "light" ? "#F59E0B" : "#D97706" },
          { id: "commentary", title: "Market Commentary", url: "https://richacarson.github.io/iown-data", color: theme !== "light" ? "#34D399" : "#16A34A" },
          { id: "report", title: "The Rich Report", url: "https://richacarson.github.io/rich-report/The_Rich_Report.html", color: theme !== "light" ? "#6366F1" : "#4F46E5" },
          { id: "quarterly", title: "Quarterly Changes", url: "https://richacarson.github.io/rich-report/rebalance/q2-2026/client.html", color: theme !== "light" ? "#A78BFA" : "#7C3AED" },
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
              key={active.id}
              src={active.url}
              title={active.title}
              scrolling="yes"
              style={{ flex: 1, width: "100%", border: "none", display: "block", overflow: "auto" }}
              sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads"
            />
          </div>
        );
      })()}

      {/* SCREENER FULL-PAGE OVERLAY */}
      {tab === "screener" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: C.bg, display: "flex", flexDirection: "column", paddingTop: "env(safe-area-inset-top, 0px)" }}>
          {/* Detail overlay — layered on top, list stays mounted underneath */}
          {screenerDetail && (
          <div style={{ display: "flex", flexDirection: "column", position: "absolute", inset: 0, background: C.bg, zIndex: 1, paddingTop: "env(safe-area-inset-top, 0px)" }}>
          {(
            screenerDetailLoading ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
                <div style={{ width: 28, height: 28, border: `3px solid ${C.border}`, borderTopColor: C.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite", marginBottom: 12 }} />
                <div style={{ fontSize: 13, color: C.t4 }}>Loading report...</div>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
                  <button onClick={() => setScreenerDetail(null)} style={{ background: "none", border: "none", color: C.t1, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.t1} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                    Back
                  </button>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button onClick={() => { setChartSymbol(screenerDetail.ticker || screenerDetail.symbol); setProfileInitTab("chart"); }} style={{ background: C.accentSoft, border: `1px solid ${C.borderActive}`, borderRadius: 8, padding: "6px 14px", color: C.t1, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>View Chart</button>
                    <button onClick={() => {
                      const a = screenerDetail;
                      const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><style>body{font-family:Calibri,sans-serif;font-size:11pt;color:#191635;line-height:1.6}h1{font-size:24pt;margin:0}h2{font-size:14pt;color:#191635;border-bottom:2px solid #C9A015;padding-bottom:4px;margin:24px 0 12px}h3{font-size:12pt;margin:16px 0 4px}.meta{font-size:9pt;color:#6E6A82;text-transform:uppercase;letter-spacing:1px}.score{font-size:10pt;margin:4px 0 8px}.rec{display:inline-block;font-size:10pt;font-weight:bold;padding:2px 10px;border-radius:4px;background:#f0f0f0}.thesis{font-size:11pt;line-height:1.7;margin-bottom:12px}ol{margin:8px 0 16px 20px}ol li{margin-bottom:8px}.footer{text-align:center;font-size:8pt;color:#9E9AAE;margin-top:32px;border-top:1px solid #ddd;padding-top:12px}</style></head><body>`
                      + `<h1>${a.ticker} <span style="font-size:16pt;font-weight:normal;color:#6E6A82">${a.name || ""}</span></h1>`
                      + `<p class="meta">${a.sleeve || ""} SLEEVE · ${a.screen_date || ""}${a.faith_alignment?.inspire_impact_score != null ? ` · Inspire: ${a.faith_alignment.inspire_impact_score}` : ""}${a.infinite_game?.mindset ? ` · ${a.infinite_game.mindset}` : ""}</p>`
                      + `<p><span class="rec">${a.recommendation || ""}</span> <span style="font-size:24pt;font-weight:bold;margin-left:12px">${a.overall_score || ""}</span><span style="color:#9E9AAE"> / 100</span></p>`
                      + (a.profile ? `<h2>Company Profile</h2><p class="meta">${[a.profile.sector,a.profile.industry,a.profile.exchange,a.profile.country].filter(Boolean).join(" · ")}${a.profile.employees ? ` · ${Number(a.profile.employees).toLocaleString()} Employees` : ""}</p>${a.profile.description ? `<p class="thesis">${a.profile.description}</p>` : ""}` : "")
                      + (a.excellence_evaluation ? `<h2>Excellence Evaluation (50%)</h2>` + ["innovation","inspiration","infrastructure"].map(k => { const v = a.excellence_evaluation[k]; return v ? `<h3>${k.charAt(0).toUpperCase()+k.slice(1)} — ${v.score}/10 (${v.label || ""})</h3><p class="thesis">${v.analysis || ""}</p>` : ""; }).join("") : "")
                      + (a.infinite_game ? `<h2>Finite vs Infinite Game (25%)</h2><p><strong>Mindset:</strong> ${a.infinite_game.mindset} · <strong>Overall:</strong> ${a.infinite_game.overall}/10</p>${a.infinite_game.summary ? `<blockquote style="border-left:3px solid #ccc;padding-left:12px;font-style:italic;color:#3D3859">${a.infinite_game.summary}</blockquote>` : ""}` + ["just_cause","trusting_teams","worthy_rivals","existential_flexibility","courage_to_lead"].map(k => { const v = a.infinite_game[k]; return v ? `<h3>${k.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase())} — ${v.score}/10</h3><p class="thesis">${v.analysis || ""}</p>` : ""; }).join("") : "")
                      + (a.investment_thesis ? `<h2>Investment Thesis</h2><p class="thesis">${a.investment_thesis}</p>${a.thesis_continued ? `<p class="thesis">${a.thesis_continued}</p>` : ""}` : "")
                      + (a.key_catalysts?.length ? `<h2>Key Catalysts</h2><ol>${a.key_catalysts.map(c => `<li>${typeof c === "string" ? c : c.catalyst || c.description || ""}</li>`).join("")}</ol>` : "")
                      + (a.key_risks?.length ? `<h2>Key Risks</h2><ol>${a.key_risks.map(r => `<li>${typeof r === "string" ? r : r.risk || r.description || ""}</li>`).join("")}</ol>` : "")
                      + (a.ai_resilience ? `<h2>AI Resilience (25%)</h2><p class="score">${a.ai_resilience.score}/10 — ${a.ai_resilience.label || ""}</p><p class="thesis">${a.ai_resilience.analysis || ""}</p>` : "")
                      + (a.faith_alignment ? `<h2>Faith Alignment</h2><p>Inspire Impact Score: <strong style="font-size:18pt">${a.faith_alignment.inspire_impact_score}</strong></p>${a.faith_alignment.negative_attributions?.length ? `<p style="color:#DC2626">Negative: ${a.faith_alignment.negative_attributions.join(", ")}</p>` : ""}${a.faith_alignment.positive_attributions?.length ? `<p style="color:#16A34A">Positive: ${a.faith_alignment.positive_attributions.join(", ")}</p>` : ""}` : "")
                      + (a.sources?.length ? `<h2>Resources</h2><ol>${a.sources.map(s => `<li style="font-size:9pt">${typeof s === "string" ? s : s.title || ""}</li>`).join("")}</ol>` : "")
                      + `<p class="footer">Intentional Ownership · For Investment Committee Use Only · Not Investment Advice</p></body></html>`;
                      const blob = new Blob([html], { type: "application/msword" });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement("a"); link.href = url; link.download = `${a.ticker}_Paradiem_Report.doc`; link.click();
                      URL.revokeObjectURL(url);
                    }} style={{ background: C.accentSoft, border: `1px solid ${C.borderActive}`, borderRadius: 8, padding: "6px 14px", color: C.t1, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.t1} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      Download
                    </button>
                  </div>
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: "20px 18px", paddingBottom: 40 }}>
                  {(() => {
                    const a = screenerDetail;
                    const scoreColor = s => s >= 7 ? C.up : s >= 4 ? "#B8860B" : C.dn;
                    const scoreLabel = s => s >= 7 ? "green" : s >= 4 ? "gold" : "red";
                    const ScoreRow = ({ title, score, label, analysis }) => (
                      <div style={{ marginBottom: 20 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                          <span style={{ fontSize: 16, fontWeight: 800, color: C.t1 }}>{title}</span>
                          {label && <span style={{ fontSize: 11, fontWeight: 700, color: C.t3, letterSpacing: 1, textTransform: "uppercase" }}>{label}</span>}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <div style={{ flex: 1, height: 8, background: C.border + "40", borderRadius: 4, overflow: "hidden" }}>
                            <div style={{ width: `${score * 10}%`, height: "100%", borderRadius: 4, background: scoreColor(score) }} />
                          </div>
                          <span style={{ fontSize: 16, fontWeight: 800, minWidth: 20, textAlign: "right", color: scoreColor(score) }}>{score}</span>
                        </div>
                        {analysis && <div style={{ fontSize: 12, color: C.t2, lineHeight: 1.5 }}>{analysis}</div>}
                      </div>
                    );
                    const SectionHeader = ({ children, color }) => (
                      <div style={{ fontSize: 11, fontWeight: 800, color: C.t3, letterSpacing: 2, textTransform: "uppercase", margin: "32px 0 16px", paddingBottom: 4, borderBottom: `2px solid ${color || "#B8860B"}` }}>{children}</div>
                    );
                    const recColors = { BUY: { bg: "rgba(22,163,74,0.10)", fg: C.up }, HOLD: { bg: "rgba(217,119,6,0.10)", fg: "#D97706" }, SELL: { bg: "rgba(220,38,38,0.10)", fg: C.dn }, WATCH: { bg: "rgba(37,99,235,0.10)", fg: "#2563EB" } };
                    const rc = recColors[a.recommendation] || recColors.HOLD;

                    return (<>
                      {/* Header */}
                      <div style={{ marginBottom: 24 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                          <img src={`https://financialmodelingprep.com/image-stock/${a.ticker}.png`} alt="" style={{ width: 48, height: 48, borderRadius: 10, objectFit: "contain", background: "#fff", padding: 4, border: `1px solid ${C.border}` }} onError={(e) => { e.target.style.display = "none"; }} />
                          <div style={{ fontSize: 36, fontWeight: 800, color: C.t1, letterSpacing: -0.5, lineHeight: 1.1 }}>
                            {a.ticker} <span style={{ fontSize: 20, fontWeight: 400, color: C.t3 }}>{a.name}</span>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8, fontSize: 12, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: 0.5, flexWrap: "wrap" }}>
                          <span>{a.sleeve?.toUpperCase()} SLEEVE</span>
                          <span style={{ color: C.border }}>·</span>
                          <span>{a.screen_date}</span>
                          {a.faith_alignment?.inspire_impact_score != null && <><span style={{ color: C.border }}>·</span><span style={{ color: a.faith_alignment.inspire_impact_score < 0 ? C.dn : "#B8860B" }}>Inspire: {a.faith_alignment.inspire_impact_score}</span></>}
                          {a.infinite_game?.mindset && <><span style={{ color: C.border }}>·</span><span style={{ color: "#B8860B" }}>{a.infinite_game.mindset}</span></>}
                        </div>
                        <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ display: "inline-block", fontSize: 13, fontWeight: 800, padding: "4px 14px", borderRadius: 8, letterSpacing: 1, textTransform: "uppercase", background: rc.bg, color: rc.fg }}>{a.recommendation}</span>
                          <div><span style={{ fontSize: 48, fontWeight: 800, color: C.t1, lineHeight: 1 }}>{a.overall_score}</span><span style={{ fontSize: 18, fontWeight: 400, color: C.t4 }}> / 100</span></div>
                        </div>
                      </div>

                      {/* Company Profile */}
                      {a.profile && (<>
                        <SectionHeader>Company Profile</SectionHeader>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: 0.5, flexWrap: "wrap" }}>
                          {a.profile.sector && <span>{a.profile.sector}</span>}
                          {a.profile.industry && <><span style={{ color: C.border }}>·</span><span>{a.profile.industry}</span></>}
                          {a.profile.exchange && <><span style={{ color: C.border }}>·</span><span>{a.profile.exchange}</span></>}
                          {a.profile.country && <><span style={{ color: C.border }}>·</span><span>{a.profile.country}</span></>}
                        </div>
                        {a.profile.description && <div style={{ fontSize: 13, color: C.t2, lineHeight: 1.7, marginTop: 12 }}>{a.profile.description}</div>}
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10, fontSize: 12, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: 0.5 }}>
                          {a.profile.employees && <span>{Number(a.profile.employees).toLocaleString()} Employees</span>}
                          {a.profile.website && <><span style={{ color: C.border }}>·</span><span style={{ color: C.accent }}>{a.profile.website.replace(/https?:\/\//, "")}</span></>}
                        </div>
                      </>)}

                      {/* Excellence Evaluation */}
                      {a.excellence_evaluation && (<>
                        <SectionHeader color={C.up}>Excellence Evaluation — Think Like an Owner (50%)</SectionHeader>
                        <ScoreRow title="Innovation" score={a.excellence_evaluation.innovation?.score} label={a.excellence_evaluation.innovation?.label} analysis={a.excellence_evaluation.innovation?.analysis} />
                        <ScoreRow title="Inspiration" score={a.excellence_evaluation.inspiration?.score} label={a.excellence_evaluation.inspiration?.label} analysis={a.excellence_evaluation.inspiration?.analysis} />
                        <ScoreRow title="Infrastructure" score={a.excellence_evaluation.infrastructure?.score} label={a.excellence_evaluation.infrastructure?.label} analysis={a.excellence_evaluation.infrastructure?.analysis} />
                      </>)}

                      {/* Infinite Game */}
                      {a.infinite_game && (<>
                        <SectionHeader color={C.up}>Finite vs Infinite Game — Sinek (25%)</SectionHeader>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 12 }}>
                          <span style={{ fontSize: 14, color: C.t2 }}>Mindset:</span>
                          <span style={{ fontSize: 14, fontWeight: 800, color: "#B8860B", textTransform: "uppercase" }}>{a.infinite_game.mindset}</span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: C.t2 }}>Overall: <span style={{ fontSize: 20, fontWeight: 800, color: C.t1 }}>{a.infinite_game.overall}</span> /10</span>
                        </div>
                        {a.infinite_game.summary && <div style={{ borderLeft: `3px solid ${C.border}`, paddingLeft: 16, margin: "12px 0 20px", fontSize: 12, fontStyle: "italic", color: C.t2, lineHeight: 1.6 }}>{a.infinite_game.summary}</div>}
                        {a.infinite_game.just_cause && <ScoreRow title="Just Cause" score={a.infinite_game.just_cause.score} analysis={a.infinite_game.just_cause.analysis} />}
                        {a.infinite_game.trusting_teams && <ScoreRow title="Trusting Teams" score={a.infinite_game.trusting_teams.score} analysis={a.infinite_game.trusting_teams.analysis} />}
                        {a.infinite_game.worthy_rivals && <ScoreRow title="Worthy Rivals" score={a.infinite_game.worthy_rivals.score} analysis={a.infinite_game.worthy_rivals.analysis} />}
                        {a.infinite_game.existential_flexibility && <ScoreRow title="Existential Flexibility" score={a.infinite_game.existential_flexibility.score} analysis={a.infinite_game.existential_flexibility.analysis} />}
                        {a.infinite_game.courage_to_lead && <ScoreRow title="Courage to Lead" score={a.infinite_game.courage_to_lead.score} analysis={a.infinite_game.courage_to_lead.analysis} />}
                      </>)}

                      {/* Investment Thesis */}
                      {(a.investment_thesis || a.thesis_continued) && (<>
                        <SectionHeader>Investment Thesis</SectionHeader>
                        {a.investment_thesis && <div style={{ fontSize: 13, color: C.t2, lineHeight: 1.7, marginBottom: 16 }}>{a.investment_thesis}</div>}
                        {a.thesis_continued && <div style={{ fontSize: 13, color: C.t2, lineHeight: 1.7, marginBottom: 16 }}>{a.thesis_continued}</div>}
                      </>)}

                      {/* Key Catalysts */}
                      {a.key_catalysts?.length > 0 && (<>
                        <SectionHeader color={C.up}>Key Catalysts</SectionHeader>
                        <ol style={{ margin: "8px 0", paddingLeft: 28 }}>
                          {a.key_catalysts.map((c, i) => <li key={i} style={{ fontSize: 13, color: C.t2, lineHeight: 1.6, marginBottom: 10 }}>{typeof c === "string" ? c : c.catalyst || c.description || JSON.stringify(c)}</li>)}
                        </ol>
                      </>)}

                      {/* Key Risks */}
                      {a.key_risks?.length > 0 && (<>
                        <SectionHeader color={C.dn}>Key Risks</SectionHeader>
                        <ol style={{ margin: "8px 0", paddingLeft: 28 }}>
                          {a.key_risks.map((r, i) => <li key={i} style={{ fontSize: 13, color: C.t2, lineHeight: 1.6, marginBottom: 10 }}>{typeof r === "string" ? r : r.risk || r.description || JSON.stringify(r)}</li>)}
                        </ol>
                      </>)}

                      {/* AI Resilience */}
                      {a.ai_resilience && (<>
                        <SectionHeader>AI Resilience (25%)</SectionHeader>
                        <ScoreRow title="AI Resilience" score={a.ai_resilience.score} label={a.ai_resilience.label} analysis={a.ai_resilience.analysis} />
                      </>)}

                      {/* Faith Alignment / Inspire Impact */}
                      {a.faith_alignment && (<>
                        <SectionHeader color={C.dn}>Faith Alignment — Inspire Insight</SectionHeader>
                        <div style={{ marginBottom: 12 }}>
                          <span style={{ fontSize: 14, color: C.t2 }}>Inspire Impact Score: </span>
                          <span style={{ fontSize: 28, fontWeight: 800, color: a.faith_alignment.inspire_impact_score >= 0 ? C.up : C.dn }}>{a.faith_alignment.inspire_impact_score}</span>
                        </div>
                        {a.faith_alignment.negative_attributions?.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center", margin: "10px 0 6px" }}>
                            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: C.dn, marginRight: 4 }}>Negative:</span>
                            {a.faith_alignment.negative_attributions.map((attr, i) => <span key={i} style={{ fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 8, background: "rgba(220,38,38,0.08)", color: C.dn }}>{attr}</span>)}
                          </div>
                        )}
                        {a.faith_alignment.positive_attributions?.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center", margin: "10px 0 6px" }}>
                            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: C.up, marginRight: 4 }}>Positive:</span>
                            {a.faith_alignment.positive_attributions.map((attr, i) => <span key={i} style={{ fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 8, background: "rgba(22,163,74,0.08)", color: C.up }}>{attr}</span>)}
                          </div>
                        )}
                        {a.faith_alignment.source && <div style={{ fontSize: 10, color: C.t4, marginTop: 8 }}>Source: {a.faith_alignment.source}</div>}
                      </>)}

                      {/* Sources */}
                      {a.sources?.length > 0 && (<>
                        <SectionHeader>Resources</SectionHeader>
                        <ol style={{ margin: "8px 0", paddingLeft: 28, listStyle: "none", counterReset: "src" }}>
                          {a.sources.map((s, i) => <li key={i} style={{ fontSize: 11, color: C.t2, lineHeight: 1.5, marginBottom: 8, counterIncrement: "src", position: "relative", paddingLeft: 0 }}><span style={{ fontWeight: 800, fontSize: 10, color: C.accent, marginRight: 8 }}>{i + 1}.</span>{typeof s === "string" ? s : s.title || s.source || JSON.stringify(s)}</li>)}
                        </ol>
                      </>)}

                      <div style={{ textAlign: "center", fontSize: 10, color: C.t4, letterSpacing: 0.5, textTransform: "uppercase", marginTop: 40, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>Intentional Ownership · For Investment Committee Use Only · Not Investment Advice</div>
                    </>);
                  })()}
                </div>
              </>
            )
          )}
          </div>
          )}
          {/* List view — always rendered to preserve scroll position */}
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
                <button onClick={() => setTab("home")} style={{ background: "none", border: "none", color: C.t1, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.t1} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                  Back
                </button>
                <span style={{ fontSize: 15, fontWeight: 700, color: C.t1 }}>Stock Screener</span>
                <div style={{ width: 50 }} />
              </div>
              {/* Sub-tabs */}
              <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${C.border}`, flexShrink: 0, overflowX: "auto" }}>
                {["Dividend", "Growth", "FCI 100", "FCI Values", "All"].map(s => (
                  <button key={s} onClick={() => setScreenerSleeve(s)} style={{ flex: "0 0 auto", padding: "10px 14px", background: screenerSleeve === s ? C.accentSoft : "transparent", border: "none", borderBottom: screenerSleeve === s ? `2px solid ${C.accent}` : "2px solid transparent", color: screenerSleeve === s ? C.t1 : C.t3, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>{s}</button>
                ))}
              </div>
              {/* Search + filters */}
              <div style={{ padding: "10px 16px", flexShrink: 0 }}>
                <input value={screenerSearch} onChange={e => setScreenerSearch(e.target.value)} placeholder="Search ticker or company..." style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, color: C.t1, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
                {screenerSleeve === "All" && (
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <select value={screenerTypeFilter} onChange={e => setScreenerTypeFilter(e.target.value)} style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface, color: C.t1, fontSize: 12, fontWeight: 600, fontFamily: "inherit", outline: "none", appearance: "auto" }}>
                      <option value="All">All Types</option>
                      <option value="Dividend">Dividend Candidates</option>
                      <option value="Growth">Growth Candidates</option>
                    </select>
                    <select value={screenerRecFilter} onChange={e => setScreenerRecFilter(e.target.value)} style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface, color: C.t1, fontSize: 12, fontWeight: 600, fontFamily: "inherit", outline: "none", appearance: "auto" }}>
                      <option value="All">All Ratings</option>
                      <option value="BUY">BUY Only</option>
                      <option value="HOLD">HOLD Only</option>
                      <option value="WATCH">WATCH Only</option>
                      <option value="SELL">SELL Only</option>
                    </select>
                  </div>
                )}
              </div>
              {/* List */}
              {(() => {
                const ITEM_H = 68;
                return (
              <div ref={screenerListRef} onScroll={e => setScrScrollTop(e.target.scrollTop)} style={{ flex: 1, overflowY: "auto", padding: "0 16px 40px" }}>
                {!screenerData.length ? (
                  <div style={{ textAlign: "center", padding: 40 }}>
                    <div style={{ width: 28, height: 28, border: `3px solid ${C.border}`, borderTopColor: C.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
                    <div style={{ fontSize: 13, color: C.t4 }}>Loading screener data...</div>
                  </div>
                ) : (() => {
                  const q = screenerSearch.toLowerCase();
                  const portfolioMap = { "Dividend": sleeves.dividend?.symbols || [], "Growth": sleeves.growth?.symbols || [], "FCI 100": sleeves.fci100?.symbols || [], "FCI Values": sleeves.fciValues?.symbols || [] };
                  const filtered = screenerData.filter(s => {
                    if (screenerSleeve !== "All") {
                      const holdings = portfolioMap[screenerSleeve];
                      if (!holdings || !holdings.includes(s.ticker)) return false;
                    }
                    if (screenerSleeve === "All" && screenerTypeFilter !== "All" && s.sleeve !== screenerTypeFilter) return false;
                    if (screenerSleeve === "All" && screenerRecFilter !== "All" && s.recommendation !== screenerRecFilter) return false;
                    if (q && !s.ticker.toLowerCase().includes(q) && !(s.name || "").toLowerCase().includes(q)) return false;
                    return true;
                  }).sort((a, b) => (b.overall_score || 0) - (a.overall_score || 0) || (a.ticker || "").localeCompare(b.ticker || ""));
                  if (filtered.length === 0) return <div style={{ textAlign: "center", padding: 40, color: C.t4, fontSize: 13 }}>No stocks match your search</div>;
                  const viewH = screenerListRef.current?.clientHeight || 800;
                  const startIdx = Math.max(0, Math.floor(scrScrollTop / ITEM_H) - 5);
                  const endIdx = Math.min(filtered.length, Math.ceil((scrScrollTop + viewH) / ITEM_H) + 5);
                  return (
                    <div style={{ height: filtered.length * ITEM_H, position: "relative" }}>
                      {filtered.slice(startIdx, endIdx).map((s, i) => (
                        <div key={s.ticker} onClick={() => { setScreenerDetailLoading(true); setScreenerDetail(s); fetch(`https://richacarson.github.io/Stock-Screener/reports/${s.ticker}.json`).then(r => r.ok ? r.json() : s).then(d => { setScreenerDetail(d); setScreenerDetailLoading(false); if (d.screen_date && d.screen_date !== s.screen_date) setScreenerData(prev => prev.map(x => x.ticker === s.ticker ? { ...x, screen_date: d.screen_date, overall_score: d.overall_score ?? x.overall_score, recommendation: d.recommendation ?? x.recommendation } : x)); }).catch(() => { setScreenerDetail(s); setScreenerDetailLoading(false); }); }} style={{ position: "absolute", top: (startIdx + i) * ITEM_H, left: 0, right: 0, height: ITEM_H - 8, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, cursor: "pointer" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>{s.ticker}</div>
                        <div style={{ fontSize: 11, color: C.t3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
                        {s.screen_date && <div style={{ fontSize: 10, color: C.t4, marginTop: 2 }}>{s.screen_date}</div>}
                      </div>
                      {s.recommendation && <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 16, marginRight: 10, background: ({"BUY": C.upSoft, "HOLD": "#D9760620", "WATCH": "#2563EB20", "SELL": C.dnSoft})[s.recommendation] || C.accentSoft, color: ({"BUY": C.up, "HOLD": "#D97706", "WATCH": "#2563EB", "SELL": C.dn})[s.recommendation] || C.t2 }}>{s.recommendation}</span>}
                      {s.overall_score != null && <div style={{ fontSize: 18, fontWeight: 800, color: C.t1, minWidth: 36, textAlign: "right" }}>{s.overall_score}</div>}
                    </div>
                  ))}
                    </div>
                  );
                })()}
              </div>
                );
              })()}
            </>
        </div>
      )}

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
        background: theme !== "light" ? "rgba(20,16,51,0.92)" : "rgba(242,241,235,0.94)",
        backdropFilter: "blur(28px) saturate(1.4)", WebkitBackdropFilter: "blur(28px) saturate(1.4)",
        borderTop: `2px solid ${C.accent}`, display: "flex", justifyContent: "space-around",
        padding: "6px 0", paddingBottom: "calc(env(safe-area-inset-bottom, 8px) + 6px)",
        boxShadow: theme !== "light" ? "0 -4px 20px rgba(0,0,0,0.3)" : "0 -2px 12px rgba(25,22,53,0.08)",
      }}>
        {["home", "performance", "charts", "briefs", "metrics"].map(id => navItems.find(t => t.id === id)).filter(Boolean).map(t => (
          <button key={t.id} onClick={() => { handleTabTap(t.id); setMoreMenu(false); }} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            padding: "6px 12px", background: "transparent", border: "none", cursor: "pointer",
          }}>
            {t.icon(tab === t.id, theme === "light")}
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.3, color: tab === t.id ? (theme === "light" ? C.t1 : C.navText) : (theme === "light" ? C.t4 : C.navTextMuted) }}>{t.label}</span>
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
            background: C.nav, borderRight: `1px solid ${C.navBorder}`,
            display: "flex", flexDirection: "column",
            paddingTop: "calc(env(safe-area-inset-top, 20px) + 16px)",
            animation: "slideInLeft 0.25s cubic-bezier(0.16,1,0.3,1)",
          }}>
            <style>{`@keyframes slideInLeft { from { transform: translateX(-100%); } to { transform: translateX(0); } }`}</style>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px 16px", borderBottom: `1px solid ${C.navBorder}` }}>
              <img src="paradiem-logo-dark.png?v=6" alt="Paradiem" style={{ height: 36 }} />
              <button onClick={() => setMoreMenu(false)} style={{
                width: 32, height: 32, borderRadius: 16, background: C.navTextMuted + "30",
                border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.navTextDim} strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <nav style={{ flex: 1, padding: "12px 0", overflowY: "auto" }}>
              {navItems.map(t => (
                <button key={t.id} onClick={() => { handleTabTap(t.id); setMoreMenu(false); }} style={{
                  display: "flex", alignItems: "center", gap: 14, width: "100%",
                  padding: "14px 24px", background: tab === t.id ? C.navAccentSoft : "transparent",
                  border: "none", borderLeft: tab === t.id ? `3px solid ${C.accent}` : "3px solid transparent",
                  cursor: "pointer", transition: "all 0.15s", fontFamily: "inherit",
                }}>
                  {t.icon(tab === t.id)}
                  <span style={{ fontSize: 14, fontWeight: tab === t.id ? 700 : 500, color: tab === t.id ? C.navText : C.navTextDim }}>{t.label}</span>
                </button>
              ))}
            </nav>
            <div style={{ padding: "16px 24px", borderTop: `1px solid ${C.navBorder}`, paddingBottom: "calc(env(safe-area-inset-bottom, 16px) + 16px)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: marketStatus.color, boxShadow: `0 0 6px ${marketStatus.color}66` }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: C.navTextDim }}>{marketStatus.label}</span>
              </div>
              <div style={{ fontSize: 11, color: C.navTextMuted }}>{lastUp ? `Updated ${lastUp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}</div>
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

      {chartSymbol && <StockProfile symbol={chartSymbol} initTab={profileInitTab} onClose={() => { setChartSymbol(null); setProfileInitTab("overview"); }} onViewReport={(sym) => { setChartSymbol(null); setProfileInitTab("overview"); setScreenerDetail({ ticker: sym, _loading: true }); setScreenerDetailLoading(true); setTab("screener"); fetch(`https://richacarson.github.io/Stock-Screener/reports/${sym}.json`).then(r => r.ok ? r.json() : { ticker: sym }).then(d => { setScreenerDetail(d); setScreenerDetailLoading(false); }).catch(() => { setScreenerDetail({ ticker: sym }); setScreenerDetailLoading(false); }); }} hdrs={hdrs} names={names} theme={theme} quotesRef={quotesRef} barsRef={barsRef} fundamentals={fundamentals} news={[...news, ...broadNews]} coreSyms={coreSyms} />}
      <GS theme={theme} />
    </div>
  );
}

function GS({ theme }) {
  const isDark = theme !== "light";
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
      input::placeholder { color: ${isDark ? "#4A4338" : "#9E9AAE"} !important; }
      input:focus { border-color: rgba(${isDark ? "252,212,50" : "25,22,53"},0.30) !important; }
      ::-webkit-scrollbar { width: 10px; height: 8px; }
      ::-webkit-scrollbar-track { background: ${isDark ? "rgba(20,16,48,0.3)" : "rgba(25,22,53,0.06)"}; border-radius: 10px; }
      ::-webkit-scrollbar-thumb { background: rgba(${isDark ? "252,212,50,0.30" : "25,22,53,0.25"}); border-radius: 10px; min-height: 40px; }
      ::-webkit-scrollbar-thumb:hover { background: rgba(${isDark ? "252,212,50,0.50" : "25,22,53,0.40"}); }
      body { background: ${isDark ? "#0B0820" : "#EAE9E2"}; overscroll-behavior-x: none; scrollbar-width: auto; scrollbar-color: rgba(${isDark ? "252,212,50,0.30" : "25,22,53,0.25"}) ${isDark ? "rgba(20,16,48,0.3)" : "rgba(25,22,53,0.06)"}; }
      #root { user-select: none; -webkit-user-select: none; }
      input, textarea, [contenteditable] { user-select: text; -webkit-user-select: text; }
      .ticker-row { transition: transform 0.15s cubic-bezier(0.16,1,0.3,1), opacity 0.15s; }
      .ticker-row:active { transform: scale(0.97); opacity: 0.85; }
      @media (min-width: 768px) {
        .tradingview-widget-container { min-height: 500px; }
        tr:hover td { background: rgba(${isDark ? "252,212,50,0.05" : "25,22,53,0.04"}) !important; }
        button:hover { opacity: 0.85; }
      }
    `}</style>
  );
}
