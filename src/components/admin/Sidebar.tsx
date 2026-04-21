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
    <div className="w-64 border-r border-[var(--bone-15)] flex flex-col h-full bg-background relative z-10 select-none">
      {/* Platform Indicator */}
      <div className="absolute top-0 left-0 w-full h-[2px] bg-accent/20 overflow-hidden">
        <div className="h-full bg-accent w-1/3 animate-[shimmer_2s_infinite]" />
      </div>

      <div className="flex items-center gap-2.5 px-6 py-8 select-none">
        <div className="w-10 h-10 bg-bone-100 rounded-[var(--radius-8)] flex items-center justify-center text-background shadow-lg shadow-black/20">
          <Shield className="w-5 h-5" strokeWidth={2.5} />
        </div>
        <div className="flex flex-col gap-0">
          <h1 className="text-[1.35rem] font-black tracking-tight leading-none font-instrument text-chromatic text-bone-100">Admin</h1>
          <span className="text-[10px] font-black text-bone-60 tracking-[0.05em] opacity-40 uppercase">Orchestrator</span>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-4 overflow-y-auto custom-scrollbar">
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

      <div className="p-4 mt-auto border-t border-[var(--bone-15)]">
        <Link 
          href="/"
          className="flex items-center gap-3 px-4 py-2.5 rounded-[var(--radius-8)] text-[12px] font-bold text-bone-60 hover:text-bone-100 hover:bg-bone-6 transition-all duration-200 group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          Back to Terminal
        </Link>
      </div>
    </div>
  )
}

function PlatformSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5 mb-6">
      <h3 className="px-3 text-[10px] font-black text-bone-60/60 uppercase tracking-[0.12em]">{title}</h3>
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
        "flex items-center gap-3 px-3 py-1.5 rounded-[var(--radius-8)] transition-all duration-200 group relative",
        isActive 
          ? "bg-bone-6 text-bone-100" 
          : "text-bone-60 hover:text-bone-100 hover:bg-bone-hover"
      )}
    >
      {isActive && (
        <div className="absolute left-0 w-1 h-3 bg-accent rounded-r-full" />
      )}
      <Icon className={cn(
        "w-4 h-4 transition-colors",
        isActive ? "text-accent fill-accent/10" : "text-bone-60 group-hover:text-bone-100"
      )} strokeWidth={1.5} />
      <span className="text-[13.5px] font-medium tracking-tight">{children}</span>
    </Link>
  )
}
