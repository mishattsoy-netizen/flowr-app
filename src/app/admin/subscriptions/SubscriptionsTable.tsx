'use client'

import { useState } from 'react'
import { Send, ShieldAlert, ShieldCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { updateUserTier, updateUserPeriod, grantBonusCredit, toggleTelegramBlock, type SubscriptionRow } from './actions'

async function getAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not authenticated')
  return token
}

function UsageBar({ label, usage }: { label: string; usage: { spent: number; cap: number } }) {
  const pct = usage.cap > 0 ? Math.min(100, (usage.spent / usage.cap) * 100) : 0
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-[var(--bone-70)] leading-none">
      <span className="w-10 shrink-0 opacity-70">{label}</span>
      <div className="w-14 h-1 rounded-sm bg-[var(--bone-10)] overflow-hidden shrink-0">
        <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono whitespace-nowrap">${usage.spent.toFixed(3)}/{usage.cap.toFixed(1)}</span>
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
    const token = await getAccessToken()
    await updateUserTier(token, userId, tierId)
    setRows(prev => prev.map(r => r.user_id === userId ? { ...r, tier_id: tierId, granted_by_promo_code: null } : r))
  }

  async function handlePeriodChange(userId: string, field: 'period_start' | 'period_end', value: string) {
    const row = rows.find(r => r.user_id === userId)
    if (!row) return
    const nextStart = field === 'period_start' ? value : row.period_start
    const nextEnd = field === 'period_end' ? value : row.period_end
    const token = await getAccessToken()
    await updateUserPeriod(token, userId, new Date(nextStart).toISOString(), new Date(nextEnd).toISOString())
    setRows(prev => prev.map(r => r.user_id === userId ? { ...r, period_start: nextStart, period_end: nextEnd } : r))
  }

  async function handleGrantCredit(userId: string) {
    const amount = parseFloat(creditAmount)
    if (!Number.isFinite(amount) || amount <= 0) return
    const token = await getAccessToken()
    await grantBonusCredit(token, userId, amount, creditNote)
    setCreditFormOpenFor(null)
    setCreditAmount('')
    setCreditNote('')
    setRows(prev => prev.map(r => r.user_id === userId
      ? { ...r, window: { ...r.window, spent: r.window.spent - amount }, weekly: { ...r.weekly, spent: r.weekly.spent - amount }, monthly: { ...r.monthly, spent: r.monthly.spent - amount } }
      : r))
  }

  async function handleToggleTelegramBlock(userId: string, telegramId: number, currentlyBlocked: boolean) {
    const token = await getAccessToken()
    await toggleTelegramBlock(token, telegramId, currentlyBlocked)
    setRows(prev => prev.map(r => r.user_id === userId && r.telegram
      ? { ...r, telegram: { ...r.telegram, is_blocked: !currentlyBlocked } }
      : r))
  }

  if (rows.length === 0) {
    return (
      <div className="p-8 text-center text-bone-70">
        <p className="text-sm font-bold tracking-tight">No subscriptions yet.</p>
        <p className="text-[10px] mt-1.5 font-bold opacity-30 tracking-tight">Rows appear once a user sends their first chat message.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto bg-panel rounded-[var(--radius-medium)] border border-[var(--bone-6)]">
      <table className="w-full text-left border-collapse text-[12px]">
        <thead>
          <tr className="bg-white/5 border-b border-[var(--bone-6)]">
            <th className="px-3 py-2 text-[10px] font-ui-label font-bold text-muted-foreground/40 tracking-widest uppercase">User</th>
            <th className="px-3 py-2 text-[10px] font-ui-label font-bold text-muted-foreground/40 tracking-widest uppercase">Tier</th>
            <th className="px-3 py-2 text-[10px] font-ui-label font-bold text-muted-foreground/40 tracking-widest uppercase">Usage</th>
            <th className="px-3 py-2 text-[10px] font-ui-label font-bold text-muted-foreground/40 tracking-widest uppercase">Period</th>
            <th className="px-3 py-2 text-[10px] font-ui-label font-bold text-muted-foreground/40 tracking-widest uppercase text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--bone-6)]">
          {rows.map(row => (
            <tr key={row.user_id} className="hover:bg-[var(--bone-6)] transition-colors">
              <td className="px-3 py-1.5 align-top">
                <div className="text-[12px] font-medium text-muted-foreground leading-tight">{row.email}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {row.granted_by_promo_code && (
                    <span className="text-[9px] text-accent font-mono">via {row.granted_by_promo_code}</span>
                  )}
                  {row.telegram && (
                    <button
                      onClick={() => handleToggleTelegramBlock(row.user_id, row.telegram!.telegram_id, row.telegram!.is_blocked)}
                      title={row.telegram.is_blocked ? 'Blocked — click to unblock' : 'Active — click to block'}
                      className={
                        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[9px] font-medium border transition-colors " +
                        (row.telegram.is_blocked
                          ? "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20"
                          : "bg-[var(--bone-6)] text-muted-foreground border-[var(--bone-6)] hover:text-foreground")
                      }
                    >
                      {row.telegram.is_blocked ? <ShieldAlert className="w-2.5 h-2.5" /> : <Send className="w-2.5 h-2.5" />}
                      {row.telegram.username ? `@${row.telegram.username}` : row.telegram.telegram_id}
                    </button>
                  )}
                </div>
              </td>
              <td className="px-3 py-1.5 align-top">
                <select
                  value={row.tier_id}
                  onChange={e => handleTierChange(row.user_id, e.target.value)}
                  className="px-1.5 py-1 rounded-sm border border-[var(--bone-12)] bg-background text-[11px] text-foreground"
                >
                  {tierOptions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </td>
              <td className="px-3 py-1.5 align-top">
                <div className="flex flex-col gap-0.5">
                  <UsageBar label="5h" usage={row.window} />
                  <UsageBar label="Week" usage={row.weekly} />
                  <UsageBar label="Month" usage={row.monthly} />
                </div>
              </td>
              <td className="px-3 py-1.5 align-top">
                <div className="flex flex-col gap-0.5 text-[10px]">
                  <input
                    type="date"
                    value={row.period_start.slice(0, 10)}
                    onChange={e => handlePeriodChange(row.user_id, 'period_start', e.target.value)}
                    className="px-1.5 py-0.5 rounded-sm border border-[var(--bone-12)] bg-background text-foreground"
                  />
                  <input
                    type="date"
                    value={row.period_end.slice(0, 10)}
                    onChange={e => handlePeriodChange(row.user_id, 'period_end', e.target.value)}
                    className="px-1.5 py-0.5 rounded-sm border border-[var(--bone-12)] bg-background text-foreground"
                  />
                </div>
              </td>
              <td className="px-3 py-1.5 align-top text-right">
                {creditFormOpenFor === row.user_id ? (
                  <div className="flex flex-col gap-1 items-end">
                    <input
                      type="number"
                      placeholder="Amount USD"
                      value={creditAmount}
                      onChange={e => setCreditAmount(e.target.value)}
                      className="px-1.5 py-0.5 rounded-sm border border-[var(--bone-12)] bg-background text-[10px] text-foreground w-24"
                    />
                    <input
                      type="text"
                      placeholder="Note (optional)"
                      value={creditNote}
                      onChange={e => setCreditNote(e.target.value)}
                      className="px-1.5 py-0.5 rounded-sm border border-[var(--bone-12)] bg-background text-[10px] text-foreground w-24"
                    />
                    <div className="flex gap-1">
                      <button onClick={() => handleGrantCredit(row.user_id)} className="px-2 py-0.5 rounded-sm bg-accent text-accent-foreground text-[9px] font-medium">Grant</button>
                      <button onClick={() => setCreditFormOpenFor(null)} className="px-2 py-0.5 rounded-sm bg-background border border-[var(--bone-12)] text-[9px] font-medium">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setCreditFormOpenFor(row.user_id)}
                    className="px-2 py-1 rounded-sm bg-background border border-[var(--bone-6)] text-[9px] font-bold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    + Credit
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
