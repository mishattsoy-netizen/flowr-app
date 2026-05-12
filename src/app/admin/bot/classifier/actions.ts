'use server'

import { supabaseAdmin as supabase } from '@/lib/supabase'
import { logAdminAction } from '@/lib/admin/logAction'
import { revalidatePath } from 'next/cache'
import type { BotMode } from '@/data/store.types'

export async function getClassifierConfig(mode: BotMode = 'default'): Promise<{ prompt: string | null; keywords: Record<string, string[]> | null }> {
  const [promptResult, keywordsResult] = await Promise.all([
    supabase
      .from('bot_settings')
      .select('content')
      .eq('category', 'classifier_prompt')
      .eq('mode', mode)
      .maybeSingle(),
    supabase
      .from('bot_settings')
      .select('content')
      .eq('category', 'classifier_keywords')
      .eq('mode', 'default')
      .maybeSingle(),
  ])

  if (promptResult.error) throw new Error(`DB error loading classifier prompt: ${promptResult.error.message}`)
  if (keywordsResult.error) throw new Error(`DB error loading classifier keywords: ${keywordsResult.error.message}`)

  const prompt = promptResult.data?.content ?? null

  let keywords: Record<string, string[]> | null = null
  if (keywordsResult.data?.content) {
    try { keywords = JSON.parse(keywordsResult.data.content) } catch { keywords = null }
  }

  return { prompt, keywords }
}

export async function saveClassifierPrompt(prompt: string, mode: BotMode = 'default'): Promise<void> {
  const { error } = await supabase
    .from('bot_settings')
    .upsert(
      { category: 'classifier_prompt', content: prompt, mode, updated_at: new Date().toISOString() },
      { onConflict: 'category,mode' }
    )
  if (error) throw error
  await logAdminAction('settings_saved', `Saved classifier prompt [${mode}]`, { mode })
  revalidatePath(`/admin/bot/${mode}`)
}

export async function saveClassifierKeywords(keywords: Record<string, string[]>): Promise<void> {
  const { error } = await supabase
    .from('bot_settings')
    .upsert(
      { category: 'classifier_keywords', content: JSON.stringify(keywords), mode: 'default', updated_at: new Date().toISOString() },
      { onConflict: 'category,mode' }
    )
  if (error) throw error
  await logAdminAction('settings_saved', 'Saved classifier keywords')
  revalidatePath('/admin/bot/keywords')
}

export async function getClassifierKeywords(): Promise<Record<string, string[]>> {
  const { data, error } = await supabase
    .from('bot_settings')
    .select('content')
    .eq('category', 'classifier_keywords')
    .eq('mode', 'default')
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data?.content) return {}
  try { return JSON.parse(data.content) } catch { return {} }
}

export async function saveClassifierConfig(prompt: string, keywords: Record<string, string[]>, mode: BotMode = 'default'): Promise<void> {
  await saveClassifierPrompt(prompt, mode)
  await saveClassifierKeywords(keywords)
}
