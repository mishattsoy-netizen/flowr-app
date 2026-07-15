import { describe, it, expect } from 'vitest'
import { capNarrationText, parseNarrationResponse } from './image-narration'

describe('capNarrationText', () => {
  it('leaves text under the cap unchanged', () => {
    const result = capNarrationText('short text')
    expect(result).toEqual({ text: 'short text', truncated: false })
  })

  it('truncates text over the cap and appends a marker', () => {
    const longText = 'x'.repeat(20000) // well over the ~14000 char cap (4000 tokens * 3.5)
    const result = capNarrationText(longText)
    expect(result.truncated).toBe(true)
    expect(result.text.startsWith('x'.repeat(100))).toBe(true)
    expect(result.text).toContain('[truncated — approximately')
    expect(result.text).toContain('more characters omitted. Ask me to continue for the rest.]')
  })

  it('keeps the capped portion at or under the char limit (excluding the marker)', () => {
    const longText = 'y'.repeat(20000)
    const result = capNarrationText(longText)
    const markerIndex = result.text.indexOf('\n\n[truncated')
    const cappedPortion = result.text.slice(0, markerIndex)
    expect(cappedPortion.length).toBeLessThanOrEqual(14000)
  })

  it('does not truncate text exactly at the cap', () => {
    const exactText = 'z'.repeat(14000)
    const result = capNarrationText(exactText)
    expect(result).toEqual({ text: exactText, truncated: false })
  })
})

describe('parseNarrationResponse', () => {
  it('parses a TRANSCRIPT-tagged response', () => {
    const raw = '[MODE: TRANSCRIPT]\n\nArticle 1: The intern shall attend all scheduled sessions.'
    const result = parseNarrationResponse(raw)
    expect(result.mode).toBe('transcript')
    expect(result.text).toBe('Article 1: The intern shall attend all scheduled sessions.')
  })

  it('parses a VISUAL-tagged response', () => {
    const raw = '[MODE: VISUAL]\nA dimly lit workspace with dual monitors and city lights beyond the window.'
    const result = parseNarrationResponse(raw)
    expect(result.mode).toBe('visual')
    expect(result.text).toBe('A dimly lit workspace with dual monitors and city lights beyond the window.')
  })

  it('is case-insensitive on the tag', () => {
    const raw = '[mode: transcript]\n\nSome transcribed text.'
    const result = parseNarrationResponse(raw)
    expect(result.mode).toBe('transcript')
  })

  it('falls back to visual mode when no tag is present', () => {
    const raw = 'Just a plain description with no tag at all.'
    const result = parseNarrationResponse(raw)
    expect(result.mode).toBe('visual')
    expect(result.text).toBe('Just a plain description with no tag at all.')
  })

  it('falls back to visual mode when the tag is malformed', () => {
    const raw = '[MODE TRANSCRIPT]\nMissing the colon.'
    const result = parseNarrationResponse(raw)
    expect(result.mode).toBe('visual')
    expect(result.text).toBe(raw.trim())
  })
})
