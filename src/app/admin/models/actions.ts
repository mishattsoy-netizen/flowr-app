'use server'

import { supabaseAdmin } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

export async function getModels() {
  const { data, error } = await supabaseAdmin
    .from('models')
    .select('*')
    .order('is_favorite', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true })

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function updateModel(id: string, updates: {
  input_modalities?: string[]
  output_modalities?: string[]
  max_rpd?: number | null
  is_favorite?: boolean
  sort_order?: number
  provider?: string
}) {
  const { error } = await supabaseAdmin
    .from('models')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/admin/models')
}

export async function deleteModel(id: string) {
  const { error } = await supabaseAdmin
    .from('models')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/admin/models')
}

export async function addModel(model: {
  id: string
  provider: string
  input_modalities: string[]
  output_modalities: string[]
  max_rpd?: number | null
}) {
  const { error } = await supabaseAdmin
    .from('models')
    .insert({ ...model, usage_today: 0, last_reset_date: new Date().toISOString().split('T')[0] })

  if (error) throw new Error(error.message)
  revalidatePath('/admin/models')
}
