import { supabaseAdmin as supabase } from '@/lib/supabase'
import type { BotMode } from '@/data/store.types'
import fs from 'fs'
import path from 'path'
import { logger } from '../logger'
import { getCachedCompiledPrompt, setCachedCompiledPrompt, invalidateCompiledPromptCache, getCachedInternalPrompts, setCachedInternalPrompts } from './promptCache'

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
  if (!supabase) {
    logger.warn('[compilePrompt] Skipping recompilePrompt: Database not available');
    return;
  }
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

  // Invalidate in-memory cache so next request picks up the new prompt
  invalidateCompiledPromptCache(mode)
}

export async function recompileAllModes(): Promise<void> {
  await Promise.all([
    recompilePrompt('default'),
    recompilePrompt('pro'),
  ])
}

export async function getCompiledPrompt(mode: BotMode = 'default'): Promise<string> {
  // 0. In-memory cache — avoids Supabase query on every request
  const cached = getCachedCompiledPrompt(mode)
  if (cached) return cached

  // 1. Supabase primary
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('bot_compiled_prompt')
        .select('content, global_enabled')
        .eq('mode', mode)
        .limit(1)
        .single()

      if (!error && data && data.global_enabled && data.content?.trim()) {
        const content = data.content.trim()
        setCachedCompiledPrompt(mode, content)
        return content
      }
      if (error) logger.warn(`getCompiledPrompt: DB error [${mode}]: ${error.message}`)
    } catch (err) {
      logger.error(`getCompiledPrompt: Exception loading from DB: ${err}`)
    }
  }

  // 2. Local file fallback from 'Final prompts(active)'
  try {
    const parts: string[] = [];
    const settingsOrder = ['core_rules', 'personality', 'answer_style', 'thinking_pattern', 'restrictions'];
    for (const cat of settingsOrder) {
      const filePath = path.join(process.cwd(), 'Final prompts(active)', 'modes', mode, `${cat}.txt`);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        if (content?.trim()) {
          parts.push(`[${CATEGORY_LABELS[cat] ?? cat.toUpperCase()}]\n${content.trim()}`);
        }
      }
    }
    if (parts.length > 0) {
      const compiled = parts.join('\n\n');
      logger.info(`Loaded combined fallback prompt from Final prompts(active)/modes/${mode}`);
      setCachedCompiledPrompt(mode, compiled);
      return compiled;
    }
  } catch (err) {
    logger.warn(`Failed to read fallback mode files: ${err}`)
  }

  return ''
}

export async function getInternalPrompt(chainType: string, mode: BotMode = 'default'): Promise<string> {
  // 0. In-memory cache — avoids Supabase query on every request
  const cached = getCachedInternalPrompts()
  if (cached) return cached[chainType] ?? ''

  // 1. Supabase primary
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'pipeline_internal_prompts')
        .limit(1)
        .maybeSingle()

      if (!error && data) {
        const customPrompts = (data.value as Record<string, string>) ?? {}
        setCachedInternalPrompts(customPrompts)
        return customPrompts[chainType] ?? ''
      }
    } catch (err) {
      logger.warn(`getInternalPrompt: DB error: ${err}`)
    }
  }

  return ''
}
