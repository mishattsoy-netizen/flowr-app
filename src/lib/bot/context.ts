import { supabaseAdmin as supabase } from '../supabase'
import { logger } from '../logger'
import { compactSession, getCompactionConfig } from './compaction'

export interface SessionState {
  chat_id: string
  distilled_summary: string | null
  token_usage_total: number
  context_limit: number
  compaction_threshold: number
  last_summarized_at: string
  pending_action: { tool: string; args: Record<string, any>; dry_run_result: any; created_at: string; turn_seq?: number } | null
  turn_seq: number
  last_compacted_message_id: number | null
}

const CHARS_PER_TOKEN = 3.5

export function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

export async function getSessionState(chatId: string): Promise<SessionState | null> {
  const { getCompactionConfig } = await import('./compaction')
  const { getPipelineSettings } = await import('../router-config')

  const [config, settings] = await Promise.all([
    getCompactionConfig(),
    getPipelineSettings(),
  ])

  if (chatId === 'temp' || chatId.startsWith('temp:') || chatId.startsWith('temp')) {
    return {
      chat_id: chatId,
      distilled_summary: null,
      token_usage_total: 0,
      context_limit: config.context_limit,
      compaction_threshold: config.compaction_threshold,
      last_summarized_at: new Date(0).toISOString(),
      pending_action: null,
      turn_seq: 0,
      last_compacted_message_id: null
    }
  }

  if (!supabase) {
    return {
      chat_id: chatId,
      distilled_summary: null,
      token_usage_total: 0,
      context_limit: config.context_limit,
      compaction_threshold: config.compaction_threshold,
      last_summarized_at: new Date(0).toISOString(),
      pending_action: null,
      turn_seq: 0,
      last_compacted_message_id: null
    }
  }

  let dbChatId = chatId;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chatId)) {
    dbChatId = `chat:${chatId}`;
  }

  const sessionResult = await supabase
    .from('bot_session_states')
    .select('*')
    .eq('chat_id', dbChatId)
    .maybeSingle()

  if (sessionResult.error) {
    logger.error(`Failed to fetch session state for ${chatId}:`, sessionResult.error)
    return null
  }

  const baseState = sessionResult.data || {
    chat_id: chatId,
    distilled_summary: null,
    token_usage_total: 0,
    last_summarized_at: new Date(0).toISOString(),
    pending_action: null,
    turn_seq: 0,
    last_compacted_message_id: null
  }

  return {
    ...baseState,
    context_limit: config.context_limit,
    compaction_threshold: config.compaction_threshold
  }
}

export async function updateSessionState(chatId: string, updates: Partial<SessionState>): Promise<void> {
  if (chatId === 'temp' || chatId.startsWith('temp:') || chatId.startsWith('temp')) {
    return
  }
  if (!supabase) return
  const { context_limit, compaction_threshold, ...dbUpdates } = updates as any
  const { error } = await supabase
    .from('bot_session_states')
    .upsert({ chat_id: chatId, ...dbUpdates, updated_at: new Date().toISOString() })
  if (error) logger.error(`Failed to update session state for ${chatId}:`, error)
}

export async function clearSessionState(chatId: string): Promise<void> {
  if (chatId === 'temp' || chatId.startsWith('temp:') || chatId.startsWith('temp')) {
    return
  }
  if (!supabase) return
  const { error } = await supabase
    .from('bot_session_states')
    .delete()
    .eq('chat_id', chatId)
  if (error) logger.error(`Failed to clear session state for ${chatId}:`, error)
}

export async function summarizeSession(
  chatId: string,
  history: any[],
  currentSummary: string | null
): Promise<{ summary: string | null; cost: number }> {
  try {
    // Fetch the existing watermark so a failed compaction (compactSession
    // falls back to { newWatermark: currentWatermark } when all models fail)
    // preserves it instead of being nulled out below.
    const existing = await getSessionState(chatId)
    const currentWatermark = existing?.last_compacted_message_id ?? null
    const { summary: newSummary, cost, newWatermark } = await compactSession(chatId, history, currentSummary, currentWatermark)
    if (newSummary) {
      if (!(chatId === 'temp' || chatId.startsWith('temp:') || chatId.startsWith('temp'))) {
        await updateSessionState(chatId, {
          distilled_summary: newSummary,
          last_summarized_at: new Date().toISOString(),
          token_usage_total: estimateTokens(newSummary),
          last_compacted_message_id: newWatermark ?? currentWatermark,
        })
      }
      return { summary: newSummary, cost }
    }
    return { summary: null, cost }
  } catch (error) {
    logger.error(`Summarization failed for session ${chatId}:`, error)
  }
  return { summary: null, cost: 0 }
}
