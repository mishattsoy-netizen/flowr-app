import { supabaseAdmin as supabase } from '../supabase'
import { logger } from '../logger'
import { getRouterChain } from '../router-config'
import { getChainPrompt } from './prompts'
import { runGoogle } from './providers/google'
import { runOpenRouter } from './providers/openrouter'
import { runGroq } from './providers/groq'
import { computeModelCost } from './services/costFormula'
import type { RouterModel } from '../router-config'
import type { MemoryItem } from './memory'

export interface CompactionConfig {
  context_limit: number
  compaction_threshold: number
}

const DEFAULT_COMPACTION_CONFIG: CompactionConfig = {
  context_limit: 32000,   // tokens per session before compaction triggers
  compaction_threshold: 0.80, // 80% of context_limit
}

export async function getCompactionConfig(): Promise<CompactionConfig> {
  if (!supabase) return DEFAULT_COMPACTION_CONFIG
  const { data, error } = await supabase
    .from('bot_compaction_config')
    .select('context_limit, compaction_threshold')
    .eq('id', 1)
    .maybeSingle()
  if (error || !data) {
    logger.warn(`Failed to fetch compaction config, using defaults: ${error?.message}`)
    return DEFAULT_COMPACTION_CONFIG
  }
  return { context_limit: data.context_limit, compaction_threshold: data.compaction_threshold }
}

export async function saveCompactionConfig(config: Partial<CompactionConfig>): Promise<void> {
  if (!supabase) return
  const { error } = await supabase
    .from('bot_compaction_config')
    .update({ ...config, updated_at: new Date().toISOString() })
    .eq('id', 1)
  if (error) logger.error('Failed to save compaction config:', error)
}

async function runCompactionModel(
  modelConfig: RouterModel,
  systemPrompt: string,
  userMessage: string,
  sessionId?: string
): Promise<{ content: string; cost: number } | null> {
  const provider = modelConfig.provider.toLowerCase()
  try {
    let response: any = null
    switch (provider) {
      case 'google':
      case 'gemini':
        response = await runGoogle(modelConfig.id, userMessage, systemPrompt)
        break
      case 'groq':
        response = await runGroq(modelConfig.id, userMessage, systemPrompt)
        break
      case 'openrouter': {
        response = await runOpenRouter(modelConfig.id, userMessage, systemPrompt, [], undefined, { openrouterProvider: modelConfig.openrouter_provider, sessionId })
        break
      }
      default:
        logger.warn(`Compaction provider ${provider} not supported — trying Google fallback`)
        response = await runGoogle(modelConfig.id, userMessage, systemPrompt)
    }
    if (response) {
      const content = typeof response === 'object' ? response.content : response
      if (!content) return null
      const usage = typeof response === 'object' ? response.usage : undefined
      const cost = computeModelCost({
        prompt_tokens: usage?.prompt_tokens ?? 0,
        completion_tokens: usage?.completion_tokens ?? 0,
        cache_read_tokens: usage?.cache_read_input_tokens,
        cache_creation_tokens: usage?.cache_creation_input_tokens,
        prompt_cost: (modelConfig as any).prompt_cost,
        completion_cost: (modelConfig as any).completion_cost,
        cache_read_cost: (modelConfig as any).cache_read_cost,
        cache_write_cost: (modelConfig as any).cache_write_cost,
      })
      return { content, cost }
    }
  } catch (e: any) {
    logger.warn(`Compaction model ${modelConfig.id} failed: ${e.message}`)
  }
  return null
}

export async function compactSession(
  chatId: string,
  history: MemoryItem[],
  currentSummary: string | null,
  currentWatermark: number | null = null
): Promise<{ summary: string | null; cost: number; newWatermark: number | null }> {
  const { chain } = await getRouterChain('COMPACTION', 'default').catch(() => ({ chain: [] as RouterModel[] }))
  const compactionPrompt = getChainPrompt('compaction')

  const historyText = history
    .map(h => `${h.role}: ${h.parts?.[0]?.text || (h as any).content}`)
    .join('\n\n')

  const userMessage = [
    currentSummary ? `[EXISTING SESSION SUMMARY]\n${currentSummary}` : null,
    `[RAW HISTORY]\n${historyText}`,
  ]
    .filter(Boolean)
    .join('\n\n')

  const enabledModels = (chain || []).filter(m => m.is_enabled)

  const messageIds = history.map(h => h.id ?? 0).filter(id => id > 0)
  const newWatermark = messageIds.length > 0 ? Math.max(...messageIds) : currentWatermark

  for (const modelConfig of enabledModels) {
    const result = await runCompactionModel(modelConfig, compactionPrompt, userMessage, chatId)
    if (result) {
      return { summary: result.content, cost: result.cost, newWatermark }
    }
  }

  logger.warn(`Compaction failed for ${chatId}: all models failed, keeping old summary`)
  return { summary: currentSummary, cost: 0, newWatermark: currentWatermark }
}

