import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin, isSupabaseEnabled } from '@/lib/supabase'

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
    // Delete message logs for this user
    const { error: logError } = await supabaseAdmin
      .from('message_logs')
      .delete()
      .eq('auth_user_id', user.id)

    if (logError) throw logError

    return NextResponse.json({ success: true, message: 'Conversation memory cleared' })
  } catch (error: any) {
    console.error('[AI Memory Clear Error]', error);
    return NextResponse.json({ error: error.message || 'Failed to clear memory' }, { status: 500 })
  }
}
