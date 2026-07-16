"use server"

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export interface BotMemory {
  id: string
  title: string
  content: string
  created_at: string
}

// Memories now live as memory-type brain nodes (spec 2026-07-14-brain-design.md §7
// — one memory system, not two). Reads/writes go through RLS (auth.uid() policies
// on brain_nodes), same trust model as the old bot_memories policies.
export async function getBotMemories(): Promise<BotMemory[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('brain_nodes')
    .select('id, label, content, created_at')
    .eq('user_id', user.id)
    .eq('type', 'memory')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to get brain memories', error)
    return []
  }
  return (data || []).map(n => ({ id: n.id, title: n.label ?? '', content: n.content ?? '', created_at: n.created_at }))
}

export async function addBotMemory(title: string, content: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { error } = await supabase
    .from('brain_nodes')
    .insert({ user_id: user.id, type: 'memory', label: title, content, created_by: 'user' })

  if (error) return { success: false, error: error.message }
  revalidatePath('/settings')
  return { success: true }
}

export async function updateBotMemory(id: string, title: string, content: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { error } = await supabase
    .from('brain_nodes')
    .update({ label: title, content, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('type', 'memory')

  if (error) return { success: false, error: error.message }
  revalidatePath('/settings')
  return { success: true }
}

export async function deleteBotMemory(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { error } = await supabase
    .from('brain_nodes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('type', 'memory')

  if (error) return { success: false, error: error.message }
  revalidatePath('/settings')
  return { success: true }
}
