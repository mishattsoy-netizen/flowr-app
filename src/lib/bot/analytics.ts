import { GoogleGenerativeAI } from '@google/generative-ai'
import { supabaseAdmin } from '../supabase'
import { getVaultKey } from '../vault'
import { logger } from '../logger'

const TOPIC_TAGGER_PROMPT = `
Assign a single-word topic category to the following user message. 
Respond with ONLY the category name.
`

/**
 * Logs a Telegram message to the database for memory and analytics.
 */
export async function logInteraction(
  telegramId: number,
  content: string,
  role: 'user' | 'model',
  type: 'text' | 'image' = 'text',
  usageType: 'chat' | 'tool' | 'search' | 'vision' | 'image' = 'chat',
  status: 'success' | 'error' = 'success',
  modelChain?: string,
  requestId?: string
) {
  try {
    let topicTag = null

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
      content,
      role,
      topic_tag: topicTag,
      type,
      usage_type: usageType,
      status,
      model_chain: modelChain ?? null,
      request_id: requestId ?? null
    })

    if (error) throw error
    logger.info(`Interaction logged [${role}] type [${usageType}] for ${telegramId}`)
  } catch (error) {
    logger.error('Logging failed:', error)
  }
}

/**
 * Logs a web app message to the database for memory and analytics.
 * Tries auth_user_id column first; falls back to inserting without it if migration hasn't run.
 */
export async function logWebInteraction(
  authUserId: string,
  content: string,
  role: 'user' | 'model',
  usageType: 'chat' | 'tool' | 'search' | 'vision' | 'image' = 'chat',
  status: 'success' | 'error' = 'success',
  modelChain?: string,
  requestId?: string
) {
  if (!supabaseAdmin) return
  try {
    // Try with auth_user_id (requires migration 20260424_message_logs_web_users.sql)
    const { error } = await supabaseAdmin.from('message_logs').insert({
      auth_user_id: authUserId,
      content,
      role,
      type: 'text',
      usage_type: usageType,
      status,
      model_chain: modelChain ?? null,
      request_id: requestId ?? null
    })

    if (error?.message?.includes('auth_user_id')) {
      // Column doesn't exist yet — insert without it so logs still appear
      const { error: fallbackError } = await supabaseAdmin.from('message_logs').insert({
        content,
        role,
        type: 'text',
        usage_type: usageType,
        topic_tag: `app:${authUserId.slice(0, 8)}`,
        status,
        model_chain: modelChain ?? null,
        request_id: requestId ?? null
      })
      if (fallbackError) logger.warn(`Web log fallback failed: ${fallbackError.message}`)
      else logger.info(`Web interaction logged (no auth_user_id column) [${role}]`)
      return
    }

    if (error) { logger.warn(`Web interaction log failed: ${error.message}`); return }
    logger.info(`Web interaction logged [${role}] type [${usageType}] for ${authUserId}`)
  } catch (error) {
    logger.error('Web logging failed:', error)
  }
}
