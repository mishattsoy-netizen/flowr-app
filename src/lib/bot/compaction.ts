import { supabaseAdmin as supabase } from '../supabase'
import { logger } from '../logger'
import { runGoogle } from './providers/google'

export interface CompactionConfig {
  draft_primary_model: string
  draft_fallback_model: string
  refine_primary_model: string
  refine_fallback_model: string
  context_limit: number
  compaction_threshold: number
}

export async function getCompactionConfig(): Promise<CompactionConfig> {
  const { data, error } = await supabase
    .from('bot_compaction_config')
    .select('*')
    .eq('id', 1)
    .single()

  if (error || !data) {
    return {
      draft_primary_model: 'gemini-2.0-flash',
      draft_fallback_model: 'gemini-2.0-flash-lite',
      refine_primary_model: 'gemini-2.0-flash',
      refine_fallback_model: 'gemini-2.0-flash-lite',
      context_limit: 32000,
      compaction_threshold: 0.8,
    }
  }
  return data as CompactionConfig
}

export async function saveCompactionConfig(config: Partial<CompactionConfig>): Promise<void> {
  const { error } = await supabase
    .from('bot_compaction_config')
    .update({ ...config, updated_at: new Date().toISOString() })
    .eq('id', 1)
  if (error) throw error
}

const DRAFT_PROMPT = (currentSummary: string | null, historyText: string) => `
You are a Session Memory Manager. Condense this conversation into a DENSE, HIGH-FIDELITY SUMMARY.

EXISTING SUMMARY:
${currentSummary || 'None'}

RECENT HISTORY:
${historyText}

Write a dense summary covering:
1. Current project/task status
2. Key decisions made
3. User preferences discovered
4. Crucial technical details

Output ONLY the summary text. Be thorough but concise.
`.trim()

const REFINE_PROMPT = (draft: string) => `
You are a Summary Verification Specialist. Review and improve this session summary for accuracy and completeness.

DRAFT SUMMARY:
${draft}

Improve it by:
1. Fixing any inaccuracies or contradictions
2. Filling in missing critical details
3. Ensuring the summary is self-contained and clear

Output ONLY the improved summary text.
`.trim()

export async function compactSession(
  chatId: string,
  history: any[],
  currentSummary: string | null
): Promise<string | null> {
  const config = await getCompactionConfig()
  const historyText = history.map(h => `${h.role}: ${h.parts?.[0]?.text || h.content}`).join('\n\n')

  // Step 1: Draft
  let draft: string | null = null
  for (const model of [config.draft_primary_model, config.draft_fallback_model]) {
    try {
      const res = await runGoogle(model, DRAFT_PROMPT(currentSummary, historyText), 'You are a summarization engine.')
      if (res) {
        draft = typeof res === 'object' ? res.content : res
        break
      }
    } catch (e: any) {
      logger.warn(`Compaction draft failed [${model}]: ${e.message}`)
    }
  }

  if (!draft) {
    logger.warn(`Compaction aborted for ${chatId}: both draft models failed`)
    return currentSummary
  }

  // Step 2: Refine
  let refined: string | null = null
  for (const model of [config.refine_primary_model, config.refine_fallback_model]) {
    try {
      const res = await runGoogle(model, REFINE_PROMPT(draft), 'You are a summary verification engine.')
      if (res) {
        refined = typeof res === 'object' ? res.content : res
        break
      }
    } catch (e: any) {
      logger.warn(`Compaction refine failed [${model}]: ${e.message}`)
    }
  }

  return refined ?? draft
}
