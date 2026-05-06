import { getRouterChain, IntentCategory } from '../router-config'
import { logger } from '../logger'
import { runGoogle } from './providers/google'
import { runGroq } from './providers/groq'
import { supabaseAdmin } from '../supabase'
import type { BotMode } from '@/data/store.types'
import { isModelFailed, markModelFailed } from './chainRouter'

function trackModelUsage(modelId: string, provider: string) {
  supabaseAdmin.rpc('increment_model_usage', { p_model_id: modelId, p_provider: provider })
    .then(({ error }: { error: any }) => { if (error) logger.warn(`Usage track failed [${modelId}]: ${error.message}`) })
}

export interface ClassifyTrace {
  model: string
  key: string
  success: boolean
}

export interface ClassifyResult {
  category: IntentCategory | null
  classifierModel: string
  trace: ClassifyTrace[]
  error?: string
}

const VALID_CATEGORIES: IntentCategory[] = [
  'FAST_SIMPLE', 'COMPLEX_THINKING', 'MEDIUM_THINKING',
  'IMAGE_GEN', 'WEB_SEARCH', 'AUDIO_VOICE', 'TOOL_CALLING',
  'CODING', 'DEEP_RESEARCH',
]

const TAG_CATEGORY_MAP: Record<string, IntentCategory> = {
  '/search':   'WEB_SEARCH',
  '/research': 'DEEP_RESEARCH',
  '/code':     'CODING',
  '/image':    'IMAGE_GEN',
  '/tool':     'TOOL_CALLING',
}

export async function classifyIntent(message: string, aiApiKey?: string, modelId?: string): Promise<IntentCategory | null> {
  const result = await classifyIntentWithModel(message, aiApiKey, modelId)
  return result.category
}

export async function classifyIntentWithModel(
  message: string,
  aiApiKey?: string,
  modelId?: string,
  mode: BotMode = 'default',
  intentTag?: string | null
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

    if (keywordsEnabledResult.data) keywordsEnabled = keywordsEnabledResult.data.is_active

    activePrompt = promptResult.data?.content ?? null
    if (!activePrompt) {
      const errMsg = `Classifier prompt missing for mode "${mode}" — configure it in Admin > Bot > Classifier`
      logger.error(errMsg)
      return { category: null, classifierModel: 'Error', trace: [], error: errMsg }
    }

    if (keywordsResult.data?.content) {
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
        const escapedKw = kwLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const regex = new RegExp(`\\b${escapedKw}\\b`, 'i')
        if (regex.test(lowerMsg)) {
          return { category: cat, classifierModel: 'Keywords', trace: [] }
        }
      }
    }
  }

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
      let rawResponse: string | null = null
      const traceContext: any = { aiApiKey }
      const prompt = `${activePrompt}\n"${message}"`

      const provider = modelConfig.provider.toLowerCase()
      if (provider === 'google') {
        rawResponse = await runGoogle(modelConfig.id, prompt, undefined, undefined, traceContext)
      } else if (provider === 'groq') {
        rawResponse = await runGroq(modelConfig.id, prompt, undefined, aiApiKey, traceContext)
      } else if (provider === 'openrouter') {
        const orRes = await (await import('./providers/openrouter')).runOpenRouter(modelConfig.id, prompt, '', [], aiApiKey)
        rawResponse = typeof orRes === 'string' ? orRes : null
      } else if (provider === 'ollama' || provider === 'local') {
        const olRes = await (await import('./providers/ollama')).runOllama(modelConfig.id, prompt, '', [])
        rawResponse = typeof olRes === 'string' ? olRes : null
      } else if (provider === 'pollinations') {
        const polRes = await (await import('./providers/pollinations')).runPollinationsText(modelConfig.id, prompt, '', [])
        rawResponse = typeof polRes === 'string' ? polRes : null
      }

      if (rawResponse) {
        const cleaned = rawResponse.trim().toUpperCase()

        for (const cat of VALID_CATEGORIES) {
          if (cleaned === cat) {
            const displayKey = traceContext.usedKeyIndex ? `${key} ${traceContext.usedKeyIndex}` : `${key} 1`
            trace.push({ model: modelConfig.id, key: displayKey, success: true })
            trackModelUsage(modelConfig.id, modelConfig.provider)
            return { category: cat, classifierModel: modelConfig.id, trace }
          }
        }

        for (const cat of VALID_CATEGORIES) {
          const regex = new RegExp(`\\b${cat}\\b`, 'i')
          if (regex.test(cleaned)) {
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
