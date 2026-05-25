'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { processInviteAfterAuth } from './actions'

export default function AuthCallbackPage() {
  const { user, loading, signOut } = useAuth()
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
  }, [user, loading, router, signOut])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!user) {
        router.replace('/login?error=auth_failed')
      }
    }, 15000)
    return () => clearTimeout(timer)
  }, [user, router])

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin w-5 h-5 border-2 border-foreground/20 border-t-foreground rounded-full" />
        <p className="text-sm text-muted-foreground">Signing you in...</p>
      </div>
    </div>
  )
}
