import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const phaseId = req.nextUrl.searchParams.get('phase_id')
  let query = supabaseAdmin.from('roadmap_tasks').select('*').order('sort_order')
  if (phaseId) query = query.eq('phase_id', phaseId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { data, error } = await supabaseAdmin
    .from('roadmap_tasks')
    .insert({
      phase_id: body.phase_id,
      title: body.title,
      description: body.description || '',
      priority: body.priority || 'medium',
      sort_order: body.sort_order ?? 0,
      sub_tasks: body.sub_tasks || [],
      tags: body.tags || [],
      agent_prompt: body.agent_prompt || '',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { id, ...updates } = body
  const { data, error } = await supabaseAdmin
    .from('roadmap_tasks')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  const { error } = await supabaseAdmin
    .from('roadmap_tasks')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
