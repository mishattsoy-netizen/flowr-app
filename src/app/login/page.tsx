'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'

function LoginPageInner() {
  const { user, loading, signInWithGoogle } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [hasInvite, setHasInvite] = useState<boolean | null>(null)

  useEffect(() => {
    const err = searchParams.get('error')
    if (err === 'auth_failed') setError('Authentication failed. Please try again.')
    if (err === 'not_invited') setError('Your account is not approved for the beta.')
  }, [searchParams])

  useEffect(() => {
    // Show sign-in button unless the user was explicitly rejected after attempting sign-in.
    // Already-approved users land here without a cookie — they should still see the button.
    if (searchParams.get('error') === 'not_invited') {
      setHasInvite(false)
      return
    }
    fetch('/api/admin/beta/check-invite').then(() => {
      setHasInvite(true)
    }).catch(() => setHasInvite(true))
  }, [searchParams])

  useEffect(() => {
    if (!loading && user) {
      const redirect = (() => { try { return sessionStorage.getItem('login-redirect') } catch { return null } })()
      sessionStorage.removeItem('login-redirect')
      router.replace(redirect || '/app')
    }
  }, [user, loading, router])

  if (loading || hasInvite === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-spin w-5 h-5 border-2 border-foreground/20 border-t-foreground rounded-full" />
      </div>
    )
  }

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm mx-auto px-6">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-display font-normal text-foreground tracking-tight">Flowr</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {hasInvite ? 'Sign in to continue' : 'Private Beta'}
          </p>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400 text-center">
            {error}
          </div>
        )}

        {hasInvite ? (
          <button
            onClick={() => {
              const redirect = searchParams.get('redirect') || '/app'
              try { sessionStorage.setItem('login-redirect', redirect) } catch {}
              signInWithGoogle()
            }}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg border border-[var(--bone-12)] bg-sidebar hover:bg-[var(--bone-6)] text-foreground text-sm font-medium transition-all"
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Sign in with Google
          </button>
        ) : (
          <div className="text-center px-4 py-6 rounded-lg border border-[var(--bone-6)] bg-sidebar">
            <p className="text-sm text-muted-foreground">
              Flowr is in private beta. If you received an invite link, open it to continue.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-spin w-5 h-5 border-2 border-foreground/20 border-t-foreground rounded-full" />
      </div>
    }>
      <LoginPageInner />
    </Suspense>
  )
}
