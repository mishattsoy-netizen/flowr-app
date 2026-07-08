'use server'

import { supabaseAdmin } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'
import { logAdminAction } from '@/lib/admin/logAction'

export async function getModels() {
  const { data, error } = await supabaseAdmin
    .from('models')
    .select('*')
    .order('is_favorite', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true })

  if (error) throw new Error(error.message)
  
  // Deduplicate by ID just in case of DB anomalies or trailing spaces
  const unique = new Map<string, any>()
  for (const m of (data ?? [])) {
    const cleanId = m.id.trim()
    if (!unique.has(cleanId)) {
      unique.set(cleanId, { ...m, id: cleanId })
    }
  }
  
  return Array.from(unique.values())
}

export async function updateModel(id: string, updates: {
  id?: string
  input_modalities?: string[]
  output_modalities?: string[]
  max_rpd?: number | null
  is_favorite?: boolean
  sort_order?: number
  provider?: string
  is_paid?: boolean
  prompt_cost?: number | null
  completion_cost?: number | null
  cache_read_cost?: number | null
  cache_write_cost?: number | null
  context_window?: number | null
  max_output_tokens?: number | null
}) {
  const { error } = await supabaseAdmin
    .from('models')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(error.message)

  if (updates.id && updates.id !== id) {
    // Cascade to router_chains
    const { data: chains, error: chainsError } = await supabaseAdmin
      .from('router_chains')
      .select('id, model_list')

    if (!chainsError && chains) {
      for (const chain of chains) {
        if (Array.isArray(chain.model_list)) {
          let hasChange = false
          const newModelList = chain.model_list.map((m: any) => {
            if (m && m.id === id) {
              hasChange = true
              return { ...m, id: updates.id }
            }
            return m
          })
          if (hasChange) {
            await supabaseAdmin
              .from('router_chains')
              .update({ model_list: newModelList })
              .eq('id', chain.id)
          }
        }
      }
    }

    // Cascade to backend model in settings
    const { data: modelSetting } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('key', 'backend_model')
      .limit(1)
      .maybeSingle()

    if (modelSetting?.value === id) {
      await supabaseAdmin
        .from('settings')
        .upsert({ key: 'backend_model', value: updates.id, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    }
  }

  logAdminAction('router_changed', `Updated model ${id}`, { id, updates })
  revalidatePath('/admin/models')
  revalidatePath('/admin/router')
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
  is_paid?: boolean
  prompt_cost?: number | null
  completion_cost?: number | null
  cache_read_cost?: number | null
  cache_write_cost?: number | null
  context_window?: number | null
  max_output_tokens?: number | null
}) {
  const { error } = await supabaseAdmin
    .from('models')
    .insert({
      ...model,
      id: model.id.trim(),
      is_paid: model.is_paid ?? false,
      prompt_cost: model.prompt_cost ?? null,
      completion_cost: model.completion_cost ?? null,
      cache_read_cost: model.cache_read_cost ?? null,
      cache_write_cost: model.cache_write_cost ?? null,
      context_window: model.context_window ?? null,
      max_output_tokens: model.max_output_tokens ?? null,
      usage_today: 0,
      last_reset_date: new Date().toISOString().split('T')[0]
    })

  if (error) throw new Error(error.message)
  revalidatePath('/admin/models')
}

export async function logModelCost(cost: {
  model_id: string
  provider: string
  prompt_cost: number
  completion_cost: number
  total_cost: number
  prompt_tokens: number
  completion_tokens: number
  chain?: string
  subprovider?: string | null
}) {
  const { error } = await supabaseAdmin.from('cost_log').insert(cost)
  if (error) console.error('[CostLog] Failed to log cost:', error.message)
}
