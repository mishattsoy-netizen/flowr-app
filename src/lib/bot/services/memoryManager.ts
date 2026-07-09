import { getConversationMemory, getWebConversationMemory } from '../memory'
import { getSessionState, summarizeSession } from '../context'
import { logger } from '../../logger'

export interface MemoryContext {
  chatId?: number
  userId?: string
  isTempChat?: boolean
  activeChatId?: string | null
  clientHistory?: any[]
  _triggerType?: string
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

export async function manageSessionCompaction(
  sessionId: string,
  history: any[],
  sessionState: any
): Promise<{ currentSummary: string | null; updatedSessionState: any; cost: number }> {
  let currentSummary = sessionState?.distilled_summary || null
  let cost = 0

  if (sessionState && !currentSummary && history.length >= 5
    && sessionState.token_usage_total > sessionState.context_limit * sessionState.compaction_threshold) {

    logger.info(`Pre-request compaction for ${sessionId} (${sessionState.token_usage_total}/${sessionState.context_limit})`)

    const result = await summarizeSession(sessionId, history, null)
    cost = result.cost
    const updated = await getSessionState(sessionId)

    if (updated?.distilled_summary) {
      currentSummary = updated.distilled_summary
      sessionState.distilled_summary = updated.distilled_summary
      sessionState.token_usage_total = updated.token_usage_total ?? sessionState.token_usage_total
    }
  }

  return { currentSummary, updatedSessionState: sessionState, cost }
}
