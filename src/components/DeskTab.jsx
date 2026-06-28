// src/components/DeskTab.jsx
// The CIO Desk: Carson-only decision queue from Supabase `cio_desk`.
// Login gate (mirrors Trade-Instructions auth) → queue → approve/reject/defer.
// Styled with the dashboard's `C` theme tokens (passed as a prop), inline styles
// to match the rest of App.jsx (no Tailwind here).

import { useEffect, useState, useCallback } from 'react'
import { supabase, useDeskSession, OWNER_EMAIL } from '../lib/desk'

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }

export default function DeskTab({ C, isDesktop }) {
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
  return <Queue C={C} isDesktop={isDesktop} email={email} />
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
        // Allowlist precheck so a non-approved email gets a clear message.
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
        // success → onAuthStateChange flips the view
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
function Queue({ C, isDesktop, email }) {
  const [items, setItems] = useState(null)
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

  useEffect(() => {
    load()
    const ch = supabase
      .channel('cio_desk_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cio_desk' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

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
      setItems((prev) => (prev || []).filter((x) => x.id !== item.id)) // optimistic
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <div style={{ fontSize: isDesktop ? 20 : 24, fontWeight: 800, color: C.t1 }}>CIO Desk</div>
        <button onClick={() => supabase.auth.signOut()} style={{ marginLeft: 'auto', fontSize: 11, color: C.t4, background: 'none', border: 'none', cursor: 'pointer' }}>Sign out</button>
      </div>
      <div style={{ fontSize: 12, color: C.t3, marginBottom: 16 }}>
        {items.length === 0 ? 'Queue clear — nothing needs your call right now.' : `${items.length} item${items.length === 1 ? '' : 's'} awaiting your decision`}
      </div>
      {err && <div style={{ fontSize: 12, color: C.dn, marginBottom: 12 }}>{err}</div>}

      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 36, color: C.t4 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.up, marginBottom: 4 }}>All clear</div>
          <div style={{ fontSize: 12 }}>The Chief of Staff will surface items here each morning.</div>
        </div>
      ) : items.map((it) => (
        <div key={it.id} style={{ padding: '14px 15px', borderRadius: 12, background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${sevColor(it.priority)}`, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: sevColor(it.priority), textTransform: 'uppercase', letterSpacing: 1 }}>{it.priority}</span>
            <span style={{ fontSize: 10, color: C.t3, padding: '2px 8px', borderRadius: 999, background: C.surface, border: `1px solid ${C.border}`, textTransform: 'uppercase', letterSpacing: 0.5 }}>{catLabel(it.category)}</span>
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
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- helpers
const inputStyle = (C) => ({ width: '100%', padding: '11px 12px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, color: C.t1, fontSize: 14, boxSizing: 'border-box' })
const btn = (color, busy) => ({ flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', background: color, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: busy ? 0.5 : 1 })
function friendly(msg = '') {
  if (/invalid login/i.test(msg)) return 'Wrong email or password.'
  if (/not authorized/i.test(msg)) return 'That email is not authorized for this app.'
  if (/already registered/i.test(msg)) return 'That account already exists — sign in instead.'
  return msg || 'Something went wrong.'
}
