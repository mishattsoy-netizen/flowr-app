import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('roadmap_router_chains')
    .select('*')
    .order('category')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { category, model_list, system_prompt, temperature } = body

  const updatePayload: any = {}
  if (model_list !== undefined) {
    if (Array.isArray(model_list) && model_list.length > 10) {
      return NextResponse.json({ error: 'Maximum of 10 models allowed per chain' }, { status: 400 })
    }
    updatePayload.model_list = model_list
  }
  if (system_prompt !== undefined) updatePayload.system_prompt = system_prompt
  if (temperature !== undefined) updatePayload.temperature = temperature

  const { data, error } = await supabaseAdmin
    .from('roadmap_router_chains')
    .update(updatePayload)
    .eq('category', category)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
