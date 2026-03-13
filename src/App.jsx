import { useState, useEffect, useCallback, useRef, useMemo } from "react";

// ── IOWN Holdings Data ──────────────────────────────────────────────────────
const SLEEVES = {
  dividend: {
    name: "Dividend",
    symbols: ["ABT","A","ADI","ATO","ADP","BKH","CAT","CHD","CL","FAST","GD","GPC","LRCX","LMT","MATX","NEE","ORI","PCAR","QCOM","DGX","SSNC","STLD","SYK","TEL","VLO"],
    color: "#3D5A1E",
    accent: "#7A8F5A",
  },
  growth: {
    name: "Growth Hybrid",
    symbols: ["AMD","AEM","ATAT","CVX","CWAN","CNX","COIN","EIX","FINV","FTNT","GFI","SUPV","HRMY","HUT","KEYS","MARA","NVDA","NXPI","OKE","PDD","HOOD","SYF","TSM","TOL"],
    color: "#2C4A0F",
    accent: "#5A6B42",
  },
  digital: {
    name: "Digital Asset ETFs",
    symbols: ["IBIT","ETHA"],
    color: "#1A3300",
    accent: "#4A5E33",
  },
};

const ALL_SYMBOLS = [
  ...SLEEVES.dividend.symbols,
  ...SLEEVES.growth.symbols,
  ...SLEEVES.digital.symbols,
];

// ── 8-Dimension Framework Defaults ──────────────────────────────────────────
const DIMENSIONS = [
  { key: "innovation", label: "Innovation", icon: "💡" },
  { key: "inspiration", label: "Inspiration", icon: "✨" },
  { key: "infrastructure", label: "Infrastructure", icon: "🏗️" },
  { key: "aiResilience", label: "AI Resilience", icon: "🤖" },
  { key: "moatStrength", label: "Moat Strength", icon: "🏰" },
  { key: "erosionProtection", label: "Erosion Protection", icon: "🛡️" },
  { key: "socialArbitrage", label: "Social Arbitrage", icon: "📡" },
  { key: "dividendSafety", label: "Dividend Safety", icon: "💰" },
];

const GAME_OVERLAY = { key: "gameType", label: "Infinite vs Finite", icon: "♾️" };

// ── API Configuration ───────────────────────────────────────────────────────
const ALPACA_BASE = "https://data.alpaca.markets";
const ALPACA_PAPER_BASE = "https://paper-api.alpaca.markets";
const ENV_API_KEY = import.meta.env.VITE_ALPACA_KEY || "";
const ENV_API_SECRET = import.meta.env.VITE_ALPACA_SECRET || "";

// ── Utility Functions ───────────────────────────────────────────────────────
const fmt = (n) => {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtPct = (n) => {
  if (n === null || n === undefined || isNaN(n)) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
};

const fmtVol = (n) => {
  if (!n) return "—";
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toString();
};

// ── Main App ────────────────────────────────────────────────────────────────
export default function IOWNDashboard() {
  const [apiKey, setApiKey] = useState(ENV_API_KEY);
  const [apiSecret, setApiSecret] = useState(ENV_API_SECRET);
  const [authenticated, setAuthenticated] = useState(false);
  const [authError, setAuthError] = useState("");
  const [quotes, setQuotes] = useState({});
  const [bars, setBars] = useState({});
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [activeSleeve, setActiveSleeve] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("symbol");
  const [sortDir, setSortDir] = useState("asc");
  const [screenScores, setScreenScores] = useState({});
  const [selectedStock, setSelectedStock] = useState(null);
  const [refreshInterval, setRefreshInterval] = useState(null);
  const intervalRef = useRef(null);

  // ── Auth & Data Fetching ────────────────────────────────────────────────
  const headers = useMemo(() => ({
    "APCA-API-KEY-ID": apiKey,
    "APCA-API-SECRET-KEY": apiSecret,
  }), [apiKey, apiSecret]);

  const fetchSnapshots = useCallback(async () => {
    if (!apiKey || !apiSecret) return;
    setLoading(true);
    try {
      const symbolStr = ALL_SYMBOLS.join(",");
      const res = await fetch(
        `${ALPACA_BASE}/v2/stocks/snapshots?symbols=${symbolStr}&feed=iex`,
        { headers }
      );
      if (!res.ok) throw new Error(`API Error: ${res.status}`);
      const data = await res.json();
      
      const newQuotes = {};
      const newBars = {};
      
      for (const [sym, snap] of Object.entries(data)) {
        if (snap.latestTrade) {
          newQuotes[sym] = {
            price: snap.latestTrade.p,
            size: snap.latestTrade.s,
            timestamp: snap.latestTrade.t,
          };
        }
        if (snap.dailyBar) {
          newBars[sym] = {
            open: snap.dailyBar.o,
            high: snap.dailyBar.h,
            low: snap.dailyBar.l,
            close: snap.dailyBar.c,
            volume: snap.dailyBar.v,
            vwap: snap.dailyBar.vw,
          };
        }
        if (snap.prevDailyBar) {
          if (!newBars[sym]) newBars[sym] = {};
          newBars[sym].prevClose = snap.prevDailyBar.c;
        }
      }
      
      setQuotes(newQuotes);
      setBars(newBars);
      setLastUpdate(new Date());
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [apiKey, apiSecret, headers]);

  const authenticate = async () => {
    setAuthError("");
    try {
      const res = await fetch(`${ALPACA_PAPER_BASE}/v2/account`, { headers });
      if (!res.ok) throw new Error("Invalid credentials");
      setAuthenticated(true);
      fetchSnapshots();
    } catch (err) {
      setAuthError("Authentication failed. Check your API keys.");
    }
  };

  // Auto-refresh
  useEffect(() => {
    if (authenticated && refreshInterval) {
      intervalRef.current = setInterval(fetchSnapshots, refreshInterval * 1000);
      return () => clearInterval(intervalRef.current);
    }
  }, [authenticated, refreshInterval, fetchSnapshots]);

  // Auto-authenticate if env keys are baked in at build time
  useEffect(() => {
    if (ENV_API_KEY && ENV_API_SECRET && !authenticated) {
      authenticate();
    }
  }, []);

  // ── Screening Score Management ──────────────────────────────────────────
  const updateScore = (symbol, dimension, value) => {
    setScreenScores((prev) => ({
      ...prev,
      [symbol]: { ...(prev[symbol] || {}), [dimension]: value },
    }));
  };

  const getCompositeScore = (symbol) => {
    const scores = screenScores[symbol];
    if (!scores) return null;
    const vals = DIMENSIONS.map((d) => scores[d.key]).filter((v) => v !== undefined && v !== null);
    if (vals.length === 0) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };

  // ── Derived Data ────────────────────────────────────────────────────────
  const getChange = (sym) => {
    const q = quotes[sym];
    const b = bars[sym];
    if (!q || !b?.prevClose) return null;
    return ((q.price - b.prevClose) / b.prevClose) * 100;
  };

  const getFilteredSymbols = () => {
    let syms = activeSleeve === "all" ? ALL_SYMBOLS : SLEEVES[activeSleeve]?.symbols || [];
    if (searchTerm) {
      syms = syms.filter((s) => s.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    return syms.sort((a, b) => {
      let valA, valB;
      switch (sortField) {
        case "symbol": valA = a; valB = b; break;
        case "price": valA = quotes[a]?.price || 0; valB = quotes[b]?.price || 0; break;
        case "change": valA = getChange(a) || 0; valB = getChange(b) || 0; break;
        case "volume": valA = bars[a]?.volume || 0; valB = bars[b]?.volume || 0; break;
        case "score": valA = getCompositeScore(a) || 0; valB = getCompositeScore(b) || 0; break;
        default: valA = a; valB = b;
      }
      if (typeof valA === "string") return sortDir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      return sortDir === "asc" ? valA - valB : valB - valA;
    });
  };

  const getSleeveForSymbol = (sym) => {
    for (const [key, sleeve] of Object.entries(SLEEVES)) {
      if (sleeve.symbols.includes(sym)) return { key, ...sleeve };
    }
    return null;
  };

  const getSleeveStats = (sleeveKey) => {
    const syms = SLEEVES[sleeveKey].symbols;
    const changes = syms.map(getChange).filter((c) => c !== null);
    const avgChange = changes.length > 0 ? changes.reduce((a, b) => a + b, 0) / changes.length : null;
    const gainers = changes.filter((c) => c > 0).length;
    const losers = changes.filter((c) => c < 0).length;
    return { avgChange, gainers, losers, total: syms.length };
  };

  // ── LOGIN SCREEN ────────────────────────────────────────────────────────
  if (!authenticated) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(160deg, #0A0F05 0%, #1A2610 40%, #0D1208 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'EB Garamond', 'Playfair Display', Georgia, serif",
      }}>
        <div style={{
          width: 440,
          background: "rgba(26, 38, 16, 0.6)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(122, 143, 90, 0.3)",
          borderRadius: 2,
          padding: "48px 40px",
        }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div style={{
              fontSize: 13,
              letterSpacing: 6,
              color: "#7A8F5A",
              fontFamily: "'DM Mono', monospace",
              marginBottom: 8,
              textTransform: "uppercase",
            }}>
              Intentional Ownership
            </div>
            <h1 style={{
              fontSize: 36,
              color: "#E8EDE0",
              margin: 0,
              fontWeight: 400,
              letterSpacing: 1,
            }}>
              IOWN Portfolio
            </h1>
            <div style={{
              width: 60,
              height: 1,
              background: "linear-gradient(90deg, transparent, #7A8F5A, transparent)",
              margin: "16px auto 0",
            }} />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 11, color: "#7A8F5A", letterSpacing: 2, marginBottom: 6, fontFamily: "'DM Mono', monospace", textTransform: "uppercase" }}>
              API Key ID
            </label>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="APCA-API-KEY-ID"
              style={{
                width: "100%",
                padding: "12px 16px",
                background: "rgba(10, 15, 5, 0.8)",
                border: "1px solid rgba(122, 143, 90, 0.2)",
                borderRadius: 2,
                color: "#E8EDE0",
                fontSize: 14,
                fontFamily: "'DM Mono', monospace",
                outline: "none",
                boxSizing: "border-box",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => e.target.style.borderColor = "rgba(122, 143, 90, 0.5)"}
              onBlur={(e) => e.target.style.borderColor = "rgba(122, 143, 90, 0.2)"}
            />
          </div>

          <div style={{ marginBottom: 32 }}>
            <label style={{ display: "block", fontSize: 11, color: "#7A8F5A", letterSpacing: 2, marginBottom: 6, fontFamily: "'DM Mono', monospace", textTransform: "uppercase" }}>
              Secret Key
            </label>
            <input
              type="password"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              placeholder="APCA-API-SECRET-KEY"
              style={{
                width: "100%",
                padding: "12px 16px",
                background: "rgba(10, 15, 5, 0.8)",
                border: "1px solid rgba(122, 143, 90, 0.2)",
                borderRadius: 2,
                color: "#E8EDE0",
                fontSize: 14,
                fontFamily: "'DM Mono', monospace",
                outline: "none",
                boxSizing: "border-box",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => e.target.style.borderColor = "rgba(122, 143, 90, 0.5)"}
              onBlur={(e) => e.target.style.borderColor = "rgba(122, 143, 90, 0.2)"}
            />
          </div>

          <button
            onClick={authenticate}
            style={{
              width: "100%",
              padding: "14px",
              background: "linear-gradient(135deg, #3D5A1E 0%, #2C4A0F 100%)",
              border: "1px solid rgba(122, 143, 90, 0.4)",
              borderRadius: 2,
              color: "#E8EDE0",
              fontSize: 13,
              letterSpacing: 3,
              fontFamily: "'DM Mono', monospace",
              textTransform: "uppercase",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseOver={(e) => e.target.style.background = "linear-gradient(135deg, #4A6B25 0%, #3D5A1E 100%)"}
            onMouseOut={(e) => e.target.style.background = "linear-gradient(135deg, #3D5A1E 0%, #2C4A0F 100%)"}
          >
            Connect
          </button>

          {authError && (
            <div style={{ marginTop: 16, color: "#C45B4A", fontSize: 13, textAlign: "center", fontFamily: "'DM Mono', monospace" }}>
              {authError}
            </div>
          )}

          <div style={{ marginTop: 32, padding: "16px", background: "rgba(10, 15, 5, 0.5)", borderRadius: 2, border: "1px solid rgba(122, 143, 90, 0.1)" }}>
            <div style={{ fontSize: 11, color: "#5A6B42", fontFamily: "'DM Mono', monospace", lineHeight: 1.6 }}>
              Keys are stored in browser memory only — never transmitted to any server other than Alpaca's API. Use paper trading keys from app.alpaca.markets.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── MAIN DASHBOARD ──────────────────────────────────────────────────────
  const filteredSymbols = getFilteredSymbols();
  const totalHoldings = ALL_SYMBOLS.length;
  const quotedCount = Object.keys(quotes).length;
  const allChanges = ALL_SYMBOLS.map(getChange).filter((c) => c !== null);
  const portfolioAvgChange = allChanges.length > 0 ? allChanges.reduce((a, b) => a + b, 0) / allChanges.length : null;
  const gainersCount = allChanges.filter((c) => c > 0).length;
  const losersCount = allChanges.filter((c) => c < 0).length;

  const SortHeader = ({ field, label }) => (
    <span
      onClick={() => { if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc"); else { setSortField(field); setSortDir("asc"); }}}
      style={{ cursor: "pointer", userSelect: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
    >
      {label}
      {sortField === field && <span style={{ fontSize: 9, opacity: 0.7 }}>{sortDir === "asc" ? "▲" : "▼"}</span>}
    </span>
  );

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #0A0F05 0%, #111A09 30%, #0D1208 100%)",
      fontFamily: "'EB Garamond', Georgia, serif",
      color: "#D4DCC8",
    }}>
      {/* ── TOP BAR ──────────────────────────────────────────────────────── */}
      <div style={{
        padding: "16px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid rgba(122, 143, 90, 0.15)",
        background: "rgba(10, 15, 5, 0.5)",
        backdropFilter: "blur(10px)",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div>
            <span style={{ fontSize: 11, letterSpacing: 5, color: "#7A8F5A", fontFamily: "'DM Mono', monospace", textTransform: "uppercase" }}>IOWN</span>
            <span style={{ fontSize: 18, marginLeft: 12, color: "#E8EDE0", fontWeight: 400 }}>Portfolio Dashboard</span>
          </div>
          <div style={{ width: 1, height: 24, background: "rgba(122, 143, 90, 0.2)" }} />
          <div style={{ display: "flex", gap: 2 }}>
            {[
              { id: "overview", label: "Overview" },
              { id: "holdings", label: "Holdings" },
              { id: "screener", label: "Screener" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: "6px 16px",
                  background: activeTab === tab.id ? "rgba(61, 90, 30, 0.5)" : "transparent",
                  border: activeTab === tab.id ? "1px solid rgba(122, 143, 90, 0.3)" : "1px solid transparent",
                  borderRadius: 2,
                  color: activeTab === tab.id ? "#E8EDE0" : "#7A8F5A",
                  fontSize: 12,
                  fontFamily: "'DM Mono', monospace",
                  letterSpacing: 1,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  textTransform: "uppercase",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <select
            value={refreshInterval || ""}
            onChange={(e) => setRefreshInterval(e.target.value ? parseInt(e.target.value) : null)}
            style={{
              padding: "6px 10px",
              background: "rgba(10, 15, 5, 0.8)",
              border: "1px solid rgba(122, 143, 90, 0.2)",
              borderRadius: 2,
              color: "#7A8F5A",
              fontSize: 11,
              fontFamily: "'DM Mono', monospace",
            }}
          >
            <option value="">Manual</option>
            <option value="15">15s</option>
            <option value="30">30s</option>
            <option value="60">60s</option>
          </select>
          <button
            onClick={fetchSnapshots}
            disabled={loading}
            style={{
              padding: "6px 16px",
              background: loading ? "rgba(61, 90, 30, 0.2)" : "rgba(61, 90, 30, 0.4)",
              border: "1px solid rgba(122, 143, 90, 0.3)",
              borderRadius: 2,
              color: "#E8EDE0",
              fontSize: 11,
              fontFamily: "'DM Mono', monospace",
              letterSpacing: 1,
              cursor: loading ? "default" : "pointer",
              textTransform: "uppercase",
            }}
          >
            {loading ? "Fetching..." : "Refresh"}
          </button>
          {lastUpdate && (
            <span style={{ fontSize: 10, color: "#5A6B42", fontFamily: "'DM Mono', monospace" }}>
              {lastUpdate.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      <div style={{ padding: "24px 32px", maxWidth: 1440, margin: "0 auto" }}>

        {/* ── OVERVIEW TAB ─────────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <div>
            {/* Summary Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
              <div style={{ background: "rgba(26, 38, 16, 0.4)", border: "1px solid rgba(122, 143, 90, 0.15)", borderRadius: 2, padding: "20px 24px" }}>
                <div style={{ fontSize: 10, color: "#5A6B42", fontFamily: "'DM Mono', monospace", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Holdings</div>
                <div style={{ fontSize: 32, color: "#E8EDE0", fontWeight: 300 }}>{totalHoldings}</div>
                <div style={{ fontSize: 11, color: "#7A8F5A", marginTop: 4 }}>{quotedCount} quoted</div>
              </div>
              <div style={{ background: "rgba(26, 38, 16, 0.4)", border: "1px solid rgba(122, 143, 90, 0.15)", borderRadius: 2, padding: "20px 24px" }}>
                <div style={{ fontSize: 10, color: "#5A6B42", fontFamily: "'DM Mono', monospace", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Avg Change</div>
                <div style={{ fontSize: 32, fontWeight: 300, color: portfolioAvgChange > 0 ? "#7ABF5A" : portfolioAvgChange < 0 ? "#C45B4A" : "#E8EDE0" }}>
                  {fmtPct(portfolioAvgChange)}
                </div>
                <div style={{ fontSize: 11, color: "#7A8F5A", marginTop: 4 }}>across portfolio</div>
              </div>
              <div style={{ background: "rgba(26, 38, 16, 0.4)", border: "1px solid rgba(122, 143, 90, 0.15)", borderRadius: 2, padding: "20px 24px" }}>
                <div style={{ fontSize: 10, color: "#5A6B42", fontFamily: "'DM Mono', monospace", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Gainers</div>
                <div style={{ fontSize: 32, color: "#7ABF5A", fontWeight: 300 }}>{gainersCount}</div>
                <div style={{ fontSize: 11, color: "#7A8F5A", marginTop: 4 }}>advancing today</div>
              </div>
              <div style={{ background: "rgba(26, 38, 16, 0.4)", border: "1px solid rgba(122, 143, 90, 0.15)", borderRadius: 2, padding: "20px 24px" }}>
                <div style={{ fontSize: 10, color: "#5A6B42", fontFamily: "'DM Mono', monospace", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Decliners</div>
                <div style={{ fontSize: 32, color: "#C45B4A", fontWeight: 300 }}>{losersCount}</div>
                <div style={{ fontSize: 11, color: "#7A8F5A", marginTop: 4 }}>declining today</div>
              </div>
            </div>

            {/* Sleeve Breakdown */}
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 14, color: "#7A8F5A", fontFamily: "'DM Mono', monospace", letterSpacing: 3, textTransform: "uppercase", marginBottom: 16, fontWeight: 400 }}>
                Sleeve Performance
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                {Object.entries(SLEEVES).map(([key, sleeve]) => {
                  const stats = getSleeveStats(key);
                  return (
                    <div key={key} style={{
                      background: `linear-gradient(135deg, ${sleeve.color}33 0%, rgba(10,15,5,0.4) 100%)`,
                      border: `1px solid ${sleeve.accent}44`,
                      borderRadius: 2,
                      padding: "24px",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                        <div>
                          <div style={{ fontSize: 16, color: "#E8EDE0", marginBottom: 4 }}>{sleeve.name}</div>
                          <div style={{ fontSize: 11, color: "#5A6B42", fontFamily: "'DM Mono', monospace" }}>{stats.total} positions</div>
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 300, color: stats.avgChange > 0 ? "#7ABF5A" : stats.avgChange < 0 ? "#C45B4A" : "#E8EDE0" }}>
                          {fmtPct(stats.avgChange)}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 16 }}>
                        <span style={{ fontSize: 11, color: "#7ABF5A", fontFamily: "'DM Mono', monospace" }}>▲ {stats.gainers}</span>
                        <span style={{ fontSize: 11, color: "#C45B4A", fontFamily: "'DM Mono', monospace" }}>▼ {stats.losers}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Heat Map */}
            <div>
              <h2 style={{ fontSize: 14, color: "#7A8F5A", fontFamily: "'DM Mono', monospace", letterSpacing: 3, textTransform: "uppercase", marginBottom: 16, fontWeight: 400 }}>
                Portfolio Heat Map
              </h2>
              {Object.entries(SLEEVES).map(([key, sleeve]) => (
                <div key={key} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, color: "#5A6B42", fontFamily: "'DM Mono', monospace", letterSpacing: 2, marginBottom: 8, textTransform: "uppercase" }}>
                    {sleeve.name}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {sleeve.symbols.map((sym) => {
                      const change = getChange(sym);
                      const intensity = change ? Math.min(Math.abs(change) / 3, 1) : 0;
                      const bg = change > 0
                        ? `rgba(122, 191, 90, ${0.15 + intensity * 0.45})`
                        : change < 0
                        ? `rgba(196, 91, 74, ${0.15 + intensity * 0.45})`
                        : "rgba(122, 143, 90, 0.1)";
                      const border = change > 0
                        ? `rgba(122, 191, 90, ${0.3 + intensity * 0.4})`
                        : change < 0
                        ? `rgba(196, 91, 74, ${0.3 + intensity * 0.4})`
                        : "rgba(122, 143, 90, 0.2)";
                      return (
                        <div
                          key={sym}
                          onClick={() => { setSelectedStock(sym); setActiveTab("holdings"); }}
                          style={{
                            padding: "8px 12px",
                            background: bg,
                            border: `1px solid ${border}`,
                            borderRadius: 2,
                            cursor: "pointer",
                            minWidth: 72,
                            textAlign: "center",
                            transition: "all 0.15s",
                          }}
                          onMouseOver={(e) => { e.currentTarget.style.transform = "scale(1.05)"; e.currentTarget.style.zIndex = "10"; }}
                          onMouseOut={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.zIndex = "1"; }}
                        >
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#E8EDE0", fontFamily: "'DM Mono', monospace", letterSpacing: 1 }}>{sym}</div>
                          <div style={{ fontSize: 10, color: change > 0 ? "#7ABF5A" : change < 0 ? "#C45B4A" : "#5A6B42", fontFamily: "'DM Mono', monospace", marginTop: 2 }}>
                            {fmtPct(change)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Top Movers */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 32 }}>
              {[
                { title: "Top Gainers", data: ALL_SYMBOLS.filter(s => getChange(s) !== null).sort((a, b) => getChange(b) - getChange(a)).slice(0, 5), positive: true },
                { title: "Top Decliners", data: ALL_SYMBOLS.filter(s => getChange(s) !== null).sort((a, b) => getChange(a) - getChange(b)).slice(0, 5), positive: false },
              ].map(({ title, data, positive }) => (
                <div key={title}>
                  <h2 style={{ fontSize: 14, color: "#7A8F5A", fontFamily: "'DM Mono', monospace", letterSpacing: 3, textTransform: "uppercase", marginBottom: 12, fontWeight: 400 }}>{title}</h2>
                  <div style={{ background: "rgba(26, 38, 16, 0.3)", border: "1px solid rgba(122, 143, 90, 0.1)", borderRadius: 2 }}>
                    {data.map((sym, i) => (
                      <div key={sym} onClick={() => { setSelectedStock(sym); setActiveTab("holdings"); }} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "12px 16px",
                        borderBottom: i < data.length - 1 ? "1px solid rgba(122, 143, 90, 0.08)" : "none",
                        cursor: "pointer",
                        transition: "background 0.15s",
                      }}
                        onMouseOver={(e) => e.currentTarget.style.background = "rgba(122, 143, 90, 0.05)"}
                        onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span style={{ fontSize: 10, color: "#5A6B42", fontFamily: "'DM Mono', monospace", width: 16 }}>{i + 1}</span>
                          <span style={{ fontSize: 14, color: "#E8EDE0", fontFamily: "'DM Mono', monospace", fontWeight: 600, letterSpacing: 1 }}>{sym}</span>
                          <span style={{ fontSize: 10, color: "#5A6B42", fontFamily: "'DM Mono', monospace" }}>{getSleeveForSymbol(sym)?.name}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                          <span style={{ fontSize: 13, color: "#D4DCC8", fontFamily: "'DM Mono', monospace" }}>${fmt(quotes[sym]?.price)}</span>
                          <span style={{ fontSize: 13, fontFamily: "'DM Mono', monospace", fontWeight: 600, color: positive ? "#7ABF5A" : "#C45B4A", minWidth: 70, textAlign: "right" }}>
                            {fmtPct(getChange(sym))}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── HOLDINGS TAB ────────────────────────────────────────────────── */}
        {activeTab === "holdings" && (
          <div>
            {/* Filters */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
              <div style={{ display: "flex", gap: 2 }}>
                {[{ id: "all", label: "All (51)" }, ...Object.entries(SLEEVES).map(([k, s]) => ({ id: k, label: `${s.name} (${s.symbols.length})` }))].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setActiveSleeve(opt.id)}
                    style={{
                      padding: "6px 14px",
                      background: activeSleeve === opt.id ? "rgba(61, 90, 30, 0.5)" : "transparent",
                      border: activeSleeve === opt.id ? "1px solid rgba(122, 143, 90, 0.3)" : "1px solid rgba(122, 143, 90, 0.1)",
                      borderRadius: 2,
                      color: activeSleeve === opt.id ? "#E8EDE0" : "#5A6B42",
                      fontSize: 11,
                      fontFamily: "'DM Mono', monospace",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Search ticker..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  marginLeft: "auto",
                  padding: "6px 14px",
                  background: "rgba(10, 15, 5, 0.6)",
                  border: "1px solid rgba(122, 143, 90, 0.2)",
                  borderRadius: 2,
                  color: "#E8EDE0",
                  fontSize: 12,
                  fontFamily: "'DM Mono', monospace",
                  width: 180,
                  outline: "none",
                }}
              />
            </div>

            {/* Table */}
            <div style={{ background: "rgba(26, 38, 16, 0.25)", border: "1px solid rgba(122, 143, 90, 0.1)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{
                display: "grid",
                gridTemplateColumns: "100px 1fr 120px 120px 100px 100px 100px",
                padding: "10px 16px",
                background: "rgba(10, 15, 5, 0.5)",
                borderBottom: "1px solid rgba(122, 143, 90, 0.15)",
                fontSize: 10,
                color: "#5A6B42",
                fontFamily: "'DM Mono', monospace",
                letterSpacing: 2,
                textTransform: "uppercase",
              }}>
                <div><SortHeader field="symbol" label="Ticker" /></div>
                <div>Sleeve</div>
                <div style={{ textAlign: "right" }}><SortHeader field="price" label="Price" /></div>
                <div style={{ textAlign: "right" }}><SortHeader field="change" label="Change" /></div>
                <div style={{ textAlign: "right" }}>Open</div>
                <div style={{ textAlign: "right" }}>High / Low</div>
                <div style={{ textAlign: "right" }}><SortHeader field="volume" label="Volume" /></div>
              </div>

              {filteredSymbols.map((sym, i) => {
                const q = quotes[sym];
                const b = bars[sym];
                const change = getChange(sym);
                const sleeve = getSleeveForSymbol(sym);
                const isSelected = selectedStock === sym;

                return (
                  <div key={sym}>
                    <div
                      onClick={() => setSelectedStock(isSelected ? null : sym)}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "100px 1fr 120px 120px 100px 100px 100px",
                        padding: "10px 16px",
                        borderBottom: "1px solid rgba(122, 143, 90, 0.06)",
                        cursor: "pointer",
                        background: isSelected ? "rgba(61, 90, 30, 0.15)" : i % 2 === 0 ? "transparent" : "rgba(10, 15, 5, 0.2)",
                        transition: "background 0.15s",
                      }}
                      onMouseOver={(e) => { if (!isSelected) e.currentTarget.style.background = "rgba(122, 143, 90, 0.05)"; }}
                      onMouseOut={(e) => { if (!isSelected) e.currentTarget.style.background = i % 2 === 0 ? "transparent" : "rgba(10, 15, 5, 0.2)"; }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#E8EDE0", fontFamily: "'DM Mono', monospace", letterSpacing: 1 }}>{sym}</div>
                      <div style={{ fontSize: 11, color: sleeve?.accent || "#5A6B42", fontFamily: "'DM Mono', monospace" }}>{sleeve?.name}</div>
                      <div style={{ textAlign: "right", fontSize: 14, color: "#E8EDE0", fontFamily: "'DM Mono', monospace" }}>${fmt(q?.price)}</div>
                      <div style={{ textAlign: "right", fontSize: 13, fontWeight: 600, fontFamily: "'DM Mono', monospace", color: change > 0 ? "#7ABF5A" : change < 0 ? "#C45B4A" : "#D4DCC8" }}>
                        {fmtPct(change)}
                      </div>
                      <div style={{ textAlign: "right", fontSize: 12, color: "#7A8F5A", fontFamily: "'DM Mono', monospace" }}>${fmt(b?.open)}</div>
                      <div style={{ textAlign: "right", fontSize: 11, color: "#5A6B42", fontFamily: "'DM Mono', monospace" }}>
                        {b ? `${fmt(b.high)} / ${fmt(b.low)}` : "—"}
                      </div>
                      <div style={{ textAlign: "right", fontSize: 12, color: "#7A8F5A", fontFamily: "'DM Mono', monospace" }}>{fmtVol(b?.volume)}</div>
                    </div>

                    {/* Expanded Detail */}
                    {isSelected && (
                      <div style={{
                        padding: "16px 24px",
                        background: "rgba(26, 38, 16, 0.4)",
                        borderBottom: "1px solid rgba(122, 143, 90, 0.1)",
                        display: "grid",
                        gridTemplateColumns: "repeat(4, 1fr)",
                        gap: 16,
                      }}>
                        <div>
                          <div style={{ fontSize: 10, color: "#5A6B42", fontFamily: "'DM Mono', monospace", letterSpacing: 1, marginBottom: 4 }}>PREV CLOSE</div>
                          <div style={{ fontSize: 16, color: "#E8EDE0" }}>${fmt(b?.prevClose)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: "#5A6B42", fontFamily: "'DM Mono', monospace", letterSpacing: 1, marginBottom: 4 }}>VWAP</div>
                          <div style={{ fontSize: 16, color: "#E8EDE0" }}>${fmt(b?.vwap)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: "#5A6B42", fontFamily: "'DM Mono', monospace", letterSpacing: 1, marginBottom: 4 }}>DAY RANGE</div>
                          <div style={{ fontSize: 14, color: "#E8EDE0" }}>${fmt(b?.low)} — ${fmt(b?.high)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: "#5A6B42", fontFamily: "'DM Mono', monospace", letterSpacing: 1, marginBottom: 4 }}>COMPOSITE SCORE</div>
                          <div style={{ fontSize: 16, color: getCompositeScore(sym) ? "#7ABF5A" : "#5A6B42" }}>
                            {getCompositeScore(sym) ? `${getCompositeScore(sym).toFixed(1)} / 10` : "Not scored"}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── SCREENER TAB ────────────────────────────────────────────────── */}
        {activeTab === "screener" && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 14, color: "#7A8F5A", fontFamily: "'DM Mono', monospace", letterSpacing: 3, textTransform: "uppercase", marginBottom: 8, fontWeight: 400 }}>
                Excellence Evaluation — 8-Dimension Framework
              </h2>
              <p style={{ fontSize: 13, color: "#5A6B42", margin: 0, lineHeight: 1.6 }}>
                Score each holding 1–10 across Innovation, Inspiration, Infrastructure, AI Resilience, Moat Strength, Erosion Protection, Social Arbitrage, and Dividend Safety. The Sinek overlay evaluates Infinite vs Finite game positioning.
              </p>
            </div>

            {/* Sleeve Filter */}
            <div style={{ display: "flex", gap: 2, marginBottom: 20 }}>
              {[{ id: "all", label: "All" }, ...Object.entries(SLEEVES).map(([k, s]) => ({ id: k, label: s.name }))].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setActiveSleeve(opt.id)}
                  style={{
                    padding: "6px 14px",
                    background: activeSleeve === opt.id ? "rgba(61, 90, 30, 0.5)" : "transparent",
                    border: activeSleeve === opt.id ? "1px solid rgba(122, 143, 90, 0.3)" : "1px solid rgba(122, 143, 90, 0.1)",
                    borderRadius: 2,
                    color: activeSleeve === opt.id ? "#E8EDE0" : "#5A6B42",
                    fontSize: 11,
                    fontFamily: "'DM Mono', monospace",
                    cursor: "pointer",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Screening Table */}
            <div style={{ overflowX: "auto" }}>
              <div style={{ minWidth: 1100 }}>
                {/* Header */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: `90px repeat(${DIMENSIONS.length}, 1fr) 80px 80px`,
                  padding: "10px 12px",
                  background: "rgba(10, 15, 5, 0.5)",
                  border: "1px solid rgba(122, 143, 90, 0.15)",
                  borderRadius: "2px 2px 0 0",
                  fontSize: 9,
                  color: "#5A6B42",
                  fontFamily: "'DM Mono', monospace",
                  letterSpacing: 1,
                  textTransform: "uppercase",
                }}>
                  <div>Ticker</div>
                  {DIMENSIONS.map((d) => (
                    <div key={d.key} style={{ textAlign: "center" }} title={d.label}>
                      <span>{d.icon}</span>
                      <div style={{ marginTop: 2 }}>{d.label.slice(0, 6)}</div>
                    </div>
                  ))}
                  <div style={{ textAlign: "center" }}>{GAME_OVERLAY.icon} Game</div>
                  <div style={{ textAlign: "center" }}>Score</div>
                </div>

                {/* Rows */}
                {(activeSleeve === "all" ? ALL_SYMBOLS : SLEEVES[activeSleeve]?.symbols || []).map((sym, i) => {
                  const composite = getCompositeScore(sym);
                  const scores = screenScores[sym] || {};
                  return (
                    <div key={sym} style={{
                      display: "grid",
                      gridTemplateColumns: `90px repeat(${DIMENSIONS.length}, 1fr) 80px 80px`,
                      padding: "6px 12px",
                      background: i % 2 === 0 ? "rgba(26, 38, 16, 0.2)" : "rgba(10, 15, 5, 0.15)",
                      border: "1px solid rgba(122, 143, 90, 0.06)",
                      borderTop: "none",
                      alignItems: "center",
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#E8EDE0", fontFamily: "'DM Mono', monospace", letterSpacing: 1 }}>{sym}</div>
                      {DIMENSIONS.map((d) => (
                        <div key={d.key} style={{ textAlign: "center" }}>
                          <input
                            type="number"
                            min="1"
                            max="10"
                            value={scores[d.key] || ""}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              if (val >= 1 && val <= 10) updateScore(sym, d.key, val);
                              else if (e.target.value === "") updateScore(sym, d.key, undefined);
                            }}
                            style={{
                              width: 38,
                              padding: "4px",
                              background: scores[d.key] ? "rgba(61, 90, 30, 0.3)" : "rgba(10, 15, 5, 0.5)",
                              border: scores[d.key] ? "1px solid rgba(122, 191, 90, 0.3)" : "1px solid rgba(122, 143, 90, 0.15)",
                              borderRadius: 2,
                              color: "#E8EDE0",
                              fontSize: 12,
                              fontFamily: "'DM Mono', monospace",
                              textAlign: "center",
                              outline: "none",
                            }}
                          />
                        </div>
                      ))}
                      <div style={{ textAlign: "center" }}>
                        <select
                          value={scores[GAME_OVERLAY.key] || ""}
                          onChange={(e) => updateScore(sym, GAME_OVERLAY.key, e.target.value || undefined)}
                          style={{
                            padding: "4px 2px",
                            background: scores[GAME_OVERLAY.key] ? "rgba(61, 90, 30, 0.3)" : "rgba(10, 15, 5, 0.5)",
                            border: "1px solid rgba(122, 143, 90, 0.15)",
                            borderRadius: 2,
                            color: "#E8EDE0",
                            fontSize: 10,
                            fontFamily: "'DM Mono', monospace",
                            outline: "none",
                          }}
                        >
                          <option value="">—</option>
                          <option value="infinite">♾️ Inf</option>
                          <option value="finite">⏳ Fin</option>
                          <option value="mixed">🔄 Mix</option>
                        </select>
                      </div>
                      <div style={{
                        textAlign: "center",
                        fontSize: 15,
                        fontWeight: 600,
                        fontFamily: "'DM Mono', monospace",
                        color: composite ? (composite >= 7 ? "#7ABF5A" : composite >= 5 ? "#C4A83A" : "#C45B4A") : "#3A4530",
                      }}>
                        {composite ? composite.toFixed(1) : "—"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Score Legend */}
            <div style={{ marginTop: 24, padding: "16px 20px", background: "rgba(26, 38, 16, 0.3)", border: "1px solid rgba(122, 143, 90, 0.1)", borderRadius: 2, display: "flex", gap: 32 }}>
              <div style={{ fontSize: 11, fontFamily: "'DM Mono', monospace" }}>
                <span style={{ color: "#7ABF5A", fontWeight: 600 }}>7.0+</span><span style={{ color: "#5A6B42" }}> Strong conviction</span>
              </div>
              <div style={{ fontSize: 11, fontFamily: "'DM Mono', monospace" }}>
                <span style={{ color: "#C4A83A", fontWeight: 600 }}>5.0–6.9</span><span style={{ color: "#5A6B42" }}> Hold / Monitor</span>
              </div>
              <div style={{ fontSize: 11, fontFamily: "'DM Mono', monospace" }}>
                <span style={{ color: "#C45B4A", fontWeight: 600 }}>&lt;5.0</span><span style={{ color: "#5A6B42" }}> Review for erosion</span>
              </div>
              <div style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", marginLeft: "auto" }}>
                <span style={{ color: "#5A6B42" }}>♾️ Infinite = long-term compounders &nbsp;|&nbsp; ⏳ Finite = tactical / cyclical</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
      <div style={{
        padding: "20px 32px",
        borderTop: "1px solid rgba(122, 143, 90, 0.1)",
        marginTop: 40,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <div style={{ fontSize: 10, color: "#3A4530", fontFamily: "'DM Mono', monospace", lineHeight: 1.6, maxWidth: 800 }}>
          IOWN — Intentional Ownership | A Registered Investment Advisor under Paradiem. Data provided by Alpaca Markets (IEX feed). Not investment advice. For internal investment committee use only.
        </div>
        <div style={{ fontSize: 10, color: "#3A4530", fontFamily: "'DM Mono', monospace" }}>
          Return on Intention
        </div>
      </div>
    </div>
  );
}
