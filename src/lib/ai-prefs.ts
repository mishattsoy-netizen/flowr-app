/** User AI preferences: response style + reply language (soft defaults for the system prompt). */

export type ResponseStyle = 'concise' | 'balanced' | 'detailed'

/** ISO-ish language codes plus auto. Expand LANGUAGE_OPTIONS freely. */
export type ReplyLanguage = string

export const STYLE_OPTIONS: { key: ResponseStyle; label: string }[] = [
  { key: 'concise', label: 'Concise' },
  { key: 'balanced', label: 'Balanced' },
  { key: 'detailed', label: 'Detailed' },
]

export const LANGUAGE_OPTIONS: { key: string; label: string }[] = [
  { key: 'auto', label: 'Automatic' },
  { key: 'en', label: 'English' },
  { key: 'ru', label: 'Russian' },
  { key: 'uk', label: 'Ukrainian' },
  { key: 'fr', label: 'French' },
  { key: 'de', label: 'German' },
  { key: 'es', label: 'Spanish' },
  { key: 'pt', label: 'Portuguese' },
  { key: 'it', label: 'Italian' },
  { key: 'pl', label: 'Polish' },
  { key: 'ja', label: 'Japanese' },
  { key: 'zh', label: 'Chinese' },
  { key: 'ko', label: 'Korean' },
]

export const DEFAULT_RESPONSE_STYLE: ResponseStyle = 'balanced'
export const DEFAULT_REPLY_LANGUAGE = 'auto'

const STYLE_SNIPPETS: Record<ResponseStyle, string> = {
  concise: `Prefer concise replies. Lead with the answer. Use short lists. Skip optional background unless asked. Still be complete for multi-step tasks and code.`,
  balanced: '',
  detailed: `Prefer thorough replies when useful: structure with headings/lists, include steps, tradeoffs, and brief examples. Avoid filler and restating the question.`,
}

export function isResponseStyle(v: unknown): v is ResponseStyle {
  return v === 'concise' || v === 'balanced' || v === 'detailed'
}

export function normalizeResponseStyle(v: unknown): ResponseStyle {
  return isResponseStyle(v) ? v : DEFAULT_RESPONSE_STYLE
}

export function normalizeReplyLanguage(v: unknown): string {
  if (typeof v !== 'string' || !v.trim()) return DEFAULT_REPLY_LANGUAGE
  const code = v.trim().toLowerCase()
  if (code === 'auto') return 'auto'
  // Accept any listed option, or a short free-form code if already saved.
  if (LANGUAGE_OPTIONS.some(o => o.key === code) || /^[a-z]{2,3}(-[a-z0-9]+)?$/i.test(code)) {
    return code
  }
  return DEFAULT_REPLY_LANGUAGE
}

export function languageLabel(code: string): string {
  return LANGUAGE_OPTIONS.find(o => o.key === code)?.label ?? code
}

/** Soft style bias for the static system prompt. Empty for balanced (global prompt wins). */
export function styleSnippet(style: ResponseStyle): string {
  return STYLE_SNIPPETS[style] ?? ''
}

/**
 * Soft default reply language. Not a hard lock: mid-session switches in chat
 * history take precedence; a new session falls back to this default.
 */
export function languageSnippet(code: string): string {
  if (!code || code === 'auto') return ''
  const label = languageLabel(code)
  return `Default reply language: ${label}.
Use this language for replies unless the user clearly asks to switch (e.g. "switch to English", "answer in French", "по-русски").
If they switch mid-conversation, use the new language for the rest of this session.
Do not hard-lock forever — honor an explicit language switch.`
}

export function buildResponseStyleBlock(style: ResponseStyle): string {
  const body = styleSnippet(style)
  if (!body) return ''
  return `\n\n[RESPONSE STYLE]\n${body}`
}

export function buildReplyLanguageBlock(code: string): string {
  const body = languageSnippet(code)
  if (!body) return ''
  return `\n\n[REPLY LANGUAGE]\n${body}`
}
