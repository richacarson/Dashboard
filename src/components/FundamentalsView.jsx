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
  const [basis, setBasis] = useState('fwd') // 'fwd' | 'ttm'
  const R = terminal ? 2 : 12

  const rows = (tickers || []).map((t) => {
    const f = fundMap?.[t]
    const px = quotes?.[t]?.p
    if (!f || !f.ttm) return { t, f: null, px }
    const pe = livePE(f, px, basis)
    const pfcf = (px && f.ttm.fcfps > 0) ? px / f.ttm.fcfps : null
    const band = valuationBand(pe, f.annual.map((a) => a.pe), C)
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
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: isDesktop ? 'center' : 'flex-end', justifyContent: 'center', padding: isDesktop ? 24 : 0 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: isDesktop ? R : '16px 16px 0 0', padding: isDesktop ? 20 : 16, width: '100%', maxWidth: isDesktop ? 1180 : '100%', maxHeight: isDesktop ? '90vh' : '88vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
              <button onClick={() => setSel(null)} style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.t2, borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
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
  const W = isDesktop ? 560 : 360, H = 230
  const PAD = { t: 18, r: 52, b: 26, l: 56 }
  const cw = W - PAD.l - PAD.r, ch = H - PAD.t - PAD.b
  const price = f.price || []
  const annual = f.annual || []
  const lpe = livePE(f, px, basis)
  const lpfcf = (px && f.ttm?.fcfps > 0) ? px / f.ttm.fcfps : null
  const gx = C.border + '66'

  if (price.length < 2 || !annual.some((a) => a.eps != null)) {
    return (
      <div style={{ padding: 6 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.t1, marginBottom: 4 }}>{f.ticker} <span style={{ fontSize: 12, fontWeight: 400, color: C.t3 }}>{name}</span></div>
        <div style={{ fontSize: 12.5, color: C.t3 }}>Live P/E {fmt1(lpe)} · P/FCF {fmt1(lpfcf)}. Not enough statement history to chart this name.</div>
      </div>
    )
  }

  const years = price.map((p) => p.m)
  const xAt = (i, n) => PAD.l + (n > 1 ? (i / (n - 1)) * cw : cw / 2)
  const mIdx = (ym) => { const i = price.findIndex((p) => p.m >= ym); return i < 0 ? price.length - 1 : i }
  // x-year labels (~5)
  const yrLabels = []
  { const seen = new Set(); price.forEach((p, i) => { const y = p.m.slice(0, 4); if (!seen.has(y) && i % Math.ceil(price.length / 6) === 0) { seen.add(y); yrLabels.push({ x: xAt(i, price.length), y }) } }) }

  // ---------- EPS vs Price ----------
  const epsPts = annual.filter((a) => a.eps != null)
  const fwdEps = f.fwd?.eps
  const pxs = price.map((p) => p.c)
  const pxLo = Math.min(...pxs), pxHi = Math.max(...pxs)
  const epsAll = epsPts.map((a) => a.eps).concat(fwdEps ? [fwdEps] : [])
  const epsLo = Math.min(0, ...epsAll), epsHi = Math.max(...epsAll) * 1.08
  const pxTk = ticks(pxLo, pxHi, 4), epsTk = ticks(epsLo, epsHi, 4)
  const pT = Math.min(pxLo, pxTk[0]), pB = Math.max(pxHi, pxTk[pxTk.length - 1])
  const eT = Math.min(epsLo, epsTk[0]), eB = Math.max(epsHi, epsTk[epsTk.length - 1])
  const yPx = (v) => PAD.t + ch - ((v - pT) / ((pB - pT) || 1)) * ch
  const yEps = (v) => PAD.t + ch - ((v - eT) / ((eB - eT) || 1)) * ch
  const pxLine = price.map((p, i) => `${i ? 'L' : 'M'}${xAt(i, price.length).toFixed(1)},${yPx(p.c).toFixed(1)}`).join(' ')
  const pxArea = `${pxLine} L${xAt(price.length - 1, price.length).toFixed(1)},${PAD.t + ch} L${PAD.l},${PAD.t + ch} Z`
  const epsLine = epsPts.map((a, i) => `${i ? 'L' : 'M'}${xAt(mIdx(a.date.slice(0, 7)), price.length).toFixed(1)},${yEps(a.eps).toFixed(1)}`).join(' ')

  // ---------- FCF + P/FCF ----------
  const fcfPts = annual.filter((a) => a.fcf != null)
  const fcfHi = Math.max(0, ...fcfPts.map((a) => a.fcf)) * 1.12 || 1
  const pfVals = annual.map((a) => a.pfcf).filter((v) => v != null).concat(lpfcf != null ? [lpfcf] : [])
  const pfLo = Math.min(...pfVals) * 0.9, pfHi = Math.max(...pfVals) * 1.05
  const fcfTk = ticks(0, fcfHi, 4), pfTk = ticks(pfLo, pfHi, 4)
  const yFcf = (v) => PAD.t + ch - (v / (fcfTk[fcfTk.length - 1] || 1)) * ch
  const pfB = Math.min(pfLo, pfTk[0]), pfT = Math.max(pfHi, pfTk[pfTk.length - 1])
  const yPf = (v) => PAD.t + ch - ((v - pfB) / ((pfT - pfB) || 1)) * ch
  const bw = fcfPts.length ? Math.min(38, (cw / fcfPts.length) * 0.55) : 12
  const fcfX = (i) => PAD.l + (cw / fcfPts.length) * (i + 0.5)
  const pfLine = annual.filter((a) => a.pfcf != null).map((a, i) => { const gi = fcfPts.findIndex((p) => p.date === a.date); return `${i ? 'L' : 'M'}${(fcfX(gi < 0 ? i : gi)).toFixed(1)},${yPf(a.pfcf).toFixed(1)}` }).join(' ')

  const dot = { fontSize: 8.5, fontWeight: 700 }
  const axL = { fontSize: 8.5, fill: C.t4 }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 17, fontWeight: 800, color: C.t1 }}>{f.ticker}</span>
        <span style={{ fontSize: 12.5, color: C.t3 }}>{name}</span>
        <span style={{ marginLeft: 'auto', fontSize: 12.5, color: C.t3 }}>
          <b style={{ color: C.t1 }}>{money(px)}</b> · P/E {basis.toUpperCase()} <b style={{ color: C.t1 }}>{fmt1(lpe)}</b> · P/FCF <b style={{ color: C.t1 }}>{fmt1(lpfcf)}</b>
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr', gap: 12 }}>
        <Chart title="EPS (annual) vs Price" W={W} H={H} C={C}
          legend={<><span><span style={{ color: C.accent }}>—</span> Price</span><span><span style={{ color: C.up }}>—</span> Diluted EPS</span>{fwdEps ? <span><span style={{ color: C.up }}>◇</span> Fwd EPS est</span> : null}</>}>
          <defs><linearGradient id={`g-${f.ticker}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.accent} stopOpacity="0.22" /><stop offset="100%" stopColor={C.accent} stopOpacity="0" /></linearGradient></defs>
          {pxTk.map((v) => <g key={v}><line x1={PAD.l} y1={yPx(v)} x2={W - PAD.r} y2={yPx(v)} stroke={gx} strokeWidth={0.5} /><text x={PAD.l - 5} y={yPx(v) + 3} textAnchor="end" {...axL}>${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v.toFixed(0)}</text></g>)}
          {epsTk.map((v) => <text key={v} x={W - PAD.r + 5} y={yEps(v) + 3} {...axL} fill={C.up}>${v.toFixed(v < 10 ? 1 : 0)}</text>)}
          {yrLabels.map((l, i) => <text key={i} x={l.x} y={H - 8} textAnchor="middle" {...axL}>{l.y}</text>)}
          <path d={pxArea} fill={`url(#g-${f.ticker})`} />
          <path d={pxLine} fill="none" stroke={C.accent} strokeWidth={1.4} />
          <path d={epsLine} fill="none" stroke={C.up} strokeWidth={2} />
          {epsPts.map((a) => { const x = xAt(mIdx(a.date.slice(0, 7)), price.length); return <g key={a.date}><circle cx={x} cy={yEps(a.eps)} r={2.6} fill={C.up} /><text x={x} y={yEps(a.eps) - 6} textAnchor="middle" {...dot} fill={C.up}>${a.eps.toFixed(2)}</text></g> })}
          {fwdEps && (() => { const lx = xAt(price.length - 1, price.length), lastReal = epsPts[epsPts.length - 1]; const rx = xAt(mIdx(lastReal.date.slice(0, 7)), price.length); return <g><line x1={rx} y1={yEps(lastReal.eps)} x2={lx} y2={yEps(fwdEps)} stroke={C.up} strokeWidth={1.4} strokeDasharray="3,3" /><rect x={lx - 3} y={yEps(fwdEps) - 3} width={6} height={6} fill={C.up} transform={`rotate(45 ${lx} ${yEps(fwdEps)})`} /><text x={lx} y={yEps(fwdEps) - 6} textAnchor="end" {...dot} fill={C.up}>${fwdEps.toFixed(2)}</text></g> })()}
        </Chart>

        <Chart title="Free Cash Flow (annual) + P/FCF" W={W} H={H} C={C}
          legend={<><span><span style={{ color: C.dn }}>▮</span> FCF</span><span><span style={{ color: C.t1 }}>—</span> P/FCF</span>{lpfcf != null ? <span><span style={{ color: C.accent }}>--</span> live {fmt1(lpfcf)}×</span> : null}</>}>
          <defs><linearGradient id={`fg-${f.ticker}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.dn} stopOpacity="0.85" /><stop offset="100%" stopColor={C.dn} stopOpacity="0.45" /></linearGradient></defs>
          {fcfTk.map((v) => <g key={v}><line x1={PAD.l} y1={yFcf(v)} x2={W - PAD.r} y2={yFcf(v)} stroke={gx} strokeWidth={0.5} /><text x={PAD.l - 5} y={yFcf(v) + 3} textAnchor="end" {...axL}>{bil(v)}</text></g>)}
          {pfTk.map((v) => <text key={v} x={W - PAD.r + 5} y={yPf(v) + 3} {...axL} fill={C.t2}>{v.toFixed(0)}×</text>)}
          {fcfPts.map((a, i) => { const x = fcfX(i), y = yFcf(Math.max(0, a.fcf)); return <rect key={a.date} x={x - bw / 2} y={y} width={bw} height={Math.max(1, PAD.t + ch - y)} fill={`url(#fg-${f.ticker})`} rx={2} /> })}
          {fcfPts.map((a, i) => <text key={a.date} x={fcfX(i)} y={H - 8} textAnchor="middle" {...axL}>{a.date.slice(0, 4)}</text>)}
          <path d={pfLine} fill="none" stroke={C.t1} strokeWidth={1.8} />
          {annual.filter((a) => a.pfcf != null).map((a) => { const gi = fcfPts.findIndex((p) => p.date === a.date); return <circle key={a.date} cx={fcfX(gi < 0 ? 0 : gi)} cy={yPf(a.pfcf)} r={2.2} fill={C.t1} /> })}
          {lpfcf != null && <g><line x1={PAD.l} y1={yPf(lpfcf)} x2={W - PAD.r} y2={yPf(lpfcf)} stroke={C.accent} strokeWidth={1} strokeDasharray="4,3" /><text x={PAD.l + 3} y={yPf(lpfcf) - 3} {...dot} fill={C.accent}>live {fmt1(lpfcf)}×</text></g>}
        </Chart>
      </div>
    </div>
  )
}
