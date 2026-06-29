// src/components/DeskTab.jsx
// The CIO Desk: Carson-only. Pinned stewardship panel (private performance record,
// read from public/performance.json — rendered in NO other tab) + decision queue
// from Supabase `cio_desk` (approve/reject/defer).
// Styled with the dashboard's `C` theme tokens (passed as a prop), inline styles.

import { useEffect, useState, useCallback } from 'react'
import { supabase, useDeskSession, OWNER_EMAIL } from '../lib/desk'

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }
const PRIMARY_BM = { dividend: 'DVY', growth: 'IUSG' }

export default function DeskTab({ C, isDesktop, terminal = false }) {
  const { session, email, isOwner, loading } = useDeskSession()

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ width: 28, height: 28, border: `3px solid ${C.border}`, borderTopColor: C.accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
        <div style={{ fontSize: 13, color: C.t4 }}>Checking session…</div>
      </div>
    )
  }
  if (!session) return <LoginGate C={C} />
  if (!isOwner) return <NotOwner C={C} email={email} />
  return <Queue C={C} isDesktop={isDesktop} email={email} terminal={terminal} />
}

// ---------------------------------------------------- Stewardship panel (pinned)
function StewardshipPanel({ C, isDesktop, terminal = false }) {
  const R = terminal ? 2 : 12;
  const [perf, setPerf] = useState(null)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}performance.json?v=${Math.floor(Date.now() / 60000)}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setPerf)
      .catch(() => setFailed(true))
  }, [])

  if (failed) return null // silently hide if not computed yet
  if (!perf) {
    return <div style={{ fontSize: 12, color: C.t4, padding: '10px 0 16px' }}>Loading your record…</div>
  }

  const fmtPct = (v) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`)
  const fmtUsd = (v) => (v == null ? '—' : `${v >= 0 ? '+' : '−'}$${Math.abs(Math.round(v)).toLocaleString()}`)
  const sleeves = perf.sleeves || {}
  const asOf = (perf.generated_at || '').slice(0, 10)

  const SleeveRow = ({ id, label }) => {
    const s = sleeves[id]; if (!s) return null
    const ret = s.returns?.since_stewardship
    const bm = PRIMARY_BM[id]
    const active = s.benchmarks?.[bm]?.active_return?.since_stewardship
    return (
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '7px 0', borderTop: `1px solid ${C.border}` }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: C.t1, width: 78 }}>{label}</span>
        <span style={{ fontSize: 17, fontWeight: 800, color: ret >= 0 ? C.up : C.dn, fontVariantNumeric: 'tabular-nums' }}>{fmtPct(ret)}</span>
        <span style={{ marginLeft: 'auto', fontSize: 11.5, color: active >= 0 ? C.up : C.dn, fontVariantNumeric: 'tabular-nums' }}>
          {fmtPct(active)} <span style={{ color: C.t4 }}>vs {bm}</span>
        </span>
      </div>
    )
  }

  const Contributors = ({ id, label }) => {
    const s = sleeves[id]; if (!s) return null
    const chip = (c, positive) => (
      <span key={c.ticker} style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: (positive ? C.up : C.dn) + '14', color: positive ? C.up : C.dn, whiteSpace: 'nowrap' }}>
        {c.ticker} {fmtUsd(c.unrealized_gain)}
      </span>
    )
    return (
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 10, color: C.t4, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {(s.top_contributors || []).slice(0, 3).map((c) => chip(c, true))}
          {(s.bottom_contributors || []).slice(0, 2).map((c) => chip(c, false))}
        </div>
      </div>
    )
  }

  // --- richer metrics (risk-adjusted + income) from performance.json ---
  const pctv = (v) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`)
  const numv = (v, suf = '') => (v == null ? '—' : `${v.toFixed(2)}${suf}`)
  const usd0 = (v) => (v == null ? '—' : `$${Math.round(v).toLocaleString()}`)
  const detailRow = (label, val) => (
    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '2.5px 0', fontSize: 11 }}>
      <span style={{ color: C.t4 }}>{label}</span>
      <span style={{ color: C.t2, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{val}</span>
    </div>
  )
  const MetricGrid = ({ heading, rows }) => (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 10, color: C.t4, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{heading}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>{rows.map(([l, v]) => detailRow(l, v))}</div>
    </div>
  )
  const RiskMini = ({ id, label }) => {
    const rm = sleeves[id]?.risk_metrics; if (!rm) return null
    return <MetricGrid heading={`${label} · risk & consistency`} rows={[
      ['Ann. return', pctv(rm.annualized_return)], ['Volatility', pctv(rm.annualized_volatility)],
      ['Sharpe', numv(rm.sharpe)], ['Sortino', numv(rm.sortino)],
      ['Max drawdown', pctv(rm.max_drawdown)], ['Current DD', pctv(rm.current_drawdown)],
      ['Info ratio', numv(rm.information_ratio)], ['Tracking err', pctv(rm.tracking_error)],
      ['Up capture', numv(rm.up_capture, '%')], ['Down capture', numv(rm.down_capture, '%')],
      ['Beta', numv(rm.beta)], ['Batting avg', numv(rm.batting_average, '%')],
      ['Best month', pctv(rm.best_month)], ['Worst month', pctv(rm.worst_month)],
    ]} />
  }
  const IncomeMini = ({ id, label }) => {
    const inc = sleeves[id]?.income; if (!inc) return null
    return <MetricGrid heading={`${label} · income`} rows={[
      ['Proj. annual', usd0(inc.projected_annual_income)], ['Yield on cost', numv(inc.yield_on_cost, '%')],
      ['Current yield', numv(inc.current_yield, '%')], ['Div growth YoY', pctv(inc.dividend_growth_yoy)],
      ['Received YTD', usd0(inc.received_ytd)], ['Received qtr', usd0(inc.received_qtr)],
    ]} />
  }

  return (
    <div style={{ borderRadius: R, background: C.card, border: `1px solid ${C.border}`, borderTop: `2px solid ${C.accent}`, padding: '13px 15px', marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: C.t1, letterSpacing: 0.2 }}>YOUR STEWARDSHIP RECORD</span>
        <span style={{ fontSize: 10, color: C.t4, padding: '1px 6px', borderRadius: 4, background: C.surface, border: `1px solid ${C.border}` }}>PRIVATE</span>
        {asOf && <span style={{ marginLeft: 'auto', fontSize: 10, color: C.t4 }}>as of {asOf}</span>}
      </div>
      <div style={{ fontSize: 10.5, color: C.t4, marginBottom: 8 }}>since {perf.stewardship_start} · your decisions, not the strategy's full inception</div>

      <SleeveRow id="dividend" label="Dividend" />
      <SleeveRow id="growth" label="Growth" />
      {perf.combined?.since_stewardship_return != null && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '7px 0', borderTop: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: C.t2, width: 78 }}>Combined</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: perf.combined.since_stewardship_return >= 0 ? C.up : C.dn, fontVariantNumeric: 'tabular-nums' }}>{fmtPct(perf.combined.since_stewardship_return)}</span>
        </div>
      )}

      <button onClick={() => setOpen((o) => !o)} style={{ marginTop: 8, background: 'none', border: 'none', color: C.accent, fontSize: 11, cursor: 'pointer', padding: 0 }}>
        {open ? 'Hide details ▴' : 'Show details ▾'}
      </button>
      {open && (
        <div style={{ marginTop: 4 }}>
          <RiskMini id="dividend" label="Dividend" />
          <RiskMini id="growth" label="Growth" />
          <IncomeMini id="dividend" label="Dividend" />
          <IncomeMini id="growth" label="Growth" />
          <Contributors id="dividend" label="Dividend · top / drag" />
          <Contributors id="growth" label="Growth · top / drag" />
          {Array.isArray(perf.methodology_caveats) && (
            <div style={{ marginTop: 10, fontSize: 9.5, color: C.t4, lineHeight: 1.5, fontStyle: 'italic' }}>
              {perf.methodology_caveats[0]}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------- Decision scorecard
// The literal stewardship record: how you've worked the queue. Aggregated from cio_desk.
function DecisionScorecard({ C, terminal = false }) {
  const R = terminal ? 2 : 12
  const [stats, setStats] = useState(null)

  useEffect(() => {
    let cancel = false
    supabase.from('cio_desk').select('status,decided_at,category').limit(2000)
      .then(({ data, error }) => {
        if (cancel || error || !data) return
        const c = { approved: 0, rejected: 0, deferred: 0, pending: 0 }
        const cutoff = Date.now() - 30 * 86400000
        let last30 = 0
        const cat = {}
        for (const r of data) {
          if (r.status in c) c[r.status]++
          const dec = r.status === 'approved' || r.status === 'rejected'
          if (dec && r.decided_at && new Date(r.decided_at).getTime() > cutoff) last30++
          if (dec && r.category) cat[r.category] = (cat[r.category] || 0) + 1
        }
        const decided = c.approved + c.rejected
        const topCat = Object.entries(cat).sort((a, b) => b[1] - a[1])[0]
        setStats({ ...c, decided, approveRate: decided ? Math.round((c.approved / decided) * 100) : null, last30, topCat })
      })
    return () => { cancel = true }
  }, [])

  if (!stats || (stats.decided + stats.deferred + stats.pending) === 0) return null
  const pill = (label, n, color) => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
      <span style={{ fontSize: 14, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
      <span style={{ fontSize: 10, color: C.t4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
    </div>
  )
  return (
    <div style={{ borderRadius: R, background: C.card, border: `1px solid ${C.border}`, padding: '12px 15px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 11.5, fontWeight: 800, color: C.t1, letterSpacing: 0.2 }}>DECISION SCORECARD</span>
        {stats.approveRate != null && <span style={{ marginLeft: 'auto', fontSize: 11, color: C.t3 }}>{stats.approveRate}% approved · {stats.decided} decided</span>}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18 }}>
        {pill('Approved', stats.approved, C.up)}
        {pill('Rejected', stats.rejected, C.dn)}
        {pill('Deferred', stats.deferred, C.warn)}
        {pill('Pending', stats.pending, C.t2)}
      </div>
      <div style={{ fontSize: 10.5, color: C.t4, marginTop: 8 }}>
        {stats.last30} decided in last 30 days{stats.topCat ? ` · most acted: ${(stats.topCat[0] || '').replace('_', ' ')} (${stats.topCat[1]})` : ''}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- Login gate
function LoginGate({ C }) {
  const [mode, setMode] = useState('signin') // signin | signup
  const [emailInput, setEmailInput] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  const submit = async () => {
    setError(''); setNotice(''); setBusy(true)
    try {
      const em = emailInput.trim().toLowerCase()
      if (mode === 'signup') {
        const { data: allowed, error: rpcErr } = await supabase.rpc('is_email_allowed', { check_email: em })
        if (rpcErr) throw rpcErr
        if (!allowed) { setError('That email is not authorized for this app.'); setBusy(false); return }
        const { error: suErr } = await supabase.auth.signUp({ email: em, password })
        if (suErr) throw suErr
        setNotice('Account created. If email confirmation is on, check your inbox, then sign in.')
        setMode('signin')
      } else {
        const { error: siErr } = await supabase.auth.signInWithPassword({ email: em, password })
        if (siErr) throw siErr
      }
    } catch (e) {
      setError(friendly(e?.message))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: '32px auto', padding: 22, borderRadius: 14, background: C.card, border: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: C.t1, marginBottom: 2 }}>CIO Desk</div>
      <div style={{ fontSize: 12, color: C.t3, marginBottom: 16 }}>{mode === 'signin' ? 'Sign in to view your decision queue.' : 'Create your account (authorized emails only).'}</div>
      <input type="email" inputMode="email" autoComplete="email" placeholder="you@paradiem.org" value={emailInput}
        onChange={(e) => setEmailInput(e.target.value)}
        style={inputStyle(C)} />
      <input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} placeholder="Password" value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        style={{ ...inputStyle(C), marginTop: 8 }} />
      {error && <div style={{ fontSize: 12, color: C.dn, marginTop: 8 }}>{error}</div>}
      {notice && <div style={{ fontSize: 12, color: C.up, marginTop: 8 }}>{notice}</div>}
      <button onClick={submit} disabled={busy || !emailInput || !password}
        style={{ width: '100%', marginTop: 14, padding: '11px 0', borderRadius: 10, border: 'none', background: C.accent, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
        {busy ? '…' : mode === 'signin' ? 'Sign in' : 'Create account'}
      </button>
      <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setNotice('') }}
        style={{ width: '100%', marginTop: 8, padding: '8px 0', background: 'none', border: 'none', color: C.t3, fontSize: 12, cursor: 'pointer' }}>
        {mode === 'signin' ? 'Need an account? Create one' : 'Have an account? Sign in'}
      </button>
    </div>
  )
}

function NotOwner({ C, email }) {
  return (
    <div style={{ maxWidth: 360, margin: '40px auto', padding: 22, borderRadius: 14, background: C.card, border: `1px solid ${C.border}`, textAlign: 'center' }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: C.t1, marginBottom: 6 }}>Not authorized</div>
      <div style={{ fontSize: 12.5, color: C.t3, lineHeight: 1.5 }}>The CIO Desk is restricted to {OWNER_EMAIL}. You're signed in as {email}.</div>
      <button onClick={() => supabase.auth.signOut()} style={{ marginTop: 16, padding: '9px 18px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, color: C.t2, fontSize: 13, cursor: 'pointer' }}>Sign out</button>
    </div>
  )
}

// ---------------------------------------------------------------- The queue
function Queue({ C, isDesktop, email, terminal = false }) {
  const R = terminal ? 2 : 12;
  const RP = terminal ? 2 : 999;
  const [view, setView] = useState('active')   // 'active' | 'decided'
  const [items, setItems] = useState(null)
  const [decided, setDecided] = useState(null)
  const [err, setErr] = useState('')
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('cio_desk')
      .select('*')
      .in('status', ['pending', 'deferred'])
    if (error) { setErr(error.message); return }
    const sorted = [...(data || [])].sort((a, b) =>
      (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3) ||
      new Date(a.created_at) - new Date(b.created_at))
    setItems(sorted)
  }, [])

  // Decision history — approved/rejected items, most-recently-decided first.
  const loadDecided = useCallback(async () => {
    setDecided(null)
    const { data, error } = await supabase
      .from('cio_desk')
      .select('*')
      .in('status', ['approved', 'rejected'])
      .not('decided_at', 'is', null)
      .order('decided_at', { ascending: false })
      .limit(50)
    if (error) { setErr(error.message); return }
    setDecided(data || [])
  }, [])

  useEffect(() => {
    load()
    const ch = supabase
      .channel('cio_desk_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cio_desk' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  const showActive = () => setView('active')
  const showDecided = () => { setView('decided'); loadDecided() }   // always refetch fresh

  const decide = async (item, toStatus) => {
    let note = null
    if (toStatus === 'rejected' || toStatus === 'deferred') {
      note = window.prompt(`Optional note for ${toStatus}:`) || null
    }
    setBusyId(item.id)
    try {
      const { error: upErr } = await supabase
        .from('cio_desk')
        .update({ status: toStatus, decided_at: new Date().toISOString(), decided_by: email, decision_note: note })
        .eq('id', item.id)
      if (upErr) throw upErr
      await supabase.from('cio_desk_log').insert({
        item_id: item.id, actor: email, from_status: item.status, to_status: toStatus, note,
      })
      setItems((prev) => (prev || []).filter((x) => x.id !== item.id))
      setDecided(null)   // mark history stale; refetches next time Decided is opened
    } catch (e) {
      setErr(e?.message || 'Update failed')
    } finally {
      setBusyId(null)
    }
  }

  const sevColor = (p) => p === 'high' ? C.dn : p === 'medium' ? C.warn : C.t3
  const catLabel = (c) => (c || '').replace('_', ' ')

  if (items === null) {
    return <div style={{ textAlign: 'center', padding: 40, color: C.t4, fontSize: 13 }}>Loading the queue…</div>
  }

  return (
    <div style={{ animation: 'fadeIn 0.3s ease', paddingTop: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ fontSize: isDesktop ? 20 : 24, fontWeight: 800, color: C.t1 }}>CIO Desk</div>
        <button onClick={() => supabase.auth.signOut()} style={{ marginLeft: 'auto', fontSize: 11, color: C.t4, background: 'none', border: 'none', cursor: 'pointer' }}>Sign out</button>
      </div>

      {/* Pinned private performance record — Carson-only (inside the owner-gated Queue) */}
      <StewardshipPanel C={C} isDesktop={isDesktop} terminal={terminal} />

      {/* Decision scorecard — how you've worked the queue */}
      <DecisionScorecard C={C} terminal={terminal} />

      {/* Active | Decided toggle */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        <button onClick={showActive} style={tabBtn(C, view === 'active', terminal)}>
          Active{items.length ? ` · ${items.length}` : ''}
        </button>
        <button onClick={showDecided} style={tabBtn(C, view === 'decided', terminal)}>Decided</button>
      </div>
      {err && <div style={{ fontSize: 12, color: C.dn, marginBottom: 12 }}>{err}</div>}

      {/* ---- ACTIVE ---- */}
      {view === 'active' && (items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 36, color: C.t4 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.up, marginBottom: 4 }}>All clear</div>
          <div style={{ fontSize: 12 }}>The Chief of Staff will surface items here each morning.</div>
        </div>
      ) : items.map((it) => (
        <div key={it.id} style={{ padding: '14px 15px', borderRadius: R, background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${sevColor(it.priority)}`, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: sevColor(it.priority), textTransform: 'uppercase', letterSpacing: 1 }}>{it.priority}</span>
            <span style={{ fontSize: 10, color: C.t3, padding: '2px 8px', borderRadius: RP, background: C.surface, border: `1px solid ${C.border}`, textTransform: 'uppercase', letterSpacing: 0.5 }}>{catLabel(it.category)}</span>
            {it.status === 'deferred' && <span style={{ fontSize: 10, color: C.warn, fontStyle: 'italic' }}>deferred</span>}
            <span style={{ marginLeft: 'auto', fontSize: 10, color: C.t4 }}>{(it.source_agent || '').replace('_', ' ')}</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, marginBottom: 5 }}>{it.title}</div>
          {it.context && <div style={{ fontSize: 12.5, color: C.t2, lineHeight: 1.5, marginBottom: 6 }}>{it.context}</div>}
          {it.suggested_action && (
            <div style={{ fontSize: 12, color: C.accent, lineHeight: 1.45, marginBottom: 8 }}>↳ {it.suggested_action}</div>
          )}
          {Array.isArray(it.tickers) && it.tickers.length > 0 && (
            <div style={{ fontSize: 11, color: C.t3, marginBottom: 8 }}>{it.tickers.join(' · ')}</div>
          )}
          {Array.isArray(it.evidence) && it.evidence.length > 0 && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, marginBottom: 10 }}>
              {it.evidence.map((e, j) => e?.url && (
                <a key={j} href={e.url} target="_blank" rel="noreferrer" style={{ color: C.accent, textDecoration: 'none' }}>{e.source || 'source'} ↗</a>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button disabled={busyId === it.id} onClick={() => decide(it, 'approved')}
              style={btn(C.up, busyId === it.id)}>Approve</button>
            <button disabled={busyId === it.id} onClick={() => decide(it, 'rejected')}
              style={btn(C.dn, busyId === it.id)}>Reject</button>
            <button disabled={busyId === it.id} onClick={() => decide(it, 'deferred')}
              style={{ ...btn(C.t3, busyId === it.id), background: 'transparent', color: C.t3, border: `1px solid ${C.border}` }}>Defer</button>
          </div>
        </div>
      )))}

      {/* ---- DECIDED (history) ---- */}
      {view === 'decided' && <DecidedList C={C} decided={decided} catLabel={catLabel} terminal={terminal} />}
    </div>
  )
}

// ---------------------------------------------------- Decision history view
function DecidedList({ C, decided, catLabel, terminal = false }) {
  const R = terminal ? 2 : 10;
  const RP = terminal ? 2 : 999;
  if (decided === null) {
    return <div style={{ textAlign: 'center', padding: 40, color: C.t4, fontSize: 13 }}>Loading your decisions…</div>
  }
  if (decided.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 36, color: C.t4 }}>
        <div style={{ fontSize: 13 }}>No decisions yet — approved and rejected items will show here.</div>
      </div>
    )
  }
  const fmtDate = (s) => {
    if (!s) return ''
    const d = new Date(s)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  }
  return (
    <div>
      <div style={{ fontSize: 11, color: C.t4, marginBottom: 12 }}>Your last {decided.length} decision{decided.length === 1 ? '' : 's'} · most recent first</div>
      {decided.map((it) => {
        const approved = it.status === 'approved'
        const col = approved ? C.up : C.dn
        return (
          <div key={it.id} style={{ padding: '12px 14px', borderRadius: R, background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${col}`, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: col, textTransform: 'uppercase', letterSpacing: 1 }}>{approved ? 'Approved' : 'Rejected'}</span>
              <span style={{ fontSize: 10, color: C.t3, padding: '2px 8px', borderRadius: RP, background: C.surface, border: `1px solid ${C.border}`, textTransform: 'uppercase', letterSpacing: 0.5 }}>{catLabel(it.category)}</span>
              <span style={{ marginLeft: 'auto', fontSize: 10, color: C.t4 }}>{fmtDate(it.decided_at)}</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginBottom: it.suggested_action ? 4 : 0 }}>{it.title}</div>
            {it.suggested_action && (
              <div style={{ fontSize: 11.5, color: C.t3, lineHeight: 1.45 }}>↳ {it.suggested_action}</div>
            )}
            {it.decision_note && (
              <div style={{ marginTop: 7, fontSize: 11.5, color: C.t2, lineHeight: 1.5, padding: '6px 9px', borderRadius: R, background: C.surface, borderLeft: `2px solid ${C.accent}` }}>
                <span style={{ color: C.t4, fontStyle: 'italic' }}>your note: </span>{it.decision_note}
              </div>
            )}
            {Array.isArray(it.tickers) && it.tickers.length > 0 && (
              <div style={{ fontSize: 10.5, color: C.t4, marginTop: 6 }}>{it.tickers.join(' · ')}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------- helpers
const inputStyle = (C) => ({ width: '100%', padding: '11px 12px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, color: C.t1, fontSize: 14, boxSizing: 'border-box' })
const btn = (color, busy) => ({ flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', background: color, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: busy ? 0.5 : 1 })
const tabBtn = (C, active, terminal = false) => ({ padding: '6px 14px', borderRadius: terminal ? 2 : 999, border: `1px solid ${active ? C.accent : C.border}`, background: active ? C.accent : 'transparent', color: active ? '#fff' : C.t3, fontSize: 12, fontWeight: 700, cursor: 'pointer' })
function friendly(msg = '') {
  if (/invalid login/i.test(msg)) return 'Wrong email or password.'
  if (/not authorized/i.test(msg)) return 'That email is not authorized for this app.'
  if (/already registered/i.test(msg)) return 'That account already exists — sign in instead.'
  return msg || 'Something went wrong.'
}
