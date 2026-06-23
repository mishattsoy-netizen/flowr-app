'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Activity, Cpu, Users, Zap, Shield,
  BarChart3, ScrollText, ArrowLeft,
  Database, Brain,
  RotateCcw, MessageCircle, LayoutDashboard, Globe,
  Telescope, DollarSign, SlidersHorizontal, Monitor,
  UserCog, Link2
} from 'lucide-react'
import { cn } from '@/lib/utils'

const LogoSimple = ({ className }: { className?: string }) => (
  <svg width="39" height="39" viewBox="0 0 39 39" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path fillRule="evenodd" clipRule="evenodd" d="M29.9302 39H9.06977L8.9525 38.9993C4.03648 38.937 0.063001 34.9635 0.000708576 30.0475L0 29.9302V9.06977C0 4.06067 4.06067 1.38779e-07 9.06977 0H29.9302C34.9393 0 39 4.06067 39 9.06977V29.9302C39 34.9002 35.0026 38.9365 30.0475 38.9993L29.9302 39ZM24.1066 15.9808L23.7628 23.7174C23.7628 26.3798 22.6382 28.9779 20.5522 31.064L14.9561 36.2791H29.9302C33.4366 36.2791 36.2791 33.4366 36.2791 29.9302V9.06977C36.2791 8.08478 36.0548 7.15218 35.6544 6.32027L35.5436 6.35738C33.2742 7.11717 30.99 7.88195 28.8924 8.89124C25.9704 10.2972 24.2398 13.0277 24.1066 15.9808ZM16.3045 18.0338L16.7254 13.687C17.0538 10.2965 19.4868 7.35444 23.0273 6.06642L32.4536 3.24217C31.6802 2.90682 30.8269 2.72093 29.9302 2.72093H9.06977C5.5634 2.72093 2.72093 5.5634 2.72093 9.06977V27.2509L8.39919 26.1046C12.7272 25.2308 15.9235 21.9676 16.3045 18.0338Z" fill="#E09952" />
  </svg>
)

export default function Sidebar() {
  return (
    <aside className="w-64 bg-sidebar flex flex-col overflow-hidden flex-shrink-0 h-full relative z-10 select-none border-r border-[var(--bone-10)]">
      <div className="flex items-center justify-between px-4 py-5 border-b border-[var(--bone-6)] transition-all duration-0">
        <div className="flex items-center gap-3 group">
          <LogoSimple className="w-7 h-7" />
          <h1 className="text-2xl font-display font-semibold text-foreground tracking-tight leading-none">Admin</h1>
        </div>
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto scrollbar-thin [scrollbar-gutter:stable] pl-3 pr-[4px] pt-3 mr-[2px] flex flex-col gap-3">
        <PlatformSection title="System">
          <NavLink href="/admin" icon={Activity}>System Overview</NavLink>
          <NavLink href="/admin/analytics" icon={BarChart3}>Analytics</NavLink>
          <NavLink href="/admin/costs" icon={DollarSign}>Costs</NavLink>
          <NavLink href="/admin/logs" icon={ScrollText}>Message Logs</NavLink>
          <NavLink href="/admin/users" icon={Users}>Users</NavLink>
          <NavLink href="/admin/admins" icon={UserCog}>Admins</NavLink>
          <NavLink href="/admin/beta" icon={Link2}>Beta Invites</NavLink>
        </PlatformSection>

        <PlatformSection title="Infrastructure">
          <NavLink href="/admin/vault" icon={Shield}>Vault</NavLink>
          <NavLink href="/admin/presets" icon={SlidersHorizontal}>Presets</NavLink>
          <NavLink href="/admin/discover" icon={Telescope}>Discover</NavLink>
        </PlatformSection>

        <PlatformSection title="Bot">
          <NavLink href="/admin/bot/global" icon={Globe}>Global Settings</NavLink>
          <NavLink href="/admin/models" icon={Database}>Model Registry</NavLink>
          <NavLink href="/admin/router" icon={Monitor}>Router Matrix</NavLink>
          <div className="px-3 py-[3px] mt-1">
            <span className="text-[10px] font-ui-label font-medium uppercase tracking-wide text-[var(--bone-40)]">Modes</span>
          </div>
          <NavLink href="/admin/bot/default" icon={Zap}>Default</NavLink>
          <NavLink href="/admin/bot/pro" icon={Cpu}>Pro</NavLink>
          <div className="px-3 py-[3px] mt-1">
            <span className="text-[10px] font-ui-label font-medium uppercase tracking-wide text-[var(--bone-40)]">Config</span>
          </div>
          <NavLink href="/admin/bot/brain" icon={Brain}>Brain</NavLink>
          <NavLink href="/admin/bot/keywords" icon={Zap}>Keywords</NavLink>
          <NavLink href="/admin/bot/dashboard" icon={LayoutDashboard}>Dashboard</NavLink>
          <NavLink href="/admin/bot/routine" icon={RotateCcw}>Routine</NavLink>
          <NavLink href="/admin/bot/feedback" icon={MessageCircle}>Feedback</NavLink>
        </PlatformSection>
      </nav>

      <div className="p-3 border-t border-[var(--bone-6)] flex items-center mt-auto justify-between">
        <Link
          href="/"
          className="sidebar-item-row group relative flex items-center w-full cursor-pointer select-none transition-all duration-0 px-3 rounded-[var(--radius-8)] h-7 text-[14px] text-[var(--bone-70)] hover:bg-[var(--app-dark)] hover:text-[var(--bone-100)]"
        >
          <div className="w-7 shrink-0 flex items-center justify-center">
            <ArrowLeft className="w-3.5 h-3.5 text-[var(--bone-70)] group-hover:text-[var(--bone-100)]" strokeWidth={2} />
          </div>
          <span className="ml-0 flex-1 text-left tracking-wide">Back to Terminal</span>
        </Link>
      </div>
    </aside>
  )
}

function PlatformSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <div className="ml-0 mr-[2px] px-3 py-[3px] flex items-center justify-between group select-none rounded-[var(--radius-8)] transition-colors duration-0">
        <span className="text-[10px] font-ui-label font-medium uppercase tracking-wide text-[var(--bone-70)]">{title}</span>
      </div>
      <div className="flex flex-col gap-[3px] mt-[3px] mb-2 pr-[4px] mr-[2px]">
        {children}
      </div>
    </div>
  )
}

function NavLink({ href, icon: Icon, children }: { href: string; icon: any; children: React.ReactNode }) {
  const pathname = usePathname()
  const isActive = pathname === href || (href !== '/admin' && pathname.startsWith(href))

  return (
    <Link
      href={href}
      className={cn(
        "sidebar-item-row group relative flex items-center w-full cursor-pointer select-none transition-all duration-0 px-3 rounded-[var(--radius-8)] h-7 text-[14px]",
        isActive
          ? "!bg-dark text-[var(--bone-100)] font-normal"
          : "text-[var(--bone-70)] hover:bg-[var(--app-dark)] hover:text-[var(--bone-100)]"
      )}
    >
      <div className="w-7 shrink-0 flex items-center justify-center">
        <Icon className={cn("w-3.5 h-3.5", isActive ? "text-[var(--bone-100)]" : "text-[var(--bone-70)] group-hover:text-[var(--bone-100)]")} strokeWidth={2} />
      </div>
      <span className="ml-0 flex-1 text-left tracking-wide">{children}</span>
    </Link>
  )
}
