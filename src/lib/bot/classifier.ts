import { getRouterChain, IntentCategory } from '../router-config'
import { logger } from '../logger'
import { runGoogle } from './providers/google'
import { runGroq } from './providers/groq'
import { supabaseAdmin } from '../supabase'
import { DEFAULT_KEYWORDS, DEFAULT_CLASSIFICATION_PROMPT } from '@/app/admin/bot/classifier/defaults'
import type { BotMode } from '@/data/store.types'

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
  category: IntentCategory
  classifierModel: string
  trace: ClassifyTrace[]
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
}

const MAPS_KEYWORDS = ['map', 'maps', 'directions', 'navigate', 'route to', 'how do i get to', 'where is', 'location of', 'near me', 'nearby']

function detectMapsIntent(message: string): boolean {
  const lower = message.toLowerCase()
  return MAPS_KEYWORDS.some(kw => lower.includes(kw))
}

export async function classifyIntent(message: string, aiApiKey?: string, modelId?: string): Promise<IntentCategory> {
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

  // Maps override: always use WEB_SEARCH (grounding chain) for map queries
  if (detectMapsIntent(lowerMsg)) {
    return { category: 'WEB_SEARCH', classifierModel: 'maps-override', trace: [] }
  }

  // Intent tag handling — tags are trusted directly
  if (intentTag && TAG_CATEGORY_MAP[intentTag]) {
    if (intentTag === '/research' && detectMapsIntent(lowerMsg)) {
      return { category: 'WEB_SEARCH', classifierModel: 'maps-override', trace: [] }
    }
    return { category: TAG_CATEGORY_MAP[intentTag], classifierModel: 'tag', trace: [] }
  }

  // Load mode-specific classifier config
  let keywordsObj = DEFAULT_KEYWORDS
  let activePrompt = DEFAULT_CLASSIFICATION_PROMPT
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
        .eq('mode', mode)
        .maybeSingle(),
    ])

    if (keywordsEnabledResult.data) keywordsEnabled = keywordsEnabledResult.data.is_active
    if (promptResult.data?.content) activePrompt = promptResult.data.content
    if (keywordsResult.data?.content) {
      try { keywordsObj = JSON.parse(keywordsResult.data.content) } catch {}
    }
  } catch (err) {
    logger.warn(`Could not load classifier config [${mode}]: ${(err as Error).message}`)
  }

  // Keyword fast-path
  if (keywordsEnabled) {
    for (const cat of Object.keys(keywordsObj) as IntentCategory[]) {
      const list = keywordsObj[cat] || []
      for (const kw of list) {
        const kwLower = kw.trim().toLowerCase()
        if (!kwLower) continue
        
        // Use regex for whole-word matching to avoid substring bugs (e.g. 'yo' in 'you')
        const escapedKw = kwLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const regex = new RegExp(`\\b${escapedKw}\\b`, 'i')
        
        if (regex.test(lowerMsg)) {
          return { category: cat, classifierModel: kw, trace: [] }
        }
      }
    }
  }

  // Model classification
  const { chain } = await getRouterChain('CLASSIFIER')
  const activeChain = modelId ? [{ id: modelId, provider: 'google', is_enabled: true }] : chain
  const trace: ClassifyTrace[] = []

  for (const modelConfig of activeChain) {
    if (!modelConfig.is_enabled) continue
    const key = modelConfig.provider === 'google' ? 'GEMINI' : modelConfig.provider.toUpperCase()
    try {
      let rawResponse: string | null = null
      const traceContext: any = { aiApiKey }

      if (modelConfig.provider === 'google') {
        rawResponse = await runGoogle(modelConfig.id, `${activePrompt}\n"${message}"`, undefined, undefined, traceContext)
      } else if (modelConfig.provider === 'groq') {
        rawResponse = await runGroq(modelConfig.id, `${activePrompt}\n"${message}"`, undefined, aiApiKey, traceContext)
      }

      if (rawResponse) {
        for (const cat of VALID_CATEGORIES) {
          if (rawResponse.toUpperCase().includes(cat)) {
            const displayKey = traceContext.usedKeyIndex ? `${key} ${traceContext.usedKeyIndex}` : `${key} 1`
            trace.push({ model: modelConfig.id, key: displayKey, success: true })
            trackModelUsage(modelConfig.id, modelConfig.provider)
            return { category: cat, classifierModel: modelConfig.id, trace }
          }
        }
      }
      trace.push({ model: modelConfig.id, key: `${key} 1`, success: false })
    } catch (error: any) {
      trace.push({ model: modelConfig.id, key: `${key} 1`, success: false })
      logger.warn(`Classification failure [${modelConfig.id}]: ${error.message}`)
    }
  }

  return { category: 'FAST_SIMPLE', classifierModel: 'fallback', trace }
}
