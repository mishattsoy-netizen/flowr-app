'use server'

import { supabaseAdmin as supabase } from '@/lib/supabase'
import { logAdminAction } from '@/lib/admin/logAction'
import { revalidatePath } from 'next/cache'

export type BrainCategory = 'rules' | 'red_flags' | 'tone' | 'personality' | 'facts'

export interface BrainEntry {
  id: string
  category: BrainCategory
  title: string
  content: string
  source: 'user_correction' | 'routine' | 'manual'
  is_active: boolean
  created_at: string
  updated_at?: string
}

export async function getBrainEntries(): Promise<BrainEntry[]> {
  const { data, error } = await supabase
    .from('bot_brain_entries')
    .select('id, category, title, content, source, is_active, created_at, updated_at')
    .order('created_at', { ascending: false })

  if (error && error.message.includes('updated_at')) {
    const { data: retryData, error: retryError } = await supabase
      .from('bot_brain_entries')
      .select('id, category, title, content, source, is_active, created_at')
      .order('created_at', { ascending: false })
    if (retryError) throw retryError
    return (retryData ?? []) as BrainEntry[]
  }

  if (error) throw error
  return (data ?? []) as BrainEntry[]
}

export async function addBrainEntry(
  category: BrainCategory,
  title: string,
  content: string
): Promise<void> {
  const { error } = await supabase
    .from('bot_brain_entries')
    .insert({ category, title, content, source: 'manual', updated_at: new Date().toISOString() })
  if (error) throw error
  await logAdminAction('brain_entry_added', `Added brain entry: ${title}`, { category, title })
  revalidatePath('/admin/bot/brain')
}

export async function deleteBrainEntry(id: string, title: string): Promise<void> {
  const { error } = await supabase
    .from('bot_brain_entries')
    .delete()
    .eq('id', id)
  if (error) throw error
  await logAdminAction('brain_entry_deleted', `Deleted brain entry: ${title}`, { id, title })
  revalidatePath('/admin/bot/brain')
}

export async function toggleBrainEntry(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('bot_brain_entries')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
  revalidatePath('/admin/bot/brain')
}

export async function updateBrainEntry(
  id: string,
  category: BrainCategory,
  title: string,
  content: string
): Promise<void> {
  const { error } = await supabase
    .from('bot_brain_entries')
    .update({ category, title, content, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
  await logAdminAction('brain_entry_updated', `Updated brain entry: ${title}`, { id, category, title })
  revalidatePath('/admin/bot/brain')
}
