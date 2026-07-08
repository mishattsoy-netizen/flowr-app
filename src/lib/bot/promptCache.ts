import crypto from 'crypto'
import { logger } from '../logger'

/**
 * Prompt Caching Layer
 *
 * Provider support:
 *   DeepSeek  — automatic KV prefix caching (no code needed, ~50x cheaper cache reads)
 *   Gemini    — explicit via cachedContent API (when @google/generative-ai SDK >=0.24 includes GoogleAICacheManager,
 *               or via REST API directly)
 *   OpenAI    — automatic prefix caching (no code needed)
 *   Anthropic — explicit via cache_control blocks
 *   Groq      — no caching support
 *   OpenRouter — pass-through to underlying provider
 */

// ─── Tier 1: System prompt hash ─────────────────────────────────────────────

interface PromptHashEntry {
  hash: string
  cachedAt: number
  modelId: string
  cacheId?: string // provider-specific (Gemini cachedContent name, etc.)
}

const promptHashCache = new Map<string, PromptHashEntry>()
const HASH_CACHE_TTL_MS = 1_800_000 // 30min

export function hashSystemPrompt(prompt: string): string {
  return crypto.createHash('sha256').update(prompt, 'utf8').digest('hex')
}

function cacheKey(hash: string, modelId: string): string {
  return `${hash}:${modelId}`
}

export function getCachedPromptHash(hash: string, modelId: string): PromptHashEntry | null {
  const key = cacheKey(hash, modelId)
  const entry = promptHashCache.get(key)
  if (entry && Date.now() - entry.cachedAt < HASH_CACHE_TTL_MS) {
    return entry
  }
  promptHashCache.delete(key)
  return null
}

export function setCachedPromptHash(hash: string, modelId: string, cacheId?: string): void {
  const key = cacheKey(hash, modelId)
  promptHashCache.set(key, { hash, modelId, cachedAt: Date.now(), cacheId })
}

// ─── Tier 3: Per-chain internal prompts cache ───────────────────────────────

let internalPromptsCache: Record<string, string> | null = null
let internalPromptsCachedAt = 0
const INTERNAL_PROMPTS_CACHE_TTL_MS = 1_800_000 // 30min

export function getCachedInternalPrompts(): Record<string, string> | null {
  if (internalPromptsCache && Date.now() - internalPromptsCachedAt < INTERNAL_PROMPTS_CACHE_TTL_MS) {
    return internalPromptsCache
  }
  internalPromptsCache = null
  return null
}

export function setCachedInternalPrompts(prompts: Record<string, string>): void {
  internalPromptsCache = prompts
  internalPromptsCachedAt = Date.now()
}

export function invalidateInternalPromptsCache(): void {
  internalPromptsCache = null
  internalPromptsCachedAt = 0
}

// ─── Tier 4: Gemini explicit context caching (via REST API) ─────────────────

const GEMINI_CACHE_TTL_SECONDS = 1800 // 30min

export async function createGeminiCachedContent(
  apiKey: string,
  modelId: string,
  systemPrompt: string
): Promise<string | null> {
  // Gemini context caching requires the GoogleAICacheManager class
  // which is not exported in @google/generative-ai v0.24.1
  // Fall back to direct REST API call
  const sanitizedId = modelId.split('/').pop() || modelId

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/cachedContents?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: `models/${sanitizedId}`,
          ttl: `${GEMINI_CACHE_TTL_SECONDS}s`,
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: 'Cache initialization — system instructions.',
                },
              ],
            },
          ],
          displayName: `flowr-compiled-${hashSystemPrompt(systemPrompt).slice(0, 12)}`,
        }),
      }
    )

    if (!res.ok) {
      const errText = await res.text()
      logger.warn(`Gemini cache creation failed: ${res.status} ${errText}`)
      return null
    }

    const data = await res.json()
    const cacheName = data.name as string
    logger.info(`Gemini cache created: ${cacheName} (model: ${sanitizedId})`)
    return cacheName
  } catch (e: any) {
    logger.warn(`Gemini cache creation error: ${e.message}`)
    return null
  }
}

export async function deleteGeminiCachedContent(
  apiKey: string,
  cacheName: string
): Promise<void> {
  try {
    await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${cacheName}?key=${apiKey}`,
      { method: 'DELETE' }
    )
    logger.info(`Gemini cache deleted: ${cacheName}`)
  } catch (e: any) {
    logger.warn(`Gemini cache deletion error: ${e.message}`)
  }
}
