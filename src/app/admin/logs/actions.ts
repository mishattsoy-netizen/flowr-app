'use server'

import { supabaseAdmin } from '@/lib/supabase'
import type { StepTrace } from '@/lib/bot/tracing'

export interface LogEntry {
  id: number
  telegram_id: number | null
  auth_user_id: string | null
  content: string | null
  role: string | null
  type: string | null
  usage_type: string | null
  topic_tag: string | null
  status: string | null
  model_chain: string | null
  created_at: string
  context_messages: any
}

export interface Exchange {
  id: number
  created_at: string
  platform: 'app' | 'telegram'
  user_prompt: string | null
  model_response: string | null
  model_chain: string | null
  usage_type: string | null
  status: string | null
  telegram_id: number | null
  auth_user_id: string | null
  user_email: string | null
  topic_tag: string | null
  request_id: string | null
  feedback: 'like' | 'dislike' | null
  duration_ms: number | null
  image_description?: string | null
  step_traces: StepTrace[] | null
}

// Detect whether auth_user_id column exists (migration may not have run yet)
let hasAuthUserIdColumn: boolean | null = null
async function checkAuthUserIdColumn(): Promise<boolean> {
  if (hasAuthUserIdColumn !== null) return hasAuthUserIdColumn
  if (!supabaseAdmin) { hasAuthUserIdColumn = false; return false }
  const { error } = await supabaseAdmin
    .from('message_logs')
    .select('auth_user_id')
    .limit(1)
  hasAuthUserIdColumn = !error
  return hasAuthUserIdColumn
}

function userKey(row: any): string {
  if (row.auth_user_id) return `app:${row.auth_user_id}`
  if (row.telegram_id) return `tg:${row.telegram_id}`
  if (row.topic_tag) return `tag:${row.topic_tag}`
  return 'anon'
}

export async function getMessageExchanges(options: {
  platform?: 'all' | 'app' | 'telegram'
  usage_type?: string
  limit?: number
  offset?: number
} = {}): Promise<{ exchanges: Exchange[]; total: number }> {
  const { platform = 'all', usage_type, limit = 50, offset = 0 } = options

  if (!supabaseAdmin) return { exchanges: [], total: 0 }

  const authColExists = await checkAuthUserIdColumn()

  // Fetch model rows (these carry model_chain, status, usage_type)
  let modelQ = supabaseAdmin
    .from('message_logs')
    .select('*', { count: 'planned' })
    .eq('role', 'model')
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1)

  if (authColExists) {
    if (platform === 'app') modelQ = modelQ.is('telegram_id', null)
    if (platform === 'telegram') modelQ = modelQ.not('telegram_id', 'is', null)
  } else if (platform === 'telegram') {
    modelQ = modelQ.not('telegram_id', 'is', null)
  }
  if (usage_type && usage_type !== 'all') modelQ = modelQ.eq('usage_type', usage_type)

  const { data: modelRows, error: modelErr, count } = await modelQ
  console.log('[getMessageExchanges] fetched modelRows:', modelRows?.length, modelErr)
  if (modelErr) {
    console.error('[Logs] Model query failed:', modelErr.message)
    return { exchanges: [], total: 0 }
  }
  if (!modelRows || modelRows.length === 0) return { exchanges: [], total: 0 }

  // Collect request_ids and time window to find paired user rows
  const requestIds = modelRows.map((m: any) => m.request_id).filter(Boolean)
  const oldest = modelRows[modelRows.length - 1].created_at
  const newest = modelRows[0].created_at

  // Fetch user rows: primarily by request_id
  let userQ = supabaseAdmin
    .from('message_logs')
    .select('*')
    .eq('role', 'user')
    .order('id', { ascending: false })

  if (requestIds.length > 0) {
    // Only fetch by request_id. Time-window fallback is removed as it's too expensive on large tables.
    userQ = userQ.in('request_id', requestIds)
  } else {
    // Fallback for very old rows: only fetch within a tight 10-minute window of the oldest model row
    const fallbackStart = new Date(new Date(oldest).getTime() - 600000).toISOString()
    userQ = userQ.gte('created_at', fallbackStart).lte('created_at', newest)
  }

  const { data: userRows } = await userQ
  
  // Fetch feedback for these model logs
  const modelIds = modelRows.map((m: any) => m.id)
  const { data: feedbackRows } = await supabaseAdmin
    .from('message_feedback')
    .select('message_log_id, feedback')
    .in('message_log_id', modelIds)

  const feedbackMap = Object.fromEntries(
    (feedbackRows || []).map((f: any) => [f.message_log_id, f.feedback])
  )

  // Pair: prefer request_id match; fall back to closest preceding user row from same identity
  const exchanges: Exchange[] = modelRows.map((m: any) => {
    let matched: any = null

    if (m.request_id) {
      matched = (userRows || []).find((u: any) => u.request_id === m.request_id)
    }

    if (!matched) {
      const mKey = userKey(m)
      const mTime = new Date(m.created_at).getTime()
      matched = (userRows || [])
        .filter((u: any) => userKey(u) === mKey && new Date(u.created_at).getTime() <= mTime)
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
    }

    const platform: 'app' | 'telegram' = (m.auth_user_id || m.topic_tag?.startsWith('app:')) ? 'app' : (m.telegram_id ? 'telegram' : 'app')

    return {
      id: m.id,
      created_at: m.created_at,
      platform,
      user_prompt: matched?.content ?? null,
      model_response: m.content,
      model_chain: m.model_chain ?? null,
      usage_type: m.usage_type ?? null,
      status: m.status ?? null,
      telegram_id: m.telegram_id ?? null,
      auth_user_id: authColExists ? (m.auth_user_id ?? null) : null,
      user_email: null,
      topic_tag: m.topic_tag?.startsWith('app:') ? null : (m.topic_tag ?? null),
      request_id: m.request_id ?? null,
      feedback: feedbackMap[m.id] ?? null,
      duration_ms: matched ? (new Date(m.created_at).getTime() - new Date(matched.created_at).getTime()) : null,
      image_description: m.context_messages?.image_description ?? null,
      step_traces: m.context_messages?.step_traces ?? null,
    }
  })

  // Email resolution is disabled in the main fetch to prevent blocking latency.
  // Emails can be fetched on-demand or via a more efficient batch process in the future.
  for (const ex of exchanges) {
    ex.user_email = null
  }

  return { exchanges, total: count || 0 }
}

export async function deleteLogs(mode: 'all' | '1day' | '1week' | 'ids', ids?: number[]): Promise<{ deleted: number }> {
  if (!supabaseAdmin) return { deleted: 0 }

  let query = supabaseAdmin.from('message_logs').delete({ count: 'exact' })

  if (mode === 'all') {
    query = query.neq('id', 0)
  } else if (mode === '1day') {
    const cutoff = new Date(Date.now() - 86400_000).toISOString()
    query = query.gte('created_at', cutoff)
  } else if (mode === '1week') {
    const cutoff = new Date(Date.now() - 7 * 86400_000).toISOString()
    query = query.gte('created_at', cutoff)
  } else if (mode === 'ids' && ids && ids.length > 0) {
    query = query.in('id', ids)
  } else {
    return { deleted: 0 }
  }

  const { count, error } = await query
  if (error) throw new Error(error.message)
  return { deleted: count ?? 0 }
}

// Keep for backwards compat (used by existing page.tsx initial load)
export async function getMessageLogs(options: {
  platform?: 'all' | 'app' | 'telegram'
  role?: 'all' | 'user' | 'model'
  usage_type?: string
  limit?: number
  offset?: number
} = {}): Promise<{ logs: LogEntry[]; total: number }> {
  const { platform = 'all', role = 'all', usage_type, limit = 50, offset = 0 } = options

  if (!supabaseAdmin) return { logs: [], total: 0 }

  const authColExists = await checkAuthUserIdColumn()

  let query = supabaseAdmin
    .from('message_logs')
    .select('*', { count: 'planned' })
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1)

  if (authColExists) {
    if (platform === 'app') query = query.is('telegram_id', null)
    if (platform === 'telegram') query = query.not('telegram_id', 'is', null)
  } else if (platform === 'telegram') {
    query = query.not('telegram_id', 'is', null)
  }

  if (role !== 'all') query = query.eq('role', role)
  if (usage_type && usage_type !== 'all') query = query.eq('usage_type', usage_type)

  const { data, error, count } = await query
  if (error) {
    console.error('[Logs] Query failed:', error.message)
    return { logs: [], total: 0 }
  }

  const logs = (data || []).map((row: any) => ({
    ...row,
    auth_user_id: authColExists ? (row.auth_user_id ?? null) : null,
    status: row.status ?? null,
    model_chain: row.model_chain ?? null,
  })) as LogEntry[]

  return { logs, total: count || 0 }
}
