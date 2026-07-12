import { unstable_cache } from 'next/cache'
import { supabaseAdmin as supabase } from './supabase'
import { logger } from './logger'
import offlineChains from '../../bot configs(premission to edit needed!)/router-chains.json'

const DEFAULT_TEMPERATURE = 0.7

export const DEFAULT_STATUS_MESSAGES: Record<string, string> = {
  REGULAR: 'Writing...',
  COMPLEX: 'Writing...',
  PRIMARY: 'Writing...',
  VISION: 'Looking...',
  WEB_SEARCH: 'Searching...',
  RESEARCH: 'Researching...',
  CODING: 'Coding...',
  IMAGE_GEN: 'Drawing...',
  AUDIO: 'Listening...',
  CLASSIFIER: 'Analyzing...',
  ADVISOR: 'Asking...',
  THINKING: 'Thinking...',
  COMPACTION: 'Compressing...',
}

export interface RouterModel {
  id: string
  provider: 'google' | 'gemini' | 'huggingface' | 'cloudflare' | 'groq' | 'local' | 'core' | 'tavily' | 'exa' | 'pollinations' | 'ollama' | 'ollama(my pc)' | 'openrouter' | 'siliconflow' | 'nvidia'
  is_enabled: boolean
  openrouter_provider?: string
  is_paid?: boolean
  prompt_cost?: number
  completion_cost?: number
  cache_read_cost?: number
  cache_write_cost?: number
  context_window?: number
  max_output_tokens?: number
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
  | 'PRIMARY'
  | 'PRIMARY_SMART'
  | 'PRIMARY_LIGHT'

export type RouterMode = 'default' | 'pro'

export function resolveChainWithFallback(
  primary: { chain: RouterModel[]; temperature?: number; thinking_budget?: string | number } | undefined,
  fallback: { chain: RouterModel[]; temperature?: number; thinking_budget?: string | number }
): { chain: RouterModel[]; temperature?: number; thinking_budget?: string | number } {
  if (primary && primary.chain.length > 0) return primary
  return fallback
}

async function fetchRouterChainFromDb(category: IntentCategory, mode: RouterMode): Promise<{ chain: RouterModel[], temperature?: number; thinking_budget?: string | number }> {
  if (!supabase) {
    const offlineMode = mode === 'pro' ? 'pro' : 'default'
    const offlineCategory = (offlineChains[offlineMode] as Record<string, { chain: RouterModel[]; temperature?: number }> | undefined)?.[category]
    if (offlineCategory) {
      return {
        chain: offlineCategory.chain as RouterModel[],
        temperature: offlineCategory.temperature
      }
    }
    return { chain: [] }
  }
  let retryCount = 0
  const maxRetries = 2

  while (retryCount <= maxRetries) {
    try {
      const [chainResult, budgetsResult, modelsResult] = await Promise.all([
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
          .eq('key', 'router_thinking_budgets')
          .limit(1)
          .maybeSingle(),
        supabase
          .from('models')
          .select('id, is_paid, prompt_cost, completion_cost, cache_read_cost, cache_write_cost, context_window, max_output_tokens')
      ])

      if (chainResult.error) throw new Error(chainResult.error.message)
      if (!chainResult.data) {
        // Self-healing: if the category is missing, attempt to create a default entry
        if (category === 'VISION' || category === 'CODING' || category === 'IMAGE_GEN'
          || category === 'PRIMARY_SMART' || category === 'PRIMARY_LIGHT') {
          try {
            await supabase.from('router_chains').insert({
              category,
              mode: 'default',
              model_list: [],
            })
            logger.info(`Created missing router chain entry for: ${category}`)
          } catch (e) {
            logger.error(`Failed to self-heal missing category ${category}:`, e)
          }
        }
        return { chain: [] }
      }

      const customTemp = DEFAULT_TEMPERATURE

      const budgets = (budgetsResult.data?.value as Record<string, string | number>) ?? {}
      const customBudget = budgets[category]

      const pricingMap = new Map<string, {
        is_paid?: boolean
        prompt_cost?: number
        completion_cost?: number
        cache_read_cost?: number
        cache_write_cost?: number
        context_window?: number
        max_output_tokens?: number
      }>()
      if (modelsResult.data) {
        modelsResult.data.forEach((m: any) => {
          pricingMap.set(m.id, {
            is_paid: m.is_paid,
            prompt_cost: m.prompt_cost,
            completion_cost: m.completion_cost,
            cache_read_cost: m.cache_read_cost,
            cache_write_cost: m.cache_write_cost,
            context_window: m.context_window,
            max_output_tokens: m.max_output_tokens,
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
          completion_cost: price.completion_cost,
          cache_read_cost: price.cache_read_cost,
          cache_write_cost: price.cache_write_cost,
          context_window: price.context_window,
          max_output_tokens: price.max_output_tokens,
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

  return getCachedForMode(mode)
}

async function fetchFallbackModesFromDb(): Promise<Record<string, 'model_first' | 'api_key_first'>> {
  if (!supabase) return {}
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
  historyEnabledCategories?: IntentCategory[]
  globalPromptEnabledCategories?: IntentCategory[]
  inputTokenLimit: number
  outputTokenLimit: number
  tokenLimitEnabledCategories?: IntentCategory[]
  routerV2Enabled: boolean
}

// ─── Hardcoded Pipeline Settings ────────────────────────────────────────────
// These values are the authoritative source of truth. The Admin UI page
// is a static preview only and does NOT control these values.
// To change any setting, edit this constant and redeploy.
const HARDCODED_PIPELINE_SETTINGS: PipelineSettings = {
  orchestratorEnabled: true,
  maxPipelineSteps: 5,
  historyLimit: 50,
  imageGenAutoLast: true,
  thinkingToggleDefault: false,
  thinkingSummaryVisible: 'collapsible',
  inputTokenLimit: 0,   // 0 = unlimited
  outputTokenLimit: 0,  // 0 = unlimited
  routerV2Enabled: true,
  // Only inject global prompt (personality + memories) into final output chains.
  // Utility chains (CLASSIFIER, COMPACTION, THINKING) don't need personal context.
  globalPromptEnabledCategories: ['REGULAR', 'COMPLEX', 'CODING', 'WEB_SEARCH', 'RESEARCH', 'IMAGE_GEN', 'AUDIO', 'VISION', 'ADVISOR', 'PRIMARY'],
  // Inject conversation history into all chains that benefit from it.
  historyEnabledCategories: ['REGULAR', 'COMPLEX', 'CODING', 'WEB_SEARCH', 'RESEARCH', 'AUDIO', 'VISION', 'ADVISOR', 'THINKING', 'PRIMARY'],
}

export async function getPipelineSettings(): Promise<PipelineSettings> {
  return HARDCODED_PIPELINE_SETTINGS
}
