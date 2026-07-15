// src/components/FundamentalsView.jsx
// Fundamentals panel for the Metrics section. Shows every holding's LIVE
// valuation (P/E, P/FCF computed from the live price ÷ TTM earnings/FCF) and
// where today's multiple sits vs the stock's own recent history — plus
// click-through EPS-vs-price and FCF + P/FCF charts.
//
// Data: public/fundamentals/<ticker>.json (built by scripts/build-fundamentals.py,
// USD-reporting holdings only). Live price from the parent's quotes.

import { useState } from 'react'

const fmt1 = (v) => (v == null || !isFinite(v)) ? '—' : v.toFixed(1)
const fmtB = (v) => {
  if (v == null || !isFinite(v)) return '—'
  const a = Math.abs(v)
  if (a >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
  if (a >= 1e6) return `$${(v / 1e6).toFixed(0)}M`
  return `$${v.toFixed(0)}`
}

// Where the live multiple sits vs the annual history: 0 = at/below the low,
// 1 = at/above the high. Returns {pos, lo, hi, label, color}.
function valuationBand(live, annualVals, C) {
  const xs = (annualVals || []).filter((v) => v != null && isFinite(v) && v > 0)
  if (!live || !isFinite(live) || xs.length < 2) return null
  const lo = Math.min(...xs), hi = Math.max(...xs)
  const pos = hi > lo ? (live - lo) / (hi - lo) : 0.5
  const label = pos <= 0.15 ? 'CHEAP' : pos >= 0.85 ? 'RICH' : 'MID'
  const color = pos <= 0.15 ? C.up : pos >= 0.85 ? C.dn : C.t3
  return { pos: Math.max(0, Math.min(1, pos)), lo, hi, label, color }
}

export default function FundamentalsView({ tickers, quotes, names, fundMap, C, isDesktop, terminal = false }) {
  const [sel, setSel] = useState(null)
  const R = terminal ? 2 : 12

  const rows = (tickers || []).map((t) => {
    const f = fundMap?.[t]
    const px = quotes?.[t]?.p
    if (!f || !f.ttm) return { t, f: null, px, pe: null, pfcf: null, band: null }
    const pe = (px && f.ttm.eps > 0) ? px / f.ttm.eps : null
    const fcfps = f.ttm.fcfps
    const pfcf = (px && fcfps > 0) ? px / fcfps : null
    const band = valuationBand(pe, f.annual.map((a) => a.pe), C)
    return { t, f, px, pe, pfcf, fcfps, band }
  })

  // cheapest (lowest position vs own range) first; missing data last
  const sorted = [...rows].sort((a, b) => {
    if (!a.band && !b.band) return a.t.localeCompare(b.t)
    if (!a.band) return 1
    if (!b.band) return -1
    return a.band.pos - b.band.pos
  })

  const covered = rows.filter((r) => r.f).length
  const cell = { padding: '8px 10px', fontSize: 12, fontVariantNumeric: 'tabular-nums' }

  return (
    <div style={{ animation: 'fadeIn 0.2s ease' }}>
      <div style={{ fontSize: 12, color: C.t3, marginBottom: 10, lineHeight: 1.5 }}>
        Live valuation vs each stock's own recent range. <span style={{ color: C.up, fontWeight: 700 }}>CHEAP</span> = near multi-year low,
        {' '}<span style={{ color: C.dn, fontWeight: 700 }}>RICH</span> = near high. {covered}/{rows.length} holdings covered
        {covered < rows.length ? ' (ADRs / non-USD reporters excluded)' : ''}.
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: R, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead>
              <tr>
                {['Ticker', 'Price', 'P/E', 'vs range', 'P/FCF', 'EPS TTM', 'FCF TTM', ''].map((h, i) => (
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
                  <td style={{ ...cell, textAlign: 'right', color: C.t1 }}>{r.px ? `$${r.px.toFixed(2)}` : '—'}</td>
                  <td style={{ ...cell, textAlign: 'right', color: C.t1, fontWeight: 600 }}>{fmt1(r.pe)}</td>
                  <td style={{ ...cell, textAlign: 'center' }}>
                    {r.band ? (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ position: 'relative', width: 54, height: 6, borderRadius: 3, background: C.surface, border: `1px solid ${C.border}` }}>
                          <div style={{ position: 'absolute', left: `${r.band.pos * 100}%`, top: -2, width: 4, height: 8, borderRadius: 2, background: r.band.color, transform: 'translateX(-50%)' }} />
                        </div>
                        <span style={{ fontSize: 9, fontWeight: 800, color: r.band.color }}>{r.band.label}</span>
                      </div>
                    ) : '—'}
                  </td>
                  <td style={{ ...cell, textAlign: 'right', color: C.t2 }}>{fmt1(r.pfcf)}</td>
                  <td style={{ ...cell, textAlign: 'right', color: C.t3 }}>{r.f?.ttm?.eps != null ? `$${r.f.ttm.eps.toFixed(2)}` : '—'}</td>
                  <td style={{ ...cell, textAlign: 'right', color: C.t3 }}>{fmtB(r.f?.ttm?.fcf)}</td>
                  <td style={{ ...cell, textAlign: 'right', color: C.t4, fontSize: 11 }}>{r.f ? (sel === r.t ? '▲' : '▼') : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {sel && fundMap[sel] && (
        <div onClick={() => setSel(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: isDesktop ? 'center' : 'flex-end', justifyContent: 'center', padding: isDesktop ? 24 : 0 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: isDesktop ? R : '16px 16px 0 0', padding: isDesktop ? 20 : 16, width: '100%', maxWidth: isDesktop ? 1180 : '100%', maxHeight: isDesktop ? '88vh' : '86vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
              <button onClick={() => setSel(null)} style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.t2, borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
            </div>
            <FundamentalsDetail f={fundMap[sel]} px={quotes?.[sel]?.p} name={names?.[sel] || sel} C={C} isDesktop={isDesktop} R={R} />
          </div>
        </div>
      )}
    </div>
  )
}

function FundamentalsDetail({ f, px, name, C, isDesktop, R }) {
  const W = isDesktop ? 560 : 340, H = 200, PAD = { t: 16, r: 44, b: 24, l: 44 }
  const cw = W - PAD.l - PAD.r, ch = H - PAD.t - PAD.b
  const price = f.price || []
  const annual = f.annual || []
  const livePeQ = (px && f.ttm?.eps > 0) ? px / f.ttm.eps : null
  const livePfcfQ = (px && f.ttm?.fcfps > 0) ? px / f.ttm.fcfps : null
  if (price.length < 2 || !annual.some((a) => a.eps != null)) {
    return (
      <div style={{ padding: 8 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.t1, marginBottom: 4 }}>{f.ticker} <span style={{ fontSize: 12, fontWeight: 400, color: C.t3 }}>{name}</span></div>
        <div style={{ fontSize: 12.5, color: C.t3 }}>
          Live P/E {fmt1(livePeQ)} · P/FCF {fmt1(livePfcfQ)}. Not enough historical statement data to draw the charts for this name.
        </div>
      </div>
    )
  }

  // ---- EPS vs Price chart ----
  const epsPts = annual.filter((a) => a.eps != null)
  const pxVals = price.map((p) => p.c)
  const pxMin = Math.min(...pxVals), pxMax = Math.max(...pxVals)
  const epsMin = Math.min(0, ...epsPts.map((a) => a.eps)), epsMax = Math.max(...epsPts.map((a) => a.eps)) * 1.05
  const xOf = (i, n) => PAD.l + (n > 1 ? (i / (n - 1)) * cw : cw / 2)
  const yPx = (v) => PAD.t + ch - ((v - pxMin) / ((pxMax - pxMin) || 1)) * ch
  const yEps = (v) => PAD.t + ch - ((v - epsMin) / ((epsMax - epsMin) || 1)) * ch
  const pxPath = price.map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(i, price.length).toFixed(1)},${yPx(p.c).toFixed(1)}`).join(' ')
  // map annual eps points onto the price timeline by month
  const monthIdx = (ym) => { const i = price.findIndex((p) => p.m >= ym); return i < 0 ? price.length - 1 : i }
  const epsPath = epsPts.map((a, i) => `${i === 0 ? 'M' : 'L'}${xOf(monthIdx(a.date.slice(0, 7)), price.length).toFixed(1)},${yEps(a.eps).toFixed(1)}`).join(' ')

  // ---- FCF bars + P/FCF line ----
  const fcfPts = annual.filter((a) => a.fcf != null)
  const fcfMax = Math.max(...fcfPts.map((a) => a.fcf)) * 1.1 || 1
  const pfcfVals = annual.map((a) => a.pfcf).filter((v) => v != null)
  const livePfcf = (px && f.ttm.fcfps > 0) ? px / f.ttm.fcfps : null
  const livePe = (px && f.ttm.eps > 0) ? px / f.ttm.eps : null
  const pfcfAll = [...pfcfVals, livePfcf].filter((v) => v != null)
  const pfMin = Math.min(...pfcfAll), pfMax = Math.max(...pfcfAll) * 1.05
  const bw = fcfPts.length ? (cw / fcfPts.length) * 0.6 : 10
  const yFcf = (v) => PAD.t + ch - (v / fcfMax) * ch
  const yPf = (v) => PAD.t + ch - ((v - pfMin) / ((pfMax - pfMin) || 1)) * ch

  const label = { fontSize: 10, fontWeight: 700, color: C.t4, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }
  const chartBox = { background: C.card, border: `1px solid ${C.border}`, borderRadius: R, padding: isDesktop ? 16 : 10 }

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: C.t1 }}>{f.ticker}</span>
        <span style={{ fontSize: 12, color: C.t3 }}>{name}</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: C.t3 }}>
          Live <b style={{ color: C.t1 }}>P/E {fmt1(livePe)}</b> · <b style={{ color: C.t1 }}>P/FCF {fmt1(livePfcf)}</b>
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr', gap: 12 }}>
        {/* EPS vs Price */}
        <div style={chartBox}>
          <div style={label}>EPS (annual) vs Price</div>
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
            <path d={pxPath} fill="none" stroke={C.t2} strokeWidth={1.3} />
            <path d={epsPath} fill="none" stroke={C.accent} strokeWidth={2} />
            {epsPts.map((a, i) => (
              <g key={a.date}>
                <circle cx={xOf(monthIdx(a.date.slice(0, 7)), price.length)} cy={yEps(a.eps)} r={2.5} fill={C.accent} />
                <text x={xOf(monthIdx(a.date.slice(0, 7)), price.length)} y={yEps(a.eps) - 6} fill={C.accent} fontSize={8} textAnchor="middle">${a.eps.toFixed(2)}</text>
              </g>
            ))}
            <text x={PAD.l} y={H - 8} fill={C.t4} fontSize={8}>{price[0]?.m}</text>
            <text x={W - PAD.r} y={H - 8} fill={C.t4} fontSize={8} textAnchor="end">{price[price.length - 1]?.m}</text>
          </svg>
          <div style={{ display: 'flex', gap: 14, fontSize: 10, color: C.t4, marginTop: 4 }}>
            <span><span style={{ color: C.t2 }}>—</span> Price</span><span><span style={{ color: C.accent }}>—</span> Diluted EPS (TTM basis)</span>
          </div>
        </div>
        {/* FCF + P/FCF */}
        <div style={chartBox}>
          <div style={label}>Free Cash Flow (annual) + P/FCF</div>
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
            {fcfPts.map((a, i) => {
              const x = xOf(i, fcfPts.length)
              const y = yFcf(Math.max(0, a.fcf))
              return <rect key={a.date} x={x - bw / 2} y={y} width={bw} height={Math.max(1, PAD.t + ch - y)} fill={C.dn} opacity={0.55} rx={1} />
            })}
            <path d={annual.filter((a) => a.pfcf != null).map((a, i, arr) => {
              const gi = fcfPts.findIndex((p) => p.date === a.date)
              return `${i === 0 ? 'M' : 'L'}${xOf(gi < 0 ? i : gi, fcfPts.length).toFixed(1)},${yPf(a.pfcf).toFixed(1)}`
            }).join(' ')} fill="none" stroke={C.t1} strokeWidth={1.6} />
            {livePfcf != null && (
              <g>
                <line x1={PAD.l} y1={yPf(livePfcf)} x2={W - PAD.r} y2={yPf(livePfcf)} stroke={C.accent} strokeWidth={1} strokeDasharray="3,3" />
                <text x={W - PAD.r} y={yPf(livePfcf) - 3} fill={C.accent} fontSize={9} textAnchor="end">live {fmt1(livePfcf)}x</text>
              </g>
            )}
            {fcfPts.map((a, i) => <text key={a.date} x={xOf(i, fcfPts.length)} y={H - 8} fill={C.t4} fontSize={8} textAnchor="middle">{a.date.slice(0, 4)}</text>)}
          </svg>
          <div style={{ display: 'flex', gap: 14, fontSize: 10, color: C.t4, marginTop: 4 }}>
            <span><span style={{ color: C.dn }}>▮</span> FCF</span><span><span style={{ color: C.t1 }}>—</span> P/FCF</span><span><span style={{ color: C.accent }}>--</span> live P/FCF</span>
          </div>
        </div>
      </div>
    </div>
  )
}
