import React from 'react'
import Sidebar from '@/components/admin/Sidebar'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-background text-foreground selection:bg-accent/30 overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto custom-scrollbar bg-background">
        <div className="p-4 md:p-6 max-w-7xl mx-auto min-h-full">
          {children}
        </div>
      </main>
    </div>
  )
}
