import { getRouterChain, IntentCategory } from '../router-config'
import { logger } from '../logger'
import { runGoogle } from './providers/google'
import { runGroq } from './providers/groq'
import { supabaseAdmin } from '../supabase'
import type { BotMode } from '@/data/store.types'
import { isModelFailed, markModelFailed } from './chainRouter'

function trackModelUsage(modelId: string, provider: string) {
  supabaseAdmin.rpc('increment_model_usage', { p_model_id: modelId, p_provider: provider })
    .then(({ error }: { error: any }) => { if (error) logger.warn(`Usage track failed [${modelId}]: ${error?.message ?? String(error)}`) })
}

export interface ClassifyTrace {
  model: string
  key: string
  success: boolean
}

export interface ClassifyResult {
  category: IntentCategory | 'MULTI_CHAIN' | null
  classifierModel: string
  trace: ClassifyTrace[]
  error?: string
}

const VALID_CATEGORIES: (IntentCategory | 'MULTI_CHAIN')[] = [
  'FAST_SIMPLE', 'COMPLEX_THINKING', 'MEDIUM_THINKING',
  'IMAGE_GEN', 'WEB_SEARCH', 'AUDIO_VOICE', 'TOOL_CALLING',
  'CODING', 'DEEP_RESEARCH', 'MULTI_CHAIN', 'ADVISOR',
]

const TAG_CATEGORY_MAP: Record<string, IntentCategory> = {
  '/search': 'WEB_SEARCH',
  '/research': 'DEEP_RESEARCH',
  '/code': 'CODING',
  '/image': 'IMAGE_GEN',
  '/tool': 'TOOL_CALLING',
}

export async function classifyIntent(message: string, aiApiKey?: string, modelId?: string): Promise<IntentCategory | 'MULTI_CHAIN' | null> {
  const result = await classifyIntentWithModel(message, aiApiKey, modelId)
  return result.category
}

export async function classifyIntentWithModel(
  message: string,
  aiApiKey?: string,
  modelId?: string,
  mode: BotMode = 'default',
  intentTag?: string | null,
  history: any[] = [],
  replyContext?: { attentionBlock?: string } | null
): Promise<ClassifyResult> {
  const lowerMsg = message.trim().toLowerCase()

  // Intent tag handling — tags are trusted directly
  if (intentTag && TAG_CATEGORY_MAP[intentTag]) {
    return { category: TAG_CATEGORY_MAP[intentTag], classifierModel: 'Intent Tag', trace: [] }
  }

  // Load mode-specific classifier config — no fallbacks, missing = error
  let keywordsObj: Record<string, string[]> | null = null
  let activePrompt: string | null = null
  let keywordsEnabled = true

  try {
    const [keywordsEnabledResult, promptResult, keywordsResult] = await Promise.all([
      supabaseAdmin
        .from('bot_settings')
        .select('is_active')
        .eq('category', 'classifier_keywords_enabled')
        .eq('mode', 'default')
        .maybeSingle(),
      supabaseAdmin
        .from('bot_settings')
        .select('content')
        .eq('category', 'classifier_prompt')
        .eq('mode', mode)
        .maybeSingle(),
      supabaseAdmin
        .from('bot_settings')
        .select('content')
        .eq('category', 'classifier_keywords')
        .eq('mode', 'default')
        .maybeSingle(),
    ])

    if (keywordsEnabledResult.error) logger.warn(`Classifier: failed to load keywords_enabled flag: ${keywordsEnabledResult.error.message}`)
    if (keywordsEnabledResult.data) keywordsEnabled = keywordsEnabledResult.data.is_active

    if (promptResult.error) {
      const errMsg = `Classifier: DB error loading prompt for mode "${mode}": ${promptResult.error.message}`
      logger.error(errMsg)
      return { category: null, classifierModel: 'Error', trace: [], error: errMsg }
    }
    activePrompt = promptResult.data?.content ?? null
    if (!activePrompt) {
      const errMsg = `Classifier prompt missing for mode "${mode}" — configure it in Admin > Bot > Classifier`
      logger.error(errMsg)
      return { category: null, classifierModel: 'Error', trace: [], error: errMsg }
    }

    if (keywordsResult.error) {
      logger.warn(`Classifier: DB error loading keywords for mode "${mode}": ${keywordsResult.error.message} — skipping keyword step`)
    } else if (keywordsResult.data?.content) {
      try { keywordsObj = JSON.parse(keywordsResult.data.content) } catch {
        logger.warn(`Classifier keywords JSON parse failed for mode "${mode}" — skipping keyword step`)
      }
    }
  } catch (err) {
    const errMsg = `Classifier DB config load failed [${mode}]: ${(err as Error).message}`
    logger.error(errMsg)
    return { category: null, classifierModel: 'Error', trace: [], error: errMsg }
  }

  // Keyword fast-path — only runs if keywords are configured and enabled
  if (keywordsEnabled && keywordsObj) {
    for (const cat of Object.keys(keywordsObj) as IntentCategory[]) {
      const list = keywordsObj[cat] || []
      for (const kw of list) {
        const kwLower = kw.trim().toLowerCase()
        if (!kwLower) continue
        
        // Split keyword into words and create a regex that allows words in between
        const words = kwLower.split(/\s+/).filter(Boolean)
        if (words.length === 0) continue
        
        const escapedWords = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        // Match words in order with up to 5 words in between
        const pattern = `\\b${escapedWords.join('\\s+(?:\\w+\\s+){0,5}')}\\b`
        const regex = new RegExp(pattern, 'i')
        
        if (regex.test(lowerMsg)) {
          return { category: cat, classifierModel: 'Keywords', trace: [] }
        }
      }
    }
  }

  // Last 3 turns (user+model pairs) for context
  const recentHistory = history.slice(-20)

  // Reply context prefix
  const replyPrefix = replyContext?.attentionBlock ? replyContext.attentionBlock + '\n\n' : ''

  // Model classification
  const { chain } = await getRouterChain('CLASSIFIER')
  let activeChain = chain

  if (modelId) {
    const selected = chain.find(m => m.id === modelId)
    if (selected) {
      activeChain = [selected]
    } else {
      activeChain = [{ id: modelId, provider: 'google', is_enabled: true } as any]
    }
  }

  const trace: ClassifyTrace[] = []

  for (const modelConfig of activeChain) {
    if (!modelConfig.is_enabled) continue
    if (isModelFailed(modelConfig.id)) {
      logger.info(`Classifier skipping failed model: ${modelConfig.id}`)
      trace.push({ model: modelConfig.id, key: 'SKIPPED', success: false })
      continue
    }

    let key = modelConfig.provider === 'google' ? 'GEMINI' : modelConfig.provider.toUpperCase()
    if (modelConfig.provider.toLowerCase().includes('ollama')) key = 'LOCAL'

    try {
      let rawResponse: any = null
      const traceContext: any = { aiApiKey }
      const prompt = `${replyPrefix}${activePrompt}\n"${message}"`

      const provider = modelConfig.provider.toLowerCase()
      if (provider === 'google') {
        rawResponse = await runGoogle(modelConfig.id, prompt, undefined, undefined, traceContext, recentHistory)
      } else if (provider === 'groq') {
        rawResponse = await runGroq(modelConfig.id, prompt, undefined, aiApiKey, traceContext, recentHistory)
      } else if (provider === 'openrouter') {
        const orRes = await (await import('./providers/openrouter')).runOpenRouter(modelConfig.id, prompt, '', recentHistory, aiApiKey, modelConfig.openrouter_provider || undefined)
        rawResponse = typeof orRes === 'string' ? orRes : null
      } else if (provider === 'ollama' || provider === 'local') {
        const olRes = await (await import('./providers/ollama')).runOllama(modelConfig.id, prompt, '', recentHistory)
        rawResponse = typeof olRes === 'string' ? olRes : null
      } else if (provider === 'pollinations') {
        const polRes = await (await import('./providers/pollinations')).runPollinationsText(modelConfig.id, prompt, '', recentHistory)
        rawResponse = typeof polRes === 'string' ? polRes : null
      }

      if (rawResponse) {
        const content = typeof rawResponse === 'object' ? rawResponse.content : rawResponse
        const cleaned = content.trim().toUpperCase()

        // Extract category strictly from the CATEGORY: line if present
        let categoryText = cleaned
        const catMatch = cleaned.match(/CATEGORY:\s*([A-Z_]+)/)
        if (catMatch) {
          categoryText = catMatch[1]
        }

        for (const cat of VALID_CATEGORIES) {
          if (categoryText === cat || cleaned === cat) {
            const displayKey = traceContext.usedKeyIndex ? `${key} ${traceContext.usedKeyIndex}` : `${key} 1`
            trace.push({ model: modelConfig.id, key: displayKey, success: true })
            trackModelUsage(modelConfig.id, modelConfig.provider)
            return { category: cat, classifierModel: modelConfig.id, trace }
          }
        }

        for (const cat of VALID_CATEGORIES) {
          const regex = new RegExp(`\\b${cat}\\b`, 'i')
          if (regex.test(categoryText)) {
            const displayKey = traceContext.usedKeyIndex ? `${key} ${traceContext.usedKeyIndex}` : `${key} 1`
            trace.push({ model: modelConfig.id, key: displayKey, success: true })
            trackModelUsage(modelConfig.id, modelConfig.provider)
            return { category: cat, classifierModel: modelConfig.id, trace }
          }
        }
      }

      trace.push({ model: modelConfig.id, key: `${key} 1`, success: false })
    } catch (error: any) {
      markModelFailed(modelConfig.id)
      trace.push({ model: modelConfig.id, key: `${key} 1`, success: false })
      logger.warn(`Classification failure [${modelConfig.id}]: ${error.message}`)
    }
  }

  // All models exhausted — no fallback, fail loudly
  const errMsg = `Classifier: all models exhausted for mode "${mode}" — no category could be determined. Check Admin > Router > CLASSIFIER chain.`
  logger.error(errMsg)
  return { category: null, classifierModel: 'Error', trace, error: errMsg }
}
