'use server'

import { createClient } from '@supabase/supabase-js'
import { supabaseUrl, supabaseAnonKey } from '@/lib/supabase'

export async function redeemPromoCode(code: string, accessToken: string): Promise<{ success: boolean; error?: string }> {
  if (!code.trim()) return { success: false, error: 'Enter a code' }

  const supabase = createClient(
    supabaseUrl!,
    supabaseAnonKey!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )

  const { data, error } = await supabase.rpc('redeem_promo_code', { p_code: code.trim().toUpperCase() }).single()

  if (error) {
    console.error('[redeemPromoCode] RPC error:', error)
    return { success: false, error: 'Something went wrong. Try again.' }
  }

  const result = data as { success: boolean; error: string | null }
  if (!result.success) {
    const messages: Record<string, string> = {
      not_authenticated: 'You need to be signed in.',
      invalid_code: 'That code doesn\'t exist.',
      code_expired: 'That code has expired.',
      max_uses_reached: 'That code has already been fully redeemed.',
      already_redeemed: 'You\'ve already redeemed this code.',
    }
    return { success: false, error: messages[result.error ?? ''] ?? 'Invalid code.' }
  }

  return { success: true }
}
