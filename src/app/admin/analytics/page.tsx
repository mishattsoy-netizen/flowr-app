import React from 'react'
import { getTopicDistribution, getDailyVolume, getUsageTypeDistribution } from './actions'
import { TopicPieChart, UsageAreaChart, UsageTypeBarChart } from '@/components/admin/Charts'
import { ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage() {
  const [topics, volume, usageTypes] = await Promise.all([
    getTopicDistribution(),
    getDailyVolume(),
    getUsageTypeDistribution()
  ])

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="mb-2">
        <h1 className="text-4xl font-display text-foreground mb-1">Analytics & Insights</h1>
        <p className="text-muted-foreground text-sm font-medium">Monitor topic trends and message volume.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-sidebar group/widget px-5 pb-5 pt-4 rounded-[var(--radius-big)] widget-shadow h-full flex flex-col space-y-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 blur-[80px] -mr-16 -mt-16" />
          
          <div className="space-y-1 relative z-10">
            <h2 className="text-[10px] font-bold text-bone-60 uppercase tracking-[0.1em] flex items-center gap-2 opacity-50">
              <div className="w-1.5 h-1.5 bg-accent rounded-full" />
              Topic Distribution
            </h2>
            <p className="text-[9px] text-bone-60 opacity-30 font-bold uppercase tracking-tight">Most discussed categories by users.</p>
          </div>
          
          <div className="relative h-64 flex items-center justify-center">
             <TopicPieChart data={topics} />
          </div>
 
          <div className="grid grid-cols-2 gap-2 relative z-10 pt-4 border-t border-[var(--bone-15)]">
            {topics.map((t: any, i: number) => (
              <div key={t.name} className="flex items-center justify-between gap-3 bg-background/50 border border-[var(--bone-15)] p-2 rounded-regular group hover:border-accent/20 transition-all">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full opacity-70" style={{ backgroundColor: ['#E9E9E2', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'][i % 7] }}></div>
                  <span className="text-[10px] font-bold text-bone-60 group-hover:text-bone-100 uppercase tracking-tight transition-colors">{t.name}</span>
                </div>
                <span className="text-[10px] font-mono font-bold text-bone-60 opacity-20 group-hover:opacity-100">{t.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-sidebar group/widget px-5 pb-5 pt-4 rounded-[var(--radius-big)] widget-shadow h-full flex flex-col space-y-4 relative overflow-hidden">
          <div className="space-y-1">
            <h2 className="text-[10px] font-bold text-bone-60 uppercase tracking-[0.1em] flex items-center gap-2 opacity-50">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
              Message Volume
            </h2>
            <p className="text-[9px] text-bone-60 opacity-30 font-bold uppercase tracking-tight">Daily interaction trends over time.</p>
          </div>
          
          <div className="h-72">
            <UsageAreaChart data={volume} />
          </div>
          
          <div className="pt-4 border-t border-[var(--bone-15)] flex items-center justify-center">
            <p className="text-[10px] text-bone-60 opacity-20 font-bold uppercase tracking-[0.2em] flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5" strokeWidth={2} />
              Aggregate Data Pipeline: Production Stream
            </p>
          </div>
        </div>
      </div>

       <div className="widget widget-shadow space-y-4">
        <div className="space-y-1">
          <h2 className="text-[10px] font-bold text-bone-60 uppercase tracking-[0.1em] flex items-center gap-2 opacity-50">
            <div className="w-1.5 h-1.5 bg-accent rounded-full" />
            Capability Breakdown
          </h2>
          <p className="text-[9px] text-bone-60 opacity-30 font-bold uppercase tracking-tight">Distribution of specialized AI tasks.</p>
        </div>
        <div className="h-64">
          <UsageTypeBarChart data={usageTypes} />
        </div>
      </div>
    </div>
  )
}
