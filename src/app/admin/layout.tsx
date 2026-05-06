import React from 'react'
import Sidebar from '@/components/admin/Sidebar'
import ActivityLogSidebar from '@/components/admin/ActivityLogSidebar'
import { AdminContentWrapper } from '@/components/admin/AdminContentWrapper'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
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
