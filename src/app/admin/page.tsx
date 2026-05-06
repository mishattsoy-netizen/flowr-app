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
      <div className="mb-2">
        <h1 className="text-4xl font-display text-foreground mb-1">System Overview</h1>
        <p className="text-muted-foreground text-sm font-medium">Real-time status of the Flowr AI engine.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-[10px]">
        {metrics.map((m, i) => (
          <MetricCard key={i} title={m.title} value={m.value} icon={m.icon} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-[10px]">
        <div className="lg:col-span-2 bg-panel rounded-big p-6 relative overflow-hidden">
          <h2 className="text-[10px] font-bold text-bone-60 mb-4 flex items-center gap-2 tracking-[0.1em] uppercase opacity-40">
            <div className="w-1 h-1 bg-accent rounded-full" />
            Traffic activity telemetry
          </h2>
          <div className="flex-1 min-h-0">
            <UsageAreaChart data={stats.historicalUsage} />
          </div>
        </div>

        <div className="bg-panel rounded-big p-6 flex flex-col">
          <h2 className="text-[10px] font-bold text-bone-60 mb-4 flex items-center gap-2 tracking-[0.1em] uppercase opacity-40">
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
      "bg-panel rounded-big p-5 h-full flex flex-col cursor-pointer relative overflow-hidden transition-all duration-200",
      accent ? "bg-accent/5 border-accent/20" : ""
    )}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-[11px] font-ui-label font-bold text-muted-foreground tracking-widest uppercase opacity-40">{title}</span>
        <Icon 
          className={cn("w-4 h-4", accent ? "text-accent fill-accent/10" : "text-muted-foreground/40")} 
          strokeWidth={2}
        />
      </div>
      <div className="space-y-1">
        <h3 className={cn("text-3xl font-display text-chromatic", accent ? "text-accent" : "text-foreground")}>{value}</h3>
        <p className="text-[10px] text-muted-foreground font-bold tracking-tight opacity-30">{change}</p>
      </div>
    </div>
  )
}

function EventLog({ message, time }: { message: string, time: string }) {
  return (
    <div className="flex items-center justify-between text-[13px] font-medium p-2.5 -mx-1.5 rounded-lg group cursor-pointer transition-all duration-200">
      <span className="text-muted-foreground group-hover:text-foreground">{message}</span>
      <span className="text-muted-foreground opacity-20 font-mono text-[10px] group-hover:opacity-40 transition-colors">{time}</span>
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
