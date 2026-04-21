import { GoogleGenerativeAI } from '@google/generative-ai'
import { getVaultKey } from '../vault'
import { IntentCategory } from '../router-config'
import { logger } from '../logger'

const INTENT_CLASSIFICATION_PROMPT = `
You are the brain of Flowr AI. Classify the user's message into exactly one of these categories:

1. FAST_SIMPLE: Greetings, casual chat, simple facts, quick questions, or non-technical follow-ups.
2. COMPLEX_THINKING: Deep reasoning, coding requests, complex math, strategic planning, or creative long-form writing.
3. IMAGE_GEN: Requests to generate, draw, create, or visualize an image.
4. WEB_SEARCH: Questions about current events, news, specific people/companies, or requests to "search the web".
5. AUDIO_VOICE: Requests to transcribe, speak, or handle audio (if explicitly mentioned).

Respond with ONLY the category name.

User Message:
`

/**
 * Uses Gemini Flash to classify user intent.
 * This is the gateway to the Flowr Routing Engine.
 */
export async function classifyIntent(message: string): Promise<IntentCategory> {
  // 1. Keyword Overrides (Efficiency)
  const text = message.toLowerCase()
  if (text.startsWith('/') || text.length < 5) return 'FAST_SIMPLE'
  if (text.includes('draw') || text.includes('generate image') || text.includes('create a picture')) return 'IMAGE_GEN'
  if (text.includes('search') || text.includes('who is') || text.includes('news about')) return 'WEB_SEARCH'

  // 2. AI Classification
  const apiKey = await getVaultKey('GEMINI_PRIMARY')
  if (!apiKey) {
    logger.warn('GEMINI_PRIMARY missing for classification. Falling back to FAST_SIMPLE.')
    return 'FAST_SIMPLE'
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-lite' })
    
    const result = await model.generateContent(`${INTENT_CLASSIFICATION_PROMPT}\n"${message}"`)
    const rawCategory = result.response.text().trim().toUpperCase() as any

    const validCategories: IntentCategory[] = [
      'FAST_SIMPLE', 'COMPLEX_THINKING', 'MEDIUM_THINKING', 
      'IMAGE_GEN', 'WEB_SEARCH', 'AUDIO_VOICE', 'TOOL_CALLING'
    ]

    if (validCategories.includes(rawCategory)) {
      return rawCategory as IntentCategory
    }

    return 'FAST_SIMPLE'
  } catch (error) {
    logger.error('Intent classification failed:', error)
    return 'FAST_SIMPLE'
  }
}
