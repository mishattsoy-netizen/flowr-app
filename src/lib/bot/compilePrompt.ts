import { supabaseAdmin as supabase } from '@/lib/supabase'
import type { BotMode } from '@/data/store.types'
import fs from 'fs'
import path from 'path'
import { logger } from '../logger'

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
    recompilePrompt('pro'),
  ])
}

export async function getCompiledPrompt(mode: BotMode = 'default'): Promise<string> {
  // 1. Supabase primary
  const { data, error } = await supabase
    .from('bot_compiled_prompt')
    .select('content, global_enabled')
    .eq('mode', mode)
    .single()

  if (!error && data && data.global_enabled && data.content?.trim()) {
    return data.content.trim()
  }

  // 2. Local file fallback
  try {
    const filePath = path.join(process.cwd(), `mode-${mode}.txt`)
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8')
      if (content?.trim()) {
        logger.info(`Loaded fallback prompt from ${filePath}`)
        return content.trim()
      }
    }
  } catch (err) {
    logger.warn(`Failed to read fallback mode file: ${err}`)
  }

  return ''
}

const DEFAULT_INTERNAL_PROMPTS: Record<string, string> = {
  VISION: `You are the VISION step in a multi-step pipeline.\nYour output will be consumed by the next chain — NOT shown to the user.\nExtract and describe all visual content, text, and relevant details from the image.\nWrite structured data output, not conversational prose.`,
  WEB_SEARCH: `You are the WEB_SEARCH step in a multi-step pipeline.\nYour output will be consumed by the next chain — NOT shown to the user.\nReturn structured findings: key facts, source URLs, queries run, gaps/unanswered parts.\nWrite structured data output, not conversational prose.`,
  DEEP_RESEARCH: `You are the DEEP_RESEARCH step in a multi-step pipeline.\nYour output will be consumed by the next chain — NOT shown to the user.\nReturn multi-source synthesis: key findings by topic, confidence level, conflicting data flagged.\nWrite structured data output, not conversational prose.`,
  CODING: `You are the CODING step in a multi-step pipeline.\nYour output will be consumed by the next chain — NOT shown to the user.\nReturn code blocks with a brief summary of what was written and any caveats.\nWrite structured data output, not conversational prose.`,
  COMPLEX_THINKING: `You are the ANALYSIS step in a multi-step pipeline.\nYour output will be consumed by the next chain — NOT shown to the user.\nReturn analysis summary: conclusions, key insights, recommended approach.\nWrite structured data output, not conversational prose.`,
  TOOL_CALLING: `You are the TOOL_CALLING step in a multi-step pipeline.\nYour output will be consumed by the next chain — NOT shown to the user.\nReturn action result: what was done, confirmation or error.\nWrite structured data output, not conversational prose.`,
  IMAGE_GEN: `You are the IMAGE_GEN step in a multi-step pipeline.\nYour image has been generated. Pass the concept forward as JSON.\nOutput exactly: {"type":"image_generated","prompt_used":"<prompt>","concept":"<brief concept description>"}`,
}

export async function getInternalPrompt(chainType: string, mode: BotMode = 'default'): Promise<string> {
  let rolePrompt = ''

  // 1. Supabase settings primary
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'pipeline_internal_prompts')
    .maybeSingle()

  const customPrompts = (data?.value as Record<string, string>) ?? {}
  rolePrompt = customPrompts[chainType]

  // 2. Local file fallback
  if (!rolePrompt) {
    try {
      const fileName = `pipeline-${chainType.toLowerCase().replace(/_/g, '-')}.txt`
      const filePath = path.join(process.cwd(), fileName)
      if (fs.existsSync(filePath)) {
        rolePrompt = fs.readFileSync(filePath, 'utf8').trim()
        logger.info(`Loaded fallback internal prompt from ${filePath}`)
      }
    } catch (err) {
      logger.warn(`Failed to read fallback pipeline file: ${err}`)
    }
  }

  // 3. Hardcoded default fallback
  if (!rolePrompt) {
    rolePrompt = DEFAULT_INTERNAL_PROMPTS[chainType] ?? `You are the ${chainType} step in a multi-step pipeline. Write structured output for the next chain.`
  }

  const brainResult = await supabase
    .from('bot_brain_entries')
    .select('category, title, content')
    .eq('is_active', true)
    .in('category', ['rules', 'red_flags', 'facts'])
    .order('created_at', { ascending: true })

  const brainEntries = brainResult.data ?? []
  const parts: string[] = [rolePrompt]

  const restrictionsResult = await supabase
    .from('bot_settings')
    .select('content')
    .eq('category', 'restrictions')
    .eq('mode', mode)
    .maybeSingle()

  if (restrictionsResult.data?.content) {
    parts.push(`[RESTRICTIONS]\n${restrictionsResult.data.content.trim()}`)
  }

  const factsEntries = brainEntries.filter((e: { category: string; title: string; content: string }) => e.category === 'facts')
  if (factsEntries.length > 0) {
    const lines = factsEntries.map((e: { category: string; title: string; content: string }) => `- ${e.title}: ${e.content}`).join('\n')
    parts.push(`[BRAIN: FACTS & KNOWLEDGE]\n${lines}`)
  }

  return parts.join('\n\n')
}
