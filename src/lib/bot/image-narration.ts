import { logger } from '../logger'
import { getRouterChain, IntentCategory } from '../router-config'
import { runGoogle } from './providers/google'
import { runCloudflare } from './providers/cloudflare'
import { runOpenRouter } from './providers/openrouter'
import { runGroq } from './providers/groq'
import { getChainPrompt } from './prompts'

// Coupled to context.ts's CHARS_PER_TOKEN (3.5, not exported) — keep in sync if
// that ratio ever changes. Duplicated here rather than imported to avoid adding
// a cross-module dependency for a single constant.
const MAX_NARRATION_TOKENS = 4000
const MAX_NARRATION_CHARS = Math.floor(MAX_NARRATION_TOKENS * 3.5)

/**
 * Caps narration text at MAX_NARRATION_CHARS so one huge document can't blow a
 * turn's context budget. Not a hard reject — the capped text still counts
 * toward token_usage_total, so several large attachments naturally push the
 * session toward compaction (spec: 2026-07-15-attachment-text-extraction-design.md).
 */
export function capNarrationText(text: string, maxChars: number = MAX_NARRATION_CHARS): { text: string; truncated: boolean } {
  if (text.length <= maxChars) return { text, truncated: false }
  const omittedChars = text.length - maxChars
  const truncated = text.slice(0, maxChars).trimEnd()
  return {
    text: `${truncated}\n\n[truncated — approximately ${omittedChars} more characters omitted. Ask me to continue for the rest.]`,
    truncated: true,
  }
}

const MODE_TAG_RE = /^\[MODE:\s*(TRANSCRIPT|VISUAL)\]\s*\n+([\s\S]*)$/i

/**
 * Extracts the model's self-selected mode tag (see image_narration.txt) from
 * its raw response. If the model didn't follow the tag format, falls back to
 * 'visual' — the historically safe default — and keeps the raw text as-is.
 */
export function parseNarrationResponse(raw: string): { mode: 'transcript' | 'visual'; text: string } {
  const trimmed = raw.trim()
  const match = trimmed.match(MODE_TAG_RE)
  if (match) {
    return {
      mode: match[1].toUpperCase() === 'TRANSCRIPT' ? 'transcript' : 'visual',
      text: match[2].trim(),
    }
  }
  return { mode: 'visual', text: trimmed }
}

export interface NarrationPartition {
  /** Buffers to feed to PRIMARY as raw images this turn (visual attachments, plus any failed narrations). */
  visualBuffers: Buffer[]
  /** Text-doc transcripts only — this turn's [VISION DATA] content. */
  transcriptDescriptions: string[]
  /** Every twin (transcript AND visual) — persisted as image_description so later turns see every attachment's twin as text. */
  allDescriptions: string[]
}

/**
 * Splits narrated attachments into what PRIMARY needs THIS turn vs. what gets
 * persisted for later turns. See spec "Core Model": text-doc attachments are
 * never fed as images (their transcript is strictly better); visual
 * attachments ARE fed as raw images this turn, with their twin excluded from
 * this turn's [VISION DATA] to avoid paying for the same information twice.
 */
export function partitionNarrationResults(
  buffers: Buffer[],
  results: Array<{ description: string; mode: 'transcript' | 'visual' } | null>
): NarrationPartition {
  const visualBuffers: Buffer[] = []
  const transcriptDescriptions: string[] = []
  const allDescriptions: string[] = []
  const multi = buffers.length > 1

  buffers.forEach((buf, i) => {
    const result = results[i]
    if (!result?.description) {
      // Narration failed or returned nothing — fail open: still let PRIMARY
      // see the raw image directly rather than silently dropping it.
      visualBuffers.push(buf)
      return
    }
    const label = multi ? `Image ${i + 1}:\n${result.description}` : result.description
    allDescriptions.push(label)
    if (result.mode === 'transcript') {
      transcriptDescriptions.push(label)
    } else {
      visualBuffers.push(buf)
    }
  })

  return { visualBuffers, transcriptDescriptions, allDescriptions }
}

export async function narrateGeneratedImage(
  imageBuffer: Buffer,
  context?: any
): Promise<{ description: string; modelId: string; provider: string } | null> {
  const chainCategory: IntentCategory = 'VISION'
  const systemPrompt = getChainPrompt('image_narration')

  const { chain } = await getRouterChain(chainCategory, 'default')
  if (!chain || chain.length === 0) {
    logger.warn(`No ${chainCategory} chain available for image narration`)
    return null
  }

  const prompt = 'Describe this image in detail (250-700 characters).'

  // Strip onChunk so narration tokens don't leak into the user-facing chat stream
  // (the narration is returned as image_description, not as message content).
  const subContext = { ...(context || {}), onChunk: undefined }

  for (const model of chain) {
    if (!model.is_enabled) continue

    try {
      let response: any = null
      const provider = model.provider.toLowerCase()

      if (provider === 'google' || provider === 'gemini') {
        response = await runGoogle(model.id, prompt, systemPrompt, imageBuffer, subContext, [])
      } else if (provider === 'cloudflare') {
        response = await runCloudflare(model.id, prompt, subContext?.aiApiKey, systemPrompt, [], 'VISION')
      } else if (provider === 'openrouter') {
        response = await runOpenRouter(model.id, prompt, systemPrompt, [], subContext?.aiApiKey, { ...subContext, openrouterProvider: model.openrouter_provider }, imageBuffer)
      } else if (provider === 'groq') {
        response = await runGroq(model.id, prompt, systemPrompt, subContext?.aiApiKey, subContext, [], imageBuffer)
      }

      if (response) {
        const description = typeof response === 'object' ? response.content : response
        if (description && description.length >= 10) {
          logger.info(`Narrated image using ${model.id}: ${description.slice(0, 50)}...`)
          return { description: description.trim(), modelId: model.id, provider: model.provider }
        }
      }
    } catch (e: any) {
      logger.warn(`Narration failed with ${model.id}: ${e.message}`)
    }
  }

  return null
}
