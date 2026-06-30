// src/lib/auth.jsx
// App-wide login for the whole dashboard (two-tier model):
//   - Any allowlisted paradiem.org member must sign in to see the dashboard.
//   - The Desk tab stays Carson-only (enforced separately by is_cio_owner()).
// Mirrors the Trade-Instructions AuthProvider and reuses the same Supabase
// client from ./desk (one auth system, one project).

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './desk'

// Anyone with a paradiem.org email may access the dashboard. A small explicit
// allowlist (allowed_users) still covers any outside guests Carson adds by hand.
const isParadiemEmail = (email) => (email ?? '').trim().toLowerCase().endsWith('@paradiem.org')

const NAVY = '#171738'
const GOLD = '#C9A84C'
const PARCHMENT = '#F4EFE4'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined while loading
  const [allowed, setAllowed] = useState(null)       // null until checked

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, next) => setSession(next))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session === undefined) return
    if (!session) { setAllowed(null); return }
    // Fast path: any paradiem.org member is allowed without a table lookup.
    if (isParadiemEmail(session.user.email)) { setAllowed(true); return }
    let cancelled = false
    setAllowed(null)
    supabase
      .from('allowed_users')
      .select('email')
      .eq('email', (session.user.email ?? '').toLowerCase())
      .maybeSingle()
      .then(({ data }) => { if (!cancelled) setAllowed(Boolean(data)) })
    return () => { cancelled = true }
  }, [session])

  const loading = session === undefined || (Boolean(session) && allowed === null)

  const value = {
    session, user: session?.user ?? null, email: session?.user?.email ?? null,
    allowed, loading, signOut: () => supabase.auth.signOut(),
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}

// Gate the whole app. Wrap <App/> with this (see main.jsx change).
export function AuthGate({ children }) {
  const { session, allowed, loading, email, signOut } = useAuth()

  if (loading) return <Splash>Loading…</Splash>
  if (!session) return <Login />
  if (!allowed) return (
    <Splash>
      <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>Not authorized</div>
      <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 18 }}>{email} isn't on the approved list. Ask Carson to add you.</div>
      <button onClick={signOut} style={ghostBtn}>Sign out</button>
    </Splash>
  )
  return children
}

function Splash({ children }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: NAVY, color: PARCHMENT, padding: 20, textAlign: 'center' }}>
      <div>{children}</div>
    </div>
  )
}

function Login() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)

  const submit = async () => {
    setError(null); setInfo(null); setBusy(true)
    try {
      const em = email.trim().toLowerCase()
      if (mode === 'signup') {
        if (!isParadiemEmail(em)) {
          const { data: ok, error: rpcErr } = await supabase.rpc('is_email_allowed', { check_email: em })
          if (rpcErr) throw rpcErr
          if (!ok) { setError("This email isn't approved. Ask Carson to add you."); setBusy(false); return }
        }
        const { error: suErr } = await supabase.auth.signUp({ email: em, password })
        if (suErr) throw suErr
        setInfo('Account created. If confirmation is on, check your inbox, then sign in.')
        setMode('signin')
      } else {
        const { error: siErr } = await supabase.auth.signInWithPassword({ email: em, password })
        if (siErr) throw siErr
      }
    } catch (e) {
      setError(friendly(e?.message))
    } finally { setBusy(false) }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: NAVY, padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 360, background: PARCHMENT, borderRadius: 16, padding: 26 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: NAVY }}>Paradiem</div>
        <div style={{ fontSize: 13, color: '#5b5b6b', marginBottom: 18 }}>{mode === 'signin' ? 'Sign in to continue.' : 'Create your account with your paradiem.org email.'}</div>
        <input type="email" inputMode="email" autoComplete="email" placeholder="you@paradiem.org"
          value={email} onChange={(e) => setEmail(e.target.value)} style={field} />
        <input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} placeholder="Password"
          value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()}
          style={{ ...field, marginTop: 8 }} />
        {error && <div style={{ fontSize: 12, color: '#b3261e', marginTop: 8 }}>{error}</div>}
        {info && <div style={{ fontSize: 12, color: '#1b7a43', marginTop: 8 }}>{info}</div>}
        <button onClick={submit} disabled={busy || !email || !password}
          style={{ width: '100%', marginTop: 16, padding: '12px 0', borderRadius: 10, border: 'none', background: GOLD, color: NAVY, fontWeight: 800, fontSize: 14, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
          {busy ? '…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
        <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setInfo(null) }}
          style={{ width: '100%', marginTop: 10, background: 'none', border: 'none', color: '#5b5b6b', fontSize: 12, cursor: 'pointer' }}>
          {mode === 'signin' ? 'Need an account? Create one' : 'Have an account? Sign in'}
        </button>
      </div>
    </div>
  )
}

const field = { width: '100%', padding: '12px', borderRadius: 10, border: '1px solid #d8d0bd', background: '#fff', color: NAVY, fontSize: 14, boxSizing: 'border-box' }
const ghostBtn = { padding: '9px 18px', borderRadius: 10, border: `1px solid ${GOLD}`, background: 'transparent', color: PARCHMENT, fontSize: 13, cursor: 'pointer' }
function friendly(m = '') {
  if (/invalid login/i.test(m)) return 'Incorrect email or password.'
  if (/already registered/i.test(m)) return 'That account exists — switch to Sign in.'
  if (/confirm/i.test(m)) return 'Confirm your email first — check your inbox.'
  if (/not authorized|not approved/i.test(m)) return "This email isn't approved. Ask Carson to add you."
  return m || 'Something went wrong.'
}
