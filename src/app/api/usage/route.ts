import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin, isSupabaseEnabled, supabaseUrl, supabaseAnonKey } from '@/lib/supabase'
import { computeUsageWindows } from '@/lib/bot/services/usageWindows'

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

  const [{ data: spend5h }, { data: spendWeek }, { data: spendMonth }, { data: recentSpend }] = await Promise.all([
    supabaseAdmin.from('credit_spend_events').select('amount_usd').eq('user_id', user.id).gte('created_at', sub.window_5h_anchor ?? sub.period_start),
    supabaseAdmin.from('credit_spend_events').select('amount_usd').eq('user_id', user.id).gte('created_at', sub.window_week_anchor ?? sub.period_start),
    supabaseAdmin.from('credit_spend_events').select('amount_usd').eq('user_id', user.id).gte('created_at', sub.period_start),
    supabaseAdmin.from('credit_spend_events').select('amount_usd, created_at, mode').eq('user_id', user.id).eq('is_reservation', false).order('created_at', { ascending: false }).limit(10),
  ])

  const sum = (rows: any[] | null) => (rows ?? []).reduce((acc, r) => acc + Number(r.amount_usd), 0)

  const windows = computeUsageWindows(sub, tier, {
    spend5h: sum(spend5h),
    spendWeek: sum(spendWeek),
    spendMonth: sum(spendMonth),
  })

  return NextResponse.json({
    tier: { id: tier.id, name: tier.name, price_usd: tier.price_usd },
    ...windows,
    recentSpend: recentSpend ?? [],
  })
}
