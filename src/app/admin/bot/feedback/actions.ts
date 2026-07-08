'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin as supabase } from '@/lib/supabase'

export interface FeedbackLog {
  id: string
  message_log_id: number
  auth_user_id: string | null
  feedback: 'like' | 'dislike'
  created_at: string
  message_content: string | null
  user_prompt: string | null
  model_response: string | null
  model_chain: string | null
  usage_type: string | null
  status: string | null
  telegram_id: number | null
  user_email: string | null
  is_locked?: boolean
  context_messages: {
    classify?: { key: string; success: boolean }[]
    routing?: { key: string; success: boolean }[]
    history?: { role: string; content: string }[]
    is_locked?: boolean
  } | null
}

export async function getFeedbackLogs(filter: 'all' | 'like' | 'dislike' = 'all'): Promise<FeedbackLog[]> {
  let query = supabase
    .from('message_feedback')
    .select('id, message_log_id, auth_user_id, feedback, created_at, context_messages')
    .order('created_at', { ascending: false })
    .limit(200)

  if (filter !== 'all') query = query.eq('feedback', filter)
  const { data: feedback, error } = await query
  console.log('[getFeedbackLogs] raw feedback records from DB:', feedback?.length, error)
  if (error) throw error

  const ids = (feedback ?? []).map((f: any) => f.message_log_id)
  if (ids.length === 0) return []

  // Fetch log row details, request_id, content
  const { data: logs } = await supabase
    .from('message_logs')
    .select('id, content, request_id, model_chain, role, created_at, usage_type, status, telegram_id, auth_user_id')
    .in('id', ids)
  console.log('[getFeedbackLogs] details from message_logs table:', logs?.length)

  // Map log_id -> log row details
  const logMap = Object.fromEntries(
    (logs ?? []).map((l: any) => [l.id, l])
  )

  // Collect all request_ids for user prompts
  const requestIds = (logs ?? []).map((l: any) => l.request_id).filter(Boolean)
  let userPromptsMap: Record<string, string> = {}

  if (requestIds.length > 0) {
    const { data: userLogs } = await supabase
      .from('message_logs')
      .select('request_id, content')
      .eq('role', 'user')
      .in('request_id', requestIds)

    userPromptsMap = Object.fromEntries(
      (userLogs ?? []).map((ul: any) => [ul.request_id, ul.content])
    )
  }

  const results: FeedbackLog[] = []

  for (const f of (feedback ?? [])) {
    const l = logMap[f.message_log_id]
    
    // Fallback: If no direct request_id match, we try to fetch the closest user message before this model message from same user
    let userPrompt = l?.request_id ? (userPromptsMap[l.request_id] ?? null) : null
    
    if (!userPrompt && l && l.created_at) {
      let q = supabase
        .from('message_logs')
        .select('content')
        .eq('role', 'user')
        .lt('created_at', l.created_at)
        .order('created_at', { ascending: false })
        .limit(1)

      if (f.auth_user_id) {
        q = q.eq('auth_user_id', f.auth_user_id)
      } else if (l.telegram_id) {
        q = q.eq('telegram_id', l.telegram_id)
      }

      const { data: nearestUserMsg } = await q

      if (nearestUserMsg && nearestUserMsg.length > 0) {
        userPrompt = nearestUserMsg[0].content
      }
    }

    if (!userPrompt && f.context_messages?.history) {
      const historyUserMsgs = f.context_messages.history.filter((h: any) => h.role === 'user' || h.role === 'U')
      if (historyUserMsgs.length > 0) {
        userPrompt = historyUserMsgs[historyUserMsgs.length - 1].content
      }
    }

    // Now, let's fetch prior context messages (max 10) before this liked/disliked model message
    let priorContext: { role: string; content: string }[] = f.context_messages?.history ?? []

    if (priorContext.length === 0 && f.auth_user_id && f.created_at) {
      // Fetch memory_cleared_at for this user
      const { data: userQuota } = await supabase
        .from('user_quotas')
        .select('memory_cleared_at')
        .eq('auth_user_id', f.auth_user_id)
        .maybeSingle()

      const clearedAt = userQuota?.memory_cleared_at

      let logQuery = supabase
        .from('message_logs')
        .select('role, content')
        .eq('auth_user_id', f.auth_user_id)
        .lt('created_at', f.created_at)
        .order('created_at', { ascending: false })
        .limit(10)

      if (clearedAt) {
        logQuery = logQuery.gt('created_at', clearedAt)
      }

      const { data: historyLogs } = await logQuery

      if (historyLogs && historyLogs.length > 0) {
        // reverse to maintain proper chronological turn order
        priorContext = historyLogs.reverse().map((h: any) => ({
          role: h.role === 'model' ? 'assistant' : 'user',
          content: h.content ?? ''
        }))
      }
    }

    function getProviderFromModelId(modelId: string): string {
      const m = modelId.toLowerCase()
      if (m.includes('gemini') || m.includes('gemma')) return 'GEMINI'
      if (m.includes('llama') || m.includes('mixtral') || m.includes('gemma-2-9b') || m.includes('deepseek')) return 'GROQ'
      if (m.includes('flux') || m.includes('sd-') || m.includes('stable-diffusion') || m.includes('pollinations')) return 'POLLINATIONS'
      if (m.includes('huggingface') || m.includes('hf')) return 'HUGGINGFACE'
      if (m.includes('cf') || m.includes('cloudflare')) return 'CLOUDFLARE'
      if (m.includes('tavily')) return 'TAVILY'
      if (m.includes('exa')) return 'EXA'
      return 'GEMINI'
    }

    let classifyTrace = f.context_messages?.classify || []
    let routingTrace = f.context_messages?.routing || []

    if ((classifyTrace.length === 0 || routingTrace.length === 0) && l?.model_chain) {
      const parts = l.model_chain.split(' → ')
      if (parts.length >= 2) {
        const classifier = parts[0]
        const category = parts[1]
        classifyTrace = [{ model: classifier, key: getProviderFromModelId(classifier), success: true }]
        routingTrace = parts.slice(2).map((m: string, i: number, arr: string[]) => ({
          model: m,
          category,
          key: getProviderFromModelId(m),
          success: i === arr.length - 1
        }))
      }
    }

    results.push({
      ...f,
      auth_user_id: l?.auth_user_id ?? f.auth_user_id ?? null,
      message_content: l?.content ?? null,
      user_prompt: userPrompt || "(No prompt found)",
      model_response: l?.content ?? null,
      model_chain: l?.model_chain ?? null,
      usage_type: l?.usage_type ?? null,
      status: l?.status ?? null,
      telegram_id: l?.telegram_id ?? null,
      user_email: null,
      is_locked: !!f.context_messages?.is_locked,
      context_messages: {
        ...(f.context_messages ?? {}),
        classify: classifyTrace,
        routing: routingTrace,
        history: priorContext
      }
    })
  }

  // Batch resolve user emails exactly like LogsTable.tsx
  const appUserIds = [...new Set(results.filter(e => e.auth_user_id).map(e => e.auth_user_id!))]
  if (appUserIds.length > 0) {
    try {
      const emailMap: Record<string, string> = {}
      await Promise.all(appUserIds.map(async (uid) => {
        const { data } = await supabase.auth.admin.getUserById(uid)
        if (data?.user?.email) emailMap[uid] = data.user.email
      }))
      for (const ex of results) {
        if (ex.auth_user_id && emailMap[ex.auth_user_id]) {
          ex.user_email = emailMap[ex.auth_user_id]
        }
      }
    } catch (e) {
      console.error('[getFeedbackLogs] error batch fetching emails:', e)
    }
  }

  return results
}

export async function deleteSelectedFeedback(ids: string[]): Promise<void> {
  const { error } = await supabase.from('message_feedback').delete().in('id', ids)
  if (error) throw error
  revalidatePath('/admin/bot/feedback')
}

export async function toggleFeedbackLock(id: string, isLocked: boolean): Promise<void> {
  const { data } = await supabase
    .from('message_feedback')
    .select('context_messages')
    .eq('id', id)
    .single()

  const currentContext = data?.context_messages || {}

  const { error } = await supabase
    .from('message_feedback')
    .update({ context_messages: { ...currentContext, is_locked: isLocked } })
    .eq('id', id)

  if (error) throw error
  revalidatePath('/admin/bot/feedback')
}

