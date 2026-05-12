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
  try {
    const { data, error } = await supabase
      .from('bot_compiled_prompt')
      .select('content, global_enabled')
      .eq('mode', mode)
      .single()

    if (!error && data && data.global_enabled && data.content?.trim()) {
      return data.content.trim()
    }
    if (error) logger.warn(`getCompiledPrompt: DB error [${mode}]: ${error.message}`)
  } catch (err) {
    logger.error(`getCompiledPrompt: Exception loading from DB: ${err}`)
  }

  // 2. Local file fallback
  try {
    const filePath = path.join(process.cwd(), 'bot prompts(premission to edit needed!)', `mode-${mode}.txt`)
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
  VISION: `PIPELINE STEP — output goes to next chain, NOT to user. Extract all visual content, text, objects, and context from the image. Return structured data only.`,
  WEB_SEARCH: `PIPELINE STEP — output goes to next chain, NOT to user.\nPerform a fast broad search. One pass, speed over depth.\nReturn structured output:\nQUERIES RUN: [queries used]\nKEY FINDINGS:\n- [fact] — source: [URL]\nGAPS: [not found — or "none"]\nCONFLICTS: [contradictions — or "none"]\nRules: no conclusions, no fabricated sources, no prose.`,
  DEEP_RESEARCH: `PIPELINE STEP — output goes to next chain, NOT to user.\nExhaustive multi-source research. Accuracy over speed. Cross-reference every claim.\nReturn structured output:\nTOPIC: [topic]\nFINDINGS:\n- [finding] — confidence: high/medium/low — sources: [URLs]\nCONFLICTS:\n- [position A] vs [position B] — sources: [URLs]\nGAPS: [unanswered questions — or "none"]\nRules: flag every conflict, flag every gap, no fabricated sources, no final conclusions.`,
  CODING: `PIPELINE STEP — output goes to next chain, NOT to user. Produce the requested code. Return: code blocks, brief summary of what was written, any caveats or assumptions.`,
  COMPLEX_THINKING: `PIPELINE STEP — output goes to next chain, NOT to user. Analyze the problem deeply. Return: conclusions, key insights, recommended approach. No prose — structured output only.`,
  TOOL_CALLING: `PIPELINE STEP — output goes to next chain, NOT to user. Execute the requested action. Return: what was done, result or confirmation, any errors encountered.`,
  IMAGE_GEN: `PIPELINE STEP — image has been generated. Pass concept forward as JSON. Output exactly: {"type":"image_generated","prompt_used":"<prompt>","concept":"<brief concept>"}`,
}

export async function getInternalPrompt(chainType: string, mode: BotMode = 'default'): Promise<string> {
  let rolePrompt = ''

  // 1. Supabase settings primary
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'pipeline_internal_prompts')
      .maybeSingle()

    if (!error && data) {
      const customPrompts = (data.value as Record<string, string>) ?? {}
      rolePrompt = customPrompts[chainType]
    }
  } catch (err) {
    logger.warn(`getInternalPrompt: DB error: ${err}`)
  }

  // 2. Local file fallback
  if (!rolePrompt) {
    try {
      const fileName = `pipeline-${chainType.toLowerCase().replace(/_/g, '-')}.txt`
      const filePath = path.join(process.cwd(), 'bot prompts(premission to edit needed!)', fileName)
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

  const parts: string[] = [rolePrompt]

  try {
    const [brainResult, restrictionsResult] = await Promise.all([
      supabase
        .from('bot_brain_entries')
        .select('category, title, content')
        .eq('is_active', true)
        .in('category', ['rules', 'red_flags', 'facts'])
        .order('created_at', { ascending: true }),
      supabase
        .from('bot_settings')
        .select('content')
        .eq('category', 'restrictions')
        .eq('mode', mode)
        .maybeSingle()
    ])

    if (restrictionsResult.data?.content) {
      parts.push(`[RESTRICTIONS]\n${restrictionsResult.data.content.trim()}`)
    }

    const brainEntries = brainResult.data ?? []
    const factsEntries = brainEntries.filter((e: any) => e.category === 'facts')
    if (factsEntries.length > 0) {
      const lines = factsEntries.map((e: any) => `- ${e.title}: ${e.content}`).join('\n')
      parts.push(`[BRAIN: FACTS & KNOWLEDGE]\n${lines}`)
    }
  } catch (err) {
    logger.warn(`getInternalPrompt: partial DB failure (brain/restrictions), proceeding with core prompt only.`)
  }

  return parts.join('\n\n')
}
