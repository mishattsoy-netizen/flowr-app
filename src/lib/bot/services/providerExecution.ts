import { supabaseAdmin } from '../../supabase'
import { logger } from '../../logger'
import { runGoogle } from '../providers/google'
import { runOpenRouter } from '../providers/openrouter'
import { runGroq } from '../providers/groq'
import { runOllama } from '../providers/ollama'
import { runHuggingFace, runHuggingFaceText } from '../providers/huggingface'
import { runCloudflare } from '../providers/cloudflare'
import { runPollinations, runPollinationsText } from '../providers/pollinations'
import { runSiliconFlow, runSiliconFlowText } from '../providers/siliconflow'
import { runNvidia } from '../providers/nvidia'
import { runWebSearchChain } from '../providers/tavily'
import { runDuckDuckGoSearchChain } from '../providers/duckduckgo'
import { runExaSearchChain } from '../providers/exa'
import type { IntentCategory } from '../../router-config'

export function logCost(cost: {
  model_id: string; provider: string; prompt_cost: number; completion_cost: number;
  total_cost: number; prompt_tokens: number; completion_tokens: number;
  chain?: string; subprovider?: string | null;
}) {
  if (!supabaseAdmin) return
  // Fire-and-forget
  Promise.resolve().then(async () => {
    const { chain, subprovider, ...safe } = cost as any
    const { error } = await supabaseAdmin.from('cost_log').insert(safe)
    if (error) logger.warn(`[CostLog] insert failed: ${error.message}`)
  }).catch((err: any) => logger.warn(`[CostLog] error: ${err?.message ?? String(err)}`))
}

export async function trackModelUsage(p_model_id: string, p_provider: string) {
  if (!supabaseAdmin) return
  try {
    const today = new Date().toISOString().split('T')[0]
    const { data: model, error: fetchError } = await supabaseAdmin
      .from('models')
      .select('last_reset_date')
      .eq('id', p_model_id)
      .maybeSingle()

    if (!fetchError && model && model.last_reset_date !== today) {
      logger.info(`[RPD] New day detected (${today}). Resetting all model usage...`)
      await supabaseAdmin
        .from('models')
        .update({ usage_today: 0, last_reset_date: today })
        .neq('last_reset_date', today)
    }

    const { error } = await supabaseAdmin.rpc('increment_model_usage', { p_model_id, p_provider })
    if (error) throw error
  } catch (error: any) {
    logger.warn(`Usage track failed [${p_model_id}]: ${error.message}`)
  }
}

// Generates alternative search queries when initial search fails
function generateOptimizedQuery(originalPrompt: string): string[] {
  const queries: string[] = [originalPrompt]
  const compareMatch = originalPrompt.match(/compare\s+(.+?)\s+(?:and|vs|with|versus)\s+(.+)/i)
  if (compareMatch) {
    const a = compareMatch[1].trim().replace(/^(?:the|a|an)\s+/i, '').slice(0, 100)
    const b = compareMatch[2].trim().replace(/^(?:the|a|an)\s+/i, '').slice(0, 100)
    queries.push(`${a} specifications capabilities`)
    queries.push(`${b} specifications capabilities`)
  }
  const stripped = originalPrompt.replace(/^(?:can you|could you|i want to know|tell me about|what about|how about|what is|what are|do you know)\s+/i, '').trim()
  if (stripped !== originalPrompt && stripped.length > 5) {
    queries.push(stripped)
  }
  return queries
}

export async function executeVisionProvider(
  modelConfig: any,
  activePrompt: string,
  systemPrompt: string,
  activeBuffers: Buffer[],
  visionContext: any,
  history: any[],
  sessionId?: string
): Promise<any> {
  const sanitizedId = modelConfig.id.replace(/^google\//, '')
  switch (modelConfig.provider.toLowerCase()) {
    case 'google':
    case 'gemini':
      return await runGoogle(sanitizedId, activePrompt, systemPrompt, activeBuffers, visionContext, history)
    case 'openrouter':
      return await runOpenRouter(modelConfig.id, activePrompt, systemPrompt, history, visionContext?.aiApiKey, { openrouterProvider: modelConfig.openrouter_provider, sessionId }, activeBuffers)
    case 'groq':
      return await runGroq(modelConfig.id, activePrompt, systemPrompt, visionContext?.aiApiKey, visionContext, history, activeBuffers)
    case 'nvidia':
      return await runNvidia(modelConfig.id, activePrompt, systemPrompt, history, visionContext?.aiApiKey, visionContext, activeBuffers)
    default:
      logger.warn(`Vision provider ${modelConfig.provider} not specifically handled in router. Falling back to runGoogle.`)
      return await runGoogle(modelConfig.id, activePrompt, systemPrompt, activeBuffers, visionContext, history)
  }
}

export async function executeProvider(
  modelConfig: any,
  category: IntentCategory,
  activePromptForGen: string,
  system_prompt: string,
  historyForChain: any[],
  activeKey: string | undefined,
  providerKeys: string[],
  context: any,
  routeContext: any,
  temperature: number | undefined,
  originalPrompt: string,
  augmentSearchQuery: (query: string, history: any[]) => string
): Promise<{ response: any; searchResult?: string; searchFailed?: boolean }> {
  let response: any = null

  switch (modelConfig.provider.toLowerCase()) {
    case 'google':
    case 'gemini':
      response = await runGoogle(modelConfig.id, activePromptForGen, system_prompt, undefined, routeContext, historyForChain)
      break
    case 'groq':
      response = await runGroq(modelConfig.id, activePromptForGen, system_prompt, activeKey || context?.aiApiKey, routeContext, historyForChain)
      break
    case 'huggingface':
      if (category === 'IMAGE_GEN') {
        response = await runHuggingFace(modelConfig.id, activePromptForGen, activeKey || context?.aiApiKey)
      } else {
        response = await runHuggingFaceText(modelConfig.id, activePromptForGen, system_prompt, historyForChain, activeKey || context?.aiApiKey, routeContext)
      }
      break
    case 'cloudflare':
      response = await runCloudflare(modelConfig.id, activePromptForGen, activeKey || context?.aiApiKey, system_prompt, historyForChain, category, routeContext)
      break
    case 'core':
    case 'exa':
    case 'tavily': {
      const hasSearchData =
        system_prompt.includes('[SEARCH DATA:') ||
        system_prompt.includes('[SEARCH DATA]\n') ||
        system_prompt.includes('[SEARCH RESULTS') ||
        system_prompt.includes('RESEARCH FINDINGS:') ||
        activePromptForGen.includes('RESEARCH FINDINGS:')

      if (hasSearchData) {
        logger.info(`Skipping redundant search for ${modelConfig.id} - data already present from prior pass.`)
        return { response: null } // Indicates to skip/continue
      }

      const SEARCH_FAILURE_STRINGS = ['search failed', 'unavailable', 'could not retrieve', 'failed to retrieve', 'unable to find', 'no results']
      let searchResult: string | null = null
      const searchQuery = augmentSearchQuery(originalPrompt, historyForChain)

      if (modelConfig.id.includes('tavily') || modelConfig.provider === 'tavily') {
        searchResult = await runWebSearchChain(searchQuery, routeContext, system_prompt)
      } else if (modelConfig.id.includes('duckduckgo')) {
        searchResult = await runDuckDuckGoSearchChain(searchQuery, routeContext, system_prompt)
      } else if (modelConfig.id.includes('exa') || modelConfig.provider === 'exa') {
        searchResult = await runExaSearchChain(searchQuery, routeContext, system_prompt)
      }

      let isSearchFailure = !searchResult || SEARCH_FAILURE_STRINGS.some(f => searchResult!.toLowerCase().includes(f))

      if (isSearchFailure) {
        const altQueries = generateOptimizedQuery(searchQuery)
        for (const altQuery of altQueries) {
          if (altQuery === searchQuery) continue
          logger.info(`Retrying ${modelConfig.id} with optimized query: "${altQuery}"`)
          let retryResult: string | null = null
          if (modelConfig.id.includes('tavily')) retryResult = await runWebSearchChain(altQuery, routeContext, system_prompt)
          else if (modelConfig.id.includes('duckduckgo')) retryResult = await runDuckDuckGoSearchChain(altQuery, routeContext, system_prompt)
          else if (modelConfig.id.includes('exa')) retryResult = await runExaSearchChain(altQuery, routeContext, system_prompt)
          
          const retryFailed = !retryResult || SEARCH_FAILURE_STRINGS.some(f => retryResult!.toLowerCase().includes(f))
          if (!retryFailed) {
            searchResult = retryResult
            isSearchFailure = false
            logger.info(`Retry succeeded for ${modelConfig.id} with query: "${altQuery}"`)
            break
          }
        }
      }

      if (isSearchFailure) {
        return { response: null, searchFailed: true }
      }
      return { response: { content: searchResult }, searchResult: searchResult! }
    }
    case 'pollinations':
      if (category === 'IMAGE_GEN') {
        response = await runPollinations(activePromptForGen, modelConfig.id)
      } else {
        response = await runPollinationsText(modelConfig.id, activePromptForGen, system_prompt, historyForChain, activeKey || providerKeys[0], routeContext)
      }
      break
    case 'openrouter':
      if (modelConfig.openrouter_provider) routeContext.openrouterProvider = modelConfig.openrouter_provider
      response = await runOpenRouter(modelConfig.id, activePromptForGen, system_prompt, historyForChain, activeKey || context?.aiApiKey || providerKeys[0], routeContext)
      break
    case 'local':
    case 'ollama':
    case 'ollama(my pc)':
      response = await runOllama(modelConfig.id, activePromptForGen, system_prompt, historyForChain, temperature, routeContext)
      break
    case 'siliconflow':
      if (category === 'IMAGE_GEN') {
        response = await runSiliconFlow(modelConfig.id, activePromptForGen, activeKey || providerKeys[0])
      } else {
        response = await runSiliconFlowText(modelConfig.id, activePromptForGen, system_prompt, historyForChain, activeKey || providerKeys[0], routeContext)
      }
      break
    case 'nvidia':
      response = await runNvidia(modelConfig.id, activePromptForGen, system_prompt, historyForChain, activeKey || providerKeys[0], routeContext)
      break
  }

  return { response }
}
