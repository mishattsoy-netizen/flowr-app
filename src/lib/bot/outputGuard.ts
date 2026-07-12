// src/lib/bot/outputGuard.ts

/**
 * Patterns that should never appear in user-facing responses.
 * Order: longest/most-specific first to avoid partial matches.
 * Each entry: [regex, description] for traceability.
 */
export const SANITIZE_PATTERNS: [RegExp, string][] = [
  // Bracketed block pairs — content between [TAG]...[/TAG]
  [/\[VISION_CONTEXT\][\s\S]*?\[\/VISION_CONTEXT\]/gi, 'vision context block'],
  [/\[THINKING\][\s\S]*?\[\/THINKING\]/gi, 'thinking block'],
  [/\[REASONING\][\s\S]*?\[\/REASONING\]/gi, 'reasoning block'],
  [/\[INTERNAL\][\s\S]*?\[\/INTERNAL\]/gi, 'internal block'],

  // Bracketed blocks — content from [TAG] to double newline (or end of string)
  [/\[SEARCH\]\s*[^\n]*(?:\n+|$)/gi, 'search query prefix'],
  [/\[THINK CHAIN DIRECTION\][\s\S]*?(?:\n\n|\n?$)/gi, 'think chain direction'],
  [/\[SESSION MEMORY SUMMARY\][\s\S]*?(?:\n\n|\n?$)/gi, 'session memory summary'],
  [/\[SEARCH DATA(?::\s*[^\]]+)?\][\s\S]*?(?:\n\n|\n?$)/gi, 'search data block'],
  [/\[SEARCH FAILED\][\s\S]*?(?:\n\n|\n?$)/gi, 'search failed block'],
  [/\[IMAGE FACTS\][\s\S]*?(?:\n\n|\n?$)/gi, 'image facts block'],
  [/\[VISION DATA[^\]]*\][\s\S]*?(?:\n\n|\n?$)/gi, 'vision data block'],
  [/\[CURRENT CONTEXT\][\s\S]*?(?:\n\n|\n?$)/gi, 'current context block'],
  [/\[ADVISOR PREPARATION\][\s\S]*?(?:\n\n|\n?$)/gi, 'advisor preparation block'],
  [/\[RESTRICTIONS\][\s\S]*?(?:\n\n|\n?$)/gi, 'restrictions block'],

  // Inline context hints — single-line [CONTEXT: ...]
  [/\[CONTEXT:[^\]]*\]\s*/gi, 'context hint'],

  // XML-style thought tags
  [/<thought>[\s\S]*?<\/thought>/gi, 'thought xml tags'],
  [/<thinking>[\s\S]*?<\/thinking>/gi, 'thinking xml tags'],
]

/**
 * Strip all internal metadata from a model response before it reaches the user.
 * Must be idempotent — calling it twice produces the same output.
 */
export function sanitizeOutput(content: string): string {
  if (!content) return content

  let result = content
  for (const [pattern] of SANITIZE_PATTERNS) {
    result = result.replace(pattern, '')
  }

  // Collapse triple+ newlines left by removed blocks into double newlines
  result = result.replace(/\n{3,}/g, '\n\n')

  // Trim leading/trailing whitespace
  return result.trim()
}

/** Removes "[Tools: ...]" bookkeeping blocks the model sometimes imitates from replayed history. */
export function stripToolAnnotations(content: string): string {
  return content
    .replace(/\n?\s*\[Tools:[\s\S]*?\]\s*\n?/g, '\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Conservative: only past/perfect claims of completed content mutations.
const ACTION_CLAIM_RE =
  /\b(has been|have been|was|were|already)\s+(permanently\s+)?(deleted|created|updated|moved|renamed)\b|\b(successfully)\s+(deleted|created|updated|moved)\b|\bI (have|'ve) (deleted|created|updated|moved)\b/i

// The claim must be about an app entity — prevents false positives on
// ordinary prose ("the company was created in 2019" in a search answer).
const APP_ENTITY_RE = /\b(note|notes|task|tasks|workspace|workspaces|folder|folders|canvas|item|items|memory|memories|reminder|reminders)\b/i

// Tools that actually mutate user content. A successful READ (list_content)
// does not ground a claim like "I created your note" — only a successful
// mutation does.
const MUTATING_TOOLS = new Set([
  'create_content',
  'update_content',
  'append_to_note',
  'move_content',
  'delete_content',
  'manage_memory',
])

/**
 * True when the reply claims a completed create/update/delete/move of an app
 * entity but no mutating tool SUCCEEDED this turn. Covers both cases:
 *   - no tool ran at all (model hallucinated the action outright), and
 *   - a mutating tool ran but every one of them failed (model reports "Done"
 *     off a failed create/update — the captured `success` flag catches this).
 * A successful read (list_content) alone never grounds a mutation claim.
 * Caller decides how to handle (replace reply). Only call on tool-enabled turns.
 */
export function hasUngroundedActionClaim(content: string, capturedToolCalls: any[] | undefined): boolean {
  const claimsAction = ACTION_CLAIM_RE.test(content) && APP_ENTITY_RE.test(content)
  if (!claimsAction) return false

  const succeededMutation = (capturedToolCalls ?? []).some(
    (c: any) => MUTATING_TOOLS.has(c?.tool) && c?.success !== false
  )
  return !succeededMutation
}
