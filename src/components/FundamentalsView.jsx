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

export default function FundamentalsView({ tickers, quotes, names, fundMap, C, isDesktop, terminal = false }) {
  const [sel, setSel] = useState(null)
  const [basis, setBasis] = useState('fwd') // 'fwd' | 'ttm'
  const R = terminal ? 2 : 12

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
    <div style={{ display: 'inline-flex', border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
      {['fwd', 'ttm'].map((b) => (
        <button key={b} onClick={() => setBasis(b)} style={{
          padding: '4px 12px', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', border: 'none',
          background: basis === b ? C.accentSoft : 'transparent', color: basis === b ? C.accent : C.t4,
        }}>{b.toUpperCase()}</button>
      ))}
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
    </div>
  )
}

// Self-fetching block for the stock overview.
export function StockFundamentals({ symbol, price, name, C, isDesktop }) {
  const [f, setF] = useState(undefined)
  const [basis, setBasis] = useState('fwd')
  useEffect(() => {
    if (!symbol) return
    let cancelled = false
    setF(undefined)
    fetch(`${import.meta.env.BASE_URL}fundamentals/${symbol}.json`)
      .then((r) => (r.ok ? r.json() : null)).then((d) => { if (!cancelled) setF(d) })
      .catch(() => { if (!cancelled) setF(null) })
    return () => { cancelled = true }
  }, [symbol])
  if (f === undefined || f === null) return null
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: isDesktop ? 16 : 12, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, textTransform: 'uppercase', letterSpacing: 1 }}>Fundamentals</div>
        <div style={{ marginLeft: 'auto', display: 'inline-flex', border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
          {['fwd', 'ttm'].map((b) => (
            <button key={b} onClick={() => setBasis(b)} style={{ padding: '3px 10px', fontSize: 10, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', border: 'none', background: basis === b ? C.accentSoft : 'transparent', color: basis === b ? C.accent : C.t4 }}>{b.toUpperCase()}</button>
          ))}
        </div>
      </div>
      <FundamentalsDetail f={f} px={price} name={name || symbol} basis={basis} C={C} isDesktop={isDesktop} />
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
  const barW = (n) => Math.max(1.5, Math.min(22, (cw / Math.max(1, n)) * 0.6))
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
  // far-right multiple axis: avg + live horizontal lines
  const mulAxis = (avg, live) => {
    const hi = (Math.max(avg || 0, live || 0, 1)) * 1.28
    const tk = ticks(0, hi, 4)
    const top = Math.max(hi, tk[tk.length - 1])
    return { tk, y: (v) => PAD.t + ch - (Math.min(v, top) / (top || 1)) * ch }
  }
  const avgMulLine = (m, avg) => avg != null ? <g><line x1={PAD.l} y1={m.y(avg)} x2={W - PAD.r} y2={m.y(avg)} stroke={C.t1} strokeWidth={1.5} /><text x={PAD.l + 3} y={m.y(avg) - 4} fontSize={10} fontWeight={700} fill={C.t1}>avg {fmt1(avg)}×</text></g> : null
  const liveMulLine = (m, live) => live != null ? <g><line x1={PAD.l} y1={m.y(live)} x2={W - PAD.r} y2={m.y(live)} stroke={PEc} strokeWidth={1.4} strokeDasharray="5,4" /><text x={W - PAD.r - 3} y={m.y(live) - 4} textAnchor="end" fontSize={10} fontWeight={700} fill={PEc}>live {fmt1(live)}×</text></g> : null
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
          legend={<>{lgd(C.accent, 'Price')}{lgd(C.up, 'EPS ttm')}{fwdEps != null ? lgd(C.up, 'fwd', 'diamond') : null}{avgPe != null ? lgd(C.t1, `avg P/E ${fmt1(avgPe)}×`) : null}{liveTtmPe != null ? lgd(PEc, `live ${fmt1(liveTtmPe)}×`, 'dash') : null}</>}>
          <defs><linearGradient id={`px-${f.ticker}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.accent} stopOpacity="0.14" /><stop offset="100%" stopColor={C.accent} stopOpacity="0" /></linearGradient></defs>
          {grid(yEps, epsTk, (v) => `$${v.toFixed(v < 10 ? 1 : 0)}`)}
          {priceAxis}{mulTicks(peM)}
          {axTitle(PAD.l - 7, 'EPS', C.up, 'end')}{axTitle(W - PAD.r + 7, 'PRICE', C.accent, 'start')}{axTitle(W - 5, 'P/E', PEc, 'end')}{yearAxis}
          <path d={`${pxLine} L${rightX.toFixed(1)},${PAD.t + ch} L${PAD.l},${PAD.t + ch} Z`} fill={`url(#px-${f.ticker})`} />
          {avgMulLine(peM, avgPe)}{liveMulLine(peM, liveTtmPe)}
          <path d={pxLine} fill="none" stroke={C.accent} strokeWidth={1.7} />
          <path d={epsLine} fill="none" stroke={C.up} strokeWidth={2.2} />
          {fwdEps != null && lastEps && <g><line x1={epsX[ttmPts.length - 1]} y1={yEps(lastEps.eps)} x2={rightX} y2={yEps(fwdEps)} stroke={C.up} strokeWidth={1.3} strokeDasharray="3,3" /><rect x={rightX - 3.6} y={yEps(fwdEps) - 3.6} width={7.2} height={7.2} fill={C.up} transform={`rotate(45 ${rightX} ${yEps(fwdEps)})`} /></g>}
        </Chart>

        <Chart title="Revenue · Price · P/S" W={W} H={H} C={C}
          legend={<>{lgd(REVc, 'Revenue', 'bar')}{lgd(C.accent, 'Price')}{avgPs != null ? lgd(C.t1, `avg P/S ${fmt1(avgPs)}×`) : null}{livePs != null ? lgd(PEc, `live ${fmt1(livePs)}×`, 'dash') : null}</>}>
          <defs><linearGradient id={`rv-${f.ticker}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={REVc} stopOpacity="0.92" /><stop offset="100%" stopColor={REVc} stopOpacity="0.5" /></linearGradient></defs>
          {grid(yRev, revTk, bil)}
          {priceAxis}{mulTicks(psM)}
          {axTitle(PAD.l - 7, 'REV', REVc, 'end')}{axTitle(W - PAD.r + 7, 'PRICE', C.accent, 'start')}{axTitle(W - 5, 'P/S', PEc, 'end')}{yearAxis}
          {revPts.map((a) => { const x = xT(a.date), y = yRev(a.rev); return <rect key={a.date} x={x - rbw / 2} y={y} width={rbw} height={Math.max(1, PAD.t + ch - y)} fill={`url(#rv-${f.ticker})`} rx={1.5} /> })}
          {avgMulLine(psM, avgPs)}{liveMulLine(psM, livePs)}
          <path d={pxLine} fill="none" stroke={C.accent} strokeWidth={1.7} />
        </Chart>

        <Chart title="Growth (YoY)" W={W} H={H} C={C}
          legend={<>{lgd(REVc, 'Revenue YoY', 'bar')}{epsYoY.length ? lgd(C.up, 'EPS ttm YoY') : null}</>}>
          {gTk.map((v) => <g key={v}><line x1={PAD.l} y1={yG(v)} x2={W - PAD.r} y2={yG(v)} stroke={Math.abs(v) < 1e-6 ? C.border : gx} strokeWidth={Math.abs(v) < 1e-6 ? 0.9 : 0.6} /><text x={PAD.l - 7} y={yG(v) + 3.5} textAnchor="end" {...num}>{pct(v)}</text></g>)}
          {axTitle(PAD.l - 7, 'YoY', REVc, 'end')}{yearAxis}
          {revYoY.map((a) => { const x = xT(a.date), yv = yG(a.g), top = Math.min(gy0, yv); return <rect key={a.date} x={x - gbw / 2} y={top} width={gbw} height={Math.max(1, Math.abs(yv - gy0))} fill={REVc} opacity={0.72} rx={1.5} /> })}
          {epsYoY.length > 1 && <path d={linePath(epsYoY, (a) => xT(a.date), (a) => yG(a.g))} fill="none" stroke={C.up} strokeWidth={2} />}
        </Chart>

        <Chart title="Margins (TTM)" W={W} H={H} C={C}
          legend={<>{gmPts.length ? lgd(GRc, 'Gross') : null}{omPts.length ? lgd(PEc, 'Operating') : null}{nmPts.length ? lgd(C.up, 'Net') : null}</>}>
          {mTk.map((v) => <g key={v}><line x1={PAD.l} y1={yM(v)} x2={W - PAD.r} y2={yM(v)} stroke={gx} strokeWidth={0.6} /><text x={PAD.l - 7} y={yM(v) + 3.5} textAnchor="end" {...num}>{pct(v)}</text></g>)}
          {axTitle(PAD.l - 7, 'MARGIN', C.up, 'end')}{yearAxis}
          {gmPts.length > 1 && <path d={linePath(gmPts, (a) => xT(a.date), (a) => yM(a.gm))} fill="none" stroke={GRc} strokeWidth={1.6} />}
          {omPts.length > 1 && <path d={linePath(omPts, (a) => xT(a.date), (a) => yM(a.om))} fill="none" stroke={PEc} strokeWidth={1.6} />}
          {nmPts.length > 1 && <path d={linePath(nmPts, (a) => xT(a.date), (a) => yM(a.nm))} fill="none" stroke={C.up} strokeWidth={2.2} />}
        </Chart>

        <Chart title="Free Cash Flow · Price · P/FCF" W={W} H={H} C={C}
          legend={<>{lgd(C.dn, 'Quarterly FCF', 'bar')}{lgd(C.accent, 'Price')}{avgPfcf != null ? lgd(C.t1, `avg P/FCF ${fmt1(avgPfcf)}×`) : null}{lpfcf != null ? lgd(PEc, `live ${fmt1(lpfcf)}×`, 'dash') : null}</>}>
          <defs><linearGradient id={`fg-${f.ticker}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.dn} stopOpacity="0.9" /><stop offset="100%" stopColor={C.dn} stopOpacity="0.5" /></linearGradient></defs>
          {fcfTk.map((v) => <g key={v}><line x1={PAD.l} y1={yFcf(v)} x2={W - PAD.r} y2={yFcf(v)} stroke={Math.abs(v) < 1e-6 ? C.border : gx} strokeWidth={Math.abs(v) < 1e-6 ? 0.9 : 0.6} /><text x={PAD.l - 7} y={yFcf(v) + 3.5} textAnchor="end" {...num}>{bil(v)}</text></g>)}
          {priceAxis}{mulTicks(pfM)}
          {axTitle(PAD.l - 7, 'FCF', C.dn, 'end')}{axTitle(W - PAD.r + 7, 'PRICE', C.accent, 'start')}{axTitle(W - 5, 'P/FCF', PEc, 'end')}{yearAxis}
          {fcfPts.map((a) => { const x = xT(a.date), yv = yFcf(a.fcf), top = Math.min(y0, yv); return <rect key={a.date} x={x - fbw / 2} y={top} width={fbw} height={Math.max(1, Math.abs(yv - y0))} fill={`url(#fg-${f.ticker})`} rx={1.5} /> })}
          {avgMulLine(pfM, avgPfcf)}{liveMulLine(pfM, lpfcf)}
          <path d={pxLine} fill="none" stroke={C.accent} strokeWidth={1.7} />
        </Chart>

        <Chart title="Shares Outstanding (diluted)" W={W} H={H} C={C}
          legend={<>{lgd(SHc, 'Diluted shares')}</>}>
          <defs><linearGradient id={`sh-${f.ticker}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={SHc} stopOpacity="0.18" /><stop offset="100%" stopColor={SHc} stopOpacity="0" /></linearGradient></defs>
          {shTk.map((v) => <g key={v}><line x1={PAD.l} y1={yS(v)} x2={W - PAD.r} y2={yS(v)} stroke={gx} strokeWidth={0.6} /><text x={PAD.l - 7} y={yS(v) + 3.5} textAnchor="end" {...num}>{shFmt(v)}</text></g>)}
          {axTitle(PAD.l - 7, 'SHARES', SHc, 'end')}{yearAxis}
          {shPts.length > 1 && <><path d={`${linePath(shPts, (a) => xT(a.date), (a) => yS(a.sh))} L${xT(shPts[shPts.length - 1].date).toFixed(1)},${PAD.t + ch} L${xT(shPts[0].date).toFixed(1)},${PAD.t + ch} Z`} fill={`url(#sh-${f.ticker})`} /><path d={linePath(shPts, (a) => xT(a.date), (a) => yS(a.sh))} fill="none" stroke={SHc} strokeWidth={2.2} /></>}
        </Chart>
      </div>
    </div>
  )
}
