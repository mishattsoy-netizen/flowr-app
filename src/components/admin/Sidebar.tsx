'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Activity,
  Cpu,
  ShieldCheck,
  Users,
  Zap,
  Shield,
  Terminal,
  Bot,
  MessageSquareText,
  BarChart3,
  ArrowLeft
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function Sidebar() {
  return (
    <aside className="w-64 bg-sidebar border-r border-border flex flex-col h-full relative z-10 select-none">
      <div className="flex items-center gap-3 px-6 py-8 border-b border-border mb-4 group">
        <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center text-accent border border-accent/20 transition-all hover:bg-accent/30">
          <Shield className="w-5 h-5" strokeWidth={2.5} />
        </div>
        <div className="flex flex-col">
          <h1 className="text-xl font-display text-foreground tracking-tight leading-none">Admin</h1>
          <span className="text-[10px] font-bold text-muted-foreground tracking-[0.05em] uppercase opacity-40 mt-1">Orchestrator</span>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-6 overflow-y-auto custom-scrollbar">
        <PlatformSection title="Global Management">
          <NavLink href="/admin" icon={Activity}>System Overview</NavLink>
          <NavLink href="/admin/analytics" icon={BarChart3}>Analytics Engine</NavLink>
          <NavLink href="/admin/users" icon={Users}>Global Users</NavLink>
          <NavLink href="/admin/vault" icon={Shield}>Secure Vault</NavLink>
          <NavLink href="/admin/presets" icon={Zap}>Usage Presets</NavLink>
        </PlatformSection>

        <PlatformSection title="App Orchestration">
          <NavLink href="/admin/app/router" icon={Cpu}>Router Matrix</NavLink>
          <NavLink href="/admin/app/prompts" icon={Terminal}>Prompts Node</NavLink>
        </PlatformSection>

        <PlatformSection title="Telegram Node">
          <NavLink href="/admin/telegram/router" icon={Bot}>Router Matrix</NavLink>
          <NavLink href="/admin/telegram/prompts" icon={MessageSquareText}>Prompts Node</NavLink>
        </PlatformSection>
      </nav>

      <div className="p-4 mt-auto border-t border-border">
        <Link 
          href="/"
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-hover transition-all duration-200 group"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Terminal
        </Link>
      </div>
    </aside>
  )
}

function PlatformSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h3 className="px-3 text-[11px] font-ui-label font-bold text-muted-foreground/40 uppercase tracking-widest">{title}</h3>
      <div className="space-y-0.5">
        {children}
      </div>
    </div>
  )
}

function NavLink({ href, icon: Icon, children }: { href: string; icon: any; children: React.ReactNode }) {
  const pathname = usePathname()
  const isActive = pathname === href
  
  return (
    <Link 
      href={href}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group relative text-sm font-medium",
        isActive 
          ? "bg-[var(--bone-6)] text-[var(--bone-100)] hover:bg-[var(--bone-10)]" 
          : "bg-transparent text-[var(--bone-60)] hover:bg-[var(--bone-6)] hover:text-[var(--bone-100)]"
      )}
    >
      {isActive && (
        <div className="absolute left-0 w-1 h-3 bg-accent rounded-r-full" />
      )}
      <Icon className={cn(
        "w-4 h-4 transition-colors",
        isActive ? "text-accent" : "text-[var(--bone-60)] group-hover:text-[var(--bone-100)]"
      )} strokeWidth={1.5} />
      <span>{children}</span>
    </Link>
  )
}

