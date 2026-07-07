import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

// ─── Simple PIN-based auth (no Supabase needed) ─────────────────────────────
// If Supabase is connected, uses Supabase Auth.
// If not, falls back to PIN stored in IndexedDB settings.

const LOCAL_KEY = 'ib_auth_pin'
const SESSION_KEY = 'ib_session'

function getSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)) } catch { return null }
}
function setSession(user) {
  if (user) sessionStorage.setItem(SESSION_KEY, JSON.stringify(user))
  else sessionStorage.removeItem(SESSION_KEY)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getSession())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (supabase) {
      // Use Supabase Auth if available
      supabase.auth.getSession().then(({ data: { session } }) => {
        const u = session?.user ?? null
        setUser(u)
        setSession(u)
        setLoading(false)
      })
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        const u = session?.user ?? null
        setUser(u)
        setSession(u)
      })
      return () => subscription.unsubscribe()
    } else {
      // PIN mode — restore from sessionStorage
      setUser(getSession())
      setLoading(false)
    }
  }, [])

  // Supabase email login
  const loginWithEmail = async (email, password) => {
    if (!supabase) throw new Error('Supabase not configured')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  // Supabase signup
  const signupWithEmail = async (email, password) => {
    if (!supabase) throw new Error('Supabase not configured')
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    return data
  }

  // PIN login (offline mode — no Supabase needed)
  const loginWithPIN = async (pin) => {
    const stored = localStorage.getItem(LOCAL_KEY)
    if (!stored) {
      // First time — set the PIN
      localStorage.setItem(LOCAL_KEY, pin)
      const u = { id: 'local', email: 'local-user', role: 'owner' }
      setUser(u); setSession(u)
      return { firstTime: true }
    }
    if (stored !== pin) throw new Error('Galat PIN hai!')
    const u = { id: 'local', email: 'local-user', role: 'owner' }
    setUser(u); setSession(u)
    return { firstTime: false }
  }

  const logout = async () => {
    if (supabase) await supabase.auth.signOut()
    setUser(null)
    setSession(null)
  }

  const hasPIN = () => !!localStorage.getItem(LOCAL_KEY)
  const changePIN = (oldPIN, newPIN) => {
    const stored = localStorage.getItem(LOCAL_KEY)
    if (stored && stored !== oldPIN) throw new Error('Purana PIN galat hai!')
    localStorage.setItem(LOCAL_KEY, newPIN)
  }
  const isPINMode = !supabase

  return (
    <AuthContext.Provider value={{
      user, loading,
      loginWithEmail, signupWithEmail,
      loginWithPIN,
      logout,
      isPINMode, hasPIN, changePIN,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
