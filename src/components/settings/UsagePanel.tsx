"use client";

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { redeemPromoCode, downgradeToFree } from '@/app/settings/actions'

interface UsageWindow { spent: number; cap: number; resets_at: string }
interface RecentSpendRow { amount_usd: string; created_at: string; mode: string }
interface UsageData {
  tier: { id: string; name: string; price_usd: number }
  window: UsageWindow
  weekly: UsageWindow
  monthly: UsageWindow
  recentSpend: RecentSpendRow[]
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
  const [promoInput, setPromoInput] = useState('')
  const [promoStatus, setPromoStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [redeeming, setRedeeming] = useState(false)
  const [downgrading, setDowngrading] = useState(false)

  async function load() {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) return
    try {
      const res = await fetch('/api/usage', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) {
        setError('Usage data unavailable')
        return
      }
      const json = await res.json()
      setData(json)
      setError(null)
    } catch (err) {
      console.error('[UsagePanel] Failed to load usage:', err)
      setError('Usage data unavailable')
    }
  }

  useEffect(() => {
    let cancelled = false
    load().catch(() => {})
    return () => { cancelled = true }
  }, [])

  async function handleRedeem() {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token || !promoInput.trim()) return
    setRedeeming(true)
    setPromoStatus(null)
    try {
      const result = await redeemPromoCode(promoInput, token)
      if (result.success) {
        setPromoStatus({ type: 'success', message: 'Code redeemed!' })
        setPromoInput('')
        await load()
      } else {
        setPromoStatus({ type: 'error', message: result.error ?? 'Invalid code.' })
      }
    } finally {
      setRedeeming(false)
    }
  }

  async function handleDowngrade() {
    if (!confirm('Downgrade to the free tier now?')) return
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) return
    setDowngrading(true)
    try {
      await downgradeToFree(token)
      await load()
    } finally {
      setDowngrading(false)
    }
  }

  if (error) return <p className="text-sm text-[var(--bone-40)]">{error}</p>
  if (!data) return <p className="text-sm text-[var(--bone-40)]">Loading usage…</p>

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex justify-between items-center">
        <div>
          <h4 className="text-sm font-semibold text-[var(--bone-100)]">{data.tier.name} plan</h4>
          <p className="text-xs text-[var(--bone-40)]">
            {data.tier.price_usd > 0 ? `$${data.tier.price_usd}/mo · ` : ''}
            renews {new Date(data.monthly.resets_at).toLocaleDateString()}
          </p>
        </div>
        {data.tier.id !== 'free' && (
          <button
            onClick={handleDowngrade}
            disabled={downgrading}
            className="px-3 py-1.5 rounded-lg bg-background border border-[var(--bone-12)] text-xs font-medium text-[var(--bone-70)] hover:text-[var(--bone-100)] disabled:opacity-50 transition-all"
          >
            {downgrading ? 'Downgrading...' : 'Downgrade to Free'}
          </button>
        )}
      </div>

      <div className="space-y-4">
        <UsageBar label="5-hour limit" usage={data.window} />
        <UsageBar label="Weekly limit" usage={data.weekly} />
        <UsageBar label="Monthly credit" usage={data.monthly} />
      </div>

      <div className="flex gap-2 items-start">
        <div className="flex-1">
          <input
            value={promoInput}
            onChange={e => setPromoInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleRedeem()}
            placeholder="Have a promo code?"
            className="w-full px-3 py-2 rounded-lg border border-[var(--bone-12)] bg-background text-sm text-foreground placeholder:text-[var(--bone-40)] focus:outline-none focus:ring-1 focus:ring-accent"
          />
          {promoStatus && (
            <p className={`text-xs mt-1 ${promoStatus.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
              {promoStatus.message}
            </p>
          )}
        </div>
        <button
          onClick={handleRedeem}
          disabled={redeeming || !promoInput.trim()}
          className="px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium disabled:opacity-50 transition-all hover:opacity-90"
        >
          {redeeming ? 'Redeeming...' : 'Redeem'}
        </button>
      </div>

      {data.recentSpend.length > 0 && (
        <div className="space-y-1.5">
          <h5 className="text-xs font-semibold text-[var(--bone-70)] uppercase tracking-wide">Recent Activity</h5>
          {data.recentSpend.map((row, i) => (
            <div key={i} className="flex justify-between text-xs text-[var(--bone-40)] py-1 border-b border-[var(--bone-6)] last:border-0">
              <span>{new Date(row.created_at).toLocaleString()}</span>
              <span>${Number(row.amount_usd).toFixed(4)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
