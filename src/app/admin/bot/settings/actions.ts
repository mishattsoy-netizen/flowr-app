'use server'

import { supabaseAdmin as supabase } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

// Helper to read a simple value from the settings key-value table
async function getSettingValue(key: string): Promise<any> {
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', key)
    .limit(1)
    .maybeSingle()
  return data?.value ?? null
}

async function setSettingValue(key: string, value: any): Promise<void> {
  const { error } = await supabase
    .from('settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw error
}

export async function getOllamaEnabled(): Promise<boolean> {
  const val = await getSettingValue('ollama_enabled')
  return val ?? false
}

export async function setOllamaEnabled(enabled: boolean): Promise<void> {
  await setSettingValue('ollama_enabled', enabled)
  revalidatePath('/admin/bot/global')
}

export async function getBackendModel(): Promise<string> {
  const val = await getSettingValue('backend_model')
  return val ?? 'gemini-2.0-flash'
}

export async function setBackendModel(model: string): Promise<void> {
  await setSettingValue('backend_model', model)
  revalidatePath('/admin/bot/global')
}

export async function getKeywordsEnabled(): Promise<boolean> {
  const val = await getSettingValue('classifier_keywords_enabled')
  return val ?? true
}

export async function setKeywordsEnabled(enabled: boolean): Promise<void> {
  await setSettingValue('classifier_keywords_enabled', enabled)
  revalidatePath('/admin/bot/global')
}
