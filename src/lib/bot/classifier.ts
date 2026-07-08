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
  trigger_type?: 'keyword' | 'tag' | 'ai' | 'vision' | 'history_retry'
  trigger_value?: string
  error?: string
}

const VALID_CATEGORIES: (IntentCategory | 'MULTI_CHAIN')[] = [
  'REGULAR', 'COMPLEX',
  'IMAGE_GEN', 'WEB_SEARCH', 'AUDIO',
  'CODING', 'RESEARCH', 'MULTI_CHAIN', 'ADVISOR',
]

// Regexes matching an explicit reference back to a previously-uploaded image.
const PRIOR_IMAGE_REF =
  /\b(my|the|that|this)\s+(image|picture|photo|screenshot|pic|document|doc|file|attachment)\b|\bfrom\s+(the|my)\s+(image|picture|photo|pic|screenshot)\b|\bin\s+the\s+(image|picture|photo|screenshot)\b/i

// Detects the digital-twin / image markers that the vision pipeline injects into
// history when the user has uploaded an image earlier in the conversation.
const HISTORY_IMAGE_MARKER = /\[VISION CONTEXT|\[Image[: \]]|data:image|\[Image attached\]/i

// Mixed-intent: the message references the image AND pulls in an EXTERNAL entity to
// compare/contrast against it ("compare the cheapest one in my screenshot to gemini
// 3.1 flash lite", "X vs Y", "how does it stack up against Z"). These need BOTH the
// image (from history/twin) AND web search for the external entity — so they route to
// WEB_SEARCH, where the twin is now injected as a foreground [IMAGE FACTS] block and
// the search step fetches the external entity. Detected by a comparison structure.
const COMPARISON_STRUCTURE =
  /\b(compare[ds]?|comparison|versus|vs\.?|stack(?:s|ed)?\s+up|better\s+than|worse\s+than|cheaper\s+than|faster\s+than|differ(?:ence|s)?\s+(?:from|between|to)|how\s+does\s+\S.*\b(compare|stack|differ)|against)\b/i

/**
 * Pure decision for how a prior uploaded image should influence classification of
 * the CURRENT message. Extracted so it can be unit-tested without Supabase/LLM mocks.
 *
 * Returns:
 *  - hasVisionContext: an image's digital twin is present earlier in history
 *  - refersToPriorImage: this message explicitly references that image
 *  - mixedIntent: references the image AND compares it to an external entity
 *  - contextHint: the [CONTEXT: ...] string appended to the classifier user prompt
 *
 * Bug history: the previous code emitted a one-sided "prefer REGULAR over WEB_SEARCH"
 * hint whenever ANY image sat in history — even for messages that named NEW products
 * and had nothing to do with the image. That biased the classifier into REGULAR and
 * skipped web search (see transcript ai-transcript-2026-06-04T17-52-23). The hint is
 * now a NEUTRAL fork: refer to the image -> history; raise a new topic -> WEB_SEARCH.
 *
 * Mixed-intent: a message that BOTH references the image AND compares it to an external
 * entity ("how does the cheapest one in my screenshot compare to gemini 3.1 flash lite")
 * routes to WEB_SEARCH — verified (transcript 21-49-08) that with the twin injected as a
 * foreground block + reconciliation prompt, the synthesis model keeps image and external
 * entity separate and produces a real comparison.
 */
export function resolveImageContext(message: string, history: any[]): {
  hasVisionContext: boolean
  refersToPriorImage: boolean
  mixedIntent: boolean
  contextHint: string
} {
  const hasVisionContext = history.some(h => {
    const t = h?.content || h?.parts?.[0]?.text || ''
    return HISTORY_IMAGE_MARKER.test(t)
  })
  const refersToPriorImage = PRIOR_IMAGE_REF.test(message)
  const mixedIntent = refersToPriorImage && COMPARISON_STRUCTURE.test(message)

  let contextHint = ''
  if (hasVisionContext && mixedIntent) {
    contextHint = `\n[CONTEXT: An image the user uploaded is in history, and THIS message compares something from that image against an EXTERNAL entity (a product/model/version not in the image). The external comparison target needs current data — classify as WEB_SEARCH so the comparison is grounded. The image's own contents are preserved and injected into the search chain; do NOT classify REGULAR just because the image is referenced.]`
  } else if (hasVisionContext && refersToPriorImage) {
    contextHint = `\n[CONTEXT: An image the user already uploaded is described in the conversation history. The user is referring to that existing image's content. Answer from history — classify as REGULAR or COMPLEX, NEVER WEB_SEARCH or RESEARCH.]`
  } else if (hasVisionContext) {
    contextHint = `\n[CONTEXT: An image is present earlier in the conversation, but THIS message may or may not be about it. If this message asks about the image's content, classify REGULAR/COMPLEX. If it instead raises a NEW topic, product, model, or version — even one loosely related to the image — classify normally; a named or versioned product/model is WEB_SEARCH. Do not assume continuity with the image; judge from what this message actually asks.]`
  }

  return { hasVisionContext, refersToPriorImage, mixedIntent, contextHint }
}

const DEFAULT_CLASSIFIER_PROMPT = `Classify user intent into exactly ONE category:
FAST_SIMPLE: Quick questions, greetings, casual chat.
COMPLEX: Hard logic, deep analysis, step-by-step reasoning.
MEDIUM_THINKING: Moderate complexity, multi-part answers.
IMAGE_GEN: Requests to create, draw, or generate images/art.
WEB_SEARCH: Current events, live data, product comparisons, new software/AI versions (e.g. "Gemini 3.1", "GPT-5"), or anything likely after 2024.
AUDIO: Voice interaction or audio related.
CODING: Programming, debugging, code snippets.
RESEARCH: Exhaustive topic research and synthesis.
ADVISOR: Strategic advice, coaching, or planning.
MULTI_CHAIN: Multiple intents combined.

PRIOR IMAGE: If history contains [VISION CONTEXT - DIGITAL TWIN] or [Image: ...] and the message refers to it ("from my image", "in the picture", "from the document"), the answer is in history, not on the web — classify REGULAR/COMPLEX, NEVER WEB_SEARCH/RESEARCH, even if it names a product.

Respond ONLY with the category name.`

const TAG_CATEGORY_MAP: Record<string, IntentCategory> = {
  '/search': 'WEB_SEARCH',
  '/research': 'RESEARCH',
  '/code': 'CODING',
  '/image': 'IMAGE_GEN',
  '/tool': 'COMPLEX',
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
    return {
      category: TAG_CATEGORY_MAP[intentTag],
      classifierModel: 'Intent Tag',
      trace: [],
      trigger_type: 'tag',
      trigger_value: intentTag
    }
  }

  // Retry and brief continuation intent fast-path: short follow-ups like "try again", "again", "one more", "another"
  // inherit the category of the last user message in history instead of being classified standalone.
  const RETRY_PHRASES = [
    'try again', 'retry', 'again', 'one more time', 'redo', 'do it again', 
    'try once more', 'please retry', 'last one', 'one more', 'another', 
    'more', 'short one', 'longer', 'bigger'
  ]
  const cleanMsg = lowerMsg.replace(/[.!?]+$/, '').trim()
  const isRetry = RETRY_PHRASES.includes(cleanMsg)
  if (isRetry && history.length > 0) {
    const lastUserMsg = [...history].reverse().find(h => h.role === 'user')
    if (lastUserMsg) {
      const lastText = (lastUserMsg.parts?.[0]?.text || lastUserMsg.content || '').trim()
      if (lastText && lastText.toLowerCase() !== lowerMsg) {
        return classifyIntentWithModel(lastText, aiApiKey, modelId, mode, intentTag, [], replyContext, tracer)
      }
    }
  }

  // Read active prompt from file
  let activePrompt = DEFAULT_CLASSIFIER_PROMPT
  try {
    const fs = require('fs')
    const path = require('path')
    const promptPath = path.join(process.cwd(), 'src/lib/bot/prompts/chains/classifier.txt')
    activePrompt = fs.readFileSync(promptPath, 'utf8')
  } catch (err) {
    logger.warn(`Failed to read classifier.txt, using default.`)
  }

  // Load keywords from static file
  let keywordsObj: Record<string, string[]> | null = null
  try {
    const fs = require('fs')
    const path = require('path')
    const kwPath = path.join(process.cwd(), 'src/lib/bot/prompts/classifier_keywords.json')
    keywordsObj = JSON.parse(fs.readFileSync(kwPath, 'utf8'))
  } catch (err) {
    logger.warn('Failed to read classifier_keywords.json, skipping keyword fast-path.')
  }

  // Keyword fast-path — only runs if keywords file loaded successfully
  if (keywordsObj) {
    for (const cat of Object.keys(keywordsObj) as IntentCategory[]) {
      const catKeywords = keywordsObj[cat] || []
      for (const kw of catKeywords) {
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
          return {
            category: cat,
            classifierModel: 'Keywords',
            trace: [],
            matchedKeyword: kw.trim(),
            trigger_type: 'keyword',
            trigger_value: kw.trim()
          }
        }
      }
    }
  }

  // Use provided history context (already limited by caller via historyLimit setting)
  const recentHistory = history

  // Reply context prefix
  const replyPrefix = replyContext?.attentionBlock ? replyContext.attentionBlock + '\n\n' : ''

  // Model classification
  const { chain } = await getRouterChain('CLASSIFIER', 'default')
  let activeChain = chain && chain.length > 0 ? chain : [{ id: 'openai/gpt-4o-mini', provider: 'openrouter', openrouter_provider: 'openai', is_enabled: true } as any]

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
  const lastModelText = lastModelMsg
    ? (lastModelMsg.content || lastModelMsg.parts?.[0]?.text || '')
    : ''
  const lastWasImage = !!lastModelText && /(!\[|data:image|\[Image[: ])/i.test(lastModelText)

  // Vision context: did any recent turn contain an image the user uploaded (carries a
  // digital twin)? The twin is injected into the USER message text as [VISION CONTEXT...]
  // or [Image: ...]. The decision of how that influences this message's classification
  // is a pure, unit-tested helper (see resolveImageContext).
  const { hasVisionContext: historyHasVisionContext, refersToPriorImage, mixedIntent, contextHint: imageHint } =
    resolveImageContext(message, history)

  let contextHint = imageHint
  if (lastWasImage) {
    // Iterating on a just-generated image takes priority over the upload-context hint.
    contextHint = `\n[CONTEXT: The last response contained an image. Follow-up requests like "one more", "make it...", or "change..." should likely be IMAGE_GEN.]`
  }
  const finalUserPrompt = `${replyPrefix}${contextHint}\nUser: "${message}"`

  // Hard guard: an explicit reference to a previously-uploaded image must never be
  // sent to the web. Search chains drop history (incl. the vision digital twin), so the
  // model would lose all knowledge of the image and answer about something unrelated.
  // Downgrade WEB_SEARCH/RESEARCH to REGULAR in that case, regardless of model output.
  const guardCategory = (cat: IntentCategory | 'MULTI_CHAIN'): IntentCategory | 'MULTI_CHAIN' => {
    if ((cat === 'WEB_SEARCH' || cat === 'RESEARCH') && historyHasVisionContext && refersToPriorImage && !mixedIntent) {
      logger.info(`[Classifier guard] Downgrading ${cat} → REGULAR: message refers to a prior uploaded image`)
      return 'REGULAR'
    }
    // Guard: hardware/physical maintenance questions misclassified as CODING → WEB_SEARCH
    if (cat === 'CODING') {
      const isHardwareMaintenance = /(remove|replace|fix|repair|clean|take\s+off|disassemble|detach|pry|unscrew)[\s\S]{0,80}(keycap|keyboard|screen|display|battery|trackpad|touchpad|hinge|fan|speaker|camera|bezel|screw|adhesive|gasket|seal)|(keycap|keyboard|screen|display|battery|trackpad|touchpad|hinge|fan|speaker|camera|bezel|screw|adhesive|gasket|seal)[\s\S]{0,80}(remove|replace|fix|repair|clean|take\s+off|disassemble|detach|pry|unscrew)/i
      if (isHardwareMaintenance.test(message)) {
        logger.info(`[Classifier guard] Downgrading CODING → WEB_SEARCH: message appears to be hardware maintenance`)
        return 'WEB_SEARCH'
      }
    }
    return cat
  }

  for (const modelConfig of activeChain) {
    if (!modelConfig.is_enabled) continue
    if (isModelFailed(modelConfig.id)) {
      logger.info(`Classifier skipping failed model: ${modelConfig.id}`)
      trace.push({ model: modelConfig.id, key: 'SKIPPED', success: false })
      continue
    }

    const provider = modelConfig.provider.toLowerCase()
    let key = (provider === 'google' || provider === 'gemini') ? 'GEMINI' : modelConfig.provider.toUpperCase()
    if (modelConfig.provider.toLowerCase().includes('ollama')) key = 'LOCAL'

    const t0 = Date.now()
    const traceMeta = { chain: 'CLASSIFIER', model: modelConfig.id, provider: modelConfig.provider, key: `${key} 1`, input_system: activePrompt || undefined, input_user: finalUserPrompt, input_history_count: recentHistory.length }

    try {
      let rawResponse: any = null
      const traceContext: any = { aiApiKey }

      const provider = modelConfig.provider.toLowerCase()
      if (provider === 'google' || provider === 'gemini') {
        rawResponse = await runGoogle(modelConfig.id, finalUserPrompt, activePrompt, undefined, traceContext, recentHistory)
      } else if (provider === 'groq') {
        rawResponse = await runGroq(modelConfig.id, finalUserPrompt, activePrompt, aiApiKey, traceContext, recentHistory)
      } else if (provider === 'openrouter') {
        const orRes = await (await import('./providers/openrouter')).runOpenRouter(modelConfig.id, finalUserPrompt, activePrompt || '', recentHistory, aiApiKey, modelConfig.openrouter_provider || undefined)
        rawResponse = typeof orRes === 'string' ? orRes : (orRes as any)?.content || null
      } else if (provider === 'ollama' || provider === 'local') {
        const olRes = await (await import('./providers/ollama')).runOllama(modelConfig.id, finalUserPrompt, activePrompt || '', recentHistory)
        rawResponse = typeof olRes === 'string' ? olRes : null
      } else if (provider === 'pollinations') {
        const polRes = await (await import('./providers/pollinations')).runPollinationsText(modelConfig.id, finalUserPrompt, activePrompt || '', recentHistory)
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
            const finalCat = guardCategory(cat)
            const displayKey = traceContext.usedKeyIndex ? `${key} ${traceContext.usedKeyIndex}` : `${key} 1`
            trace.push({ model: modelConfig.id, key: displayKey, success: true })
            tracer?.recordSuccess({ ...traceMeta, key: displayKey, output: finalCat }, Date.now() - t0)
            trackModelUsage(modelConfig.id, modelConfig.provider)
            return {
              category: finalCat,
              classifierModel: modelConfig.id,
              trace,
              trigger_type: 'ai',
              trigger_value: modelConfig.id
            }
          }
        }

        for (const cat of VALID_CATEGORIES) {
          const regex = new RegExp(`\\b${cat}\\b`, 'i')
          if (regex.test(categoryText)) {
            const finalCat = guardCategory(cat)
            const displayKey = traceContext.usedKeyIndex ? `${key} ${traceContext.usedKeyIndex}` : `${key} 1`
            trace.push({ model: modelConfig.id, key: displayKey, success: true })
            tracer?.recordSuccess({ ...traceMeta, key: displayKey, output: finalCat }, Date.now() - t0)
            trackModelUsage(modelConfig.id, modelConfig.provider)
            return {
              category: finalCat,
              classifierModel: modelConfig.id,
              trace,
              trigger_type: 'ai',
              trigger_value: modelConfig.id
            }
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
