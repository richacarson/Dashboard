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
const CORE_KEYS = ["dividend", "growth", "digital", "sectors", "fci100", "fciValues"];
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
// Right-rail benchmark indices (BTC-USD omitted — not available via the Alpaca stock snapshot feed)
const RAIL_BENCHMARKS = ["DVY", "IUSG", "SPY"];
// Short sector codes for the dense terminal watchlist (sector subline)
const SECTOR_SHORT = {
  "Information Technology": "TECH", "Technology": "TECH",
  "Health Care": "HEALTH", "Healthcare": "HEALTH",
  "Financials": "FIN", "Financial Services": "FIN", "Financial": "FIN",
  "Industrials": "INDUST", "Industrial": "INDUST",
  "Consumer Discretionary": "CYCL", "Consumer Cyclical": "CYCL",
  "Communication Services": "COMM", "Communication": "COMM", "Telecommunications": "COMM",
  "Consumer Staples": "STAPLE", "Consumer Defensive": "STAPLE",
  "Energy": "ENERGY", "Oil & Gas": "ENERGY",
  "Utilities": "UTIL",
  "Materials": "MTRL", "Basic Materials": "MTRL",
  "Real Estate": "REIT",
  "Digital Assets": "CRYPTO", "Crypto": "CRYPTO",
};
const shortSector = (s) => s ? (SECTOR_SHORT[s] || s.split(/[\s/]/)[0].slice(0, 6).toUpperCase()) : "";
const RAIL_BM_EXTRA = RAIL_BENCHMARKS.filter(s => !BM_SYMS.includes(s));
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
  if (mins < 570) return { status: "premarket", label: "Pre-Market", color: C.warn }; // 4am-9:30am
  if (mins < 960) return { status: "open", label: "Open", color: "#34D399" }; // 9:30am-4pm
  if (mins < 1200) return { status: "afterhours", label: "After Hours", color: C.warn }; // 4pm-8pm
  return { status: "closed", label: "Closed", color: "#F87171" }; // after 8pm
}

const DARK = {
  bg: "#171738", surface: "#1F1F45", card: "#252551", cardHover: "#2F2F5F", elevated: "#38386B",
  border: "rgba(201,168,76,0.12)", borderHover: "rgba(201,168,76,0.24)", borderActive: "rgba(201,168,76,0.40)",
  t1: "#FAF7F2", t2: "#F4EFE4", t3: "#B8B4AC", t4: "#8B7355",
  up: "#34D399", upSoft: "#34D39920", upGlow: "#34D39940",
  dn: "#F87171", dnSoft: "#F8717120", dnGlow: "#F8717140",
  accent: "#C9A84C", accentSoft: "rgba(201,168,76,0.12)", accentGlow: "rgba(201,168,76,0.30)",
  warn: "#D9A441",
  nav: "#171738", navText: "#FAF7F2", navTextDim: "#B8B4AC", navTextMuted: "#8B7355",
  navBorder: "rgba(201,168,76,0.12)", navAccentSoft: "rgba(201,168,76,0.14)",
  shadow: "0 2px 8px rgba(23,23,56,0.35)",
};
const LIGHT = {
  bg: "#F4EFE4", surface: "#FAF7F2", card: "#FAF7F2", cardHover: "#EBE6DA", elevated: "#FAF7F2",
  border: "rgba(139,115,85,0.18)", borderHover: "rgba(139,115,85,0.30)", borderActive: "rgba(139,115,85,0.50)",
  t1: "#171738", t2: "#1C1713", t3: "#8B7355", t4: "#B8B4AC",
  up: "#16A34A", upSoft: "#16A34A18", upGlow: "#16A34A30",
  dn: "#DC2626", dnSoft: "#DC262618", dnGlow: "#DC262630",
  accent: "#C9A84C", accentSoft: "rgba(201,168,76,0.12)", accentGlow: "rgba(201,168,76,0.24)",
  warn: "#B45309",
  nav: "#171738", navText: "#FAF7F2", navTextDim: "#B8B4AC", navTextMuted: "#8B7355",
  navBorder: "rgba(250,247,242,0.10)", navAccentSoft: "rgba(201,168,76,0.18)",
  shadow: "0 1px 3px rgba(23,23,56,0.08), 0 1px 2px rgba(23,23,56,0.04)",
};
const TERMINAL = {
  bg: "#020208", surface: "#070714", card: "#0C0C1E", cardHover: "#15152F", elevated: "#1C1C3D",
  border: "rgba(201,168,76,0.14)", borderHover: "rgba(201,168,76,0.24)", borderActive: "rgba(201,168,76,0.50)",
  t1: "#FAF7F2", t2: "#F4EFE4", t3: "#B8B4AC", t4: "#8B7355",
  up: "#34D399", upSoft: "#34D39920", upGlow: "#34D39940",
  dn: "#F87171", dnSoft: "#F8717120", dnGlow: "#F8717140",
  accent: "#C9A84C", accentSoft: "rgba(201,168,76,0.14)", accentGlow: "rgba(201,168,76,0.32)",
  warn: "#D9A441",
  nav: "#020208", navText: "#FAF7F2", navTextDim: "#B8B4AC", navTextMuted: "#8B7355",
  navBorder: "rgba(201,168,76,0.14)", navAccentSoft: "rgba(201,168,76,0.14)",
  shadow: "0 2px 8px rgba(0,0,0,0.50)",
  isTerminal: true,
};
/* ── Benchmark overlay colors (muted, brand-adjacent) ── */
const BM_COLORS = { SPY: "#8FA3D9", QQQ: "#B08BD0", DIA: "#C98B6B", DVY: "#D9A441", IUSG: "#7FAE9B" };

/* ── Playbook historical data (shared by classic tab + terminal drawer) ── */
const PB_BEAR_MARKETS = [
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
const PB_BULL_MARKETS_BASE = [
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
];
const PB_BEAR_TRANCHES = [
  { drawdownTrigger: -25, pctReserves: 70, action: "Deploy 70% of reserves", deploy: "87% of bears reach — highest expected-value tranche" },
  { drawdownTrigger: -40, pctReserves: 100, action: "Deploy remaining reserves", deploy: "32% of bears reach — deep value, +67% recovery return" },
];
let C = DARK;

/* ── Portfolio Heatmap ── */
function Heatmap({ sleeves, chgFn, namesFn, onTap, onContext }) {
  const [cols, setCols] = useState(() => typeof window !== "undefined" && window.innerWidth >= 768 ? 10 : 5);
  useEffect(() => {
    const onResize = () => setCols(window.innerWidth >= 768 ? 10 : 5);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
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
  // Cap at 50 cells (e.g. 5×10 or 10×5)
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
      gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
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

/* ──────────────────────────────────────────────────────────────────
   TradingView Advanced Chart Widget — full drawing tools (boxes, fib,
   trend lines, etc.). Uses the official embed-widget-advanced-chart.js
   script instead of the basic widgetembed iframe which strips tools.
   ────────────────────────────────────────────────────────────────── */
const TradingViewChart = memo(function TradingViewChart({ symbol, theme: chartTheme, bg, toolbarBg, style: chartStyle = "1" }) {
  // Direct iframe to TradingView's hosted widget — known to render reliably.
  // hidesidetoolbar=0 exposes the left drawing-tool panel (trend lines, fib,
  // boxes, channels). The advanced-chart script embed approach (srcDoc or
  // dynamic <script> injection) had document.currentScript issues that
  // resulted in black panes; this simple iframe just works.
  const tvTheme = chartTheme === "light" ? "light" : "dark";
  const url = `https://s.tradingview.com/widgetembed/?frameElementId=tv_chart&symbol=${encodeURIComponent(symbol)}&interval=D&hidesidetoolbar=0&symboledit=0&saveimage=0&hideideas=1&hidetrading=1&theme=${tvTheme}&style=${chartStyle}&timezone=America%2FNew_York&withdateranges=1&showpopupbutton=0&locale=en${bg ? `&backgroundColor=%23${bg}` : ""}${toolbarBg ? `&toolbar_bg=%23${toolbarBg}` : ""}`;
  return <iframe key={`${symbol}-${tvTheme}`} src={url} style={{ width: "100%", height: "100%", border: "none", display: "block", background: bg ? `#${bg}` : undefined }} title={`Chart: ${symbol}`} />;
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

/* Bear-probability model — applies the trained logistic-regression
   coefficients from the backtest to current macro data. Returns
   { raw, calibrated } as 0-1 fractions, or null if model/data unavailable. */
function bearModelProbability(md, backtest) {
  const lrModel = backtest?.logistic_regression;
  if (!lrModel) return null;
  const yc = (md.yield10Y != null && md.yield3M != null) ? md.yield10Y - md.yield3M : null;
  const inputs = [yc, md.claimsTrend, md.baa10y, md.nfci,
    md.cfnai3mo != null ? md.cfnai3mo : md.cfnai, md.sahmVal, md.oilYoY];
  if (!inputs.every(v => v != null && !isNaN(v))) return null;
  const z = inputs.map((v, i) => (v - lrModel.means[i]) / lrModel.stds[i]);
  const logit = lrModel.intercept + z.reduce((s, v, i) => s + lrModel.coefficients[i] * v, 0);
  const raw = 1 / (1 + Math.exp(-logit));
  let calibrated = raw;
  if (lrModel.buckets) {
    const pct = raw * 100;
    const b = lrModel.buckets.find(bk => pct >= bk.lo && pct < bk.hi);
    if (b && b.n >= 10) calibrated = b.rate / 100;
  }
  return { raw, calibrated };
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
  const [dividendHistory, setDividendHistory] = useState({}); // { SYM: { yearsPaid, yearsGrown, _ts } } — dividend sleeve only
  const [loading, setLoading] = useState(false);
  const [lastUp, setLastUp] = useState(null);
  const lastUpRef = useRef(null);
  const [tab, setTab] = useState("home");
  const [moreMenu, setMoreMenu] = useState(false);
  const [researchReports, setResearchReports] = useState([]);
  const [researchView, setResearchView] = useState(null); // null = list, or report id
  const [researchContent, setResearchContent] = useState("");
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
  const [tProfileSym, setTProfileSym] = useState(null); // terminal stock profile panel
  const [tProfileTab, setTProfileTab] = useState("overview"); // "overview" | "chart" | "screener"
  const [tChartHover, setTChartHover] = useState(null);
  const [tWatchSort, setTWatchSort] = useState({ col: "chg", dir: "desc" }); // watchlist sort: col in sym|price|chg|qtd|pe|comp|peg
  const [tChartRange, setTChartRange] = useState("3Y");
  const [tChartSleeve, setTChartSleeve] = useState("dividend");
  const [tDrawer, setTDrawer] = useState(null);
  const [tRailView, setTRailView] = useState("news"); // terminal right rail: "news" | "opps" | "research" | "briefs"
  const [tBriefView, setTBriefView] = useState(null); // { title, category, url } when a brief is open
  const [tBriefIndex, setTBriefIndex] = useState([]); // [{ category, title, date, url, subhead }]
  const [tBriefHtml, setTBriefHtml] = useState("");
  const [tBriefLoading, setTBriefLoading] = useState(false);
  const [tBriefFailed, setTBriefFailed] = useState(false);
  // Build the brief index from rich-report (morning briefs + Rich Report + quarterly) and IOWN-data (commentary).
  // We serve cache instantly (if any) so the UI renders fast, then always kick off a fresh fetch in the background.
  // This guarantees the morning brief routine that runs at 5am ET is visible by the time the user opens the app,
  // and that a brief published during an active session shows up within seconds of the next mount/refresh.
  useEffect(() => {
    let cancelled = false;
    // Step 1: hydrate from cache immediately
    try {
      const cached = JSON.parse(localStorage.getItem("iown_brief_index_v2") || "{}");
      if (cached.list && Array.isArray(cached.list)) setTBriefIndex(cached.list);
    } catch {}
    // Step 2: always refetch in the background
    (async () => {
      const list = [];
      try {
        // Morning briefs — GitHub Contents API listing the briefs/ folder
        const r = await fetch("https://api.github.com/repos/richacarson/rich-report/contents/briefs");
        if (r.ok) {
          const arr = await r.json();
          if (Array.isArray(arr)) {
            for (const f of arr) {
              if (f.type !== "file") continue;
              const m = /^(\d{4}-\d{2}-\d{2})\.html$/i.exec(f.name);
              if (!m) continue;
              list.push({ category: "Morning Brief", title: `Morning Brief — ${m[1]}`, date: m[1], url: f.download_url || `https://raw.githubusercontent.com/richacarson/rich-report/main/briefs/${f.name}`, viewerUrl: `https://richacarson.github.io/rich-report/briefs/${f.name}` });
            }
          }
        }
      } catch {}
      try {
        // Market Commentary — IOWN-data manifest
        const r = await fetch("https://raw.githubusercontent.com/richacarson/IOWN-data/main/commentary-manifest.json");
        if (r.ok) {
          const arr = await r.json();
          if (Array.isArray(arr)) {
            for (const c of arr) {
              if (!c.content) continue;
              list.push({ category: "Market Commentary", title: c.headline || `Commentary — ${c.date}`, date: c.date, url: `https://raw.githubusercontent.com/richacarson/IOWN-data/main/commentaries/${c.content}`, viewerUrl: `https://richacarson.github.io/IOWN-data/commentaries/${c.content}`, subhead: c.subhead });
            }
          }
        }
      } catch {}
      // Singular reports
      list.push({ category: "The Rich Report", title: "The Rich Report", date: new Date().toISOString().slice(0, 10), url: "https://raw.githubusercontent.com/richacarson/rich-report/main/The_Rich_Report.html", viewerUrl: "https://richacarson.github.io/rich-report/The_Rich_Report.html" });
      list.push({ category: "Quarterly Changes", title: "Q2 2026 Portfolio Changes", date: "2026-04-01", url: "https://raw.githubusercontent.com/richacarson/rich-report/main/rebalance/q2-2026/client.html", viewerUrl: "https://richacarson.github.io/rich-report/rebalance/q2-2026/client.html" });
      // Sort by date desc
      list.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      if (!cancelled) setTBriefIndex(list);
      try { localStorage.setItem("iown_brief_index_v2", JSON.stringify({ list, ts: Date.now() })); } catch {}
    })();
    return () => { cancelled = true; };
  }, []);
  // Fetch + parse the active brief's raw HTML into terminal-styled content
  useEffect(() => {
    if (!tBriefView) { setTBriefHtml(""); setTBriefFailed(false); return; }
    setTBriefLoading(true); setTBriefFailed(false);
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(tBriefView.url, { cache: "no-store" });
        if (!r.ok) throw new Error("HTTP " + r.status);
        const html = await r.text();
        if (cancelled) return;
        const doc = new DOMParser().parseFromString(html, "text/html");
        doc.querySelectorAll("script, link, style, nav, header, footer, .header, .footer, .nav, .nav-inner, .sidebar, button, input, form, .fab, .btt, .sec-tog").forEach(el => el.remove());
        // Strip ALL images (internal — no logos needed)
        doc.querySelectorAll("img, svg, picture").forEach(el => el.remove());
        // Strip disclosure/disclaimer/legal sections — match by class, id, or heading text
        doc.querySelectorAll(
          ".disclosures, .disclosure, .disclaimer, .disclaimers, .legal, .footer-disclaimer, " +
          "#disclosures, #disclosure, #disclaimer, #legal, .compliance, .footnotes, " +
          ".disc, .disc-sec, .sec-disc"
        ).forEach(el => el.remove());
        // Strip any section whose heading contains "Disclosure" / "Disclaimer" / "Legal" / "Important Information"
        doc.querySelectorAll("h1, h2, h3, h4, h5").forEach(h => {
          const txt = (h.textContent || "").trim().toLowerCase();
          if (/^(disclosures?|disclaimers?|legal|important information|risk disclosure|terms)\b/.test(txt)) {
            let el = h;
            while (el) { const next = el.nextSibling; el.remove(); el = next; }
          }
        });
        doc.querySelectorAll("[style]").forEach(el => el.removeAttribute("style"));
        const baseUrl = new URL(tBriefView.url);
        doc.querySelectorAll("a[href]").forEach(a => { try { a.href = new URL(a.getAttribute("href"), baseUrl).href; a.target = "_blank"; a.rel = "noopener noreferrer"; } catch {} });
        setTBriefHtml(doc.body.innerHTML);
      } catch (e) {
        if (!cancelled) { console.warn("[brief]", e.message); setTBriefFailed(true); }
      } finally {
        if (!cancelled) setTBriefLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tBriefView]);
  const [ctxMenu, setCtxMenu] = useState(null); // { sym, x, y }
  const [screenerData, setScreenerData] = useState([]);
  const [screenerSleeve, setScreenerSleeve] = useState(null); // null = set on first load
  const [screenerSearch, setScreenerSearch] = useState("");
  const [screenerTypeFilter, setScreenerTypeFilter] = useState("All"); // "All" | "Dividend" | "Growth"
  const [screenerRecFilter, setScreenerRecFilter] = useState("All"); // "All" | "BUY" | "HOLD" | "WATCH" | "SELL"
  const [screenerSectorFilter, setScreenerSectorFilter] = useState("All");
  const [screenerSectors, setScreenerSectors] = useState(() => {
    try {
      const c = JSON.parse(localStorage.getItem("iown_screener_sectors") || "{}");
      const age = Date.now() - (c._ts || 0);
      return age < 7 * 24 * 3600000 ? c : {};
    } catch { return {}; }
  });
  const [screenerScores, setScreenerScores] = useState(() => {
    try {
      const c = JSON.parse(localStorage.getItem("iown_screener_scores") || "{}");
      const age = Date.now() - (c._ts || 0);
      return age < 7 * 24 * 3600000 ? c : {};
    } catch { return {}; }
  });
  const screenerListRef = useRef(null);
  const screenerListScrollY = useRef(0);
  const [scrScrollTop, setScrScrollTop] = useState(0);
  const [screenerDetail, setScreenerDetail] = useState(null); // full report object
  const [screenerDetailLoading, setScreenerDetailLoading] = useState(false);
  const screenerFetched = useRef(false);
  const [screenerLoadDone, setScreenerLoadDone] = useState(false); // fetch settled (success or failure)
  const [opportunities, setOpportunities] = useState([]);
  const [oppExpandedThesis, setOppExpandedThesis] = useState({});
  const [oppExpandedRisks, setOppExpandedRisks] = useState({});
  const [oppDetail, setOppDetail] = useState(null);
  const oppFetched = useRef(false);
  const [oppLoadDone, setOppLoadDone] = useState(false); // fetch settled (success or failure)
  const [oppLedger, setOppLedger] = useState([]);
  const [oppSignals, setOppSignals] = useState(null);
  const [oppStalking, setOppStalking] = useState([]);
  const [oppView, setOppView] = useState("opportunities"); // "opportunities" | "ledger" | "signals" | "stalking"

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
      // Light during market hours (7 AM - 4 PM ET), dark otherwise — used for classic layout
      return (etHour >= 16 || etHour < 7) ? "dark" : "light";
    } catch { return "dark"; }
  };
  const [theme, setTheme] = useState(() => {
    try {
      // "iown_theme_locked" = user explicitly chose a default; "iown_theme" = session toggle
      const locked = localStorage.getItem("iown_theme_locked");
      if (locked) return locked;
      // Terminal layout defaults to terminal theme; classic layout uses market-hour auto (dark/light)
      const layout = localStorage.getItem("iown_layout") || "classic";
      if (layout === "terminal") return "terminal";
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

  // Shared markdown renderer — used by Research and Opportunity detail
  const renderMarkdown = (md) => {
    if (!md) return null;
    let text = md;
    const fmMatch = text.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
    if (fmMatch) text = text.slice(fmMatch[0].length).trim();
    const lines = text.split("\n");
    const elements = [];
    let listItems = [];
    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(<ul key={`ul-${elements.length}`} style={{ margin: "12px 0", paddingLeft: 24, color: C.t2 }}>{listItems}</ul>);
        listItems = [];
      }
    };
    const renderInline = (text) => {
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
          i = j - 1;
          continue;
        }
      }
      if (line.startsWith("# ")) { flushList(); elements.push(<h1 key={i} style={{ fontSize: 28, fontWeight: 800, color: C.t1, margin: "24px 0 12px" }}>{renderInline(line.slice(2))}</h1>); }
      else if (line.startsWith("## ")) { flushList(); elements.push(<h2 key={i} style={{ fontSize: 22, fontWeight: 700, color: C.t1, margin: "20px 0 10px" }}>{renderInline(line.slice(3))}</h2>); }
      else if (line.startsWith("### ")) { flushList(); elements.push(<h3 key={i} style={{ fontSize: 18, fontWeight: 700, color: C.t1, margin: "16px 0 8px" }}>{renderInline(line.slice(4))}</h3>); }
      else if (line.startsWith("- ") || line.startsWith("* ")) { listItems.push(<li key={i} style={{ marginBottom: 6, lineHeight: 1.6 }}>{renderInline(line.slice(2))}</li>); }
      else if (line.trim() === "") { flushList(); }
      else if (line.startsWith("---")) { flushList(); elements.push(<hr key={i} style={{ border: "none", borderTop: `1px solid ${C.border}`, margin: "20px 0" }} />); }
      else { flushList(); elements.push(<p key={i} style={{ margin: "10px 0", lineHeight: 1.7, color: C.t2 }}>{renderInline(line)}</p>); }
    }
    flushList();
    return elements;
  };
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== "undefined" && window.innerWidth >= 768);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = e => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  // Terminal layout needs real horizontal room — below 1180px the rails eat the screen
  const [isWide, setIsWide] = useState(() => typeof window !== "undefined" && window.innerWidth >= 1180);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1180px)");
    const handler = e => setIsWide(e.matches);
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
  const [scrSort, setScrSort] = useState({ col: null, dir: "desc" }); // screener table sort — independent of metrics table
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
  const [pbSimBondPerYear, setPbSimBondPerYear] = useState(100000);
  const [pbSimEquity, setPbSimEquity] = useState(1000000);
  const [pbSimHistBear, setPbSimHistBear] = useState("");
  const [macroData, setMacroData] = useState({ yieldSpread: null, vix: null, hySpread: null, spy200: null, cape: null, loaded: false });
  const [backtest, setBacktest] = useState(null);
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL || "/"}model-backtest.json?v=${Math.floor(Date.now() / 3600000)}`)
      .then(r => r.ok ? r.json() : null)
      .then(setBacktest)
      .catch(() => {});
  }, []);
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
    // Include right-rail benchmark ETFs not already covered by BM_SYMS so they get live quotes
    return [...new Set([...base, ...perfHoldings, ...q1Stocks, ...RAIL_BM_EXTRA])];
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

  // Universal ticker lookup — backfills quote + fundamentals for symbols outside the portfolio universe
  // so search works for ANY stock (profile self-fetches the rest; screener tab 404s gracefully)
  const lookupTicker = useCallback(async (raw) => {
    const sym = (raw || "").trim().toUpperCase();
    if (!/^[A-Z.\-]{1,10}$/.test(sym)) return null;
    const jobs = [];
    const diag = {
      quote: quotesRef.current[sym]?.p ? "cached" : (apiKey && apiSecret ? "pending" : "no-keys"),
      fundamentals: fundamentals[sym]?.peTTM ? "cached" : (FH ? "pending" : "no-finnhub-key"),
    };
    if (!(quotesRef.current[sym]?.p) && apiKey && apiSecret) {
      jobs.push((async () => {
        try {
          const r = await fetch(`${BASE}/v2/stocks/snapshots?symbols=${sym}&feed=iex`, { headers: hdrs });
          if (!r.ok) { diag.quote = `http-${r.status}`; return; }
          const d = await r.json();
          const snap = d[sym];
          if (snap?.latestTrade) {
            quotesRef.current[sym] = { p: snap.latestTrade.p, t: snap.latestTrade.t };
            setQuotes(prev => ({ ...prev, [sym]: quotesRef.current[sym] }));
            diag.quote = "ok";
          } else { diag.quote = "no-trade-data"; }
          if (snap?.prevDailyBar) {
            barsRef.current[sym] = { ...(barsRef.current[sym] || {}), pc: snap.prevDailyBar.c };
            setBars(prev => ({ ...prev, [sym]: barsRef.current[sym] }));
          }
        } catch (err) { diag.quote = `error: ${err?.message || err}`; }
      })());
    }
    if (!fundamentals[sym]?.peTTM && FH) {
      jobs.push((async () => {
        try {
          const [mR, pR] = await Promise.all([
            fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${sym}&metric=all&token=${FH}`),
            fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${sym}&token=${FH}`),
          ]);
          const m = mR.ok ? (await mR.json())?.metric || {} : {};
          const p = pR.ok ? await pR.json() : {};
          if (Object.keys(m).length || p?.name) {
            const f = {
              companyName: p.name, sector: p.finnhubIndustry, industry: p.finnhubIndustry, logo: p.logo,
              peTTM: m.peTTM ?? m.peBasicExclExtraTTM ?? null, peFwd: m.peAnnual ?? null, pegTTM: m.pegTTM ?? null,
              yieldFwd: m.dividendYieldIndicatedAnnual ?? null, payoutRatio: m.payoutRatioTTM ?? null,
              revenueYoY: m.revenueGrowthTTMYoy ?? null, revenue5Y: m.revenueGrowth5Y ?? null,
              profitMargin: m.netProfitMarginTTM ?? null, roe: m.roeTTM ?? null, de: m["totalDebt/totalEquityQuarterly"] ?? null,
              beta: m.beta ?? null, wk52h: m["52WeekHigh"] ?? null, wk52l: m["52WeekLow"] ?? null,
              ytd: m.yearToDatePriceReturnDaily ?? null,
            };
            setFundamentals(prev => ({ ...prev, [sym]: { ...(prev[sym] || {}), ...f } }));
            diag.fundamentals = "ok";
          } else { diag.fundamentals = "empty-response"; }
        } catch (err) { diag.fundamentals = `error: ${err?.message || err}`; }
      })());
    }
    await Promise.all(jobs);
    console.warn("[lookupTicker]", sym, diag);
    return sym;
  }, [apiKey, apiSecret, hdrs, fundamentals]);

  /* ── Global ticker search modal — opened via "/" or Cmd/Ctrl+K in any layout ── */
  const [tickerSearchOpen, setTickerSearchOpen] = useState(false);
  const [tickerSearchQ, setTickerSearchQ] = useState("");
  useEffect(() => {
    if (!unlocked || !authed) return;
    const onKey = (e) => {
      if (e.key === "Escape") { setTickerSearchOpen(false); return; } // no-op when already closed
      const t = e.target, tag = t?.tagName;
      const inField = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t?.isContentEditable;
      const isCmdK = (e.metaKey || e.ctrlKey) && !e.altKey && (e.key === "k" || e.key === "K");
      const isSlash = e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey;
      if (!isCmdK && !isSlash) return;
      if (inField) return; // don't hijack typing inside other inputs
      e.preventDefault();
      setTickerSearchQ("");
      setTickerSearchOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [unlocked, authed]);


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
  const bmQuotesRef = useRef({}); // per-trade WS benchmark quotes — synced to state at 1Hz

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

  /* ── Fetch news ── */
  const fetchNews = useCallback(async () => {
    if (!FH) return;
    // Sources we filter out — press-release wires and noisy aggregators
    const BLOCKED = new Set([
      "Benzinga", "PR Newswire", "PRNewswire", "Business Wire", "BusinessWire",
      "GlobeNewswire", "Globe Newswire", "Accesswire", "AccessWire", "Newsfile",
      "Zacks Investment Research", "MT Newswires", "InvestorPlace",
    ]);
    const norm = (a) => ({
      id: a.id,
      headline: a.headline,
      source: a.source,
      created_at: new Date((a.datetime || 0) * 1000).toISOString(),
      summary: a.summary,
      content: a.summary,
      url: a.url,
      symbols: a.related ? a.related.split(",").map(s => s.trim()).filter(Boolean) : [],
      image_url: a.image,
    });
    try {
      // One call: Finnhub /news?category=general returns 100+ market articles.
      // We split into "broad" and "holdings" based on whether any of our coreSyms
      // appear in the article's `related` field — keeps us at 1 API call vs 20+.
      const r = await fetch(`https://finnhub.io/api/v1/news?category=general&token=${FH}`);
      if (!r.ok) return;
      const raw = await r.json();
      if (!Array.isArray(raw)) return;
      const all = raw
        .filter(a => a && a.headline && !BLOCKED.has(a.source))
        .map(norm)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const coreSet = new Set(coreSyms || []);
      const holdings = all.filter(a => a.symbols.some(s => coreSet.has(s))).slice(0, 60);
      const broad = all.slice(0, 60);
      setNews(prev => prev.length === holdings.length && prev[0]?.id === holdings[0]?.id ? prev : holdings);
      setBroadNews(broad);
    } catch {}
  }, [coreSyms]);

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
          wk52h: m["52WeekHigh"] ?? null,
          wk52l: m["52WeekLow"] ?? null,
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

  /* ── Dividend longevity (Yrs Paid / Yrs Grown) — dividend sleeve only ── */
  const fetchDividendHistory = useCallback(async (force = false) => {
    if (!FK) { console.warn("[dividend] VITE_FMP_KEY missing — Yrs Paid/Grown cannot populate"); return; }
    const divSyms = sleeves.dividend?.symbols || [];
    if (!divSyms.length) return;
    if (!force) {
      try {
        const old = JSON.parse(localStorage.getItem("iown_dividend_history_v2") || "{}");
        const age = Date.now() - (old._ts || 0);
        // Require at least 50% coverage to honor cache — otherwise refetch
        const populated = divSyms.filter(s => old[s]?.yearsPaid != null).length;
        if (age < 24 * 3600000 && populated / divSyms.length >= 0.5) { setDividendHistory(old); return; }
      } catch {}
    }
    const results = {};
    const curYear = new Date().getFullYear();
    let firstFail = null;
    for (let i = 0; i < divSyms.length; i++) {
      const sym = divSyms[i];
      try {
        // Primary: FMP v3 historical-price-full
        let url = `https://financialmodelingprep.com/api/v3/historical-price-full/stock_dividend/${sym}?apikey=${FK}`;
        let r = await fetch(url);
        let d = r.ok ? await r.json() : null;
        let payments = d?.historical || [];
        // Fallback: FMP stable dividends endpoint (different shape)
        if (!payments.length) {
          url = `https://financialmodelingprep.com/api/v3/stock_dividend_calendar?symbol=${sym}&apikey=${FK}`;
          r = await fetch(url);
          d = r.ok ? await r.json() : null;
          payments = Array.isArray(d) ? d.filter(p => p.symbol === sym) : [];
        }
        if (i === 0) console.info("[dividend]", sym, "received", payments.length, "payments");
        if (!payments.length && !firstFail) firstFail = `${sym}: empty response (status ${r.status})`;
        // Group payments by calendar year (use payment/declaration date when available, else event date)
        const yearSum = {};
        for (const p of payments) {
          const amt = Number(p.adjDividend ?? p.dividend);
          const dt = p.paymentDate || p.date || p.declarationDate || "";
          const y = parseInt(String(dt).slice(0, 4), 10);
          if (!isFinite(amt) || amt <= 0 || !y) continue;
          yearSum[y] = (yearSum[y] || 0) + amt;
        }
        const paidYears = Object.keys(yearSum).map(Number).sort((a, b) => b - a);
        let yearsPaid = null, yearsGrown = null;
        if (paidYears.length) {
          const latest = paidYears[0];
          yearsPaid = 0;
          for (let y = latest; yearSum[y] > 0; y--) yearsPaid++;
          // Growth streak — skip the in-progress calendar year (partial totals would falsely break it)
          const growEnd = latest === curYear ? latest - 1 : latest;
          yearsGrown = 0;
          for (let y = growEnd; yearSum[y] != null && yearSum[y - 1] != null && yearSum[y] > yearSum[y - 1]; y--) yearsGrown++;
        }
        results[sym] = { yearsPaid, yearsGrown, _ts: Date.now() };
      } catch (e) { console.warn("Dividend history", sym, e.message); }
    }
    results._ts = Date.now();
    const populated = Object.keys(results).filter(k => k !== "_ts" && results[k]?.yearsPaid != null).length;
    console.info(`[dividend] populated ${populated}/${divSyms.length} symbols`, firstFail ? `(first failure: ${firstFail})` : "");
    setDividendHistory(results);
    try { localStorage.setItem("iown_dividend_history_v2", JSON.stringify(results)); } catch {}
  }, [sleeves]);

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
            if (d.yieldSpread != null) { results.yieldSpread = d.yieldSpread; results.yield10Y = d.yield10Y; results.yield2Y = d.yield2Y; results.yield3M = d.yield3M; results.yieldDate = d.yieldDate; }
            if (d.vix != null) results.vix = d.vix;
            if (d.spyPE != null) results.spyPE = d.spyPE;
            if (d.claims != null) { results.claims = d.claims; results.claimsDate = d.claimsDate; results.claims4wk = d.claims4wk; results.claimsTrend = d.claimsTrend; }
            if (d.cfnai != null) { results.cfnai = d.cfnai; results.cfnaiDate = d.cfnaiDate; results.cfnai3mo = d.cfnai3mo; }
            if (d.sahmVal != null) { results.sahmVal = d.sahmVal; results.unrate = d.unrate; results.unrateDate = d.unrateDate; }
            if (d.baa10y != null) { results.baa10y = d.baa10y; results.baa10yDate = d.baa10yDate; }
            if (d.nfci != null) { results.nfci = d.nfci; results.nfciDate = d.nfciDate; }
            if (d.oilYoY != null) { results.oilYoY = d.oilYoY; results.oilPrice = d.oilPrice; }
            if (d.spyEpsTtm != null) { results.spyEpsTtm = d.spyEpsTtm; results.epsChg90d = d.epsChg90d; results.epsHistLen = (d.spyEpsTtmHist || []).length; }
            if (d.updated) results.updated = d.updated;
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
              // Also update bmQuotes ref for benchmark symbols — state syncs at 1Hz below
              if (BM_SYMS.includes(msg.S)) {
                bmQuotesRef.current[msg.S] = { p: msg.p, t: msg.t };
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
              Object.assign(bmQuotesRef.current, updates); // state syncs at 1Hz below
            }
          }
        } catch {}
      };
      fhWs.onclose = () => { setTimeout(connectFinnhubWS, 5000); };
    } catch {}
  }, []);

  // Sync per-trade benchmark quote refs into React state at 1Hz (avoids memo churn per trade)
  useEffect(() => {
    if (!authed) return;
    const sync = () => {
      const ref = bmQuotesRef.current;
      if (!Object.keys(ref).length) return;
      setBmQuotes(prev => {
        let changed = false;
        const next = { ...prev };
        for (const [s, q] of Object.entries(ref)) {
          if (!next[s] || next[s].p !== q.p || next[s].t !== q.t) { next[s] = q; changed = true; }
        }
        return changed ? next : prev;
      });
    };
    sync();
    const t = setInterval(sync, 1000);
    return () => clearInterval(t);
  }, [authed]);

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
    // 10s timeout — Alpaca paper auth normally returns in &lt;500ms.
    // Without this the app gets stuck on the loading splash if the
    // network is flaky / the API is degraded / a CORS preflight hangs.
    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), 10000);
    try {
      const r = await fetch(`${PAPER}/v2/account`, { headers: hdrs, signal: ctrl.signal });
      clearTimeout(timeoutId);
      if (!r.ok) throw new Error(`auth ${r.status}`);
      setAuthed(true);
      fetchData(true);
      fetchNames();
      fetchNews();
      fetchFundamentals().then(() => fetchDividendHistory()).catch(() => {});
      fetchCalendar();
      fetch(`${import.meta.env.BASE_URL || "/"}research/index.json?t=${Math.floor(Date.now() / 60000)}`).then(r => r.ok ? r.json() : []).then(d => { if (Array.isArray(d)) setResearchReports(d); }).catch(() => {});
      if (!window.ExcelJS) { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js"; document.head.appendChild(s); }
      connectWS();
      connectFinnhubWS();
    } catch (e) {
      clearTimeout(timeoutId);
      setAuthErr(e?.name === "AbortError" ? "Auth timed out (10s) — check connection." : "Auth failed — check API keys.");
    }
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
    if ((tab !== "screener" && tDrawer !== "screener" && layoutMode !== "terminal") || screenerFetched.current || screenerData.length) return;
    screenerFetched.current = true;
    fetch("https://richacarson.github.io/Stock-Screener/manifest.json")
      .then(r => r.json())
      .then(async (d) => {
        setScreenerData(d);
        setScreenerLoadDone(true);
        if (screenerSleeve === null) {
          const match = perfSleeve === "dividend" ? "Dividend" : perfSleeve === "growth" ? "Growth" : null;
          setScreenerSleeve(match || "All");
        }
        // Background-fetch per-report metadata for any tickers we don't already have cached
        const missing = d.filter(s => !screenerSectors[s.ticker] || !screenerScores[s.ticker] || screenerScores[s.ticker]?.inspire === undefined).map(s => s.ticker);
        if (missing.length === 0) return;
        const sectors = { ...screenerSectors };
        const scores = { ...screenerScores };
        const CONCURRENCY = 8;
        let cursor = 0;
        let completed = 0;
        const FLUSH_EVERY = 25;
        const flush = () => {
          // Progressive update so UI populates as data arrives instead of all-at-once at end
          setScreenerSectors({ ...sectors, _ts: Date.now() });
          setScreenerScores({ ...scores, _ts: Date.now() });
        };
        const worker = async () => {
          while (cursor < missing.length) {
            const i = cursor++;
            const ticker = missing[i];
            try {
              const r = await fetch(`https://richacarson.github.io/Stock-Screener/reports/${ticker}.json`);
              if (!r.ok) continue;
              const rep = await r.json();
              const sec = rep.profile?.sector || rep.sector;
              if (sec) sectors[ticker] = sec;
              const ev = rep.excellence_evaluation || {};
              const inn = ev.innovation?.score;
              const infra = ev.infrastructure?.score;
              const inspire = rep.faith_alignment?.inspire_impact_score;
              if (typeof inn === "number" || typeof infra === "number" || typeof inspire === "number") {
                scores[ticker] = {
                  ...(typeof inn === "number" ? { inn } : {}),
                  ...(typeof infra === "number" ? { infra } : {}),
                  inspire: typeof inspire === "number" ? inspire : null, // null = report fetched, no score (prevents refetch loop)
                };
              } else {
                scores[ticker] = { inspire: null };
              }
            } catch {}
            completed++;
            if (completed % FLUSH_EVERY === 0) flush();
          }
        };
        await Promise.all(Array.from({ length: CONCURRENCY }, worker));
        const sectorsOut = { ...sectors, _ts: Date.now() };
        const scoresOut = { ...scores, _ts: Date.now() };
        setScreenerSectors(sectorsOut);
        setScreenerScores(scoresOut);
        try { localStorage.setItem("iown_screener_sectors", JSON.stringify(sectorsOut)); } catch {}
        try { localStorage.setItem("iown_screener_scores", JSON.stringify(scoresOut)); } catch {}
      })
      .catch(() => { setScreenerLoadDone(true); });
  }, [tab, tDrawer, layoutMode]);

  // Fetch opportunities on first visit
  useEffect(() => {
    if ((tab !== "opportunities" && tDrawer !== "opportunities" && layoutMode !== "terminal") || oppFetched.current || opportunities.length) return;
    oppFetched.current = true;
    const cb = `?v=${Math.floor(Date.now() / 60000)}`;
    fetch(`${import.meta.env.BASE_URL}opportunities/manifest.json${cb}`).then(r => r.ok ? r.json() : []).catch(() => [])
      .then(ids => Promise.all(ids.map(id => fetch(`${import.meta.env.BASE_URL}opportunities/${id}.json${cb}`).then(r => r.ok ? r.json() : null).catch(() => null))))
      .then(results => setOpportunities(results.filter(Boolean).sort((a, b) => {
        const rank = (c) => c === "High Conviction" ? 0 : c === "On Our Radar" ? 1 : 2;
        const dr = rank(a.conviction) - rank(b.conviction);
        if (dr !== 0) return dr;
        return (b.date_identified || "").localeCompare(a.date_identified || "");
      })))
      .catch(() => {})
      .finally(() => setOppLoadDone(true));
    // Optional sibling files — gracefully degrade if missing
    fetch(`${import.meta.env.BASE_URL}opportunities/ledger.json${cb}`).then(r => r.ok ? r.json() : []).catch(() => [])
      .then(rows => setOppLedger(Array.isArray(rows) ? rows.sort((a, b) => (b.closed || "").localeCompare(a.closed || "")) : []));
    fetch(`${import.meta.env.BASE_URL}opportunities/stalking.json${cb}`).then(r => r.ok ? r.json() : []).catch(() => [])
      .then(rows => setOppStalking(Array.isArray(rows) ? rows.sort((a, b) => (b.added || "").localeCompare(a.added || "")) : []));
    fetch(`${import.meta.env.BASE_URL}opportunities/signals.json${cb}`).then(r => r.ok ? r.json() : null).catch(() => null)
      .then(s => setOppSignals(s));
  }, [tab, tDrawer, layoutMode]);

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

  /* ── Terminal layout: O(1) screener composite lookups + sector average P/E ── */
  const screenerByTicker = useMemo(() => Object.fromEntries(screenerData.map(s => [s.ticker, s])), [screenerData]);
  const sectorPE = useMemo(() => {
    const agg = {};
    for (const [sym, f] of Object.entries(fundamentals)) {
      if (sym === "_ts" || !f || typeof f !== "object") continue;
      const sec = f.sector, pe = f.peTTM;
      if (!sec || pe == null || !isFinite(pe) || pe <= 0) continue;
      if (!agg[sec]) agg[sec] = { sum: 0, n: 0 };
      agg[sec].sum += pe; agg[sec].n++;
    }
    return Object.fromEntries(Object.entries(agg).map(([k, v]) => [k, v.sum / v.n]));
  }, [fundamentals]);

  /* ── Terminal layout: measured chart dimensions (exact crosshair math, no letterboxing) ── */
  const [tChartDims, setTChartDims] = useState({ w: 900, h: 400 });
  const tYRangeRef = useRef({ key: null, lo: null, hi: null }); // y-axis hysteresis: only widen within a session
  const [tClockNow, setTClockNow] = useState(() => new Date());
  useEffect(() => {
    if (layoutMode !== "terminal") return;
    const id = setInterval(() => setTClockNow(new Date()), 30000);
    return () => clearInterval(id);
  }, [layoutMode]);
  const tChartRORef = useRef(null);
  const attachTChartBox = useCallback(el => {
    if (tChartRORef.current) { tChartRORef.current.disconnect(); tChartRORef.current = null; }
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(entries => {
      const r = entries[0]?.contentRect;
      if (r && r.width > 50 && r.height > 50) {
        setTChartDims(d => (Math.abs(d.w - r.width) > 1 || Math.abs(d.h - r.height) > 1) ? { w: Math.round(r.width), h: Math.round(r.height) } : d);
      }
    });
    ro.observe(el);
    tChartRORef.current = ro;
  }, []);

  /* ── Terminal layout: memoized portfolio chart pipeline (candles + benchmark alignment) ── */
  const tChartData = useMemo(() => {
    if (layoutMode !== "terminal" || terminalActiveSym !== "__portfolio__") return null;
    const tSleeveData = perfDataMap[tChartSleeve] || perfData || {};
    const portfolio = tSleeveData.portfolio || [];
    const benchmarks = tSleeveData.benchmarks || {};
    if (portfolio.length < 2) return { status: "none" };
    const now = new Date();
    let filtered;
    if (tChartRange === "1D") {
      // Use intraday data if available, aggregate into 3-min candles
      let intra = intradayPortfolio["1D"];
      if (intra && intra.length > 2) {
        // Append live trailing point so the last candle tracks real-time value
        if (tChartSleeve === perfSleeve && liveValue?.value) {
          const lastPt = intra[intra.length - 1];
          if (!lastPt || Math.abs(liveValue.value - lastPt.value) > 0.01) {
            intra = [...intra, { date: new Date().toISOString(), value: liveValue.value }];
          }
        }
        const baseV = intra[0].value;
        const AGG = 2; // 2-minute candles — ~195 per session (target ≥160)
        const candles = [];
        for (let i = 0; i < intra.length - 1; i += AGG) {
          const chunk = intra.slice(i, Math.min(i + AGG + 1, intra.length));
          const vals = chunk.map(p => ((p.value / baseV) - 1) * 100);
          const o = vals[0], c = vals[vals.length - 1], h = Math.max(...vals), l = Math.min(...vals);
          candles.push({ date: chunk[chunk.length - 1].date.replace("T", " ").slice(11, 16), o, c, h, l, rawVal: chunk[chunk.length - 1].value, fullDate: chunk[chunk.length - 1].date });
        }
        // Benchmark intraday
        const ibm = intradayBenchmarks["1D"] || {};
        const bmCandles = {};
        Object.entries(ibm).forEach(([sym, pts]) => {
          if (!perfBmToggles[sym] || !pts.length) return;
          const bp = (bmBars[sym]?.pc) || pts[0].close;
          const bc = [];
          for (let i = 0; i < pts.length - 1; i += AGG) {
            const ch = pts.slice(i, Math.min(i + AGG + 1, pts.length));
            const vs = ch.map(p => ((p.close / bp) - 1) * 100);
            bc.push({ o: vs[0], c: vs[vs.length - 1], h: Math.max(...vs), l: Math.min(...vs) });
          }
          bmCandles[sym] = bc;
        });
        const aV = candles.flatMap(c => [c.h, c.l]);
        Object.values(bmCandles).forEach(bc => aV.push(...bc.flatMap(c => [c.h, c.l])));
        const mn = Math.min(...aV), mx = Math.max(...aV), rg = mx - mn || 1;
        return { status: "intraday", candles, bmCandles, mn, mx, rg };
      }
      return { status: "no-intraday" };
    } else if (tChartRange === "QTD") {
      const qm = Math.floor(now.getMonth() / 3) * 3;
      const qStart = `${now.getFullYear()}-${String(qm + 1).padStart(2, "0")}-01`;
      const qtdStart = [...portfolio].reverse().find(p => p.date < qStart);
      filtered = qtdStart ? portfolio.filter(p => p.date >= qtdStart.date) : portfolio.filter(p => p.date >= qStart);
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
    if (filtered.length < 2) return { status: "insufficient" };
    const baseVal = filtered[0].value;
    // Build daily candles first (honest flat-top: no synthetic wicks)
    const dailyCandles = [];
    for (let i = 1; i < filtered.length; i++) {
      const o = ((filtered[i - 1].value / baseVal) - 1) * 100;
      const c = ((filtered[i].value / baseVal) - 1) * 100;
      dailyCandles.push({ date: filtered[i].date, o, c, h: Math.max(o, c), l: Math.min(o, c), rawVal: filtered[i].value });
    }
    // Aggregate to weekly only when daily would exceed ~500 candles (keeps 1Y daily at ~252; 3Y -> weekly ~156; 5Y -> ~260)
    const useWeekly = dailyCandles.length > 500;
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
    // Patch the last candle with the live portfolio value (refreshed ~2s)
    if (tChartSleeve === perfSleeve && liveValue?.value && candles.length) {
      const last = candles[candles.length - 1];
      const lv = ((liveValue.value / baseVal) - 1) * 100;
      last.c = lv;
      last.h = Math.max(last.h, last.o, lv);
      last.l = Math.min(last.l, last.o, lv);
      last.rawVal = liveValue.value;
    }
    const allVals = candles.flatMap(c => [c.h, c.l]);
    const bmCandles = {};
    Object.entries(benchmarks).forEach(([sym, priceMap]) => {
      if (!perfBmToggles[sym]) return;
      const prices = Object.entries(priceMap).sort((a, b) => a[0].localeCompare(b[0]));
      if (!prices.length) return;
      let bp = null; for (const [d, p] of prices) { if (d >= filtered[0].date) { bp = p; break; } }
      if (!bp) bp = prices[prices.length - 1][1];
      // Build daily benchmark candles aligned to candle dates (monotonic index, no rescans)
      const dailyBm = []; let pi = 0, prevPi = 0;
      for (let i = 1; i < filtered.length; i++) {
        prevPi = pi; // pi is currently aligned to filtered[i - 1]
        while (pi < prices.length - 1 && prices[pi + 1][0] <= filtered[i].date) pi++;
        const cl = ((prices[pi][1] / bp) - 1) * 100;
        const op = i === 1 ? 0 : ((prices[prevPi][1] / bp) - 1) * 100;
        dailyBm.push({ o: op, c: cl, h: Math.max(op, cl), l: Math.min(op, cl) });
      }
      const lq = bmQuotes[sym];
      if (lq?.p && dailyBm.length) { const lv = ((lq.p / bp) - 1) * 100; const last = dailyBm[dailyBm.length - 1]; last.c = lv; last.h = Math.max(last.o, lv); last.l = Math.min(last.o, lv); }
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
        bmCandles[sym] = wkBm;
      } else { bmCandles[sym] = dailyBm; }
      allVals.push(...(bmCandles[sym]).flatMap(c => [c.h, c.l]));
    });
    const minV = Math.min(...allVals), maxV = Math.max(...allVals), range = maxV - minV || 1;
    return { status: "daily", candles, bmCandles, minV, maxV, range };
  }, [layoutMode, terminalActiveSym, tChartSleeve, tChartRange, perfDataMap, perfData, perfBmToggles, intradayPortfolio, intradayBenchmarks, bmQuotes, bmBars, liveValue, perfSleeve]);

  /* ── Terminal layout: keyboard navigation ── */
  useEffect(() => {
    if (layoutMode !== "terminal" || !isDesktop || !isWide || !authed) return;
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable) return;
      if (e.key === "Escape") {
        if (selectedArticle) setSelectedArticle(null);
        else if (tDrawer) setTDrawer(null);
        else setTProfileSym(null);
      } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        const syms = sleevesRef.current[tChartSleeve]?.symbols || [];
        if (!syms.length) return;
        e.preventDefault();
        const i = syms.indexOf(terminalActiveSym);
        const next = e.key === "ArrowDown"
          ? (i < 0 ? syms[0] : syms[Math.min(syms.length - 1, i + 1)])
          : (i <= 0 ? syms[0] : syms[i - 1]);
        setTerminalActiveSym(next);
        // Keep the open profile in sync with arrow-key navigation
        if (tProfileSym != null && tProfileSym !== "__portfolio__") setTProfileSym(next);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [layoutMode, isDesktop, isWide, authed, tDrawer, selectedArticle, tChartSleeve, terminalActiveSym, tProfileSym]);

  // Hide the stock profile whenever the active symbol returns to the portfolio view
  useEffect(() => {
    if (terminalActiveSym === "__portfolio__") setTProfileSym(p => (p && p !== "__portfolio__" ? null : p));
  }, [terminalActiveSym]);

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
        <div style={{ position: "absolute", top: "20%", left: "50%", transform: "translate(-50%, -50%)", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(201,168,76,0.10) 0%, transparent 70%)", pointerEvents: "none", filter: "blur(60px)" }} />
        <div style={{ width: "100%", maxWidth: 380, textAlign: "center", opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(20px)", transition: "all 0.8s cubic-bezier(0.16,1,0.3,1)" }}>
          {/* Logo from public folder */}
          <img src={theme !== "light" ? "paradiem-logo-dark.png?v=6" : "paradiem-logo.png?v=6"} alt="Paradiem" style={{ width: 240, height: "auto", margin: "0 auto 28px", display: "block" }} />
          <p style={{ fontSize: 15, color: C.t3, marginBottom: 40, lineHeight: 1.5, fontStyle: "italic", letterSpacing: 0.2 }}>Research Reveals Opportunities</p>
          <div style={{ background: C.surface, borderRadius: 20, padding: 28, border: `1px solid ${codeFocused ? C.borderActive : C.border}`, boxShadow: "0 16px 64px rgba(0,0,0,0.3)", transition: "border-color 0.3s" }}>
            <input type="password" value={code} onChange={e => { setCode(e.target.value); setCodeErr(false); }} onKeyDown={e => { if (e.key === "Enter") handleUnlock(); }} onFocus={() => setCodeFocused(true)} onBlur={() => setCodeFocused(false)} placeholder="Access code" style={{ width: "100%", padding: "18px 20px", background: C.bg, border: `1px solid ${codeErr ? C.dn+"66" : C.border}`, borderRadius: 14, color: C.t1, fontSize: 16, outline: "none", boxSizing: "border-box", textAlign: "center", letterSpacing: 4, fontFamily: "inherit" }} />
            <button onClick={handleUnlock} style={{ width: "100%", padding: 18, marginTop: 16, background: "linear-gradient(135deg, #C9A84C, #8B7355)", border: "none", borderRadius: 14, color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 24px rgba(201,168,76,0.3)" }}>Continue</button>
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
      <div style={{ minHeight: "100dvh", background: "#191635", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ textAlign: "center", maxWidth: 360 }}>
          <img src="paradiem-logo-dark.png?v=15" alt="Paradiem" style={{ width: 240, height: "auto", margin: "0 auto 24px", display: "block" }} />
          {authErr ? (
            <>
              <div style={{ fontSize: 13, color: "#F87171", marginBottom: 16, fontFamily: "'DM Sans', sans-serif" }}>{authErr}</div>
              <button onClick={() => auth()} style={{ padding: "10px 24px", borderRadius: 10, border: "1px solid #C9A84C66", background: "#C9A84C22", color: "#FAF7F2", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Retry</button>
            </>
          ) : (
            <div style={{ width: 24, height: 24, border: "3px solid rgba(255,255,255,0.15)", borderTopColor: "#FCD432", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
          )}
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
            <button onClick={auth} style={{ width: "100%", padding: 18, background: "linear-gradient(135deg, #C9A84C, #8B7355)", border: "none", borderRadius: 14, color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 24px rgba(201,168,76,0.3)" }}>Connect</button>
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
        <div style={{ display: "flex", alignItems: "center", padding: "14px 0", userSelect: "none", WebkitUserSelect: "none" }}>
          {/* Edit mode: delete list button */}
          {editMode && (
            <div onClick={() => { if (confirm(`Delete "${sleeve.name}"?`)) removeList(k); }} style={{ width: 28, height: 28, borderRadius: 14, background: C.dn + "22", border: `1px solid ${C.dn}44`, display: "flex", alignItems: "center", justifyContent: "center", marginRight: 10, cursor: "pointer", flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.dn} strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
            </div>
          )}
          <div onClick={() => toggleSleeve(k)} style={{ display: "flex", alignItems: "center", flex: 1, cursor: "pointer", userSelect: "none" }}>
            {editMode && editIconFor === k && (
              <div style={{ marginRight: 16, display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                <input type="text" value={iconInput} onChange={e => setIconInput(e.target.value)} autoFocus
                  onKeyDown={e => { if (e.key === "Enter") updateIcon(k, iconInput); if (e.key === "Escape") setEditIconFor(null); }}
                  placeholder="😀" style={{ width: 50, height: 50, padding: 0, background: C.card, border: `1px solid ${C.borderActive}`, borderRadius: 14, color: C.t1, fontSize: 26, textAlign: "center", outline: "none", fontFamily: "inherit" }} />
                <button onClick={(e) => { e.stopPropagation(); updateIcon(k, iconInput); }} style={{ padding: "8px 10px", background: C.accentSoft, border: `1px solid ${C.borderActive}`, borderRadius: 8, color: C.t1, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Set</button>
              </div>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.t1, letterSpacing: -0.1 }}>{sleeve.name}</div>
              <div style={{ fontSize: 12, color: C.t4, marginTop: 2 }}>{sleeve.symbols.length} items</div>
            </div>
          </div>
          {/* Right side: avg change + chevron */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {avgChg != null && (
              <span data-sleeve-chg={k} style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: avgChg >= 0 ? C.up : C.dn, display: "inline-block", minWidth: 70, textAlign: "right" }}>{pct(avgChg)}</span>
            )}
            <div onClick={() => toggleSleeve(k)} style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
              cursor: "pointer", padding: 6,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.t4} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
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
  /* ── Shared ticker-search modal (rendered by both layouts) ── */
  const isTerminalView = layoutMode === "terminal" && isDesktop && isWide;
  const openTickerSearch = () => { setTickerSearchQ(""); setTickerSearchOpen(true); };
  const submitTickerSearch = async () => {
    const q = tickerSearchQ; // controlled state — immune to synthetic-event invalidation across await
    setTickerSearchOpen(false);
    setTickerSearchQ("");
    const sym = await lookupTicker(q);
    if (!sym) return;
    if (isTerminalView) {
      setTerminalActiveSym(sym); setTProfileSym(sym); setTProfileTab("chart"); setTDrawer(null); setTBriefView(null);
    } else {
      openStock(sym);
    }
  };
  const tickerSearchModal = tickerSearchOpen ? (
    <div onClick={() => setTickerSearchOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "18vh" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "min(460px, calc(100vw - 48px))", background: C.card, border: `1px solid ${C.border}`, borderRadius: isTerminalView ? 0 : 10, padding: "18px 20px 16px", boxShadow: "0 24px 80px rgba(0,0,0,0.55)" }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: C.accent, marginBottom: 10 }}>Search</div>
        <input
          autoFocus type="text" spellCheck={false} placeholder="Search any ticker… AAPL"
          value={tickerSearchQ} onChange={e => setTickerSearchQ(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Escape") { e.stopPropagation(); setTickerSearchOpen(false); return; }
            if (e.key === "Enter") submitTickerSearch();
          }}
          style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", background: C.bg, border: `1px solid ${C.borderActive || C.border}`, borderRadius: isTerminalView ? 0 : 10, color: C.t1, fontSize: 16, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", fontFamily: "inherit", outline: "none" }}
        />
        <div style={{ fontSize: 11, color: C.t4, marginTop: 10 }}>Press Enter to open · Esc to close</div>
      </div>
    </div>
  ) : null;

  if (layoutMode === "terminal" && isDesktop && isWide && authed) {
    const tFont = "'IBM Plex Mono', 'SF Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace";
    const tEyebrow = { fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.2, color: C.accent };
    const tEyebrowMuted = { ...tEyebrow, color: C.t4 };
    const tTabBtn = (active) => ({ padding: "6px 12px", background: active ? C.accentSoft : "transparent", border: "none", borderBottom: active ? `2px solid ${C.accent}` : "2px solid transparent", color: active ? C.t1 : C.t4, fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap" });
    const tTabRow = { display: "flex", borderBottom: `1px solid ${C.border}`, overflowX: "auto", marginBottom: 12 };
    const tBackBtn = { background: "none", border: "none", padding: 0, color: C.t3, fontSize: 10, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit" };
    const tCloseBtn = { background: "none", border: "none", padding: 4, color: C.t3, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" };
    const tCloseX = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.t3} strokeWidth="1.8" strokeLinecap="round"><path d="M6 6L18 18M18 6L6 18" /></svg>;
    const tTh = (align = "right", sortable = true) => ({ padding: "5px 8px", textAlign: align, color: C.t4, fontSize: 10, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase", whiteSpace: "nowrap", cursor: sortable ? "pointer" : "default", userSelect: "none" });
    const tTd = (align = "right") => ({ padding: "5px 8px", textAlign: align, whiteSpace: "nowrap" });
    const tRecColor = r => ({ BUY: C.up, HOLD: C.warn, WATCH: C.t3, SELL: C.dn })[r] || C.t3;
    const tStat = (label, val, color) => (
      <div key={label} style={{ display: "flex", flexDirection: "column", gap: 2, padding: "6px 14px 6px 0", borderRight: `1px solid ${C.border}` }}>
        <div style={{ ...tEyebrowMuted, fontSize: 9 }}>{label}</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: color || C.t1, fontVariantNumeric: "tabular-nums" }}>{val}</div>
      </div>
    );
    const tScoreColor = s => s >= 7 ? C.up : s >= 4 ? C.warn : C.dn;
    const tScoreRow = (title, v) => (v?.score == null) ? null : (
      <div key={title} style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 3 }}>
          <span style={tEyebrowMuted}>{title}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: tScoreColor(v.score) }}>{v.score}/10</span>
          {v.label && <span style={{ ...tEyebrowMuted, fontSize: 9 }}>{v.label}</span>}
        </div>
        {v.analysis && <div style={{ fontSize: 11, color: C.t3, lineHeight: 1.6 }}>{v.analysis}</div>}
      </div>
    );
    // Full screener report — shared by the screener drawer and the stock profile screener tab
    const tScreenerReport = (a, loading) => {
      if (!a) return <div style={tEyebrowMuted}>NO SCREENER REPORT</div>;
      const ig = a.infinite_game;
      const fa = a.faith_alignment;
      return (
        <div style={{ maxWidth: 760 }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: C.t1 }}>{a.ticker || a.symbol}</span>
            <span style={{ fontSize: 12, color: C.t3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
            {a.recommendation && <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", padding: "2px 8px", borderRadius: 2, color: tRecColor(a.recommendation), background: tRecColor(a.recommendation) + "18" }}>{a.recommendation}</span>}
            {a.overall_score != null && <span style={{ fontSize: 18, fontWeight: 700, color: C.t1, marginLeft: a.recommendation ? 0 : "auto" }}>{a.overall_score}<span style={{ fontSize: 10, fontWeight: 400, color: C.t4 }}> / 100</span></span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ ...tEyebrowMuted, fontSize: 9 }}>{[a.sleeve && `${a.sleeve} sleeve`, a.screen_date, ig?.mindset, fa?.inspire_impact_score != null && `Inspire ${fa.inspire_impact_score}`].filter(Boolean).join(" · ")}</span>
            {(a.ticker || a.symbol) && (() => {
              const repSym = a.ticker || a.symbol;
              const goBtn = (label, profTab) => (
                <button key={label} onClick={() => { setTerminalActiveSym(repSym); setTProfileSym(repSym); setTProfileTab(profTab); setTDrawer(null); setTBriefView(null); lookupTicker(repSym); }}
                  style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 2, padding: "2px 10px", color: C.t3, fontSize: 9, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.t3; }}>{label}</button>
              );
              return <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>{goBtn("Overview", "overview")}{goBtn("Chart", "chart")}</span>;
            })()}
          </div>
          {loading ? (
            <div style={tEyebrowMuted}>LOADING REPORT</div>
          ) : (<>
            {/* Company Profile */}
            {a.profile && (<>
              <div style={{ ...tEyebrow, marginBottom: 6 }}>Company Profile</div>
              <div style={{ ...tEyebrowMuted, fontSize: 9, marginBottom: 6 }}>{[a.profile.sector, a.profile.industry, a.profile.exchange, a.profile.country, a.profile.employees && `${Number(a.profile.employees).toLocaleString()} employees`].filter(Boolean).join(" · ")}</div>
              {a.profile.description && <div style={{ fontSize: 11, color: C.t3, lineHeight: 1.7, marginBottom: 16 }}>{a.profile.description}</div>}
            </>)}
            {/* Investment Thesis */}
            {(a.investment_thesis || a.thesis_continued) && (<>
              <div style={{ ...tEyebrow, marginBottom: 6 }}>Investment Thesis</div>
              <div style={{ fontSize: 12, color: C.t2, lineHeight: 1.7, marginBottom: 16 }}>{[a.investment_thesis, a.thesis_continued].filter(Boolean).join(" ")}</div>
            </>)}
            {/* Excellence Evaluation */}
            {a.excellence_evaluation && (<>
              <div style={{ ...tEyebrow, marginBottom: 8 }}>Excellence Evaluation — Think Like an Owner (50%)</div>
              {tScoreRow("Innovation", a.excellence_evaluation.innovation)}
              {tScoreRow("Inspiration", a.excellence_evaluation.inspiration)}
              {tScoreRow("Infrastructure", a.excellence_evaluation.infrastructure)}
              <div style={{ marginBottom: 6 }} />
            </>)}
            {/* Infinite Game */}
            {ig && (<>
              <div style={{ ...tEyebrow, marginBottom: 6 }}>Finite vs Infinite Game (25%)</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 6 }}>
                {ig.mindset && <span style={{ ...tEyebrowMuted, color: C.t2 }}>Mindset: <span style={{ color: C.accent }}>{ig.mindset}</span></span>}
                {ig.overall != null && <span style={{ fontSize: 12, fontWeight: 700, color: tScoreColor(ig.overall) }}>{ig.overall}/10</span>}
              </div>
              {ig.summary && <div style={{ fontSize: 11, color: C.t3, lineHeight: 1.6, borderLeft: `2px solid ${C.border}`, paddingLeft: 10, marginBottom: 10 }}>{ig.summary}</div>}
              {tScoreRow("Just Cause", ig.just_cause)}
              {tScoreRow("Trusting Teams", ig.trusting_teams)}
              {tScoreRow("Worthy Rivals", ig.worthy_rivals)}
              {tScoreRow("Existential Flexibility", ig.existential_flexibility)}
              {tScoreRow("Courage to Lead", ig.courage_to_lead)}
              <div style={{ marginBottom: 6 }} />
            </>)}
            {/* AI Resilience */}
            {a.ai_resilience && (<>
              <div style={{ ...tEyebrow, marginBottom: 8 }}>AI Resilience (25%)</div>
              {tScoreRow("AI Resilience", a.ai_resilience)}
              <div style={{ marginBottom: 6 }} />
            </>)}
            {/* Key Catalysts */}
            {a.key_catalysts?.length > 0 && (<>
              <div style={{ ...tEyebrow, marginBottom: 8 }}>Key Catalysts</div>
              <div style={{ marginBottom: 16 }}>{a.key_catalysts.map((c2, i) => <div key={i} style={{ fontSize: 11, color: C.t2, lineHeight: 1.6, marginBottom: 4 }}><span style={{ color: C.accent }}>{i + 1}.</span> {typeof c2 === "string" ? c2 : c2.catalyst || c2.description || ""}</div>)}</div>
            </>)}
            {/* Key Risks */}
            {a.key_risks?.length > 0 && (<>
              <div style={{ ...tEyebrow, marginBottom: 8, color: C.dn }}>Key Risks</div>
              <div style={{ marginBottom: 16 }}>{a.key_risks.map((r2, i) => <div key={i} style={{ fontSize: 11, color: C.t2, lineHeight: 1.6, marginBottom: 4 }}><span style={{ color: C.dn }}>{i + 1}.</span> {typeof r2 === "string" ? r2 : r2.risk || r2.description || ""}</div>)}</div>
            </>)}
            {/* Faith Alignment */}
            {fa && (<>
              <div style={{ ...tEyebrow, marginBottom: 6 }}>Faith Alignment — Inspire Insight</div>
              {fa.inspire_impact_score != null && (
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
                  <span style={tEyebrowMuted}>Inspire Impact Score</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: fa.inspire_impact_score >= 0 ? C.up : C.dn }}>{fa.inspire_impact_score}</span>
                </div>
              )}
              {fa.positive_attributions?.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center", marginBottom: 6 }}>
                  <span style={{ ...tEyebrowMuted, fontSize: 9, color: C.up }}>Positive</span>
                  {fa.positive_attributions.map((attr, i) => <span key={i} style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 2, background: C.up + "14", color: C.up }}>{attr}</span>)}
                </div>
              )}
              {fa.negative_attributions?.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center", marginBottom: 6 }}>
                  <span style={{ ...tEyebrowMuted, fontSize: 9, color: C.dn }}>Negative</span>
                  {fa.negative_attributions.map((attr, i) => <span key={i} style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 2, background: C.dn + "14", color: C.dn }}>{attr}</span>)}
                </div>
              )}
              {fa.source && <div style={{ fontSize: 10, color: C.t4, marginBottom: 16 }}>Source: {fa.source}</div>}
              {!fa.source && <div style={{ marginBottom: 16 }} />}
            </>)}
            {/* Sources */}
            {a.sources?.length > 0 && (<>
              <div style={{ ...tEyebrow, marginBottom: 8 }}>Sources</div>
              <div style={{ marginBottom: 16 }}>{a.sources.map((s2, i) => <div key={i} style={{ fontSize: 10, color: C.t3, lineHeight: 1.6, marginBottom: 4 }}><span style={{ color: C.accent }}>{i + 1}.</span> {typeof s2 === "string" ? s2 : s2.title || s2.source || ""}</div>)}</div>
            </>)}
          </>)}
        </div>
      );
    };
    // Open a stock screener report (fetch full JSON if not already loaded)
    const tOpenScreenerReport = (sym) => {
      const cur = screenerDetail?.ticker || screenerDetail?.symbol;
      if (cur === sym && !screenerDetailLoading) return;
      setScreenerDetailLoading(true);
      const stub = screenerByTicker[sym] || { ticker: sym };
      setScreenerDetail(stub);
      fetch(`https://richacarson.github.io/Stock-Screener/reports/${sym}.json`)
        .then(r => r.ok ? r.json() : stub)
        .then(d => { setScreenerDetail(d); setScreenerDetailLoading(false); })
        .catch(() => { setScreenerDetail(stub); setScreenerDetailLoading(false); });
    };
    const tSleeveKeys = Object.keys(sleeves);
    const tSleeveSyms = sleeves[tChartSleeve]?.symbols || [];
    const tWOf = s => liveWeights[tChartSleeve]?.[s] ?? null;
    const tAvg = (get) => {
      let ws = 0, wsum = 0, esum = 0, n = 0;
      for (const s of tSleeveSyms) {
        const v = get(s); if (v == null || !isFinite(v)) continue;
        const w = tWOf(s); if (w != null) { ws += w; wsum += w * v; }
        esum += v; n++;
      }
      return ws > 0 ? wsum / ws : (n ? esum / n : null);
    };
    const tQtdOf = s => { const p = (quotesRef.current[s] || quotes[s])?.p; const anc = REBALANCE_ANCHORS[s]; return (anc && p) ? (p / anc - 1) * 100 : (fundamentals[s]?.thisQtr ?? null); };
    const tAvgPE = tAvg(s => fundamentals[s]?.peTTM);
    const tAvgComp = tAvg(s => screenerByTicker[s]?.overall_score);
    const tAvgYld = tAvg(s => fundamentals[s]?.yieldFwd);
    const tAvgPeg = tAvg(s => fundamentals[s]?.pegTTM);
    const tAvgQtd = tAvg(tQtdOf);
    const tIsGrowth = tChartSleeve === "growth";
    const tIsDividend = tChartSleeve === "dividend";
    const tIsEtfSleeve = tChartSleeve === "sectors" || tChartSleeve === "digital"; // ETF sleeves have no P/E or screener composite
    const tIsPortfolio = terminalActiveSym === "__portfolio__";
    const tChartBg = "171738"; // terminal chart is always dark navy, regardless of theme
    const tvTheme = theme === "light" ? "light" : "dark";
    // Cream for light theme, near-black for terminal — strip the "#"
    const tvBg = theme === "light" ? "FAF7F2" : (theme === "terminal" ? "020208" : "171738");
    const tvTbBg = theme === "light" ? "F4EFE4" : (theme === "terminal" ? "070714" : "1F1F45");
    const tChartUrlFor = (s) => `https://s.tradingview.com/widgetembed/?frameElementId=tv_terminal&symbol=${s}&interval=D&hidesidetoolbar=0&symboledit=0&saveimage=0&hideideas=1&hidetrading=1&theme=${tvTheme}&style=1&timezone=America%2FNew_York&withdateranges=1&showpopupbutton=0&locale=en&backgroundColor=%23${tvBg}&toolbar_bg=%23${tvTbBg}`;
    const tChartUrl = tChartUrlFor(terminalActiveSym);
    const tNow = tClockNow.toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit" });
    const tAllNews = (() => { const seen = new Set(); return [...(news || []), ...(broadNews || [])].filter(a => { const k = a.id || a.headline; if (seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => new Date(b.created_at || b.datetime || 0) - new Date(a.created_at || a.datetime || 0)).slice(0, 50); })();
    const tPortfolioVal = liveValue ? liveValue.value : null;
    const tPortfolioPrev = liveValue?.prevClose || null;
    const tDayChg = (tPortfolioVal && tPortfolioPrev) ? ((tPortfolioVal / tPortfolioPrev) - 1) * 100 : null;
    const tDayChgDollar = (tPortfolioVal && tPortfolioPrev) ? tPortfolioVal - tPortfolioPrev : null;
    const tSpyPrice = (bmQuotes.SPY?.p || quotesRef.current?.SPY?.p);

    return (
      <div style={{ position: "fixed", inset: 0, background: C.bg, color: C.t1, fontFamily: tFont, fontSize: 12, display: "grid", gridTemplateRows: "32px 1fr auto 24px", gridTemplateColumns: `${tIsGrowth ? 348 : 320}px minmax(0, 1fr) minmax(240px, 300px)`, overflow: "hidden", fontVariantNumeric: "tabular-nums", caretColor: "transparent" }}>
        {/* Suppress the stray text caret that appears when clicking non-input text; restore it for real inputs */}
        <style>{`input, textarea, select, [contenteditable="true"] { caret-color: ${C.accent}; }`}</style>
        {/* ── TOP STATUS BAR ── */}
        <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", background: C.surface, borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: marketStatus.color, boxShadow: `0 0 6px ${marketStatus.color}` }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: marketStatus.color }}>{marketStatus.label}</span>
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center", overflowX: "auto" }}>
            <button
              onClick={openTickerSearch} title="Search any ticker (/ or Cmd+K)"
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "2px 8px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 2, color: C.t3, fontSize: 10, fontWeight: 600, letterSpacing: 1, cursor: "pointer", fontFamily: "inherit", flexShrink: 0, whiteSpace: "nowrap" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.t1; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.t3; }}
            >⌕ SEARCH · /</button>
            <span style={{ width: 1, height: 12, background: C.border, flexShrink: 0 }} />
            {["SPY", "QQQ", "DIA", "DVY", "IUSG"].map(sym => { const q = bmQuotes[sym] || quotesRef.current?.[sym]; const b = bmBars[sym] || barsRef.current?.[sym]; const c = (q && b?.pc) ? ((q.p - b.pc) / b.pc) * 100 : null; return q?.p ? (
              <span key={sym} onClick={() => { setTerminalActiveSym(sym); setTProfileSym(null); setTDrawer(null); }} style={{ fontSize: 11, color: C.t2, whiteSpace: "nowrap", cursor: "pointer" }} onMouseEnter={e => e.currentTarget.style.color = C.accent} onMouseLeave={e => e.currentTarget.style.color = C.t2}>
                <span style={{ fontWeight: 700 }}>{sym}</span>{" "}${q.p.toFixed(2)}{" "}
                <span style={{ color: c != null ? (c >= 0 ? C.up : C.dn) : C.t4 }}>{c != null ? pct(c) : ""}</span>
              </span>
            ) : null; })}
            <span style={{ width: 1, height: 12, background: C.border, flexShrink: 0 }} />
            {macroData.vix != null && <span style={{ fontSize: 11, color: C.t2, whiteSpace: "nowrap" }}><span style={{ fontWeight: 700 }}>VIX</span> <span style={{ color: macroData.vix > 25 ? C.dn : macroData.vix > 18 ? C.warn : C.up }}>{macroData.vix.toFixed(1)}</span></span>}
            {macroData.oilPrice != null && <span style={{ fontSize: 11, color: C.t2, whiteSpace: "nowrap" }}><span style={{ fontWeight: 700 }}>OIL</span> ${macroData.oilPrice.toFixed(2)} <span style={{ color: macroData.oilChg >= 0 ? C.up : C.dn }}>{macroData.oilChg != null ? `${macroData.oilChg >= 0 ? "+" : ""}${macroData.oilChg.toFixed(2)}%` : ""}</span></span>}
            {macroData.goldPrice != null && <span style={{ fontSize: 11, color: C.t2, whiteSpace: "nowrap" }}><span style={{ fontWeight: 700 }}>GOLD</span> ${macroData.goldPrice.toFixed(0)} <span style={{ color: macroData.goldChg >= 0 ? C.up : C.dn }}>{macroData.goldChg != null ? `${macroData.goldChg >= 0 ? "+" : ""}${macroData.goldChg.toFixed(2)}%` : ""}</span></span>}
          </div>
          <span style={{ fontSize: 10, color: C.t3 }}>{tNow} ET</span>
        </div>

        {/* ── LEFT: WATCHLIST ── */}
        <div style={{ borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Sleeve tabs */}
          <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${C.border}`, flexShrink: 0, overflow: "auto" }}>
            {tSleeveKeys.map(k => {
              const tabLabels = { dividend: "DIV", growth: "GROWTH", digital: "DIGITAL", sectors: "SECTORS", fci100: "FCI 100", fciValues: "FCI VAL" };
              const label = tabLabels[k] || (sleeves[k].name || k).toUpperCase().slice(0, 8);
              return (
              <button key={k} onClick={() => { setTChartSleeve(k); setTChartHover(null); if (perfDataMap[k] || ["dividend", "growth", "fci100", "fciValues"].includes(k)) setPerfSleeve(k); }} style={{ flex: "0 0 auto", padding: "6px 8px", background: tChartSleeve === k ? C.accentSoft : "transparent", border: "none", borderBottom: tChartSleeve === k ? `2px solid ${C.accent}` : "2px solid transparent", color: tChartSleeve === k ? C.t1 : C.t4, fontSize: 10, fontWeight: 600, letterSpacing: 1, cursor: "pointer", fontFamily: tFont, whiteSpace: "nowrap" }}>{label}</button>
            ); })}
          </div>
          {/* Stock list */}
          <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", scrollbarGutter: "stable" }}>
            {/* Sleeve summary (weighted averages) + column header */}
            <div style={{ position: "sticky", top: 0, zIndex: 1, background: C.surface }}>
              <div style={{ borderBottom: `1px solid ${C.border}`, padding: "6px 10px", display: "flex", justifyContent: "space-between", gap: 8 }}>
                {[
                  ...(tIsEtfSleeve ? [] : [
                    { l: "P/E", v: tAvgPE != null ? tAvgPE.toFixed(1) : null },
                    { l: "COMP", v: tAvgComp != null ? Math.round(tAvgComp).toString() : null },
                    { l: "QTD", v: tAvgQtd != null ? pct(tAvgQtd) : null, c: tAvgQtd == null ? null : tAvgQtd >= 0 ? C.up : C.dn },
                  ]),
                  ...(tIsDividend ? [{ l: "YLD", v: tAvgYld != null ? `${tAvgYld.toFixed(1)}%` : null }] : []),
                  ...(tIsGrowth ? [{ l: "PEG", v: tAvgPeg != null ? tAvgPeg.toFixed(1) : null }] : []),
                ].map(({ l, v, c }) => (
                  <span key={l} style={{ display: "flex", gap: 4, alignItems: "baseline" }}>
                    <span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: C.accent }}>{l}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: v != null ? (c || C.t1) : C.t4 }}>{v ?? "—"}</span>
                  </span>
                ))}
              </div>
              <div style={{ padding: "4px 10px", borderBottom: `1px solid ${C.border}`, background: C.surface, display: "flex", alignItems: "center", justifyContent: "space-between", borderLeft: "2px solid transparent", boxSizing: "border-box" }}>
                {[
                  { l: "SYM", k: "sym", w: tIsEtfSleeve ? 72 : 48, a: "left" },
                  { l: "PRICE", k: "price", w: tIsEtfSleeve ? 72 : 54 },
                  { l: "CHG%", k: "chg", w: tIsEtfSleeve ? 62 : 48 },
                  ...(tIsEtfSleeve ? [] : [{ l: "QTD%", k: "qtd", w: 48 }, { l: "P/E", k: "pe", w: 36 }, { l: "COMP", k: "comp", w: 34 }]),
                  ...(tIsGrowth ? [{ l: "PEG", k: "peg", w: 28 }] : []),
                ].map(h => {
                  const active = tWatchSort.col === h.k;
                  const arrow = active ? (tWatchSort.dir === "asc" ? "↑" : "↓") : "";
                  return (
                    <span key={h.l} onClick={() => setTWatchSort(prev => prev.col === h.k ? { col: h.k, dir: prev.dir === "asc" ? "desc" : "asc" } : { col: h.k, dir: h.k === "sym" ? "asc" : "desc" })}
                      style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: active ? C.accent : C.t4, width: h.w, flexShrink: 0, textAlign: h.a || "right", overflow: "hidden", cursor: "pointer", userSelect: "none" }}>{h.l}{arrow}</span>
                  );
                })}
              </div>
            </div>
            {(() => {
              const ext = {
                sym: s => s,
                price: s => (quotesRef.current[s] || quotes[s])?.p,
                chg: s => { const q = quotesRef.current[s] || quotes[s]; const b = barsRef.current[s] || bars[s]; return (q && b?.pc) ? ((q.p - b.pc) / b.pc) * 100 : null; },
                qtd: s => tQtdOf(s),
                pe: s => fundamentals[s]?.peTTM,
                comp: s => screenerByTicker[s]?.overall_score,
                peg: s => fundamentals[s]?.pegTTM,
              };
              return [...tSleeveSyms].sort((a, b) => {
                const ka = ext[tWatchSort.col]?.(a);
                const kb = ext[tWatchSort.col]?.(b);
                const an = ka == null || (typeof ka === "number" && !isFinite(ka));
                const bn = kb == null || (typeof kb === "number" && !isFinite(kb));
                if (an && bn) return a.localeCompare(b);
                if (an) return 1; // nulls last
                if (bn) return -1;
                const cmp = tWatchSort.col === "sym" ? ka.localeCompare(kb) : (ka - kb);
                return tWatchSort.dir === "asc" ? cmp : -cmp;
              });
            })().map(sym => { const q = quotesRef.current[sym] || quotes[sym]; const b = barsRef.current[sym] || bars[sym]; const c = (q && b?.pc) ? ((q.p - b.pc) / b.pc) * 100 : null; const qtd = tQtdOf(sym); const isActive = sym === terminalActiveSym; const f = fundamentals[sym]; const comp = screenerByTicker[sym]?.overall_score; const peBeat = f?.peTTM != null && f.sector && sectorPE[f.sector] && f.peTTM < sectorPE[f.sector]; return (
              <div key={sym} onClick={() => { setTerminalActiveSym(sym); setTProfileSym(sym); setTProfileTab("chart"); setTDrawer(null); }}
                onMouseEnter={e => e.currentTarget.style.background = C.cardHover}
                onMouseLeave={e => e.currentTarget.style.background = isActive ? C.accentSoft : "transparent"}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 10px", height: 28, cursor: "pointer", background: isActive ? C.accentSoft : "transparent", borderLeft: isActive ? `2px solid ${C.accent}` : "2px solid transparent", boxSizing: "border-box" }}>
                <span style={{ width: tIsEtfSleeve ? 72 : 48, flexShrink: 0, display: "flex", flexDirection: "column", lineHeight: 1.1, overflow: "hidden" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: isActive ? C.accent : C.t1, overflow: "hidden", textOverflow: "ellipsis" }}>{sym}</span>
                  {(() => { const s = f?.sector; return s ? (<span title={s} style={{ fontSize: 8, color: C.t4, letterSpacing: 0.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shortSector(s)}</span>) : null; })()}
                </span>
                <span style={{ fontSize: 10, color: C.t1, width: tIsEtfSleeve ? 72 : 54, flexShrink: 0, textAlign: "right" }}>{q?.p != null ? (q.p >= 1000 ? q.p.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : q.p.toFixed(2)) : "—"}</span>
                <span style={{ fontSize: 10, fontWeight: 600, width: tIsEtfSleeve ? 62 : 48, flexShrink: 0, textAlign: "right", color: c == null ? C.t4 : c >= 0 ? C.up : C.dn }}>{c != null ? pct(c) : "—"}</span>
                {!tIsEtfSleeve && <span style={{ fontSize: 10, fontWeight: 600, width: 48, flexShrink: 0, textAlign: "right", color: qtd == null ? C.t4 : qtd >= 0 ? C.up : C.dn }}>{qtd != null ? pct(qtd) : "—"}</span>}
                {!tIsEtfSleeve && <span style={{ fontSize: 10, width: 36, flexShrink: 0, textAlign: "right", color: f?.peTTM == null ? C.t4 : peBeat ? C.accent : C.t2 }}>{f?.peTTM != null ? f.peTTM.toFixed(1) : "—"}</span>}
                {!tIsEtfSleeve && <span style={{ fontSize: 10, fontWeight: 700, width: 34, flexShrink: 0, textAlign: "right", color: comp == null ? C.t4 : comp >= 70 ? C.up : comp >= 50 ? C.t2 : C.warn }}>{comp ?? "—"}</span>}
                {tIsGrowth && <span style={{ fontSize: 10, width: 36, flexShrink: 0, textAlign: "right", color: f?.pegTTM != null ? C.t2 : C.t4 }}>{f?.pegTTM != null ? f.pegTTM.toFixed(1) : "—"}</span>}
              </div>
            ); })}
          </div>
        </div>

        {/* ── CENTER + RIGHT: CHART or SECTION CONTENT ── */}
        {tDrawer ? (
          <div style={{ gridColumn: "2 / 3", display: "flex", flexDirection: "column", overflow: "hidden", borderRight: `1px solid ${C.border}` }}>
            <div style={{ padding: "6px 16px", background: C.surface, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <span style={tEyebrow}>{tDrawer}</span>
              <button onClick={() => setTDrawer(null)} aria-label="Close" title="Close" style={tCloseBtn}>{tCloseX}</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
              {/* Render inline playbook content */}
              {tDrawer === "playbook" && (() => {
                const bullAgeMo = Math.round((Date.now() - new Date("2022-10-12")) / (30.44 * 86400000));
                const md = macroData;
                const SPY_TROUGH = 357.70, seedATH = 749.53;
                const spyPrice = (bmQuotes.SPY || quotesRef.current?.SPY)?.p || 0;
                const storedATH = (() => { try { return parseFloat(localStorage.getItem("iown_spy_ath")) || 0; } catch { return 0; } })();
                const liveATH = Math.max(spyPrice, storedATH, seedATH);
                const pctFromTrough = spyPrice > 0 ? ((spyPrice / SPY_TROUGH) - 1) * 100 : 0;
                const pctFromATH = spyPrice > 0 ? ((spyPrice / liveATH) - 1) * 100 : 0;
                const drawdown = Math.min(pctFromATH, 0);
                const officialBears = PB_BEAR_MARKETS.filter(b => !b.nearBear);
                const avgBearDraw = Math.round(officialBears.reduce((s, b) => s + b.drawdown, 0) / officialBears.length * 10) / 10;
                const avgBearDur = Math.round(officialBears.reduce((s, b) => s + b.durationMo, 0) / officialBears.length * 10) / 10;
                const avgRecovery = Math.round(officialBears.reduce((s, b) => s + b.recoveryMo, 0) / officialBears.length * 10) / 10;
                const avgBullGain = 135.9;
                return (<div style={{ maxWidth: 920 }}>
                  <div style={tTabRow}>
                    {[{ v: "regime", l: "Regime" }, { v: "probability", l: "Probability" }].map(({ v, l }) => (
                      <button key={v} onClick={() => setPbView(["regime", "probability"].includes(v) ? v : "regime")} style={tTabBtn((pbView === v) || (v === "regime" && !["regime", "probability"].includes(pbView)))}>{l}</button>
                    ))}
                  </div>
                  {pbView === "regime" && (<div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
                      {tStat("Bull Age", <>{bullAgeMo}<span style={{ fontSize: 12, color: C.t3 }}> months</span></>)}
                      {tStat("From Trough", `+${pctFromTrough.toFixed(1)}%`, C.up)}
                      {tStat("From ATH", `${pctFromATH >= 0 ? "+" : ""}${pctFromATH.toFixed(1)}%`, pctFromATH >= 0 ? C.up : C.dn)}
                    </div>
                    <div style={{ ...tEyebrow, marginBottom: 8 }}>Distance to Bear Market</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
                      {tStat("Regime", drawdown <= -20 ? "BEAR" : "BULL", drawdown <= -20 ? C.dn : C.up)}
                      {tStat("Bear At", `$${(liveATH * 0.8).toFixed(2)}`, C.dn)}
                      {drawdown <= -20 ? tStat("Status", "BEAR", C.dn) : tStat("Cushion", `${(20 - Math.abs(drawdown)).toFixed(1)}%`, (20 - Math.abs(drawdown)) > 15 ? C.up : (20 - Math.abs(drawdown)) > 8 ? C.warn : C.dn)}
                    </div>
                    <div style={{ ...tEyebrow, marginBottom: 8 }}>Macro Indicators</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                      {md.yieldSpread != null && tStat("Yield Curve", `${md.yieldSpread >= 0 ? "+" : ""}${md.yieldSpread.toFixed(2)}%`, md.yieldSpread < 0 ? C.dn : C.up)}
                      {md.spyPE != null && tStat("SPY P/E", `${md.spyPE.toFixed(1)}x`, md.spyPE > 30 ? C.dn : md.spyPE > 25 ? C.warn : C.up)}
                      {md.sahmVal != null && tStat("Sahm Rule", `${md.sahmVal.toFixed(2)}pp`, md.sahmVal > 0.5 ? C.dn : md.sahmVal > 0.3 ? C.warn : C.up)}
                      {md.cfnai != null && tStat("CFNAI", md.cfnai.toFixed(2), md.cfnai < -0.7 ? C.dn : md.cfnai < -0.2 ? C.warn : C.up)}
                      {md.baa10y != null && tStat("Credit Spread", `${md.baa10y.toFixed(2)}%`, md.baa10y > 3.5 ? C.dn : md.baa10y > 2.5 ? C.warn : C.up)}
                      {md.claims4wk != null && tStat("Jobless Claims", `${(md.claims4wk / 1000).toFixed(0)}K`, md.claimsTrend > 10 ? C.dn : md.claimsTrend > 0 ? C.warn : C.up)}
                    </div>
                  </div>)}
                  {(pbView === "regime" || !["regime", "probability"].includes(pbView)) && (<div>
                    <div style={{ ...tEyebrow, marginBottom: 8 }}>Bear Market Deployment Tranches</div>
                    <div style={{ fontSize: 11, color: C.t3, marginBottom: 12, lineHeight: 1.6 }}>Two-tranche system: deploy 70% at -25%, remaining 30% at -40%. Front-loaded because -25% has the highest expected-value-per-dollar across 22 historical bears (87% hit rate × 33% recovery return = 29¢ per $1 deployed).</div>
                    {PB_BEAR_TRANCHES.map((t, i) => {
                      const triggered = drawdown <= t.drawdownTrigger;
                      return (
                        <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 14, padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                          <span style={{ fontSize: 16, fontWeight: 700, color: triggered ? C.dn : C.t2, fontVariantNumeric: "tabular-nums", width: 56, flexShrink: 0 }}>{t.drawdownTrigger}%</span>
                          <span style={{ flex: 1, fontSize: 11, color: triggered ? C.t1 : C.t3, lineHeight: 1.5 }}>
                            <span>{t.action}</span>
                            <span style={{ color: C.accent, marginLeft: 8 }}>· {t.deploy}</span>
                          </span>
                          <span style={{ ...tEyebrowMuted, color: triggered ? C.dn : C.t4, flexShrink: 0 }}>{triggered ? "TRIGGERED" : "STANDBY"}</span>
                        </div>
                      );
                    })}
                    <div style={{ ...tEyebrow, margin: "16px 0 8px" }}>5-Year Bond Ladder</div>
                    <div style={{ fontSize: 11, color: C.t3, lineHeight: 1.7 }}>
                      Clients with bonds hold <strong style={{ color: C.t1 }}>5 years of living expenses</strong> across a bond ladder (Years 1-5). Year 1 matures each year to fund living expenses, and the ladder rolls forward. In a bear market, <strong style={{ color: C.t1 }}>only Year-5 bonds</strong> are touched — deploy 70% at -25% and the remaining 30% at -40%. When the market recovers to the prior peak, rebuild the Year-5 position from equity gains.
                    </div>
                  </div>)}
                  {false && (() => {
                    const historicalBears = PB_BEAR_MARKETS.filter(b => !b.nearBear && Math.abs(b.drawdown) >= 20);
                    const selectedBear = historicalBears.find(b => b.name === pbSimHistBear);
                    const dropPct = selectedBear ? Math.abs(selectedBear.drawdown) : pbSimDrop;
                    const bondPerYear = pbSimBondPerYear, equityVal = pbSimEquity;
                    const totalBonds = 5 * bondPerYear, bondsKept = 4 * bondPerYear, cashReserves = bondPerYear;
                    const portfolioVal = totalBonds + equityVal;
                    let remainingCash = cashReserves, totalDeployed = 0;
                    const deployedAtLevels = [];
                    const trancheResults = PB_BEAR_TRANCHES.map(t => {
                      if (dropPct >= Math.abs(t.drawdownTrigger)) {
                        const actualDeploy = Math.min(cashReserves * (t.pctReserves / 100), remainingCash);
                        remainingCash -= actualDeploy; totalDeployed += actualDeploy;
                        deployedAtLevels.push({ level: t.drawdownTrigger, amount: actualDeploy });
                        return { ...t, deployed: actualDeploy, triggered: true };
                      }
                      return { ...t, deployed: 0, triggered: false };
                    });
                    const equityAfterDrop = equityVal * (1 - dropPct / 100);
                    let deployedValueAtBottom = 0;
                    for (const d of deployedAtLevels) deployedValueAtBottom += d.amount * (1 - dropPct / 100) / (1 - Math.abs(d.level) / 100);
                    const portfolioAtBottom = bondsKept + remainingCash + equityAfterDrop + deployedValueAtBottom;
                    const bhAtBottom = totalBonds + equityAfterDrop;
                    const saved = portfolioAtBottom - bhAtBottom;
                    let deploymentAlpha = 0;
                    for (const d of deployedAtLevels) { const bd = Math.abs(d.level); deploymentAlpha += d.amount * (bd / (100 - bd)); }
                    const recoveryGain = dropPct / (100 - dropPct) * 100;
                    const fmt$ = v => `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
                    const inputStyle = { width: "100%", padding: "6px 10px", borderRadius: 2, border: `1px solid ${C.border}`, background: C.surface, color: C.t1, fontSize: 12, fontWeight: 600, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
                    return (<div>
                      <div style={{ ...tEyebrow, marginBottom: 8 }}>Bond-Deploy Scenario Simulator</div>
                      <select value={pbSimHistBear} onChange={e => { setPbSimHistBear(e.target.value); if (e.target.value) { const b = historicalBears.find(x => x.name === e.target.value); if (b) setPbSimDrop(Math.abs(b.drawdown)); } }} style={{ ...inputStyle, marginBottom: 10, appearance: "auto" }}>
                        <option value="">Custom scenario (use slider)</option>
                        {historicalBears.map(b => <option key={b.name} value={b.name}>{b.name} ({b.peakDate}) — {b.drawdown}% in {b.durationMo}mo</option>)}
                      </select>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                        <div>
                          <div style={{ ...tEyebrowMuted, marginBottom: 4 }}>Per-Bond Amount</div>
                          <input type="text" value={`$${bondPerYear.toLocaleString()}`} onChange={e => { const v = parseInt(e.target.value.replace(/[^0-9]/g, "")); if (v >= 0) setPbSimBondPerYear(v); }} style={inputStyle} />
                        </div>
                        <div>
                          <div style={{ ...tEyebrowMuted, marginBottom: 4 }}>Equity Sleeve</div>
                          <input type="text" value={`$${equityVal.toLocaleString()}`} onChange={e => { const v = parseInt(e.target.value.replace(/[^0-9]/g, "")); if (v >= 0) setPbSimEquity(v); }} style={inputStyle} />
                        </div>
                        <div>
                          <div style={{ ...tEyebrowMuted, marginBottom: 4 }}>Market Drop: -{dropPct}%</div>
                          <input type="range" min={10} max={60} value={dropPct} onChange={e => { setPbSimDrop(Number(e.target.value)); setPbSimHistBear(""); }} style={{ width: "100%", accentColor: C.dn }} />
                        </div>
                      </div>
                      <div style={{ fontSize: 10, color: C.t4, marginBottom: 12 }}>Total portfolio {fmt$(portfolioVal)} · reserve = Year-5 bond {fmt$(cashReserves)} · deploy {fmt$(cashReserves * 0.7)} at -25%, {fmt$(cashReserves * 0.3)} at -40%</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 12 }}>
                        {tStat("Passive at Bottom", fmt$(bhAtBottom), C.dn)}
                        {tStat("Playbook at Bottom", fmt$(portfolioAtBottom), C.t1)}
                        {tStat("Deployed", fmt$(totalDeployed), C.accent)}
                      </div>
                      {trancheResults.map((t, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", background: t.triggered ? C.upSoft : C.card, border: `1px solid ${t.triggered ? C.up + "33" : C.border}`, marginBottom: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: t.triggered ? C.dn : C.t4, width: 48 }}>{t.drawdownTrigger}%</span>
                          <span style={{ flex: 1, fontSize: 11, color: t.triggered ? C.t1 : C.t4 }}>{t.triggered ? `Deploys $${t.deployed.toLocaleString(undefined, { maximumFractionDigits: 0 })} into equities` : "Not triggered at this drop level"}</span>
                          <span style={{ ...tEyebrowMuted, color: t.triggered ? C.up : C.t4 }}>{t.triggered ? "FIRED" : "—"}</span>
                        </div>
                      ))}
                      <div style={{ ...tEyebrow, margin: "12px 0 8px" }}>After Full Recovery</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                        {tStat("Passive", fmt$(totalBonds + equityVal), C.t3)}
                        {tStat("Playbook", fmt$(totalBonds + equityVal + deploymentAlpha), C.up)}
                        {tStat("Deploy Alpha", `+${fmt$(deploymentAlpha)}`, C.accent)}
                        {tStat("Recovery Needed", `+${recoveryGain.toFixed(0)}%`, C.t1)}
                      </div>
                      {saved !== 0 && <div style={{ fontSize: 10, color: saved >= 0 ? C.up : C.dn, marginTop: 8 }}>{saved >= 0 ? "+" : ""}{fmt$(saved)} vs passive at the bottom</div>}
                    </div>);
                  })()}
                  {pbView === "probability" && (() => {
                    const interp = (val, pts) => {
                      if (val <= pts[0][0]) return pts[0][1];
                      if (val >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
                      for (let i = 1; i < pts.length; i++) {
                        if (val <= pts[i][0]) { const t = (val - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]); return Math.round(pts[i - 1][1] + t * (pts[i][1] - pts[i - 1][1])); }
                      }
                      return pts[pts.length - 1][1];
                    };
                    const factors = [];
                    {
                      const yc = (md.yield10Y != null && md.yield3M != null) ? md.yield10Y - md.yield3M : md.yieldSpread;
                      if (yc != null) {
                        let score = interp(yc, [[-2.5, 92], [-1.2, 80], [-0.5, 64], [0.0, 46], [0.7, 30], [1.5, 18], [2.5, 10], [3.5, 5]]);
                        const monthsSinceDeInversion = Math.max(0, (Date.now() - new Date("2024-10-01")) / (30.44 * 86400000));
                        const postInvPremium = monthsSinceDeInversion < 24 && yc > 0 ? Math.round(18 * (1 - monthsSinceDeInversion / 24)) : 0;
                        score = Math.min(95, score + postInvPremium);
                        factors.push({ name: "Yield Curve", value: `${yc > 0 ? "+" : ""}${yc.toFixed(2)}%`, score, weight: 18 });
                      }
                    }
                    if (md.spyPE != null) factors.push({ name: "Valuation", value: `${md.spyPE.toFixed(1)}x P/E`, score: interp(md.spyPE, [[12, 5], [16, 15], [19, 30], [21, 42], [24, 52], [28, 62], [32, 72], [36, 80], [40, 85]]), weight: 13 });
                    if (md.baa10y != null) factors.push({ name: "Credit Spreads", value: `${md.baa10y.toFixed(2)}%`, score: interp(md.baa10y, [[1.2, 8], [1.5, 15], [1.8, 22], [2.2, 32], [2.8, 48], [3.5, 65], [4.5, 80], [5.5, 90]]), weight: 10 });
                    else if (md.hygPrice != null && md.hyg52High > 0) { const dd = ((md.hygPrice / md.hyg52High) - 1) * 100; factors.push({ name: "Credit Stress", value: `${dd.toFixed(1)}% from high`, score: interp(dd, [[-18, 90], [-12, 75], [-7, 55], [-4, 35], [-2, 20], [0, 8]]), weight: 10 }); }
                    if (md.nfci != null) factors.push({ name: "Financial Conditions", value: `NFCI ${md.nfci >= 0 ? "+" : ""}${md.nfci.toFixed(2)}`, score: interp(md.nfci, [[-0.7, 5], [-0.3, 12], [0, 25], [0.3, 42], [0.6, 58], [1.0, 72], [1.5, 84], [2.5, 92]]), weight: 10 });
                    if (md.claimsTrend != null) factors.push({ name: "Jobless Claims", value: `${md.claims4wk?.toLocaleString()} 4wk`, score: interp(md.claimsTrend, [[-15, 5], [-5, 12], [0, 22], [5, 38], [10, 55], [20, 72], [35, 85], [50, 92]]), weight: 12 });
                    if (md.cfnai != null) factors.push({ name: "Economic Activity", value: `CFNAI ${md.cfnai.toFixed(2)}`, score: interp(md.cfnai3mo != null ? md.cfnai3mo : md.cfnai, [[-1.5, 92], [-0.7, 75], [-0.35, 55], [0, 35], [0.2, 20], [0.5, 10], [1.0, 5]]), weight: 8 });
                    if (md.sahmVal != null) factors.push({ name: "Sahm Rule", value: `${md.sahmVal.toFixed(2)}pp`, score: interp(md.sahmVal, [[0, 5], [0.15, 15], [0.3, 35], [0.4, 55], [0.5, 75], [0.7, 88], [1.0, 95]]), weight: 7 });
                    if (md.oilYoY != null) factors.push({ name: "Oil Shock", value: `${md.oilYoY >= 0 ? "+" : ""}${md.oilYoY.toFixed(1)}% YoY`, score: interp(md.oilYoY, [[-20, 5], [-5, 10], [10, 18], [25, 32], [40, 50], [60, 68], [85, 82], [120, 92]]), weight: 5 });
                    if (md.epsChg90d != null) factors.push({ name: "EPS Trend", value: `${md.epsChg90d >= 0 ? "+" : ""}${md.epsChg90d.toFixed(1)}% (90d)`, score: interp(md.epsChg90d, [[-8, 90], [-5, 75], [-3, 58], [-1, 42], [0, 30], [2, 18], [4, 10], [6, 5]]), weight: 7 });
                    const totalWeight = factors.reduce((a, f) => a + f.weight, 0);
                    const baseComposite = totalWeight > 0 ? factors.reduce((a, f) => a + f.score * (f.weight / totalWeight), 0) : null;
                    const elevatedCount = factors.filter(f => f.score >= 50).length;
                    const concordanceBonus = elevatedCount >= 4 ? 15 : elevatedCount >= 3 ? 10 : elevatedCount >= 2 ? 5 : 0;
                    const rawComposite = baseComposite != null ? Math.min(95, Math.max(5, Math.round(baseComposite + concordanceBonus))) : null;
                    const _bp = bearModelProbability(md, backtest);
                    let isotonic = rawComposite;
                    if (rawComposite != null && backtest?.buckets) { const b = backtest.buckets.find(b => rawComposite >= b.lo && rawComposite < b.hi); if (b && b.n > 0) isotonic = Math.round(b.rate); }
                    const composite = _bp?.calibrated != null ? Math.round(_bp.calibrated * 100) : isotonic;
                    const compositeColor = composite > 60 ? C.dn : composite > 40 ? C.warn : C.up;
                    const riskLabel = composite > 70 ? "VERY HIGH" : composite > 55 ? "HIGH" : composite > 40 ? "ELEVATED" : composite > 25 ? "MODERATE" : "LOW";
                    return (<div>
                      <div style={{ ...tEyebrow, marginBottom: 8 }}>Bear Probability — 12 Month Outlook</div>
                      {composite != null ? (
                        <div style={{ background: C.card, border: `1px solid ${compositeColor}30`, padding: "16px 18px", marginBottom: 14, display: "flex", alignItems: "baseline", gap: 14 }}>
                          <span style={{ fontSize: 40, fontWeight: 700, color: compositeColor, lineHeight: 1 }}>{composite}%</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: compositeColor, letterSpacing: 2 }}>{riskLabel}</span>
                          <span style={{ fontSize: 10, color: C.t4 }}>{_bp?.raw != null ? `Raw LR ${Math.round(_bp.raw * 100)}% — bucket-calibrated · heuristic ${rawComposite}` : `${factors.length}-factor composite${concordanceBonus > 0 ? ` + ${concordanceBonus}pt concordance` : ""}`}</span>
                        </div>
                      ) : <div style={{ ...tEyebrowMuted, padding: 16 }}>LOADING MACRO INDICATORS</div>}
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                        <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                          <th style={tTh("left", false)}>Factor</th><th style={tTh("right", false)}>Value</th><th style={tTh("right", false)}>Score</th><th style={tTh("right", false)}>Weight</th><th style={{ ...tTh("left", false), width: "30%" }}></th>
                        </tr></thead>
                        <tbody>
                          {factors.map(f => { const col = f.score > 50 ? C.dn : f.score > 30 ? C.warn : C.up; return (
                            <tr key={f.name} style={{ borderBottom: `1px solid ${C.border}` }}>
                              <td style={{ ...tTd("left"), fontWeight: 600, color: C.t1 }}>{f.name}</td>
                              <td style={{ ...tTd(), color: C.t2 }}>{f.value}</td>
                              <td style={{ ...tTd(), fontWeight: 700, color: col }}>{f.score}</td>
                              <td style={{ ...tTd(), color: C.t4 }}>{f.weight}%</td>
                              <td style={tTd("left")}><div style={{ height: 4, background: C.card, width: "100%" }}><div style={{ height: "100%", width: `${f.score}%`, background: col }} /></div></td>
                            </tr>
                          ); })}
                        </tbody>
                      </table>
                      {md.updated && <div style={{ fontSize: 10, color: C.t4, marginTop: 8 }}>Macro data updated {ago(md.updated)}</div>}
                    </div>);
                  })()}
                  {false && (() => {
                    const scripts = [
                      { regime: "Bull Market — Staying Invested", condition: "Market within 10% of peak", active: drawdown > -10, subject: "Portfolio Update: Staying the Course", body: `The S&P 500 is up ${pctFromTrough.toFixed(0)}% from the October 2022 low, and our portfolios are performing well. Our playbook calls for staying fully invested in equities through bull markets.\n\nYour bond ladder remains in place, funding the next several years of expenses and serving as deployment ammunition for when the next bear market arrives.` },
                      { regime: "Correction — Down 10-20%", condition: "S&P down 10-20% from peak", active: drawdown <= -10 && drawdown > -20, subject: "Market Update: Correction in Progress — The Plan Is Working", body: `The S&P 500 is down approximately ${Math.abs(drawdown).toFixed(0)}% from its recent high. This is normal, and we have a plan for exactly this situation.\n\nAt this level, our playbook says to hold. We haven't hit our first deployment threshold (-25%). Historically, the market has experienced 27 declines of -15% or more since 1929. Every single one eventually recovered.` },
                      { regime: "Bear Market — Tranche 1", condition: "S&P down 25%+ from peak", active: drawdown <= -25 && drawdown > -40, subject: "DEPLOYING: First Tranche Into the Market", body: `The S&P 500 is now down ${Math.abs(drawdown).toFixed(0)}% from its peak — we've hit our first deployment threshold.\n\nPer our investment playbook, we're deploying 70% of your bond-ladder reserves back into equities at these levels. 87% of historical bear markets have reached this level — it's the single highest expected-value entry point.` },
                      { regime: "Bear Market — Tranche 2", condition: "S&P down 40%+ from peak", active: drawdown <= -40, subject: "DEPLOYING: Final Tranche — Deep Bear Territory", body: `The S&P 500 is now down ${Math.abs(drawdown).toFixed(0)}% from its peak. Only 32% of bear markets reach this depth.\n\nWe're deploying all remaining bond reserves into equities. Stocks purchased at -40% from peak have historically delivered +67% returns by the time the market recovers to its prior high.` },
                    ];
                    return (<div>
                      <div style={{ fontSize: 11, color: C.t3, marginBottom: 12 }}>Pre-written client communications per regime. The active script matches current conditions.</div>
                      {scripts.map((s, i) => (
                        <div key={i} style={{ background: C.card, border: `1px solid ${s.active ? C.accentGlow : C.border}`, padding: "12px 14px", marginBottom: 10 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ ...tEyebrowMuted, color: s.active ? C.accent : C.t4 }}>{s.regime}</span>
                            {s.active && <span style={tEyebrow}>Active Now</span>}
                          </div>
                          <div style={{ fontSize: 10, color: C.t4, marginBottom: 8 }}>{s.condition}</div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: C.t1, marginBottom: 6 }}>Subject: {s.subject}</div>
                          <div style={{ fontSize: 11, color: C.t3, lineHeight: 1.6, whiteSpace: "pre-wrap", marginBottom: 8 }}>{s.body}</div>
                          <button onClick={() => { navigator.clipboard.writeText(`Subject: ${s.subject}\n\n${s.body}`); }} style={{ padding: "4px 12px", borderRadius: 2, border: `1px solid ${C.border}`, background: "transparent", color: C.t3, fontSize: 10, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit" }}>Copy</button>
                        </div>
                      ))}
                    </div>);
                  })()}
                  {(pbView === "regime" || !["regime", "probability"].includes(pbView)) && (<div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 14, marginTop: 16 }}>
                      {tStat("Avg Bear Drawdown", `${avgBearDraw}%`, C.dn)}
                      {tStat("Avg Bear Duration", `${avgBearDur} mo`)}
                      {tStat("Avg Recovery", `${avgRecovery} mo`)}
                      {tStat("Avg Bull Gain", `+${avgBullGain}%`, C.up)}
                    </div>
                    <div style={{ ...tEyebrow, marginBottom: 6 }}>Bear Markets & Near-Bear Corrections Since 1929</div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, marginBottom: 16 }}>
                      <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                        <th style={tTh("left", false)}>Event</th><th style={tTh("right", false)}>Peak</th><th style={tTh("right", false)}>Trough</th><th style={tTh("right", false)}>Close</th><th style={tTh("right", false)}>Intraday</th><th style={tTh("right", false)}>Dur</th><th style={tTh("right", false)}>Recov</th>
                      </tr></thead>
                      <tbody>
                        {PB_BEAR_MARKETS.map((b, i) => (
                          <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                            <td style={{ ...tTd("left"), fontWeight: 600, color: b.nearBear ? C.warn : C.t2 }}>{b.name}{b.nearBear ? " *" : ""}</td>
                            <td style={{ ...tTd(), color: C.t3 }}>{b.peakDate}</td>
                            <td style={{ ...tTd(), color: C.t3 }}>{b.troughDate}</td>
                            <td style={{ ...tTd(), fontWeight: 700, color: C.dn }}>{b.drawdown}%</td>
                            <td style={{ ...tTd(), color: b.intradayDraw ? C.dn : C.t4 }}>{b.intradayDraw ? `${b.intradayDraw}%` : "—"}</td>
                            <td style={{ ...tTd(), color: C.t3 }}>{b.durationMo}mo</td>
                            <td style={{ ...tTd(), color: C.t3 }}>{b.recoveryMo}mo</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ fontSize: 10, color: C.t4, marginBottom: 16 }}>* near-bear correction (-19% to -21% intraday)</div>
                    <div style={{ ...tEyebrow, marginBottom: 6 }}>Bull Markets Since 1929</div>
                    <table style={{ width: "100%", maxWidth: 420, borderCollapse: "collapse", fontSize: 11 }}>
                      <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                        <th style={tTh("left", false)}>Period</th><th style={tTh("right", false)}>Gain</th><th style={tTh("right", false)}>Duration</th>
                      </tr></thead>
                      <tbody>
                        {[...PB_BULL_MARKETS_BASE, { period: "2022-present", gain: Math.round(pctFromTrough * 10) / 10, durationMo: Math.round(bullAgeMo * 10) / 10 }].map((b, i) => {
                          const isCurrent = b.period.includes("present");
                          return (
                            <tr key={i} style={{ borderBottom: `1px solid ${C.border}`, background: isCurrent ? C.accentSoft : "transparent" }}>
                              <td style={{ ...tTd("left"), fontWeight: 600, color: isCurrent ? C.t1 : C.t2 }}>{b.period}{isCurrent ? " — CURRENT" : ""}</td>
                              <td style={{ ...tTd(), fontWeight: 700, color: C.up }}>+{b.gain}%</td>
                              <td style={{ ...tTd(), color: C.t3 }}>{b.durationMo}mo</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>)}
                  {false && (<div>
                    <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: "16px 18px", marginBottom: 14 }}>
                      <div style={{ ...tEyebrowMuted, marginBottom: 6 }}>Bond-Deploy Alpha vs Passive Bond-Holding</div>
                      <div style={{ fontSize: 34, fontWeight: 700, color: C.up, lineHeight: 1 }}>+3.67%</div>
                      <div style={{ fontSize: 11, color: C.t3, marginTop: 6 }}>mean alpha per bull-bear cycle · 14 historical cycles · 1932-2024 · <span style={{ color: C.up, fontWeight: 700 }}>71% positive</span></div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 14 }}>
                      {tStat("Mean Alpha", "+3.67%", C.up)}
                      {tStat("Median Alpha", "+4.49%", C.up)}
                      {tStat("Cycles Positive", "71%")}
                      {tStat("LR Model AUC", "0.82")}
                    </div>
                    <div style={{ ...tEyebrow, marginBottom: 8 }}>The Three Mechanisms</div>
                    {[
                      { num: "1", title: "5-Year Bond Ladder Floor", desc: "Five bonds, each one year of living expenses. Year 1 matures each year to fund expenses. The floor guarantees the client never has to sell equity at a bear-market bottom to fund income." },
                      { num: "2", title: "Bear-Probability Ladder Thickening", desc: "When the 7-factor logistic-regression model (walk-forward AUC 0.82) shows bear probability > 40%, add a 6th bond. Above 55%, add a 7th. Extra bonds become pre-positioned deployment reserve." },
                      { num: "3", title: "2-Tranche Deployment (-25% / -40%)", desc: "Deploy 70% of deployable bonds at -25% and remaining 30% at -40%. Front-loaded because -25% has the highest expected-value per dollar (87% hit rate × 33% recovery return)." },
                    ].map(m => (
                      <div key={m.num} style={{ display: "flex", gap: 12, padding: "10px 12px", background: C.card, border: `1px solid ${C.border}`, marginBottom: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: C.accent, flexShrink: 0 }}>{m.num}</span>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: C.t1, marginBottom: 2 }}>{m.title}</div>
                          <div style={{ fontSize: 11, color: C.t3, lineHeight: 1.6 }}>{m.desc}</div>
                        </div>
                      </div>
                    ))}
                    <div style={{ fontSize: 11, color: C.t3, lineHeight: 1.7, marginTop: 8 }}>The behavioral alpha is larger than the deploy alpha: the average equity investor underperforms the S&P 500 by 300-400 bps/yr (Dalbar QAIB 2024), almost entirely from panic selling during drawdowns. A visible, rules-based framework shifts the psychology from "I'm losing money" to "the plan is working."</div>
                  </div>)}
                </div>);
              })()}
              {tDrawer === "opportunities" && (oppDetail ? (() => {
                const o = oppDetail;
                const convColor = o.conviction === "High Conviction" ? C.up : o.conviction === "On Our Radar" ? C.accent : C.t3;
                return (<div style={{ maxWidth: 760 }}>
                  <button onClick={() => setOppDetail(null)} style={{ ...tBackBtn, marginBottom: 14 }}>← BACK</button>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.t1, lineHeight: 1.3, marginBottom: 6 }}>{o.title}</div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
                    <span style={{ ...tEyebrowMuted, color: convColor }}>{o.conviction}</span>
                    {o.pattern && <span style={tEyebrowMuted}>{o.pattern}</span>}
                    {o.timeframe && <span style={{ fontSize: 10, color: C.t4 }}>{o.timeframe}</span>}
                    {o.date_identified && <span style={{ fontSize: 10, color: C.t4 }}>{o.date_identified}</span>}
                  </div>
                  {o.summary && <div style={{ fontSize: 12, color: C.t2, lineHeight: 1.6, fontStyle: "italic", marginBottom: 14, paddingLeft: 10, borderLeft: `2px solid ${C.accent}` }}>{o.summary}</div>}
                  {o.catalyst && (<><div style={{ ...tEyebrow, marginBottom: 6 }}>Catalyst</div><div style={{ fontSize: 12, color: C.t2, lineHeight: 1.7, marginBottom: 14 }}>{o.catalyst}</div></>)}
                  {o.thesis && (<><div style={{ ...tEyebrow, marginBottom: 6 }}>Investment Thesis</div><div style={{ fontSize: 12, color: C.t2, lineHeight: 1.7, marginBottom: 14 }}>{o.thesis}</div></>)}
                  {o.counter_thesis && (<><div style={{ ...tEyebrow, marginBottom: 6, color: C.dn }}>Counter-Thesis</div><div style={{ fontSize: 11, color: C.t3, lineHeight: 1.7, fontStyle: "italic", marginBottom: 14 }}>{o.counter_thesis}</div></>)}
                  {o.trade_construction && (<>
                    <div style={{ ...tEyebrow, marginBottom: 6 }}>Trade Construction</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
                      {o.trade_construction.entry_zone && tStat("Entry Zone", o.trade_construction.entry_zone)}
                      {o.trade_construction.target_12mo && tStat("12-Mo Target", o.trade_construction.target_12mo, C.up)}
                      {o.trade_construction.stop_loss && tStat("Stop Loss", o.trade_construction.stop_loss, C.dn)}
                      {o.trade_construction.position_size_pct && tStat("Position Size", o.trade_construction.position_size_pct)}
                    </div>
                  </>)}
                  {o.catalyst_calendar?.length > 0 && (<>
                    <div style={{ ...tEyebrow, marginBottom: 6 }}>Catalyst Calendar</div>
                    <div style={{ marginBottom: 14 }}>{o.catalyst_calendar.map((c2, i) => <div key={i} style={{ display: "flex", gap: 10, fontSize: 11, padding: "3px 0", borderBottom: `1px solid ${C.border}` }}><span style={{ color: C.accent, fontWeight: 700, minWidth: 80 }}>{c2.date}</span><span style={{ color: C.t2 }}>{c2.event}{c2.ticker ? ` (${c2.ticker})` : ""}</span></div>)}</div>
                  </>)}
                  {o.tickers?.length > 0 && (<>
                    <div style={{ ...tEyebrow, marginBottom: 6 }}>Ticker Analysis</div>
                    <div style={{ marginBottom: 14 }}>
                      {o.tickers.map(t => (
                        <div key={t} style={{ background: C.card, border: `1px solid ${C.border}`, padding: "10px 12px", marginBottom: 8 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: C.accent }}>{t}</span>
                            <button onClick={() => { setOppDetail(null); setTDrawer("screener"); setScreenerDetailLoading(true); setScreenerDetail({ ticker: t }); fetch(`https://richacarson.github.io/Stock-Screener/reports/${t}.json`).then(r => r.ok ? r.json() : { ticker: t }).then(d => { setScreenerDetail(d); setScreenerDetailLoading(false); }).catch(() => { setScreenerDetail({ ticker: t }); setScreenerDetailLoading(false); }); }} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 2, padding: "2px 8px", color: C.t3, fontSize: 9, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit" }}>Screener Report</button>
                          </div>
                          {o.ticker_rationale?.[t] && <div style={{ fontSize: 11, color: C.t2, lineHeight: 1.6 }}>{o.ticker_rationale[t]}</div>}
                          {o.in_portfolio_status?.[t] && <div style={{ fontSize: 10, color: C.t4, marginTop: 4 }}>Current {o.in_portfolio_status[t].current_weight}% · Target {o.in_portfolio_status[t].target_weight}%{o.in_portfolio_status[t].action ? ` · ${o.in_portfolio_status[t].action}` : ""}</div>}
                        </div>
                      ))}
                    </div>
                  </>)}
                  {o.risks?.length > 0 && (<>
                    <div style={{ ...tEyebrow, marginBottom: 6, color: C.dn }}>Key Risks</div>
                    <div style={{ marginBottom: 14 }}>{o.risks.map((r2, i) => <div key={i} style={{ fontSize: 11, color: C.t2, lineHeight: 1.6, marginBottom: 4 }}><span style={{ color: C.dn }}>{i + 1}.</span> {typeof r2 === "string" ? r2 : r2.description || r2.risk || ""}</div>)}</div>
                  </>)}
                  {o.invalidation?.length > 0 && (<>
                    <div style={{ ...tEyebrow, marginBottom: 6, color: C.warn }}>What Would Change My Mind</div>
                    <div style={{ marginBottom: 14 }}>{o.invalidation.map((t2, i) => <div key={i} style={{ fontSize: 11, color: C.t2, lineHeight: 1.6, marginBottom: 4 }}><span style={{ color: C.warn }}>{i + 1}.</span> {typeof t2 === "string" ? t2 : t2.trigger || t2.description || ""}</div>)}</div>
                  </>)}
                  {o.body_md && (<><div style={{ ...tEyebrow, marginBottom: 6 }}>Research Report</div><div style={{ marginBottom: 14 }}>{renderMarkdown(o.body_md)}</div></>)}
                  {o.sources?.length > 0 && (<>
                    <div style={{ ...tEyebrow, marginBottom: 6 }}>Sources</div>
                    {o.sources.map((s2, i) => <div key={i} style={{ fontSize: 10, color: C.t4, lineHeight: 1.5, marginBottom: 4 }}>{i + 1}. {typeof s2 === "string" ? s2 : s2.url ? <a href={s2.url} target="_blank" rel="noopener noreferrer" style={{ color: C.accent }}>{s2.title || s2.url}</a> : (s2.title || s2.source || "")}{typeof s2 !== "string" && (s2.publisher || s2.date) ? ` — ${[s2.publisher, s2.date].filter(Boolean).join(", ")}` : ""}</div>)}
                  </>)}
                </div>);
              })() : (<div style={{ maxWidth: 920 }}>
                <div style={tTabRow}>
                  {[
                    { v: "opportunities", l: `Opportunities${opportunities.length ? ` (${opportunities.length})` : ""}` },
                    { v: "stalking", l: `Stalking${oppStalking.length ? ` (${oppStalking.length})` : ""}` },
                    { v: "ledger", l: `Ledger${oppLedger.length ? ` (${oppLedger.length})` : ""}` },
                    { v: "signals", l: "Signals" },
                  ].map(({ v, l }) => <button key={v} onClick={() => setOppView(v)} style={tTabBtn(oppView === v)}>{l}</button>)}
                </div>
                {oppView === "opportunities" && (!opportunities.length ? (
                  <div style={tEyebrowMuted}>{oppLoadDone ? "NO DATA AVAILABLE" : "LOADING OPPORTUNITIES…"}</div>
                ) : opportunities.map(opp => {
                  const convColor = opp.conviction === "High Conviction" ? C.up : opp.conviction === "On Our Radar" ? C.accent : C.t3;
                  return (
                    <div key={opp.id} onClick={() => setOppDetail(opp)} style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}`, cursor: "pointer" }} onMouseEnter={e => e.currentTarget.style.background = C.cardHover} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                        <span style={{ ...tEyebrowMuted, fontSize: 9, color: convColor }}>{opp.conviction}{opp.pattern ? ` · ${opp.pattern}` : ""}</span>
                        <span style={{ fontSize: 9, color: C.t4 }}>{[opp.date_identified, opp.timeframe].filter(Boolean).join(" · ")}</span>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.t1, marginBottom: 4 }}>{opp.title}</div>
                      {opp.tickers?.length > 0 && <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 4 }}>{opp.tickers.map(t => <span key={t} style={{ fontSize: 10, fontWeight: 700, padding: "1px 8px", borderRadius: 2, background: C.accentSoft, color: C.accent }}>{t}</span>)}</div>}
                      {opp.catalyst && <div style={{ fontSize: 11, color: C.t3, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{opp.catalyst}</div>}
                    </div>
                  );
                }))}
                {oppView === "stalking" && (!oppStalking.length ? (
                  <div style={tEyebrowMuted}>NOTHING ON THE STALKING LIST</div>
                ) : oppStalking.map((s, i) => (
                  <div key={s.id || i} style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.t1 }}>{s.title || s.id}</span>
                      <span style={{ fontSize: 9, color: C.t4 }}>{s.added ? `Added ${s.added}` : ""}</span>
                    </div>
                    {s.tickers?.length > 0 && <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 4 }}>{s.tickers.map(t => <span key={t} style={{ fontSize: 10, fontWeight: 700, padding: "1px 8px", borderRadius: 2, background: C.accentSoft, color: C.accent }}>{t}</span>)}</div>}
                    {s.catalyst && <div style={{ fontSize: 11, color: C.t2, lineHeight: 1.5 }}><span style={{ color: C.t4 }}>Catalyst:</span> {s.catalyst}</div>}
                    {s.thesis && <div style={{ fontSize: 11, color: C.t2, lineHeight: 1.5 }}><span style={{ color: C.t4 }}>Thesis:</span> {s.thesis}</div>}
                    {s.what_would_promote && <div style={{ fontSize: 10, color: C.t3, lineHeight: 1.5, marginTop: 2 }}><span style={{ color: C.t4 }}>Would promote:</span> {s.what_would_promote}</div>}
                  </div>
                )))}
                {oppView === "ledger" && (() => {
                  if (!oppLedger.length) return <div style={tEyebrowMuted}>NO CLOSED OPPORTUNITIES YET</div>;
                  const closed = oppLedger;
                  const winners = closed.filter(c2 => (c2.return_pct || 0) > 0);
                  const losers = closed.filter(c2 => (c2.return_pct || 0) < 0);
                  const avgRet = closed.length ? closed.reduce((s, c2) => s + (c2.return_pct || 0), 0) / closed.length : 0;
                  const winRate = closed.length ? winners.length / closed.length * 100 : 0;
                  return (<div>
                    <div style={{ display: "flex", gap: 20, padding: "6px 0 12px", flexWrap: "wrap" }}>
                      {[["CLOSED", closed.length, C.t1], ["WIN RATE", `${winRate.toFixed(0)}%`, winRate >= 50 ? C.up : C.dn], ["AVG RETURN", `${avgRet >= 0 ? "+" : ""}${avgRet.toFixed(1)}%`, avgRet >= 0 ? C.up : C.dn], ["W / L", `${winners.length} / ${losers.length}`, C.t1]].map(([l2, v2, col]) => (
                        <span key={l2} style={{ display: "flex", gap: 6, alignItems: "baseline" }}><span style={{ ...tEyebrowMuted, fontSize: 9 }}>{l2}</span><span style={{ fontSize: 13, fontWeight: 700, color: col }}>{v2}</span></span>
                      ))}
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                      <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                        <th style={tTh("left", false)}>ID</th><th style={tTh("right", false)}>Opened</th><th style={tTh("right", false)}>Closed</th><th style={tTh("right", false)}>Days</th><th style={tTh("left", false)}>Pattern</th><th style={tTh("right", false)}>Return</th>
                      </tr></thead>
                      <tbody>
                        {closed.map((c2, i) => (
                          <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                            <td style={{ ...tTd("left"), fontWeight: 600, color: C.t1 }}>{c2.id || c2.title}</td>
                            <td style={{ ...tTd(), color: C.t3 }}>{c2.opened || "—"}</td>
                            <td style={{ ...tTd(), color: C.t3 }}>{c2.closed || "—"}</td>
                            <td style={{ ...tTd(), color: C.t3 }}>{c2.days_held ?? "—"}</td>
                            <td style={{ ...tTd("left"), color: C.t3 }}>{c2.pattern || "—"}</td>
                            <td style={{ ...tTd(), fontWeight: 700, color: (c2.return_pct || 0) >= 0 ? C.up : C.dn }}>{(c2.return_pct || 0) >= 0 ? "+" : ""}{(c2.return_pct || 0).toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>);
                })()}
                {oppView === "signals" && (() => {
                  if (!oppSignals) return <div style={tEyebrowMuted}>NO SIGNAL DATA YET</div>;
                  const blocks = [
                    { key: "insider_clusters", title: "Insider Cluster Buys (last 14 days)" },
                    { key: "congressional", title: "Congressional Purchases (last 14 days)" },
                    { key: "institutional", title: "Institutional 13F Changes" },
                  ];
                  return (<div>
                    {oppSignals.generated_at && <div style={{ fontSize: 10, color: C.t4, marginBottom: 10 }}>Updated {oppSignals.generated_at}</div>}
                    {blocks.map(b => {
                      const items = oppSignals[b.key] || [];
                      return (
                        <div key={b.key} style={{ marginBottom: 16 }}>
                          <div style={{ ...tEyebrow, marginBottom: 6 }}>{b.title}</div>
                          {!items.length ? <div style={{ fontSize: 11, color: C.t4 }}>No signals in this category.</div> : (
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                              <tbody>
                                {items.slice(0, 15).map((it, i) => (
                                  <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                                    <td style={{ ...tTd("left"), fontWeight: 700, color: C.t1, width: 60 }}>{it.ticker}</td>
                                    <td style={{ ...tTd("left"), color: C.t3, whiteSpace: "normal" }}>{it.name || ""}{it.note ? <span style={{ color: C.t4 }}> — {it.note}</span> : ""}</td>
                                    <td style={{ ...tTd(), color: C.t3 }}>{it.buyers != null ? `${it.buyers} buyers` : ""}</td>
                                    <td style={{ ...tTd(), color: C.t3 }}>{it.total_value ? `$${typeof it.total_value === "number" ? it.total_value.toLocaleString() : it.total_value}` : ""}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      );
                    })}
                  </div>);
                })()}
              </div>))}
              {tDrawer === "screener" && (screenerDetail ? (
                <div>
                  <button onClick={() => setScreenerDetail(null)} style={{ ...tBackBtn, marginBottom: 14 }}>← BACK</button>
                  {tScreenerReport(screenerDetail, screenerDetailLoading)}
                </div>
              ) : (() => {
                const sSleeve = screenerSleeve || "All";
                const getSector = s => screenerSectors[s.ticker] || s.sector || s.profile?.sector || fundamentals[s.ticker]?.sector;
                const portfolioMap = { "Dividend": sleeves.dividend?.symbols || [], "Growth": sleeves.growth?.symbols || [], "FCI 100": sleeves.fci100?.symbols || [], "FCI Values": sleeves.fciValues?.symbols || [] };
                const meanOf = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
                const sleeveStats = Object.entries(portfolioMap).map(([key, holdings]) => {
                  const composites = holdings.map(t => screenerByTicker[t]?.overall_score).filter(v => typeof v === "number");
                  const innVals = holdings.map(t => screenerScores[t]?.inn).filter(v => typeof v === "number");
                  const infraVals = holdings.map(t => screenerScores[t]?.infra).filter(v => typeof v === "number");
                  return { key, n: composites.length, coverage: holdings.length, avg: composites.length ? Math.round(meanOf(composites)) : null, inn: innVals.length ? Math.round(meanOf(innVals) * 10) / 10 : null, infra: infraVals.length ? Math.round(meanOf(infraVals) * 10) / 10 : null };
                });
                const q = screenerSearch.toLowerCase();
                const filtered = screenerData.filter(s => {
                  if (sSleeve !== "All") { const holdings = portfolioMap[sSleeve]; if (!holdings || !holdings.includes(s.ticker)) return false; }
                  if (sSleeve === "All" && screenerTypeFilter !== "All" && s.sleeve !== screenerTypeFilter) return false;
                  if (sSleeve === "All" && screenerRecFilter !== "All" && s.recommendation !== screenerRecFilter) return false;
                  if (sSleeve === "All" && screenerSectorFilter !== "All" && getSector(s) !== screenerSectorFilter) return false;
                  if (q && !s.ticker.toLowerCase().includes(q) && !(s.name || "").toLowerCase().includes(q)) return false;
                  return true;
                });
                const scrCols = [
                  { k: "ticker", l: "Ticker", align: "left" },
                  { k: "name", l: "Name", align: "left" },
                  { k: "_sector", l: "Sector", align: "left" },
                  { k: "recommendation", l: "Rec", align: "left" },
                  { k: "overall_score", l: "Score", align: "right" },
                  { k: "_inspire", l: "Inspire", align: "right" },
                  { k: "screen_date", l: "Date", align: "right" },
                ];
                const sortVal = (s, k) => k === "_sector" ? (getSector(s) || "") : k === "_inspire" ? (screenerScores[s.ticker]?.inspire ?? null) : (s[k] ?? null);
                const sorted = [...filtered].sort((a, b) => {
                  const col = scrSort.col && scrCols.some(c2 => c2.k === scrSort.col) ? scrSort.col : null;
                  if (!col) return (b.overall_score || 0) - (a.overall_score || 0) || (a.ticker || "").localeCompare(b.ticker || "");
                  const av = sortVal(a, col), bv = sortVal(b, col);
                  if (av == null && bv == null) return 0; if (av == null) return 1; if (bv == null) return -1;
                  const cmp = (typeof av === "string") ? av.localeCompare(bv) : av - bv;
                  return scrSort.dir === "asc" ? cmp : -cmp;
                });
                const toggleScrSort = k => setScrSort(p => p.col === k ? { col: k, dir: p.dir === "desc" ? "asc" : "desc" } : { col: k, dir: "desc" });
                const openReport2 = s => { setScreenerDetailLoading(true); setScreenerDetail(s); fetch(`https://richacarson.github.io/Stock-Screener/reports/${s.ticker}.json`).then(r => r.ok ? r.json() : s).then(d => { setScreenerDetail(d); setScreenerDetailLoading(false); }).catch(() => { setScreenerDetail(s); setScreenerDetailLoading(false); }); };
                const selStyle = { flex: "1 1 140px", padding: "6px 10px", borderRadius: 2, border: `1px solid ${C.border}`, background: C.surface, color: C.t1, fontSize: 11, fontWeight: 600, fontFamily: "inherit", outline: "none", appearance: "auto" };
                const sectorOptions = Array.from(new Set(screenerData.map(getSector).filter(Boolean))).sort();
                return (<div style={{ maxWidth: 980 }}>
                  <div style={tTabRow}>
                    {["Dividend", "Growth", "FCI 100", "FCI Values", "All"].map(s => (
                      <button key={s} onClick={() => setScreenerSleeve(s)} style={tTabBtn(sSleeve === s)}>{s}</button>
                    ))}
                  </div>
                  {/* Portfolio composite summary strip */}
                  <div style={{ marginBottom: 12 }}>
                    {sleeveStats.map(st => (
                      <div key={st.key} style={{ display: "flex", gap: 16, alignItems: "baseline", padding: "3px 0", fontSize: 11 }}>
                        <span style={{ ...tEyebrowMuted, fontSize: 9, width: 84, flexShrink: 0 }}>{st.key}</span>
                        <span><span style={{ color: C.t4, fontSize: 9 }}>COMP </span><span style={{ fontWeight: 700, color: st.avg != null ? (st.avg >= 70 ? C.up : st.avg >= 50 ? C.t1 : C.warn) : C.t4 }}>{st.avg ?? "—"}</span><span style={{ color: C.t4, fontSize: 9 }}> ({st.n}/{st.coverage})</span></span>
                        <span><span style={{ color: C.t4, fontSize: 9 }}>INN </span><span style={{ fontWeight: 700, color: st.inn != null ? C.t1 : C.t4 }}>{st.inn ?? "—"}</span></span>
                        <span><span style={{ color: C.t4, fontSize: 9 }}>INFRA </span><span style={{ fontWeight: 700, color: st.infra != null ? C.t1 : C.t4 }}>{st.infra ?? "—"}</span></span>
                      </div>
                    ))}
                  </div>
                  <input value={screenerSearch} onChange={e => setScreenerSearch(e.target.value)} placeholder="Search ticker or company..." style={{ width: "100%", padding: "8px 12px", marginBottom: 8, borderRadius: 2, border: `1px solid ${C.border}`, background: C.surface, color: C.t1, fontSize: 12, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
                  {sSleeve === "All" && (
                    <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                      <select value={screenerTypeFilter} onChange={e => setScreenerTypeFilter(e.target.value)} style={selStyle}>
                        <option value="All">All Types</option>
                        <option value="Dividend">Dividend Candidates</option>
                        <option value="Growth">Growth Candidates</option>
                      </select>
                      <select value={screenerRecFilter} onChange={e => setScreenerRecFilter(e.target.value)} style={selStyle}>
                        <option value="All">All Ratings</option>
                        <option value="BUY">BUY Only</option>
                        <option value="HOLD">HOLD Only</option>
                        <option value="WATCH">WATCH Only</option>
                        <option value="SELL">SELL Only</option>
                      </select>
                      <select value={screenerSectorFilter} onChange={e => setScreenerSectorFilter(e.target.value)} style={selStyle}>
                        <option value="All">All Sectors</option>
                        {sectorOptions.map(sec => <option key={sec} value={sec}>{sec}</option>)}
                      </select>
                    </div>
                  )}
                  {!screenerData.length ? <div style={tEyebrowMuted}>{screenerLoadDone ? "NO DATA AVAILABLE" : "LOADING SCREENER DATA…"}</div> : !sorted.length ? <div style={tEyebrowMuted}>NO STOCKS MATCH</div> : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                      <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                        {scrCols.map(c2 => (
                          <th key={c2.k} onClick={() => toggleScrSort(c2.k)} style={{ ...tTh(c2.align), color: scrSort.col === c2.k ? C.t1 : C.t4 }}>{c2.l} {scrSort.col === c2.k ? (scrSort.dir === "desc" ? "↓" : "↑") : ""}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {sorted.map(s => (
                          <tr key={s.ticker} onClick={() => openReport2(s)} style={{ borderBottom: `1px solid ${C.border}`, cursor: "pointer" }} onMouseEnter={e => e.currentTarget.style.background = C.cardHover} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                            <td style={{ ...tTd("left"), fontWeight: 700, color: C.t1 }}>{s.ticker}</td>
                            <td style={{ ...tTd("left"), color: C.t3, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</td>
                            <td style={{ ...tTd("left"), color: C.t4, fontSize: 10 }}>{getSector(s) || "—"}</td>
                            <td style={tTd("left")}>{s.recommendation ? <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", padding: "1px 8px", borderRadius: 2, color: tRecColor(s.recommendation), background: tRecColor(s.recommendation) + "18" }}>{s.recommendation}</span> : "—"}</td>
                            <td style={{ ...tTd(), fontWeight: 700, color: s.overall_score >= 70 ? C.up : s.overall_score >= 50 ? C.t1 : C.warn }}>{s.overall_score ?? "—"}</td>
                            <td style={{ ...tTd(), fontWeight: 600, color: (() => { const v = screenerScores[s.ticker]?.inspire; return v == null ? C.t4 : v >= 0 ? C.up : C.dn; })() }}>{screenerScores[s.ticker]?.inspire ?? "—"}</td>
                            <td style={{ ...tTd(), color: C.t4, fontSize: 10 }}>{s.screen_date || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>);
              })())}
              {tDrawer === "performance" && (() => {
                const SLEEVES_PERF = ["dividend", "growth", "fci100", "fciValues"];
                // Find value at or before a target date (portfolio is ascending by date)
                const valueAt = (portfolio, targetDateStr) => {
                  if (!portfolio?.length) return null;
                  for (let i = portfolio.length - 1; i >= 0; i--) if (portfolio[i].date <= targetDateStr) return portfolio[i].value;
                  return null;
                };
                const today = new Date();
                const yyyy = today.getFullYear();
                const q = Math.floor(today.getMonth() / 3);
                const qStart = `${yyyy}-${String(q * 3 + 1).padStart(2, "0")}-01`;
                const yStart = `${yyyy}-01-01`;
                const daysAgo = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
                const sleeveCurrentVal = k => {
                  const data = perfDataMap[k];
                  if (!data?.portfolio?.length) return null;
                  // Active sleeve uses the live WS value as before
                  if (liveValue && perfSleeve === k) return liveValue.value;
                  // Every other sleeve: compute live NAV from holdings × current quotes
                  // (same pattern as sleeveActualDay) so the table ticks for ALL sleeves
                  if (data.holdings) {
                    const cash = data.cash || 0;
                    let val = cash;
                    for (const [sym, sh] of Object.entries(data.holdings)) {
                      const q = quotesRef.current[sym] || quotes[sym];
                      if (q?.p && sh) val += sh * q.p;
                    }
                    if (val > 0) return val;
                  }
                  return data.portfolio[data.portfolio.length - 1].value;
                };
                const ret = (k, fromDate) => {
                  const data = perfDataMap[k];
                  if (!data?.portfolio?.length) return null;
                  const cur = sleeveCurrentVal(k);
                  const past = valueAt(data.portfolio, fromDate);
                  if (!cur || !past) return null;
                  return ((cur / past) - 1) * 100;
                };
                // Classic QTD (matches Metrics > Weight Comp > Since Rebalance):
                // weighted average of per-stock (current / REBALANCE_ANCHOR - 1) by sleeve weights
                const sleeveSinceRebalance = k => {
                  const data = perfDataMap[k];
                  if (!data?.holdings) return null;
                  const tw = TARGET_WEIGHTS[k] || {};
                  const ap = REBALANCE_ANCHORS;
                  let wSum = 0, wTot = 0;
                  for (const sym of Object.keys(data.holdings)) {
                    const q = (quotesRef.current[sym] || quotes[sym])?.p;
                    const anc = ap[sym];
                    if (!q || !anc) continue;
                    const sinceReb = ((q - anc) / anc) * 100;
                    const w = liveWeights[k]?.[sym] ?? tw[sym] ?? 0;
                    if (w > 0) { wSum += w * sinceReb; wTot += w; }
                  }
                  return wTot > 0 ? wSum / wTot : null;
                };
                const ranges = [
                  { l: "DAY", fn: k => sleeveActualDay(k) },
                  { l: "QTD", fn: k => sleeveSinceRebalance(k) },
                  { l: "YTD", fn: k => ret(k, yStart) },
                  { l: "1Y", fn: k => ret(k, daysAgo(365)) },
                  { l: "3Y", fn: k => ret(k, daysAgo(365 * 3)) },
                  { l: "5Y", fn: k => ret(k, daysAgo(365 * 5)) },
                  { l: "INCEP", fn: k => { const p = perfDataMap[k]?.portfolio; return p?.length ? ret(k, p[0].date) : null; } },
                ];
                const sleeveNames = { dividend: "Dividend", growth: "Growth", fci100: "FCI 100", fciValues: "FCI Values" };
                const fmtVal = v => v != null ? `$${v >= 1e6 ? (v / 1e6).toFixed(2) + "M" : v >= 1e3 ? (v / 1e3).toFixed(0) + "K" : v.toFixed(0)}` : "—";
                const fmtR = v => v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
                const cR = v => v == null ? C.t4 : v >= 0 ? C.up : C.dn;
                // Benchmark return — uses perfDataMap[k].benchmarks dictionary keyed by date
                const bmRet = (sleeveKey, bmSym, fromDate) => {
                  const bm = perfDataMap[sleeveKey]?.benchmarks?.[bmSym];
                  if (!bm) return null;
                  const dates = Object.keys(bm).sort();
                  if (dates.length < 2) return null;
                  // Find closest date >= fromDate (anchor past)
                  let pastClose = null;
                  for (const d of dates) { if (d >= fromDate) { pastClose = bm[d]; break; } }
                  if (pastClose == null) pastClose = bm[dates[0]];
                  const liveQ = (bmQuotes[bmSym] || quotesRef.current?.[bmSym])?.p;
                  const current = liveQ || bm[dates[dates.length - 1]];
                  return pastClose ? ((current / pastClose) - 1) * 100 : null;
                };
                const bmDay = (bmSym) => {
                  const q = bmQuotes[bmSym] || quotesRef.current?.[bmSym];
                  const b = bmBars[bmSym] || barsRef.current?.[bmSym];
                  return (q?.p && b?.pc) ? ((q.p - b.pc) / b.pc) * 100 : null;
                };
                // For each sleeve, the rows: [sleeve itself, ...its benchmarks]
                const SECTIONS = [
                  { sleeve: "dividend", bms: ["DVY", "SPY"] },
                  { sleeve: "growth", bms: ["IUSG", "SPY"] },
                  { sleeve: "fci100", bms: ["SPY"] },
                  { sleeve: "fciValues", bms: ["SPY"] },
                ];
                const sleeveRet = (k, label, fromDate) => label === "DAY" ? sleeveActualDay(k) : ret(k, fromDate);
                const renderSection = ({ sleeve, bms }) => {
                  const sleeveRow = { label: sleeveNames[sleeve], nav: sleeveCurrentVal(sleeve), returns: ranges.map(r => r.fn(sleeve)), isPortfolio: true, sleeve };
                  const bmRows = bms.map(bmSym => ({
                    label: bmSym, nav: null, isBm: true, sym: bmSym,
                    returns: ranges.map(r => r.l === "DAY" ? bmDay(bmSym) : (
                      r.l === "QTD" ? bmRet(sleeve, bmSym, qStart) :
                      r.l === "YTD" ? bmRet(sleeve, bmSym, yStart) :
                      r.l === "1Y" ? bmRet(sleeve, bmSym, daysAgo(365)) :
                      r.l === "3Y" ? bmRet(sleeve, bmSym, daysAgo(365 * 3)) :
                      r.l === "5Y" ? bmRet(sleeve, bmSym, daysAgo(365 * 5)) :
                      r.l === "INCEP" ? bmRet(sleeve, bmSym, (perfDataMap[sleeve]?.portfolio?.[0]?.date) || daysAgo(365 * 10)) :
                      null
                    )),
                  }));
                  const allRows = [sleeveRow, ...bmRows];
                  return (
                    <div key={sleeve} style={{ marginBottom: 18 }}>
                      <div style={{ ...tEyebrow, paddingBottom: 6, borderBottom: `1px solid ${C.accent}33`, marginBottom: 6 }}>{sleeveNames[sleeve]}</div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                        <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                          <th style={tTh("left", false)}></th>
                          <th style={tTh("right", false)}>NAV</th>
                          {ranges.map(r => <th key={r.l} style={tTh("right", false)}>{r.l}</th>)}
                        </tr></thead>
                        <tbody>
                          {allRows.map((row, i) => (
                            <tr key={i} style={{ borderBottom: `1px solid ${C.border}`, cursor: row.isPortfolio ? "pointer" : "default" }} onClick={row.isPortfolio ? () => { setTerminalActiveSym("__portfolio__"); setTChartSleeve(row.sleeve); setPerfSleeve(row.sleeve); setTDrawer(null); } : undefined} onMouseEnter={row.isPortfolio ? e => e.currentTarget.style.background = C.cardHover : undefined} onMouseLeave={row.isPortfolio ? e => e.currentTarget.style.background = "transparent" : undefined}>
                              <td style={{ ...tTd("left"), fontWeight: row.isPortfolio ? 700 : 600, color: row.isPortfolio ? C.t1 : C.t3 }}>{row.label}</td>
                              <td style={{ ...tTd(), color: row.isPortfolio ? C.t2 : C.t4 }}>{row.isPortfolio ? fmtVal(row.nav) : "—"}</td>
                              {row.returns.map((v, j) => <td key={j} style={{ ...tTd(), fontWeight: row.isPortfolio ? 600 : 500, color: cR(v) }}>{fmtR(v)}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                };
                return (<div>
                  {SECTIONS.map(renderSection)}
                  <div style={{ ...tEyebrow, paddingBottom: 6, borderBottom: `1px solid ${C.accent}33`, marginBottom: 8 }}>Top Movers Today</div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      <th style={tTh("left", false)}>Ticker</th>
                      <th style={tTh("right", false)}>Price</th>
                      <th style={tTh("right", false)}>Day</th>
                    </tr></thead>
                    <tbody>
                      {(() => { const allSyms = [...new Set([...(sleeves.dividend?.symbols || []), ...(sleeves.growth?.symbols || [])])]; return allSyms.map(sym => { const qq = quotesRef.current[sym] || quotes[sym]; const bb = barsRef.current[sym] || bars[sym]; const c = (qq && bb?.pc) ? ((qq.p - bb.pc) / bb.pc * 100) : null; return { sym, chg: c, price: qq?.p }; }).filter(s => s.chg != null).sort((a, b) => Math.abs(b.chg) - Math.abs(a.chg)).slice(0, 20).map(s => (
                        <tr key={s.sym} style={{ borderBottom: `1px solid ${C.border}`, cursor: "pointer" }} onClick={() => { setTerminalActiveSym(s.sym); setTProfileSym(s.sym); setTProfileTab("chart"); setTDrawer(null); }} onMouseEnter={e => e.currentTarget.style.background = C.cardHover} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                          <td style={{ ...tTd("left"), fontWeight: 700, color: C.t1 }}>{s.sym}</td>
                          <td style={{ ...tTd(), color: C.t2 }}>{s.price != null ? `$${s.price >= 1000 ? s.price.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : s.price.toFixed(2)}` : "—"}</td>
                          <td style={{ ...tTd(), fontWeight: 600, color: cR(s.chg) }}>{fmtR(s.chg)}</td>
                        </tr>
                      )); })()}
                    </tbody>
                  </table>
                </div>);
              })()}
              {tDrawer === "holdings" && (() => {
                const hData = perfDataMap[perfSleeve] || perfDataMap.dividend || Object.values(perfDataMap)[0];
                const sleevePicker = (
                  <div style={tTabRow}>
                    {["dividend", "growth", "fci100", "fciValues"].map(k => (
                      <button key={k} onClick={() => setPerfSleeve(k)} style={tTabBtn(perfSleeve === k)}>{sleeves[k]?.name || k}</button>
                    ))}
                  </div>
                );
                if (!hData?.holdings) return (<div>{sleevePicker}<div style={tEyebrowMuted}>LOADING HOLDINGS</div></div>);
                // Summary — same math as classic Performance > Holdings view
                const lastPt = hData.portfolio?.[hData.portfolio.length - 1];
                const totalVal = liveValue ? liveValue.value : (lastPt?.value || 0);
                const cashVal = liveValue ? liveValue.cash : (hData.cash || 0);
                const startVal = hData.portfolio?.[0]?.value || (hData.startBalance || 100000);
                const totalGain = totalVal - startVal;
                const totalGainPct = startVal > 0 ? ((totalVal / startVal) - 1) * 100 : 0;
                const stats = [
                  { label: "Portfolio Value", value: `$${totalVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}` },
                  { label: "Cash", value: `$${cashVal.toLocaleString(undefined, { maximumFractionDigits: 2 })}` },
                  { label: "All-Time Gain", value: `${totalGain >= 0 ? "+$" : "-$"}${Math.abs(totalGain).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: totalGain >= 0 ? C.up : C.dn },
                  { label: "All-Time %", value: `${totalGainPct >= 0 ? "+" : ""}${totalGainPct.toFixed(1)}%`, color: totalGainPct >= 0 ? C.up : C.dn },
                ];
                // Per-holding rows — same math as classic holdings table
                const weightBase = liveValue ? liveValue.value : (lastPt?.value || 1);
                const rows = Object.entries(hData.holdings).map(([ticker, shares]) => {
                  const q = quotesRef.current?.[ticker] || quotes[ticker];
                  const price = q?.p || 0;
                  const pc = (barsRef.current?.[ticker] || bars[ticker])?.pc || price;
                  const dayChgPct = pc > 0 ? ((price - pc) / pc) * 100 : 0;
                  const mktValue = shares * price;
                  const weight = weightBase > 0 ? (mktValue / weightBase) * 100 : 0;
                  const cb = hData.costBasis?.[ticker] || {};
                  const avgCost = cb.avg_cost || 0;
                  const costBasis = cb.total_cost || 0;
                  const gainLoss = mktValue - costBasis;
                  const gainLossPct = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;
                  // Initial buy date for the current holding period
                  let initDate = null;
                  if (hData.transactions) {
                    const txs = [...hData.transactions].filter(t => t.ticker === ticker).sort((a, b) => a.date.localeCompare(b.date));
                    let running = 0;
                    for (const tx of txs) {
                      if (tx.type === "PURCHASE") { if (running <= 0.001) initDate = tx.date; running += tx.shares || 0; }
                      else if (tx.type === "SALE") { running -= tx.shares || 0; if (running <= 0.001) { running = 0; initDate = null; } }
                    }
                  }
                  return { ticker, shares, price, dayChgPct, mktValue, weight, avgCost, costBasis, gainLoss, gainLossPct, initDate };
                });
                const { col: hsc, dir: hsd } = holdingsSort;
                const hSortKey = { symbol: r => r.ticker, shares: r => r.shares, price: r => r.price, dayChgPct: r => r.dayChgPct, mktValue: r => r.mktValue, weight: r => r.weight, avgCost: r => r.avgCost, costBasis: r => r.costBasis, gainLoss: r => r.gainLoss, gainLossPct: r => r.gainLossPct, initDate: r => r.initDate || "" }[hsc] || (r => r.weight);
                rows.sort((a, b) => { const av = hSortKey(a), bv = hSortKey(b); if (typeof av === "string") return hsd === "asc" ? av.localeCompare(bv) : bv.localeCompare(av); return hsd === "asc" ? av - bv : bv - av; });
                const totMktVal = rows.reduce((s, r) => s + r.mktValue, 0);
                const totCostBasis = rows.reduce((s, r) => s + r.costBasis, 0);
                const totGainLoss = rows.reduce((s, r) => s + r.gainLoss, 0);
                const totGainLossPct = totCostBasis > 0 ? (totGainLoss / totCostBasis) * 100 : 0;
                const hCols = [
                  { key: "symbol", label: "Symbol", align: "left" }, { key: "shares", label: "Shares" },
                  { key: "price", label: "Price" }, { key: "dayChgPct", label: "Day %" },
                  { key: "mktValue", label: "Mkt Value" }, { key: "weight", label: "Weight" },
                  { key: "avgCost", label: "Avg Cost" }, { key: "costBasis", label: "Cost Basis" },
                  { key: "gainLoss", label: "Gain/Loss" }, { key: "gainLossPct", label: "G/L %" },
                  { key: "initDate", label: "Buy Date" },
                ];
                return (<div>
                  {sleevePicker}
                  <div style={{ display: "flex", gap: 32, flexWrap: "wrap", marginBottom: 14 }}>
                    {stats.map(s => (
                      <div key={s.label}>
                        <div style={{ fontSize: 9, fontWeight: 600, color: C.t4, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>{s.label}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: s.color || C.t1, fontVariantNumeric: "tabular-nums" }}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ border: `1px solid ${C.border}`, width: "100%", overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontVariantNumeric: "tabular-nums", minWidth: 820 }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                          {hCols.map(col => (
                            <th key={col.key} onClick={() => setHoldingsSort(prev => ({ col: col.key, dir: prev.col === col.key && prev.dir === "desc" ? "asc" : "desc" }))}
                              style={{ ...tTh(col.align || "right"), color: holdingsSort.col === col.key ? C.t1 : C.t4 }}>
                              {col.label} {holdingsSort.col === col.key ? (holdingsSort.dir === "desc" ? "▼" : "▲") : ""}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(r => (
                          <tr key={r.ticker} onClick={() => { setTerminalActiveSym(r.ticker); setTProfileSym(r.ticker); setTProfileTab("chart"); setTDrawer(null); }}
                            onMouseEnter={e => e.currentTarget.style.background = C.cardHover}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                            style={{ cursor: "pointer", borderBottom: `1px solid ${C.border}` }}>
                            <td style={{ ...tTd("left"), fontWeight: 700, color: C.accent }}>{r.ticker}</td>
                            <td style={{ ...tTd(), color: C.t2 }}>{r.shares.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                            <td style={{ ...tTd(), color: C.t1, fontWeight: 600 }}>${r.price.toFixed(2)}</td>
                            <td style={{ ...tTd(), color: r.dayChgPct >= 0 ? C.up : C.dn }}>{r.dayChgPct >= 0 ? "+" : ""}{r.dayChgPct.toFixed(2)}%</td>
                            <td style={{ ...tTd(), color: C.t1, fontWeight: 600 }}>${r.mktValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                            <td style={{ ...tTd(), color: C.t1 }}>{r.weight.toFixed(1)}%</td>
                            <td style={{ ...tTd(), color: C.t3 }}>${r.avgCost.toFixed(2)}</td>
                            <td style={{ ...tTd(), color: C.t3 }}>${r.costBasis.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                            <td style={{ ...tTd(), color: r.gainLoss >= 0 ? C.up : C.dn, fontWeight: 600 }}>{r.gainLoss >= 0 ? "+$" : "-$"}{Math.abs(r.gainLoss).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                            <td style={{ ...tTd(), color: r.gainLossPct >= 0 ? C.up : C.dn }}>{r.gainLossPct >= 0 ? "+" : ""}{r.gainLossPct.toFixed(1)}%</td>
                            <td style={{ ...tTd(), color: C.t3 }}>{r.initDate ? new Date(r.initDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }) : "—"}</td>
                          </tr>
                        ))}
                        <tr style={{ borderTop: `2px solid ${C.accent}44`, background: C.accentSoft }}>
                          <td style={{ ...tTd("left"), fontWeight: 700, color: C.t1 }}>TOTALS</td>
                          <td style={{ ...tTd(), color: C.t4 }}>{rows.length}</td>
                          <td colSpan={2} />
                          <td style={{ ...tTd(), color: C.t1, fontWeight: 700 }}>${totMktVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td style={{ ...tTd(), color: C.t1 }}>100%</td>
                          <td />
                          <td style={{ ...tTd(), color: C.t3 }}>${totCostBasis.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td style={{ ...tTd(), color: totGainLoss >= 0 ? C.up : C.dn, fontWeight: 700 }}>{totGainLoss >= 0 ? "+$" : "-$"}{Math.abs(totGainLoss).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td style={{ ...tTd(), color: totGainLossPct >= 0 ? C.up : C.dn, fontWeight: 700 }}>{totGainLossPct >= 0 ? "+" : ""}{totGainLossPct.toFixed(1)}%</td>
                          <td />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>);
              })()}
              {tDrawer === "metrics" && (() => {
                const mSyms = sleeves[metricsView]?.symbols || [];
                const mTw = TARGET_WEIGHTS[metricsView] || {};
                const mWOf = s => liveWeights[metricsView]?.[s] ?? mTw[s] ?? null;
                const mDayChg = s => { const q = quotesRef.current[s] || quotes[s]; const b = barsRef.current[s] || bars[s]; return (q?.p && b?.pc) ? ((q.p - b.pc) / b.pc) * 100 : null; };
                const mQtd = s => { const q = (quotesRef.current[s] || quotes[s])?.p; const anc = REBALANCE_ANCHORS[s]; return (anc && q) ? ((q - anc) / anc) * 100 : null; };
                const mDash = <span style={{ color: C.t4 }}>—</span>;
                const mFmtV = v => v == null || !isFinite(v) ? null : Number(v).toFixed(1);
                const mFmtP = v => v == null || !isFinite(v) ? null : `${Number(v).toFixed(1)}%`;
                const mFmtSgn = (v, dp = 2) => v == null || !isFinite(v) ? null : `${v >= 0 ? "+" : ""}${v.toFixed(dp)}%`;
                const mVol = v => v == null || !isFinite(v) ? null : v >= 1e9 ? `${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : String(Math.round(v));
                const mUpDn = v => v == null ? C.t4 : v > 0 ? C.up : v < 0 ? C.dn : C.t3;
                const mDivStreak = v => v == null ? C.t4 : v >= 25 ? C.up : v >= 10 ? C.t1 : C.t3;
                return (<div>
                  {/* Sleeve picker */}
                  <div style={{ ...tTabRow, marginBottom: 0 }}>
                    {["dividend", "growth", "fci100", "fciValues"].map(k => (
                      <button key={k} onClick={() => { setMetricsView(k); setMetricSort({ col: null, dir: "desc" }); }} style={tTabBtn(metricsView === k)}>{sleeves[k]?.name || k}</button>
                    ))}
                  </div>
                  {/* Sub-tabs */}
                  <div style={tTabRow}>
                    {[{ v: "table", l: "Table" }, { v: "weightcomp", l: "Weight Comp" }, { v: "qvq", l: "Q1 v Q2" }, { v: "attribution", l: "Attribution" }, { v: "sector", l: "Sector" }, { v: "matrix", l: "Matrix" }].map(({ v, l }) => (
                      <button key={v} onClick={() => setMetricsSubView(v)} style={tTabBtn(metricsSubView === v)}>{l}</button>
                    ))}
                  </div>

                  {/* ── TABLE ── */}
                  {metricsSubView === "table" && (() => {
                    const pctCol = (l, k) => ({ l, k, fn: d => mFmtSgn(d[k], 1), color: d => mUpDn(d[k]) });
                    const dayCol = { l: "Day", k: "_day", fn: (d, s) => mFmtSgn(mDayChg(s)), color: (d, s) => mUpDn(mDayChg(s)) };
                    const cols = [
                      { l: "Industry", k: "industry", fn: d => d.industry || null, noAvg: true, align: "left" },
                      dayCol,
                      { l: "Avg Vol", k: "avgVol", fn: d => mVol(d.avgVol) },
                      pctCol("Last Qtr", "lastQtr"),
                      pctCol("This Qtr", "thisQtr"),
                      pctCol("YTD", "ytd"),
                      ...(metricsView === "dividend" ? [
                        { l: "Yield FWD", k: "yieldFwd", fn: d => d.yieldFwd != null ? `${d.yieldFwd.toFixed(2)}%` : null },
                        { l: "Payout", k: "payoutRatio", fn: d => d.payoutRatio != null ? `${d.payoutRatio.toFixed(0)}%` : null },
                      ] : [
                        { l: "Margin", k: "profitMargin", fn: d => mFmtP(d.profitMargin) },
                      ]),
                      { l: "P/E TTM", k: "peTTM", fn: d => mFmtV(d.peTTM) },
                      { l: "P/E FWD", k: "peFwd", fn: d => mFmtV(d.peFwd) },
                      { l: "PEG", k: "pegTTM", fn: d => mFmtV(d.pegTTM) },
                      { l: "Rev YoY", k: "revenueYoY", fn: d => mFmtP(d.revenueYoY), color: d => mUpDn(d.revenueYoY) },
                      { l: "Rev 5Y", k: "revenue5Y", fn: d => mFmtP(d.revenue5Y), color: d => mUpDn(d.revenue5Y) },
                      { l: "ROE", k: "roe", fn: d => mFmtP(d.roe) },
                      { l: "D/E", k: "de", fn: d => mFmtV(d.de) },
                      { l: "Beta", k: "beta", fn: d => d.beta != null ? d.beta.toFixed(2) : null },
                    ];
                    const sorted = [...mSyms].sort((a, b) => {
                      if (!metricSort.col) return a.localeCompare(b);
                      if (metricSort.col === "_day") {
                        const av = mDayChg(a), bv = mDayChg(b);
                        if (av == null && bv == null) return 0; if (av == null) return 1; if (bv == null) return -1;
                        return metricSort.dir === "asc" ? av - bv : bv - av;
                      }
                      if (metricSort.col === "_yrsPaid" || metricSort.col === "_yrsGrown") {
                        const kk = metricSort.col === "_yrsPaid" ? "yearsPaid" : "yearsGrown";
                        const av = dividendHistory[a]?.[kk] ?? null, bv = dividendHistory[b]?.[kk] ?? null;
                        if (av == null && bv == null) return 0; if (av == null) return 1; if (bv == null) return -1;
                        return metricSort.dir === "asc" ? av - bv : bv - av;
                      }
                      const av = fundamentals[a]?.[metricSort.col] ?? null;
                      const bv = fundamentals[b]?.[metricSort.col] ?? null;
                      if (av == null && bv == null) return 0; if (av == null) return 1; if (bv == null) return -1;
                      if (typeof av === "string" && typeof bv === "string") return metricSort.dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
                      return metricSort.dir === "asc" ? av - bv : bv - av;
                    });
                    const toggleSort = k => setMetricSort(p => p.col === k ? { col: k, dir: p.dir === "desc" ? "asc" : "desc" } : { col: k, dir: "desc" });
                    const avgRow = (label, weighted) => (
                      <tr style={{ borderTop: weighted ? `1px solid ${C.border}` : `2px solid ${C.accent}` }}>
                        <td style={{ position: "sticky", left: 0, zIndex: 1, background: C.surface, padding: "5px 8px", borderRight: `1px solid ${C.border}`, fontSize: 10, fontWeight: 700, color: weighted ? C.t1 : C.t3, whiteSpace: "nowrap" }}>{label}</td>
                        {cols.map(col => {
                          if (col.noAvg) return <td key={col.l} style={{ ...tTd(), background: C.surface, color: C.t4 }}>—</td>;
                          let avg = null;
                          if (weighted) {
                            let totW = 0, sum = 0;
                            for (const s of sorted) {
                              const v = col.k === "_day" ? mDayChg(s) : fundamentals[s]?.[col.k];
                              const w = mWOf(s) || 0;
                              if (v != null && isFinite(v) && w > 0) { totW += w; sum += w * v; }
                            }
                            avg = totW > 0 ? sum / totW : null;
                          } else {
                            const vals = sorted.map(s => col.k === "_day" ? mDayChg(s) : fundamentals[s]?.[col.k]).filter(v => v != null && isFinite(v));
                            avg = vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : null;
                          }
                          const val = avg != null ? (col.k === "_day" ? mFmtSgn(avg) : col.fn({ [col.k]: avg })) : null;
                          const clr = col.k === "_day" ? mUpDn(avg) : (weighted ? C.t1 : C.t3);
                          return <td key={col.l} style={{ ...tTd(), background: C.surface, fontSize: 10, fontWeight: 700, color: clr }}>{val ?? mDash}</td>;
                        })}
                      </tr>
                    );
                    return (
                      <div style={{ width: "100%", overflowX: "auto", border: `1px solid ${C.border}` }}>
                        <table style={{ borderCollapse: "collapse", fontSize: 11, minWidth: 980 }}>
                          <thead style={{ position: "sticky", top: 0, zIndex: 3 }}>
                            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                              <th style={{ ...tTh("left", false), position: "sticky", left: 0, zIndex: 4, background: C.surface, borderRight: `1px solid ${C.border}` }}>Ticker</th>
                              {cols.map(col => (
                                <th key={col.l} onClick={() => toggleSort(col.k)} style={{ ...tTh(col.align || "right"), background: C.surface, color: metricSort.col === col.k ? C.t1 : C.t4 }}>
                                  {col.l} {metricSort.col === col.k ? (metricSort.dir === "desc" ? "↓" : "↑") : ""}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {sorted.map(s => {
                              const d = fundamentals[s] || {};
                              return (
                                <tr key={s} onClick={() => { setTerminalActiveSym(s); setTProfileSym(s); setTProfileTab("chart"); setTDrawer(null); }} style={{ borderBottom: `1px solid ${C.border}`, cursor: "pointer" }} onMouseEnter={e => e.currentTarget.style.background = C.cardHover} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                  <td style={{ padding: "5px 8px", position: "sticky", left: 0, zIndex: 1, background: C.bg, borderRight: `1px solid ${C.border}`, fontWeight: 700, color: C.t1, whiteSpace: "nowrap" }}>{s}</td>
                                  {cols.map(col => {
                                    const val = col.fn(d, s);
                                    const clr = col.color ? col.color(d, s) : C.t2;
                                    return <td key={col.l} style={{ ...tTd(col.align || "right"), color: val == null ? C.t4 : clr, fontSize: col.k === "industry" ? 10 : 11, maxWidth: col.k === "industry" ? 130 : undefined, overflow: col.k === "industry" ? "hidden" : undefined, textOverflow: col.k === "industry" ? "ellipsis" : undefined }}>{val ?? "—"}</td>;
                                  })}
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            {avgRow("EW Avg", false)}
                            {avgRow("Wt Avg", true)}
                          </tfoot>
                        </table>
                      </div>
                    );
                  })()}

                  {/* ── WEIGHT COMP ── */}
                  {metricsSubView === "weightcomp" && (() => {
                    const syms = mSyms;
                    if (!syms.length) return <div style={tEyebrowMuted}>NO HOLDINGS</div>;
                    const tw = TARGET_WEIGHTS[metricsView] || {};
                    const ew = 100 / syms.length;
                    const ap = anchorPrices?.prices || REBALANCE_ANCHORS;
                    const getW = s => liveWeights[metricsView]?.[s] ?? tw[s] ?? 0;
                    // Drifted equal weights — each stock starts at ew% and drifts with price (matches classic)
                    let eqDriftTotal = 0; const eqDrift = {};
                    for (const s of syms) { const anc = ap[s], cur = (quotesRef.current[s] || quotes[s])?.p; const g = (anc && cur) ? cur / anc : 1; eqDrift[s] = ew * g; eqDriftTotal += eqDrift[s]; }
                    const getEW = s => eqDriftTotal > 0 ? (eqDrift[s] / eqDriftTotal) * 100 : ew;
                    // Daily + since-rebalance, weighted vs drifted-equal
                    let wDaySum = 0, wDayTot = 0, eDaySum = 0, eDayTot = 0;
                    let wRebSum = 0, wRebTot = 0, eRebSum = 0, eRebTot = 0;
                    const rows = [];
                    for (const s of syms) {
                      const c = mDayChg(s);
                      const w = getW(s), ewD = getEW(s);
                      const q = (quotesRef.current[s] || quotes[s])?.p;
                      const anc = ap[s];
                      const sinceReb = (anc && q) ? ((q - anc) / anc) * 100 : null;
                      if (c != null) { wDaySum += w * c; wDayTot += w; eDaySum += ewD * c; eDayTot += ewD; }
                      if (sinceReb != null) { wRebSum += w * sinceReb; wRebTot += w; eRebSum += ewD * sinceReb; eRebTot += ewD; }
                      rows.push({ s, w, ewD, c, sinceReb, wContribDay: c != null ? w * c / 100 : null, eContribDay: c != null ? ewD * c / 100 : null });
                    }
                    const wDay = sleeveActualDay(metricsView) ?? (wDayTot > 0 ? wDaySum / wDayTot : null);
                    const eDay = eDayTot > 0 ? eDaySum / eDayTot : null;
                    const dayAlpha = (wDay != null && eDay != null) ? wDay - eDay : null;
                    const wReb = wRebTot > 0 ? wRebSum / wRebTot : null;
                    const eReb = eRebTot > 0 ? eRebSum / eRebTot : null;
                    const rebAlpha = (wReb != null && eReb != null) ? wReb - eReb : null;
                    rows.sort((a, b) => Math.abs(b.wContribDay ?? 0) - Math.abs(a.wContribDay ?? 0));
                    const fmtP = (v, dp = 2) => v != null ? `${v >= 0 ? "+" : ""}${v.toFixed(dp)}%` : "—";
                    const cR = v => v == null ? C.t4 : v >= 0 ? C.up : C.dn;
                    const summaryCol = (label, w, e, alpha, dp = 2) => (
                      <div>
                        <div style={{ ...tEyebrow, paddingBottom: 4, borderBottom: `1px solid ${C.accent}33`, marginBottom: 6 }}>{label}</div>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                          <span style={tEyebrowMuted}>Weighted</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: cR(w) }}>{fmtP(w, dp)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${C.border}` }}>
                          <span style={tEyebrowMuted}>Equal Wt (Drifted)</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: cR(e) }}>{fmtP(e, dp)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
                          <span style={{ ...tEyebrowMuted, color: C.t2 }}>ALPHA</span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: cR(alpha) }}>{fmtP(alpha, dp)}</span>
                        </div>
                      </div>
                    );
                    return (
                      <div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, marginBottom: 18, maxWidth: 700 }}>
                          {summaryCol("Today", wDay, eDay, dayAlpha, 2)}
                          {summaryCol("Since Rebalance", wReb, eReb, rebAlpha, 1)}
                        </div>
                        <div style={{ width: "100%", overflowX: "auto", border: `1px solid ${C.border}` }}>
                          <table style={{ borderCollapse: "collapse", fontSize: 11, minWidth: 640 }}>
                            <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                              <th style={tTh("left", false)}>Ticker</th>
                              {["Wt%", "EW%", "Diff", "Day Chg", "Day Contrib", "Since Reb"].map(h => <th key={h} style={tTh("right", false)}>{h}</th>)}
                            </tr></thead>
                            <tbody>
                              {rows.map(r => {
                                const diff = r.w - r.ewD;
                                return (
                                  <tr key={r.s} style={{ borderBottom: `1px solid ${C.border}` }} onMouseEnter={e => e.currentTarget.style.background = C.cardHover} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                    <td style={{ ...tTd("left"), fontWeight: 700, color: C.t1 }}>{r.s}</td>
                                    <td style={tTd()}>{r.w.toFixed(1)}%</td>
                                    <td style={{ ...tTd(), color: C.t3 }}>{r.ewD.toFixed(1)}%</td>
                                    <td style={{ ...tTd(), color: cR(diff) }}>{diff >= 0 ? "+" : ""}{diff.toFixed(1)}%</td>
                                    <td style={{ ...tTd(), fontWeight: 600, color: cR(r.c) }}>{fmtP(r.c, 2)}</td>
                                    <td style={{ ...tTd(), fontWeight: 600, color: cR(r.wContribDay) }}>{r.wContribDay != null ? `${r.wContribDay >= 0 ? "+" : ""}${r.wContribDay.toFixed(3)}%` : "—"}</td>
                                    <td style={{ ...tTd(), fontWeight: 600, color: cR(r.sinceReb) }}>{fmtP(r.sinceReb, 1)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()}

                  {/* ── Q1 v Q2 (matches classic computation) ── */}
                  {metricsSubView === "qvq" && (() => {
                    const Q1_STOCKS = {
                      dividend: ["ABT","A","ADI","ATO","ADP","BKH","CAT","CHD","CL","FAST","GD","GPC","LRCX","LMT","MATX","NEE","ORI","PCAR","QCOM","DGX","SSNC","STLD","SYK","TEL","VLO"],
                      growth: ["AMD","AEM","ATAT","CVX","CWAN","CNX","COIN","EIX","FINV","FTNT","GFI","SUPV","HRMY","HUT","HOOD","KEYS","MARA","NVDA","NXPI","OKE","PDD","SYF","TSM","TOL"],
                    };
                    const sleeve = metricsView;
                    const q1Syms = Q1_STOCKS[sleeve] || [];
                    if (!q1Syms.length) return <div style={tEyebrowMuted}>NO Q1 BASELINE FOR THIS SLEEVE</div>;
                    const q2Syms = mSyms;
                    const tw = TARGET_WEIGHTS[sleeve] || {};
                    const ap = REBALANCE_ANCHORS;
                    const q1Ew = q1Syms.length ? 100 / q1Syms.length : 4;
                    const fmtP = v => v != null ? `${v >= 0 ? "+" : ""}${v.toFixed(2)}%` : "—";
                    const cR = v => v == null ? C.t4 : v >= 0 ? C.up : C.dn;
                    const calcPortfolio = (syms, getWeight) => {
                      let wDaySum = 0, wDayTot = 0, wRebSum = 0, wRebTot = 0;
                      for (const s of syms) {
                        const c = mDayChg(s);
                        const w = getWeight(s);
                        const q = (quotesRef.current[s] || quotes[s])?.p;
                        const anc = ap[s];
                        const sinceReb = (anc && q) ? ((q - anc) / anc) * 100 : null;
                        if (c != null && w > 0) { wDaySum += w * c; wDayTot += w; }
                        if (sinceReb != null && w > 0) { wRebSum += w * sinceReb; wRebTot += w; }
                      }
                      return { day: wDayTot > 0 ? wDaySum / wDayTot : null, reb: wRebTot > 0 ? wRebSum / wRebTot : null };
                    };
                    const q2GetW = s => liveWeights[sleeve]?.[s] ?? tw[s] ?? 0;
                    const q2 = calcPortfolio(q2Syms, q2GetW);
                    const q2ActualDay = sleeveActualDay(sleeve);
                    if (q2ActualDay !== null) q2.day = q2ActualDay;
                    const q1Drift = {}; let q1DriftTotal = 0;
                    for (const s of q1Syms) { const anc = ap[s], cur = (quotesRef.current[s] || quotes[s])?.p; const g = (anc && cur) ? cur / anc : 1; q1Drift[s] = q1Ew * g; q1DriftTotal += q1Drift[s]; }
                    const q1GetW = s => q1DriftTotal > 0 ? (q1Drift[s] / q1DriftTotal) * 100 : q1Ew;
                    const q1 = calcPortfolio(q1Syms, q1GetW);
                    const dayAlpha = (q2.day != null && q1.day != null) ? q2.day - q1.day : null;
                    const rebAlpha = (q2.reb != null && q1.reb != null) ? q2.reb - q1.reb : null;
                    const added = q2Syms.filter(s => !q1Syms.includes(s));
                    const removed = q1Syms.filter(s => !q2Syms.includes(s));
                    const summaryCol = (label, q2v, q1v, alpha) => (
                      <div>
                        <div style={{ ...tEyebrow, paddingBottom: 4, borderBottom: `1px solid ${C.accent}33`, marginBottom: 6 }}>{label}</div>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                          <span style={tEyebrowMuted}>Q2 (Current)</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: cR(q2v) }}>{fmtP(q2v)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${C.border}` }}>
                          <span style={tEyebrowMuted}>Q1 (Old EW)</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: cR(q1v) }}>{fmtP(q1v)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
                          <span style={{ ...tEyebrowMuted, color: C.t2 }}>REBALANCE ALPHA</span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: cR(alpha) }}>{fmtP(alpha)}</span>
                        </div>
                      </div>
                    );
                    return (
                      <div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, marginBottom: 16, maxWidth: 700 }}>
                          {summaryCol("Today", q2.day, q1.day, dayAlpha)}
                          {summaryCol("Since Rebalance", q2.reb, q1.reb, rebAlpha)}
                        </div>
                        {(added.length > 0 || removed.length > 0) && (
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
                            {added.map(s => <span key={s} style={{ fontSize: 10, fontWeight: 700, color: C.up, border: `1px solid ${C.up}55`, padding: "3px 8px" }}>+ {s}</span>)}
                            {removed.map(s => <span key={s} style={{ fontSize: 10, fontWeight: 700, color: C.dn, border: `1px solid ${C.dn}55`, padding: "3px 8px" }}>− {s}</span>)}
                          </div>
                        )}
                        <div style={{ width: "100%", overflowX: "auto", border: `1px solid ${C.border}` }}>
                          <table style={{ borderCollapse: "collapse", fontSize: 11, minWidth: 580 }}>
                            <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                              <th style={tTh("left", false)}>Ticker</th>
                              <th style={tTh("right", false)}>Status</th>
                              <th style={tTh("right", false)}>Q1 Wt%</th>
                              <th style={tTh("right", false)}>Q2 Wt%</th>
                              <th style={tTh("right", false)}>Day Chg</th>
                              <th style={tTh("right", false)}>Since Reb</th>
                            </tr></thead>
                            <tbody>
                              {[...new Set([...q2Syms, ...q1Syms])].sort((a, b) => {
                                const aA = added.includes(a), bA = added.includes(b);
                                const aR = removed.includes(a), bR = removed.includes(b);
                                if (aA && !bA) return -1; if (!aA && bA) return 1;
                                if (aR && !bR) return -1; if (!aR && bR) return 1;
                                const aReb = (quotesRef.current[a] || quotes[a])?.p && ap[a] ? (((quotesRef.current[a] || quotes[a]).p - ap[a]) / ap[a]) * 100 : 0;
                                const bReb = (quotesRef.current[b] || quotes[b])?.p && ap[b] ? (((quotesRef.current[b] || quotes[b]).p - ap[b]) / ap[b]) * 100 : 0;
                                return Math.abs(bReb) - Math.abs(aReb);
                              }).map(s => {
                                const isAdded = added.includes(s);
                                const isRemoved = removed.includes(s);
                                const c = mDayChg(s);
                                const q = (quotesRef.current[s] || quotes[s])?.p;
                                const sinceReb = (ap[s] && q) ? ((q - ap[s]) / ap[s]) * 100 : null;
                                const q1w = q1Syms.includes(s) ? q1GetW(s) : null;
                                const q2w = q2Syms.includes(s) ? q2GetW(s) : null;
                                return (
                                  <tr key={s} style={{ borderBottom: `1px solid ${C.border}`, background: isAdded ? C.up + "10" : isRemoved ? C.dn + "10" : "transparent" }} onMouseEnter={e => e.currentTarget.style.background = isAdded ? C.up + "20" : isRemoved ? C.dn + "20" : C.cardHover} onMouseLeave={e => e.currentTarget.style.background = isAdded ? C.up + "10" : isRemoved ? C.dn + "10" : "transparent"}>
                                    <td style={{ ...tTd("left"), fontWeight: 700, color: C.accent }}>{s}</td>
                                    <td style={{ ...tTd(), fontSize: 10, fontWeight: 700, color: isAdded ? C.up : isRemoved ? C.dn : C.t4 }}>{isAdded ? "NEW" : isRemoved ? "OUT" : "KEPT"}</td>
                                    <td style={{ ...tTd(), color: q1w != null ? C.t2 : C.t4 }}>{q1w != null ? q1w.toFixed(1) + "%" : "—"}</td>
                                    <td style={{ ...tTd(), color: q2w != null ? C.t2 : C.t4 }}>{q2w != null ? q2w.toFixed(1) + "%" : "—"}</td>
                                    <td style={{ ...tTd(), fontWeight: 600, color: cR(c) }}>{fmtP(c)}</td>
                                    <td style={{ ...tTd(), fontWeight: 600, color: cR(sinceReb) }}>{fmtP(sinceReb)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()}

                  {/* ── ATTRIBUTION ── */}
                  {metricsSubView === "attribution" && (() => {
                    const rows = mSyms.map(s => {
                      const qtd = mQtd(s);
                      const w = mWOf(s) ?? (mSyms.length ? 100 / mSyms.length : 0);
                      return { s, w, qtd, contrib: qtd != null ? w * qtd / 100 : null };
                    }).filter(r => r.qtd != null).sort((a, b) => Math.abs(b.w * b.qtd) - Math.abs(a.w * a.qtd));
                    if (!rows.length) return <div style={tEyebrowMuted}>NO ANCHOR DATA FOR THIS SLEEVE</div>;
                    const totW = rows.reduce((x, r) => x + r.w, 0);
                    const wQtd = totW > 0 ? rows.reduce((x, r) => x + r.w * r.qtd, 0) / totW : null;
                    return (
                      <div style={{ maxWidth: 560 }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                          <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                            <th style={tTh("left", false)}>Ticker</th>
                            {["Wt%", "QTD%", "Contrib"].map(h => <th key={h} style={tTh("right", false)}>{h}</th>)}
                          </tr></thead>
                          <tbody>
                            {rows.map(r => (
                              <tr key={r.s} style={{ borderBottom: `1px solid ${C.border}` }} onMouseEnter={e => e.currentTarget.style.background = C.cardHover} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                <td style={{ ...tTd("left"), fontWeight: 700, color: C.t1 }}>{r.s}</td>
                                <td style={{ ...tTd(), color: C.t3 }}>{r.w.toFixed(1)}%</td>
                                <td style={{ ...tTd(), fontWeight: 600, color: mUpDn(r.qtd) }}>{mFmtSgn(r.qtd)}</td>
                                <td style={{ ...tTd(), fontWeight: 600, color: mUpDn(r.contrib) }}>{r.contrib >= 0 ? "+" : ""}{r.contrib.toFixed(3)}%</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={{ borderTop: `2px solid ${C.accent}` }}>
                              <td style={{ ...tTd("left"), fontWeight: 700, color: C.t1 }}>WEIGHTED QTD</td>
                              <td style={{ ...tTd(), fontWeight: 700, color: C.t1 }}>{totW.toFixed(1)}%</td>
                              <td style={{ ...tTd(), fontWeight: 700, color: mUpDn(wQtd) }}>{mFmtSgn(wQtd)}</td>
                              <td style={{ ...tTd(), fontWeight: 700, color: mUpDn(wQtd) }}>{wQtd != null ? `${wQtd >= 0 ? "+" : ""}${wQtd.toFixed(3)}%` : "—"}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    );
                  })()}

                  {/* ── SECTOR ── */}
                  {metricsSubView === "sector" && (() => {
                    const groups = {};
                    mSyms.forEach(s => {
                      const sec = fundamentals[s]?.sector || "Uncategorized";
                      if (!groups[sec]) groups[sec] = [];
                      groups[sec].push(s);
                    });
                    const rows = Object.entries(groups).map(([sec, list]) => {
                      const wt = list.reduce((x, s) => x + (mWOf(s) || 0), 0);
                      const pes = list.map(s => fundamentals[s]?.peTTM).filter(v => v != null && isFinite(v));
                      const ytds = list.map(s => fundamentals[s]?.ytd).filter(v => v != null && isFinite(v));
                      return {
                        sec, n: list.length, wt,
                        pe: pes.length ? pes.reduce((x, y) => x + y, 0) / pes.length : null,
                        ytd: ytds.length ? ytds.reduce((x, y) => x + y, 0) / ytds.length : null,
                      };
                    }).sort((a, b) => b.wt - a.wt || b.n - a.n);
                    if (!rows.length) return <div style={tEyebrowMuted}>NO SECTOR DATA</div>;
                    return (
                      <div style={{ maxWidth: 560 }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                          <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                            <th style={tTh("left", false)}>Sector</th>
                            {["N", "Wt%", "Avg P/E", "Avg YTD"].map(h => <th key={h} style={tTh("right", false)}>{h}</th>)}
                          </tr></thead>
                          <tbody>
                            {rows.map(r => (
                              <tr key={r.sec} style={{ borderBottom: `1px solid ${C.border}` }} onMouseEnter={e => e.currentTarget.style.background = C.cardHover} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                <td style={{ ...tTd("left"), fontWeight: 600, color: C.t1 }}>{r.sec}</td>
                                <td style={{ ...tTd(), color: C.t3 }}>{r.n}</td>
                                <td style={{ ...tTd(), fontWeight: 600, color: C.t1 }}>{r.wt > 0 ? `${r.wt.toFixed(1)}%` : mDash}</td>
                                <td style={{ ...tTd(), color: r.pe != null ? C.t2 : C.t4 }}>{r.pe != null ? r.pe.toFixed(1) : "—"}</td>
                                <td style={{ ...tTd(), fontWeight: 600, color: mUpDn(r.ytd) }}>{mFmtSgn(r.ytd, 1) ?? "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}

                  {/* ── MATRIX ── */}
                  {metricsSubView === "matrix" && (() => {
                    const pts = mSyms.map(s => {
                      const d = fundamentals[s] || {};
                      return { s, pe: d.peTTM, rev: d.revenueYoY };
                    }).filter(p => p.pe != null && isFinite(p.pe) && p.rev != null && isFinite(p.rev));
                    if (!pts.length) return <div style={tEyebrowMuted}>NO P/E + REVENUE DATA YET</div>;
                    const medOf = arr => [...arr].sort((a, b) => a - b)[Math.floor(arr.length / 2)];
                    const medPE = medOf(pts.map(p => p.pe));
                    const medRev = medOf(pts.map(p => p.rev));
                    const quadrants = [
                      { label: "Stars", desc: "High P/E · High Rev Growth", color: C.accent, stocks: pts.filter(p => p.pe >= medPE && p.rev >= medRev) },
                      { label: "Growth", desc: "Low P/E · High Rev Growth", color: C.up, stocks: pts.filter(p => p.pe < medPE && p.rev >= medRev) },
                      { label: "Value", desc: "Low P/E · Low Rev Growth", color: C.t3, stocks: pts.filter(p => p.pe < medPE && p.rev < medRev) },
                      { label: "Watch", desc: "High P/E · Low Rev Growth", color: C.warn, stocks: pts.filter(p => p.pe >= medPE && p.rev < medRev) },
                    ].map(q => ({ ...q, stocks: [...q.stocks].sort((a, b) => b.rev - a.rev) }));
                    return (
                      <div style={{ maxWidth: 760 }}>
                        <div style={{ ...tEyebrowMuted, marginBottom: 10 }}>SPLIT BY MEDIAN P/E ({medPE.toFixed(1)}) AND MEDIAN REV YOY ({medRev.toFixed(1)}%)</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          {quadrants.map(q => (
                            <div key={q.label} style={{ background: C.card, border: `1px solid ${C.border}`, padding: "10px 12px" }}>
                              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 2 }}>
                                <span style={{ ...tEyebrow, color: q.color }}>{q.label}</span>
                                <span style={{ fontSize: 14, fontWeight: 700, color: q.color }}>{q.stocks.length}</span>
                              </div>
                              <div style={{ ...tEyebrowMuted, fontSize: 8, marginBottom: 8 }}>{q.desc}</div>
                              {!q.stocks.length ? <div style={{ ...tEyebrowMuted, fontSize: 9 }}>NONE</div> : q.stocks.map(p => (
                                <div key={p.s} style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "2px 0" }}>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: C.t1, width: 52, flexShrink: 0 }}>{p.s}</span>
                                  <span style={{ fontSize: 10, fontWeight: 600, color: mUpDn(p.rev), marginLeft: "auto" }}>{p.rev >= 0 ? "+" : ""}{p.rev.toFixed(1)}%</span>
                                  <span style={{ fontSize: 10, color: C.t3, width: 48, textAlign: "right" }}>{p.pe.toFixed(1)}x</span>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>);
              })()}
              {tDrawer === "research" && (<div style={{ maxWidth: 920 }}>
                {researchView ? (() => {
                  const activeReport = researchReports.find(r => r.id === researchView);
                  return (<div>
                    <button onClick={() => { setResearchView(null); setResearchContent(""); }} style={{ ...tBackBtn, marginBottom: 16 }}>← BACK</button>
                    {activeReport && (
                      <div style={{ display: "flex", gap: 12, alignItems: "baseline", marginBottom: 12 }}>
                        <span style={tEyebrow}>{activeReport.category || "Research"}</span>
                        <span style={{ fontSize: 10, color: C.t4 }}>{activeReport.date}</span>
                      </div>
                    )}
                    {researchContent ? renderMarkdown(researchContent) : <div style={tEyebrowMuted}>LOADING REPORT</div>}
                  </div>);
                })() : (
                  !researchReports.length ? <div style={tEyebrowMuted}>NO RESEARCH REPORTS YET</div> : (
                    [...researchReports].sort((a, b) => (b.date || "").localeCompare(a.date || "")).map(report => (
                      <div key={report.id} onClick={() => { setResearchView(report.id); setResearchContent(""); fetch(`${import.meta.env.BASE_URL || "/"}research/${report.file}?t=${Math.floor(Date.now() / 60000)}`).then(r => r.ok ? r.text() : "Failed to load report.").then(setResearchContent).catch(() => setResearchContent("Failed to load report.")); }}
                        style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}`, cursor: "pointer" }}
                        onMouseEnter={e => e.currentTarget.style.background = C.cardHover} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={tEyebrow}>{report.category || "Research"}</span>
                          <span style={{ fontSize: 10, color: C.t4 }}>{report.date}</span>
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: C.t1 }}>{report.title}</div>
                        {report.summary && <div style={{ fontSize: 10, color: C.t4, marginTop: 2 }}>{report.summary}</div>}
                      </div>
                    ))
                  )
                )}
              </div>)}
              {tDrawer === "briefs" && (<div>
                <div style={{ ...tEyebrow, marginBottom: 12 }}>Briefs & Research</div>
                {[
                  { label: "Morning Brief", url: "https://richacarson.github.io/rich-report/morning-briefs.html", desc: "Daily pre-market analysis" },
                  { label: "Market Commentary", url: "https://richacarson.github.io/iown-data", desc: "Market outlook & strategy" },
                  { label: "The Rich Report", url: "https://richacarson.github.io/rich-report/The_Rich_Report.html", desc: "Macro insights & thesis" },
                  { label: "Quarterly Changes", url: "https://richacarson.github.io/rich-report/rebalance/q2-2026/client.html", desc: "Portfolio rebalance report" },
                ].map(l => <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: C.card, border: `1px solid ${C.border}`, marginBottom: 8, color: C.t1, textDecoration: "none" }}><div><div style={{ fontSize: 13, fontWeight: 700 }}>{l.label}</div><div style={{ fontSize: 10, color: C.t3 }}>{l.desc}</div></div><span style={{ color: C.accent, fontSize: 12 }}>→</span></a>)}
              </div>)}
              {tDrawer === "settings" && (<div>
                <div style={{ ...tEyebrow, marginBottom: 12 }}>Settings</div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.t4, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 }}>Theme</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[{ v: "terminal", l: "Terminal" }, { v: "light", l: "Light" }].map(({ v, l }) => (
                      <button key={v} onClick={() => toggleTheme(v)} style={{ flex: 1, padding: "8px 0", border: `1px solid ${theme === v ? C.borderActive : C.border}`, background: theme === v ? C.accentSoft : "transparent", color: theme === v ? C.t1 : C.t3, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.t4, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 }}>Default Layout</div>
                  <div style={{ fontSize: 10, color: C.t4, marginBottom: 8, lineHeight: 1.5 }}>Saved across sessions — the dashboard reopens in your selected layout.</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[{ v: "classic", l: "Classic" }, { v: "terminal", l: "Terminal" }].map(({ v, l }) => (
                      <button key={v} onClick={() => { setLayoutMode(v); localStorage.setItem("iown_layout", v); if (v === "classic") setTDrawer(null); if (!localStorage.getItem("iown_theme_locked")) setTheme(v === "terminal" ? "terminal" : getAutoTheme()); }} style={{ flex: 1, padding: "8px 0", border: `1px solid ${layoutMode === v ? C.borderActive : C.border}`, background: layoutMode === v ? C.accentSoft : "transparent", color: layoutMode === v ? C.t1 : C.t3, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{l}{layoutMode === v ? " · Default" : ""}</button>
                    ))}
                  </div>
                </div>
              </div>)}
            </div>
          </div>
        ) : (<>
        {/* ── CENTER: BRIEF / STOCK PROFILE / CHART ── */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", borderRight: `1px solid ${C.border}` }}>
          {tBriefView ? (
            <>
              <style>{`
                /* ── Editorial base ── */
                .brief-native { color: ${C.t2}; font-family: inherit; font-size: 14px; line-height: 1.85; max-width: none; }
                .brief-native > * { display: block; }
                .brief-native > :first-child { margin-top: 0 !important; }
                .brief-native div { display: block; }
                .brief-native span { display: inline; }
                .brief-native h1, .brief-native h2, .brief-native h3, .brief-native h4 { color: ${C.t1}; font-weight: 700; line-height: 1.35; margin: 2em 0 0.8em; display: block; }
                .brief-native h1 { font-size: 22px; padding-bottom: 10px; border-bottom: 1px solid ${C.accent}55; margin-top: 0.5em; }
                .brief-native h2, .brief-native .section-head { display: block; font-size: 14px; color: ${C.accent}; text-transform: uppercase; letter-spacing: 1.6px; font-weight: 600; margin: 2.4em 0 1em; padding-bottom: 7px; border-bottom: 1px solid ${C.accent}44; line-height: 1.4; }
                .brief-native h3 { font-size: 13px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
                .brief-native h4 { font-size: 11px; color: ${C.t3}; text-transform: uppercase; letter-spacing: 1.2px; }
                .brief-native p { margin: 1.1em 0; display: block; line-height: 1.85; }
                .brief-native a { color: ${C.accent}; text-decoration: none; border-bottom: 1px dashed ${C.accent}66; }
                .brief-native a:hover { border-bottom-style: solid; }
                .brief-native strong, .brief-native b { color: ${C.t1}; font-weight: 700; }
                .brief-native em, .brief-native i { color: ${C.t1}; font-style: italic; }
                .brief-native sup { color: ${C.accent}; font-size: 9px; margin-left: 2px; }
                .brief-native code { background: ${C.surface}; color: ${C.accent}; padding: 1px 6px; font-family: inherit; font-size: 12px; }
                .brief-native pre { background: ${C.surface}; border: 1px solid ${C.border}; padding: 12px; overflow-x: auto; margin: 1em 0; }
                .brief-native pre code { background: transparent; padding: 0; }
                .brief-native blockquote, .brief-native .pullquote { display: block; border-left: 3px solid ${C.accent}; background: ${C.surface}; padding: 14px 20px; margin: 1.8em 0; color: ${C.t1}; font-style: italic; line-height: 1.8; }
                .brief-native ul, .brief-native ol { margin: 1em 0; padding-left: 26px; }
                .brief-native li { margin: 0.6em 0; line-height: 1.8; }
                .brief-native table { width: 100%; border-collapse: collapse; margin: 1.4em 0; font-variant-numeric: tabular-nums; font-size: 12px; line-height: 1.6; }
                .brief-native th { background: ${C.surface}; color: ${C.t4}; text-transform: uppercase; font-size: 10px; letter-spacing: 1.2px; padding: 8px 12px; text-align: left; border-bottom: 1px solid ${C.accent}44; }
                .brief-native td { padding: 8px 12px; border-bottom: 1px solid ${C.border}; vertical-align: top; }
                .brief-native hr { border: none; border-top: 1px solid ${C.border}; margin: 2.2em 0; }
                .brief-native .up { color: ${C.up}; }
                .brief-native .down, .brief-native .dn { color: ${C.dn}; }
                .brief-native br + br { display: none; }

                /* ── Morning brief: snapshot strip ── */
                .brief-native .snapshot { display: flex; flex-wrap: wrap; gap: 0 22px; background: ${C.surface}; border: 1px solid ${C.border}; border-top: 2px solid ${C.accent}; padding: 14px 18px; margin: 0 0 2em; }
                .brief-native .snap-item { display: block; padding: 4px 0; }
                .brief-native .snap-label { display: block; color: ${C.t4}; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 3px; }
                .brief-native .snap-val { display: block; color: ${C.t1}; font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1.5; }
                .brief-native .snap-val.up { color: ${C.up}; } .brief-native .snap-val.dn { color: ${C.dn}; }

                /* ── Morning brief: sections + bullets ── */
                .brief-native .section-start { margin-top: 3em; }
                .brief-native .section-start:first-child { margin-top: 0; }
                .brief-native .section-label { display: block; color: ${C.accent}; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 2px; }
                .brief-native .section-start h2 { margin: 0.2em 0 0.4em; border-bottom: none; font-size: 16px; }
                .brief-native .section-rule { border-top: 1px solid ${C.accent}44; margin: 0 0 1.4em; }
                .brief-native .bullet { display: block; margin: 1.8em 0; padding-left: 20px; border-left: 1px solid ${C.border}; }
                .brief-native .bullet-heading { display: block; color: ${C.t1}; font-size: 11.5px; font-weight: 700; letter-spacing: 0.4px; line-height: 1.75; margin-bottom: 0.7em; position: relative; }
                .brief-native .bullet-heading::before { content: "—"; color: ${C.accent}; position: absolute; left: -20px; top: 0; }
                .brief-native .bullet-body { display: block; color: ${C.t2}; line-height: 1.85; }

                /* ── Morning brief: data box (label/value rows) ── */
                .brief-native .data-box { background: ${C.surface}; border: 1px solid ${C.border}; padding: 10px 16px; margin: 1.8em 0; }
                .brief-native .data-row { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; padding: 6px 0; border-bottom: 1px solid ${C.border}; }
                .brief-native .data-row:last-child { border-bottom: none; }
                .brief-native .data-label { color: ${C.t4}; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; flex-shrink: 0; }
                .brief-native .data-val { color: ${C.t1}; font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; text-align: right; }
                .brief-native .data-val.up { color: ${C.up}; } .brief-native .data-val.dn { color: ${C.dn}; }

                /* ── Morning brief: radar ── */
                .brief-native .radar-group { border: 1px solid ${C.border}; border-left: 2px solid ${C.accent}; padding: 4px 18px; margin: 1.4em 0; }
                .brief-native .radar-item { display: block; margin: 1.3em 0; line-height: 1.85; }
                .brief-native .radar-item > b { display: block; margin-bottom: 0.4em; line-height: 1.7; }

                /* ── Commentary: headline + perf cards ── */
                .brief-native .headline-display { display: block; color: ${C.t1}; font-size: 27px; font-weight: 700; letter-spacing: -0.5px; line-height: 1.25; margin: 0 0 0.4em; }
                .brief-native .headline-display.up { color: ${C.up}; } .brief-native .headline-display.dn { color: ${C.dn}; }
                .brief-native .subhead-display { display: block; color: ${C.t3}; font-size: 13.5px; line-height: 1.8; margin: 0 0 1.6em; padding-bottom: 1.4em; border-bottom: 1px solid ${C.border}; }
                .brief-native .perf-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; margin: 0 0 2em; }
                .brief-native .perf-summary-card { background: ${C.surface}; border: 1px solid ${C.border}; padding: 14px 16px; }
                .brief-native .strat-bar { width: 36px; height: 3px; background: ${C.accent}; margin-bottom: 10px; }
                .brief-native .ps-label { display: block; color: ${C.t4}; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.4px; margin-bottom: 4px; }
                .brief-native .ps-value { display: block; font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1.2; }
                .brief-native .ps-bench { display: block; color: ${C.t3}; font-size: 11px; margin-top: 3px; }
                .brief-native .ps-ytd { display: block; margin-top: 10px; padding-top: 8px; border-top: 1px solid ${C.border}; font-size: 11px; }
                .brief-native .ps-ytd > span { margin-right: 8px; }
                .brief-native .ps-ytd-label { color: ${C.t4}; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.2px; }
                .brief-native .ps-ytd-val { font-weight: 700; font-variant-numeric: tabular-nums; }
                .brief-native .ps-ytd-bench { color: ${C.t3}; }
                .brief-native .cmt-flow p.lead { color: ${C.t1}; font-size: 14.5px; }

                /* ── Commentary: movers ── */
                .brief-native .movers-label { display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; margin: 1.6em 0 0.7em; }
                .brief-native .movers-label.winners { color: ${C.up}; }
                .brief-native .movers-label.decliners { color: ${C.dn}; }
                .brief-native .movers-grid { display: grid; grid-template-columns: 1fr; gap: 10px; margin: 0 0 1.4em; }
                .brief-native .mover { background: ${C.surface}; border: 1px solid ${C.border}; padding: 11px 14px; }
                .brief-native .mover-ticker { display: inline-block; color: ${C.t1}; font-size: 13px; font-weight: 700; margin-right: 10px; }
                .brief-native .mover-pct { display: inline-block; font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; margin-right: 10px; }
                .brief-native .mover-strategy { display: inline-block; color: ${C.t4}; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.2px; border: 1px solid ${C.border}; padding: 1px 7px; vertical-align: middle; }
                .brief-native .mover-catalyst { display: block; color: ${C.t2}; font-size: 13px; line-height: 1.75; margin-top: 7px; }

                /* ── Rich Report / Quarterly: sections ── */
                .brief-native .sec { display: block; margin: 0 0 3em; }
                .brief-native .sec-hd { display: flex; align-items: baseline; gap: 12px; margin: 0 0 1.2em; padding-bottom: 8px; border-bottom: 1px solid ${C.accent}44; }
                .brief-native .sec-hd h2, .brief-native .sec-t { margin: 0; border-bottom: none; font-size: 14px; color: ${C.accent}; text-transform: uppercase; letter-spacing: 1.6px; font-weight: 600; }
                .brief-native .sec-num { color: ${C.t4}; font-size: 11px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: 1px; }
                .brief-native .sec-orn { margin-left: auto; color: ${C.accent}66; font-size: 8px; letter-spacing: 6px; white-space: nowrap; }
                .brief-native .sec-body, .brief-native .sec-bi, .brief-native .sec-bc, .brief-native .sec-cnt { display: block; }

                /* ── Rich Report: bullet cards (bg > bc > bh + bb) ── */
                .brief-native .bg { display: grid; grid-template-columns: 1fr; gap: 10px; margin: 1em 0; }
                .brief-native .bc { background: ${C.card}; border: 1px solid ${C.border}; padding: 13px 16px; }
                .brief-native .bh { display: block; color: ${C.accent}; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 7px; }
                .brief-native .bb { display: block; color: ${C.t2}; font-size: 13.5px; line-height: 1.8; }
                .brief-native p.bb { margin: 1.1em 0 0.6em; }

                /* ── Rich Report: past issues + refs ── */
                .brief-native .pi { margin-top: 3em; }
                .brief-native .pi-hd { display: block; color: ${C.accent}; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 0.8em; padding-bottom: 6px; border-bottom: 1px solid ${C.accent}44; }
                .brief-native .pi-row { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; padding: 8px 0; border-bottom: 1px solid ${C.border}; }
                .brief-native .pi-date, .brief-native .pi-title { color: ${C.t1}; font-size: 12px; font-weight: 600; }
                .brief-native .pi-sub { display: block; color: ${C.t3}; font-size: 11px; }
                .brief-native .pi-badge { display: inline-block; color: ${C.accent}; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; border: 1px solid ${C.accent}66; padding: 1px 7px; margin-left: 8px; }
                .brief-native .pi-row-r { white-space: nowrap; }
                .brief-native .pi-link { font-size: 11px; margin-left: 14px; }
                .brief-native .refs { margin-top: 3em; padding-top: 1em; border-top: 1px solid ${C.border}; font-size: 11.5px; color: ${C.t3}; }

                /* ── Quarterly: buy/sell tags ── */
                .brief-native .tag { display: inline-block; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; padding: 2px 9px; margin-right: 8px; }
                .brief-native .tag-buy { color: ${C.up}; border: 1px solid ${C.up}; }
                .brief-native .tag-sell { color: ${C.dn}; border: 1px solid ${C.dn}; }
              `}</style>
              <div style={{ display: "flex", alignItems: "center", padding: "8px 12px", background: C.surface, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
                <span style={{ ...tEyebrow, marginRight: 12 }}>{tBriefView.category ? tBriefView.category.toUpperCase() : "BRIEF"}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tBriefView.title}</span>
                <a href={tBriefView.viewerUrl || tBriefView.url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: "auto", marginRight: 12, fontSize: 9, color: C.t4, textDecoration: "none", letterSpacing: 1.2, fontWeight: 600, whiteSpace: "nowrap" }}>OPEN BRIEF ↗</a>
                <button onClick={() => setTBriefView(null)} title="Close" style={tCloseBtn}>{tCloseX}</button>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "24px 36px", background: C.bg }}>
                {tBriefLoading ? (
                  <div style={tEyebrowMuted}>LOADING BRIEF</div>
                ) : tBriefFailed ? (
                  <div>
                    <div style={{ ...tEyebrowMuted, color: C.dn, marginBottom: 8 }}>FAILED TO LOAD</div>
                    <iframe src={tBriefView.url} title={tBriefView.title} style={{ width: "100%", height: "calc(100vh - 200px)", border: `1px solid ${C.border}`, background: "#fff" }} />
                  </div>
                ) : (
                  <div className="brief-native" style={{ maxWidth: 720, margin: "0 auto" }} dangerouslySetInnerHTML={{ __html: tBriefHtml }} />
                )}
              </div>
            </>
          ) : tProfileSym && tProfileSym !== "__portfolio__" ? (() => {
            const sym = tProfileSym;
            const f = fundamentals[sym] || {};
            const scr = screenerByTicker[sym];
            const q = quotesRef.current[sym] || quotes[sym];
            const b = barsRef.current[sym] || bars[sym];
            const c = (q?.p && b?.pc) ? ((q.p - b.pc) / b.pc) * 100 : null;
            const fmt1 = v => v != null && isFinite(v) ? Number(v).toFixed(1) : null;
            const fmt2 = v => v != null && isFinite(v) ? Number(v).toFixed(2) : null;
            const fmtPct = (v, dp = 1) => v != null && isFinite(v) ? `${v >= 0 ? "+" : ""}${Number(v).toFixed(dp)}%` : null;
            const upDn = v => v == null ? undefined : v >= 0 ? C.up : C.dn;
            const pItem = ([l, v, color]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "4px 0", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ ...tEyebrowMuted, fontSize: 9 }}>{l}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: v == null ? C.t4 : (color || C.t1), fontVariantNumeric: "tabular-nums", textAlign: "right" }}>{v ?? "—"}</span>
              </div>
            );
            const pSection = (title, items) => (
              <div key={title}>
                <div style={{ ...tEyebrow, paddingBottom: 4, borderBottom: `1px solid ${C.accent}33`, marginBottom: 4 }}>{title}</div>
                <div>{items.map(pItem)}</div>
              </div>
            );
            const desc = f.description || scr?.profile?.description || null;
            const isEtf = (sleeves.sectors?.symbols || []).includes(sym) || (sleeves.digital?.symbols || []).includes(sym) || (f.peTTM == null && !scr);
            return (<>
              {/* Top bar */}
              <div style={{ padding: "8px 12px", background: C.surface, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>{sym}</span>
                <span style={{ fontSize: 12, color: C.t3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{names[sym] || f.companyName || ""}</span>
                <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: C.t1 }}>{q?.p != null ? `$${q.p.toFixed(2)}` : "—"}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: c == null ? C.t4 : c >= 0 ? C.up : C.dn }}>{c != null ? pct(c) : ""}</span>
                <button onClick={() => { setTProfileSym(null); setTerminalActiveSym("__portfolio__"); setTChartHover(null); }} aria-label="Close profile" title="Close" style={tCloseBtn}>{tCloseX}</button>
              </div>
              {/* Sub-tabs */}
              <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
                {[{ v: "overview", l: "Overview" }, { v: "chart", l: "Chart" }, { v: "screener", l: "Screener" }].map(({ v, l }) => (
                  <button key={v} onClick={() => { setTProfileTab(v); if (v === "screener") tOpenScreenerReport(sym); }} style={tTabBtn(tProfileTab === v)}>{l}</button>
                ))}
              </div>
              {/* Content */}
              {tProfileTab === "chart" ? (
                <div style={{ flex: 1, display: "flex", background: C.bg }}>
                  <div style={{ flex: 1, minHeight: 0, background: C.bg }}>
                    <TradingViewChart symbol={sym} theme={theme} bg={tvBg} toolbarBg={tvTbBg} />
                  </div>
                </div>
              ) : (
                <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
                  {tProfileTab === "overview" && isEtf && (
                    <div style={tEyebrowMuted}>ETF — FUNDAMENTALS UNAVAILABLE</div>
                  )}
                  {tProfileTab === "overview" && !isEtf && (<>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
                      {pSection("Identity", [
                        ["Sector", f.sector ?? scr?.profile?.sector ?? null],
                        ["Industry", f.industry ?? scr?.profile?.industry ?? null],
                      ])}
                      {pSection("Valuation", [
                        ["P/E TTM", fmt1(f.peTTM)],
                        ["P/E FWD", fmt1(f.peFwd)],
                        ["PEG", fmt1(f.pegTTM)],
                        ["Yield FWD", f.yieldFwd != null ? `${f.yieldFwd.toFixed(2)}%` : null],
                        ["Payout Ratio", f.payoutRatio != null ? `${f.payoutRatio.toFixed(0)}%` : null],
                        ["Beta", fmt2(f.beta)],
                      ])}
                      {pSection("Growth", [
                        ["Rev YoY", fmtPct(f.revenueYoY), upDn(f.revenueYoY)],
                        ["Rev 5Y", fmtPct(f.revenue5Y), upDn(f.revenue5Y)],
                        ["ROE", f.roe != null ? `${f.roe.toFixed(1)}%` : null],
                        ["D/E", fmt1(f.de)],
                        ["Profit Margin", f.profitMargin != null ? `${f.profitMargin.toFixed(1)}%` : null],
                      ])}
                      {pSection("Returns", [
                        ["Day", fmtPct(c, 2), upDn(c)],
                        ["Last Qtr", fmtPct(f.lastQtr), upDn(f.lastQtr)],
                        ["This Qtr", fmtPct(f.thisQtr), upDn(f.thisQtr)],
                        ["YTD", fmtPct(f.ytd), upDn(f.ytd)],
                        ["52W Range", (f.wk52l != null && f.wk52h != null) ? `$${f.wk52l.toFixed(0)} – $${f.wk52h.toFixed(0)}` : null],
                      ])}
                      {scr && pSection("Screener", [
                        ["Composite", scr.overall_score != null ? `${scr.overall_score} / 100` : null, scr.overall_score >= 70 ? C.up : scr.overall_score >= 50 ? C.t1 : C.warn],
                        ["Recommendation", scr.recommendation ?? null, tRecColor(scr.recommendation)],
                        ["Sleeve", scr.sleeve ?? null],
                        ["Screen Date", scr.screen_date ?? null],
                      ])}
                    </div>
                    {desc && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ ...tEyebrow, marginBottom: 6 }}>About</div>
                        <div style={{ fontSize: 11, color: C.t3, lineHeight: 1.7, maxWidth: 760 }}>{desc}</div>
                      </div>
                    )}
                  </>)}
                  {tProfileTab === "screener" && (
                    (screenerDetail && (screenerDetail.ticker || screenerDetail.symbol) === sym)
                      ? tScreenerReport(screenerDetail, screenerDetailLoading)
                      : <div style={tEyebrowMuted}>LOADING REPORT</div>
                  )}
                </div>
              )}
            </>);
          })() : (() => {
            const isPortfolio = tIsPortfolio;
            const tBmToggles = perfBmToggles;
            return (<>
              <div style={{ padding: "4px 10px", background: C.surface, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 6, flexShrink: 0, flexWrap: "wrap" }}>
                {["dividend", "growth", "fci100", "fciValues"].map(k => {
                  const names = { dividend: "Dividend", growth: "Growth", fci100: "FCI 100", fciValues: "FCI Values" };
                  const active = isPortfolio && tChartSleeve === k;
                  return <button key={k} onClick={() => { setTerminalActiveSym("__portfolio__"); setTChartSleeve(k); setPerfSleeve(k); setTChartHover(null); }} style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 2, border: `1px solid ${active ? C.accentGlow : C.border}`, background: active ? C.accentSoft : "transparent", color: active ? C.accent : C.t3, cursor: "pointer", fontFamily: "inherit" }}>{names[k]}</button>;
                })}
                {isPortfolio && ["1D", "QTD", "YTD", "1Y", "3Y", "5Y", "ALL"].filter(r => {
                  if (r === "1D" || r === "QTD" || r === "YTD" || r === "ALL") return true;
                  const tPort = (perfDataMap[tChartSleeve] || perfData || {}).portfolio || [];
                  const daysAvailable = tPort.length > 1 ? (new Date(tPort[tPort.length - 1].date) - new Date(tPort[0].date)) / 86400000 : 0;
                  const need = { "1Y": 365, "3Y": 365 * 3, "5Y": 365 * 5 }[r] || 0;
                  return daysAvailable >= need * 0.9;
                }).map(r => (
                  <button key={r} onClick={() => { setTChartRange(r); setTChartHover(null); }} style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 2, border: `1px solid ${tChartRange === r ? C.accent + "66" : C.border}`, background: tChartRange === r ? C.accentSoft : "transparent", color: tChartRange === r ? C.accent : C.t4, cursor: "pointer", fontFamily: "inherit" }}>{r}</button>
                ))}
                {isPortfolio && <span style={{ width: 1, height: 14, background: C.border, margin: "0 2px" }} />}
                {isPortfolio && ({ dividend: ["SPY", "DVY", "DIA"], growth: ["SPY", "IUSG", "QQQ"], fci100: ["SPY", "QQQ", "DIA"], fciValues: ["SPY", "QQQ", "DIA"] }[tChartSleeve] || ["SPY", "DVY", "DIA"]).map(bm => {
                  return <button key={bm} onClick={() => setPerfBmToggles(p => ({ ...p, [bm]: !p[bm] }))} style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 2, border: `1px solid ${tBmToggles[bm] ? BM_COLORS[bm] + "66" : C.border}`, background: tBmToggles[bm] ? BM_COLORS[bm] + "20" : "transparent", color: tBmToggles[bm] ? BM_COLORS[bm] : C.t4, cursor: "pointer", fontFamily: "inherit" }}>{bm}</button>;
                })}
                {!isPortfolio && <>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>{terminalActiveSym}</span>
                  <span style={{ fontSize: 11, color: C.t3 }}>{names[terminalActiveSym] || ""}</span>
                  {(() => { const q = quotesRef.current[terminalActiveSym] || quotes[terminalActiveSym]; const b = barsRef.current[terminalActiveSym] || bars[terminalActiveSym]; const c = (q && b?.pc) ? ((q.p - b.pc) / b.pc * 100) : null; return q?.p ? <><span style={{ fontSize: 12, fontWeight: 700, color: C.t1, marginLeft: "auto" }}>${q.p.toFixed(2)}</span><span style={{ fontSize: 11, fontWeight: 600, color: c == null ? C.t4 : c >= 0 ? C.up : C.dn }}>{pct(c)}</span></> : null; })()}
                </>}
              </div>
              {!isPortfolio ? (
                <div style={{ flex: 1, display: "flex", background: C.bg }}>
                  <div style={{ flex: 1, minHeight: 0, background: C.bg }}>
                    <TradingViewChart symbol={terminalActiveSym} theme={theme} bg={tvBg} toolbarBg={tvTbBg} />
                  </div>
                </div>
              ) : (() => {
                const emptyMsg = (txt) => <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase", color: C.t4 }}>{txt}</div>;
                if (!tChartData || tChartData.status === "none") return emptyMsg(perfLoading ? "LOADING PORTFOLIO DATA" : "NO PORTFOLIO HISTORY");
                if (tChartData.status === "insufficient") return emptyMsg("INSUFFICIENT DATA FOR RANGE");
                if (tChartData.status === "no-intraday") return emptyMsg("INTRADAY DATA UNAVAILABLE");
                const PAD = { top: 40, right: 60, bottom: 40, left: 10 };
                const sleeveTitle = ({ dividend: "DIVIDEND", growth: "GROWTH", fci100: "FCI 100", fciValues: "FCI VALUES" })[tChartSleeve] || "PORTFOLIO";
                const niceTicks = (lo, hi) => {
                  const rawSpan = (hi - lo) || 1;
                  const step = rawSpan <= 2 ? 0.5 : rawSpan <= 5 ? 1 : rawSpan <= 10 ? 2 : rawSpan <= 50 ? 5 : rawSpan <= 100 ? 10 : rawSpan <= 200 ? 20 : rawSpan <= 500 ? 50 : 100;
                  const yMin = Math.floor((lo - rawSpan * 0.04) / step) * step;
                  const yMax = Math.ceil((hi + rawSpan * 0.04) / step) * step;
                  const ticks = [];
                  for (let v = yMin; v <= yMax + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
                  return { yMin, yMax, ticks };
                };
                if (tChartData.status === "intraday") {
                  const { candles: candles5m, bmCandles: bmL, mn, mx } = tChartData;
                  const cW2 = tChartDims.w, H2 = tChartDims.h, uW = cW2 - PAD.left - PAD.right;
                  // Y-axis hysteresis: within a session, only widen the range so live ticks don't jitter the axis
                  const tYKey = `${tChartSleeve}|${tChartRange}|${new Date().toDateString()}`;
                  let yLo = mn, yHi = mx;
                  if (tYRangeRef.current.key === tYKey && tYRangeRef.current.lo != null) {
                    yLo = Math.min(tYRangeRef.current.lo, mn);
                    yHi = Math.max(tYRangeRef.current.hi, mx);
                  }
                  tYRangeRef.current = { key: tYKey, lo: yLo, hi: yHi };
                  const { yMin: yMn2, yMax: yMx2, ticks: ticks2 } = niceTicks(yLo, yHi);
                  const gp = uW / Math.max(1, candles5m.length); const cdW = Math.max(2, Math.min(12, gp * 0.75));
                  const xP = i => PAD.left + gp * (i + 0.5); const yP = v => PAD.top + ((yMx2 - v) / (yMx2 - yMn2 || 1)) * (H2 - PAD.top - PAD.bottom);
                  const lastV = candles5m[candles5m.length - 1]?.c || 0;
                  const hc2 = tChartHover != null && tChartHover >= 0 && tChartHover < candles5m.length ? candles5m[tChartHover] : null;
                  const dlt2 = hc2 && tChartHover > 0 ? hc2.c - candles5m[tChartHover - 1].c : null;
                  const dLab2 = []; let lx2 = -70;
                  candles5m.forEach((c, i) => { const px = xP(i); if (px - lx2 >= 70) { dLab2.push(i); lx2 = px; } });
                  return (
                    <div ref={attachTChartBox} style={{ flex: 1, position: "relative", overflow: "hidden" }}>
                      <div style={{ position: "absolute", top: 4, left: 10, zIndex: 2, display: "flex", gap: 12, fontSize: 11, fontFamily: "inherit", fontWeight: 600 }}>
                        <span style={{ color: C.t1, fontWeight: 700, fontSize: 13 }}>{sleeveTitle} 1D {lastV >= 0 ? "+" : ""}{lastV.toFixed(2)}%</span>
                        {Object.entries(bmL).map(([sym, bc]) => <span key={sym} style={{ color: BM_COLORS[sym] }}>{sym} {bc[bc.length - 1]?.c >= 0 ? "+" : ""}{bc[bc.length - 1]?.c.toFixed(2)}%</span>)}
                        <span style={{ color: C.t3 }}>3-MIN CANDLES</span>
                      </div>
                      {hc2 && <div style={{ position: "absolute", top: 20, left: 10, zIndex: 2, fontSize: 11, fontFamily: "inherit", color: C.t2, display: "flex", gap: 10 }}>
                        <span style={{ color: C.t1, fontWeight: 700 }}>{hc2.date}</span>
                        <span>O: {hc2.o >= 0 ? "+" : ""}{hc2.o.toFixed(2)}%</span><span>H: {hc2.h >= 0 ? "+" : ""}{hc2.h.toFixed(2)}%</span><span>L: {hc2.l >= 0 ? "+" : ""}{hc2.l.toFixed(2)}%</span>
                        <span style={{ color: hc2.c >= hc2.o ? C.up : C.dn, fontWeight: 700 }}>C: {hc2.c >= 0 ? "+" : ""}{hc2.c.toFixed(2)}%</span>
                        {dlt2 != null && <span style={{ color: dlt2 >= 0 ? C.up : C.dn }}>Δ {dlt2 >= 0 ? "+" : ""}{dlt2.toFixed(2)}%</span>}
                        <span style={{ color: C.t4 }}>${hc2.rawVal?.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      </div>}
                      <svg width={cW2} height={H2} viewBox={`0 0 ${cW2} ${H2}`} style={{ width: "100%", height: "auto", display: "block", cursor: "crosshair" }} onMouseMove={e => { const r2 = e.currentTarget.getBoundingClientRect(); const sX = cW2 / r2.width; const mX = (e.clientX - r2.left) * sX; const idx = Math.round((mX - PAD.left) / gp - 0.5); setTChartHover(idx >= 0 && idx < candles5m.length ? idx : null); }} onMouseLeave={() => setTChartHover(null)}>
                          <rect x={0} y={0} width={cW2} height={H2} fill={C.bg} />
                          {ticks2.map(v => { const yy = yP(v); return <g key={v}><line x1={PAD.left} y1={yy} x2={cW2 - PAD.right} y2={yy} stroke={C.border} strokeWidth={0.5} /><text x={cW2 - PAD.right + 4} y={yy + 3} fill={C.t4} fontSize={9} fontFamily="'IBM Plex Mono', monospace">{v >= 0 ? "+" : ""}{v.toFixed(2)}%</text></g>; })}
                          {yMn2 <= 0 && yMx2 >= 0 && <line x1={PAD.left} y1={yP(0)} x2={cW2 - PAD.right} y2={yP(0)} stroke={C.t4} strokeWidth={0.5} strokeDasharray="4,4" />}
                          {dLab2.map(i => <text key={i} x={xP(i)} y={H2 - 8} fill={C.t4} fontSize={8} fontFamily="'IBM Plex Mono', monospace" textAnchor="middle">{candles5m[i].date}</text>)}
                          {Object.entries(bmL).map(([sym, bc]) => { const col = BM_COLORS[sym]; const bW = Math.max(1, cdW * 0.45); const off = sym === "SPY" ? -cdW * 0.5 : sym === "DIA" ? cdW * 0.5 : 0; return bc.map((c, i) => (
                            <g key={`${sym}-${i}`} opacity={0.5}><line x1={xP(i) + off} y1={yP(c.h)} x2={xP(i) + off} y2={yP(c.l)} stroke={col} strokeWidth={0.5} /><rect x={xP(i) - bW / 2 + off} y={yP(Math.max(c.o, c.c))} width={bW} height={Math.max(0.5, yP(Math.min(c.o, c.c)) - yP(Math.max(c.o, c.c)))} fill={c.c >= c.o ? col : "transparent"} stroke={col} strokeWidth={0.5} /></g>
                          )); })}
                          {candles5m.map((c, i) => { const bull = c.c >= c.o; const col = bull ? C.up : C.dn; return (
                            <g key={i}><line x1={xP(i)} y1={yP(c.h)} x2={xP(i)} y2={yP(c.l)} stroke={col} strokeWidth={1} /><rect x={xP(i) - cdW / 2} y={yP(Math.max(c.o, c.c))} width={cdW} height={Math.max(1, yP(Math.min(c.o, c.c)) - yP(Math.max(c.o, c.c)))} fill={col} stroke={col} strokeWidth={0.5} rx={0.5} /></g>
                          ); })}
                          {hc2 && <g>
                            <line x1={xP(tChartHover)} y1={PAD.top} x2={xP(tChartHover)} y2={H2 - PAD.bottom} stroke={C.accent} strokeWidth={0.5} strokeDasharray="3,3" />
                            <line x1={PAD.left} y1={yP(hc2.c)} x2={cW2 - PAD.right} y2={yP(hc2.c)} stroke={C.accent} strokeWidth={0.5} strokeDasharray="3,3" />
                            <rect x={xP(tChartHover) - cdW / 2 - 2} y={yP(Math.max(hc2.o, hc2.c, hc2.h)) - 2} width={cdW + 4} height={Math.max(1, yP(Math.min(hc2.o, hc2.c, hc2.l)) - yP(Math.max(hc2.o, hc2.c, hc2.h))) + 4} fill="none" stroke={C.accent} strokeWidth={0.75} />
                          </g>}
                      </svg>
                    </div>
                  );
                }
                const { candles, bmCandles: bmLines, minV, maxV } = tChartData;
                const chartW = tChartDims.w; const H = tChartDims.h;
                const usableW = chartW - PAD.left - PAD.right;
                const { yMin: yMnD, yMax: yMxD, ticks: ticksD } = niceTicks(minV, maxV);
                const gap = usableW / Math.max(1, candles.length);
                const candleW = Math.max(1, Math.min(12, gap * 0.75));
                const xPos = i => PAD.left + gap * (i + 0.5);
                const yPos = v => PAD.top + ((yMxD - v) / (yMxD - yMnD || 1)) * (H - PAD.top - PAD.bottom);
                const lastVal = candles[candles.length - 1]?.c || 0;
                const hc = tChartHover != null && tChartHover >= 0 && tChartHover < candles.length ? candles[tChartHover] : null;
                const dlt = hc && tChartHover > 0 ? hc.c - candles[tChartHover - 1].c : null;
                // Date label format depends on visible span
                const spanDays = candles.length > 1 ? (new Date(candles[candles.length - 1].date) - new Date(candles[0].date)) / 86400000 : 0;
                const fmtDate = ds => {
                  const d = new Date(ds.length > 10 ? ds : ds + "T12:00:00");
                  if (candles.length <= 90 && spanDays <= 190) return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                  if (spanDays <= 740) return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
                  return String(d.getFullYear());
                };
                // Date labels: enforce minimum 70px spacing
                const dateLabels = []; const minLabelGap = 70;
                let lastLabelX = -minLabelGap;
                candles.forEach((c, i) => {
                  const px = xPos(i);
                  if (px - lastLabelX >= minLabelGap) { dateLabels.push(i); lastLabelX = px; }
                });
                return (
                  <div ref={attachTChartBox} style={{ flex: 1, position: "relative", overflow: "hidden" }}>
                    {/* OHLC tooltip */}
                    <div style={{ position: "absolute", top: 4, left: 10, zIndex: 2, display: "flex", gap: 12, fontSize: 11, fontFamily: "inherit", fontWeight: 600 }}>
                      <span style={{ color: C.t1, fontWeight: 700, fontSize: 13 }}>{sleeveTitle} {tChartRange} {lastVal >= 0 ? "+" : ""}{lastVal.toFixed(2)}%</span>
                      {Object.entries(bmLines).map(([sym, bc]) => <span key={sym} style={{ color: BM_COLORS[sym] }}>{sym} {bc[bc.length - 1]?.c >= 0 ? "+" : ""}{bc[bc.length - 1]?.c.toFixed(2)}%</span>)}
                    </div>
                    {hc && (
                      <div style={{ position: "absolute", top: 20, left: 10, zIndex: 2, fontSize: 11, fontFamily: "inherit", color: C.t2, display: "flex", gap: 10 }}>
                        <span style={{ color: C.t1, fontWeight: 700 }}>{hc.date}</span>
                        <span>O: {hc.o >= 0 ? "+" : ""}{hc.o.toFixed(2)}%</span>
                        <span>H: {hc.h >= 0 ? "+" : ""}{hc.h.toFixed(2)}%</span>
                        <span>L: {hc.l >= 0 ? "+" : ""}{hc.l.toFixed(2)}%</span>
                        <span style={{ color: hc.c >= hc.o ? C.up : C.dn, fontWeight: 700 }}>C: {hc.c >= 0 ? "+" : ""}{hc.c.toFixed(2)}%</span>
                        {dlt != null && <span style={{ color: dlt >= 0 ? C.up : C.dn }}>Δ {dlt >= 0 ? "+" : ""}{dlt.toFixed(2)}%</span>}
                        <span style={{ color: C.t4 }}>${hc.rawVal?.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      </div>
                    )}
                    <svg width={chartW} height={H} viewBox={`0 0 ${chartW} ${H}`} style={{ width: "100%", height: "auto", display: "block", cursor: "crosshair" }} onMouseMove={e => { const rect = e.currentTarget.getBoundingClientRect(); const scaleX = chartW / rect.width; const mx = (e.clientX - rect.left) * scaleX; const idx = Math.round((mx - PAD.left) / gap - 0.5); setTChartHover(idx >= 0 && idx < candles.length ? idx : null); }} onMouseLeave={() => setTChartHover(null)}>
                        <rect x={0} y={0} width={chartW} height={H} fill={C.bg} />
                        {ticksD.map(v => { const yp = yPos(v); return <g key={v}><line x1={PAD.left} y1={yp} x2={chartW - PAD.right} y2={yp} stroke={C.border} strokeWidth={0.5} /><text x={chartW - PAD.right + 4} y={yp + 3} fill={C.t4} fontSize={9} fontFamily="'IBM Plex Mono', monospace">{v >= 0 ? "+" : ""}{v.toFixed(1)}%</text></g>; })}
                        {yMnD <= 0 && yMxD >= 0 && <line x1={PAD.left} y1={yPos(0)} x2={chartW - PAD.right} y2={yPos(0)} stroke={C.t4} strokeWidth={0.5} strokeDasharray="4,4" />}
                        {/* Date labels */}
                        {dateLabels.map(i => <text key={i} x={xPos(i)} y={H - 8} fill={C.t4} fontSize={8} fontFamily="'IBM Plex Mono', monospace" textAnchor="middle">{fmtDate(candles[i].date)}</text>)}
                        {/* Benchmark candles */}
                        {Object.entries(bmLines).map(([sym, bc]) => { const col = BM_COLORS[sym]; const bW = Math.max(1, candleW * 0.45); const off = sym === "SPY" ? -candleW * 0.5 : sym === "DIA" ? candleW * 0.5 : 0; return bc.map((c, i) => (
                          <g key={`${sym}-${i}`} opacity={0.5}><line x1={xPos(i) + off} y1={yPos(c.h)} x2={xPos(i) + off} y2={yPos(c.l)} stroke={col} strokeWidth={0.5} /><rect x={xPos(i) - bW / 2 + off} y={yPos(Math.max(c.o, c.c))} width={bW} height={Math.max(0.5, yPos(Math.min(c.o, c.c)) - yPos(Math.max(c.o, c.c)))} fill={c.c >= c.o ? col : "transparent"} stroke={col} strokeWidth={0.5} /></g>
                        )); })}
                        {/* Portfolio candles */}
                        {candles.map((c, i) => { const bull = c.c >= c.o; const col = bull ? C.up : C.dn; return (
                          <g key={i}><line x1={xPos(i)} y1={yPos(c.h)} x2={xPos(i)} y2={yPos(c.l)} stroke={col} strokeWidth={1} /><rect x={xPos(i) - candleW / 2} y={yPos(Math.max(c.o, c.c))} width={candleW} height={Math.max(1, yPos(Math.min(c.o, c.c)) - yPos(Math.max(c.o, c.c)))} fill={col} stroke={col} strokeWidth={0.5} rx={0.5} /></g>
                        ); })}
                        {/* Hover crosshair + ring */}
                        {hc && <g>
                          <line x1={xPos(tChartHover)} y1={PAD.top} x2={xPos(tChartHover)} y2={H - PAD.bottom} stroke={C.accent} strokeWidth={0.5} strokeDasharray="3,3" />
                          <line x1={PAD.left} y1={yPos(hc.c)} x2={chartW - PAD.right} y2={yPos(hc.c)} stroke={C.accent} strokeWidth={0.5} strokeDasharray="3,3" />
                          <rect x={xPos(tChartHover) - candleW / 2 - 2} y={yPos(Math.max(hc.o, hc.c, hc.h)) - 2} width={candleW + 4} height={Math.max(1, yPos(Math.min(hc.o, hc.c, hc.l)) - yPos(Math.max(hc.o, hc.c, hc.h))) + 4} fill="none" stroke={C.accent} strokeWidth={0.75} />
                        </g>}
                    </svg>
                  </div>
                );
              })()}
            </>);
          })()}
        </div>
        </>)}

        {/* ── RIGHT PANEL (always visible — even when a drawer is open) ── */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Sleeves + Benchmarks + Bear Probability (Portfolio Summary removed) */}
          <div style={{ flex: "0 0 auto", maxHeight: "58%", borderBottom: `1px solid ${C.border}`, padding: "8px 12px", overflowY: "auto" }}>
            <div style={{ ...tEyebrow, marginBottom: 4 }}>Sleeves</div>
            {tSleeveKeys.filter(k => k !== "sectors" && k !== "digital").map(k => { const sc = sleeveActualDay(k); return (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 11 }}>
                <span style={{ color: C.t2 }}>{sleeves[k]?.name || k}</span>
                <span style={{ color: sc != null ? (sc >= 0 ? C.up : C.dn) : C.t4, fontWeight: 600 }}>{sc != null ? pct(sc) : "—"}</span>
              </div>
            ); })}
            <div style={{ ...tEyebrow, margin: "8px 0 4px" }}>Benchmarks</div>
            {RAIL_BENCHMARKS.map((sym, i) => {
              const q = bmQuotes[sym] || quotesRef.current?.[sym] || quotes[sym];
              const b = bmBars[sym] || barsRef.current?.[sym] || bars[sym];
              const c = (q?.p && b?.pc) ? ((q.p - b.pc) / b.pc) * 100 : null;
              return (
                <div key={sym} style={{ display: "flex", alignItems: "baseline", padding: "4px 0", borderBottom: i < RAIL_BENCHMARKS.length - 1 ? `1px solid ${C.border}` : "none" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.t1, flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{sym}</span>
                  <span style={{ fontSize: 10, color: q?.p != null ? C.t1 : C.t4, width: 58, textAlign: "right", flexShrink: 0 }}>{q?.p != null ? q.p.toFixed(2) : "—"}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, width: 52, textAlign: "right", flexShrink: 0, color: c == null ? C.t4 : c >= 0 ? C.up : C.dn }}>{c != null ? pct(c) : "—"}</span>
                </div>
              );
            })}
            <div style={{ ...tEyebrow, margin: "8px 0 4px" }}>Bear Probability</div>
            {(() => { const md = macroData; const bullAgeMo = Math.round((Date.now() - new Date("2022-10-12")) / (30.44 * 86400000)); return (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 8px", fontSize: 10 }}>
              <span style={{ color: C.t3 }}>Yield Curve</span><span style={{ color: md.yieldSpread != null ? (md.yieldSpread < 0 ? C.dn : C.up) : C.t4, textAlign: "right" }}>{md.yieldSpread != null ? `${md.yieldSpread >= 0 ? "+" : ""}${md.yieldSpread.toFixed(2)}%` : "—"}</span>
              <span style={{ color: C.t3 }}>SPY P/E</span><span style={{ color: md.spyPE > 30 ? C.dn : md.spyPE > 25 ? C.warn : C.up, textAlign: "right" }}>{md.spyPE ? `${md.spyPE.toFixed(1)}x` : "—"}</span>
              <span style={{ color: C.t3 }}>Bull Age</span><span style={{ color: bullAgeMo > 60 ? C.dn : bullAgeMo > 36 ? C.warn : C.up, textAlign: "right" }}>{bullAgeMo}mo</span>
              <span style={{ color: C.t3 }}>Credit (BAA)</span><span style={{ color: md.baa10y > 3.5 ? C.dn : md.baa10y > 2.5 ? C.warn : C.up, textAlign: "right" }}>{md.baa10y ? `${md.baa10y.toFixed(2)}%` : "—"}</span>
              <span style={{ color: C.t3 }}>SPY vs 200d</span><span style={{ color: md.spy200 && tSpyPrice ? ((tSpyPrice / md.spy200 - 1) * 100 < 0 ? C.dn : C.up) : C.t4, textAlign: "right" }}>{md.spy200 && tSpyPrice ? `${((tSpyPrice / md.spy200 - 1) * 100).toFixed(1)}%` : "—"}</span>
              <span style={{ color: C.t3 }}>Claims</span><span style={{ color: md.claimsTrend > 10 ? C.dn : md.claimsTrend > 0 ? C.warn : C.up, textAlign: "right" }}>{md.claims4wk ? `${(md.claims4wk / 1000).toFixed(0)}K` : "—"}</span>
              <span style={{ color: C.t3 }}>CFNAI</span><span style={{ color: md.cfnai < -0.7 ? C.dn : md.cfnai < -0.2 ? C.warn : C.up, textAlign: "right" }}>{md.cfnai != null ? md.cfnai.toFixed(2) : "—"}</span>
              <span style={{ color: C.t3 }}>Sahm Rule</span><span style={{ color: md.sahmVal > 0.5 ? C.dn : md.sahmVal > 0.3 ? C.warn : C.up, textAlign: "right" }}>{md.sahmVal != null ? `${md.sahmVal.toFixed(2)}pp` : "—"}</span>
            </div>
            ); })()}
          </div>
          {/* News / Opps / Research Feed (remaining space) */}
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, padding: "0 8px", flexShrink: 0 }}>
              {[
                { v: "news", l: "NEWS" },
                { v: "opps", l: "OPPS" },
                { v: "research", l: "RESEARCH" },
                { v: "briefs", l: "BRIEFS" },
              ].map(({ v, l }) => (
                <button key={v} onClick={() => setTRailView(v)} style={tTabBtn(tRailView === v)}>{l}</button>
              ))}
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
              {tRailView === "news" && tAllNews.length === 0 && <div style={{ ...tEyebrowMuted, padding: "8px 12px" }}>LOADING NEWS</div>}
              {tRailView === "news" && tAllNews.slice(0, 50).map((article, i) => (
                <div key={article.id || i} onClick={() => { if (article.url) window.open(article.url, "_blank", "noopener,noreferrer"); else setSelectedArticle(article); }} style={{ padding: "5px 12px", cursor: "pointer", borderBottom: `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 2 }} onMouseEnter={e => e.currentTarget.style.background = C.cardHover} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div title={article.headline || article.title} style={{ fontSize: 11, color: C.t1, fontWeight: 500, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{article.headline || article.title}</div>
                  <div style={{ display: "flex", gap: 8, fontSize: 10, color: C.t4 }}>
                    <span>{article.source || ""}</span>
                    <span>{ago(article.created_at || article.datetime)}</span>
                  </div>
                </div>
              ))}
              {tRailView === "opps" && (!opportunities.length ? <div style={{ ...tEyebrowMuted, padding: "8px 12px" }}>NO OPPORTUNITIES YET</div> : opportunities.map((opp, i) => (
                <div key={opp.id || i} onClick={() => { setOppDetail(opp); setTDrawer("opportunities"); }} style={{ padding: "6px 12px", borderBottom: `1px solid ${C.border}`, cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.background = C.cardHover} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                    <span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.2, color: opp.conviction === "High Conviction" ? C.up : C.accent }}>{opp.conviction || "Opportunity"}</span>
                    <span style={{ fontSize: 9, color: C.t4 }}>{opp.date_identified || ""}</span>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.t1, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{opp.title}</div>
                  <div style={{ fontSize: 10, color: C.t4, marginTop: 2 }}>{`${opp.pattern || "—"} · ${(opp.tickers || []).slice(0, 4).join(" · ")}`}</div>
                </div>
              )))}
              {tRailView === "research" && (!researchReports.length ? <div style={{ ...tEyebrowMuted, padding: "8px 12px" }}>NO RESEARCH REPORTS YET</div> : researchReports.slice().sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 30).map(report => (
                <div key={report.id} onClick={() => { setTDrawer("research"); setResearchView(report.id); setResearchContent(""); fetch(`${import.meta.env.BASE_URL || "/"}research/${report.file}?t=${Math.floor(Date.now() / 60000)}`).then(r => r.ok ? r.text() : "Failed to load report.").then(setResearchContent).catch(() => setResearchContent("Failed to load report.")); }} style={{ padding: "6px 12px", borderBottom: `1px solid ${C.border}`, cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.background = C.cardHover} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                    <span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.2, color: C.accent }}>{report.category || "RESEARCH"}</span>
                    <span style={{ fontSize: 9, color: C.t4 }}>{report.date}</span>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.t1, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{report.title}</div>
                  <div style={{ fontSize: 10, color: C.t4, marginTop: 2 }}>{`${report.date || ""}${report.author ? " · " + report.author : ""}`}</div>
                </div>
              )))}
              {tRailView === "briefs" && (!tBriefIndex.length ? <div style={{ ...tEyebrowMuted, padding: "8px 12px" }}>LOADING BRIEFS</div> : [
                { cat: "Morning Brief", desc: "Daily pre-market analysis" },
                { cat: "Market Commentary", desc: "Market outlook & strategy" },
                { cat: "The Rich Report", desc: "Macro insights & thesis" },
                { cat: "Quarterly Changes", desc: "Rebalance report" },
              ].map(({ cat, desc }) => {
                const latest = tBriefIndex.find(b => b.category === cat);
                return (
                  <div key={cat} onClick={() => { if (!latest) return; setTBriefView({ title: latest.title, category: latest.category, url: latest.url, viewerUrl: latest.viewerUrl }); setTDrawer(null); setTProfileSym(null); }}
                    style={{ padding: "8px 12px", borderBottom: `1px solid ${C.border}`, cursor: latest ? "pointer" : "not-allowed", opacity: latest ? 1 : 0.5 }}
                    onMouseEnter={e => latest && (e.currentTarget.style.background = C.cardHover)} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                      <span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.2, color: C.accent }}>{cat.toUpperCase()}</span>
                      <span style={{ fontSize: 9, color: C.t4 }}>{latest?.date || "—"}</span>
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: C.t1 }}>{cat}</div>
                    <div style={{ fontSize: 10, color: C.t4, marginTop: 2 }}>{desc}</div>
                  </div>
                );
              }))}
            </div>
          </div>
        </div>

        {/* ── SECTION TABS ── */}
        <div style={{ gridColumn: "1 / -1", display: "flex", gap: 0, borderTop: `1px solid ${C.border}`, background: C.surface, flexShrink: 0 }}>
          {[
            { id: "__home", label: "Home" },
            { id: "playbook", label: "Playbook" },
            { id: "screener", label: "Screener" },
            { id: "performance", label: "Perf" },
            { id: "holdings", label: "Holdings" },
            { id: "metrics", label: "Metrics" },
            { id: "settings", label: "Settings" },
          ].map(t => (
            <button key={t.id} onClick={() => {
              if (t.id === "__home") {
                setTDrawer(null);
                setTProfileSym(null);
                setTerminalActiveSym("__portfolio__");
                setTChartSleeve("dividend");
                setTChartRange("3Y");
                setPerfSleeve("dividend");
                setTChartHover(null);
              } else {
                setTDrawer(tDrawer === t.id ? null : t.id);
              }
            }} style={{
              flex: 1, padding: "6px 0", fontSize: 10, fontWeight: 700, fontFamily: "inherit",
              background: tDrawer === t.id ? C.accentSoft : "transparent",
              border: "none", borderRight: `1px solid ${C.border}`,
              color: tDrawer === t.id ? C.accent : (t.id === "__home" ? C.accent : C.t4), cursor: "pointer",
              textTransform: "uppercase", letterSpacing: 1.2,
            }}>{t.label}</button>
          ))}
        </div>

        {/* ── BOTTOM STATUS BAR ── */}
        <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", background: C.surface, borderTop: `1px solid ${C.border}`, fontSize: 10 }}>
          <span style={{ color: C.accent, fontWeight: 600, letterSpacing: 1.2 }}>PARADIEM TERMINAL</span>
          <span style={{ color: C.t3 }}>{sleeves[tChartSleeve]?.name || ""} — {tSleeveSyms.length} stocks</span>
          <span style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {(() => { const staleMs = lastUp ? tClockNow.getTime() - lastUp.getTime() : null; const staleColor = staleMs == null || staleMs < 60000 ? C.t4 : staleMs < 300000 ? C.warn : C.dn; return (
              <span title="last quote received" style={{ color: staleColor }}>{lastUp ? `Data: ${lastUp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "Loading..."}</span>
            ); })()}
            <button onClick={() => { setTDrawer(null); setLayoutMode("classic"); try { localStorage.setItem("iown_layout", "classic"); } catch {} if (!localStorage.getItem("iown_theme_locked")) setTheme(getAutoTheme()); }} title="Exit Terminal Layout" style={{ background: "none", border: "none", padding: 0, color: C.t3, fontSize: 10, fontWeight: 600, letterSpacing: 1.2, cursor: "pointer", fontFamily: "inherit" }}>EXIT</button>
          </span>
        </div>

        {/* Brief overlay — embedded iframe */}
        {/* Article reader overlay (reuse existing) */}
        {selectedArticle && (() => { const a = selectedArticle; return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setSelectedArticle(null)}>
            <div onClick={e => e.stopPropagation()} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, width: "60%", maxWidth: 700, maxHeight: "80vh", overflow: "auto", padding: 24, fontFamily: tFont }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: 10, color: C.t4 }}>{a.source} — {ago(a.created_at || a.datetime)}</span>
                <button onClick={() => setSelectedArticle(null)} style={tCloseBtn} title="Close" aria-label="Close">{tCloseX}</button>
              </div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: C.t1, marginBottom: 8 }}>{a.headline || a.title}</h2>
              <p style={{ fontSize: 12, color: C.t2, lineHeight: 1.6 }}>{a.summary || a.content || "No content available."}</p>
              {a.url && <a href={a.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: C.accent, marginTop: 12, display: "inline-block" }}>Read full article →</a>}
            </div>
          </div>
        ); })()}

        {tickerSearchModal}
      </div>
    );
  }

  return (
    <div ref={contentRef} onTouchStart={handleTabSwipeStart} onTouchEnd={handleTabSwipeEnd} style={{ minHeight: "100dvh", background: C.bg, color: C.t1, display: isDesktop ? "flex" : "block", paddingBottom: isDesktop ? 0 : 90, overflowY: "auto", fontFamily: theme === "terminal" ? "'IBM Plex Mono', 'SF Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace" : undefined, letterSpacing: theme === "terminal" ? "-0.2px" : undefined, fontSize: theme === "terminal" ? "13px" : undefined }}>

      {tickerSearchModal}

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
          <div style={{ padding: "12px 20px 0" }}>
            <button
              onClick={openTickerSearch} title="Search any ticker (/ or Cmd+K)"
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxSizing: "border-box", padding: "8px 12px", background: C.navAccentSoft, border: `1px solid ${C.navBorder}`, borderRadius: 8, color: C.navText, fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = C.accent} onMouseLeave={e => e.currentTarget.style.borderColor = C.navBorder}
            >⌕ Search · /</button>
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
        background: theme !== "light" ? "rgba(23,23,56,0.88)" : "rgba(244,239,228,0.94)", backdropFilter: "blur(24px) saturate(1.2)", WebkitBackdropFilter: "blur(24px) saturate(1.2)",
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
          <button onClick={() => setTickerSearchOpen(true)} aria-label="Search ticker" style={{
            width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center",
            background: "transparent", border: `1px solid ${C.border}`, borderRadius: 10, cursor: "pointer",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.t2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
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
            {/* Lists header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 0 8px" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: C.t1 }}>Lists</div>
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
                if (metricSort.col === "_yrsPaid" || metricSort.col === "_yrsGrown") {
                  const kk = metricSort.col === "_yrsPaid" ? "yearsPaid" : "yearsGrown";
                  const av = dividendHistory[a]?.[kk] ?? null; const bv = dividendHistory[b]?.[kk] ?? null;
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
          const iconProps = (color) => ({ width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round" });
          const BRIEFS = [
            { id: "morning", title: "Morning Brief", desc: "Daily pre-market analysis", url: "https://richacarson.github.io/rich-report/morning-briefs.html", color: theme !== "light" ? "#F59E0B" : "#D97706",
              icon: (c) => (<svg {...iconProps(c)}><circle cx="12" cy="14" r="4" /><line x1="12" y1="6" x2="12" y2="3" /><line x1="5" y1="14" x2="2" y2="14" /><line x1="22" y1="14" x2="19" y2="14" /><line x1="6.34" y1="8.34" x2="4.22" y2="6.22" /><line x1="17.66" y1="8.34" x2="19.78" y2="6.22" /><line x1="2" y1="20" x2="22" y2="20" /></svg>) },
            { id: "commentary", title: "Market Commentary", desc: "Market outlook & strategy", url: "https://richacarson.github.io/iown-data", color: theme !== "light" ? "#34D399" : "#16A34A",
              icon: (c) => (<svg {...iconProps(c)}><line x1="3" y1="20" x2="21" y2="20" /><rect x="5" y="12" width="3" height="6" rx="0.5" /><rect x="10.5" y="8" width="3" height="10" rx="0.5" /><rect x="16" y="4" width="3" height="14" rx="0.5" /></svg>) },
            { id: "report", title: "The Rich Report", desc: "Macro insights & thesis", url: "https://richacarson.github.io/rich-report/The_Rich_Report.html", color: theme !== "light" ? "#6366F1" : "#4F46E5",
              icon: (c) => (<svg {...iconProps(c)}><path d="M4 4h12a2 2 0 0 1 2 2v13a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2V4z" /><line x1="7" y1="8" x2="15" y2="8" /><line x1="7" y1="12" x2="15" y2="12" /><line x1="7" y1="16" x2="12" y2="16" /></svg>) },
            { id: "quarterly", title: "Quarterly Changes", desc: "Portfolio rebalance report", url: "https://richacarson.github.io/rich-report/rebalance/q2-2026/client.html", color: theme !== "light" ? "#A78BFA" : "#7C3AED",
              icon: (c) => (<svg {...iconProps(c)}><rect x="6" y="4" width="12" height="17" rx="2" /><path d="M9 4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2h-6V4z" /><line x1="9" y1="11" x2="15" y2="11" /><line x1="9" y1="15" x2="13" y2="15" /></svg>) },
          ];

          return (
            <div style={{ animation: "fadeIn 0.3s ease", paddingTop: 20 }}>
              {!isDesktop && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.accent, textTransform: "uppercase", letterSpacing: 1.6, marginBottom: 6 }}>Daily Reading</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: C.t1 }}>Briefs</div>
                </div>
              )}

              <div style={{ display: isDesktop ? "grid" : "flex", gridTemplateColumns: isDesktop ? "repeat(3, 1fr)" : undefined, flexDirection: isDesktop ? undefined : "column", gap: 14 }}>
                {BRIEFS.map(b => (
                  <div key={b.id} onClick={() => window.open(b.url, "_blank", "noopener,noreferrer")} style={{
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
                        width: 44, height: 44, borderRadius: 12,
                        background: b.color + "15", display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                      }}>{b.icon(b.color)}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: C.t1, marginBottom: 4 }}>{b.title}</div>
                        <div style={{ fontSize: 12, color: C.t4, lineHeight: 1.4 }}>{b.desc}</div>
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.t4} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 6 }}>
                        <path d="M7 17L17 7M17 7H7M17 7v10" />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ━━━ RESEARCH ━━━ */}
        {tab === "research" && (() => {

          const activeReport = researchReports.find(r => r.id === researchView);

          return (
            <div style={{ animation: "fadeIn 0.3s ease", paddingTop: 20 }}>
              {!isDesktop && !researchView && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.accent, textTransform: "uppercase", letterSpacing: 1.6, marginBottom: 6 }}>Deep Dives</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: C.t1 }}>Research</div>
                </div>
              )}

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
                    const sortedReports = [...researchReports].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
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
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {sortedReports.map(r => <ReportCard key={r.id} report={r} />)}
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

          const BEAR_MARKETS = PB_BEAR_MARKETS;
          const BULL_MARKETS = [
            ...PB_BULL_MARKETS_BASE,
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

          const BEAR_TRANCHES = PB_BEAR_TRANCHES;

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
              {!isDesktop && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.accent, textTransform: "uppercase", letterSpacing: 1.6, marginBottom: 6 }}>Strategy</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: C.t1 }}>Playbook</div>
                </div>
              )}

              {/* Sub-nav */}
              <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
                {[{ v: "regime", l: "Live Regime" }, { v: "bear", l: "Bear Playbook" }, { v: "simulator", l: "Simulator" }, { v: "probability", l: "Probability" }, { v: "scripts", l: "Scripts" }, { v: "history", l: "History" }, { v: "proof", l: "Why It Works" }].map(({ v, l }) => (
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

              {/* ── BEAR MARKET BOND PLAYBOOK ── */}
              {pbView === "bear" && (
                <div>
                  <div style={cardStyle}>
                    {sectionTitle("Bear Market Deployment Tranches")}
                    <div style={{ fontSize: 12, color: C.t3, marginBottom: 14 }}>Two-tranche system: deploy 70% at -25%, remaining 30% at -40%. Front-loaded because -25% has the highest expected-value-per-dollar across 22 historical bears (1929-2024): 87% hit rate × 33% recovery return = 29¢ per $1 deployed. The -25% / -40% pair skips the -35% tier (dominated on both axes) and the -50% tier (too rare to justify reserving capital).</div>
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
                      <p style={{ marginBottom: 10 }}>In a bear market, <strong style={{ color: C.t1 }}>only Year-5 bonds</strong> are touched — the furthest from maturity. Deploy 70% at -25% (the high-probability tranche, hit by 87% of bears) and the remaining 30% at -40% (the deep-value tranche, hit by 32%). Front-loading at -25% captures the highest expected alpha per dollar; the -40% reserve preserves powder for genuinely deep bears.</p>
                      <p style={{ marginBottom: 10 }}>When the market recovers to the prior peak, rebuild the Year-5 position from equity gains.</p>
                      <p>For <strong style={{ color: C.t1 }}>non-bond accumulating clients</strong>: the deploy mechanic still works at a smaller scale by holding a single 5-year Treasury bond (5-10% of portfolio) as a deployment reserve. At forward equity returns below ~8%, this produces small positive alpha; at higher equity returns it's roughly a wash. The simpler honest alternative for pure-growth accounts is 100% equity with no deploy mechanic.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* ── SCENARIO SIMULATOR ── */}
              {pbView === "simulator" && (() => {
                const historicalBears = BEAR_MARKETS.filter(b => !b.nearBear && Math.abs(b.drawdown) >= 20);
                const selectedBear = historicalBears.find(b => b.name === pbSimHistBear);
                const dropPct = selectedBear ? Math.abs(selectedBear.drawdown) : pbSimDrop;

                // Portfolio shape: 5-year bond ladder + equity sleeve
                const bondPerYear = pbSimBondPerYear;
                const equityVal = pbSimEquity;
                const totalBonds = 5 * bondPerYear;        // entire ladder
                const bondsKept = 4 * bondPerYear;         // Years 1-4 (untouched)
                const cashReserves = bondPerYear;          // Year-5 (deployable)
                const portfolioVal = totalBonds + equityVal;

                // Walk through deploy tranches
                const trancheResults = [];
                let remainingCash = cashReserves;
                let totalDeployed = 0;
                const deployedAtLevels = [];
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

                // At the bear bottom
                const equityAfterDrop = equityVal * (1 - dropPct / 100);
                // Value of deployed cash at the bottom: each tranche bought equity at
                // price (1 - level/100) of peak, which is now worth (1 - dropPct/100)
                // of peak — so it dropped from deploy price by the marginal amount.
                let deployedValueAtBottom = 0;
                for (const d of deployedAtLevels) {
                  const deployLevel = Math.abs(d.level) / 100;
                  deployedValueAtBottom += d.amount * (1 - dropPct / 100) / (1 - deployLevel);
                }
                const portfolioAtBottom = bondsKept + remainingCash + equityAfterDrop + deployedValueAtBottom;
                // Baseline: passive bond-holding (5 bonds untouched + equity drops)
                const bhAtBottom = totalBonds + equityAfterDrop;
                const saved = portfolioAtBottom - bhAtBottom;

                // At full recovery (equity returns to peak)
                let deploymentAlpha = 0;
                for (const d of deployedAtLevels) {
                  const buyDiscount = Math.abs(d.level);
                  const returnToRecovery = buyDiscount / (100 - buyDiscount);
                  deploymentAlpha += d.amount * returnToRecovery;
                }
                const portfolioAfterRecovery = totalBonds + equityVal + deploymentAlpha;
                const bhAtRecovery = totalBonds + equityVal;
                const recoveryGain = dropPct / (100 - dropPct) * 100;

                return (
                  <div>
                    <div style={cardStyle}>
                      {sectionTitle("Bond-Deploy Scenario Simulator")}
                      <div style={{ fontSize: 12, color: C.t3, marginBottom: 10, lineHeight: 1.6 }}>Models the bond-deploy strategy for a client portfolio with a 5-year bond ladder + equity sleeve. Year-5 bond is the deployable reserve (sold in bear-market tranches). Years 1-4 are inviolate — they fund the next four years of living expenses. Edit the bond and equity amounts to match a specific client.</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.t4, textTransform: "uppercase", marginBottom: 6 }}>Simulate a Historical Bear Market</div>
                      <select value={pbSimHistBear} onChange={e => { setPbSimHistBear(e.target.value); if (e.target.value) { const b = historicalBears.find(x => x.name === e.target.value); if (b) setPbSimDrop(Math.abs(b.drawdown)); } }} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.borderActive}`, background: C.bg, color: C.t1, fontSize: 14, fontWeight: 600, fontFamily: "inherit", marginBottom: 12, appearance: "auto" }}>
                        <option value="">Custom scenario (use slider)</option>
                        {historicalBears.map(b => <option key={b.name} value={b.name}>{b.name} ({b.peakDate}) — {b.drawdown}% in {b.durationMo}mo</option>)}
                      </select>
                      {selectedBear && (
                        <div style={{ background: C.accent + "10", border: `1px solid ${C.accent}20`, borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 12, color: C.t2, lineHeight: 1.6 }}>
                          <strong style={{ color: C.t1 }}>{selectedBear.name}</strong> ({selectedBear.peakDate} → {selectedBear.troughDate}) — S&P fell <strong style={{ color: C.dn }}>{selectedBear.drawdown}%</strong> over {selectedBear.durationMo} months. Recovery took {selectedBear.recoveryMo} months.
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: 180 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: C.t4, textTransform: "uppercase", marginBottom: 6 }}>Per-Bond Amount</div>
                          <input type="text" value={`$${bondPerYear.toLocaleString()}`} onChange={e => { const v = parseInt(e.target.value.replace(/[^0-9]/g, "")); if (v >= 0) setPbSimBondPerYear(v); }} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.borderActive}`, background: C.bg, color: C.t1, fontSize: 16, fontWeight: 700, fontFamily: "inherit" }} />
                          <div style={{ fontSize: 10, color: C.t4, marginTop: 4 }}>1 year of living expenses × 5 bonds = ${totalBonds.toLocaleString()}</div>
                        </div>
                        <div style={{ flex: 1, minWidth: 180 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: C.t4, textTransform: "uppercase", marginBottom: 6 }}>Equity Sleeve</div>
                          <input type="text" value={`$${equityVal.toLocaleString()}`} onChange={e => { const v = parseInt(e.target.value.replace(/[^0-9]/g, "")); if (v >= 0) setPbSimEquity(v); }} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.borderActive}`, background: C.bg, color: C.t1, fontSize: 16, fontWeight: 700, fontFamily: "inherit" }} />
                          <div style={{ fontSize: 10, color: C.t4, marginTop: 4 }}>Total portfolio: ${portfolioVal.toLocaleString()} ({(equityVal / portfolioVal * 100).toFixed(0)}% equity / {(totalBonds / portfolioVal * 100).toFixed(0)}% bonds)</div>
                        </div>
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: C.t4, textTransform: "uppercase", marginBottom: 6 }}>Market Drop: -{dropPct}%</div>
                          <input type="range" min={10} max={60} value={dropPct} onChange={e => { setPbSimDrop(Number(e.target.value)); setPbSimHistBear(""); }} style={{ width: "100%", accentColor: C.dn }} />
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.t4 }}><span>-10%</span><span>-20%</span><span>-30%</span><span>-40%</span><span>-50%</span><span>-60%</span></div>
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: C.t3, padding: "10px 14px", background: C.bg, borderRadius: 10, lineHeight: 1.5 }}>
                        Deployable reserve = Year-5 bond = <strong style={{ color: C.accent }}>${cashReserves.toLocaleString()}</strong>.
                        Deploy schedule: <strong>${(cashReserves * 0.70).toLocaleString()} at -25%</strong>, <strong>${(cashReserves * 0.30).toLocaleString()} at -40%</strong>.
                      </div>
                    </div>

                    {/* Waterfall */}
                    <div style={cardStyle}>
                      {sectionTitle("At The Bottom")}
                      <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(3, 1fr)" : "1fr", gap: 10, marginBottom: 14 }}>
                        <div style={{ background: C.dn + "12", borderRadius: 12, padding: 16, textAlign: "center", border: `1px solid ${C.dn}30` }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: C.t4, textTransform: "uppercase", marginBottom: 4 }}>Passive Bond Hold</div>
                          <div style={{ fontSize: 22, fontWeight: 900, color: C.dn }}>${bhAtBottom.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                          <div style={{ fontSize: 11, color: C.dn }}>-${(portfolioVal - bhAtBottom).toLocaleString(undefined, { maximumFractionDigits: 0 })} equity loss</div>
                        </div>
                        <div style={{ background: C.up + "12", borderRadius: 12, padding: 16, textAlign: "center", border: `1px solid ${C.up}30` }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: C.t4, textTransform: "uppercase", marginBottom: 4 }}>Playbook Value</div>
                          <div style={{ fontSize: 22, fontWeight: 900, color: C.t1 }}>${portfolioAtBottom.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                          <div style={{ fontSize: 11, color: saved >= 0 ? C.up : C.dn }}>{saved >= 0 ? "+" : ""}${saved.toLocaleString(undefined, { maximumFractionDigits: 0 })} vs passive</div>
                        </div>
                        <div style={{ background: C.accent + "12", borderRadius: 12, padding: 16, textAlign: "center", border: `1px solid ${C.accent}30` }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: C.t4, textTransform: "uppercase", marginBottom: 4 }}>Bonds Deployed</div>
                          <div style={{ fontSize: 22, fontWeight: 900, color: C.accent }}>${totalDeployed.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                          <div style={{ fontSize: 11, color: C.t3 }}>buying equity at a discount</div>
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
                      <div style={{ fontSize: 12, color: C.t3, marginBottom: 12 }}>When the equity sleeve returns to its prior peak, the deployed bonds have earned the recovery return. Baseline = passive bond-holding (same portfolio shape, bonds untouched).</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        {statBox("Passive Bond Hold", `$${bhAtRecovery.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, C.t3)}
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

                // Factor 1: Yield Curve (10Y-3M) — strongest single recession predictor
                // 10Y-3M is the NY Fed's chosen spread; the 2Y series only starts 1976.
                // Post-inversion premium: recessions start AFTER de-inversion (Bauer & Mertens 2018)
                // Premium decays linearly over 24 months post de-inversion.
                {
                  const yc = (md.yield10Y != null && md.yield3M != null) ? md.yield10Y - md.yield3M : md.yieldSpread;
                  if (yc != null) {
                    let score = interp(yc, [[-2.5, 92], [-1.2, 80], [-0.5, 64], [0.0, 46], [0.7, 30], [1.5, 18], [2.5, 10], [3.5, 5]]);
                    const inversionEndDate = new Date("2024-10-01");
                    const monthsSinceDeInversion = Math.max(0, (Date.now() - inversionEndDate) / (30.44 * 86400000));
                    const postInvPremium = monthsSinceDeInversion < 24 && yc > 0 ? Math.round(18 * (1 - monthsSinceDeInversion / 24)) : 0;
                    score = Math.min(95, score + postInvPremium);
                    const piNote = postInvPremium > 0 ? ` +${postInvPremium}pt post-inversion (${Math.round(monthsSinceDeInversion)}mo since de-inversion)` : "";
                    factors.push({ name: "Yield Curve", value: `${yc > 0 ? "+" : ""}${yc.toFixed(2)}%`, detail: `10Y: ${md.yield10Y?.toFixed(2)}% / 3M: ${md.yield3M?.toFixed(2)}%${piNote}`, score, weight: 18, color: score > 50 ? C.dn : score > 30 ? "#FBBF24" : C.up, citation: "10Y-3M (NY Fed recession model)" });
                  }
                }

                // Factor 2: Valuation (P/E) — steepened curve: GFC started at 21x, 2022 bear at 23x
                if (md.spyPE != null) {
                  const score = interp(md.spyPE, [[12, 5], [16, 15], [19, 30], [21, 42], [24, 52], [28, 62], [32, 72], [36, 80], [40, 85]]);
                  factors.push({ name: "Valuation", value: `${md.spyPE.toFixed(1)}x P/E`, detail: "SPY trailing P/E (GFC started at 21x, 2022 bear at 23x)", score, weight: 13, color: score > 50 ? C.dn : score > 30 ? "#FBBF24" : C.up, citation: "Shiller (2000)" });
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

                // Factor 5: NFCI (Chicago Fed National Financial Conditions Index)
                // 105-component composite of risk, credit, leverage, and money-market indicators.
                // Z-scored so 0 = average. >0 = tighter than average. NFCI > 0.5 has preceded
                // every major equity correction since 1973 (Chicago Fed, Brave & Butters 2010).
                if (md.nfci != null) {
                  const score = interp(md.nfci, [[-0.7, 5], [-0.3, 12], [0, 25], [0.3, 42], [0.6, 58], [1.0, 72], [1.5, 84], [2.5, 92]]);
                  factors.push({ name: "Financial Conditions", value: `NFCI ${md.nfci >= 0 ? "+" : ""}${md.nfci.toFixed(2)}`, detail: `Chicago Fed 105-factor financial conditions index — ${md.nfciDate || ""}`, score, weight: 10, color: score > 50 ? C.dn : score > 30 ? "#FBBF24" : C.up, citation: "FRED NFCI (Brave & Butters 2010)" });
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

                // Factor 10: Oil Shock (WTI YoY) — every post-WWII US recession except 2020
                // was preceded by a significant oil price spike. Transmits to earnings on a
                // 3-4 quarter lag (Hamilton 1983, 2003; Kilian 2009).
                if (md.oilYoY != null) {
                  const score = interp(md.oilYoY, [[-20, 5], [-5, 10], [10, 18], [25, 32], [40, 50], [60, 68], [85, 82], [120, 92]]);
                  factors.push({ name: "Oil Shock", value: `${md.oilYoY >= 0 ? "+" : ""}${md.oilYoY.toFixed(1)}% YoY`, detail: `WTI: $${md.oilPrice?.toFixed(2) || "—"} — 3-4 quarter lag to earnings`, score, weight: 5, color: score > 50 ? C.dn : score > 30 ? "#FBBF24" : C.up, citation: "Hamilton (2003), Kilian (2009)" });
                }

                // Factor 11: SPY Trailing EPS Trend — falling trailing earnings = earnings recession in progress
                // Derived from existing SPY price / P/E. Tracks 90-day change to flag earnings rolling over.
                if (md.epsChg90d != null) {
                  const score = interp(md.epsChg90d, [[-8, 90], [-5, 75], [-3, 58], [-1, 42], [0, 30], [2, 18], [4, 10], [6, 5]]);
                  factors.push({ name: "EPS Trend", value: `${md.epsChg90d >= 0 ? "+" : ""}${md.epsChg90d.toFixed(1)}% (90d)`, detail: `SPY trailing EPS: $${md.spyEpsTtm?.toFixed(2) || "—"} — falling = earnings recession`, score, weight: 7, color: score > 50 ? C.dn : score > 30 ? "#FBBF24" : C.up, citation: "Derived from SPY price / trailing P/E" });
                } else if (md.spyEpsTtm != null) {
                  factors.push({ name: "EPS Trend", value: "Warming up", detail: `SPY trailing EPS: $${md.spyEpsTtm.toFixed(2)} — need ~60 days of history for trend (${md.epsHistLen || 0} so far)`, score: 30, weight: 7, color: "#FBBF24", citation: "Derived from SPY price / P/E" });
                }

                // Composite: weighted average + concordance bonus (calibrated to 6-factor count)
                const totalWeight = factors.reduce((a, f) => a + f.weight, 0);
                const baseComposite = totalWeight > 0 ? factors.reduce((a, f) => a + f.score * (f.weight / totalWeight), 0) : null;
                const elevatedCount = factors.filter(f => f.score >= 50).length;
                const concordanceBonus = elevatedCount >= 4 ? 15 : elevatedCount >= 3 ? 10 : elevatedCount >= 2 ? 5 : 0;
                const rawComposite = baseComposite != null ? Math.min(95, Math.max(5, Math.round(baseComposite + concordanceBonus))) : null;

                // Logistic regression: apply the trained model from the backtest.
                // Coefficients fit on raw factor inputs (L2-regularized), validated
                // with walk-forward out-of-sample evaluation. Bucket recalibration
                // maps the raw probability to the realized historical rate.
                const lrModel = backtest?.logistic_regression;
                const _bp = bearModelProbability(md, backtest);
                const lrProb = _bp ? _bp.raw : null;
                const lrCalibrated = _bp ? _bp.calibrated : null;

                // Isotonic fallback for heuristic score: if LR model not available
                let isotonic = rawComposite;
                if (rawComposite != null && backtest?.buckets) {
                  const b = backtest.buckets.find(b => rawComposite >= b.lo && rawComposite < b.hi);
                  if (b && b.n > 0) isotonic = Math.round(b.rate);
                }

                // Headline: prefer calibrated LR probability, fall back to isotonic
                const composite = lrCalibrated != null ? Math.round(lrCalibrated * 100) : isotonic;
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
                        <div style={{ fontSize: 11, color: C.t4, marginTop: 8 }}>
                          {lrProb != null
                            ? <>Logistic regression on 7 factors{lrModel?.oos_auc != null ? ` (walk-forward AUC: ${lrModel.oos_auc.toFixed(2)})` : ""}</>
                            : <>{factors.length}-factor composite{concordanceBonus > 0 ? ` + ${concordanceBonus}pt concordance (${elevatedCount} elevated)` : ""}</>
                          }
                        </div>
                        {lrProb != null && (
                          <div style={{ fontSize: 10, color: C.t4, marginTop: 4 }}>
                            Raw LR: {Math.round(lrProb * 100)}% → bucket-calibrated: {Math.round(lrCalibrated * 100)}% · Heuristic score: {rawComposite}
                          </div>
                        )}
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
                        <div><strong style={{ color: C.t1 }}>Yield Curve (18%)</strong> — 10Y minus 3-month T-bill spread with post-inversion premium. This is the spread the NY Fed uses in its official recession-probability model; the 2-year series only starts in 1976, so 10Y-3M also lets the backtest reach 1971. Yield curve inversion has preceded every U.S. recession since 1955. Critically, recessions typically begin *after* the curve de-inverts (Bauer & Mertens, 2018) — the re-steepening phase is the most dangerous. The 2022-2024 inversion ended ~Oct 2024; a +18pt premium decays linearly over 24 months from de-inversion to capture this lagged risk.</div>
                        <div style={{ marginTop: 8 }}><strong style={{ color: C.t1 }}>Valuation (13%)</strong> — SPY trailing P/E ratio. Scoring calibrated to actual pre-bear P/E levels: the 2007 GFC began at 21x, the 2022 bear at 23x, the dot-com crash at 28x (Shiller, 2000). Not a timing signal, but a severity amplifier — high P/E markets fall further.</div>
                        <div style={{ marginTop: 8 }}><strong style={{ color: C.t1 }}>Jobless Claims (12%)</strong> — 4-week moving average of initial unemployment claims from FRED (series IC4WSA, released weekly on Thursdays). Rising claims precede every post-war recession by 3-6 months. Scored on the trend: a 10%+ increase over the prior month is an amber signal; 20%+ is a red flag. This is the model's primary real-economy indicator.</div>
                        <div style={{ marginTop: 8 }}><strong style={{ color: C.t1 }}>Credit Spreads (10%)</strong> — Moody's BAA corporate bond yield minus 10-Year Treasury (FRED BAA10Y, daily, 1986-present). Widening spreads signal deteriorating credit conditions and precede equity drawdowns (Gilchrist & Zakrajsek, 2012). Calibrated to actual pre-bear levels: GFC started at 1.72-1.90%, COVID at 2.05%, 2022 at 1.82%. Stress: Lehman 3.66%, COVID crash 4.31%, GFC bottom 5.40%. Falls back to HYG ETF if FRED data unavailable.</div>
                        <div style={{ marginTop: 8 }}><strong style={{ color: C.t1 }}>Financial Conditions (10%)</strong> — Chicago Fed National Financial Conditions Index (NFCI, FRED), a 105-component composite covering risk premia, credit spreads, leverage measures, money-market stress, equity volatility, and dealer positioning. Z-scored so 0 = average financial conditions; values above 0 signal tighter than average. NFCI above +0.5 has preceded every major equity correction since 1973 (Brave & Butters 2010, Hatzius et al. 2010). One of the most robust single-source recession composites the Fed publishes — weekly updates.</div>
                        <div style={{ marginTop: 8 }}><strong style={{ color: C.t1 }}>Economic Activity (8%)</strong> — Chicago Fed National Activity Index (CFNAI), a weighted average of 85 monthly indicators covering production, employment, consumption, and housing. Zero = trend growth, below -0.7 = high recession probability. The 3-month moving average is used when available for stability.</div>
                        <div style={{ marginTop: 8 }}><strong style={{ color: C.t1 }}>Sahm Rule (7%)</strong> — 3-month average unemployment rate minus its 12-month low (Sahm, 2019). Triggers at 0.50 percentage points — has signaled every recession since 1950 with zero false positives. Currently at {md.sahmVal != null ? md.sahmVal.toFixed(2) : "—"}pp. This is the most reliable real-time recession indicator in existence.</div>
                        <div style={{ marginTop: 8 }}><strong style={{ color: C.t1 }}>Oil Shock (5%)</strong> — Year-over-year change in WTI crude (front-month futures). Every post-WWII US recession except 2020 was preceded by a significant oil price spike (Hamilton 1983, 2003, 2011; Kilian 2009; Federal Reserve 2014). The signal transmits to corporate earnings with a 3-4 quarter lag — meaning today's oil price is a leading indicator for earnings 9-12 months out. Lower weight (5%) because the US is now a net energy exporter, blunting the historical transmission. Updated daily from Yahoo Finance.</div>
                        <div style={{ marginTop: 8 }}><strong style={{ color: C.t1 }}>EPS Trend (7%)</strong> — 90-day percent change in SPY's trailing 12-month earnings, derived from the price and P/E we already track (EPS = price / P/E). Trailing EPS is a sum of the last four quarters, so it moves slowly — when it rolls over by more than 3% over 90 days, an earnings recession is already in progress. Less forward-looking than analyst estimates (which sit behind paid feeds like FactSet), but reliable and free. Tracks rolling daily history; requires ~60 days of data to compute the trend, after which the factor goes live.</div>
                        <div style={{ marginTop: 8 }}><strong style={{ color: C.t1 }}>Concordance Bonus</strong> — When 3+ factors score above 50, a bonus of 5-15 points is added. Simultaneous stress across multiple indicators is disproportionately dangerous: the 2000 and 2007 crashes both had yield curve inversion + elevated valuations + credit stress simultaneously.</div>
                        <div style={{ marginTop: 8 }}><strong style={{ color: C.t1 }}>Isotonic Recalibration</strong> — The displayed headline % is recalibrated against the backtest. The raw weighted-average score is mapped to the realized 12-month bear-onset rate of the matching historical bucket (Calibration tab). Example: a raw score of 55 lands in the 50-60 bucket; if that bucket historically had 38% realized rate, the display shows 38%. This makes the displayed % an empirically grounded probability instead of a heuristic.</div>
                        <div style={{ marginTop: 8 }}><strong style={{ color: C.t1 }}>Post-Inversion Premium</strong> — When the yield curve has been inverted within the last 24 months and has since de-inverted, a decaying premium (up to +18pt) is added to the yield curve score. Academic research (Bauer & Mertens 2018, Engstrom & Sharpe 2019) shows recessions typically begin 6-18 months after de-inversion, not during inversion itself.</div>
                        <div style={{ marginTop: 12, padding: "10px 14px", background: C.accent + "10", borderRadius: 8, border: `1px solid ${C.accent}20` }}><strong style={{ color: C.accent }}>Limitations:</strong> Factors are scored via piecewise interpolation against historical ranges — not a trained ML model. Weights are from published research, not curve-fit to historical data. Post-inversion premium uses a fixed de-inversion date (Oct 2024) and decays linearly — a simplification. The model has been backtested out-of-sample 1990-present and the display % is recalibrated against realized bucket rates (see Calibration tab for the actual AUC and bucket fit). This model estimates risk, not certainty — it cannot predict black swan events like COVID 2020.</div>
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

              {/* ── CALIBRATION (model backtest) ── */}
              {pbView === "scripts" && (() => {
                const bullAgeMo = Math.round((Date.now() - new Date("2022-10-12")) / (30.44 * 86400000));
                const scripts = [
                  {
                    regime: "Bull Market — Staying Invested",
                    condition: "Market within 10% of peak",
                    active: drawdown > -10,
                    subject: "Portfolio Update: Staying the Course",
                    body: `The S&P 500 is up ${pctFromTrough.toFixed(0)}% from the October 2022 low, and our portfolios are performing well. Our playbook calls for staying fully invested in equities through bull markets — history shows that trying to time the top costs more in missed upside than it saves in protection.\n\nYour bond ladder remains in place, funding the next several years of expenses and serving as deployment ammunition for when the next bear market arrives. Until then, the plan is simple: stay invested, let compounding work, and trust the structure we've built.`,
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
                    active: drawdown <= -25 && drawdown > -40,
                    subject: "DEPLOYING: First Tranche Into the Market",
                    body: `The S&P 500 is now down ${Math.abs(drawdown).toFixed(0)}% from its peak — we've hit our first deployment threshold.\n\nPer our investment playbook, we're deploying 70% of your bond-ladder reserves back into equities at these levels. This is the plan working exactly as designed. We're buying stocks at a significant discount while others are panicking.\n\n87% of historical bear markets have reached this level — it's the single highest expected-value entry point. We're holding back the remaining 30% in case the decline deepens to -40%, but most bears stop here, in which case we've deployed at the optimal moment.\n\nI know this feels uncomfortable. But the data is clear: deploying systematically during bear markets is the highest-value action an investor can take. The bond ladder was built precisely so we'd have ammunition for exactly this moment.`,
                  },
                  {
                    regime: "Bear Market — Tranche 2",
                    condition: "S&P down 40%+ from peak",
                    active: drawdown <= -40,
                    subject: "DEPLOYING: Final Tranche — Deep Bear Territory",
                    body: `The S&P 500 is now down ${Math.abs(drawdown).toFixed(0)}% from its peak. Only 32% of bear markets reach this depth — we are in historically rare territory.\n\nWe're deploying all remaining bond reserves into equities. Stocks purchased at -40% from peak have historically delivered +67% returns by the time the market recovers to its prior high. The deeper the bear, the larger the upside on the way back.\n\nThis is the moment that separates disciplined investors from everyone else. Every fiber of intuition says to wait, that it could get worse. But waiting for the absolute bottom is a mistake no one in history has reliably timed. Deploying our final tranche now captures the largest expected gain we'll see this cycle.\n\nThe plan has worked across nearly a century of market history. Trust the process.`,
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
              {pbView === "proof" && (
                <div>
                  {/* Headline */}
                  <div style={{ ...cardStyle, textAlign: "center", position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: C.up }} />
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.t4, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>Bond-Deploy Alpha vs Passive Bond-Holding</div>
                    <div style={{ fontSize: 42, fontWeight: 900, color: C.up, marginBottom: 4 }}>+3.67%</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, marginBottom: 4 }}>mean alpha per bull-bear cycle</div>
                    <div style={{ fontSize: 13, color: C.t3 }}>14 historical cycles · 1932-2024 · <span style={{ color: C.up, fontWeight: 700 }}>71% positive</span></div>
                  </div>

                  {/* Key stats */}
                  <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(4, 1fr)" : "repeat(2, 1fr)", gap: 10, marginBottom: 14 }}>
                    {statBox("Mean Alpha", "+3.67%", C.up)}
                    {statBox("Median Alpha", "+4.49%", C.up)}
                    {statBox("% Cycles Positive", "71%", C.t1)}
                    {statBox("LR Model AUC", "0.82", C.t1)}
                  </div>

                  {/* Why it works */}
                  <div style={cardStyle}>
                    {sectionTitle("The Three Mechanisms")}
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {[
                        { num: "1", title: "5-Year Bond Ladder Floor", desc: "Five bonds, each one year of the client's living expenses. Year 1 matures each year to fund expenses; Years 2-5 roll forward. The floor is inviolate — it guarantees the client never has to sell equity at a bear-market bottom to fund income, which is where ~80% of retirement portfolios are destroyed." },
                        { num: "2", title: "Bear-Probability Ladder Thickening", desc: "When the 7-factor logistic-regression model (walk-forward AUC 0.82) shows bear probability > 40%, add a 6th bond. Above 55%, add a 7th. Extra bonds become pre-positioned deployment reserve. The model concentrates dry powder in genuinely elevated-risk periods rather than firing on bull magnitude alone." },
                        { num: "3", title: "2-Tranche Deployment (-25% / -40%)", desc: "When the bear arrives, deploy 70% of deployable bonds at -25% and remaining 30% at -40%. Front-loaded because -25% has the highest expected-value per dollar (87% hit rate × 33% recovery return = 29¢ per $1). The -40% reserve preserves powder for the 32% of bears that go genuinely deep. Skips -35% (dominated by -25% on hit rate and by -40% on discount) and -50% (too rare to justify reserving capital)." },
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

                  {/* Validation results */}
                  <div style={cardStyle}>
                    {sectionTitle("Validation — Bond-Deploy Alpha")}
                    <div style={{ fontSize: 12, color: C.t3, marginBottom: 14, lineHeight: 1.6 }}>Per-cycle alpha of bond-deploy strategy vs passive bond-holding, computed by full-cycle numerical simulation (tracks shares + cash through bull → peak → bear → recovery) across 14 historical bull-bear pairs since 1932. Validation script: <code style={{ fontSize: 11, color: C.accent }}>scripts/alpha_experiments.py</code>.</div>
                    <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(4, 1fr)" : "repeat(2, 1fr)", gap: 10 }}>
                      <div style={{ background: C.bg, borderRadius: 10, padding: "12px 14px", textAlign: "center" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: C.t4, textTransform: "uppercase", marginBottom: 4 }}>Mean Alpha per Cycle</div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: C.up }}>+3.67%</div>
                      </div>
                      <div style={{ background: C.bg, borderRadius: 10, padding: "12px 14px", textAlign: "center" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: C.t4, textTransform: "uppercase", marginBottom: 4 }}>Median Alpha per Cycle</div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: C.up }}>+4.49%</div>
                      </div>
                      <div style={{ background: C.bg, borderRadius: 10, padding: "12px 14px", textAlign: "center" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: C.t4, textTransform: "uppercase", marginBottom: 4 }}>% Cycles Positive</div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: C.up }}>71%</div>
                      </div>
                      <div style={{ background: C.bg, borderRadius: 10, padding: "12px 14px", textAlign: "center" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: C.t4, textTransform: "uppercase", marginBottom: 4 }}>Worst Cycle Alpha</div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: C.dn }}>-3.05%</div>
                      </div>
                    </div>
                    <div style={{ marginTop: 14, padding: "12px 14px", background: C.accentSoft, borderRadius: 10, fontSize: 11, color: C.t3, lineHeight: 1.6 }}>
                      <strong style={{ color: C.t1 }}>Note:</strong> These numbers measure the deploy-vs-passive alpha — i.e., the incremental gain from selling bonds during bears and buying equity at a discount, vs holding bonds through the bear. They are <em>not</em> a comparison to 100% equity, which would be inappropriate since retirees can't realistically be 100% equity (forced bear-bottom selling devastates wealth). The right baseline is "bonds held anyway for income, do we deploy them or not?" — and the data shows deploying produces meaningful per-cycle alpha.
                    </div>
                  </div>

                  {/* Why it beats alternatives */}
                  <div style={cardStyle}>
                    {sectionTitle("Why It Beats the Alternatives")}
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {[
                        { strategy: "100% Equity Buy-and-Hold", result: "Baseline", problem: "Highest expected return for accumulating clients with no income needs. But devastating for distributing clients — forced selling during bears at the worst possible prices. A retiree taking 4% withdrawals through the GFC permanently impaired 25-30% of their wealth.", color: C.t3 },
                        { strategy: "Trim-and-Deploy (mechanical)", result: "≈ 0 bps/yr", problem: "Sells equity early in the bull (cheap), buys back mid-bear (expensive vs. trim price). The 'discount' at -25% from peak is only a discount vs. peak — it's a premium vs. the +75% trim point. Math is structurally against itself: 87% of bears stop above -50%, so most deploys re-buy higher than the trim sale.", color: C.dn },
                        { strategy: "Passive Bond Ladder (no deploy)", result: "-30 to -50 bps/yr", problem: "Holds bonds for income, never deploys during bears. Misses the alpha opportunity entirely. Equity portion suffers the full bear-market drawdown; bond portion just sits earning yield.", color: C.dn },
                        { strategy: "Bond Ladder + Active Deploy", result: "+3.7%/cycle vs passive", problem: "Bonds serve the income role (the reason they're held), AND deploy into equity at bear depths. The deploy is pure incremental alpha because the bonds were going to be there regardless. Bear-probability model thickens the ladder pre-emptively when risk rises, expanding deployable reserves.", color: C.up },
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
                      <p style={{ marginBottom: 10 }}>The bond-deploy alpha (+3.7% per cycle vs passive bond-holding) is real, but the <strong style={{ color: C.t1 }}>behavioral alpha is far larger</strong>. Studies show the average equity investor underperforms the S&P 500 by <strong style={{ color: C.dn }}>300-400 bps/yr</strong> (Dalbar QAIB, 2024) — almost entirely from panic selling during drawdowns and late re-entry.</p>
                      <p style={{ marginBottom: 10 }}>This playbook eliminates that by giving clients a <strong style={{ color: C.t1 }}>visible, rules-based framework</strong>. When the market drops 25%, they see "TRANCHE 1: DEPLOYING" — not just losses. The psychology shifts from <em>"I'm losing money"</em> to <em>"the plan is working."</em></p>
                      <p style={{ marginBottom: 10 }}>A client who panic-sells at -35% and waits 6 months to re-enter a market that's already recovered 20% loses <strong style={{ color: C.dn }}>~25% of their portfolio permanently</strong>. Preventing that even once in a 30-year relationship dwarfs the quantitative deploy alpha across decades.</p>
                      <p><strong style={{ color: C.accent }}>The playbook's job is to keep clients invested through the worst moments. The bond-deploy alpha is a bonus — the behavioral alpha is the product.</strong></p>
                    </div>
                  </div>

                  {/* Methodology */}
                  <div style={cardStyle}>
                    {sectionTitle("Methodology")}
                    <div style={{ fontSize: 12, color: C.t3, lineHeight: 1.7 }}>
                      <p style={{ marginBottom: 10 }}><strong style={{ color: C.t1 }}>Deploy schedule:</strong> chosen by expected-value analysis across 22 historical bears (1929-2024). For each candidate trigger × fraction pair, computed P(bear reaches depth) × recovery return per dollar. The -25% tier wins on EV (87% hit × 33% recovery = 29¢/$1); -40% is the next-best non-dominated tier (32% × 67% = 21¢/$1). Skipped -35% (dominated) and -50% (too rare).</p>
                      <p style={{ marginBottom: 10 }}><strong style={{ color: C.t1 }}>Bear-probability model:</strong> L2-regularized logistic regression on 7 macro factors (yield curve, claims trend, BAA-10Y spread, NFCI, CFNAI, Sahm rule, oil YoY). Walk-forward out-of-sample AUC 0.82 across 1971-present. Bucket-calibrated against realized 12-month bear-onset rates. Used to trigger ladder thickening when probability exceeds 40% and 55%.</p>
                      <p style={{ marginBottom: 10 }}><strong style={{ color: C.t1 }}>Validation:</strong> The bond-deploy strategy's per-cycle alpha (+3.7% vs passive bond-holding) was validated via numerical full-cycle simulation tracking shares and cash through bull → peak → bear → recovery on all 14 bull-bear pairs since 1932. Bootstrap CIs report 71% probability of positive per-cycle alpha. See scripts/alpha_experiments.py.</p>
                      <p>Data sources: S&P 500 historical data from Shiller (1871-present) and BEAR_MARKETS table (Yardeni / Hartford / NYU Stern / Macrotrends). Macro factors from FRED. Bear market definition: -20% from peak. Recovery: closing above prior peak.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ━���━ SCREENER ━━━ */}
        {tab === "screener" && (
          <div style={{ animation: "fadeIn 0.3s ease", paddingTop: 20 }}>
            {!screenerDetail ? (<>
              {!isDesktop && (
                <div style={{ marginBottom: 4 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.accent, textTransform: "uppercase", letterSpacing: 1.6, marginBottom: 6 }}>Analysis</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: C.t1 }}>Stock Screener</div>
                </div>
              )}
              {isDesktop && <div style={{ fontSize: 20, fontWeight: 800, color: C.t1, marginBottom: 4 }}>Stock Screener</div>}
              <div style={{ fontSize: 12, color: C.t3, marginBottom: 14 }}>{screenerData.length} stocks screened across the Paradiem framework</div>
              {/* Sleeve sub-tabs */}
              <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto", paddingBottom: 4 }}>
                {["Dividend", "Growth", "FCI 100", "FCI Values", "All"].map(s => (
                  <button key={s} onClick={() => setScreenerSleeve(s)} style={{
                    flex: "0 0 auto", padding: "9px 16px", borderRadius: 10,
                    border: `1px solid ${screenerSleeve === s ? C.borderActive : C.border}`,
                    background: screenerSleeve === s ? C.accentSoft : "transparent",
                    color: screenerSleeve === s ? C.t1 : C.t3, fontSize: 13, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                  }}>{s}</button>
                ))}
              </div>
              {/* Portfolio composite score(s) */}
              {(() => {
                const portfolios = [
                  { key: "Dividend", holdings: sleeves.dividend?.symbols || [] },
                  { key: "Growth", holdings: sleeves.growth?.symbols || [] },
                  { key: "FCI 100", holdings: sleeves.fci100?.symbols || [] },
                  { key: "FCI Values", holdings: sleeves.fciValues?.symbols || [] },
                ];
                const byTicker = {};
                for (const s of screenerData) byTicker[s.ticker] = s;
                const meanOf = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
                const stats = portfolios.map(p => {
                  const composites = p.holdings.map(t => byTicker[t]?.overall_score).filter(v => typeof v === "number");
                  const innValues = p.holdings.map(t => screenerScores[t]?.inn).filter(v => typeof v === "number");
                  const infraValues = p.holdings.map(t => screenerScores[t]?.infra).filter(v => typeof v === "number");
                  const compAvg = meanOf(composites);
                  const innAvg = meanOf(innValues);
                  const infraAvg = meanOf(infraValues);
                  return {
                    key: p.key,
                    n: composites.length,
                    coverage: p.holdings.length,
                    avg: compAvg != null ? Math.round(compAvg) : null,
                    inn: innAvg != null ? Math.round(innAvg * 10) / 10 : null,
                    innN: innValues.length,
                    infra: infraAvg != null ? Math.round(infraAvg * 10) / 10 : null,
                    infraN: infraValues.length,
                  };
                });
                const color = v => v == null ? C.t4 : C.accent;
                if (screenerSleeve === "All") {
                  return (
                    <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(4, 1fr)" : "repeat(2, 1fr)", gap: 10, marginBottom: 14 }}>
                      {stats.map(s => (
                        <div key={s.key} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px" }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: C.t4, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{s.key}</div>
                          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                            <div style={{ fontSize: 24, fontWeight: 900, color: color(s.avg), lineHeight: 1 }}>{s.avg != null ? s.avg : "—"}</div>
                            <div style={{ fontSize: 10, color: C.t4 }}>{s.n}/{s.coverage} scored</div>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 6, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}`, fontSize: 11 }}>
                            <div>
                              <div style={{ fontSize: 9, fontWeight: 700, color: C.t4, textTransform: "uppercase", letterSpacing: 0.3 }}>Innovation</div>
                              <div style={{ fontWeight: 800, color: color(s.inn) }}>{s.inn != null ? `${s.inn} / 10` : "—"}</div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: 9, fontWeight: 700, color: C.t4, textTransform: "uppercase", letterSpacing: 0.3 }}>Infrastructure</div>
                              <div style={{ fontWeight: 800, color: color(s.infra) }}>{s.infra != null ? `${s.infra} / 10` : "—"}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                }
                const cur = stats.find(s => s.key === screenerSleeve);
                if (!cur) return null;
                return (
                  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: C.t4, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{cur.key} — Avg Composite Score</div>
                        <div style={{ fontSize: 11, color: C.t4 }}>{cur.n} of {cur.coverage} holdings scored</div>
                      </div>
                      <div style={{ fontSize: 36, fontWeight: 900, color: color(cur.avg), lineHeight: 1 }}>{cur.avg != null ? cur.avg : "—"}<span style={{ fontSize: 14, fontWeight: 400, color: C.t4 }}> / 100</span></div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: C.t4, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Innovation</div>
                        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                          <div style={{ fontSize: 22, fontWeight: 900, color: color(cur.inn), lineHeight: 1 }}>{cur.inn != null ? cur.inn : "—"}<span style={{ fontSize: 12, fontWeight: 400, color: C.t4 }}> / 10</span></div>
                          <div style={{ fontSize: 10, color: C.t4 }}>{cur.innN}/{cur.coverage}</div>
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: C.t4, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Infrastructure</div>
                        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                          <div style={{ fontSize: 22, fontWeight: 900, color: color(cur.infra), lineHeight: 1 }}>{cur.infra != null ? cur.infra : "—"}<span style={{ fontSize: 12, fontWeight: 400, color: C.t4 }}> / 10</span></div>
                          <div style={{ fontSize: 10, color: C.t4 }}>{cur.infraN}/{cur.coverage}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
              {/* Search + filters */}
              <div style={{ marginBottom: 14 }}>
                <input value={screenerSearch} onChange={e => setScreenerSearch(e.target.value)} placeholder="Search ticker or company..." style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, color: C.t1, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
                {screenerSleeve === "All" && (() => {
                  const sectorOptions = Array.from(new Set(screenerData.map(s => screenerSectors[s.ticker] || s.sector || s.profile?.sector || fundamentals[s.ticker]?.sector).filter(Boolean))).sort();
                  return (
                    <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                      <select value={screenerTypeFilter} onChange={e => setScreenerTypeFilter(e.target.value)} style={{ flex: "1 1 140px", padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface, color: C.t1, fontSize: 12, fontWeight: 600, fontFamily: "inherit", outline: "none", appearance: "auto" }}>
                        <option value="All">All Types</option>
                        <option value="Dividend">Dividend Candidates</option>
                        <option value="Growth">Growth Candidates</option>
                      </select>
                      <select value={screenerRecFilter} onChange={e => setScreenerRecFilter(e.target.value)} style={{ flex: "1 1 140px", padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface, color: C.t1, fontSize: 12, fontWeight: 600, fontFamily: "inherit", outline: "none", appearance: "auto" }}>
                        <option value="All">All Ratings</option>
                        <option value="BUY">BUY Only</option>
                        <option value="HOLD">HOLD Only</option>
                        <option value="WATCH">WATCH Only</option>
                        <option value="SELL">SELL Only</option>
                      </select>
                      <select value={screenerSectorFilter} onChange={e => setScreenerSectorFilter(e.target.value)} style={{ flex: "1 1 140px", padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface, color: C.t1, fontSize: 12, fontWeight: 600, fontFamily: "inherit", outline: "none", appearance: "auto" }}>
                        <option value="All">All Sectors</option>
                        {sectorOptions.map(sec => <option key={sec} value={sec}>{sec}</option>)}
                      </select>
                    </div>
                  );
                })()}
              </div>
              {/* List */}
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
                  if (screenerSleeve === "All" && screenerSectorFilter !== "All" && (screenerSectors[s.ticker] || s.sector || s.profile?.sector || fundamentals[s.ticker]?.sector) !== screenerSectorFilter) return false;
                  if (q && !s.ticker.toLowerCase().includes(q) && !(s.name || "").toLowerCase().includes(q)) return false;
                  return true;
                }).sort((a, b) => (b.overall_score || 0) - (a.overall_score || 0) || (a.ticker || "").localeCompare(b.ticker || ""));
                if (filtered.length === 0) return <div style={{ textAlign: "center", padding: 40, color: C.t4, fontSize: 13 }}>No stocks match your search</div>;
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {filtered.map(s => {
                      const sector = screenerSectors[s.ticker] || s.sector || s.profile?.sector || fundamentals[s.ticker]?.sector;
                      return (
                        <div key={s.ticker} onClick={() => { screenerListScrollY.current = window.scrollY; setScreenerDetailLoading(true); setScreenerDetail(s); window.scrollTo(0, 0); fetch(`https://richacarson.github.io/Stock-Screener/reports/${s.ticker}.json`).then(r => r.ok ? r.json() : s).then(d => { setScreenerDetail(d); setScreenerDetailLoading(false); if (d.screen_date && d.screen_date !== s.screen_date) setScreenerData(prev => prev.map(x => x.ticker === s.ticker ? { ...x, screen_date: d.screen_date, overall_score: d.overall_score ?? x.overall_score, recommendation: d.recommendation ?? x.recommendation, sector: d.sector ?? d.profile?.sector ?? x.sector } : x)); }).catch(() => { setScreenerDetail(s); setScreenerDetailLoading(false); }); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, cursor: "pointer", transition: "border-color 0.2s, transform 0.15s" }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = theme !== "light" ? "#60A5FA66" : "#2563EB44"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = "none"; }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, display: "flex", alignItems: "baseline", gap: 8 }}>
                              {s.ticker}
                              {(() => { const v = screenerScores[s.ticker]?.inspire; return v != null ? <span title="Inspire Impact Score" style={{ fontSize: 11, fontWeight: 700, color: v >= 0 ? C.up : C.dn }}>✦ {v}</span> : null; })()}
                            </div>
                            <div style={{ fontSize: 11, color: C.t3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 3, flexWrap: "wrap" }}>
                              {sector && <span style={{ fontSize: 10, fontWeight: 600, color: C.accent, background: C.accentSoft, padding: "2px 8px", borderRadius: 4 }}>{sector}</span>}
                              {s.screen_date && <span style={{ fontSize: 10, color: C.t4 }}>{s.screen_date}</span>}
                            </div>
                          </div>
                          {s.recommendation && <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 16, marginRight: 10, background: ({"BUY": C.upSoft, "HOLD": "#D9760620", "WATCH": "#2563EB20", "SELL": C.dnSoft})[s.recommendation] || C.accentSoft, color: ({"BUY": C.up, "HOLD": "#D97706", "WATCH": "#2563EB", "SELL": C.dn})[s.recommendation] || C.t2 }}>{s.recommendation}</span>}
                          {s.overall_score != null && <div style={{ fontSize: 18, fontWeight: 800, color: C.t1, minWidth: 36, textAlign: "right" }}>{s.overall_score}</div>}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </>) : (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
                  <button onClick={() => { setScreenerDetail(null); requestAnimationFrame(() => window.scrollTo(0, screenerListScrollY.current)); }} style={{
                    background: "none", border: `1px solid ${C.border}`, borderRadius: 10,
                    padding: "8px 16px", color: C.t3, fontSize: 13, fontWeight: 600,
                    cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6,
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.t3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                    Back to list
                  </button>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <button onClick={() => openStock(screenerDetail.ticker || screenerDetail.symbol, "overview")} style={{ background: C.accentSoft, border: `1px solid ${C.borderActive}`, borderRadius: 8, padding: "6px 14px", color: C.t1, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>View Overview</button>
                    <button onClick={() => openStock(screenerDetail.ticker || screenerDetail.symbol, "chart")} style={{ background: C.accentSoft, border: `1px solid ${C.borderActive}`, borderRadius: 8, padding: "6px 14px", color: C.t1, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>View Chart</button>
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
                {screenerDetailLoading ? (
                  <div style={{ textAlign: "center", padding: 60 }}>
                    <div style={{ width: 28, height: 28, border: `3px solid ${C.border}`, borderTopColor: C.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
                    <div style={{ fontSize: 13, color: C.t4 }}>Loading report...</div>
                  </div>
                ) : (
                  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: isDesktop ? "32px 48px" : "20px 18px" }}>
                    {(() => {
                      const a = screenerDetail;
                      const scoreColor = s => s >= 7 ? C.up : s >= 4 ? "#B8860B" : C.dn;
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
                            <div style={{ fontSize: isDesktop ? 36 : 28, fontWeight: 800, color: C.t1, letterSpacing: -0.5, lineHeight: 1.1 }}>
                              {a.ticker} <span style={{ fontSize: isDesktop ? 20 : 16, fontWeight: 400, color: C.t3 }}>{a.name}</span>
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
                          <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 12, flexWrap: "wrap" }}>
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
                          {a.faith_alignment.inspire_impact_score < 0 && a.faith_alignment.negative_attributions?.length > 0 && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center", margin: "10px 0 6px" }}>
                              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: C.dn, marginRight: 4 }}>Negative:</span>
                              {a.faith_alignment.negative_attributions.map((attr, i) => <span key={i} style={{ fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 8, background: "rgba(220,38,38,0.08)", color: C.dn }}>{attr}</span>)}
                            </div>
                          )}
                          {a.faith_alignment.inspire_impact_score >= 0 && a.faith_alignment.positive_attributions?.length > 0 && (
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
                )}
              </div>
            )}
          </div>
        )}

        {/* ━━━ OPPORTUNITIES ━━━ */}
        {tab === "opportunities" && (
          <div style={{ animation: "fadeIn 0.3s ease", paddingTop: 20 }}>
            {!oppDetail ? (<>
              {!isDesktop && (
                <div style={{ marginBottom: 4 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.accent, textTransform: "uppercase", letterSpacing: 1.6, marginBottom: 6 }}>Ideas</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: C.t1 }}>Opportunity Finder</div>
                </div>
              )}
              {isDesktop && <div style={{ fontSize: 20, fontWeight: 800, color: C.t1, marginBottom: 4 }}>Opportunity Finder</div>}
              <div style={{ fontSize: 12, color: C.t3, marginBottom: 14 }}>Thematic investment ideas backed by research</div>
              {/* Sub-nav */}
              <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
                {[
                  { v: "opportunities", l: `Opportunities${opportunities.length ? ` (${opportunities.length})` : ""}` },
                  { v: "stalking", l: `Stalking${oppStalking.length ? ` (${oppStalking.length})` : ""}` },
                  { v: "ledger", l: `Ledger${oppLedger.length ? ` (${oppLedger.length})` : ""}` },
                  { v: "signals", l: "Signals" },
                ].map(({ v, l }) => (
                  <button key={v} onClick={() => setOppView(v)} style={{
                    flex: "0 0 auto", padding: "9px 16px", borderRadius: 10,
                    border: `1px solid ${oppView === v ? C.borderActive : C.border}`,
                    background: oppView === v ? C.accentSoft : "transparent",
                    color: oppView === v ? C.t1 : C.t3, fontSize: 13, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                  }}>{l}</button>
                ))}
              </div>

              {oppView === "opportunities" && (
                !opportunities.length ? (
                  <div style={{ textAlign: "center", padding: 40 }}>
                    <div style={{ width: 28, height: 28, border: `3px solid ${C.border}`, borderTopColor: C.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
                    <div style={{ fontSize: 13, color: C.t4 }}>Loading opportunities...</div>
                  </div>
                ) : opportunities.map(opp => (
                  <div key={opp.id} onClick={() => setOppDetail(opp)} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "18px 16px", marginBottom: 14, cursor: "pointer" }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: C.t1, marginBottom: 8 }}>{opp.title}</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                      {opp.pattern && <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: C.accentSoft, color: C.accent }}>{opp.pattern}</span>}
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: opp.conviction === "High Conviction" ? C.upSoft : opp.conviction === "On Our Radar" ? "#2563EB20" : C.t4 + "20", color: opp.conviction === "High Conviction" ? C.up : opp.conviction === "On Our Radar" ? "#2563EB" : C.t3 }}>{opp.conviction}</span>
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
                ))
              )}

              {oppView === "stalking" && (() => {
                if (!oppStalking.length) return (
                  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 32, textAlign: "center" }}>
                    <div style={{ fontSize: 14, color: C.t3, marginBottom: 8 }}>Nothing on the stalking list yet.</div>
                    <div style={{ fontSize: 12, color: C.t4, lineHeight: 1.6 }}>The routine populates <code>opportunities/stalking.json</code> with ideas that have a credible catalyst and source but don't yet meet the On Our Radar bar. Useful as a watchlist before promoting to active.</div>
                  </div>
                );
                return (
                  <>
                    <div style={{ fontSize: 11, color: C.t4, marginBottom: 12, lineHeight: 1.5 }}>Ideas the routine is watching but hasn't filed yet. Each needs a catalyst, thesis, and at least one source — no trade construction required. Re-evaluated daily; can graduate to On Our Radar or High Conviction when more evidence accumulates.</div>
                    {oppStalking.map((s, i) => (
                      <div key={s.id || i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", marginBottom: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 6 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>{s.title || s.id}</div>
                            {s.added && <div style={{ fontSize: 11, color: C.t4, marginTop: 4 }}>Added {s.added}</div>}
                          </div>
                          {s.tickers?.length > 0 && (
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                              {s.tickers.map(t => <span key={t} style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 12, background: C.accentSoft, color: C.accent }}>{t}</span>)}
                            </div>
                          )}
                        </div>
                        {s.catalyst && <div style={{ fontSize: 12, color: C.t2, lineHeight: 1.6, marginTop: 6 }}><strong>Catalyst:</strong> {s.catalyst}</div>}
                        {s.thesis && <div style={{ fontSize: 12, color: C.t2, lineHeight: 1.6, marginTop: 4 }}><strong>Thesis:</strong> {s.thesis}</div>}
                        {s.what_would_promote && <div style={{ fontSize: 11, color: C.t3, lineHeight: 1.5, marginTop: 6, padding: "8px 10px", background: C.bg, borderRadius: 8 }}><strong>What would promote:</strong> {s.what_would_promote}</div>}
                        {s.checks_remaining && <div style={{ fontSize: 11, color: C.t4, lineHeight: 1.5, marginTop: 4 }}><strong>Checks remaining:</strong> {s.checks_remaining}</div>}
                        {s.source && (
                          <div style={{ fontSize: 11, color: C.t4, marginTop: 6 }}>
                            Source: {s.source.url ? <a href={s.source.url} target="_blank" rel="noopener noreferrer" style={{ color: C.accent }}>{s.source.title || s.source.url}</a> : (s.source.title || JSON.stringify(s.source))}
                          </div>
                        )}
                      </div>
                    ))}
                  </>
                );
              })()}

              {oppView === "ledger" && (() => {
                if (!oppLedger.length) return (
                  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 32, textAlign: "center" }}>
                    <div style={{ fontSize: 14, color: C.t3, marginBottom: 8 }}>No closed opportunities yet.</div>
                    <div style={{ fontSize: 12, color: C.t4, lineHeight: 1.6 }}>The ledger accumulates as opportunities are closed (stopped out, thesis broken, target hit, or expired).<br/>Track record will populate here as the routine maintains <code>opportunities/ledger.json</code>.</div>
                  </div>
                );
                const closed = oppLedger;
                const winners = closed.filter(c => (c.return_pct || 0) > 0);
                const losers = closed.filter(c => (c.return_pct || 0) < 0);
                const avgRet = closed.length ? closed.reduce((s, c) => s + (c.return_pct || 0), 0) / closed.length : 0;
                const winRate = closed.length ? winners.length / closed.length * 100 : 0;
                return (<>
                  {/* Aggregate stats */}
                  <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(4, 1fr)" : "repeat(2, 1fr)", gap: 10, marginBottom: 14 }}>
                    <div style={{ background: C.card, borderRadius: 12, padding: "12px 14px", textAlign: "center", border: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: C.t4, textTransform: "uppercase", marginBottom: 4 }}>Closed</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: C.t1 }}>{closed.length}</div>
                    </div>
                    <div style={{ background: C.card, borderRadius: 12, padding: "12px 14px", textAlign: "center", border: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: C.t4, textTransform: "uppercase", marginBottom: 4 }}>Win Rate</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: winRate >= 50 ? C.up : C.dn }}>{winRate.toFixed(0)}%</div>
                    </div>
                    <div style={{ background: C.card, borderRadius: 12, padding: "12px 14px", textAlign: "center", border: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: C.t4, textTransform: "uppercase", marginBottom: 4 }}>Avg Return</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: avgRet >= 0 ? C.up : C.dn }}>{avgRet >= 0 ? "+" : ""}{avgRet.toFixed(1)}%</div>
                    </div>
                    <div style={{ background: C.card, borderRadius: 12, padding: "12px 14px", textAlign: "center", border: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: C.t4, textTransform: "uppercase", marginBottom: 4 }}>W / L</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: C.t1 }}><span style={{ color: C.up }}>{winners.length}</span> / <span style={{ color: C.dn }}>{losers.length}</span></div>
                    </div>
                  </div>
                  {/* By pattern */}
                  {(() => {
                    const byPattern = {};
                    for (const c of closed) {
                      const p = c.pattern || "Unknown";
                      if (!byPattern[p]) byPattern[p] = { n: 0, wins: 0, sum: 0 };
                      byPattern[p].n++;
                      if ((c.return_pct || 0) > 0) byPattern[p].wins++;
                      byPattern[p].sum += (c.return_pct || 0);
                    }
                    const rows = Object.entries(byPattern).sort((a, b) => b[1].n - a[1].n);
                    if (!rows.length) return null;
                    return (
                      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "16px 18px", marginBottom: 14 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: C.t1, marginBottom: 10 }}>By Pattern</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {rows.map(([p, r]) => (
                            <div key={p} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: C.bg, borderRadius: 8 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: C.t2 }}>{p}</span>
                              <div style={{ display: "flex", gap: 12, fontSize: 11 }}>
                                <span style={{ color: C.t3 }}>n={r.n}</span>
                                <span style={{ color: r.wins / r.n >= 0.5 ? C.up : C.dn }}>{Math.round(r.wins / r.n * 100)}% win</span>
                                <span style={{ color: r.sum / r.n >= 0 ? C.up : C.dn, fontWeight: 700 }}>{r.sum / r.n >= 0 ? "+" : ""}{(r.sum / r.n).toFixed(1)}% avg</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                  {/* Closed list */}
                  {closed.map((c, i) => (
                    <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 6 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>{c.id || c.title}</div>
                          <div style={{ display: "flex", gap: 10, fontSize: 11, color: C.t4, marginTop: 4, flexWrap: "wrap" }}>
                            {c.opened && <span>Opened {c.opened}</span>}
                            {c.closed && <span>· Closed {c.closed}</span>}
                            {c.days_held != null && <span>· {c.days_held}d</span>}
                            {c.pattern && <span>· {c.pattern}</span>}
                          </div>
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: (c.return_pct || 0) >= 0 ? C.up : C.dn }}>{(c.return_pct || 0) >= 0 ? "+" : ""}{(c.return_pct || 0).toFixed(1)}%</div>
                      </div>
                      {c.tickers?.length > 0 && (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                          {c.tickers.map(t => <span key={t} style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 12, background: C.accentSoft, color: C.accent }}>{t}</span>)}
                        </div>
                      )}
                      {c.close_reason && <div style={{ fontSize: 12, color: C.t2, lineHeight: 1.6, marginTop: 8 }}><strong>Why:</strong> {c.close_reason}</div>}
                      {c.what_worked && <div style={{ fontSize: 11, color: C.t3, lineHeight: 1.5, marginTop: 4 }}><strong>What worked:</strong> {c.what_worked}</div>}
                      {c.what_didnt && <div style={{ fontSize: 11, color: C.t3, lineHeight: 1.5, marginTop: 4 }}><strong>What didn't:</strong> {c.what_didnt}</div>}
                      {c.would_have_done && <div style={{ fontSize: 11, color: C.t3, lineHeight: 1.5, marginTop: 4 }}><strong>Lesson:</strong> {c.would_have_done}</div>}
                    </div>
                  ))}
                </>);
              })()}

              {oppView === "signals" && (() => {
                if (!oppSignals) return (
                  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 32, textAlign: "center" }}>
                    <div style={{ fontSize: 14, color: C.t3, marginBottom: 8 }}>No signal data yet.</div>
                    <div style={{ fontSize: 12, color: C.t4, lineHeight: 1.6 }}>The routine will publish <code>opportunities/signals.json</code> with insider cluster buys, congressional purchases, and 13F changes.<br/>Sources: SEC EDGAR / OpenInsider, House & Senate Stock Watcher, EDGAR 13F.</div>
                  </div>
                );
                const blocks = [
                  { key: "insider_clusters", title: "Insider Cluster Buys (last 14 days)", desc: "≥2 executives or directors buying their own stock, ≥$100K total. Source: SEC Form 4 / OpenInsider.", color: C.up },
                  { key: "congressional", title: "Congressional Purchases (last 14 days)", desc: "≥2 members of Congress buying same ticker. Source: House & Senate Stock Watcher.", color: "#2563EB" },
                  { key: "institutional", title: "Institutional 13F Changes", desc: "New or significantly-added positions from watched funds. Quarterly.", color: "#B8860B" },
                ];
                return (<>
                  {oppSignals.generated_at && <div style={{ fontSize: 11, color: C.t4, marginBottom: 14 }}>Updated {oppSignals.generated_at}</div>}
                  {blocks.map(b => {
                    const items = oppSignals[b.key] || [];
                    return (
                      <div key={b.key} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "16px 18px", marginBottom: 14 }}>
                        <div style={{ borderBottom: `2px solid ${b.color}`, paddingBottom: 6, marginBottom: 10 }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: C.t1 }}>{b.title}</div>
                          <div style={{ fontSize: 11, color: C.t4, marginTop: 2 }}>{b.desc}</div>
                        </div>
                        {!items.length ? (
                          <div style={{ fontSize: 12, color: C.t4, padding: "8px 0" }}>No signals in this category.</div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {items.slice(0, 15).map((it, i) => (
                              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 10px", background: C.bg, borderRadius: 8 }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <span style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>{it.ticker}</span>
                                  {it.name && <span style={{ fontSize: 11, color: C.t3, marginLeft: 8 }}>{it.name}</span>}
                                  {it.note && <div style={{ fontSize: 11, color: C.t4, marginTop: 2, lineHeight: 1.5 }}>{it.note}</div>}
                                </div>
                                <div style={{ display: "flex", gap: 8, fontSize: 11, color: C.t3, flexShrink: 0 }}>
                                  {it.buyers != null && <span><strong>{it.buyers}</strong> buyers</span>}
                                  {it.total_value && <span>${typeof it.total_value === "number" ? it.total_value.toLocaleString() : it.total_value}</span>}
                                  {it.span_days != null && <span>{it.span_days}d</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>);
              })()}
            </>) : (
              <div>
                <button onClick={() => setOppDetail(null)} style={{
                  background: "none", border: `1px solid ${C.border}`, borderRadius: 10,
                  padding: "8px 16px", color: C.t3, fontSize: 13, fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6,
                  marginBottom: 20,
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.t3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                  Back to opportunities
                </button>
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: isDesktop ? "32px 48px" : "20px 18px" }}>
                  <div style={{ fontSize: isDesktop ? 28 : 24, fontWeight: 800, color: C.t1, lineHeight: 1.2, marginBottom: 12 }}>{oppDetail.title}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                    {oppDetail.pattern && <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 14px", borderRadius: 20, background: C.accentSoft, color: C.accent }}>{oppDetail.pattern}</span>}
                    <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 14px", borderRadius: 20, background: oppDetail.conviction === "High Conviction" ? C.upSoft : oppDetail.conviction === "On Our Radar" ? "#2563EB20" : C.t4 + "20", color: oppDetail.conviction === "High Conviction" ? C.up : oppDetail.conviction === "On Our Radar" ? "#2563EB" : C.t3 }}>{oppDetail.conviction}</span>
                    {oppDetail.status && <span style={{ fontSize: 12, fontWeight: 600, padding: "4px 14px", borderRadius: 20, background: C.surface, border: `1px solid ${C.border}`, color: C.t3 }}>{oppDetail.status}</span>}
                    {oppDetail.timeframe && <span style={{ fontSize: 12, fontWeight: 600, padding: "4px 14px", borderRadius: 20, background: C.surface, border: `1px solid ${C.border}`, color: C.t3 }}>{oppDetail.timeframe}</span>}
                  </div>

                  {oppDetail.summary && <div style={{ fontSize: 15, color: C.t2, lineHeight: 1.6, fontStyle: "italic", marginBottom: 20, paddingLeft: 12, borderLeft: `3px solid ${C.accent}` }}>{oppDetail.summary}</div>}

                  <div style={{ fontSize: 11, fontWeight: 800, color: C.t3, letterSpacing: 2, textTransform: "uppercase", margin: "24px 0 12px", paddingBottom: 4, borderBottom: `2px solid ${C.accent}` }}>Catalyst</div>
                  <div style={{ fontSize: 13, color: C.t2, lineHeight: 1.7, marginBottom: 16 }}>{oppDetail.catalyst}</div>

                  <div style={{ fontSize: 11, fontWeight: 800, color: C.t3, letterSpacing: 2, textTransform: "uppercase", margin: "24px 0 12px", paddingBottom: 4, borderBottom: `2px solid ${C.accent}` }}>Investment Thesis</div>
                  <div style={{ fontSize: 13, color: C.t2, lineHeight: 1.7, marginBottom: 16 }}>{oppDetail.thesis}</div>

                  {oppDetail.counter_thesis && (<>
                    <div style={{ fontSize: 11, fontWeight: 800, color: C.t3, letterSpacing: 2, textTransform: "uppercase", margin: "24px 0 12px", paddingBottom: 4, borderBottom: `2px solid ${C.dn}` }}>Counter-Thesis (Bear Case)</div>
                    <div style={{ fontSize: 13, color: C.t2, lineHeight: 1.7, marginBottom: 16, fontStyle: "italic", paddingLeft: 14, borderLeft: `3px solid ${C.dn}`, background: C.dn + "08", padding: "12px 16px", borderRadius: 8 }}>{oppDetail.counter_thesis}</div>
                  </>)}

                  {oppDetail.trade_construction && (<>
                    <div style={{ fontSize: 11, fontWeight: 800, color: C.t3, letterSpacing: 2, textTransform: "uppercase", margin: "24px 0 12px", paddingBottom: 4, borderBottom: `2px solid ${C.accent}` }}>Trade Construction</div>
                    <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(4, 1fr)" : "repeat(2, 1fr)", gap: 10, marginBottom: 16 }}>
                      {oppDetail.trade_construction.entry_zone && (
                        <div style={{ background: C.bg, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.border}` }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: C.t4, textTransform: "uppercase", marginBottom: 4 }}>Entry Zone</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>{oppDetail.trade_construction.entry_zone}</div>
                        </div>
                      )}
                      {oppDetail.trade_construction.target_12mo && (
                        <div style={{ background: C.bg, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.border}` }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: C.t4, textTransform: "uppercase", marginBottom: 4 }}>12-Mo Target</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.up }}>{oppDetail.trade_construction.target_12mo}</div>
                        </div>
                      )}
                      {oppDetail.trade_construction.stop_loss && (
                        <div style={{ background: C.bg, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.border}` }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: C.t4, textTransform: "uppercase", marginBottom: 4 }}>Stop Loss</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.dn }}>{oppDetail.trade_construction.stop_loss}</div>
                        </div>
                      )}
                      {oppDetail.trade_construction.position_size_pct && (
                        <div style={{ background: C.bg, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.border}` }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: C.t4, textTransform: "uppercase", marginBottom: 4 }}>Position Size</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>{oppDetail.trade_construction.position_size_pct}</div>
                        </div>
                      )}
                    </div>
                  </>)}

                  {oppDetail.catalyst_calendar?.length > 0 && (<>
                    <div style={{ fontSize: 11, fontWeight: 800, color: C.t3, letterSpacing: 2, textTransform: "uppercase", margin: "24px 0 12px", paddingBottom: 4, borderBottom: `2px solid ${C.accent}` }}>Catalyst Calendar</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                      {oppDetail.catalyst_calendar.map((c, i) => (
                        <div key={i} style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 12px", background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: C.accent, minWidth: 90 }}>{c.date}</span>
                          <span style={{ fontSize: 12, color: C.t2, lineHeight: 1.5 }}>{c.event}{c.ticker ? ` (${c.ticker})` : ""}</span>
                        </div>
                      ))}
                    </div>
                  </>)}

                  {oppDetail.body_md && (<>
                    <div style={{ fontSize: 11, fontWeight: 800, color: C.t3, letterSpacing: 2, textTransform: "uppercase", margin: "32px 0 12px", paddingBottom: 4, borderBottom: `2px solid ${C.accent}` }}>Research Report</div>
                    <div style={{ marginBottom: 20 }}>
                      {renderMarkdown(oppDetail.body_md)}
                    </div>
                  </>)}

                  <div style={{ fontSize: 11, fontWeight: 800, color: C.t3, letterSpacing: 2, textTransform: "uppercase", margin: "24px 0 12px", paddingBottom: 4, borderBottom: `2px solid ${C.up}` }}>Ticker Analysis</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                    {oppDetail.tickers?.map(t => (
                      <div key={t} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                          <span style={{ fontSize: 16, fontWeight: 800, color: C.accent }}>{t}</span>
                          <button onClick={(e) => { e.stopPropagation(); setOppDetail(null); setScreenerDetail({ ticker: t, _loading: true }); setScreenerDetailLoading(true); setTab("screener"); fetch(`https://richacarson.github.io/Stock-Screener/reports/${t}.json`).then(r => r.ok ? r.json() : { ticker: t }).then(d => { setScreenerDetail(d); setScreenerDetailLoading(false); }).catch(() => { setScreenerDetail({ ticker: t }); setScreenerDetailLoading(false); }); }} style={{ fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 8, background: C.accentSoft, border: `1px solid ${C.borderActive}`, color: C.t1, cursor: "pointer", fontFamily: "inherit" }}>View Screener Report</button>
                        </div>
                        {oppDetail.ticker_rationale?.[t] && <div style={{ fontSize: 12, color: C.t2, lineHeight: 1.7 }}>{oppDetail.ticker_rationale[t]}</div>}
                        {oppDetail.in_portfolio_status?.[t] && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: C.t4, textTransform: "uppercase", letterSpacing: 0.5 }}>Portfolio Fit:</span>
                            <span style={{ fontSize: 11, color: C.t2, background: C.surface, padding: "3px 10px", borderRadius: 6, border: `1px solid ${C.border}` }}>Current: <strong>{oppDetail.in_portfolio_status[t].current_weight}%</strong></span>
                            <span style={{ fontSize: 11, color: C.t2, background: C.surface, padding: "3px 10px", borderRadius: 6, border: `1px solid ${C.border}` }}>Target: <strong>{oppDetail.in_portfolio_status[t].target_weight}%</strong></span>
                            {oppDetail.in_portfolio_status[t].action && <span style={{ fontSize: 11, fontWeight: 700, color: C.accent, background: C.accentSoft, padding: "3px 10px", borderRadius: 6 }}>{oppDetail.in_portfolio_status[t].action}</span>}
                          </div>
                        )}
                        {oppDetail.key_metrics?.[t] && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
                            {Object.entries(oppDetail.key_metrics[t]).map(([k, v]) => (
                              <div key={k} style={{ fontSize: 11, color: C.t3, background: C.surface, padding: "3px 10px", borderRadius: 6, border: `1px solid ${C.border}` }}>
                                <span style={{ color: C.t4 }}>{k}: </span>
                                <span style={{ color: C.t2, fontWeight: 600 }}>{typeof v === "number" ? v.toLocaleString() : String(v)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div style={{ fontSize: 11, fontWeight: 800, color: C.t3, letterSpacing: 2, textTransform: "uppercase", margin: "24px 0 12px", paddingBottom: 4, borderBottom: `2px solid ${C.dn}` }}>Key Risks</div>
                  <ol style={{ margin: "8px 0 16px", paddingLeft: 28 }}>
                    {oppDetail.risks?.map((r, i) => <li key={i} style={{ fontSize: 13, color: C.t2, lineHeight: 1.6, marginBottom: 10 }}>{typeof r === "string" ? r : r.description || r.risk || JSON.stringify(r)}</li>)}
                  </ol>

                  {oppDetail.invalidation?.length > 0 && (<>
                    <div style={{ fontSize: 11, fontWeight: 800, color: C.t3, letterSpacing: 2, textTransform: "uppercase", margin: "24px 0 12px", paddingBottom: 4, borderBottom: `2px solid #FBBF24` }}>What Would Change My Mind</div>
                    <ol style={{ margin: "8px 0 16px", paddingLeft: 28 }}>
                      {oppDetail.invalidation.map((t, i) => <li key={i} style={{ fontSize: 13, color: C.t2, lineHeight: 1.6, marginBottom: 10 }}>{typeof t === "string" ? t : t.trigger || t.description || JSON.stringify(t)}</li>)}
                    </ol>
                  </>)}

                  {oppDetail.sources?.length > 0 && (<>
                    <div style={{ fontSize: 11, fontWeight: 800, color: C.t3, letterSpacing: 2, textTransform: "uppercase", margin: "24px 0 12px", paddingBottom: 4, borderBottom: `2px solid #B8860B` }}>Sources</div>
                    <ol style={{ margin: "8px 0", paddingLeft: 28 }}>
                      {oppDetail.sources.map((s, i) => {
                        if (typeof s === "string") {
                          return <li key={i} style={{ fontSize: 12, color: C.t3, lineHeight: 1.5, marginBottom: 8 }}>{s}</li>;
                        }
                        const linkColor = theme !== "light" ? "#60A5FA" : "#2563EB";
                        return (
                          <li key={i} style={{ fontSize: 12, color: C.t3, lineHeight: 1.5, marginBottom: 10 }}>
                            {s.url ? (
                              <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: linkColor, fontWeight: 600, textDecoration: "none" }}>{s.title || s.url}</a>
                            ) : (
                              <span style={{ color: C.t2, fontWeight: 600 }}>{s.title || s.source || ""}</span>
                            )}
                            {(s.publisher || s.date) && (
                              <span style={{ color: C.t4, marginLeft: 6 }}>
                                — {[s.publisher, s.date].filter(Boolean).join(", ")}
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                  </>)}

                  <div style={{ textAlign: "center", fontSize: 10, color: C.t4, letterSpacing: 0.5, textTransform: "uppercase", marginTop: 40, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>Intentional Ownership · For Investment Committee Use Only · Not Investment Advice</div>
                </div>
              </div>
            )}
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
                {[{ v: "dark", l: "Dark" }, { v: "light", l: "Light" }].map(({ v, l }) => (
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
                <div style={{ fontSize: 12, fontWeight: 600, color: C.t2, marginBottom: 6 }}>Default Layout</div>
                <div style={{ fontSize: 11, color: C.t4, marginBottom: 8 }}>{isWide ? "Your choice is saved — the dashboard reopens in this layout on every visit. Terminal mode shows a multi-panel grid (desktop only)." : "Terminal mode needs a wider window — DESKTOP ≥1180PX"}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {[{ v: "classic", l: "Classic" }, { v: "terminal", l: "Terminal" }].map(({ v, l }) => (
                    <button key={v} onClick={() => { setTDrawer(null); setLayoutMode(v); try { localStorage.setItem("iown_layout", v); } catch {} if (!localStorage.getItem("iown_theme_locked")) setTheme(v === "terminal" ? "terminal" : getAutoTheme()); }} style={{
                      flex: 1, padding: "10px 0", borderRadius: 10,
                      border: `1px solid ${layoutMode === v ? C.borderActive : C.border}`,
                      background: layoutMode === v ? C.accentSoft : "transparent",
                      color: layoutMode === v ? C.t1 : C.t3, fontSize: 13, fontWeight: 700,
                      cursor: "pointer", fontFamily: "inherit",
                    }}>{l}{layoutMode === v ? " · Default" : ""}</button>
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
                <button onClick={() => { try { localStorage.removeItem("iown_metrics_cache"); localStorage.removeItem("iown_fmp_cache"); localStorage.removeItem("iown_dividend_history"); localStorage.removeItem("iown_dividend_history_v2"); } catch {} setFundamentals({}); setDividendHistory({}); fetchFundamentals(true).then(() => fetchDividendHistory(true)).catch(() => {}); }} style={{ marginTop: 10, width: "100%", padding: "10px 0", background: C.accentSoft, border: `1px solid ${C.borderActive}`, borderRadius: 10, color: C.t1, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
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
        background: theme !== "light" ? "rgba(31,31,69,0.92)" : "rgba(250,247,242,0.94)",
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
      ::-webkit-scrollbar-track { background: ${isDark ? "rgba(31,31,69,0.5)" : "rgba(139,115,85,0.10)"}; border-radius: 10px; }
      ::-webkit-scrollbar-thumb { background: rgba(${isDark ? "201,168,76,0.35" : "25,22,53,0.25"}); border-radius: 10px; min-height: 40px; }
      ::-webkit-scrollbar-thumb:hover { background: rgba(${isDark ? "201,168,76,0.55" : "25,22,53,0.40"}); }
      body { background: ${isDark ? "#171738" : "#F4EFE4"}; overscroll-behavior-x: none; scrollbar-width: auto; scrollbar-color: rgba(${isDark ? "201,168,76,0.35" : "25,22,53,0.25"}) ${isDark ? "rgba(31,31,69,0.5)" : "rgba(139,115,85,0.10)"}; }
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
