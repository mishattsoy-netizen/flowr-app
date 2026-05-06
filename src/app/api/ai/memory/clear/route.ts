import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin, isSupabaseEnabled } from '@/lib/supabase'
import { clearSessionState } from '@/lib/bot/context'

export async function POST(req: NextRequest) {
  let user = null;

  if (isSupabaseEnabled) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    )
    const { data } = await supabase.auth.getUser()
    user = data.user
  }

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase admin not configured' }, { status: 500 })
  }

  try {
    const { activeEntityId } = await req.json().catch(() => ({}));


    // 1. We no longer delete from message_logs to preserve history for analytics/admin.
    // Instead, we just update memory_cleared_at in user_quotas.
    // The context fetcher (getWebConversationMemory) will respect this timestamp.

    try {
      await supabaseAdmin
        .from('user_quotas')
        .upsert({ 
          auth_user_id: user.id,
          memory_cleared_at: new Date().toISOString() 
        }, { onConflict: 'auth_user_id' })
    } catch (err) {
      console.error('[Memory Clear Update Quota Error]', err)
    }

    // 2. Clear the session state (token usage, summary)
    try {
      await clearSessionState(activeEntityId || 'global')
    } catch (err) {
      console.error('[Memory Clear Session State Error]', err)
    }

    return NextResponse.json({ success: true, message: 'Conversation memory cleared' })
  } catch (error: any) {
    console.error('[AI Memory Clear Error]', error);
    return NextResponse.json({ error: error.message || 'Failed to clear memory' }, { status: 500 })
  }
}
