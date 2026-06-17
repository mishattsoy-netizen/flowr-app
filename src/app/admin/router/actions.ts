'use server'

import { supabaseAdmin as supabase } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'
import { logAdminAction } from '@/lib/admin/logAction'

export async function getRouterChains(platform: 'app' | 'telegram') {
  // Purge any legacy IMAGE_UPSCALE rows from the database
  await supabase
    .from('router_chains')
    .delete()
    .eq('category', 'IMAGE_UPSCALE')

  const { data, error } = await supabase
    .from('router_chains')
    .select('*')
    .eq('platform', platform)

  if (error) throw error

  const filtered = (data ?? []).filter((r: any) => r.category !== 'IMAGE_UPSCALE')

  // Try to get custom order
  const order = await getRouterOrder(platform)
  if (order && order.length > 0) {
    return filtered.sort((a: any, b: any) => {
      const indexA = order.indexOf(a.id)
      const indexB = order.indexOf(b.id)
      if (indexA === -1 && indexB === -1) return 0
      if (indexA === -1) return 1
      if (indexB === -1) return -1
      return indexA - indexB
    })
  }

  // Fallback to category alphabetical order
  return filtered.sort((a: any, b: any) => a.category.localeCompare(b.category))
}

export async function getRouterOrder(platform: 'app' | 'telegram'): Promise<string[]> {
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', `router_chains_order_${platform}`)
    .limit(1)
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
    .limit(1)
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
    .limit(1)
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
    .limit(1)
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

export async function syncInternalPromptsFromFiles(): Promise<{ synced: string[]; skipped: string[]; errors: string[] }> {
  const fs = await import('fs')
  const path = await import('path')

  const FILE_MAP: Record<string, string> = {
    THINKING:      'pipeline-thinking.txt',
    VISION:        'pipeline-vision.txt',
    WEB_SEARCH:    'pipeline-web-search.txt',
    RESEARCH:      'pipeline-research.txt',
    CODING:        'pipeline-coding.txt',
    TOOLS:         'pipeline-tools.txt',
    IMAGE_GEN:     'pipeline-image-gen.txt',
  }

  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'pipeline_internal_prompts')
    .limit(1)
    .maybeSingle()
  const current: Record<string, string> = (data?.value as Record<string, string>) ?? {}

  const synced: string[] = []
  const skipped: string[] = []
  const errors: string[] = []

  for (const [chainType, fileName] of Object.entries(FILE_MAP)) {
    try {
      const filePath = path.join(process.cwd(), 'bot prompts(premission to edit needed!)', fileName)
      if (!fs.existsSync(filePath)) { skipped.push(chainType); continue }
      const content = fs.readFileSync(filePath, 'utf8').trim()
      if (!content) { skipped.push(chainType); continue }
      current[chainType] = content
      synced.push(chainType)
    } catch (e: any) {
      errors.push(`${chainType}: ${e.message}`)
    }
  }

  if (synced.length > 0) {
    const { error } = await supabase
      .from('settings')
      .upsert({ key: 'pipeline_internal_prompts', value: current, updated_at: new Date().toISOString() })
    if (error) throw new Error(error.message)
    revalidatePath('/admin/app/router')
    revalidatePath('/admin/telegram/router')
  }

  return { synced, skipped, errors }
}

export async function getInternalPromptsFull() {
  const { data } = await supabase
    .from('settings')
    .select('value, updated_at')
    .eq('key', 'pipeline_internal_prompts')
    .limit(1)
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
    .limit(1)
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
    .limit(1)
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

export async function getSubchainConfigsAction() {
  const { getAllSubchainConfigs } = await import('@/lib/subchain-config')
  return getAllSubchainConfigs()
}

export async function saveSubchainConfigsAction(configs: any[]) {
  const { invalidateSubchainCache } = await import('@/lib/subchain-config')
  invalidateSubchainCache()
  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'subchain_configs', value: configs, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw new Error(error.message)
  revalidatePath('/admin/app/router')
  revalidatePath('/admin/telegram/router')
  return { success: true }
}

export async function getLayeredPromptPreview(category: string, mode: 'default' | 'pro') {
  const { getCompiledPrompt, getInternalPrompt } = await import('@/lib/bot/compilePrompt')
  const [globalPrompt, systemPrompt] = await Promise.all([
    getCompiledPrompt(mode),
    getInternalPrompt(category, mode)
  ])

  return {
    globalPrompt,
    systemPrompt,
    dynamicContext: {
      date: new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    },
    mockHistory: [
      { role: 'user', content: 'What is the current weather in Tokyo?' },
      { role: 'assistant', content: 'The current weather in Tokyo is 22°C with light rain.' }
    ]
  }
}
