'use server'

import { supabaseAdmin as supabase } from '@/lib/supabase'

export interface DashboardStats {
  totalBrainEntries: number
  entriesByCategory: Record<string, number>
  likedCount: number
  dislikedCount: number
  lastSessionDate: string | null
  lastSessionPlans: number
  lastSessionAccepted: number
  lastSessionRejected: number
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [brainRes, feedbackRes, sessionRes] = await Promise.all([
    supabase.from('bot_brain_entries').select('category'),
    supabase.from('message_feedback').select('feedback'),
    supabase
      .from('bot_analysis_sessions')
      .select('id, started_at, status')
      .eq('status', 'complete')
      .order('started_at', { ascending: false })
      .limit(1),
  ])

  const brainEntries = brainRes.data ?? []
  const feedback = feedbackRes.data ?? []

  const entriesByCategory: Record<string, number> = {}
  for (const e of brainEntries) {
    entriesByCategory[e.category] = (entriesByCategory[e.category] ?? 0) + 1
  }

  const lastSession = sessionRes.data?.[0] ?? null
  let lastSessionPlans = 0, lastSessionAccepted = 0, lastSessionRejected = 0
  if (lastSession) {
    const plansRes = await supabase
      .from('bot_improvement_plans')
      .select('status')
      .eq('session_id', lastSession.id)
    const plans = plansRes.data ?? []
    lastSessionPlans = plans.length
    lastSessionAccepted = plans.filter(p => p.status === 'accepted').length
    lastSessionRejected = plans.filter(p => p.status === 'rejected').length
  }

  return {
    totalBrainEntries: brainEntries.length,
    entriesByCategory,
    likedCount: feedback.filter(f => f.feedback === 'like').length,
    dislikedCount: feedback.filter(f => f.feedback === 'dislike').length,
    lastSessionDate: lastSession?.started_at ?? null,
    lastSessionPlans,
    lastSessionAccepted,
    lastSessionRejected,
  }
}
