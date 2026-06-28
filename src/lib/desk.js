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
    flowType: 'pkce',
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
