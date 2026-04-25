import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runChain } from '@/lib/bot/chainRouter'
import { supabaseAdmin, isSupabaseEnabled } from '@/lib/supabase'
import { logWebInteraction } from '@/lib/bot/analytics'

const DEFAULT_DAILY_LIMIT = 50

async function checkAndIncrementQuota(authUserId: string): Promise<{ allowed: boolean }> {
  if (!supabaseAdmin) return { allowed: true } // Skip quota if admin is not configured
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

  const { prompt, buffer, aiApiKey, activeEntityId, activeWorkspaceId, classificationModelId, agentEnabled } = await req.json()

  if (!prompt || typeof prompt !== 'string') {
    return NextResponse.json({ error: 'prompt is required', model: 'system' }, { status: 400 })
  }

  const userId = user?.id || 'anonymous'
  
  if (user) {
    const { allowed } = await checkAndIncrementQuota(user.id)
    if (!allowed) {
      return NextResponse.json(
        { error: 'Daily message limit reached. Try again tomorrow.', model: 'system' },
        { status: 429 }
      )
    }
  }

  try {
    const result = await runChain(
      prompt,
      buffer ? Buffer.from(buffer, 'base64') : undefined,
      { userId, platform: 'app', aiApiKey, activeEntityId, activeWorkspaceId, classificationModelId, agentEnabled: agentEnabled === true }
    )

    let content = result.content
    if (Buffer.isBuffer(content)) {
      const b64 = content.toString('base64')
      content = `![Generated Image](data:image/png;base64,${b64})`
    } else if (result.type === 'photo' && typeof content === 'string' && content.startsWith('data:')) {
      content = `![Generated Image](${content})`
    }

    // Log to message_logs — never store raw base64 image data
    const logId = user?.id || 'anonymous'
    const requestId = crypto.randomUUID()
    const loggedContent = (result.type === 'photo' || (typeof content === 'string' && content.startsWith('![')))
      ? '[image]'
      : (typeof content === 'string' ? content : '[image]')
    const modelChain = result.model_chain
    const usageType = result.usage_type || 'chat'
    logWebInteraction(logId, prompt, 'user', usageType as any, 'success', modelChain, requestId).catch(() => {})
    logWebInteraction(logId, loggedContent, 'model', usageType as any, result.status || 'success', modelChain, requestId).catch(() => {})

    return NextResponse.json({
      content,
      type: result.type,
      usage_type: result.usage_type,
      model: result.model
    })
  } catch (error: any) {
    console.error('[AI API Error]', error);
    const logId = user?.id || 'anonymous'
    logWebInteraction(logId, error.message || 'AI request failed.', 'model', 'chat', 'error').catch(() => {})
    return NextResponse.json({
      error: error.message || 'AI request failed.',
      model: 'system'
    }, { status: 500 })
  }
}
