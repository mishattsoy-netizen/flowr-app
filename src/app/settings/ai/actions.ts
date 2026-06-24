'use server'

import { supabaseAdmin } from '@/lib/supabase'

export async function getAiUserDescription(userId: string): Promise<string | null> {
  if (!supabaseAdmin) return null

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
  if (!supabaseAdmin) {
    return { success: false, error: 'Database not available' }
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

export async function getAiCreatorInfo(userId: string): Promise<string | null> {
  if (!supabaseAdmin) return null

  const { data, error } = await supabaseAdmin
    .from('settings')
    .select('value')
    .eq('key', 'ai_creator_info')
    .eq('owner_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[getAiCreatorInfo]', error)
    return null
  }

  return (data?.value as { description?: string })?.description ?? null
}

export async function saveAiCreatorInfo(userId: string, description: string): Promise<{ success: boolean; error?: string }> {
  if (!supabaseAdmin) {
    return { success: false, error: 'Database not available' }
  }

  const { error } = await supabaseAdmin
    .from('settings')
    .upsert(
      {
        key: 'ai_creator_info',
        value: { description, updated_at: new Date().toISOString() },
        owner_id: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'owner_id,key' }
    )

  if (error) {
    console.error('[saveAiCreatorInfo]', error)
    return { success: false, error: error.message }
  }

  return { success: true }
}
