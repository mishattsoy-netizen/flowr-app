'use server'

import { supabaseAdmin } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

export async function getPresets() {
  const { data, error } = await supabaseAdmin
    .from('limit_presets')
    .select('*')
    .order('daily_msg_limit', { ascending: true })

  if (error) throw error
  return data
}

export async function savePreset(formData: any) {
  const isUpdate = !!formData.id
  
  const payload = {
    name: formData.name,
    daily_msg_limit: parseInt(formData.msg_limit),
    daily_image_limit: parseInt(formData.image_limit || 0),
    has_vision: !!formData.has_vision,
    has_web_search: !!formData.has_web_search,
    has_image_gen: !!formData.has_image_gen
  }

  if (isUpdate) {
    const { error } = await supabaseAdmin
      .from('limit_presets')
      .update(payload)
      .eq('id', formData.id)
    if (error) throw error
  } else {
    const { error } = await supabaseAdmin
      .from('limit_presets')
      .insert(payload)
    if (error) throw error
  }

  revalidatePath('/admin/presets')
  revalidatePath('/admin/users')
}

export async function deletePreset(id: string) {
  const { error } = await supabaseAdmin
    .from('limit_presets')
    .delete()
    .eq('id', id)

  if (error) throw error
  revalidatePath('/admin/presets')
}
