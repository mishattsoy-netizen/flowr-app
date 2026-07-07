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
  requestId?: string,
  contextMessages?: any,
  imageDescription?: string
) {
  try {
    let topicTag = null

    if (role === 'user' && content) {
      try {
        const { getRouterChain } = await import('../router-config')
        const { chain } = await getRouterChain('REGULAR', 'default')
        const modelConfig = chain.find(m => m.is_enabled && m.provider === 'google')
        
        if (modelConfig) {
          const apiKey = await getVaultKey('GEMINI_PRIMARY')
          if (apiKey) {
            const { runGoogle } = await import('./providers/google')
            const response = await runGoogle(modelConfig.id, `${TOPIC_TAGGER_PROMPT}\n"${content}"`, undefined, undefined, { aiApiKey: apiKey })
            if (response) {
              topicTag = (typeof response === 'string' ? response : response.content).trim()
            }
          }
        }
      } catch (err) {
        logger.warn(`Topic tagging failed (skipping): ${err}`)
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
      request_id: requestId ?? null,
      context_messages: imageDescription ? { ...(contextMessages || {}), image_description: imageDescription } : (contextMessages ?? null)
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
  status: 'success' | 'error' | 'interrupted' = 'success',
  modelChain?: string,
  requestId?: string,
  contextMessages?: any,
  imageDescription?: string,
  chatId?: string | null
) {
  if (!supabaseAdmin) return
  try {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(authUserId)
    const validAuthUserId = (isUUID && authUserId !== '00000000-0000-0000-0000-000000000000') ? authUserId : null
    const topicTag = chatId ? `chat:${chatId}` : null
    // Try with auth_user_id (requires migration 20260424_message_logs_web_users.sql)
    const { error } = await supabaseAdmin.from('message_logs').insert({
      auth_user_id: validAuthUserId,
      content,
      role,
      type: 'text',
      usage_type: usageType,
      status,
      topic_tag: topicTag,
      model_chain: modelChain ?? null,
      request_id: requestId ?? null,
      context_messages: imageDescription ? { ...(contextMessages || {}), image_description: imageDescription } : (contextMessages ?? null)
    })

    if (error?.message?.includes('auth_user_id')) {
      // Column doesn't exist yet — insert without it so logs still appear
      const { error: fallbackError } = await supabaseAdmin.from('message_logs').insert({
        content,
        role,
        type: 'text',
        usage_type: usageType,
        topic_tag: topicTag ?? `app:${authUserId.slice(0, 8)}`,
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

export async function logModelWebMessage(
  authUserId: string,
  content: string,
  usageType: 'chat' | 'tool' | 'search' | 'vision' | 'image' = 'chat',
  status: 'success' | 'error' | 'interrupted' = 'success',
  modelChain?: string,
  requestId?: string,
  contextMessages?: any,
  imageDescription?: string,
  chatId?: string | null
): Promise<number | null> {
  if (!supabaseAdmin) {
    console.log('[Analytics] supabaseAdmin is missing or not initialized in logModelWebMessage!')
    return null
  }
  try {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(authUserId)
    const validAuthUserId = (isUUID && authUserId !== '00000000-0000-0000-0000-000000000000') ? authUserId : null
    const topicTag = chatId ? `chat:${chatId}` : null
    const { data, error } = await supabaseAdmin.from('message_logs').insert({
      auth_user_id: validAuthUserId,
      content,
      role: 'model',
      type: 'text',
      usage_type: usageType,
      status,
      topic_tag: topicTag,
      model_chain: modelChain ?? null,
      request_id: requestId ?? null,
      context_messages: imageDescription ? { ...(contextMessages || {}), image_description: imageDescription } : (contextMessages ?? null)
    }).select('id')

    if (error?.message?.includes('auth_user_id')) {
      const { data: d2, error: e2 } = await supabaseAdmin.from('message_logs').insert({
        content,
        role: 'model',
        type: 'text',
        usage_type: usageType,
        topic_tag: topicTag ?? `app:${authUserId.slice(0, 8)}`,
        status,
        model_chain: modelChain ?? null,
        request_id: requestId ?? null
      }).select('id')
      if (e2) { logger.warn(`logModelWebMessage fallback failed: ${e2.message}`); return null }
      const id2 = d2?.[0]?.id
      logger.info(`Model message logged (no auth_user_id) id=${id2}`)
      return id2 ?? null
    }

    if (error) { logger.warn(`logModelWebMessage failed: ${error.message}`); return null }
    const id = data?.[0]?.id
    logger.info(`Model message logged id=${id}`)
    return id ?? null
  } catch (error) {
    logger.error('logModelWebMessage failed:', error)
    return null
  }
}
