import { getRouterChain, Platform, IntentCategory } from '../router-config'
import { logger } from '../logger'
import { runGoogle } from './providers/google'
import { runGroq } from './providers/groq'
import { supabaseAdmin } from '../supabase'

function trackModelUsage(modelId: string, provider: string) {
  supabaseAdmin.rpc('increment_model_usage', { p_model_id: modelId, p_provider: provider })
    .then(({ error }: { error: any }) => { if (error) logger.warn(`Usage track failed [${modelId}]: ${error.message}`) })
}

const INTENT_CLASSIFICATION_PROMPT = `
You are the brain of Flowr AI. Classify the user's message into exactly one of these categories:

1. FAST_SIMPLE: Greetings, casual chat, simple facts, quick questions, or non-technical follow-ups.
2. MEDIUM_THINKING: General knowledge questions, short creative writing, or moderately complex explanations.
3. COMPLEX_THINKING: Deep reasoning, coding requests, complex math, strategic planning, or creative long-form writing.
4. IMAGE_GEN: Requests to generate, draw, create, or visualize an image.
5. WEB_SEARCH: Questions about current events, news, specific people/companies, or requests to "search the web".
6. TOOL_CALLING: Requests to create, edit, delete, move, or modify notes, folders, tasks, or workspace items.
7. AUDIO_VOICE: Requests to transcribe, speak, or handle audio (if explicitly mentioned).

Respond with ONLY the category name.

User Message:
`

export interface ClassifyResult {
  category: IntentCategory
  classifierModel: string
}

/**
 * Uses Gemini Flash to classify user intent.
 * This is the gateway to the Flowr Routing Engine.
 */
export async function classifyIntent(message: string, aiApiKey?: string, modelId?: string, platform: Platform = 'telegram'): Promise<IntentCategory> {
  return (await classifyIntentWithModel(message, aiApiKey, modelId, platform)).category
}

export async function classifyIntentWithModel(message: string, aiApiKey?: string, modelId?: string, platform: Platform = 'telegram'): Promise<ClassifyResult> {
  // Dynamic Classification Model from DB
  // Try requested platform first, fall back to telegram if no chain configured for this platform
  let { chain } = await getRouterChain('CLASSIFIER', platform)
  if (chain.length === 0 && platform !== 'telegram') {
    const fallbackResult = await getRouterChain('CLASSIFIER', 'telegram')
    chain = fallbackResult.chain
  }

  // Use provided modelId if exists (client override), otherwise use the chain
  const activeChain = modelId ? [{ id: modelId, provider: 'google', is_enabled: true }] : chain

  for (const modelConfig of activeChain) {
    if (!modelConfig.is_enabled) continue

    try {
      logger.info(`Attempting classification with: ${modelConfig.id} (${modelConfig.provider})`)
      let rawResponse: string | null = null

      if (modelConfig.provider === 'google') {
        rawResponse = await runGoogle(modelConfig.id, `${INTENT_CLASSIFICATION_PROMPT}\n"${message}"`, undefined, undefined, { aiApiKey, platform })
      } else if (modelConfig.provider === 'groq') {
        rawResponse = await runGroq(modelConfig.id, `${INTENT_CLASSIFICATION_PROMPT}\n"${message}"`, undefined, aiApiKey)
      }

      if (rawResponse) {
        const validCategories: IntentCategory[] = [
          'FAST_SIMPLE', 'COMPLEX_THINKING', 'MEDIUM_THINKING',
          'IMAGE_GEN', 'WEB_SEARCH', 'AUDIO_VOICE', 'TOOL_CALLING'
        ]

        for (const cat of validCategories) {
          if (rawResponse.toUpperCase().includes(cat)) {
            trackModelUsage(modelConfig.id, modelConfig.provider)
            return { category: cat, classifierModel: modelConfig.id }
          }
        }
      }
    } catch (error: any) {
      logger.warn(`Classification failure [${modelConfig.id}]: ${error.message}`)
    }
  }

  return { category: 'FAST_SIMPLE', classifierModel: 'fallback' }
}
