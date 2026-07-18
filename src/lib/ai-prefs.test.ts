import { describe, it, expect } from 'vitest'
import {
  normalizeResponseStyle,
  normalizeReplyLanguage,
  styleSnippet,
  languageSnippet,
  buildResponseStyleBlock,
  buildReplyLanguageBlock,
} from './ai-prefs'

describe('ai-prefs', () => {
  it('normalizes style and language', () => {
    expect(normalizeResponseStyle('detailed')).toBe('detailed')
    expect(normalizeResponseStyle('nope')).toBe('balanced')
    expect(normalizeReplyLanguage('FR')).toBe('fr')
    expect(normalizeReplyLanguage('auto')).toBe('auto')
    expect(normalizeReplyLanguage('')).toBe('auto')
  })

  it('style snippets only for non-balanced', () => {
    expect(styleSnippet('balanced')).toBe('')
    expect(styleSnippet('concise')).toContain('concise')
    expect(buildResponseStyleBlock('balanced')).toBe('')
    expect(buildResponseStyleBlock('detailed')).toContain('[RESPONSE STYLE]')
  })

  it('language is soft default, not a hard lock', () => {
    expect(languageSnippet('auto')).toBe('')
    const fr = languageSnippet('fr')
    expect(fr).toContain('French')
    expect(fr).toContain('unless the user clearly asks to switch')
    expect(fr).not.toMatch(/always reply/i)
    expect(buildReplyLanguageBlock('uk')).toContain('Ukrainian')
  })
})
