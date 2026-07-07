import { unstable_cache } from 'next/cache'
import { supabaseAdmin as supabase } from './supabase'
import { logger } from './logger'

export interface RouterModel {
  id: string
  provider: 'google' | 'gemini' | 'huggingface' | 'cloudflare' | 'groq' | 'local' | 'core' | 'tavily' | 'exa' | 'pollinations' | 'ollama' | 'ollama(my pc)' | 'openrouter' | 'siliconflow' | 'nvidia'
  is_enabled: boolean
  openrouter_provider?: string
  is_paid?: boolean
  prompt_cost?: number
  completion_cost?: number
}

export type IntentCategory =
  | 'REGULAR'
  | 'COMPLEX'
  | 'AUDIO'
  | 'IMAGE_GEN'
  | 'WEB_SEARCH'
  | 'CLASSIFIER'
  | 'VISION'
  | 'CODING'
  | 'RESEARCH'
  | 'ADVISOR'
  | 'THINKING'
  | 'COMPACTION'

export type RouterMode = 'default' | 'pro'

export function resolveChainWithFallback(
  primary: { chain: RouterModel[]; temperature?: number; thinking_budget?: string | number } | undefined,
  fallback: { chain: RouterModel[]; temperature?: number; thinking_budget?: string | number }
): { chain: RouterModel[]; temperature?: number; thinking_budget?: string | number } {
  if (primary && primary.chain.length > 0) return primary
  return fallback
}

async function fetchRouterChainFromDb(category: IntentCategory, mode: RouterMode): Promise<{ chain: RouterModel[], temperature?: number; thinking_budget?: string | number }> {
  let retryCount = 0
  const maxRetries = 2

  while (retryCount <= maxRetries) {
    try {
      const [chainResult, tempsResult, budgetsResult, modelsResult] = await Promise.all([
        supabase
          .from('router_chains')
          .select('model_list')
          .eq('category', category)
          .eq('mode', mode)
          .limit(1)
          .maybeSingle(),
        supabase
          .from('settings')
          .select('value')
          .eq('key', 'router_temperatures')
          .limit(1)
          .maybeSingle(),
        supabase
          .from('settings')
          .select('value')
          .eq('key', 'router_thinking_budgets')
          .limit(1)
          .maybeSingle(),
        supabase
          .from('models')
          .select('id, is_paid, prompt_cost, completion_cost')
      ])

      if (chainResult.error) throw new Error(chainResult.error.message)
      if (!chainResult.data) {
        // Self-healing: if the category is missing, attempt to create a default entry
        if (category === 'VISION' || category === 'CODING' || category === 'IMAGE_GEN') {
          try {
            await supabase.from('router_chains').insert({
              category,
              mode: 'default',
              model_list: [],
              is_enabled: true,
            })
            logger.info(`Created missing router chain entry for: ${category}`)
          } catch (e) {
            logger.error(`Failed to self-heal missing category ${category}:`, e)
          }
        }
        return { chain: [] }
      }

      const temps = (tempsResult.data?.value as Record<string, number>) ?? {}
      const customTemp = typeof temps[category] === 'number' ? temps[category] : 0.7

      const budgets = (budgetsResult.data?.value as Record<string, string | number>) ?? {}
      const customBudget = budgets[category]

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
        temperature: customTemp,
        thinking_budget: customBudget
      }
    } catch (err) {
      if (retryCount === maxRetries) {
        logger.error(`RouterChain DB load failed for ${category} (mode=${mode}) after ${maxRetries} retries: ${(err as Error).message}.`)
        return { chain: [] }
      }
      retryCount++
      await new Promise(r => setTimeout(r, 1000 * retryCount))
    }
  }
  return { chain: [] }
}

export async function getRouterChain(category: IntentCategory, mode: RouterMode = 'default') {
  const getCachedForMode = (m: RouterMode) => unstable_cache(
    async () => fetchRouterChainFromDb(category, m),
    ['router-chain', category, m],
    { tags: ['router-config'], revalidate: false }
  )()

  if (mode === 'default') {
    return getCachedForMode('default')
  }

  const [proResult, defaultResult] = await Promise.all([
    getCachedForMode('pro'),
    getCachedForMode('default'),
  ])
  return resolveChainWithFallback(proResult, defaultResult)
}

async function fetchFallbackModesFromDb(): Promise<Record<string, 'model_first' | 'api_key_first'>> {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'router_fallback_modes')
    .limit(1)
    .maybeSingle()

  if (error || !data?.value) return {}
  return data.value as Record<string, 'model_first' | 'api_key_first'>
}

export async function getFallbackModes() {
  const getCached = unstable_cache(
    async () => fetchFallbackModesFromDb(),
    ['router-fallback-modes'],
    { tags: ['router-config'], revalidate: false }
  )
  return getCached()
}

export interface PipelineSettings {
  orchestratorEnabled: boolean
  maxPipelineSteps: number
  historyLimit: number
  imageGenAutoLast: boolean
  thinkingToggleDefault: boolean
  thinkingSummaryVisible: 'collapsible' | 'hidden'
  statusMessages: Record<string, { label: string; emoji: string }>
  historyEnabledCategories?: IntentCategory[]
  globalPromptEnabledCategories?: IntentCategory[]
  inputTokenLimit: number
  outputTokenLimit: number
  tokenLimitEnabledCategories?: IntentCategory[]
}

async function fetchPipelineSettingsFromDb(): Promise<PipelineSettings> {
  try {
    const { data: rows, error } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', [
        'orchestrator_enabled', 'max_pipeline_steps', 'image_gen_auto_last',
        'thinking_toggle_default', 'thinking_summary_visible', 'pipeline_settings',
        'pipeline_status_messages'
      ])

    if (error) throw new Error(error.message)

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
      maxPipelineSteps: typeof map['max_pipeline_steps'] === 'number' ? map['max_pipeline_steps'] : 20,
      historyLimit: typeof map['history_limit'] === 'number' ? map['history_limit'] : 20,
      imageGenAutoLast: map['image_gen_auto_last'] !== false,
      thinkingToggleDefault: map['thinking_toggle_default'] === true,
      thinkingSummaryVisible: map['thinking_summary_visible'] ?? 'collapsible',
      statusMessages: map['pipeline_status_messages'] ?? {},
      historyEnabledCategories: map['history_enabled_categories'] || undefined,
      globalPromptEnabledCategories: map['global_prompt_enabled_categories'] || undefined,
      inputTokenLimit: typeof map['input_token_limit'] === 'number' ? map['input_token_limit'] : 0,
      outputTokenLimit: typeof map['output_token_limit'] === 'number' ? map['output_token_limit'] : 0,
      tokenLimitEnabledCategories: map['token_limit_enabled_categories'] || undefined
    }
  } catch (err) {
    logger.warn(`Pipeline settings DB load failed: ${(err as Error).message}`)
    return {
      orchestratorEnabled: true,
      maxPipelineSteps: 20,
      historyLimit: 20,
      imageGenAutoLast: true,
      thinkingToggleDefault: false,
      thinkingSummaryVisible: 'collapsible',
      statusMessages: {},
      inputTokenLimit: 0,
      outputTokenLimit: 0,
    }
  }
}

export async function getPipelineSettings() {
  const getCached = unstable_cache(
    async () => fetchPipelineSettingsFromDb(),
    ['pipeline-settings'],
    { tags: ['router-config'], revalidate: false }
  )
  return getCached()
}
