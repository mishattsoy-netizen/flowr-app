import { describe, it, expect } from 'vitest'
import { sanitizeImagePrompt, sanitizeToolContent } from './imagePromptGuard'

describe('sanitizeImagePrompt', () => {
  it('strips [USER MEMORY FACT SHEET] blocks', () => {
    const dirty = `[USER MEMORY FACT SHEET]\nThe following are confirmed facts:\n- [ID: abc] Name: Mikhail\n\nA sunset over mountains`
    expect(sanitizeImagePrompt(dirty)).toBe('A sunset over mountains')
  })

  it('strips other known system blocks', () => {
    const dirty = `[SESSION MEMORY SUMMARY]\nstuff\n\n[PAGE CONTEXT]\nmore\n\n[CURRENT REQUEST]\ndraw a cat`
    expect(sanitizeImagePrompt(dirty)).toBe('draw a cat')
  })

  it('truncates to maxLen', () => {
    const long = 'x'.repeat(5000)
    expect(sanitizeImagePrompt(long).length).toBe(2000)
    expect(sanitizeImagePrompt(long, 100).length).toBe(100)
  })

  it('passes clean prompts through unchanged', () => {
    expect(sanitizeImagePrompt('a red bicycle')).toBe('a red bicycle')
  })
})

describe('sanitizeToolContent — markdown backslash-escape leaks', () => {
  // Regression: block content is stored/rendered largely as-is, NOT re-parsed
  // as markdown, so a model writing "\*Size must be…" (trying to escape the
  // asterisk the way it would in a markdown file) left a literal "\*" visible
  // in the rendered note instead of just the plain sentence.
  it('unescapes a leaked "\\*" the way the real transcript produced it', () => {
    const dirty = '\\*Size must be calculated from stop distance in pips × pip value, not from habit.'
    expect(sanitizeToolContent(dirty)).toBe('*Size must be calculated from stop distance in pips × pip value, not from habit.')
  })

  it('unescapes other common markdown escape targets', () => {
    expect(sanitizeToolContent('\\_not italic\\_')).toBe('_not italic_')
    expect(sanitizeToolContent('\\`not code\\`')).toBe('`not code`')
    expect(sanitizeToolContent('\\#not a heading')).toBe('#not a heading')
  })

  it('leaves a genuine double backslash as a single literal backslash (still an escape target)', () => {
    expect(sanitizeToolContent('C:\\\\Users\\\\test')).toBe('C:\\Users\\test')
  })

  it('does not touch a lone backslash with no following special character', () => {
    expect(sanitizeToolContent('a stray \\ character')).toBe('a stray \\ character')
  })
})
