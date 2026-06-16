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
