import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'
import { getSessionState, summarizeSession } from '@/lib/bot/context'
import { getWebConversationMemory } from '@/lib/bot/memory'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest) {
  try {
    const { activeEntityId } = await req.json()
    const sessionId = activeEntityId || 'global'

    logger.info(`Manual compaction requested for session: ${sessionId}`)

    // 1. Get current history
    const history = await getWebConversationMemory(sessionId)
    
    // 2. Get current state
    const sessionState = await getSessionState(sessionId)
    const currentSummary = sessionState?.distilled_summary || null

    // 3. Trigger summarization
    const newSummary = await summarizeSession(sessionId, history, currentSummary)

    if (!newSummary) {
      return NextResponse.json({ error: 'Compaction failed' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      summary: newSummary,
      token_usage: sessionState?.token_usage_total // This will be updated by summarizeSession
    })
  } catch (error: any) {
    logger.error('Compaction route error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
