'use server'

import { supabaseAdmin } from '@/lib/supabase'
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { verifyTelegramLinkToken } from '@/lib/bot/telegramLinkToken'

export async function linkTelegramAccount(telegramId: number, token: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!token || !verifyTelegramLinkToken(telegramId, token)) {
      return { success: false, error: 'This link is invalid or has expired. Send /login to the bot again.' }
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return { success: false, error: 'Not authenticated' }

    // Check if this telegram ID is already linked to another user
    const { data: existing } = await supabaseAdmin
      .from('telegram_users')
      .select('auth_user_id')
      .eq('telegram_id', telegramId)
      .single()

    if (existing?.auth_user_id && existing.auth_user_id !== user.id) {
      return { success: false, error: 'This Telegram account is already linked to another user.' }
    }

    const { error } = await supabaseAdmin
      .from('telegram_users')
      .update({ auth_user_id: user.id })
      .eq('telegram_id', telegramId)

    if (error) return { success: false, error: error.message }

    revalidatePath('/admin/users')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function unlinkTelegramAccount(telegramId: number): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return { success: false, error: 'Not authenticated' }

    // Only the linked user can unlink
    const { data: existing } = await supabaseAdmin
      .from('telegram_users')
      .select('auth_user_id')
      .eq('telegram_id', telegramId)
      .single()

    if (existing?.auth_user_id !== user.id) {
      return { success: false, error: 'This Telegram account is not linked to your account.' }
    }

    const { error } = await supabaseAdmin
      .from('telegram_users')
      .update({ auth_user_id: null })
      .eq('telegram_id', telegramId)

    if (error) return { success: false, error: error.message }

    revalidatePath('/admin/users')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}
