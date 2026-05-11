'use server'

import { supabaseAdmin as supabase } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'
import { logAdminAction } from '@/lib/admin/logAction'

export async function getRouterChains(platform: 'app' | 'telegram') {
  const { data, error } = await supabase
    .from('router_chains')
    .select('*')
    .eq('platform', platform)

  if (error) throw error

  // Try to get custom order
  const order = await getRouterOrder(platform)
  if (order && order.length > 0) {
    return data.sort((a: any, b: any) => {
      const indexA = order.indexOf(a.id)
      const indexB = order.indexOf(b.id)
      if (indexA === -1 && indexB === -1) return 0
      if (indexA === -1) return 1
      if (indexB === -1) return -1
      return indexA - indexB
    })
  }

  // Fallback to category alphabetical order
  return data.sort((a: any, b: any) => a.category.localeCompare(b.category))
}

export async function getRouterOrder(platform: 'app' | 'telegram'): Promise<string[]> {
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', `router_chains_order_${platform}`)
    .maybeSingle()
  return (data?.value as string[]) ?? []
}

export async function saveRouterOrder(platform: 'app' | 'telegram', order: string[]) {
  const { error } = await supabase
    .from('settings')
    .upsert({
      key: `router_chains_order_${platform}`,
      value: order,
      updated_at: new Date().toISOString()
    })
  if (error) throw error
  revalidatePath('/admin/app/router')
  revalidatePath('/admin/telegram/router')
  return { success: true }
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

export async function updateRouterSystemPrompt(id: string, systemPrompt: string) {
  const { error } = await supabase
    .from('router_chains')
    .update({
      system_prompt: systemPrompt,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)

  if (error) throw error
  logAdminAction('router_changed', `Updated system prompt for chain ${id}`, { id })
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

export async function getInternalPrompts(): Promise<Record<string, string>> {
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'pipeline_internal_prompts')
    .maybeSingle()
  return (data?.value as Record<string, string>) ?? {}
}

export async function saveInternalPrompt(chainType: string, prompt: string) {
  const current = await getInternalPrompts()
  current[chainType] = prompt
  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'pipeline_internal_prompts', value: current, updated_at: new Date().toISOString() })
  if (error) throw error
  revalidatePath('/admin/app/router')
  revalidatePath('/admin/telegram/router')
  return { success: true }
}

export async function resetInternalPrompt(chainType: string) {
  const current = await getInternalPrompts()
  delete current[chainType]
  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'pipeline_internal_prompts', value: current, updated_at: new Date().toISOString() })
  if (error) throw error
  revalidatePath('/admin/app/router')
  revalidatePath('/admin/telegram/router')
  return { success: true }
}

export async function getInternalPromptsFull() {
  const { data } = await supabase
    .from('settings')
    .select('value, updated_at')
    .eq('key', 'pipeline_internal_prompts')
    .maybeSingle()
  return {
    value: (data?.value as Record<string, string>) ?? {},
    updated_at: data?.updated_at ?? null
  }
}

export async function getStatusMessages(): Promise<Record<string, { label: string; emoji: string }>> {
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'pipeline_status_messages')
    .maybeSingle()
  return (data?.value as Record<string, { label: string; emoji: string }>) ?? {}
}

export async function saveStatusMessage(chainType: string, label: string, emoji: string) {
  const current = await getStatusMessages()
  current[chainType] = { label, emoji }
  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'pipeline_status_messages', value: current, updated_at: new Date().toISOString() })
  if (error) throw error
  revalidatePath('/admin/app/router')
  revalidatePath('/admin/telegram/router')
  return { success: true }
}

export async function getPipelineSettings() {
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'pipeline_settings')
    .maybeSingle()
  return (data?.value as any) ?? {}
}

export async function savePipelineSetting(key: string, value: any) {
  const current = await getPipelineSettings()
  current[key] = value
  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'pipeline_settings', value: current, updated_at: new Date().toISOString() })
  if (error) throw error
  revalidatePath('/admin/app/router')
  revalidatePath('/admin/telegram/router')
  return { success: true }
}
