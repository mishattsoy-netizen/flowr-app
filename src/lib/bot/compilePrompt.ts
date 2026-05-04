import { supabaseAdmin as supabase } from '@/lib/supabase'
import type { BotMode } from '@/data/store.types'

const CATEGORY_LABELS: Record<string, string> = {
  core_rules:       'CORE RULES',
  personality:      'PERSONALITY',
  answer_style:     'ANSWER STYLE',
  thinking_pattern: 'THINKING PATTERN',
  restrictions:     'RESTRICTIONS',
}

const BRAIN_CATEGORY_LABELS: Record<string, string> = {
  rules:       'BRAIN: RULES',
  red_flags:   'BRAIN: RED FLAGS',
  tone:        'BRAIN: TONE REFINEMENTS',
  personality: 'BRAIN: PERSONALITY REFINEMENTS',
  facts:       'BRAIN: FACTS & KNOWLEDGE',
}

export async function recompilePrompt(mode: BotMode = 'default'): Promise<void> {
  const [settingsResult, brainResult] = await Promise.all([
    supabase
      .from('bot_settings')
      .select('category, content')
      .eq('is_active', true)
      .eq('mode', mode),
    supabase
      .from('bot_brain_entries')
      .select('category, title, content')
      .eq('is_active', true)
      .order('created_at', { ascending: true }),
  ])

  if (settingsResult.error) throw settingsResult.error
  if (brainResult.error) throw brainResult.error

  const settings: { category: string; content: string }[] = settingsResult.data ?? []
  const brainEntries: { category: string; title: string; content: string }[] = brainResult.data ?? []

  const parts: string[] = []

  const settingsOrder = ['core_rules', 'personality', 'answer_style', 'thinking_pattern', 'restrictions']
  for (const cat of settingsOrder) {
    const block = settings.find(s => s.category === cat)
    if (block?.content?.trim()) {
      parts.push(`[${CATEGORY_LABELS[cat] ?? cat.toUpperCase()}]\n${block.content.trim()}`)
    }
  }

  const brainOrder = ['rules', 'red_flags', 'tone', 'personality', 'facts']
  for (const cat of brainOrder) {
    const entries = brainEntries.filter(e => e.category === cat)
    if (entries.length === 0) continue
    const lines = entries.map(e => `- ${e.title}: ${e.content}`).join('\n')
    parts.push(`[${BRAIN_CATEGORY_LABELS[cat] ?? cat.toUpperCase()}]\n${lines}`)
  }

  const compiled = parts.join('\n\n')

  const { error } = await supabase
    .from('bot_compiled_prompt')
    .update({ content: compiled, compiled_at: new Date().toISOString(), entry_count: brainEntries.length })
    .eq('mode', mode)

  if (error) throw error
}

export async function recompileAllModes(): Promise<void> {
  await Promise.all([
    recompilePrompt('default'),
    recompilePrompt('think'),
    recompilePrompt('pro'),
  ])
}

export async function getCompiledPrompt(mode: BotMode = 'default'): Promise<string> {
  const { data, error } = await supabase
    .from('bot_compiled_prompt')
    .select('content, global_enabled')
    .eq('mode', mode)
    .single()

  if (error || !data) return ''
  if (!data.global_enabled) return ''
  return data.content ?? ''
}
