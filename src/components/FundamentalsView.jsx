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
            style={{ background: C.bg, padding: isDesktop ? '18px 24px' : '12px 12px calc(12px + env(safe-area-inset-bottom))', width: '100%', maxWidth: 1500, height: '100dvh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4, position: 'sticky', top: 0 }}>
              <button onClick={() => setSel(null)} style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.t2, borderRadius: 8, width: 34, height: 34, fontSize: 17, cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
            </div>
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

function Chart({ title, W, H, C, children, legend }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: C.t4, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{title}</div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} fontFamily="inherit">{children}</svg>
      <div style={{ display: 'flex', gap: 14, fontSize: 10.5, color: C.t3, marginTop: 6, flexWrap: 'wrap' }}>{legend}</div>
    </div>
  )
}

function FundamentalsDetail({ f, px, name, basis, C, isDesktop }) {
  const W = isDesktop ? 760 : 380, H = isDesktop ? 360 : 300
  const PAD = { t: 18, r: 60, b: 30, l: 60 }
  const cw = W - PAD.l - PAD.r, ch = H - PAD.t - PAD.b
  const price = f.price || []
  // Quarterly series drives the charts; fall back to annual for JSONs built
  // before the quarterly field existed (same shape, renders gracefully).
  const q = (f.quarterly && f.quarterly.length ? f.quarterly : (f.annual || []))
  const lpe = livePE(f, px, basis)
  const lpfcf = (px && f.ttm?.fcfps > 0) ? px / f.ttm.fcfps : null
  const gx = C.border + '66'

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
  const rightX = xAt(price.length - 1, price.length)
  const yrLabels = []
  { const seen = new Set(); price.forEach((p, i) => { const y = p.m.slice(0, 4); if (!seen.has(y) && i % Math.ceil(price.length / 7) === 0) { seen.add(y); yrLabels.push({ x: xAt(i, price.length), y }) } }) }

  // ---------- EPS (quarterly) vs Price ----------
  const epsPts = q.filter((a) => a.eps != null)
  const nextQ = f.fwd?.nextQ
  const pxs = price.map((p) => p.c)
  const pxLo = Math.min(...pxs), pxHi = Math.max(...pxs)
  const epsAll = epsPts.map((a) => a.eps).concat(nextQ != null ? [nextQ] : [])
  const epsLo = Math.min(0, ...epsAll), epsHi = Math.max(...epsAll) * 1.12
  const pxTk = ticks(pxLo, pxHi, 5), epsTk = ticks(epsLo, epsHi, 5)
  const pT = Math.min(pxLo, pxTk[0]), pB = Math.max(pxHi, pxTk[pxTk.length - 1])
  const eT = Math.min(epsLo, epsTk[0]), eB = Math.max(epsHi, epsTk[epsTk.length - 1])
  const yPx = (v) => PAD.t + ch - ((v - pT) / ((pB - pT) || 1)) * ch
  const yEps = (v) => PAD.t + ch - ((v - eT) / ((eB - eT) || 1)) * ch
  const pxLine = price.map((p, i) => `${i ? 'L' : 'M'}${xAt(i, price.length).toFixed(1)},${yPx(p.c).toFixed(1)}`).join(' ')
  const pxArea = `${pxLine} L${rightX.toFixed(1)},${PAD.t + ch} L${PAD.l},${PAD.t + ch} Z`
  const epsX = epsPts.map((a) => xAt(mIdx(a.date.slice(0, 7)), price.length))
  const epsLine = epsPts.map((a, i) => `${i ? 'L' : 'M'}${epsX[i].toFixed(1)},${yEps(a.eps).toFixed(1)}`).join(' ')
  const lastEps = epsPts[epsPts.length - 1]

  // ---------- P/E (quarterly, TTM) over time + historical average ----------
  const peC = '#7EA6FF'
  const pePts = q.filter((a) => a.pe != null && a.pe > 0)
  const peV = pePts.map((a) => a.pe)
  const peSorted = [...peV].sort((a, b) => a - b)
  const peMed = peSorted.length ? peSorted[Math.floor(peSorted.length / 2)] : null
  const peCapV = peMed != null ? peMed * 3 : Infinity  // clamp trough-earnings spikes
  const clampPe = (v) => Math.min(v, peCapV)
  const avgPe = peV.length ? peV.reduce((s, v) => s + clampPe(v), 0) / peV.length : null
  const liveTtmPe = (px && f.ttm?.eps > 0) ? px / f.ttm.eps : null
  const peAxis = peV.map(clampPe).concat([avgPe, liveTtmPe].filter((v) => v != null && v > 0))
  const peLo = Math.max(0, (peAxis.length ? Math.min(...peAxis) : 0) * 0.9)
  const peHi = (peAxis.length ? Math.max(...peAxis) : 40) * 1.08
  const peTk = ticks(peLo, peHi, 5)
  const peBot = Math.min(peLo, peTk[0]), peTop = Math.max(peHi, peTk[peTk.length - 1])
  const yPe = (v) => PAD.t + ch - ((clampPe(v) - peBot) / ((peTop - peBot) || 1)) * ch
  const peX = pePts.map((a) => xAt(mIdx(a.date.slice(0, 7)), price.length))
  const peLine = pePts.map((a, i) => `${i ? 'L' : 'M'}${peX[i].toFixed(1)},${yPe(a.pe).toFixed(1)}`).join(' ')

  // ---------- FCF (quarterly) + single average-P/FCF line ----------
  const fcfPts = q.filter((a) => a.fcf != null)
  const fcfVals = fcfPts.map((a) => a.fcf)
  const fMax = (Math.max(0, ...fcfVals) * 1.12) || 1
  const fMin = Math.min(0, ...fcfVals) * 1.12
  const fcfTk = ticks(fMin, fMax, 5)
  const fT = Math.max(fMax, fcfTk[fcfTk.length - 1]), fB = Math.min(fMin, fcfTk[0])
  const yFcf = (v) => PAD.t + ch - ((v - fB) / ((fT - fB) || 1)) * ch
  const y0 = yFcf(0)
  const bw = fcfPts.length ? Math.max(1.5, Math.min(24, (cw / fcfPts.length) * 0.62)) : 12
  const fcfX = (i) => PAD.l + (cw / fcfPts.length) * (i + 0.5)
  // Historical average P/FCF (spike-clamped mean, so trough-earnings quarters
  // that send P/FCF to hundreds× don't drag the average).
  const pfPos = q.map((a) => a.pfcf).filter((v) => v != null && v > 0)
  const pfSorted = [...pfPos].sort((a, b) => a - b)
  const pfMed = pfSorted.length ? pfSorted[Math.floor(pfSorted.length / 2)] : null
  const pfCap = pfMed != null ? pfMed * 3 : Infinity
  const avgPfcf = pfPos.length ? pfPos.reduce((s, v) => s + Math.min(v, pfCap), 0) / pfPos.length : null
  const pfRef = [avgPfcf, lpfcf].filter((v) => v != null && v > 0)
  const pfHi = (pfRef.length ? Math.max(...pfRef, pfMed || 0) : (pfMed || 20)) * 1.4
  const pfTk = ticks(0, pfHi, 4)
  const pfT = Math.max(pfHi, pfTk[pfTk.length - 1] || pfHi)
  const yPf = (v) => PAD.t + ch - (Math.min(v, pfT) / (pfT || 1)) * ch
  const fcfYr = []
  { const seen = new Set(); fcfPts.forEach((a, i) => { const y = a.date.slice(0, 4); if (!seen.has(y) && i % Math.ceil(fcfPts.length / 7) === 0) { seen.add(y); fcfYr.push({ x: fcfX(i), y }) } }) }

  const dot = { fontSize: 10, fontWeight: 700 }
  const axL = { fontSize: 10, fill: C.t4 }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 18, fontWeight: 800, color: C.t1 }}>{f.ticker}</span>
        <span style={{ fontSize: 13, color: C.t3 }}>{name}</span>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: C.t3 }}>
          <b style={{ color: C.t1 }}>{money(px)}</b> · P/E {basis.toUpperCase()} <b style={{ color: C.t1 }}>{fmt1(lpe)}</b> · P/FCF <b style={{ color: C.t1 }}>{fmt1(lpfcf)}</b>
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
        <Chart title="EPS (quarterly) vs Price" W={W} H={H} C={C}
          legend={<><span><span style={{ color: C.accent }}>—</span> Price</span><span><span style={{ color: C.up }}>—</span> Quarterly EPS</span>{nextQ != null ? <span><span style={{ color: C.up }}>◇</span> Next Q est</span> : null}</>}>
          <defs><linearGradient id={`g-${f.ticker}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.accent} stopOpacity="0.22" /><stop offset="100%" stopColor={C.accent} stopOpacity="0" /></linearGradient></defs>
          {pxTk.map((v) => <g key={v}><line x1={PAD.l} y1={yPx(v)} x2={W - PAD.r} y2={yPx(v)} stroke={gx} strokeWidth={0.5} /><text x={PAD.l - 5} y={yPx(v) + 3} textAnchor="end" {...axL}>${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v.toFixed(0)}</text></g>)}
          {epsTk.map((v) => <text key={v} x={W - PAD.r + 5} y={yEps(v) + 3} {...axL} fill={C.up}>${v.toFixed(v < 10 ? 1 : 0)}</text>)}
          {yrLabels.map((l, i) => <text key={i} x={l.x} y={H - 8} textAnchor="middle" {...axL}>{l.y}</text>)}
          <path d={pxArea} fill={`url(#g-${f.ticker})`} />
          <path d={pxLine} fill="none" stroke={C.accent} strokeWidth={1.4} />
          <path d={epsLine} fill="none" stroke={C.up} strokeWidth={2} />
          {nextQ != null && lastEps && <g><line x1={epsX[epsPts.length - 1]} y1={yEps(lastEps.eps)} x2={rightX} y2={yEps(nextQ)} stroke={C.up} strokeWidth={1.2} strokeDasharray="3,3" /><rect x={rightX - 3.4} y={yEps(nextQ) - 3.4} width={6.8} height={6.8} fill={C.up} transform={`rotate(45 ${rightX} ${yEps(nextQ)})`} /></g>}
        </Chart>

        <Chart title="P/E (quarterly, TTM) vs historical average" W={W} H={H} C={C}
          legend={<><span><span style={{ color: peC }}>—</span> P/E</span>{avgPe != null ? <span><span style={{ color: C.t1 }}>—</span> avg {fmt1(avgPe)}×</span> : null}{liveTtmPe != null ? <span><span style={{ color: C.accent }}>--</span> live {fmt1(liveTtmPe)}×</span> : null}</>}>
          {peTk.map((v) => <g key={v}><line x1={PAD.l} y1={yPe(v)} x2={W - PAD.r} y2={yPe(v)} stroke={gx} strokeWidth={0.5} /><text x={PAD.l - 5} y={yPe(v) + 3} textAnchor="end" {...axL}>{v.toFixed(0)}×</text></g>)}
          {yrLabels.map((l, i) => <text key={i} x={l.x} y={H - 8} textAnchor="middle" {...axL}>{l.y}</text>)}
          <path d={peLine} fill="none" stroke={peC} strokeWidth={1.8} />
          {avgPe != null && <g><line x1={PAD.l} y1={yPe(avgPe)} x2={W - PAD.r} y2={yPe(avgPe)} stroke={C.t1} strokeWidth={1.4} /><text x={PAD.l + 3} y={yPe(avgPe) - 4} {...dot} fill={C.t1}>avg {fmt1(avgPe)}×</text></g>}
          {liveTtmPe != null && <g><line x1={PAD.l} y1={yPe(liveTtmPe)} x2={W - PAD.r} y2={yPe(liveTtmPe)} stroke={C.accent} strokeWidth={1.2} strokeDasharray="4,3" /><text x={W - PAD.r - 3} y={yPe(liveTtmPe) - 4} textAnchor="end" {...dot} fill={C.accent}>live {fmt1(liveTtmPe)}×</text></g>}
        </Chart>

        <Chart title="Free Cash Flow (quarterly)" W={W} H={H} C={C}
          legend={<><span><span style={{ color: C.dn }}>▮</span> Quarterly FCF</span>{avgPfcf != null ? <span><span style={{ color: C.t1 }}>—</span> avg P/FCF {fmt1(avgPfcf)}×</span> : null}{lpfcf != null ? <span><span style={{ color: C.accent }}>--</span> live {fmt1(lpfcf)}×</span> : null}</>}>
          <defs><linearGradient id={`fg-${f.ticker}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.dn} stopOpacity="0.85" /><stop offset="100%" stopColor={C.dn} stopOpacity="0.45" /></linearGradient></defs>
          {fcfTk.map((v) => <g key={v}><line x1={PAD.l} y1={yFcf(v)} x2={W - PAD.r} y2={yFcf(v)} stroke={Math.abs(v) < 1e-6 ? C.border : gx} strokeWidth={Math.abs(v) < 1e-6 ? 0.8 : 0.5} /><text x={PAD.l - 5} y={yFcf(v) + 3} textAnchor="end" {...axL}>{bil(v)}</text></g>)}
          {pfTk.map((v) => <text key={v} x={W - PAD.r + 5} y={yPf(v) + 3} {...axL} fill={C.t2}>{v.toFixed(0)}×</text>)}
          {fcfPts.map((a, i) => { const yv = yFcf(a.fcf); const top = Math.min(y0, yv); return <rect key={a.date} x={fcfX(i) - bw / 2} y={top} width={bw} height={Math.max(1, Math.abs(yv - y0))} fill={`url(#fg-${f.ticker})`} rx={1} /> })}
          {fcfYr.map((l, i) => <text key={i} x={l.x} y={H - 8} textAnchor="middle" {...axL}>{l.y}</text>)}
          {avgPfcf != null && <g><line x1={PAD.l} y1={yPf(avgPfcf)} x2={W - PAD.r} y2={yPf(avgPfcf)} stroke={C.t1} strokeWidth={1.4} /><text x={PAD.l + 3} y={yPf(avgPfcf) - 4} {...dot} fill={C.t1}>avg {fmt1(avgPfcf)}×</text></g>}
          {lpfcf != null && <g><line x1={PAD.l} y1={yPf(lpfcf)} x2={W - PAD.r} y2={yPf(lpfcf)} stroke={C.accent} strokeWidth={1.2} strokeDasharray="4,3" /><text x={W - PAD.r - 3} y={yPf(lpfcf) - 4} textAnchor="end" {...dot} fill={C.accent}>live {fmt1(lpfcf)}×</text></g>}
        </Chart>
      </div>
    </div>
  )
}
