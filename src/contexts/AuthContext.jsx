// ============================================================
// AUTH CONTEXT (Admin Panel)
// Stable session + profile loading
// ============================================================

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { signOut as logoutFn } from '../lib/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function fetchProfile(currentUser) {
    if (!currentUser) return null

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', currentUser.id)
      .maybeSingle()

    if (error) {
      console.error('Profile fetch error:', error)
      return null
    }

    return data
  }

  useEffect(() => {
    let active = true

    async function loadSession() {
      try {
        setLoading(true)

        const {
          data: { session },
          error
        } = await supabase.auth.getSession()

        if (error) {
          console.error('Session error:', error)
        }

        if (!active) return

        const currentUser = session?.user || null
        const currentProfile = currentUser ? await fetchProfile(currentUser) : null

        if (!active) return

        setUser(currentUser)
        setProfile(currentProfile)
      } catch (err) {
        console.error('Auth load error:', err)

        if (active) {
          setUser(null)
          setProfile(null)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadSession()

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Ignore background events that don't change the user identity
      if (event === 'TOKEN_REFRESHED') return
      
      // Important: run async work outside the auth callback
      setTimeout(async () => {
        if (!active) return

        try {
          const currentUser = session?.user || null
          
          // Fetch profile in the background without setting a loading screen
          // This prevents the active page (and forms) from unmounting during tab-syncs
          const currentProfile = currentUser ? await fetchProfile(currentUser) : null

          if (!active) return

          setUser(currentUser)
          setProfile(currentProfile)
        } catch (err) {
          console.error('Auth state change error:', err)

          if (active) {
            setUser(null)
            setProfile(null)
          }
        }
      }, 0)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const isAdmin = profile?.role === 'admin' || profile?.role === 'manager'

  const logout = async () => {
    await logoutFn()
    setUser(null)
    setProfile(null)
    setLoading(false)
  }

  const value = {
    user,
    profile,
    loading,
    isAuthenticated: !!user,
    isAdmin,
    logout
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }

  return context
}