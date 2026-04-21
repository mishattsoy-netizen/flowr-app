import { GoogleGenerativeAI } from '@google/generative-ai'
import { supabaseAdmin } from '../supabase'
import { getVaultKey } from '../vault'
import { logger } from '../logger'

const TOPIC_TAGGER_PROMPT = `
Assign a single-word topic category to the following user message. 
Respond with ONLY the category name.
`

/**
 * Logs a message to the database for memory and analytics.
 */
export async function logInteraction(
  telegramId: number, 
  content: string, 
  role: 'user' | 'model',
  type: 'text' | 'image' = 'text',
  usageType: 'chat' | 'tool' | 'search' | 'vision' = 'chat'
) {
  try {
    let topicTag = null

    // Only tag topics for user messages
    if (role === 'user' && content) {
      const apiKey = await getVaultKey('GEMINI_PRIMARY')
      if (apiKey) {
        const genAI = new GoogleGenerativeAI(apiKey)
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-lite' })
        const result = await model.generateContent(`${TOPIC_TAGGER_PROMPT}\n"${content}"`)
        topicTag = result.response.text().trim()
      }
    }

    const { error } = await supabaseAdmin!.from('message_logs').insert({
      telegram_id: telegramId,
      content: content,
      role: role,
      topic_tag: topicTag,
      type: type,
      usage_type: usageType
    })

    if (error) throw error
    logger.info(`Interaction logged [${role}] type [${usageType}] for ${telegramId}`)
  } catch (error) {
    logger.error('Logging failed:', error)
  }
}
