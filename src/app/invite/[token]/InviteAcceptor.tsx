'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function InviteAcceptor({ token }: { token: string }) {
  const router = useRouter()

  useEffect(() => {
    router.replace(`/api/invite/accept?token=${encodeURIComponent(token)}`)
  }, [token, router])

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="animate-spin w-5 h-5 border-2 border-foreground/20 border-t-foreground rounded-full" />
    </div>
  )
}
