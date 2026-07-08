import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin, isSupabaseEnabled, supabaseUrl, supabaseAnonKey } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  if (!isSupabaseEnabled) {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase admin not configured' }, { status: 500 })
  }

  const supabase = createClient(
    supabaseUrl!,
    supabaseAnonKey!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
  )
  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: sub } = await supabaseAdmin
    .from('user_subscriptions')
    .select('*, subscription_tiers(*)')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!sub) {
    return NextResponse.json({ error: 'No subscription record' }, { status: 404 })
  }

  const tier = (sub as any).subscription_tiers
  if (!tier) {
    return NextResponse.json({ error: 'No subscription tier configured' }, { status: 404 })
  }

  const monthlyCredit = tier.price_usd * tier.credit_percent / 100
  const weeklyCap = monthlyCredit * tier.weekly_tightness / 4.33
  const windowCap = weeklyCap / Math.max(tier.sessions_per_week, 1)

  const now = new Date()
  const window5hAnchor = sub.window_5h_anchor ? new Date(sub.window_5h_anchor) : now
  const windowWeekAnchor = sub.window_week_anchor ? new Date(sub.window_week_anchor) : now

  const [{ data: spend5h }, { data: spendWeek }, { data: spendMonth }] = await Promise.all([
    supabaseAdmin.from('credit_spend_events').select('amount_usd').eq('user_id', user.id).gte('created_at', window5hAnchor.toISOString()),
    supabaseAdmin.from('credit_spend_events').select('amount_usd').eq('user_id', user.id).gte('created_at', windowWeekAnchor.toISOString()),
    supabaseAdmin.from('credit_spend_events').select('amount_usd').eq('user_id', user.id).gte('created_at', sub.period_start),
  ])

  const sum = (rows: any[] | null) => (rows ?? []).reduce((acc, r) => acc + Number(r.amount_usd), 0)

  return NextResponse.json({
    tier: { id: tier.id, name: tier.name },
    window: {
      spent: sum(spend5h),
      cap: windowCap,
      resets_at: new Date(window5hAnchor.getTime() + tier.window_hours * 3600_000).toISOString(),
    },
    weekly: {
      spent: sum(spendWeek),
      cap: weeklyCap,
      resets_at: new Date(windowWeekAnchor.getTime() + 7 * 24 * 3600_000).toISOString(),
    },
    monthly: {
      spent: sum(spendMonth),
      cap: monthlyCredit,
      resets_at: sub.period_end,
    },
  })
}
