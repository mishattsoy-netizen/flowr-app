'use server'

import { supabaseAdmin } from '@/lib/supabase'

export async function getAiUserDescription(userId: string): Promise<string | null> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)
  if (!isUuid || !supabaseAdmin) return null

  const { data, error } = await supabaseAdmin
    .from('settings')
    .select('value')
    .eq('key', 'ai_user_description')
    .eq('owner_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[getAiUserDescription]', error)
    return null
  }

  return (data?.value as { description?: string })?.description ?? null
}

export async function saveAiUserDescription(userId: string, description: string): Promise<{ success: boolean; error?: string }> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)
  if (!isUuid || !supabaseAdmin) {
    return { success: false, error: 'Database not available or invalid user ID' }
  }

  const { error } = await supabaseAdmin
    .from('settings')
    .upsert(
      {
        key: 'ai_user_description',
        value: { description, updated_at: new Date().toISOString() },
        owner_id: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'owner_id,key' }
    )

  if (error) {
    console.error('[saveAiUserDescription]', error)
    return { success: false, error: error.message }
  }

  return { success: true }
}

