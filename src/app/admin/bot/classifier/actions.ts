'use server'

import { supabaseAdmin as supabase } from '@/lib/supabase'
import { logAdminAction } from '@/lib/admin/logAction'
import { revalidatePath } from 'next/cache'
import { DEFAULT_CLASSIFICATION_PROMPT, DEFAULT_KEYWORDS } from './defaults'
import type { BotMode } from '@/data/store.types'

export async function getClassifierConfig(mode: BotMode = 'default'): Promise<{ prompt: string; keywords: Record<string, string[]> }> {
  try {
    const { data: promptBlock } = await supabase
      .from('bot_settings')
      .select('content')
      .eq('category', 'classifier_prompt')
      .eq('mode', mode)
      .maybeSingle()

    const { data: keywordsBlock } = await supabase
      .from('bot_settings')
      .select('content')
      .eq('category', 'classifier_keywords')
      .eq('mode', 'default')
      .maybeSingle()

    const prompt = promptBlock?.content || DEFAULT_CLASSIFICATION_PROMPT
    let keywords = DEFAULT_KEYWORDS
    if (keywordsBlock?.content) {
      try { keywords = JSON.parse(keywordsBlock.content) } catch { keywords = DEFAULT_KEYWORDS }
    }
    return { prompt, keywords }
  } catch (err) {
    console.error('getClassifierConfig error:', err)
    return { prompt: DEFAULT_CLASSIFICATION_PROMPT, keywords: DEFAULT_KEYWORDS }
  }
}

export async function saveClassifierConfig(prompt: string, keywords: Record<string, string[]>, mode: BotMode = 'default'): Promise<void> {
  const { error: err1 } = await supabase
    .from('bot_settings')
    .upsert(
      { category: 'classifier_prompt', content: prompt, mode, updated_at: new Date().toISOString() },
      { onConflict: 'category,mode' }
    )
  if (err1) throw err1

  const { error: err2 } = await supabase
    .from('bot_settings')
    .upsert(
      { category: 'classifier_keywords', content: JSON.stringify(keywords), mode: 'default', updated_at: new Date().toISOString() },
      { onConflict: 'category,mode' }
    )
  if (err2) throw err2

  await logAdminAction('settings_saved', `Saved classifier config [${mode}]`, { mode })
  revalidatePath(`/admin/bot/${mode}`)
}
