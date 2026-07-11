import { describe, it, expect } from 'vitest'
import { sanitizeImagePrompt } from './imagePromptGuard'

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
