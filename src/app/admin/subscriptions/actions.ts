'use server'

import { supabaseAdmin } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'
import { computeUsageWindows } from '@/lib/bot/services/usageWindows'

export interface SubscriptionRow {
  user_id: string
  email: string
  tier_id: string
  tier_name: string
  period_start: string
  period_end: string
  granted_by_promo_code: string | null
  window: { spent: number; cap: number; resets_at: string }
  weekly: { spent: number; cap: number; resets_at: string }
  monthly: { spent: number; cap: number; resets_at: string }
}

export async function getSubscriptions(): Promise<SubscriptionRow[]> {
  const { data: subs, error } = await supabaseAdmin
    .from('user_subscriptions')
    .select('*, subscription_tiers(*)')

  if (error || !subs) {
    console.error('[getSubscriptions] Failed to fetch subscriptions:', error)
    return []
  }

  const { data: userList } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
  const emailByUserId = new Map((userList?.users ?? []).map((u: any) => [u.id, u.email as string]))

  const rows = await Promise.all(subs.map(async (sub: any) => {
    const tier = sub.subscription_tiers
    const [{ data: spend5h }, { data: spendWeek }, { data: spendMonth }] = await Promise.all([
      supabaseAdmin.from('credit_spend_events').select('amount_usd').eq('user_id', sub.user_id).gte('created_at', sub.window_5h_anchor ?? sub.period_start),
      supabaseAdmin.from('credit_spend_events').select('amount_usd').eq('user_id', sub.user_id).gte('created_at', sub.window_week_anchor ?? sub.period_start),
      supabaseAdmin.from('credit_spend_events').select('amount_usd').eq('user_id', sub.user_id).gte('created_at', sub.period_start),
    ])
    const sum = (rows: any[] | null) => (rows ?? []).reduce((acc, r) => acc + Number(r.amount_usd), 0)
    const windows = computeUsageWindows(sub, tier, {
      spend5h: sum(spend5h),
      spendWeek: sum(spendWeek),
      spendMonth: sum(spendMonth),
    })

    return {
      user_id: sub.user_id,
      email: emailByUserId.get(sub.user_id) ?? '(unknown)',
      tier_id: sub.tier_id,
      tier_name: tier?.name ?? sub.tier_id,
      period_start: sub.period_start,
      period_end: sub.period_end,
      granted_by_promo_code: sub.granted_by_promo_code,
      ...windows,
    }
  }))

  return rows
}

export async function updateUserTier(userId: string, tierId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('user_subscriptions')
    .update({
      tier_id: tierId,
      granted_by_promo_code: null,
      period_start: new Date().toISOString(),
      period_end: new Date(Date.now() + 30 * 24 * 3600_000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
  revalidatePath('/admin/subscriptions')
}

export async function updateUserPeriod(userId: string, periodStart: string, periodEnd: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('user_subscriptions')
    .update({ period_start: periodStart, period_end: periodEnd, updated_at: new Date().toISOString() })
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
  revalidatePath('/admin/subscriptions')
}

export async function grantBonusCredit(userId: string, amountUsd: number, note: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('credit_spend_events')
    .insert({
      user_id: userId,
      request_id: crypto.randomUUID(),
      amount_usd: -Math.abs(amountUsd),
      mode: 'admin_grant',
      is_reservation: false,
      note: note || null,
    })

  if (error) throw new Error(error.message)
  revalidatePath('/admin/subscriptions')
}

export async function getTierOptions(): Promise<Array<{ id: string; name: string }>> {
  const { data } = await supabaseAdmin.from('subscription_tiers').select('id, name').order('price_usd', { ascending: true })
  return data ?? []
}
