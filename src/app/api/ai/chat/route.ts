import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runChain } from '@/lib/bot/chainRouter'
import { supabaseAdmin } from '@/lib/supabase'

const DEFAULT_DAILY_LIMIT = 50

async function checkAndIncrementQuota(authUserId: string): Promise<{ allowed: boolean }> {
  const today = new Date().toISOString().split('T')[0]

  const { data: existing } = await supabaseAdmin
    .from('user_quotas')
    .select('messages_used_today, last_reset_date')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  const needsReset = !existing || existing.last_reset_date < today
  const currentCount = needsReset ? 0 : existing.messages_used_today

  if (currentCount >= DEFAULT_DAILY_LIMIT) {
    return { allowed: false }
  }

  await supabaseAdmin
    .from('user_quotas')
    .upsert({
      auth_user_id: authUserId,
      messages_used_today: currentCount + 1,
      last_reset_date: today
    })

  return { allowed: true }
}

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { prompt, buffer } = await req.json()

  if (!prompt || typeof prompt !== 'string') {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
  }

  const { allowed } = await checkAndIncrementQuota(user.id)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Daily message limit reached. Try again tomorrow.' },
      { status: 429 }
    )
  }

  const result = await runChain(
    prompt,
    buffer ? Buffer.from(buffer, 'base64') : undefined,
    { userId: user.id, platform: 'app' }
  )

  return NextResponse.json({ content: result.content, type: result.type, usage_type: result.usage_type })
}
