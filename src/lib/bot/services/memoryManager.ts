import { getConversationMemory, getWebConversationMemory } from '../memory'
import type { MemoryItem } from '../memory'
import { getSessionState, updateSessionState, estimateTokens } from '../context'
import { compactSession } from '../compaction'
import { logger } from '../../logger'

export interface MemoryContext {
  chatId?: number
  userId?: string
  isTempChat?: boolean
  activeChatId?: string | null
  clientHistory?: any[]
  _triggerType?: string
}

/**
 * Returns only the history items with an id strictly after the watermark.
 * Items with no id (e.g. the client-supplied fallback history, which has no
 * DB-backed id) are always treated as "after" — see the §7b handoff note on
 * why this never actually matters in practice (compaction can't fire on the
 * one turn where id-less history is used).
 */
export function messagesAfterWatermark<T extends { id?: number }>(history: T[], watermark: number | null | undefined): T[] {
  if (!watermark) return history
  return history.filter(h => (h.id ?? Infinity) > watermark)
}

export async function fetchConversationHistory(
  context: MemoryContext,
  historyLimit: number
): Promise<any[]> {
  let history: any[] = []

  if (context.userId && context.userId !== 'anonymous' && (!context.isTempChat || context._triggerType === 'telegram') && context.activeChatId) {
    history = await getWebConversationMemory(context.userId, historyLimit, context.activeChatId)
  } else if (context.chatId) {
    history = await getConversationMemory(context.chatId, historyLimit)
  }

  if (history.length === 0 && context.clientHistory && context.clientHistory.length > 0) {
    history = context.clientHistory.slice(-historyLimit)
  }

  return history
}

// Per-session lock: if a compaction for this session is already in flight
// (e.g. two near-simultaneous requests both crossed the threshold), the
// second caller awaits the first's result instead of racing it. This is a
// module-level, per-process lock — it does not protect against concurrent
// requests landing on different serverless instances, only same-process
// races (e.g. two browser tabs hitting the same warm instance).
const compactionLocks = new Map<string, Promise<any>>()

// How far back manageSessionCompaction is willing to re-fetch to reach the
// watermark. Must be well above any realistic historyLimit (the display
// window is capped at ~20-100) — otherwise a chatty session that outgrows
// the display cap between compactions would have its watermark jump past
// messages that were never actually seen, silently dropping them from both
// the summary and the future prompt window. See §7b spec note.
const COMPACTION_FETCH_LIMIT = 500

export async function manageSessionCompaction(
  sessionId: string,
  history: MemoryItem[],
  sessionState: any,
  memoryContext?: MemoryContext
): Promise<{ currentSummary: string | null; updatedSessionState: any; cost: number }> {
  let currentSummary = sessionState?.distilled_summary || null
  let cost = 0

  if (!sessionState || history.length < 5) {
    return { currentSummary, updatedSessionState: sessionState, cost }
  }

  const totalUsage = sessionState.token_usage_total ?? 0
  const limit = sessionState.context_limit ?? 10000
  const threshold = sessionState.compaction_threshold ?? 0.80
  if (totalUsage <= limit * threshold) {
    return { currentSummary, updatedSessionState: sessionState, cost }
  }

  if (compactionLocks.has(sessionId)) {
    await compactionLocks.get(sessionId)
    const refreshed = await getSessionState(sessionId)
    if (refreshed) {
      currentSummary = refreshed.distilled_summary
      Object.assign(sessionState, refreshed)
    }
    return { currentSummary, updatedSessionState: sessionState, cost: 0 }
  }

  const watermark: number | null = sessionState.last_compacted_message_id ?? null

  // The `history` passed in is capped to the display window (historyLimit,
  // ~20 messages) — reusing it here would silently skip any message older
  // than that cap once the conversation outgrows it between compactions.
  // Re-fetch a much wider window reaching back toward the watermark so the
  // compactor sees everything it's about to claim as covered.
  const fetchSource = memoryContext ? await fetchConversationHistory(memoryContext, COMPACTION_FETCH_LIMIT) : history
  const messagesSinceWatermark = messagesAfterWatermark(fetchSource as MemoryItem[], watermark)

  if (messagesSinceWatermark.length === 0) {
    return { currentSummary, updatedSessionState: sessionState, cost }
  }

  const run = (async () => {
    try {
      logger.info(`Compaction for ${sessionId} (${totalUsage}/${limit}, watermark=${watermark}, messages=${messagesSinceWatermark.length})`)
      const result = await compactSession(sessionId, messagesSinceWatermark, currentSummary, watermark)
      if (result.summary) {
        // Reset token_usage_total to just the new summary's size — the next
        // turn's end-of-turn bookkeeping will grow it again from the
        // post-watermark window, same coupling the old design relied on.
        await updateSessionState(sessionId, {
          distilled_summary: result.summary,
          last_compacted_message_id: result.newWatermark ?? watermark,
          last_summarized_at: new Date().toISOString(),
          token_usage_total: estimateTokens(result.summary),
        })
      }
      return result
    } catch (error) {
      logger.error(`Compaction failed for ${sessionId}:`, error)
      return { summary: null, cost: 0, newWatermark: watermark }
    }
  })()

  compactionLocks.set(sessionId, run)
  try {
    const result = await run
    cost = result.cost
    if (result.summary) {
      currentSummary = result.summary
      sessionState.distilled_summary = result.summary
      sessionState.last_compacted_message_id = result.newWatermark ?? watermark
      sessionState.token_usage_total = estimateTokens(result.summary)
    }
  } finally {
    compactionLocks.delete(sessionId)
  }

  return { currentSummary, updatedSessionState: sessionState, cost }
}
