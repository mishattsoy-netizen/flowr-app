import { supabaseAdmin } from '../supabase'
import { logger } from '../logger'

export interface MemoryItem {
  role: 'user' | 'model'
  parts: [{ text: string }]
}

/**
 * Fetches the last N messages for a chat to provide context.
 */
export async function getConversationMemory(telegramId: number, limit: number = 20): Promise<MemoryItem[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('message_logs')
      .select('role, content')
      .eq('telegram_id', telegramId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    // Reverse to get chronological order for LLM
    const history = data.reverse().map((msg: any) => ({
      role: msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.content || "" }]
    }))

    return history as MemoryItem[]
  } catch (error) {
    logger.error(`Failed to fetch memory for ${telegramId}:`, error)
    return []
  }
}
