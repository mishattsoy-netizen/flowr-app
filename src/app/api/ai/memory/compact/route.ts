import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin as supabase, isSupabaseEnabled } from '@/lib/supabase'
import { getSessionState, summarizeSession } from '@/lib/bot/context'
import { getWebConversationMemory } from '@/lib/bot/memory'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest) {
  try {
    const { activeEntityId } = await req.json()
    const sessionId = activeEntityId || 'global'

    logger.info(`Manual compaction requested for session: ${sessionId}`)

    // 1. Authenticate user from the authorization token
    let user = null;
    if (isSupabaseEnabled) {
      const supabaseClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
      )
      const { data } = await supabaseClient.auth.getUser()
      user = data.user
    }
    const authUserId = user?.id || 'anonymous'

    // 2. Fetch history with correct authUserId and chatId (sessionId)
    const history = await getWebConversationMemory(authUserId, 100, sessionId)
    
    if (!history || history.length === 0) {
      logger.info(`Compaction skipped for session ${sessionId}: history is empty`)
      return NextResponse.json({ 
        success: true, 
        summary: null, 
        message: 'No conversation history available to compact' 
      })
    }
    
    // 3. Get current session state
    const sessionState = await getSessionState(sessionId)
    const currentSummary = sessionState?.distilled_summary || null

    // 4. Trigger summarization
    const { summary: newSummary } = await summarizeSession(sessionId, history, currentSummary)

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
