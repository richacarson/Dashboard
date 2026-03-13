# IOWN Portfolio Dashboard

Real-time portfolio tracking and screening platform for IOWN's 51 holdings across Dividend, Growth Hybrid, and Digital Asset ETF sleeves.

**Powered by Alpaca Markets (IEX feed) — Free tier, no trading required.**

## Features

- **Live Market Data** — Real-time prices via Alpaca's snapshot API with auto-refresh (15s / 30s / 60s)
- **Portfolio Heat Map** — Visual performance overview across all three sleeves
- **Holdings Table** — Sortable, filterable, with expanded detail views (VWAP, prev close, day range)
- **8-Dimension Screener** — Innovation, Inspiration, Infrastructure, AI Resilience, Moat Strength, Erosion Protection, Social Arbitrage, Dividend Safety
- **Sinek Overlay** — Infinite vs Finite game classification per holding
- **Top Movers** — Automatic leaderboard of daily gainers and decliners

## Setup

### 1. Get Alpaca API Keys (free)

1. Go to [app.alpaca.markets](https://app.alpaca.markets/account/login)
2. Create a free account
3. Select **Paper Trading** account
4. Generate API keys from the dashboard

### 2. Local Development

```bash
npm install
npm run dev
```

Open http://localhost:5173/iown-dashboard/ and enter your Alpaca paper trading keys.

### 3. Deploy to GitHub Pages

1. Create a new repo: `iown-dashboard`
2. Push this project:

```bash
git init
git add .
git commit -m "Initial IOWN Dashboard"
git branch -M main
git remote add origin https://github.com/richacarson/iown-dashboard.git
git push -u origin main
```

3. In GitHub repo → Settings → Pages → Source: **GitHub Actions**
4. The workflow will auto-deploy on push
5. Dashboard will be live at: `https://richacarson.github.io/iown-dashboard/`

## Architecture

- **Frontend**: React 18 + Vite
- **Data**: Alpaca Markets REST API (IEX feed)
- **Auth**: API keys stored in browser memory only (never persisted)
- **Deployment**: GitHub Pages via GitHub Actions

## IOWN Holdings (51)

**Dividend (25):** ABT, A, ADI, ATO, ADP, BKH, CAT, CHD, CL, FAST, GD, GPC, LRCX, LMT, MATX, NEE, ORI, PCAR, QCOM, DGX, SSNC, STLD, SYK, TEL, VLO

**Growth Hybrid (24):** AMD, AEM, ATAT, CVX, CWAN, CNX, COIN, EIX, FINV, FTNT, GFI, SUPV, HRMY, HUT, KEYS, MARA, NVDA, NXPI, OKE, PDD, HOOD, SYF, TSM, TOL

**Digital Asset ETFs (2):** IBIT, ETHA 

---

*IOWN — Intentional Ownership | A Registered Investment Advisor under Paradiem*
*For internal investment committee use only. Not investment advice.*
