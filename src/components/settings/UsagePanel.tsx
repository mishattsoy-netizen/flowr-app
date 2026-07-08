"use client";

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface UsageWindow { spent: number; cap: number; resets_at: string }
interface UsageData {
  tier: { id: string; name: string }
  window: UsageWindow
  weekly: UsageWindow
  monthly: UsageWindow
}

function formatResetCountdown(resetsAt: string): string {
  const diffMs = new Date(resetsAt).getTime() - Date.now()
  if (diffMs <= 0) return 'now'
  const hours = Math.floor(diffMs / 3600_000)
  const minutes = Math.floor((diffMs % 3600_000) / 60_000)
  if (hours > 24) return `${Math.floor(hours / 24)}d`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function UsageBar({ label, usage }: { label: string; usage: UsageWindow }) {
  const pct = usage.cap > 0 ? Math.min(100, (usage.spent / usage.cap) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-[var(--bone-100)]">{label}</span>
        <span className="text-[var(--bone-40)] text-xs">Resets in {formatResetCountdown(usage.resets_at)}</span>
      </div>
      <div className="w-full h-2 rounded-full bg-[var(--bone-10)] overflow-hidden">
        <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function UsagePanel() {
  const [data, setData] = useState<UsageData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) return
      try {
        const res = await fetch('/api/usage', { headers: { Authorization: `Bearer ${token}` } })
        if (!res.ok) {
          if (!cancelled) setError('Usage data unavailable')
          return
        }
        const json = await res.json()
        if (!cancelled) setData(json)
      } catch (err) {
        console.error('[UsagePanel] Failed to load usage:', err)
        if (!cancelled) setError('Usage data unavailable')
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (error) return <p className="text-sm text-[var(--bone-40)]">{error}</p>
  if (!data) return <p className="text-sm text-[var(--bone-40)]">Loading usage…</p>

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-semibold text-[var(--bone-100)]">Usage</h4>
        <span className="text-xs text-[var(--bone-40)]">{data.tier.name} plan</span>
      </div>
      <UsageBar label="5-hour limit" usage={data.window} />
      <UsageBar label="Weekly limit" usage={data.weekly} />
      <UsageBar label="Monthly credit" usage={data.monthly} />
    </div>
  )
}
