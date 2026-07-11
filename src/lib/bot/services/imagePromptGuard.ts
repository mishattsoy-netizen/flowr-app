const SYSTEM_BLOCK_HEADERS = [
  'USER MEMORY FACT SHEET',
  'SESSION MEMORY SUMMARY',
  'PAGE CONTEXT',
  'VISION DATA',
  'ADVISOR PREPARATION',
  'CURRENT CONTEXT',
  'SEARCH DATA',
  'IMAGE FACTS',
]

/**
 * Prompts sent to image-generation providers must contain ONLY the visual
 * request: some providers put the prompt in a GET URL (pollinations), so any
 * leaked system block is transmitted to a third party; others enforce hard
 * length caps (Cloudflare: 2048).
 */
export function sanitizeImagePrompt(prompt: string, maxLen = 2000): string {
  let out = prompt
  for (const header of SYSTEM_BLOCK_HEADERS) {
    // Remove "[HEADER...]" and everything up to the next blank line or next "[" block
    const re = new RegExp(`\\[${header}[^\\]]*\\][\\s\\S]*?(?=\\n\\s*\\n|\\n\\[|$)`, 'g')
    out = out.replace(re, '')
  }
  // Drop a leading "[CURRENT REQUEST]" label if the request itself remains
  out = out.replace(/\[CURRENT REQUEST\]\s*/g, '')
  out = out.replace(/\n{3,}/g, '\n\n').trim()
  return out.slice(0, maxLen)
}
