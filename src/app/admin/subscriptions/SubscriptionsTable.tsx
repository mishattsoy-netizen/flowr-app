'use client'

import { useState } from 'react'
import { updateUserTier, updateUserPeriod, grantBonusCredit, type SubscriptionRow } from './actions'

function UsageBar({ label, usage }: { label: string; usage: { spent: number; cap: number } }) {
  const pct = usage.cap > 0 ? Math.min(100, (usage.spent / usage.cap) * 100) : 0
  return (
    <div className="space-y-0.5 min-w-[100px]">
      <div className="flex justify-between text-[10px] text-[var(--bone-70)]">
        <span>{label}</span>
        <span>${usage.spent.toFixed(4)} / ${usage.cap.toFixed(2)}</span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-[var(--bone-10)] overflow-hidden">
        <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function SubscriptionsTable({
  initialRows,
  tierOptions,
}: {
  initialRows: SubscriptionRow[]
  tierOptions: Array<{ id: string; name: string }>
}) {
  const [rows, setRows] = useState(initialRows)
  const [creditFormOpenFor, setCreditFormOpenFor] = useState<string | null>(null)
  const [creditAmount, setCreditAmount] = useState('')
  const [creditNote, setCreditNote] = useState('')

  async function handleTierChange(userId: string, tierId: string) {
    await updateUserTier(userId, tierId)
    setRows(prev => prev.map(r => r.user_id === userId ? { ...r, tier_id: tierId, granted_by_promo_code: null } : r))
  }

  async function handlePeriodChange(userId: string, field: 'period_start' | 'period_end', value: string) {
    const row = rows.find(r => r.user_id === userId)
    if (!row) return
    const nextStart = field === 'period_start' ? value : row.period_start
    const nextEnd = field === 'period_end' ? value : row.period_end
    await updateUserPeriod(userId, new Date(nextStart).toISOString(), new Date(nextEnd).toISOString())
    setRows(prev => prev.map(r => r.user_id === userId ? { ...r, period_start: nextStart, period_end: nextEnd } : r))
  }

  async function handleGrantCredit(userId: string) {
    const amount = parseFloat(creditAmount)
    if (!Number.isFinite(amount) || amount <= 0) return
    await grantBonusCredit(userId, amount, creditNote)
    setCreditFormOpenFor(null)
    setCreditAmount('')
    setCreditNote('')
    setRows(prev => prev.map(r => r.user_id === userId
      ? { ...r, window: { ...r.window, spent: r.window.spent - amount }, weekly: { ...r.weekly, spent: r.weekly.spent - amount }, monthly: { ...r.monthly, spent: r.monthly.spent - amount } }
      : r))
  }

  if (rows.length === 0) {
    return (
      <div className="p-12 text-center text-bone-70">
        <p className="text-sm font-bold tracking-tight">No subscriptions yet.</p>
        <p className="text-[10px] mt-2 font-bold opacity-30 tracking-tight">Rows appear once a user sends their first chat message.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto bg-panel rounded-big border border-[var(--bone-6)]">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-white/5 border-b border-[var(--bone-6)]">
            <th className="px-6 py-4 text-[11px] font-ui-label font-bold text-muted-foreground/40 tracking-widest uppercase">User</th>
            <th className="px-6 py-4 text-[11px] font-ui-label font-bold text-muted-foreground/40 tracking-widest uppercase">Tier</th>
            <th className="px-6 py-4 text-[11px] font-ui-label font-bold text-muted-foreground/40 tracking-widest uppercase">Usage</th>
            <th className="px-6 py-4 text-[11px] font-ui-label font-bold text-muted-foreground/40 tracking-widest uppercase">Period</th>
            <th className="px-6 py-4 text-[11px] font-ui-label font-bold text-muted-foreground/40 tracking-widest uppercase text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--bone-6)]">
          {rows.map(row => (
            <tr key={row.user_id} className="hover:bg-[var(--bone-6)] transition-all duration-200">
              <td className="px-6 py-4">
                <div className="text-[13px] font-medium text-muted-foreground">{row.email}</div>
                {row.granted_by_promo_code && (
                  <div className="text-[10px] text-accent font-mono mt-0.5">via {row.granted_by_promo_code}</div>
                )}
              </td>
              <td className="px-6 py-4">
                <select
                  value={row.tier_id}
                  onChange={e => handleTierChange(row.user_id, e.target.value)}
                  className="px-2 py-1 rounded-lg border border-[var(--bone-12)] bg-background text-[12px] text-foreground"
                >
                  {tierOptions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </td>
              <td className="px-6 py-4">
                <div className="flex flex-col gap-1.5">
                  <UsageBar label="5h" usage={row.window} />
                  <UsageBar label="Weekly" usage={row.weekly} />
                  <UsageBar label="Monthly" usage={row.monthly} />
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="flex flex-col gap-1 text-[11px]">
                  <input
                    type="date"
                    value={row.period_start.slice(0, 10)}
                    onChange={e => handlePeriodChange(row.user_id, 'period_start', e.target.value)}
                    className="px-2 py-1 rounded-lg border border-[var(--bone-12)] bg-background text-foreground"
                  />
                  <input
                    type="date"
                    value={row.period_end.slice(0, 10)}
                    onChange={e => handlePeriodChange(row.user_id, 'period_end', e.target.value)}
                    className="px-2 py-1 rounded-lg border border-[var(--bone-12)] bg-background text-foreground"
                  />
                </div>
              </td>
              <td className="px-6 py-4 text-right">
                {creditFormOpenFor === row.user_id ? (
                  <div className="flex flex-col gap-1.5 items-end">
                    <input
                      type="number"
                      placeholder="Amount USD"
                      value={creditAmount}
                      onChange={e => setCreditAmount(e.target.value)}
                      className="px-2 py-1 rounded-lg border border-[var(--bone-12)] bg-background text-[11px] text-foreground w-28"
                    />
                    <input
                      type="text"
                      placeholder="Note (optional)"
                      value={creditNote}
                      onChange={e => setCreditNote(e.target.value)}
                      className="px-2 py-1 rounded-lg border border-[var(--bone-12)] bg-background text-[11px] text-foreground w-28"
                    />
                    <div className="flex gap-1">
                      <button onClick={() => handleGrantCredit(row.user_id)} className="px-2 py-1 rounded-lg bg-accent text-accent-foreground text-[10px] font-medium">Grant</button>
                      <button onClick={() => setCreditFormOpenFor(null)} className="px-2 py-1 rounded-lg bg-background border border-[var(--bone-12)] text-[10px] font-medium">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setCreditFormOpenFor(row.user_id)}
                    className="px-3 py-1.5 rounded-lg bg-background border border-[var(--bone-6)] text-[10px] font-bold text-muted-foreground hover:text-foreground transition-all"
                  >
                    + Add Credit
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
