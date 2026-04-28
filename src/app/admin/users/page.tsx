import React from 'react'
import { 
  Users, 
  ShieldAlert, 
  Search,
  SlidersHorizontal
} from 'lucide-react'
import { supabaseAdmin } from '@/lib/supabase'
import UsersTable from './UsersTable'

export default async function UsersPage() {
  const { data: users, error } = await supabaseAdmin
    .from('telegram_users')
    .select(`
      *,
      limit_presets (
        name,
        daily_msg_limit
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    return <div className="p-8 text-rose-500 font-bold font-mono">System error: {error.message}</div>
  }

  const activeCount = users?.filter((u: any) => !u.is_blocked).length || 0
  const blockedCount = users?.filter((u: any) => u.is_blocked).length || 0

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="mb-2">
        <h1 className="text-4xl font-display text-foreground mb-1">User Identification</h1>
        <p className="text-muted-foreground text-sm font-medium">Database of registered engine operators.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
         <div className="bg-sidebar border border-[var(--bone-10)] group/widget px-5 pb-5 pt-4 rounded-[var(--radius-big)] widget-shadow h-full flex flex-col instrument-hover cursor-default transition-all duration-200 hover:bg-white/[0.02] hover:-translate-y-0.5">
          <div className="text-[10px] font-bold text-bone-60 tracking-[0.1em] uppercase mb-3 opacity-40">Total registered</div>
          <div className="text-3xl font-bold text-bone-100 tracking-tighter leading-none font-instrument">{users?.length || 0}</div>
        </div>
         <div className="bg-sidebar border border-[var(--bone-10)] group/widget px-5 pb-5 pt-4 rounded-[var(--radius-big)] widget-shadow h-full flex flex-col instrument-hover cursor-default transition-all duration-200 hover:bg-white/[0.02] hover:-translate-y-0.5">
          <div className="flex items-center justify-between mb-3 opacity-40">
            <span className="text-[10px] font-bold text-bone-60 tracking-[0.1em] uppercase">Active today</span>
            <Users className="w-4 h-4 text-accent" strokeWidth={1.5} />
          </div>
          <div className="text-3xl font-bold text-accent tracking-tighter leading-none font-instrument">{activeCount}</div>
        </div>
         <div className="bg-sidebar border border-[var(--bone-10)] group/widget px-5 pb-5 pt-4 rounded-[var(--radius-big)] widget-shadow h-full flex flex-col instrument-hover cursor-default transition-all duration-200 hover:bg-white/[0.02] hover:-translate-y-0.5">
          <div className="flex items-center justify-between mb-3 opacity-40">
            <span className="text-[10px] font-bold text-bone-60 tracking-[0.1em] uppercase">Blocked nodes</span>
            <ShieldAlert className="w-4 h-4 text-rose-500" strokeWidth={1.5} />
          </div>
          <div className="text-3xl font-bold text-rose-500 tracking-tighter leading-none font-instrument">{blockedCount}</div>
        </div>
      </div>

       <div className="bg-sidebar border border-[var(--bone-10)] group/widget px-5 pb-5 pt-4 rounded-[var(--radius-big)] widget-shadow h-full flex flex-col overflow-hidden transition-all duration-200 hover:bg-white/[0.02] hover:-translate-y-0.5">
        <div className="p-4 border-b border-[var(--bone-15)] bg-white/[0.01] flex items-center justify-between gap-4">
          <div className="flex-1 relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-bone-60 opacity-20 group-focus-within:opacity-100 group-focus-within:text-accent transition-all duration-300" />
            <input 
              type="text" 
              placeholder="Filter nodes by identity or handle..."
              className="w-full bg-background border border-[var(--bone-15)] rounded-regular px-12 py-2.5 text-[13px] font-medium text-bone-100 placeholder:text-bone-60/20 focus:outline-none focus:border-accent/30 focus:ring-4 focus:ring-accent/5 transition-all"
            />
          </div>
          <button className="flex items-center gap-2.5 px-4 py-2.5 rounded-regular border border-[var(--bone-15)] bg-background text-bone-60 hover:text-bone-100 font-bold text-[10px] uppercase tracking-[0.05em] transition-all hover:bg-bone-hover">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filter nodes
          </button>
        </div>
        <UsersTable initialUsers={users || []} />
      </div>
    </div>
  )
}
