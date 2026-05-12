import { supabaseAdmin as supabase } from './supabase'
import { logger } from './logger'
import fs from 'fs'
import path from 'path'

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
  | 'IMAGE_UPSCALE'
  | 'WEB_SEARCH'
  | 'CLASSIFIER'
  | 'VISION'
  | 'CODING'
  | 'DEEP_RESEARCH'
  | 'ADVISOR'
  | 'THINKING'
  | 'ORCHESTRATOR'

export type Platform = 'telegram'

export async function getRouterChain(
  category: IntentCategory
): Promise<{ chain: RouterModel[], system_prompt?: string; temperature?: number }> {
  let retryCount = 0
  const maxRetries = 2

  while (retryCount <= maxRetries) {
    try {
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

      if (chainResult.error) throw new Error(chainResult.error.message)
      if (!chainResult.data) {
        // Self-healing: if the category is missing, attempt to create a default entry
        if (category === 'IMAGE_UPSCALE' || category === 'VISION' || category === 'CODING' || category === 'IMAGE_GEN') {
          try {
            await supabase.from('router_chains').insert({
              category,
              platform: 'telegram',
              model_list: [],
              is_enabled: true,
              system_prompt: category === 'IMAGE_GEN' ? 'You are a professional image generation assistant. Expand user prompts into detailed, high-quality descriptions for image models.' : undefined
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
      
      const result = {
        chain: enrichedChain,
        system_prompt: (chainResult.data as any).system_prompt || undefined,
        temperature: customTemp
      }

      // Background save to cache for future resiliency
      saveChainToCache(category, result)

      return result
    } catch (err) {
      if (retryCount === maxRetries) {
        logger.error(`RouterChain DB load failed for ${category} after ${maxRetries} retries: ${(err as Error).message}. Attempting local cache fallback.`)
        
        // Final fallback: Local cache
        try {
          const cachePath = path.join(process.cwd(), 'bot configs(premission to edit needed!)', 'router-chains.json')
          if (fs.existsSync(cachePath)) {
            const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'))
            if (cache[category]) {
              logger.info(`Loaded ${category} chain from local cache fallback.`)
              return cache[category]
            }
          }
        } catch (cacheErr) {
          logger.error(`RouterChain local cache load failed for ${category}:`, cacheErr)
        }

        return { chain: [] }
      }
      retryCount++
      await new Promise(r => setTimeout(r, 1000 * retryCount)) // Increased backoff
    }
  }
  return { chain: [] }
}

/**
 * Persists a successfully fetched router chain to the local filesystem for resiliency.
 */
async function saveChainToCache(category: string, data: any) {
  try {
    const cacheDir = path.join(process.cwd(), 'bot configs(premission to edit needed!)')
    const cachePath = path.join(cacheDir, 'router-chains.json')
    
    let cache: Record<string, any> = {}
    if (fs.existsSync(cachePath)) {
      try {
        cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'))
      } catch {
        cache = {}
      }
    }
    
    cache[category] = data
    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2))
  } catch (err) {
    logger.warn(`Failed to save router chain ${category} to cache:`, err)
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
  historyEnabledCategories?: IntentCategory[]
}

export async function getPipelineSettings(): Promise<PipelineSettings> {
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

    const result: PipelineSettings = {
      orchestratorEnabled: map['orchestrator_enabled'] !== false,
      maxPipelineSteps: typeof map['max_pipeline_steps'] === 'number' ? map['max_pipeline_steps'] : 7,
      historyLimit: typeof map['history_limit'] === 'number' ? map['history_limit'] : 20,
      imageGenAutoLast: map['image_gen_auto_last'] !== false,
      thinkingToggleDefault: map['thinking_toggle_default'] === true,
      thinkingSummaryVisible: map['thinking_summary_visible'] ?? 'collapsible',
      statusMessages: map['pipeline_status_messages'] ?? {},
      historyEnabledCategories: map['history_enabled_categories'] || undefined
    }

    // Save to cache
    try {
      const cachePath = path.join(process.cwd(), 'bot configs(premission to edit needed!)', 'pipeline-settings.json')
      fs.writeFileSync(cachePath, JSON.stringify(result, null, 2))
    } catch { /* ignore */ }

    return result
  } catch (err) {
    logger.warn(`Pipeline settings DB load failed, trying local cache: ${(err as Error).message}`)
    
    try {
      const cachePath = path.join(process.cwd(), 'bot configs(premission to edit needed!)', 'pipeline-settings.json')
      if (fs.existsSync(cachePath)) {
        return JSON.parse(fs.readFileSync(cachePath, 'utf8'))
      }
    } catch { /* ignore */ }

    return {
      orchestratorEnabled: true,
      maxPipelineSteps: 7,
      historyLimit: 20,
      imageGenAutoLast: true,
      thinkingToggleDefault: false,
      thinkingSummaryVisible: 'collapsible',
      statusMessages: {},
    }
  }
}
