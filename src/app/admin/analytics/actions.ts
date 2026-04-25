'use server'

import { supabaseAdmin as supabase } from '@/lib/supabase'

/**
 * Fetches topic distribution for pie charts.
 */
export async function getTopicDistribution() {
  const { data, error } = await supabase
    .from('message_logs')
    .select('usage_type')
    .eq('role', 'model')
    .not('usage_type', 'is', null)

  if (error) throw error

  const LABELS: Record<string, string> = {
    chat: 'Chat',
    tool: 'Tool Use',
    search: 'Web Search',
    vision: 'Vision',
    image: 'Image Gen',
  }

  const counts: Record<string, number> = {}
  data.forEach((log: any) => {
    const key = log.usage_type || 'chat'
    const label = LABELS[key] ?? key
    counts[label] = (counts[label] || 0) + 1
  })

  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
}

/**
 * Fetches daily message volume for area charts.
 */
export async function getDailyVolume() {
  const { data, error } = await supabase
    .from('message_logs')
    .select('created_at')
    .order('created_at', { ascending: true })

  if (error) throw error

  const counts: Record<string, number> = {}
  data.forEach((log: any) => {
    const date = new Date(log.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
    counts[date] = (counts[date] || 0) + 1
  })

  return Object.entries(counts).map(([date, count]) => ({ date, count }))
}
export async function getUsageTypeDistribution() {
  const { data, error } = await supabase
    .from('message_logs')
    .select('usage_type')
    .eq('role', 'model')

  if (error) throw error

  const counts: Record<string, number> = {}
  data.forEach((log: any) => {
    const type = log.usage_type || 'chat'
    counts[type] = (counts[type] || 0) + 1
  })

  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
}
