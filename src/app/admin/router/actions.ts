'use server'

import { supabaseAdmin as supabase } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'
import { logAdminAction } from '@/lib/admin/logAction'

export async function getRouterChains(platform: 'app' | 'telegram') {
  const { data, error } = await supabase
    .from('router_chains')
    .select('*')
    .eq('platform', platform)
    .order('category', { ascending: true })

  if (error) throw error
  return data
}

export async function updateRouterChain(id: string, modelList: any[]) {
  if (modelList.length > 10) {
    throw new Error('Maximum of 10 models allowed per chain')
  }
  const { error } = await supabase
    .from('router_chains')
    .update({
      model_list: modelList,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)

  if (error) throw error
  logAdminAction('router_changed', `Updated router chain ${id}`, { id })
  revalidatePath('/admin/app/router')
  revalidatePath('/admin/telegram/router')
  return { success: true }
}
export async function createRouterChain(platform: 'app' | 'telegram', category: string) {
  const { error } = await supabase
    .from('router_chains')
    .insert({
      platform,
      category,
      model_list: [],
      system_prompt: ''
    })

  if (error) throw error
  revalidatePath('/admin/app/router')
  revalidatePath('/admin/telegram/router')
  return { success: true }
}

export async function getFallbackModes(): Promise<Record<string, 'model_first' | 'api_key_first'>> {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'router_fallback_modes')
    .maybeSingle()

  if (error || !data?.value) return {}
  return data.value as Record<string, 'model_first' | 'api_key_first'>
}

export async function setFallbackMode(category: string, mode: 'model_first' | 'api_key_first') {
  const current = await getFallbackModes()
  current[category] = mode

  const { error } = await supabase
    .from('settings')
    .upsert({
      key: 'router_fallback_modes',
      value: current,
      updated_at: new Date().toISOString()
    })

  if (error) throw error
  revalidatePath('/admin/app/router')
  revalidatePath('/admin/telegram/router')
  return { success: true }
}

export async function getRouterTemperatures(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'router_temperatures')
    .maybeSingle()

  if (error || !data?.value) return {}
  return data.value as Record<string, number>
}

export async function setRouterTemperature(category: string, temp: number) {
  const current = await getRouterTemperatures()
  current[category] = temp

  const { error } = await supabase
    .from('settings')
    .upsert({
      key: 'router_temperatures',
      value: current,
      updated_at: new Date().toISOString()
    })

  if (error) throw error
  revalidatePath('/admin/app/router')
  revalidatePath('/admin/telegram/router')
  return { success: true }
}

