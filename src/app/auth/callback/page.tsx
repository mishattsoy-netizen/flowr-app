'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { processInviteAfterAuth } from './actions'

export default function AuthCallbackPage() {
  const { user, loading, signOut, session } = useAuth()
  const router = useRouter()
  const processed = useRef(false)

  useEffect(() => {
    if (!loading && user && !processed.current) {
      processed.current = true
      const email = user.email
      if (!email) {
        router.replace('/login?error=auth_failed')
        return
      }
      processInviteAfterAuth(email).then(async (result) => {
        const isDesktop = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('desktop') === 'true'
        
        if (isDesktop && session) {
          // Send session to local API so Electron can retrieve it
          await fetch('/api/auth/desktop-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(session)
          })
          router.replace('/auth/callback?success=true')
          return
        }

        if (result === 'rejected') {
          await signOut()
          router.replace('/login?error=not_invited')
        } else if (result === 'approved') {
          router.replace('/welcome')
        } else {
          const redirect = (() => { try { const url = sessionStorage.getItem('login-redirect'); sessionStorage.removeItem('login-redirect'); return url } catch { return null } })()
          router.replace(redirect || '/app')
        }
      }).catch(() => {
        router.replace('/login?error=auth_failed')
      })
    }
  }, [user, loading, router, signOut, session])

  useEffect(() => {
    const success = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('success') === 'true'
    if (success) return // Skip fallback timer if login is successfully processed

    const timer = setTimeout(() => {
      if (!user) {
        router.replace('/login?error=auth_failed')
      }
    }, 15000)
    return () => clearTimeout(timer)
  }, [user, router])

  const success = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('success') === 'true'

  if (success) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm px-4">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold">Successfully Logged In</h1>
          <p className="text-sm text-muted-foreground">You can now close this browser tab and return to your Flowr desktop application.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin w-5 h-5 border-2 border-foreground/20 border-t-foreground rounded-full" />
        <p className="text-sm text-muted-foreground">Signing you in...</p>
      </div>
    </div>
  )
}
