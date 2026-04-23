import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Returns the current Supabase auth session and user.
 * `loading` is true until the initial session has been resolved.
 */
export function useAuth() {
  const [session, setSession] = useState(undefined) // undefined = still loading

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  return {
    session,
    user: session?.user ?? null,
    loading: session === undefined,
  }
}
