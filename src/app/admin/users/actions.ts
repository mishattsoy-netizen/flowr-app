'use server'

import { supabaseAdmin } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

export async function getUsers() {
  const { data, error } = await supabaseAdmin
    .from('telegram_users')
    .select(`
      *,
      limit_presets (
        name,
        daily_msg_limit
      )
    `)

  if (error) {
    console.error('Error fetching users:', error)
    return []
  }
  return data || []
}

export async function toggleUserBlock(telegramId: number, isBlocked: boolean) {
  const { error } = await supabaseAdmin
    .from('telegram_users')
    .update({ is_blocked: !isBlocked })
    .eq('telegram_id', telegramId)

  if (error) throw error
  revalidatePath('/admin/users')
}

export async function deleteUser(telegramId: number) {
  const { error } = await supabaseAdmin
    .from('telegram_users')
    .delete()
    .eq('telegram_id', telegramId)

  if (error) throw error
  revalidatePath('/admin/users')
}
