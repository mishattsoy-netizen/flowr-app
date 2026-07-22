const SYSTEM_BLOCK_HEADERS = [
  'USER MEMORY FACT SHEET',
  'SESSION MEMORY SUMMARY',
  'PAGE CONTEXT',
  'VISION DATA',
  'ADVISOR PREPARATION',
  'CURRENT CONTEXT',
  'SEARCH DATA',
  'IMAGE FACTS',
  'PENDING CONFIRMATION',
  'FOCUS',
]

/**
 * Strips leaked system/dynamicContext scaffolding (e.g. "[PENDING CONFIRMATION]...",
 * "[FOCUS]...") from a string. Shared by the image-prompt guard below and by
 * create_content/update_content's content/title/description sanitization
 * (§6d) — the model sometimes echoes this metadata verbatim into saved
 * content instead of treating it as invisible scaffolding.
 */
export function sanitizeToolContent(text: string, maxLen?: number): string {
  let out = text
  for (const header of SYSTEM_BLOCK_HEADERS) {
    // Remove "[HEADER...]" and everything up to the next blank line or next "[" block
    const re = new RegExp(`\\[${header}[^\\]]*\\][\\s\\S]*?(?=\\n\\s*\\n|\\n\\[|$)`, 'g')
    out = out.replace(re, '')
  }
  // Drop a leading "[CURRENT REQUEST]" label if the request itself remains
  out = out.replace(/\[CURRENT REQUEST\]\s*/g, '')
  // A model occasionally backslash-escapes a markdown special character in
  // block content ("\*Size must be…") the way it would in a markdown FILE —
  // but block content here is stored and rendered largely as-is, not re-run
  // through a markdown parser that would interpret "\*" as an escaped literal
  // asterisk. Left alone, the user sees the raw "\*" in the rendered note.
  // Unescape the common CommonMark escape targets before persisting.
  out = out.replace(/\\([*_`\\[\]()#+\-.!>~])/g, '$1')
  out = out.replace(/\n{3,}/g, '\n\n').trim()
  return typeof maxLen === 'number' ? out.slice(0, maxLen) : out
}

/**
 * Prompts sent to image-generation providers must contain ONLY the visual
 * request: some providers put the prompt in a GET URL (pollinations), so any
 * leaked system block is transmitted to a third party; others enforce hard
 * length caps (Cloudflare: 2048).
 */
export function sanitizeImagePrompt(prompt: string, maxLen = 2000): string {
  return sanitizeToolContent(prompt, maxLen)
}
