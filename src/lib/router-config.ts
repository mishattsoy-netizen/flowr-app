import { supabaseAdmin as supabase } from './supabase'

export interface RouterModel {
  id: string
  provider: 'google' | 'huggingface' | 'cloudflare' | 'groq' | 'local' | 'vault' | 'pollinations' | 'ollama' | 'ollama(my pc)' | 'openrouter' | 'siliconflow'
  is_enabled: boolean
  openrouter_provider?: string
  is_paid?: boolean
  prompt_cost?: number
  completion_cost?: number
}

export type IntentCategory =
  | 'FAST_SIMPLE'
  | 'COMPLEX_THINKING'
  | 'MEDIUM_THINKING'
  | 'AUDIO_VOICE'
  | 'TOOL_CALLING'
  | 'IMAGE_GEN'
  | 'WEB_SEARCH'
  | 'CLASSIFIER'
  | 'VISION'
  | 'CODING'
  | 'DEEP_RESEARCH'
  | 'ADVISOR'

export type Platform = 'telegram'

export async function getRouterChain(
  category: IntentCategory
): Promise<{ chain: RouterModel[], system_prompt?: string; temperature?: number }> {
  const [chainResult, tempsResult, modelsResult] = await Promise.all([
    supabase
      .from('router_chains')
      .select('model_list, system_prompt')
      .eq('category', category)
      .eq('platform', 'telegram')
      .maybeSingle(),
    supabase
      .from('settings')
      .select('value')
      .eq('key', 'router_temperatures')
      .maybeSingle(),
    supabase
      .from('models')
      .select('id, is_paid, prompt_cost, completion_cost')
  ])

  if (chainResult.error || !chainResult.data) {
    console.warn(`No router chain found for category: ${category}, platform: telegram.`)
    return { chain: [] }
  }

  const temps = (tempsResult.data?.value as Record<string, number>) ?? {}
  const customTemp = typeof temps[category] === 'number' ? temps[category] : 0.7

  const pricingMap = new Map<string, { is_paid?: boolean, prompt_cost?: number, completion_cost?: number }>()
  if (modelsResult.data) {
    modelsResult.data.forEach((m: any) => {
      pricingMap.set(m.id, {
        is_paid: m.is_paid,
        prompt_cost: m.prompt_cost,
        completion_cost: m.completion_cost
      })
    })
  }

  const rawChain = (chainResult.data.model_list as RouterModel[] || []).filter(m => m.is_enabled)
  
  const enrichedChain = rawChain.map(m => {
    const price = pricingMap.get(m.id)
    if (!price) return m
    return {
      ...m,
      is_paid: price.is_paid,
      prompt_cost: price.prompt_cost,
      completion_cost: price.completion_cost
    }
  })

  return {
    chain: enrichedChain,
    system_prompt: (chainResult.data as any).system_prompt || undefined,
    temperature: customTemp
  }
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

export interface PipelineSettings {
  orchestratorEnabled: boolean
  maxPipelineSteps: number
  historyLimit: number
  imageGenAutoLast: boolean
  thinkingToggleDefault: boolean
  thinkingSummaryVisible: 'collapsible' | 'hidden'
  statusMessages: Record<string, { label: string; emoji: string }>
}

export async function getPipelineSettings(): Promise<PipelineSettings> {
  const { data: rows } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', [
      'orchestrator_enabled', 'max_pipeline_steps', 'image_gen_auto_last',
      'thinking_toggle_default', 'thinking_summary_visible', 'pipeline_settings',
      'pipeline_status_messages'
    ])

  const map: Record<string, any> = {}
  for (const row of (rows ?? [])) {
    if (row.key === 'pipeline_settings' && row.value) {
      Object.assign(map, row.value)
    } else {
      map[row.key] = row.value
    }
  }

  return {
    orchestratorEnabled: map['orchestrator_enabled'] !== false,
    maxPipelineSteps: typeof map['max_pipeline_steps'] === 'number' ? map['max_pipeline_steps'] : 7,
    historyLimit: typeof map['history_limit'] === 'number' ? map['history_limit'] : 20,
    imageGenAutoLast: map['image_gen_auto_last'] !== false,
    thinkingToggleDefault: map['thinking_toggle_default'] === true,
    thinkingSummaryVisible: map['thinking_summary_visible'] ?? 'collapsible',
    statusMessages: map['pipeline_status_messages'] ?? {}
  }
}
