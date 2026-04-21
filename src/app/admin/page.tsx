import React from 'react'
import { Activity, Users, Zap, ShieldCheck, Cpu, MessageSquare } from 'lucide-react'
import { UsageAreaChart } from '@/components/admin/Charts'
import { supabaseAdmin } from '@/lib/supabase'
import { cn } from '@/lib/utils'

export default async function AdminOverview() {
  const stats = await getStats()

  const metrics = [
    { title: 'Total Users', value: stats.totalUsers, icon: Users },
    { title: 'Total Messages', value: stats.totalMessages, icon: MessageSquare },
    { title: 'Active Presets', value: stats.activePresets, icon: Zap },
    { title: 'Vault Keys', value: stats.vaultKeys, icon: ShieldCheck },
  ]

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="flex flex-col gap-0.5 mb-2">
        <h1 className="text-3xl font-black tracking-tight text-bone-100 font-instrument text-chromatic">System Overview</h1>
        <p className="text-bone-60 text-[10px] font-black tracking-[0.05em] opacity-40 uppercase">Real-time status of the Flowr AI engine.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-[10px]">
        {metrics.map((m, i) => (
          <MetricCard key={i} title={m.title} value={m.value} icon={m.icon} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 widget relative overflow-hidden">
          <h2 className="text-[10px] font-black text-bone-60 mb-4 flex items-center gap-2 tracking-[0.1em] uppercase opacity-40">
            <div className="w-1 h-1 bg-accent rounded-full" />
            Traffic activity telemetry
          </h2>
          <div className="flex-1 min-h-0">
            <UsageAreaChart data={stats.historicalUsage} />
          </div>
        </div>

        <div className="widget flex flex-col">
          <h2 className="text-[10px] font-black text-bone-60 mb-4 flex items-center gap-2 tracking-[0.1em] uppercase opacity-40">
             <div className="w-1 h-1 bg-bone-100 rounded-full" />
             Recent events log
          </h2>
          <div className="space-y-1 flex-1">
            <EventLog message="User 12345 registered" time="2m ago" />
            <EventLog message="Fallback triggered: gemini-pro" time="15m ago" />
            <EventLog message="Vault key updated: TAVILY" time="1h ago" />
            <EventLog message="Preset 'VIP' updated" time="3h ago" />
            <EventLog message="Image generation node active" time="5h ago" />
            <EventLog message="System health check pass" time="12h ago" />
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ title, value, change, icon: Icon, accent = false }: any) {
  return (
    <div className={cn(
      "p-6 instrument-hover cursor-pointer relative overflow-hidden",
      accent ? "widget-accent" : "widget"
    )}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-black text-bone-60 tracking-[0.1em] uppercase opacity-40">{title}</span>
        <Icon 
          className={cn("w-4 h-4", accent ? "text-accent fill-accent/10" : "text-bone-60/40")} 
          strokeWidth={1.5}
        />
      </div>
      <div className="space-y-1">
        <h3 className={cn("text-3xl font-black tracking-tighter leading-none font-crimson text-chromatic", accent ? "text-accent" : "text-bone-100")}>{value}</h3>
        <p className="text-[10px] text-bone-60 font-bold tracking-tight opacity-30">{change}</p>
      </div>
    </div>
  )
}

function EventLog({ message, time }: { message: string, time: string }) {
  return (
    <div className="flex items-center justify-between text-[11px] font-medium p-2.5 -mx-1.5 rounded-[var(--radius-8)] hover:bg-bone-6 group cursor-pointer transition-all duration-200">
      <span className="text-bone-60 group-hover:text-bone-100">{message}</span>
      <span className="text-bone-60 opacity-20 font-mono text-[9px] group-hover:opacity-40 transition-colors">{time}</span>
    </div>
  )
}
async function getStats() {
  const [
    { count: totalUsers },
    { count: totalMessages },
    { count: activePresets },
    { count: vaultKeys },
    { data: historicalData }
  ] = await Promise.all([
    supabaseAdmin.from('telegram_users').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('message_logs').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('limit_presets').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('vault').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('message_logs')
      .select('created_at')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: true })
  ])

  // Process historical data into daily counts
  const dailyCounts: Record<string, number> = {}
  historicalData?.forEach((log: any) => {
    const date = new Date(log.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    dailyCounts[date] = (dailyCounts[date] || 0) + 1
  })

  const historicalUsage = Object.entries(dailyCounts).map(([date, count]) => ({
    date,
    count
  }))

  return {
    totalUsers: totalUsers || 0,
    totalMessages: totalMessages || 0,
    activePresets: activePresets || 0,
    vaultKeys: vaultKeys || 0,
    historicalUsage
  }
}
