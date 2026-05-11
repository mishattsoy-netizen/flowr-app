import { supabaseAdmin } from '../supabase'
import { logger } from '../logger'

export interface MemoryItem {
  role: 'user' | 'model'
  parts: [{ text: string }]
}

/**
 * Fetches the last N messages for a Telegram chat to provide context.
 */
export async function getConversationMemory(telegramId: number, limit: number = 100): Promise<MemoryItem[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('message_logs')
      .select('role, content')
      .eq('telegram_id', telegramId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    const history = data.reverse().map((msg: any) => {
      let cleanContent = msg.content || "";
      if (cleanContent.includes('data:image/')) {
        cleanContent = cleanContent.replace(/!\[.*?\]\s*\(\s*data:image\/.*?;base64,[\s\S]*?\)/g, '[Image Data]');
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
export async function getWebConversationMemory(authUserId: string, limit: number = 100): Promise<MemoryItem[]> {
  try {
    // Fetch the memory_cleared_at timestamp for this user
    const { data: quota } = await supabaseAdmin
      .from('user_quotas')
      .select('memory_cleared_at')
      .eq('auth_user_id', authUserId)
      .maybeSingle();

    let query = supabaseAdmin
      .from('message_logs')
      .select('role, content')
      .or(`auth_user_id.eq.${authUserId},topic_tag.eq.app:${authUserId.slice(0, 8)}`);

    if (quota?.memory_cleared_at) {
      query = query.gt('created_at', quota.memory_cleared_at);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.warn(`Web memory unavailable for ${authUserId}: ${error.message}`);
      return [];
    }

    const history = (data || []).reverse().map((msg: any) => {
      let cleanContent = msg.content || "";
      // Truncate massive base64 images in history to avoid context bloat and model hallucination
      if (cleanContent.includes('data:image/')) {
        cleanContent = cleanContent.replace(/!\[.*?\]\s*\(\s*data:image\/.*?;base64,[\s\S]*?\)/g, '[Image Data]');
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
