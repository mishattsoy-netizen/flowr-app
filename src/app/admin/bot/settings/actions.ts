'use server'

import { supabaseAdmin as supabase } from '@/lib/supabase'
import { recompilePrompt, recompileAllModes } from '@/lib/bot/compilePrompt'
import { logAdminAction } from '@/lib/admin/logAction'
import { revalidatePath } from 'next/cache'
import type { BotMode } from '@/data/store.types'

export type SettingsCategory = 'core_rules' | 'personality' | 'answer_style' | 'thinking_pattern' | 'restrictions'

export interface BotSetting {
  category: SettingsCategory
  content: string
  is_active: boolean
  mode: BotMode
  updated_at: string
}

export async function getSettings(mode: BotMode = 'default'): Promise<BotSetting[]> {
  const { data, error } = await supabase
    .from('bot_settings')
    .select('*')
    .eq('mode', mode)
    .in('category', ['core_rules', 'personality', 'answer_style', 'thinking_pattern', 'restrictions'])
    .order('category')
  if (error) throw error
  return (data ?? []) as BotSetting[]
}

export async function saveSettingBlock(category: SettingsCategory, content: string, mode: BotMode = 'default'): Promise<void> {
  const { error } = await supabase
    .from('bot_settings')
    .upsert(
      { category, content, mode, updated_at: new Date().toISOString() },
      { onConflict: 'category,mode' }
    )
  if (error) throw error
  await recompilePrompt(mode)
  await logAdminAction('settings_saved', `Saved ${category.replace('_', ' ')} prompt [${mode}]`, { category, mode })
  revalidatePath(`/admin/bot/${mode}`)
}

export async function toggleSettingBlock(category: SettingsCategory, isActive: boolean, mode: BotMode = 'default'): Promise<void> {
  const { error } = await supabase
    .from('bot_settings')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('category', category)
    .eq('mode', mode)
  if (error) throw error
  await recompilePrompt(mode)
  revalidatePath(`/admin/bot/${mode}`)
}

export async function syncCompiledPrompt(mode?: BotMode): Promise<void> {
  if (mode) {
    await recompilePrompt(mode)
  } else {
    await recompileAllModes()
  }
  await logAdminAction('prompt_synced', mode ? `Manual sync for ${mode} mode` : 'Manual sync all modes')
  revalidatePath('/admin/bot/global')
}

export async function getCompiledPromptMeta(mode: BotMode = 'default'): Promise<{ content: string; compiled_at: string; entry_count: number }> {
  const { data, error } = await supabase
    .from('bot_compiled_prompt')
    .select('*')
    .eq('mode', mode)
    .single()
  if (error || !data) return { content: '', compiled_at: '', entry_count: 0 }
  return data as { content: string; compiled_at: string; entry_count: number }
}

export async function setGlobalPromptEnabled(enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from('bot_compiled_prompt')
    .update({ global_enabled: enabled })
  if (error) throw error
  await logAdminAction('prompt_synced', `Global prompt ${enabled ? 'enabled' : 'disabled'}`, { enabled })
  revalidatePath('/admin/bot/global')
}

export async function getGlobalEnabled(): Promise<boolean> {
  const { data } = await supabase
    .from('bot_compiled_prompt')
    .select('global_enabled')
    .eq('mode', 'default')
    .single()
  return data?.global_enabled ?? true
}

export async function getOllamaEnabled(): Promise<boolean> {
  const { data } = await supabase
    .from('bot_compiled_prompt')
    .select('ollama_enabled')
    .eq('mode', 'default')
    .single()
  return data?.ollama_enabled ?? false
}

export async function setOllamaEnabled(enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from('bot_compiled_prompt')
    .update({ ollama_enabled: enabled })
  if (error) throw error
  revalidatePath('/admin/bot/global')
}

export async function getBackendModel(): Promise<string> {
  const { data } = await supabase
    .from('bot_compiled_prompt')
    .select('backend_model')
    .eq('mode', 'default')
    .single()
  return data?.backend_model ?? 'gemini-2.0-flash'
}

export async function setBackendModel(model: string): Promise<void> {
  const { error } = await supabase
    .from('bot_compiled_prompt')
    .update({ backend_model: model })
  if (error) throw error
  revalidatePath('/admin/bot/global')
}
