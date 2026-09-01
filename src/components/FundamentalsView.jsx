// src/components/FundamentalsView.jsx
// Fundamentals for the Metrics section + stock overview.
//   - Per-sleeve table: live P/E (TTM or FWD) and where today's multiple sits
//     vs the stock's own recent range (CHEAP / MID / RICH).
//   - Detail: polished, axis-labelled EPS-vs-price and FCF + P/FCF charts,
//     with a forward-EPS projection marker.
// Data: public/fundamentals/<ticker>.json (scripts/build-fundamentals.py).

import { useState, useEffect } from 'react'

const fmt1 = (v) => (v == null || !isFinite(v)) ? '—' : v.toFixed(1)
const money = (v, d = 2) => (v == null || !isFinite(v)) ? '—' : `$${v.toFixed(d)}`
const bil = (v) => {
  if (v == null || !isFinite(v)) return '—'
  const a = Math.abs(v)
  if (a >= 1e12) return `$${(v / 1e12).toFixed(1)}T`
  if (a >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
  if (a >= 1e6) return `$${(v / 1e6).toFixed(0)}M`
  return `$${v.toFixed(0)}`
}

// nice axis ticks
function ticks(lo, hi, n = 4) {
  if (!isFinite(lo) || !isFinite(hi) || hi <= lo) return [lo || 0]
  const span = hi - lo
  const raw = span / n
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / mag
  const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag
  const start = Math.ceil(lo / step) * step
  const out = []
  for (let v = start; v <= hi + step * 0.001; v += step) out.push(v)
  return out
}

function livePE(f, px, basis) {
  if (!px) return null
  if (basis === 'fwd') {
    if (f.fwd?.eps > 0) return px / f.fwd.eps
    if (f.fwd?.pe) return f.fwd.pe
    // no forward estimate available — fall back to TTM so the column stays populated
  }
  return f.ttm?.eps > 0 ? px / f.ttm.eps : null
}

function valuationBand(live, histVals, C) {
  // Robust 10th–90th percentile range: quarterly TTM P/E includes trough-earnings
  // quarters that spike to hundreds×, so raw min/max would distort the band.
  const xs = (histVals || []).filter((v) => v != null && isFinite(v) && v > 0).sort((a, b) => a - b)
  if (!live || !isFinite(live) || xs.length < 4) return null
  const pct = (p) => xs[Math.min(xs.length - 1, Math.max(0, Math.floor(xs.length * p)))]
  const lo = pct(0.10), hi = pct(0.90)
  const pos = hi > lo ? (live - lo) / (hi - lo) : 0.5
  const label = pos <= 0.15 ? 'CHEAP' : pos >= 0.85 ? 'RICH' : 'MID'
  const color = pos <= 0.15 ? C.up : pos >= 0.85 ? C.dn : C.t3
  return { pos: Math.max(0, Math.min(1, pos)), lo, hi, label, color }
}

export default function FundamentalsView({ tickers, quotes, names, fundMap, sleeveKey, C, isDesktop, terminal = false }) {
  const [sel, setSel] = useState(null)
  const [showPort, setShowPort] = useState(false)
  const [basis, setBasis] = useState('fwd') // 'fwd' | 'ttm'
  const R = terminal ? 2 : 12
  const SLEEVE_NAMES = { dividend: 'Dividend', growth: 'Growth', fci100: 'FCI 100', fciValues: 'FCI Values' }

  const rows = (tickers || []).map((t) => {
    const f = fundMap?.[t]
    const px = quotes?.[t]?.p
    if (!f || !f.ttm) return { t, f: null, px }
    const pe = livePE(f, px, basis)
    const pfcf = (px && f.ttm.fcfps > 0) ? px / f.ttm.fcfps : null
    const hist = (f.quarterly && f.quarterly.length ? f.quarterly : (f.annual || []))
    const band = valuationBand(pe, hist.map((a) => a.pe), C)
    return { t, f, px, pe, pfcf, band }
  })
  const sorted = [...rows].sort((a, b) => {
    if (!a.band && !b.band) return a.t.localeCompare(b.t)
    if (!a.band) return 1; if (!b.band) return -1
    return a.band.pos - b.band.pos
  })
  const covered = rows.filter((r) => r.f).length
  const cell = { padding: '8px 10px', fontSize: 12, fontVariantNumeric: 'tabular-nums' }

  const toggle = (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      {sleeveKey && (
        <button onClick={() => setShowPort(true)} style={{
          padding: '5px 12px', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
          border: `1px solid ${C.border}`, borderRadius: 8, background: C.accentSoft, color: C.accent, whiteSpace: 'nowrap',
        }}>📊 Portfolio vs S&P 500</button>
      )}
      <div style={{ display: 'inline-flex', border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
        {['fwd', 'ttm'].map((b) => (
          <button key={b} onClick={() => setBasis(b)} style={{
            padding: '4px 12px', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', border: 'none',
            background: basis === b ? C.accentSoft : 'transparent', color: basis === b ? C.accent : C.t4,
          }}>{b.toUpperCase()}</button>
        ))}
      </div>
    </div>
  )

  return (
    <div style={{ animation: 'fadeIn 0.2s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12, color: C.t3, lineHeight: 1.5, flex: 1, minWidth: 200 }}>
          Live valuation vs each stock's own recent range. <span style={{ color: C.up, fontWeight: 700 }}>CHEAP</span> = near multi-year low,
          {' '}<span style={{ color: C.dn, fontWeight: 700 }}>RICH</span> = near high. {covered}/{rows.length} covered.
        </div>
        {toggle}
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: R, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
            <thead>
              <tr>
                {['Ticker', 'Price', `P/E ${basis === 'fwd' ? 'FWD' : 'TTM'}`, 'vs own range', 'P/FCF', ''].map((h, i) => (
                  <th key={h + i} style={{ ...cell, textAlign: i === 0 ? 'left' : i === 3 ? 'center' : 'right', fontSize: 10, fontWeight: 700, color: C.t4, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.t} onClick={() => r.f && setSel(sel === r.t ? null : r.t)}
                  style={{ borderBottom: `1px solid ${C.border}`, cursor: r.f ? 'pointer' : 'default', background: sel === r.t ? C.accentSoft : 'transparent' }}>
                  <td style={{ ...cell, textAlign: 'left' }}>
                    <span style={{ fontWeight: 700, color: r.f ? C.accent : C.t4 }}>{r.t}</span>
                    {!r.f && <span style={{ fontSize: 9, color: C.t4, marginLeft: 6 }}>n/a</span>}
                  </td>
                  <td style={{ ...cell, textAlign: 'right', color: C.t1 }}>{r.px ? money(r.px) : '—'}</td>
                  <td style={{ ...cell, textAlign: 'right', color: C.t1, fontWeight: 600 }}>{fmt1(r.pe)}</td>
                  <td style={{ ...cell, textAlign: 'center' }}>
                    {r.band ? (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ position: 'relative', width: 56, height: 6, borderRadius: 3, background: `linear-gradient(90deg, ${C.up}55, ${C.border}, ${C.dn}55)` }}>
                          <div style={{ position: 'absolute', left: `${r.band.pos * 100}%`, top: -2, width: 3, height: 10, borderRadius: 2, background: r.band.color, transform: 'translateX(-50%)' }} />
                        </div>
                        <span style={{ fontSize: 9, fontWeight: 800, color: r.band.color, width: 38, textAlign: 'left' }}>{r.band.label}</span>
                      </div>
                    ) : '—'}
                  </td>
                  <td style={{ ...cell, textAlign: 'right', color: C.t2 }}>{fmt1(r.pfcf)}</td>
                  <td style={{ ...cell, textAlign: 'right', color: C.t4, fontSize: 11 }}>{r.f ? '›' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {sel && fundMap[sel] && (
        <div onClick={() => setSel(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'stretch', justifyContent: 'center' }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: C.bg, padding: isDesktop ? '18px 24px' : `calc(56px + env(safe-area-inset-top)) 12px calc(16px + env(safe-area-inset-bottom))`, width: '100%', maxWidth: 1500, height: '100dvh', overflowY: 'auto', position: 'relative' }}>
            {/* Fixed close button — sits clear of the status bar / notch on mobile */}
            <button onClick={() => setSel(null)} aria-label="Close" style={{ position: 'fixed', top: `calc(env(safe-area-inset-top, 0px) + 12px)`, right: 16, zIndex: 1010, background: C.surface, border: `1px solid ${C.border}`, color: C.t2, borderRadius: 10, width: 38, height: 38, fontSize: 18, lineHeight: 1, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 2px 10px rgba(0,0,0,0.35)' }}>✕</button>
            <FundamentalsDetail f={fundMap[sel]} px={quotes?.[sel]?.p} name={names?.[sel] || sel} basis={basis} C={C} isDesktop={isDesktop} />
          </div>
        </div>
      )}

      {showPort && sleeveKey && (
        <div onClick={() => setShowPort(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'stretch', justifyContent: 'center' }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: C.bg, padding: isDesktop ? '18px 24px' : `calc(56px + env(safe-area-inset-top)) 12px calc(16px + env(safe-area-inset-bottom))`, width: '100%', maxWidth: 1500, height: '100dvh', overflowY: 'auto', position: 'relative' }}>
            <button onClick={() => setShowPort(false)} aria-label="Close" style={{ position: 'fixed', top: `calc(env(safe-area-inset-top, 0px) + 12px)`, right: 16, zIndex: 1010, background: C.surface, border: `1px solid ${C.border}`, color: C.t2, borderRadius: 10, width: 38, height: 38, fontSize: 18, lineHeight: 1, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 2px 10px rgba(0,0,0,0.35)' }}>✕</button>
            <PortfolioFundamentals sleeveKey={sleeveKey} sleeveName={SLEEVE_NAMES[sleeveKey] || sleeveKey} C={C} isDesktop={isDesktop} />
          </div>
        </div>
      )}
    </div>
  )
}

// Self-fetching block for the stock overview. Index benchmarks (e.g. SPY) have
// no EDGAR statements — they render the multpl-sourced index Price·EPS·P/E panel.
export function StockFundamentals({ symbol, price, name, C, isDesktop }) {
  const [f, setF] = useState(undefined)
  const [basis, setBasis] = useState('fwd')
  const isIndex = !!(symbol && INDEX_SYMS[symbol])
  useEffect(() => {
    if (!symbol) return
    let cancelled = false
    setF(undefined)
    const url = isIndex ? `${import.meta.env.BASE_URL}benchmark-fundamentals.json` : `${import.meta.env.BASE_URL}fundamentals/${symbol}.json`
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setF(isIndex ? (d?.benchmarks?.[symbol] || null) : d) })
      .catch(() => { if (!cancelled) setF(null) })
    return () => { cancelled = true }
  }, [symbol])
  if (f === undefined || f === null) return null
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: isDesktop ? 16 : 12, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, textTransform: 'uppercase', letterSpacing: 1 }}>Fundamentals</div>
        {!isIndex && (
          <div style={{ marginLeft: 'auto', display: 'inline-flex', border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
            {['fwd', 'ttm'].map((b) => (
              <button key={b} onClick={() => setBasis(b)} style={{ padding: '3px 10px', fontSize: 10, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', border: 'none', background: basis === b ? C.accentSoft : 'transparent', color: basis === b ? C.accent : C.t4 }}>{b.toUpperCase()}</button>
            ))}
          </div>
        )}
      </div>
      {isIndex
        ? <IndexFundamentals data={f} symbol={symbol} name={name} livePrice={price} C={C} isDesktop={isDesktop} />
        : <FundamentalsDetail f={f} px={price} name={name || symbol} basis={basis} C={C} isDesktop={isDesktop} />}
    </div>
  )
}


// Portfolio-blended fundamentals for a sleeve, with the S&P 500's multiple overlaid.
export function PortfolioFundamentals({ sleeveKey, sleeveName, C, isDesktop }) {
  const [d, setD] = useState(undefined)
  const [bench, setBench] = useState(null)
  useEffect(() => {
    if (!sleeveKey) return
    let cancel = false
    setD(undefined)
    fetch(`${import.meta.env.BASE_URL}portfolio-fundamentals-${sleeveKey}.json`)
      .then((r) => (r.ok ? r.json() : null)).then((x) => { if (!cancel) setD(x) }).catch(() => { if (!cancel) setD(null) })
    fetch(`${import.meta.env.BASE_URL}benchmark-fundamentals.json`)
      .then((r) => (r.ok ? r.json() : null)).then((x) => { if (!cancel) setBench(x) }).catch(() => {})
    return () => { cancel = true }
  }, [sleeveKey])

  if (d === undefined) return <div style={{ padding: 24, color: C.t3, fontSize: 13 }}>Loading portfolio fundamentals…</div>
  if (!d || !(d.series || []).length) return <div style={{ padding: 24, color: C.t3, fontSize: 13 }}>Blended fundamentals aren't available for this sleeve yet.</div>

  const W = isDesktop ? 720 : 372, H = isDesktop ? 296 : 258
  const PAD = { t: 24, r: 66, b: 40, l: 62 }
  const cw = W - PAD.l - PAD.r, ch = H - PAD.t - PAD.b
  const gx = C.border + '55'
  const BLc = '#A78BFA', PEc = '#7EA6FF', GRc = '#93C5FD'
  const series = d.series
  const dn = (m) => { const y = +m.slice(0, 4), mo = +m.slice(5, 7); return y + (mo - 1) / 12 }
  const dmin = dn(series[0].date), dmax = dn(series[series.length - 1].date)
  const xD = (m) => PAD.l + ((dn(m) - dmin) / ((dmax - dmin) || 1)) * cw
  const num = { fontSize: 11, fill: C.t3 }
  const lgd = (color, label, dash) => <span><span style={{ color, letterSpacing: dash ? -1 : 0 }}>{dash === 'bar' ? '▮' : dash === 'dash' ? '--' : '—'}</span> {label}</span>
  const axTitle = (x, txt, color, anchor) => <text x={x} y={PAD.t - 9} textAnchor={anchor} fontSize={10} fontWeight={700} fill={color} letterSpacing={0.4}>{txt}</text>
  const pctf = (v) => `${(v * 100).toFixed(0)}%`
  const spyPE = (bench?.benchmarks?.SPY?.pe || []).filter((r) => dn(r.m) >= dmin - 0.1 && dn(r.m) <= dmax + 0.1)
  const spyPS = (bench?.benchmarks?.SPY?.ps || []).filter((r) => dn(r.m) >= dmin - 0.1 && dn(r.m) <= dmax + 0.1)
  const yr = []
  { const seen = new Set(); series.forEach((r) => { const y = r.date.slice(0, 4); if (!seen.has(y) && (+y % 2 === 0)) { seen.add(y); yr.push({ x: xD(r.date), y }) } }) }
  const yearAxis = yr.map((l, i) => <text key={i} x={l.x} y={H - 12} textAnchor="middle" {...num}>{l.y}</text>)
  const line = (pts, xf, yf) => pts.map((a, i) => `${i ? 'L' : 'M'}${xf(a).toFixed(1)},${yf(a).toFixed(1)}`).join(' ')

  // ---- valuation panel: blended multiple + avg + live + S&P 500 overlay ----
  const MulPanel = ({ title, k, live, spy, unit = '×' }) => {
    const bl = series.filter((r) => r[k] != null && r[k] > 0)
    const blV = bl.map((r) => r[k])
    if (!blV.length) return null
    const avg = blV.reduce((s, v) => s + v, 0) / blV.length
    const spyV = (spy || []).map((r) => r.v)
    // clamp the S&P line's influence on the axis so a crisis-year P/E spike
    // (e.g. 2009 ~120×) doesn't compress the normal 15–35× range
    const spySorted = [...spyV].sort((a, b) => a - b)
    const spyCap = spySorted.length ? spySorted[Math.floor(spySorted.length * 0.92)] : 0
    const hi = Math.max(...blV, avg, live || 0, spyCap) * 1.12
    const tk = ticks(0, hi, 5), top = Math.max(hi, tk[tk.length - 1])
    const y = (v) => PAD.t + ch - (Math.min(v, top) / (top || 1)) * ch
    return (
      <Chart title={title} W={W} H={H} C={C}
        legend={<>{lgd(BLc, `Portfolio ${fmt1(live)}${unit}`)}{lgd(C.t1, `avg ${fmt1(avg)}${unit}`)}{spyV.length ? lgd(C.accent, `S&P 500 ${fmt1(spyV[spyV.length - 1])}${unit}`) : null}</>}>
        {tk.map((v) => <g key={v}><line x1={PAD.l} y1={y(v)} x2={W - PAD.r} y2={y(v)} stroke={gx} strokeWidth={0.6} /><text x={PAD.l - 7} y={y(v) + 3.5} textAnchor="end" {...num}>{v.toFixed(0)}{unit}</text></g>)}
        {axTitle(PAD.l - 7, title.toUpperCase().split(' ')[0], BLc, 'end')}{yearAxis}
        <line x1={PAD.l} y1={y(avg)} x2={W - PAD.r} y2={y(avg)} stroke={C.t1} strokeWidth={1.3} />
        <text x={PAD.l + 3} y={y(avg) - 4} fontSize={10} fontWeight={700} fill={C.t1}>avg {fmt1(avg)}{unit}</text>
        {spyV.length > 1 && <path d={line(spy, (r) => xD(r.m), (r) => y(r.v))} fill="none" stroke={C.accent} strokeWidth={1.7} opacity={0.85} />}
        <path d={line(bl, (r) => xD(r.date), (r) => y(r[k]))} fill="none" stroke={BLc} strokeWidth={2.4} />
        {live != null && <><line x1={PAD.l} y1={y(live)} x2={W - PAD.r} y2={y(live)} stroke={PEc} strokeWidth={1.3} strokeDasharray="5,4" /><text x={W - PAD.r - 3} y={y(live) - 4} textAnchor="end" fontSize={10} fontWeight={700} fill={PEc}>live {fmt1(live)}{unit}</text></>}
      </Chart>
    )
  }

  // ---- margins panel ----
  const gmP = series.filter((r) => r.gm != null), omP = series.filter((r) => r.om != null), nmP = series.filter((r) => r.nm != null)
  const mAll = gmP.map((r) => r.gm).concat(omP.map((r) => r.om), nmP.map((r) => r.nm))
  const mHi = Math.max(0.1, ...(mAll.length ? mAll : [0.1])) * 1.1, mLo = Math.min(0, ...(mAll.length ? mAll : [0]))
  const mTk = ticks(mLo, mHi, 5), mT = Math.max(mHi, mTk[mTk.length - 1]), mB = Math.min(mLo, mTk[0])
  const yM = (v) => PAD.t + ch - ((v - mB) / ((mT - mB) || 1)) * ch

  // ---- growth panel ----
  const rg = series.filter((r) => r.revYoY != null), eg = series.filter((r) => r.epsYoY != null)
  const cG = (v) => Math.max(-0.6, Math.min(1, v))
  const gAll = rg.map((r) => cG(r.revYoY)).concat(eg.map((r) => cG(r.epsYoY)))
  const gHi = Math.max(0.1, ...(gAll.length ? gAll : [0.1])), gLo = Math.min(0, ...(gAll.length ? gAll : [0]))
  const gTk = ticks(gLo, gHi, 5), gT = Math.max(gHi, gTk[gTk.length - 1]), gB = Math.min(gLo, gTk[0])
  const yG = (v) => PAD.t + ch - ((cG(v) - gB) / ((gT - gB) || 1)) * ch
  const gy0 = yG(0), gbw = Math.max(2, Math.min(16, (cw / Math.max(1, rg.length)) * 0.6))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 18, fontWeight: 800, color: C.t1 }}>{sleeveName || sleeveKey} — blended fundamentals</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: C.t3 }}>{d.covered}/{d.holdings} holdings · {Math.round((d.coverage || 0) * 100)}% by weight</span>
      </div>
      <div style={{ fontSize: 11.5, color: C.t4, marginBottom: 12 }}>Market-weighted across the sleeve's holdings vs. the S&P 500. Multiples are weighted harmonic means; margins and growth are weighted averages.</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
        <MulPanel title="P/E vs S&P 500" k="pe" live={d.live?.pe} spy={spyPE} />
        <MulPanel title="P/S vs S&P 500" k="ps" live={d.live?.ps} spy={spyPS} />

        <Chart title="Margins (blended, TTM)" W={W} H={H} C={C}
          legend={<>{gmP.length ? lgd(GRc, 'Gross') : null}{omP.length ? lgd(PEc, 'Operating') : null}{nmP.length ? lgd(C.up, 'Net') : null}</>}>
          {mTk.map((v) => <g key={v}><line x1={PAD.l} y1={yM(v)} x2={W - PAD.r} y2={yM(v)} stroke={gx} strokeWidth={0.6} /><text x={PAD.l - 7} y={yM(v) + 3.5} textAnchor="end" {...num}>{pctf(v)}</text></g>)}
          {axTitle(PAD.l - 7, 'MARGIN', C.up, 'end')}{yearAxis}
          {gmP.length > 1 && <path d={line(gmP, (r) => xD(r.date), (r) => yM(r.gm))} fill="none" stroke={GRc} strokeWidth={1.6} />}
          {omP.length > 1 && <path d={line(omP, (r) => xD(r.date), (r) => yM(r.om))} fill="none" stroke={PEc} strokeWidth={1.6} />}
          {nmP.length > 1 && <path d={line(nmP, (r) => xD(r.date), (r) => yM(r.nm))} fill="none" stroke={C.up} strokeWidth={2.4} />}
        </Chart>

        <Chart title="Growth (blended, YoY)" W={W} H={H} C={C}
          legend={<>{lgd(BLc, 'Revenue YoY', 'bar')}{eg.length ? lgd(C.up, 'EPS YoY') : null}</>}>
          {gTk.map((v) => <g key={v}><line x1={PAD.l} y1={yG(v)} x2={W - PAD.r} y2={yG(v)} stroke={Math.abs(v) < 1e-6 ? C.border : gx} strokeWidth={Math.abs(v) < 1e-6 ? 0.9 : 0.6} /><text x={PAD.l - 7} y={yG(v) + 3.5} textAnchor="end" {...num}>{pctf(v)}</text></g>)}
          {axTitle(PAD.l - 7, 'YoY', BLc, 'end')}{yearAxis}
          {rg.map((r) => { const x = xD(r.date), yv = yG(r.revYoY), top = Math.min(gy0, yv); return <rect key={r.date} x={x - gbw / 2} y={top} width={gbw} height={Math.max(1, Math.abs(yv - gy0))} fill={BLc} opacity={1} /> })}
          {eg.length > 1 && <path d={line(eg, (r) => xD(r.date), (r) => yG(r.epsYoY))} fill="none" stroke={C.up} strokeWidth={2.2} />}
        </Chart>

        <MulPanel title="P/FCF" k="pfcf" live={d.live?.pfcf} spy={null} />
      </div>
    </div>
  )
}


// S&P 500 (SPY) as an index "stock": price + trailing EPS + avg/live P/E.
// Data from multpl.com (public/benchmark-fundamentals.json); no EDGAR statements.
const INDEX_SYMS = { SPY: 'S&P 500' }

function IndexFundamentals({ data, symbol, name, livePrice, C, isDesktop }) {
  const W = isDesktop ? 720 : 372, H = isDesktop ? 340 : 300
  const PAD = { t: 24, r: isDesktop ? 92 : 72, b: 40, l: 62 }
  const cw = W - PAD.l - PAD.r, ch = H - PAD.t - PAD.b
  const gx = C.border + '55', PEc = '#7EA6FF'
  const epsByM = Object.fromEntries((data.eps || []).map((e) => [e.m, e.v]))
  const pts = (data.price || []).map((p) => ({ m: p.m, c: p.c, e: epsByM[p.m] })).filter((r) => r.e != null && r.e > 0).slice(-204) // ~17y
  if (pts.length < 8) return null
  const curEps = pts[pts.length - 1].e
  const curPrice = livePrice || pts[pts.length - 1].c
  const livePe = curEps ? curPrice / curEps : data.live?.pe
  const avgPe = data.live?.avgPe
  const dn = (m) => +m.slice(0, 4) + (+m.slice(5, 7) - 1) / 12
  const dmin = dn(pts[0].m), dmax = dn(pts[pts.length - 1].m)
  const xD = (m) => PAD.l + ((dn(m) - dmin) / ((dmax - dmin) || 1)) * cw
  const num = { fontSize: 11, fill: C.t3 }
  const money0 = (v) => v >= 1000 ? '$' + (v / 1000).toFixed(1) + 'k' : '$' + v.toFixed(0)
  const axTitle = (x, txt, color, anchor) => <text x={x} y={PAD.t - 9} textAnchor={anchor} fontSize={10} fontWeight={700} fill={color} letterSpacing={0.4}>{txt}</text>
  const lgd = (color, label, dash) => <span><span style={{ color, letterSpacing: dash ? -1 : 0 }}>{dash === 'dash' ? '--' : '—'}</span> {label}</span>
  // Price = hero (left axis, area + line). EPS = secondary line (inner-right $). P/E = far-right ×.
  const pxHi = Math.max(...pts.map((r) => r.c), curPrice) * 1.08, pxTk = ticks(0, pxHi, 5), pxTop = Math.max(pxHi, pxTk[pxTk.length - 1])
  const yPx = (v) => PAD.t + ch - (v / (pxTop || 1)) * ch
  const epsHi = Math.max(...pts.map((r) => r.e)) * 1.12, eTk = ticks(0, epsHi, 5), eTop = Math.max(epsHi, eTk[eTk.length - 1])
  const yEps = (v) => PAD.t + ch - (v / (eTop || 1)) * ch
  const peTop0 = Math.max(avgPe || 0, livePe || 0, 1) * 1.28, peTk = ticks(0, peTop0, 4), peTop = Math.max(peTop0, peTk[peTk.length - 1])
  const yPe = (v) => PAD.t + ch - (Math.min(v, peTop) / (peTop || 1)) * ch
  const pxPath = pts.map((r, i) => `${i ? 'L' : 'M'}${xD(r.m).toFixed(1)},${yPx(r.c).toFixed(1)}`).join(' ')
  const epsPath = pts.map((r, i) => `${i ? 'L' : 'M'}${xD(r.m).toFixed(1)},${yEps(r.e).toFixed(1)}`).join(' ')
  const rightX = xD(pts[pts.length - 1].m)
  const yr = []
  { const seen = new Set(); pts.forEach((r) => { const y = r.m.slice(0, 4); if (!seen.has(y) && (+y % 2 === 0)) { seen.add(y); yr.push({ x: xD(r.m), y }) } }) }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 19, fontWeight: 800, color: C.t1 }}>{symbol}</span>
        <span style={{ fontSize: 13, color: C.t3 }}>{INDEX_SYMS[symbol] || name}</span>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: C.t3, fontVariantNumeric: 'tabular-nums' }}>
          <b style={{ color: C.t1 }}>{money(curPrice)}</b>&nbsp; P/E <b style={{ color: C.t1 }}>{fmt1(livePe)}</b> &nbsp; avg <b style={{ color: C.t1 }}>{fmt1(avgPe)}</b>
        </span>
      </div>
      <Chart title="Price · EPS · P/E" W={W} H={H} C={C}
        legend={<>{lgd(C.accent, 'Price')}{lgd(C.up, 'EPS ttm')}{avgPe != null ? lgd(C.t1, `avg P/E ${fmt1(avgPe)}×`) : null}{livePe != null ? lgd(PEc, `live ${fmt1(livePe)}×`, 'dash') : null}</>}>
        <defs><linearGradient id="ix-px" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.accent} stopOpacity="0.20" /><stop offset="100%" stopColor={C.accent} stopOpacity="0" /></linearGradient></defs>
        {pxTk.map((v) => <g key={v}><line x1={PAD.l} y1={yPx(v)} x2={W - PAD.r} y2={yPx(v)} stroke={gx} strokeWidth={0.6} /><text x={PAD.l - 7} y={yPx(v) + 3.5} textAnchor="end" {...num}>{money0(v)}</text></g>)}
        {eTk.map((v) => <text key={v} x={W - PAD.r + 7} y={yEps(v) + 3.5} {...num} fill={C.up}>${v.toFixed(v < 10 ? 1 : 0)}</text>)}
        {peTk.map((v) => <text key={v} x={W - 5} y={yPe(v) + 3.5} textAnchor="end" {...num} fill={PEc}>{v.toFixed(0)}×</text>)}
        {axTitle(PAD.l - 7, 'PRICE', C.accent, 'end')}{axTitle(W - PAD.r + 7, 'EPS', C.up, 'start')}{axTitle(W - 5, 'P/E', PEc, 'end')}
        {yr.map((l, i) => <text key={i} x={l.x} y={H - 12} textAnchor="middle" {...num}>{l.y}</text>)}
        <path d={`${pxPath} L${rightX.toFixed(1)},${PAD.t + ch} L${PAD.l},${PAD.t + ch} Z`} fill="url(#ix-px)" />
        {avgPe != null && <><line x1={PAD.l} y1={yPe(avgPe)} x2={W - PAD.r} y2={yPe(avgPe)} stroke={C.t1} strokeWidth={1.4} /><text x={PAD.l + 3} y={yPe(avgPe) - 4} fontSize={10} fontWeight={700} fill={C.t1}>avg {fmt1(avgPe)}×</text></>}
        {livePe != null && <><line x1={PAD.l} y1={yPe(livePe)} x2={W - PAD.r} y2={yPe(livePe)} stroke={PEc} strokeWidth={1.3} strokeDasharray="5,4" /><text x={W - PAD.r - 3} y={yPe(livePe) - 4} textAnchor="end" fontSize={10} fontWeight={700} fill={PEc}>live {fmt1(livePe)}×</text></>}
        <path d={epsPath} fill="none" stroke={C.up} strokeWidth={1.6} opacity={0.85} />
        <path d={pxPath} fill="none" stroke={C.accent} strokeWidth={2.4} />
      </Chart>
      <div style={{ fontSize: 11, color: C.t4, marginTop: 8 }}>S&P 500 (SPY-scaled) price &amp; trailing EPS from multpl.com. P/E {fmt1(livePe)}× vs {fmt1(avgPe)}× long-run average.</div>
    </div>
  )
}

function Chart({ title, right, W, H, C, children, legend }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '15px 16px 11px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 1.3 }}>{title}</div>
        {right ? <div style={{ marginLeft: 'auto', fontSize: 12, color: C.t2, fontVariantNumeric: 'tabular-nums' }}>{right}</div> : null}
      </div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', fontVariantNumeric: 'tabular-nums' }} fontFamily="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif">{children}</svg>
      {legend ? <div style={{ display: 'flex', gap: 18, fontSize: 11, color: C.t3, marginTop: 9, flexWrap: 'wrap', fontWeight: 500 }}>{legend}</div> : null}
    </div>
  )
}

function FundamentalsDetail({ f, px, name, basis, C, isDesktop }) {
  const W = isDesktop ? 720 : 372, H = isDesktop ? 300 : 262
  const PAD = { t: 24, r: isDesktop ? 96 : 74, b: 40, l: 62 }
  const cw = W - PAD.l - PAD.r, ch = H - PAD.t - PAD.b
  const price = f.price || []
  const q = (f.quarterly && f.quarterly.length ? f.quarterly : (f.annual || []))
  const lpe = livePE(f, px, basis)
  const lpfcf = (px && f.ttm?.fcfps > 0) ? px / f.ttm.fcfps : null
  const liveTtmPe = (px && f.ttm?.eps > 0) ? px / f.ttm.eps : null
  const livePs = (px && f.ttm?.revps > 0) ? px / f.ttm.revps : null
  const gx = C.border + '55'
  const REVc = '#A78BFA', PEc = '#7EA6FF', SHc = '#5EEAD4', GRc = '#93C5FD'

  if (price.length < 2 || !q.some((a) => a.eps != null)) {
    return (
      <div style={{ padding: 6 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.t1, marginBottom: 4 }}>{f.ticker} <span style={{ fontSize: 12, fontWeight: 400, color: C.t3 }}>{name}</span></div>
        <div style={{ fontSize: 12.5, color: C.t3 }}>Live P/E {fmt1(lpe)} · P/FCF {fmt1(lpfcf)}. Not enough statement history to chart this name.</div>
      </div>
    )
  }

  const xAt = (i, n) => PAD.l + (n > 1 ? (i / (n - 1)) * cw : cw / 2)
  const mIdx = (ym) => { const i = price.findIndex((p) => p.m >= ym); return i < 0 ? price.length - 1 : i }
  const xT = (iso) => xAt(mIdx(iso.slice(0, 7)), price.length)
  const rightX = xAt(price.length - 1, price.length)
  const yrLabels = []
  { const seen = new Set(); price.forEach((p, i) => { const y = p.m.slice(0, 4); if (!seen.has(y) && i % Math.ceil(price.length / 7) === 0) { seen.add(y); yrLabels.push({ x: xAt(i, price.length), y }) } }) }
  const num = { fontSize: 11, fill: C.t3 }
  const lgd = (color, label, dash) => <span><span style={{ color, letterSpacing: dash ? -1 : 0 }}>{dash === 'bar' ? '▮' : dash === 'dash' ? '--' : dash === 'diamond' ? '◇' : '—'}</span> {label}</span>
  const axTitle = (x, txt, color, anchor) => <text x={x} y={PAD.t - 9} textAnchor={anchor} fontSize={10} fontWeight={700} fill={color} letterSpacing={0.4}>{txt}</text>
  const yearAxis = yrLabels.map((l, i) => <text key={i} x={l.x} y={H - 12} textAnchor="middle" {...num}>{l.y}</text>)
  const barW = (n) => Math.max(1.5, Math.min(26, (cw / Math.max(1, n)) * 0.82))
  const pct = (v) => `${(v * 100).toFixed(0)}%`
  const shFmt = (v) => v >= 1e9 ? `${(v / 1e9).toFixed(2)}B` : `${(v / 1e6).toFixed(0)}M`
  const linePath = (pts, x, y) => pts.map((a, i) => `${i ? 'L' : 'M'}${x(a).toFixed(1)},${y(a).toFixed(1)}`).join(' ')
  const $ax = (v) => v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v.toFixed(0)

  // Price axis (inner-right, gold) shared by the valuation panels
  const pxs = price.map((p) => p.c)
  const pxLo = Math.min(...pxs), pxHi = Math.max(...pxs)
  const pxTk = ticks(pxLo, pxHi, 5)
  const pT2 = Math.min(pxLo, pxTk[0]), pB2 = Math.max(pxHi, pxTk[pxTk.length - 1])
  const yPx = (v) => PAD.t + ch - ((v - pT2) / ((pB2 - pT2) || 1)) * ch
  const pxLine = price.map((p, i) => `${i ? 'L' : 'M'}${xAt(i, price.length).toFixed(1)},${yPx(p.c).toFixed(1)}`).join(' ')
  // far-right multiple axis: avg + live horizontal lines.
  // Both labels sit on the LEFT, side by side. The live label used to be anchored to
  // the right edge, which is where the endpoint pills land — so on most charts the
  // pill covered it. Offsetting it past the avg label keeps both readable whatever
  // the two values are, since they share a row only when the lines nearly coincide.
  const mulAxis = (avg, live) => {
    const hi = (Math.max(avg || 0, live || 0, 1)) * 1.28
    const tk = ticks(0, hi, 4)
    const top = Math.max(hi, tk[tk.length - 1])
    return { tk, y: (v) => PAD.t + ch - (Math.min(v, top) / (top || 1)) * ch }
  }
  const avgMulLine = (m, avg) => avg != null ? <g><line x1={PAD.l} y1={m.y(avg)} x2={W - PAD.r} y2={m.y(avg)} stroke={C.t1} strokeWidth={1.5} /><text x={PAD.l + 3} y={m.y(avg) - 4} fontSize={10} fontWeight={700} fill={C.t1} stroke={C.card} strokeWidth={3} paintOrder="stroke">avg {fmt1(avg)}×</text></g> : null
  const liveMulLine = (m, live) => live != null ? <g><line x1={PAD.l} y1={m.y(live)} x2={W - PAD.r} y2={m.y(live)} stroke={PEc} strokeWidth={1.4} strokeDasharray="5,4" /><text x={PAD.l + 78} y={m.y(live) - 4} fontSize={10} fontWeight={700} fill={PEc} stroke={C.card} strokeWidth={3} paintOrder="stroke">live {fmt1(live)}×</text></g> : null
  const mulTicks = (m) => m.tk.map((v) => <text key={v} x={W - 5} y={m.y(v) + 3.5} textAnchor="end" {...num} fill={PEc}>{v.toFixed(0)}×</text>)

  // ===== Panel 1: EPS + Price + P/E =====
  const qe = q.filter((a) => a.eps != null)
  const ttmPts = []
  for (let i = 3; i < qe.length; i++) ttmPts.push({ date: qe[i].date, eps: qe[i].eps + qe[i - 1].eps + qe[i - 2].eps + qe[i - 3].eps })
  const fwdEps = f.fwd?.eps
  const epsAll = ttmPts.map((a) => a.eps).concat(fwdEps != null ? [fwdEps] : [])
  const epsLo = Math.min(0, ...epsAll), epsHi = (epsAll.length ? Math.max(...epsAll) : 1) * 1.12
  const epsTk = ticks(epsLo, epsHi, 5)
  const eT = Math.min(epsLo, epsTk[0]), eB = Math.max(epsHi, epsTk[epsTk.length - 1])
  const yEps = (v) => PAD.t + ch - ((v - eT) / ((eB - eT) || 1)) * ch
  const epsX = ttmPts.map((a) => xT(a.date))
  const epsLine = ttmPts.map((a, i) => `${i ? 'L' : 'M'}${epsX[i].toFixed(1)},${yEps(a.eps).toFixed(1)}`).join(' ')
  const lastEps = ttmPts[ttmPts.length - 1]
  const peV = q.map((a) => a.pe).filter((v) => v != null && v > 0)
  const peSorted = [...peV].sort((a, b) => a - b)
  const peMed = peSorted.length ? peSorted[Math.floor(peSorted.length / 2)] : null
  const clampPe = (v) => Math.min(v, peMed != null ? peMed * 3 : Infinity)
  const avgPe = peV.length ? peV.reduce((s, v) => s + clampPe(v), 0) / peV.length : null
  const peM = mulAxis(avgPe, liveTtmPe)

  // ===== Panel 2: Revenue + Price + P/S =====
  const revPts = q.filter((a) => a.rev != null && a.rev > 0)
  const revHi = (revPts.length ? Math.max(...revPts.map((a) => a.rev)) : 1) * 1.14
  const revTk = ticks(0, revHi, 5)
  const revTop = Math.max(revHi, revTk[revTk.length - 1])
  const yRev = (v) => PAD.t + ch - (v / (revTop || 1)) * ch
  const rbw = barW(revPts.length)
  const psV = q.map((a) => a.ps).filter((v) => v != null && v > 0)
  const psSorted = [...psV].sort((a, b) => a - b)
  const psMed = psSorted.length ? psSorted[Math.floor(psSorted.length / 2)] : null
  const avgPs = psV.length ? psV.reduce((s, v) => s + Math.min(v, psMed != null ? psMed * 3 : Infinity), 0) / psV.length : null
  const psM = mulAxis(avgPs, livePs)

  // ===== Panel 3: Growth (YoY) =====
  const revYoY = []
  for (let i = 4; i < revPts.length; i++) { const p = revPts[i - 4].rev; if (p > 0) revYoY.push({ date: revPts[i].date, g: (revPts[i].rev - p) / p }) }
  const epsYoY = []
  for (let i = 4; i < ttmPts.length; i++) { const p = ttmPts[i - 4].eps; if (Math.abs(p) > 0.05) epsYoY.push({ date: ttmPts[i].date, g: (ttmPts[i].eps - p) / Math.abs(p) }) }
  const clampG = (v) => Math.max(-1, Math.min(2, v))
  const gAll = revYoY.map((a) => clampG(a.g)).concat(epsYoY.map((a) => clampG(a.g)))
  const gLo = Math.min(0, ...(gAll.length ? gAll : [0])), gHi = Math.max(0.1, ...(gAll.length ? gAll : [0.1]))
  const gTk = ticks(gLo, gHi, 5)
  const gT = Math.max(gHi, gTk[gTk.length - 1]), gB = Math.min(gLo, gTk[0])
  const yG = (v) => PAD.t + ch - ((clampG(v) - gB) / ((gT - gB) || 1)) * ch
  const gy0 = yG(0), gbw = barW(revYoY.length)

  // ===== Panel 4: Margins (TTM) =====
  const gmPts = q.filter((a) => a.gm != null), omPts = q.filter((a) => a.om != null), nmPts = q.filter((a) => a.nm != null)
  const mAll = gmPts.map((a) => a.gm).concat(omPts.map((a) => a.om), nmPts.map((a) => a.nm))
  const mLo = Math.min(0, ...(mAll.length ? mAll : [0])), mHi = Math.max(0.1, ...(mAll.length ? mAll : [0.1])) * 1.1
  const mTk = ticks(mLo, mHi, 5)
  const mT = Math.max(mHi, mTk[mTk.length - 1]), mB = Math.min(mLo, mTk[0])
  const yM = (v) => PAD.t + ch - ((v - mB) / ((mT - mB) || 1)) * ch

  // ===== Panel 5: FCF + Price + P/FCF =====
  const fcfPts = q.filter((a) => a.fcf != null)
  const fcfVals = fcfPts.map((a) => a.fcf)
  const fMax = (Math.max(0, ...fcfVals) * 1.14) || 1
  const fMin = Math.min(0, ...fcfVals) * 1.14
  const fcfTk = ticks(fMin, fMax, 5)
  const fT = Math.max(fMax, fcfTk[fcfTk.length - 1]), fB = Math.min(fMin, fcfTk[0])
  const yFcf = (v) => PAD.t + ch - ((v - fB) / ((fT - fB) || 1)) * ch
  const y0 = yFcf(0), fbw = barW(fcfPts.length)
  const pfPos = q.map((a) => a.pfcf).filter((v) => v != null && v > 0)
  const pfSorted = [...pfPos].sort((a, b) => a - b)
  const pfMed = pfSorted.length ? pfSorted[Math.floor(pfSorted.length / 2)] : null
  const avgPfcf = pfPos.length ? pfPos.reduce((s, v) => s + Math.min(v, pfMed != null ? pfMed * 3 : Infinity), 0) / pfPos.length : null
  const pfM = mulAxis(avgPfcf, lpfcf)

  // ===== Panel 6: Shares outstanding =====
  const shPts = q.filter((a) => a.sh != null && a.sh > 0)
  const shVals = shPts.map((a) => a.sh)
  const shLo = shVals.length ? Math.min(...shVals) * 0.94 : 0, shHi = shVals.length ? Math.max(...shVals) * 1.06 : 1
  const shTk = ticks(shLo, shHi, 5)
  const shT = Math.max(shHi, shTk[shTk.length - 1]), shB = Math.min(shLo, shTk[0])
  const yS = (v) => PAD.t + ch - ((v - shB) / ((shT - shB) || 1)) * ch

  const priceAxis = pxTk.map((v) => <text key={v} x={W - PAD.r + 7} y={yPx(v) + 3.5} {...num} fill={C.accent}>${$ax(v)}</text>)
  const grid = (yfn, tk, fmt) => tk.map((v) => <g key={v}><line x1={PAD.l} y1={yfn(v)} x2={W - PAD.r} y2={yfn(v)} stroke={gx} strokeWidth={0.6} /><text x={PAD.l - 7} y={yfn(v) + 3.5} textAnchor="end" {...num}>{fmt(v)}</text></g>)
  // Faint verticals at each year label, the way fiscal.ai rules its plots. Drawn
  // first so every mark sits on top of them.
  // gx is the horizontal-rule tint and is far too faint to read as a vertical at this
  // height, so verticals get the undiluted border colour.
  const vGrid = yrLabels.map((l, i) => <line key={`v${i}`} x1={l.x} y1={PAD.t} x2={l.x} y2={PAD.t + ch} stroke={C.border} strokeWidth={0.8} />)
  // Last-value callout: a filled chip pinned to the series' final point. With 80
  // quarters on screen we can't label every point the way their 20-point charts
  // do, so the endpoint — the number you actually came to read — carries the label.
  const pill = (key, x, y, label, color, fg = '#0B0E14') => {
    // Keep the chip inside the plot. The previous clamp pinned the chip's *centre* to
    // the plot edge, so half its width still hung over the price-axis numbers — which
    // is exactly where a series endpoint lands, so it happened on nearly every chart.
    // Clamp the edges instead.
    const w = label.length * 6.1 + 10
    const cx = Math.max(PAD.l + 2, Math.min(x - w / 2, W - PAD.r - w - 2))
    const cy = Math.max(PAD.t + 7, Math.min(PAD.t + ch - 7, y))
    return (
      <g key={key}>
        <rect x={cx} y={cy - 8} width={w} height={16} rx={4} fill={color} />
        <text x={cx + w / 2} y={cy + 4} textAnchor="middle" fontSize={10.5} fontWeight={700} fill={fg}>{label}</text>
      </g>
    )
  }
  // Total change + CAGR, the way their legends read.
  const growth = (first, last, years) => {
    if (!(first > 0) || !(last > 0) || !(years > 0)) return ''
    const tot = ((last - first) / first) * 100
    const cagr = (Math.pow(last / first, 1 / years) - 1) * 100
    return ` (${tot >= 0 ? '+' : ''}${tot.toFixed(0)}% · CAGR ${cagr >= 0 ? '+' : ''}${cagr.toFixed(1)}%)`
  }
  const spanYrs = (rows) => rows.length > 1 ? (new Date(rows[rows.length - 1].date) - new Date(rows[0].date)) / 31557600000 : 0
  const pxYrs = price.length > 1 ? (new Date(price[price.length - 1].m + '-01') - new Date(price[0].m + '-01')) / 31557600000 : 0
  const pxGrowth = growth(price[0]?.c, price[price.length - 1]?.c, pxYrs)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 19, fontWeight: 800, color: C.t1, letterSpacing: -0.2 }}>{f.ticker}</span>
        <span style={{ fontSize: 13, color: C.t3 }}>{name}</span>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: C.t3, fontVariantNumeric: 'tabular-nums' }}>
          <b style={{ color: C.t1 }}>{money(px)}</b>&nbsp; P/E {basis.toUpperCase()} <b style={{ color: C.t1 }}>{fmt1(lpe)}</b> &nbsp; P/FCF <b style={{ color: C.t1 }}>{fmt1(lpfcf)}</b>
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
        <Chart title="Price · EPS (TTM) · P/E" W={W} H={H} C={C}
          legend={<>{lgd(C.accent, `Price${pxGrowth}`)}{lgd(C.up, `EPS ttm${growth(ttmPts[0]?.eps, ttmPts[ttmPts.length - 1]?.eps, spanYrs(ttmPts))}`)}{fwdEps != null ? lgd(C.up, 'fwd', 'diamond') : null}{avgPe != null ? lgd(C.t1, `avg P/E ${fmt1(avgPe)}×`) : null}{liveTtmPe != null ? lgd(PEc, `live ${fmt1(liveTtmPe)}×`, 'dash') : null}</>}>
          <defs><linearGradient id={`px-${f.ticker}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.accent} stopOpacity="0.14" /><stop offset="100%" stopColor={C.accent} stopOpacity="0" /></linearGradient></defs>
          {vGrid}{grid(yEps, epsTk, (v) => `$${v.toFixed(v < 10 ? 1 : 0)}`)}
          {priceAxis}{mulTicks(peM)}
          {axTitle(PAD.l - 7, 'EPS', C.up, 'end')}{axTitle(W - PAD.r + 7, 'PRICE', C.accent, 'start')}{axTitle(W - 5, 'P/E', PEc, 'end')}{yearAxis}
          <path d={`${pxLine} L${rightX.toFixed(1)},${PAD.t + ch} L${PAD.l},${PAD.t + ch} Z`} fill={`url(#px-${f.ticker})`} />
          {avgMulLine(peM, avgPe)}{liveMulLine(peM, liveTtmPe)}
          <path d={pxLine} fill="none" stroke={C.accent} strokeWidth={1.7} />
          <path d={epsLine} fill="none" stroke={C.up} strokeWidth={2.2} />
          {pill('p1px', rightX, yPx(pxs[pxs.length - 1]), money(pxs[pxs.length - 1], 0), C.accent)}
          {lastEps && pill('p1eps', epsX[ttmPts.length - 1], yEps(lastEps.eps), money(lastEps.eps, 2), C.up)}
          {fwdEps != null && lastEps && <g><line x1={epsX[ttmPts.length - 1]} y1={yEps(lastEps.eps)} x2={rightX} y2={yEps(fwdEps)} stroke={C.up} strokeWidth={1.3} strokeDasharray="3,3" /><rect x={rightX - 3.6} y={yEps(fwdEps) - 3.6} width={7.2} height={7.2} fill={C.up} transform={`rotate(45 ${rightX} ${yEps(fwdEps)})`} /></g>}
        </Chart>

        <Chart title="Revenue · Price · P/S" W={W} H={H} C={C}
          legend={<>{lgd(REVc, `Revenue${growth(revPts[0]?.rev, revPts[revPts.length - 1]?.rev, spanYrs(revPts))}`, 'bar')}{lgd(C.accent, `Price${pxGrowth}`)}{avgPs != null ? lgd(C.t1, `avg P/S ${fmt1(avgPs)}×`) : null}{livePs != null ? lgd(PEc, `live ${fmt1(livePs)}×`, 'dash') : null}</>}>
          <defs><linearGradient id={`rv-${f.ticker}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={REVc} stopOpacity="1" /><stop offset="100%" stopColor={REVc} stopOpacity="1" /></linearGradient></defs>
          {vGrid}{grid(yRev, revTk, bil)}
          {priceAxis}{mulTicks(psM)}
          {axTitle(PAD.l - 7, 'REV', REVc, 'end')}{axTitle(W - PAD.r + 7, 'PRICE', C.accent, 'start')}{axTitle(W - 5, 'P/S', PEc, 'end')}{yearAxis}
          {revPts.map((a) => { const x = xT(a.date), y = yRev(a.rev); return <rect key={a.date} x={x - rbw / 2} y={y} width={rbw} height={Math.max(1, PAD.t + ch - y)} fill={`url(#rv-${f.ticker})`} /> })}
          {avgMulLine(psM, avgPs)}{liveMulLine(psM, livePs)}
          <path d={pxLine} fill="none" stroke={C.accent} strokeWidth={1.7} />
          {revPts.length ? pill('p2rev', xT(revPts[revPts.length - 1].date), yRev(revPts[revPts.length - 1].rev), bil(revPts[revPts.length - 1].rev), REVc) : null}
        </Chart>

        <Chart title="Growth (YoY)" W={W} H={H} C={C}
          legend={<>{lgd(REVc, 'Revenue YoY', 'bar')}{epsYoY.length ? lgd(C.up, 'EPS ttm YoY') : null}</>}>
          {vGrid}{gTk.map((v) => <g key={v}><line x1={PAD.l} y1={yG(v)} x2={W - PAD.r} y2={yG(v)} stroke={Math.abs(v) < 1e-6 ? C.border : gx} strokeWidth={Math.abs(v) < 1e-6 ? 0.9 : 0.6} /><text x={PAD.l - 7} y={yG(v) + 3.5} textAnchor="end" {...num}>{pct(v)}</text></g>)}
          {axTitle(PAD.l - 7, 'YoY', REVc, 'end')}{yearAxis}
          {revYoY.map((a) => { const x = xT(a.date), yv = yG(a.g), top = Math.min(gy0, yv); return <rect key={a.date} x={x - gbw / 2} y={top} width={gbw} height={Math.max(1, Math.abs(yv - gy0))} fill={REVc} opacity={1} /> })}
          {epsYoY.length > 1 && <path d={linePath(epsYoY, (a) => xT(a.date), (a) => yG(a.g))} fill="none" stroke={C.up} strokeWidth={2} />}
        </Chart>

        <Chart title="Margins (TTM)" W={W} H={H} C={C}
          legend={<>{gmPts.length ? lgd(GRc, 'Gross') : null}{omPts.length ? lgd(PEc, 'Operating') : null}{nmPts.length ? lgd(C.up, 'Net') : null}</>}>
          {vGrid}{mTk.map((v) => <g key={v}><line x1={PAD.l} y1={yM(v)} x2={W - PAD.r} y2={yM(v)} stroke={gx} strokeWidth={0.6} /><text x={PAD.l - 7} y={yM(v) + 3.5} textAnchor="end" {...num}>{pct(v)}</text></g>)}
          {axTitle(PAD.l - 7, 'MARGIN', C.up, 'end')}{yearAxis}
          {gmPts.length > 1 && <path d={linePath(gmPts, (a) => xT(a.date), (a) => yM(a.gm))} fill="none" stroke={GRc} strokeWidth={1.6} />}
          {omPts.length > 1 && <path d={linePath(omPts, (a) => xT(a.date), (a) => yM(a.om))} fill="none" stroke={PEc} strokeWidth={1.6} />}
          {nmPts.length > 1 && <path d={linePath(nmPts, (a) => xT(a.date), (a) => yM(a.nm))} fill="none" stroke={C.up} strokeWidth={2.2} />}
        </Chart>

        <Chart title="Free Cash Flow · Price · P/FCF" W={W} H={H} C={C}
          legend={<>{lgd(C.dn, `Quarterly FCF${growth(fcfPts[0]?.fcf, fcfPts[fcfPts.length - 1]?.fcf, spanYrs(fcfPts))}`, 'bar')}{lgd(C.accent, `Price${pxGrowth}`)}{avgPfcf != null ? lgd(C.t1, `avg P/FCF ${fmt1(avgPfcf)}×`) : null}{lpfcf != null ? lgd(PEc, `live ${fmt1(lpfcf)}×`, 'dash') : null}</>}>
          <defs><linearGradient id={`fg-${f.ticker}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.dn} stopOpacity="1" /><stop offset="100%" stopColor={C.dn} stopOpacity="1" /></linearGradient></defs>
          {vGrid}{fcfTk.map((v) => <g key={v}><line x1={PAD.l} y1={yFcf(v)} x2={W - PAD.r} y2={yFcf(v)} stroke={Math.abs(v) < 1e-6 ? C.border : gx} strokeWidth={Math.abs(v) < 1e-6 ? 0.9 : 0.6} /><text x={PAD.l - 7} y={yFcf(v) + 3.5} textAnchor="end" {...num}>{bil(v)}</text></g>)}
          {priceAxis}{mulTicks(pfM)}
          {axTitle(PAD.l - 7, 'FCF', C.dn, 'end')}{axTitle(W - PAD.r + 7, 'PRICE', C.accent, 'start')}{axTitle(W - 5, 'P/FCF', PEc, 'end')}{yearAxis}
          {fcfPts.map((a) => { const x = xT(a.date), yv = yFcf(a.fcf), top = Math.min(y0, yv); return <rect key={a.date} x={x - fbw / 2} y={top} width={fbw} height={Math.max(1, Math.abs(yv - y0))} fill={`url(#fg-${f.ticker})`} /> })}
          {avgMulLine(pfM, avgPfcf)}{liveMulLine(pfM, lpfcf)}
          <path d={pxLine} fill="none" stroke={C.accent} strokeWidth={1.7} />
          {fcfPts.length ? pill('p5fcf', xT(fcfPts[fcfPts.length - 1].date), yFcf(fcfPts[fcfPts.length - 1].fcf), bil(fcfPts[fcfPts.length - 1].fcf), C.dn) : null}
        </Chart>

        <Chart title="Shares Outstanding (diluted)" W={W} H={H} C={C}
          legend={<>{lgd(SHc, 'Diluted shares')}</>}>
          <defs><linearGradient id={`sh-${f.ticker}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={SHc} stopOpacity="0.18" /><stop offset="100%" stopColor={SHc} stopOpacity="0" /></linearGradient></defs>
          {vGrid}{shTk.map((v) => <g key={v}><line x1={PAD.l} y1={yS(v)} x2={W - PAD.r} y2={yS(v)} stroke={gx} strokeWidth={0.6} /><text x={PAD.l - 7} y={yS(v) + 3.5} textAnchor="end" {...num}>{shFmt(v)}</text></g>)}
          {axTitle(PAD.l - 7, 'SHARES', SHc, 'end')}{yearAxis}
          {shPts.length > 1 && <><path d={`${linePath(shPts, (a) => xT(a.date), (a) => yS(a.sh))} L${xT(shPts[shPts.length - 1].date).toFixed(1)},${PAD.t + ch} L${xT(shPts[0].date).toFixed(1)},${PAD.t + ch} Z`} fill={`url(#sh-${f.ticker})`} /><path d={linePath(shPts, (a) => xT(a.date), (a) => yS(a.sh))} fill="none" stroke={SHc} strokeWidth={2.2} />{pill('p6sh', xT(shPts[shPts.length - 1].date), yS(shPts[shPts.length - 1].sh), shFmt(shPts[shPts.length - 1].sh), SHc)}</>}
        </Chart>
      </div>
    </div>
  )
}
