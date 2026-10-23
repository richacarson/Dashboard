// src/lib/desk.js
// Supabase client + Carson-only session hook for the CIO Desk.
// Mirrors the Trade-Instructions client config exactly (same project).

import { createClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'CIO Desk: missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
      'Set them as repo secrets AND expose them in deploy.yml build env.',
  )
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    persistSession: true,      // sticky login on your phone
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Implicit, not PKCE. PKCE puts the one-time token in the URL query string,
    // where Microsoft Safe Links (our users are on Outlook/Teams) fetches and
    // consumes it before the person clicks — so password-reset and confirmation
    // links fail and loop. PKCE also keeps its verifier in the browser that
    // requested the link, which breaks when the link opens in a mail app's
    // in-app browser. Implicit carries the session in the URL fragment, which
    // never reaches a server, so the link survives the scanner and works
    // wherever it is opened. Mirrors the data-analysis app, which switched for
    // the same reason.
    flowType: 'implicit',
  },
})

// The desk is Carson's alone. This MUST match is_cio_owner() in the schema.
export const OWNER_EMAIL = 'carson.rich@paradiem.org'

// Session hook: tells the app whether to even show the Desk tab.
export function useDeskSession() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session)
        setLoading(false)
      }
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, next) => {
      setSession(next)
    })
    return () => {
      mounted = false
      sub?.subscription?.unsubscribe()
    }
  }, [])

  const email = session?.user?.email ?? null
  const isOwner = !!email && email.toLowerCase() === OWNER_EMAIL

  return { session, email, isOwner, loading }
}
