'use client'

import React from 'react'
import Sidebar from '@/components/admin/Sidebar'
import ActivityLogSidebar from '@/components/admin/ActivityLogSidebar'
import { AdminContentWrapper } from '@/components/admin/AdminContentWrapper'
import { useAuth } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isAdmin, isAdminLoading, user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !isAdminLoading && !user) {
      router.replace('/login')
    } else if (!loading && !isAdminLoading && user && !isAdmin) {
      router.replace('/app')
    }
  }, [user, isAdmin, isAdminLoading, loading, router])

  if (loading || isAdminLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-spin w-5 h-5 border-2 border-foreground/20 border-t-foreground rounded-full" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Redirecting to login...</p>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center max-w-sm px-6">
          <h1 className="text-xs font-display font-semibold text-foreground tracking-tight mb-2">Access Denied</h1>
          <p className="text-sm text-muted-foreground">You do not have admin access. Contact the system administrator.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background text-foreground selection:bg-accent/30 overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto custom-scrollbar bg-background">
        <AdminContentWrapper>
          {children}
        </AdminContentWrapper>
      </main>
      <ActivityLogSidebar />
    </div>
  )
}
