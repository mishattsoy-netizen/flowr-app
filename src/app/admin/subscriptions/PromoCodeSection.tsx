'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { createPromoCode, type PromoCodeRow } from './promoActions'

export default function PromoCodeSection({
  initialCodes,
  tierOptions,
}: {
  initialCodes: PromoCodeRow[]
  tierOptions: Array<{ id: string; name: string }>
}) {
  const [codes, setCodes] = useState(initialCodes)
  const [tierId, setTierId] = useState(tierOptions[0]?.id ?? '')
  const [durationDays, setDurationDays] = useState('30')
  const [maxUses, setMaxUses] = useState('1')
  const [creating, setCreating] = useState(false)
  const [newCode, setNewCode] = useState<string | null>(null)

  async function handleCreate() {
    const days = parseInt(durationDays, 10)
    const uses = parseInt(maxUses, 10)
    if (!tierId || !Number.isFinite(days) || days <= 0 || !Number.isFinite(uses) || uses <= 0) return
    setCreating(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error('Not authenticated')
      const { code } = await createPromoCode(token, tierId, days, uses)
      setNewCode(code)
      setCodes(prev => [{ code, tier_id: tierId, tier_name: tierOptions.find(t => t.id === tierId)?.name ?? tierId, duration_days: days, max_uses: uses, uses_count: 0, created_at: new Date().toISOString(), expires_at: null }, ...prev])
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="bg-panel border border-[var(--bone-6)] px-5 pb-5 pt-4 rounded-[var(--radius-big)] widget-shadow space-y-4">
      <div className="text-[10px] font-bold text-bone-70 tracking-[0.1em] uppercase opacity-40">Promo Codes</div>

      <div className="flex gap-2 items-end flex-wrap">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-muted-foreground">Tier</label>
          <select value={tierId} onChange={e => setTierId(e.target.value)} className="px-2 py-1.5 rounded-lg border border-[var(--bone-12)] bg-background text-sm text-foreground">
            {tierOptions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-muted-foreground">Duration (days)</label>
          <input type="number" value={durationDays} onChange={e => setDurationDays(e.target.value)} className="px-2 py-1.5 rounded-lg border border-[var(--bone-12)] bg-background text-sm text-foreground w-24" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-muted-foreground">Max uses</label>
          <input type="number" value={maxUses} onChange={e => setMaxUses(e.target.value)} className="px-2 py-1.5 rounded-lg border border-[var(--bone-12)] bg-background text-sm text-foreground w-20" />
        </div>
        <button onClick={handleCreate} disabled={creating} className="px-4 py-1.5 rounded-lg bg-accent text-accent-foreground text-sm font-medium disabled:opacity-50">
          {creating ? 'Creating...' : 'Generate'}
        </button>
      </div>

      {newCode && (
        <div className="px-3 py-2 rounded-lg bg-accent/10 border border-accent/20 text-sm font-mono text-foreground">
          New code: <strong>{newCode}</strong>
        </div>
      )}

      <div className="space-y-1.5">
        {codes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No promo codes yet.</p>
        ) : codes.map(c => (
          <div key={c.code} className="flex items-center justify-between gap-4 py-2 border-b border-[var(--bone-6)] last:border-0 text-sm">
            <span className="font-mono text-foreground">{c.code}</span>
            <span className="text-muted-foreground text-xs">{c.tier_name} · {c.duration_days}d</span>
            <span className="text-muted-foreground text-xs">{c.uses_count} / {c.max_uses} used</span>
          </div>
        ))}
      </div>
    </div>
  )
}
