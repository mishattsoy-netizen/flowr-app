import { getRouterChain, IntentCategory } from '../router-config'
import { logger } from '../logger'
import { runGoogle } from './providers/google'
import { runGroq } from './providers/groq'
import { supabaseAdmin } from '../supabase'
import type { BotMode } from '@/data/store.types'
import { isModelFailed, markModelFailed } from './chainRouter'
import { TraceCollector } from './tracing'

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
  matchedKeyword?: string
  error?: string
}

const VALID_CATEGORIES: (IntentCategory | 'MULTI_CHAIN')[] = [
  'FAST_SIMPLE', 'COMPLEX_THINKING', 'MEDIUM_THINKING',
  'IMAGE_GEN', 'WEB_SEARCH', 'AUDIO_VOICE', 'TOOL_CALLING',
  'CODING', 'DEEP_RESEARCH', 'MULTI_CHAIN', 'ADVISOR',
]

const DEFAULT_CLASSIFIER_PROMPT = `Classify user intent into exactly ONE category:
FAST_SIMPLE: Quick questions, greetings, casual chat.
COMPLEX_THINKING: Hard logic, deep analysis, step-by-step reasoning.
MEDIUM_THINKING: Moderate complexity, multi-part answers.
IMAGE_GEN: Requests to create, draw, or generate images/art.
WEB_SEARCH: Current events, live data, searching the internet.
AUDIO_VOICE: Voice interaction or audio related.
TOOL_CALLING: Intent that requires specialized tools.
CODING: Programming, debugging, code snippets.
DEEP_RESEARCH: Exhaustive topic research and synthesis.
ADVISOR: Strategic advice, coaching, or planning.
MULTI_CHAIN: Multiple intents combined.

Respond ONLY with the category name.`

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
  replyContext?: { attentionBlock?: string } | null,
  tracer?: TraceCollector
): Promise<ClassifyResult> {
  const lowerMsg = message.trim().toLowerCase()

  // Intent tag handling — tags are trusted directly
  if (intentTag && TAG_CATEGORY_MAP[intentTag]) {
    return { category: TAG_CATEGORY_MAP[intentTag], classifierModel: 'Intent Tag', trace: [] }
  }

  // Retry logic for DB config load
  let activePrompt: string | null = null
  let keywordsEnabled = true
  let keywordsObj: any = null
  let retryCount = 0
  const maxRetries = 2
  
  while (retryCount <= maxRetries) {
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

      if (!promptResult.error && promptResult.data?.content) {
        activePrompt = promptResult.data.content
      } else if (promptResult.error) {
        throw new Error(promptResult.error.message)
      }

      if (!keywordsResult.error && keywordsResult.data?.content) {
        try { keywordsObj = JSON.parse(keywordsResult.data.content) } catch { /* ignore */ }
      }
      
      // If we got the prompt, we are good
      if (activePrompt) break
    } catch (err) {
      if (retryCount === maxRetries) {
        logger.warn(`Classifier DB load failed after ${maxRetries} retries, using local fallback prompt.`)
        activePrompt = DEFAULT_CLASSIFIER_PROMPT
        break
      }
      retryCount++
      await new Promise(r => setTimeout(r, 500 * retryCount)) // Backoff
    }
  }

  // Fallback if still missing
  if (!activePrompt) {
    activePrompt = DEFAULT_CLASSIFIER_PROMPT
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
        
        const escapedWords = words.map((w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        // Match words in order with up to 5 words in between
        const pattern = `\\b${escapedWords.join('\\s+(?:\\w+\\s+){0,5}')}\\b`
        const regex = new RegExp(pattern, 'i')
        
        if (regex.test(lowerMsg)) {
          tracer?.recordSuccess({ chain: 'CLASSIFIER', model: 'Keywords', provider: 'keywords', key: 'KW', matched_keyword: kw.trim(), input_user: lowerMsg, input_history_count: 0, output: cat }, 0)
          return { category: cat, classifierModel: 'Keywords', trace: [], matchedKeyword: kw.trim() }
        }
      }
    }
  }

  // Use provided history context (already limited by caller via historyLimit setting)
  const recentHistory = history

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
  
  // Image context hint: if the last model message was an image, the user is likely iterating
  const lastModelMsg = [...history].reverse().find(h => h.role === 'model' || h.role === 'assistant')
  const lastWasImage = lastModelMsg && (
    lastModelMsg.content?.includes('![') || 
    lastModelMsg.content?.includes('data:image') ||
    lastModelMsg.content?.includes('[Image generated') ||
    (lastModelMsg.parts && JSON.stringify(lastModelMsg.parts).includes('image'))
  )

  const contextHint = lastWasImage ? `\n[CONTEXT: The last response contained an image. Follow-up requests like "one more", "make it...", or "change..." should likely be IMAGE_GEN.]` : ''
  const finalPrompt = `${replyPrefix}${activePrompt}${contextHint}\nUser: "${message}"`

  for (const modelConfig of activeChain) {
    if (!modelConfig.is_enabled) continue
    if (isModelFailed(modelConfig.id)) {
      logger.info(`Classifier skipping failed model: ${modelConfig.id}`)
      trace.push({ model: modelConfig.id, key: 'SKIPPED', success: false })
      continue
    }

    let key = modelConfig.provider === 'google' ? 'GEMINI' : modelConfig.provider.toUpperCase()
    if (modelConfig.provider.toLowerCase().includes('ollama')) key = 'LOCAL'

    const t0 = Date.now()
    const traceMeta = { chain: 'CLASSIFIER', model: modelConfig.id, provider: modelConfig.provider, key: `${key} 1`, input_user: finalPrompt, input_history_count: recentHistory.length }

    try {
      let rawResponse: any = null
      const traceContext: any = { aiApiKey }

      const provider = modelConfig.provider.toLowerCase()
      if (provider === 'google') {
        rawResponse = await runGoogle(modelConfig.id, finalPrompt, undefined, undefined, traceContext, recentHistory)
      } else if (provider === 'groq') {
        rawResponse = await runGroq(modelConfig.id, finalPrompt, undefined, aiApiKey, traceContext, recentHistory)
      } else if (provider === 'openrouter') {
        const orRes = await (await import('./providers/openrouter')).runOpenRouter(modelConfig.id, finalPrompt, '', recentHistory, aiApiKey, modelConfig.openrouter_provider || undefined)
        rawResponse = typeof orRes === 'string' ? orRes : (orRes as any)?.content || null
      } else if (provider === 'ollama' || provider === 'local') {
        const olRes = await (await import('./providers/ollama')).runOllama(modelConfig.id, finalPrompt, '', recentHistory)
        rawResponse = typeof olRes === 'string' ? olRes : null
      } else if (provider === 'pollinations') {
        const polRes = await (await import('./providers/pollinations')).runPollinationsText(modelConfig.id, finalPrompt, '', recentHistory)
        rawResponse = typeof polRes === 'string' ? polRes : null
      }

      if (rawResponse) {
        const content = typeof rawResponse === 'object' ? rawResponse.content : rawResponse
        const cleaned = content.trim().toUpperCase()

        let categoryText = cleaned
        const catMatch = cleaned.match(/CATEGORY:\s*([A-Z_]+)/)
        if (catMatch) categoryText = catMatch[1]

        for (const cat of VALID_CATEGORIES) {
          if (categoryText === cat || cleaned === cat) {
            const displayKey = traceContext.usedKeyIndex ? `${key} ${traceContext.usedKeyIndex}` : `${key} 1`
            trace.push({ model: modelConfig.id, key: displayKey, success: true })
            tracer?.recordSuccess({ ...traceMeta, key: displayKey, output: cat }, Date.now() - t0)
            trackModelUsage(modelConfig.id, modelConfig.provider)
            return { category: cat, classifierModel: modelConfig.id, trace }
          }
        }

        for (const cat of VALID_CATEGORIES) {
          const regex = new RegExp(`\\b${cat}\\b`, 'i')
          if (regex.test(categoryText)) {
            const displayKey = traceContext.usedKeyIndex ? `${key} ${traceContext.usedKeyIndex}` : `${key} 1`
            trace.push({ model: modelConfig.id, key: displayKey, success: true })
            tracer?.recordSuccess({ ...traceMeta, key: displayKey, output: cat }, Date.now() - t0)
            trackModelUsage(modelConfig.id, modelConfig.provider)
            return { category: cat, classifierModel: modelConfig.id, trace }
          }
        }
      }

      trace.push({ model: modelConfig.id, key: `${key} 1`, success: false })
      tracer?.recordFailed({ ...traceMeta, error: 'no valid category in response' }, Date.now() - t0)
    } catch (error: any) {
      markModelFailed(modelConfig.id)
      trace.push({ model: modelConfig.id, key: `${key} 1`, success: false })
      tracer?.recordFailed({ ...traceMeta, error: error.message }, Date.now() - t0)
      logger.warn(`Classification failure [${modelConfig.id}]: ${error.message}`)
    }
  }

  // All models exhausted — no fallback, fail loudly
  const errMsg = `Classifier: all models exhausted for mode "${mode}" — no category could be determined. Check Admin > Router > CLASSIFIER chain.`
  logger.error(errMsg)
  return { category: null, classifierModel: 'Error', trace, error: errMsg }
}
