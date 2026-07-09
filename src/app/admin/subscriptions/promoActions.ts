'use server'

import { randomInt } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'
import { assertAdmin } from '@/lib/admin/assertAdmin'

export interface PromoCodeRow {
  code: string
  tier_id: string
  tier_name: string
  duration_days: number
  max_uses: number
  uses_count: number
  created_at: string
  expires_at: string | null
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // excludes ambiguous 0/O/1/I
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars[randomInt(chars.length)]
  }
  return code
}

export async function listPromoCodes(accessToken: string): Promise<PromoCodeRow[]> {
  await assertAdmin(accessToken)

  const { data, error } = await supabaseAdmin
    .from('promo_codes')
    .select('*, subscription_tiers(name)')
    .order('created_at', { ascending: false })

  if (error || !data) {
    console.error('[listPromoCodes] Failed to fetch:', error)
    return []
  }

  return data.map((row: any) => ({
    code: row.code,
    tier_id: row.tier_id,
    tier_name: row.subscription_tiers?.name ?? row.tier_id,
    duration_days: row.duration_days,
    max_uses: row.max_uses,
    uses_count: row.uses_count,
    created_at: row.created_at,
    expires_at: row.expires_at,
  }))
}

export async function createPromoCode(accessToken: string, tierId: string, durationDays: number, maxUses: number): Promise<{ code: string }> {
  await assertAdmin(accessToken)

  const code = generateCode()
  const { error } = await supabaseAdmin
    .from('promo_codes')
    .insert({ code, tier_id: tierId, duration_days: durationDays, max_uses: maxUses })

  if (error) throw new Error(error.message)
  revalidatePath('/admin/subscriptions')
  return { code }
}
