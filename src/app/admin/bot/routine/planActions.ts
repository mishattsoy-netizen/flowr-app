'use server'

import { supabaseAdmin as supabase } from '@/lib/supabase'
import { addBrainEntry } from '@/app/admin/bot/brain/actions'
import { logAdminAction } from '@/lib/admin/logAction'
import { revalidatePath } from 'next/cache'
import type { BrainCategory } from '@/app/admin/bot/brain/actions'

export interface ImprovementPlan {
  id: string
  session_id: string
  topic: string
  title: string
  reasoning: string
  plan: string
  status: 'pending' | 'accepted' | 'rejected' | 'edited'
  edit_notes: string | null
  created_at: string
  source?: 'feedback analysis' | 'routine run'
  trigger?: 'manual' | 'auto'
}

export async function getLatestPlans(): Promise<ImprovementPlan[]> {
  try {
    const { data, error } = await supabase
      .from('bot_improvement_plans')
      .select(`
        id, session_id, topic, title, reasoning, plan, status, edit_notes, created_at,
        session:bot_analysis_sessions(triggered_by)
      `)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error || !data) return []

    return data.map((p: any) => {
      const session = p.session
      const source: 'feedback analysis' | 'routine run' =
        session?.triggered_by === 'feedback_selection' ? 'feedback analysis' : 'routine run'
      const trigger: 'manual' | 'auto' =
        session?.triggered_by === 'schedule' ? 'auto' : 'manual'

      return {
        id: p.id,
        session_id: p.session_id,
        topic: p.topic,
        title: p.title,
        reasoning: p.reasoning,
        plan: p.plan,
        status: p.status,
        edit_notes: p.edit_notes,
        created_at: p.created_at,
        source,
        trigger,
      } as ImprovementPlan
    })
  } catch (err) {
    console.error('[getLatestPlans] error:', err)
    return []
  }
}


const TOPIC_TO_BRAIN_CATEGORY: Record<string, BrainCategory> = {
  'Answer Style':        'tone',
  'Writing Style':       'rules',
  'Tone':                'tone',
  'Format':              'tone',
  'Accuracy':            'rules',
  'Mistakes':            'red_flags',
  'Personality':         'personality',
  'Rules':               'rules',
  'Patterns':            'tone',
  'Facts':               'facts',
  'Knowledge':           'facts',
  'Guardrails':          'red_flags',
  'Response Structure':  'tone',
  'User Experience':     'tone',
  'Brand Identity':      'personality',
  'Interaction Quality': 'tone',
  'Response Architecture': 'tone',
}

function topicToCategory(topic: string): BrainCategory {
  return TOPIC_TO_BRAIN_CATEGORY[topic] ?? 'rules'
}

export async function acceptPlan(plan: ImprovementPlan, overrideCategory?: string): Promise<void> {
  const category = (overrideCategory || topicToCategory(plan.topic)) as BrainCategory
  let finalPrompt = plan.plan
  let mode = 'new'
  let entryIdToUpdate: string | undefined

  try {
    const parsed = JSON.parse(plan.plan)
    if (parsed && typeof parsed === 'object' && 'final_prompt' in parsed) {
      finalPrompt = parsed.final_prompt
      mode = parsed.mode || 'new'
      entryIdToUpdate = parsed.entry_id
    }
  } catch (err) {
    // raw plan string fallback
  }

  if (mode === 'update' && entryIdToUpdate) {
    const { error: updateEntryErr } = await supabase
      .from('bot_brain_entries')
      .update({ content: finalPrompt, category })
      .eq('id', entryIdToUpdate)
    if (updateEntryErr) throw updateEntryErr
  } else {
    await addBrainEntry(category, plan.title, finalPrompt)
  }

  const { error } = await supabase
    .from('bot_improvement_plans')
    .update({ status: 'accepted' })
    .eq('id', plan.id)
  if (error) throw error
  await logAdminAction('plan_accepted', `Accepted plan: ${plan.title}`, { planId: plan.id, topic: plan.topic })
  revalidatePath('/admin/bot/routine')
}

export async function rejectPlan(planId: string, title: string): Promise<void> {
  const { error } = await supabase
    .from('bot_improvement_plans')
    .update({ status: 'rejected' })
    .eq('id', planId)
  if (error) throw error
  await logAdminAction('plan_rejected', `Rejected plan: ${title}`, { planId })
  revalidatePath('/admin/bot/routine')
}

export async function deletePlan(planId: string, title: string): Promise<void> {
  const { error } = await supabase
    .from('bot_improvement_plans')
    .delete()
    .eq('id', planId)
  if (error) throw error
  await logAdminAction('plan_deleted', `Deleted plan completely: ${title}`, { planId })
  revalidatePath('/admin/bot/routine')
}

export async function deletePlans(ids: string[]): Promise<void> {
  if (!ids.length) return
  const { error } = await supabase
    .from('bot_improvement_plans')
    .delete()
    .in('id', ids)
  if (error) throw error
  await logAdminAction('bulk_plans_deleted', `Deleted ${ids.length} plans permanently`, { count: ids.length })
  revalidatePath('/admin/bot/routine')
}

export async function submitPlanEdit(planId: string, editNotes: string): Promise<ImprovementPlan> {
  const { data: plan, error: fetchErr } = await supabase
    .from('bot_improvement_plans')
    .select('topic, title, reasoning, plan')
    .eq('id', planId)
    .single()
  if (fetchErr || !plan) throw fetchErr ?? new Error('Plan not found')

  const { runGoogle } = await import('@/lib/bot/providers/google')

  const rewritePrompt = `Rewrite this improvement plan incorporating the user's feedback.

Original plan:
Topic: ${plan.topic}
Title: ${plan.title}
Reasoning: ${plan.reasoning}
Plan: ${plan.plan}

User's feedback/change request: ${editNotes}

Return ONLY a valid JSON object with exactly these fields: topic, title, reasoning, plan.
Example: {"topic":"Answer Style","title":"Context-aware response length","reasoning":"...","plan":"..."}`

  const response = await runGoogle('gemini-1.5-flash', rewritePrompt)
  if (!response) throw new Error('No Gemini API key available — add one via Secure Vault')
  const raw = (typeof response === 'string' ? response : response.content).trim()
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('AI returned invalid JSON')
  const revised: { topic: string; title: string; reasoning: string; plan: string } =
    JSON.parse(jsonMatch[0])

  const { data: updated, error: updateErr } = await supabase
    .from('bot_improvement_plans')
    .update({
      topic: revised.topic,
      title: revised.title,
      reasoning: revised.reasoning,
      plan: revised.plan,
      status: 'edited',
      edit_notes: editNotes,
    })
    .eq('id', planId)
    .select('id, session_id, topic, title, reasoning, plan, status, edit_notes, created_at')
    .single()

  if (updateErr || !updated) throw updateErr ?? new Error('Update failed')
  await logAdminAction('plan_edited', `Edited plan: ${revised.title}`, { planId })
  return updated as ImprovementPlan
}
