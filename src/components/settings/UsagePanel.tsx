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

function UsageBar({ label, usage, large }: { label: string; usage: UsageWindow; large?: boolean }) {
  const pct = usage.cap > 0 ? Math.min(100, (usage.spent / usage.cap) * 100) : 0
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-baseline">
        <span className={`${large ? 'text-[15px]' : 'text-[13px]'} font-semibold text-[var(--bone-100)]`}>{label}</span>
        <span className="text-[var(--bone-60)] text-[12px]">Resets in {formatResetCountdown(usage.resets_at)}</span>
      </div>
      <div className="w-full h-2.5 rounded-full bg-[var(--bone-10)] overflow-hidden">
        <div className="h-full rounded-full bg-[var(--brand-blue)]" style={{ width: `${pct}%` }} />
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
    load().catch(() => { })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (promoStatus?.type === 'error') {
      const timer = setTimeout(() => setPromoStatus(null), 3500)
      return () => clearTimeout(timer)
    }
  }, [promoStatus])

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
    <div className="flex flex-col gap-8 h-full max-w-xl pb-4">
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h4 className="text-[14px] font-medium text-[var(--bone-100)]">{data.tier.name} plan</h4>
          <p className="text-[13px] text-[var(--bone-40)] mt-0.5">
            {data.tier.price_usd > 0 ? `$${data.tier.price_usd}/mo · ` : ''}
            renews {new Date(data.monthly.resets_at).toLocaleDateString()}
          </p>
        </div>
        {data.tier.id !== 'free' && (
          <button
            onClick={handleDowngrade}
            disabled={downgrading}
            className="px-3 py-1.5 rounded-md bg-[#3f3f3e] border border-transparent text-[13px] font-medium text-bone-100 hover:bg-[#4a4a49] disabled:opacity-50 transition-all shrink-0"
          >
            {downgrading ? 'Downgrading...' : 'Downgrade to Free'}
          </button>
        )}
      </div>

      <div className="p-4 rounded-2xl bg-[var(--app-dark)] space-y-5 shrink-0">
        <UsageBar label="5-hour limit" usage={data.window} large />
        <UsageBar label="Weekly limit" usage={data.weekly} />
        <UsageBar label="Monthly credit" usage={data.monthly} />
      </div>

      <div className="p-4 rounded-xl border-2 border-[var(--bone-6)] bg-[var(--bone-4)] flex flex-col gap-3 shrink-0">
        <div>
          <h5 className="text-[13px] font-medium text-[var(--bone-100)]">Redeem Promo Code</h5>
          <p className="text-[12px] text-[var(--bone-40)] mt-0.5">Enter your code to apply credits or discounts.</p>
        </div>
        <div className="flex gap-2 items-start">
          <div className="flex-1 relative">
            <input
              value={promoInput}
              onChange={e => setPromoInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRedeem()}
              placeholder="e.g. FLOWR2026"
              className="w-full bg-[var(--bone-6)] border border-transparent hover:border-[var(--bone-12)] focus:border-[var(--brand-blue)] focus:shadow-[0_0_0_0.5px_var(--brand-blue)] rounded-md px-3 py-1.5 text-[13px] text-bone-100 placeholder:text-bone-70/50 outline-none transition-all"
            />
            {promoStatus && (
              <p className={`text-[12px] mt-1.5 font-medium ${promoStatus.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                {promoStatus.message}
              </p>
            )}
          </div>
          <button
            onClick={handleRedeem}
            disabled={redeeming || !promoInput.trim()}
            className="px-4 py-1.5 rounded-md bg-[var(--brand-blue)] text-white text-[13px] font-medium disabled:opacity-50 transition-all hover:brightness-110 shrink-0"
          >
            {redeeming ? 'Redeeming...' : 'Apply'}
          </button>
        </div>
      </div>

      {data.recentSpend.length > 0 && (
        <div className="flex flex-col min-h-0 flex-1 pt-5">
          <h5 className="text-[12px] font-medium text-[var(--bone-70)] uppercase tracking-wide shrink-0 mb-2">Recent Activity</h5>
          <div className="overflow-y-auto overflow-x-hidden pr-2 pb-8 space-y-0.5 custom-scrollbar">
            {data.recentSpend.map((row, i) => (
              <div key={i} className="flex justify-between items-center text-[13px] text-[var(--bone-70)] py-2 px-3 -mx-3 rounded-md hover:bg-[#2b2a29] transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="whitespace-nowrap">{new Date(row.created_at).toLocaleString()}</span>
                  {row.mode && (
                    <span className="px-1.5 py-0.5 rounded-md bg-[var(--bone-10)] text-[10px] font-semibold text-[var(--bone-80)] uppercase tracking-widest truncate">
                      {row.mode.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
                <span className="font-mono text-[12px] shrink-0">${Number(row.amount_usd).toFixed(4)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
