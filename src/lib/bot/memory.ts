import { supabaseAdmin } from '../supabase'
import { logger } from '../logger'

export interface MemoryItem {
  role: 'user' | 'model'
  parts: [{ text: string }]
}

/**
 * Strips the "[Tools: ...]" history annotation appended to logged assistant
 * messages (see buildToolSummary in route.ts/webhook route.ts). This text is
 * bookkeeping for humans/analytics only — replaying it verbatim as the
 * model's own prior turn taught the model to imitate the pattern as plain
 * text instead of issuing real tool calls, which broke UI artifact
 * rendering and leaked the annotation into Telegram messages.
 */
export function stripToolSummary(content: string): string {
  return content.replace(/\n\n\[Tools:[\s\S]*?\]$/, '')
}

/**
 * Twin lookup for a user message. The twin (image description) is stored on
 * the user row itself at log time; older rows only have it on the following
 * assistant row. Never borrow from a following USER row — that attached
 * other people's images to unrelated messages (bug: transcript 14-47-19).
 */
export function resolveTwinForUserMessage(msg: any, nextMsg: any): string | null {
  const own = msg?.context_messages?.image_description
  if (own) return own
  if (nextMsg?.role === 'model' && nextMsg?.context_messages?.image_description) {
    return nextMsg.context_messages.image_description
  }
  return null
}

/**
 * Fetches the last N messages for a Telegram chat to provide context.
 */
export async function getConversationMemory(telegramId: number, limit: number = 100): Promise<MemoryItem[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('message_logs')
      .select('role, content, context_messages')
      .eq('telegram_id', telegramId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    const reversed = data.reverse()
    const history = reversed.map((msg: any, i: number) => {
      let cleanContent = stripToolSummary(msg.content || "");
      if (cleanContent.includes('data:image/')) {
        const description = msg.context_messages?.image_description;
        cleanContent = cleanContent.replace(/!\[.*?\]\s*\(\s*data:image\/.*?;base64,[\s\S]*?\)/g, description ? `[Image: ${description}]` : '[Image: (visual content generated)]');
      }
      // Inject digital twin so non-vision chains have full image context in history.
      if (msg.role !== 'model') {
        const twin = resolveTwinForUserMessage(msg, reversed[i + 1])
        if (twin) cleanContent = `${cleanContent}\n\n[VISION CONTEXT - DIGITAL TWIN]\n${twin}`.trim()
      }
      return {
        role: msg.role === 'model' ? 'model' : 'user',
        parts: [{ text: cleanContent }]
      };
    })

    return history as MemoryItem[]
  } catch (error) {
    logger.error(`Failed to fetch memory for ${telegramId}:`, error)
    return []
  }
}

/**
 * Fetches the last N messages for a web app user to provide context.
 * Requires message_logs to have an auth_user_id column (added via migration).
 * Falls back to empty history gracefully if column is missing.
 */
export async function getWebConversationMemory(authUserId: string, limit: number = 100, chatId?: string | null): Promise<MemoryItem[]> {
  try {
    // Fetch the memory_cleared_at timestamp for this user
    const { data: quota } = await supabaseAdmin
      .from('user_quotas')
      .select('memory_cleared_at')
      .eq('auth_user_id', authUserId)
      .maybeSingle();

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(authUserId);
    const validAuthUserId = (isUUID && authUserId !== '00000000-0000-0000-0000-000000000000') ? authUserId : null;

    let query = supabaseAdmin
      .from('message_logs')
      .select('role, content, context_messages');

    if (validAuthUserId) {
      query = query.eq('auth_user_id', validAuthUserId);
    } else {
      query = query.is('auth_user_id', null);
    }

    // Chat isolation: when a chatId is provided, only return messages tagged with this chat.
    // Without this, "new chat" leaks all prior user history into the context window.
    if (chatId) {
      query = query.eq('topic_tag', `chat:${chatId}`);
    }

    if (quota?.memory_cleared_at) {
      query = query.gt('created_at', quota.memory_cleared_at);
    }

    const { data: initialData, error } = await query
      .order('created_at', { ascending: false })
      .limit(limit);

    let resultData: any[] | null = null;
    if (!error && initialData) { resultData = initialData; }

    if (error) {
      logger.warn(`Web memory unavailable for ${authUserId}: ${error.message}`);
      return [];
    }

    const reversed = (resultData || []).reverse()
    const history = reversed.map((msg: any, i: number) => {
      let cleanContent = stripToolSummary(msg.content || "");
      // Truncate massive base64 images in history to avoid context bloat and model hallucination
      if (cleanContent.includes('data:image/')) {
        const description = msg.context_messages?.image_description;
        cleanContent = cleanContent.replace(/!\[.*?\]\s*\(\s*data:image\/.*?;base64,[\s\S]*?\)/g, description ? `[Image: ${description}]` : '[Image: (visual content generated)]');
      }
      // Inject digital twin so non-vision chains have full image context in history.
      if (msg.role !== 'model') {
        const twin = resolveTwinForUserMessage(msg, reversed[i + 1])
        if (twin) cleanContent = `${cleanContent}\n\n[VISION CONTEXT - DIGITAL TWIN]\n${twin}`.trim()
      }
      return {
        role: msg.role === 'model' ? 'model' : 'user',
        parts: [{ text: cleanContent }]
      };
    })

    return history as MemoryItem[]
  } catch (error) {
    logger.error(`Failed to fetch web memory for ${authUserId}:`, error)
    return []
  }
}

