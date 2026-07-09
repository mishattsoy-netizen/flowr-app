'use client'

import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { User, Session } from '@supabase/supabase-js'
import { useRouter, usePathname } from 'next/navigation'

interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  isAdmin: boolean
  isAdminLoading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  updateProfile: (data: { display_name?: string; avatar_url?: string }) => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  isAdmin: false,
  isAdminLoading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
  updateProfile: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isAdminLoading, setIsAdminLoading] = useState(true)
  const supabase = useRef<ReturnType<typeof createClient> | null>(null)
  try { supabase.current = createClient() } catch {}
  const checkedAdmin = useRef(false)
  const prevUserIdRef = useRef<string | null>(null)

  const router = useRouter()
  const pathname = usePathname()
  const [isGuest, setIsGuest] = useState(false)

  // Track guest bypass state using sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.location.search.includes('guest=1') || sessionStorage.getItem('is_guest') === 'true') {
        setIsGuest(true)
        sessionStorage.setItem('is_guest', 'true')
      }
    }
  }, [])

  const checkAdmin = async (accessToken: string) => {
    if (checkedAdmin.current) return
    checkedAdmin.current = true
    setIsAdminLoading(true)
    try {
      const res = await fetch('/api/admin/verify', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      setIsAdmin(data.isAdmin === true)
    } catch {
      setIsAdmin(false)
    } finally {
      setIsAdminLoading(false)
    }
  }

  useEffect(() => {
    const client = supabase.current
    if (!client) {
      setLoading(false)
      setIsAdminLoading(false)
      return
    }

    // Wrap getSession in a promise race with a 1.5-second timeout to prevent blocking UI load
    const sessionPromise = client.auth.getSession()
    const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) =>
      setTimeout(() => resolve({ data: { session: null } }), 1500)
    )

    Promise.race([sessionPromise, timeoutPromise])
      .then(({ data: { session: s } }) => {
        setSession(s)
        setUser(s?.user ?? null)
        setLoading(false)
        if (s?.access_token) {
          checkAdmin(s.access_token)
        } else {
          setIsAdminLoading(false)
        }
      })
      .catch(() => {
        setLoading(false)
        setIsAdminLoading(false)
      })

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, s) => {
      // If the auth user changed (different person signed in/out), purge stale
      // localStorage cache and reload to prevent the previous user's in-memory
      // Zustand state from leaking into the new user's session.
      const newUserId = s?.user?.id ?? null
      const prevUserId = prevUserIdRef.current
      prevUserIdRef.current = newUserId
      if (prevUserId && prevUserId !== newUserId && typeof window !== 'undefined') {
        try { localStorage.removeItem('flowr-storage') } catch {}
        window.location.reload()
      }

      setSession(s)
      setUser(s?.user ?? null)
      if (s?.access_token) {
        checkedAdmin.current = false
        checkAdmin(s.access_token)
      } else {
        setIsAdmin(false)
        setIsAdminLoading(false)
        checkedAdmin.current = false
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Poll desktop session endpoint inside Electron when not logged in
  useEffect(() => {
    const client = supabase.current
    if (!client || typeof window === 'undefined') return

    const isDesktop = !!(window as any).__FLOWR_DESKTOP__
    if (!isDesktop || user) return

    const intervalId = setInterval(async () => {
      try {
        const res = await fetch('/api/auth/desktop-session')
        const data = await res.json()
        if (data.session) {
          clearInterval(intervalId)
          await client.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token
          })
        }
      } catch (err) {
        console.error('Failed to poll desktop session:', err)
      }
    }, 1000)

    return () => clearInterval(intervalId)
  }, [user])

  const signInWithGoogle = async () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const isDesktop = origin.includes('127.0.0.1')
    
    await supabase.current!.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: isDesktop ? 'flowr://auth/callback' : `${origin}/auth/callback`,
        queryParams: {
          prompt: 'select_account',
        },
      },
    })
  }

  const updateProfile = async (data: { display_name?: string; avatar_url?: string }) => {
    const { data: updated, error } = await supabase.current!.auth.updateUser({
      data,
    })
    if (error) throw error
    if (updated?.user) setUser(updated.user)
  }

  const signOut = async () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('is_guest')
      try { localStorage.removeItem('flowr-storage') } catch {}
    }
    setIsGuest(false)
    await supabase.current!.auth.signOut()
    setUser(null)
    setSession(null)
    setIsAdmin(false)
    setIsAdminLoading(false)
    router.push('/login')
  }

  const isProtectedPath = pathname === '/' || pathname?.startsWith('/app') || pathname?.startsWith('/admin') || pathname?.startsWith('/welcome')

  useEffect(() => {
    if (!loading && !user && !isGuest && isProtectedPath) {
      router.push('/login')
    }
  }, [loading, user, isGuest, isProtectedPath, router])

  // Instantly hide the app if they log out or are not authenticated on a protected path
  if (!loading && !user && !isGuest && isProtectedPath) {
    return <div className="h-screen w-screen bg-[#0a0a0a]" />
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isAdmin,
        isAdminLoading,
        signInWithGoogle,
        signOut,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
