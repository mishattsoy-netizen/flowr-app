import { describe, it, expect } from 'vitest'
import { capNarrationText, parseNarrationResponse, partitionNarrationResults } from './image-narration'

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

  it('parses a MIXED-tagged response', () => {
    const raw = '[MODE: MIXED]\nA clean UI mockup.\n\nLogin\nPassword'
    const result = parseNarrationResponse(raw)
    expect(result.mode).toBe('mixed')
    expect(result.text).toBe('A clean UI mockup.\n\nLogin\nPassword')
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

describe('partitionNarrationResults', () => {
  const bufA = Buffer.from('A')
  const bufB = Buffer.from('B')
  const bufC = Buffer.from('C')

  it('routes a transcript-mode result to transcriptDescriptions, not visualBuffers', () => {
    const result = partitionNarrationResults(
      [bufA],
      [{ description: 'Article 1: ...', mode: 'transcript' }]
    )
    expect(result.visualBuffers).toEqual([])
    expect(result.transcriptDescriptions).toEqual(['Article 1: ...'])
    expect(result.allDescriptions).toEqual(['Article 1: ...'])
  })

  it('routes a visual-mode result to visualBuffers, not transcriptDescriptions', () => {
    const result = partitionNarrationResults(
      [bufA],
      [{ description: 'A dimly lit workspace.', mode: 'visual' }]
    )
    expect(result.visualBuffers).toEqual([bufA])
    expect(result.transcriptDescriptions).toEqual([])
    expect(result.allDescriptions).toEqual(['A dimly lit workspace.'])
  })

  it('routes a mixed-mode result to visualBuffers AND allDescriptions, but NOT transcriptDescriptions', () => {
    const result = partitionNarrationResults(
      [bufA],
      [{ description: 'A UI mockup.\nLogin', mode: 'mixed' }]
    )
    expect(result.visualBuffers).toEqual([bufA])
    expect(result.transcriptDescriptions).toEqual([])
    expect(result.allDescriptions).toEqual(['A UI mockup.\nLogin'])
  })

  it('handles a mixed batch: 1 visual image + N text-doc attachments (spec example)', () => {
    const result = partitionNarrationResults(
      [bufA, bufB, bufC],
      [
        { description: 'A dimly lit workspace.', mode: 'visual' },
        { description: 'No Cookie Consent: ...', mode: 'transcript' },
        { description: 'No Terms of Service: ...', mode: 'transcript' },
      ]
    )
    expect(result.visualBuffers).toEqual([bufA])
    expect(result.transcriptDescriptions).toHaveLength(2)
    expect(result.allDescriptions).toHaveLength(3)
  })

  it('labels descriptions with an index only when there is more than one buffer', () => {
    const single = partitionNarrationResults([bufA], [{ description: 'text', mode: 'transcript' }])
    expect(single.transcriptDescriptions[0]).toBe('text')

    const multi = partitionNarrationResults(
      [bufA, bufB],
      [{ description: 'first', mode: 'transcript' }, { description: 'second', mode: 'transcript' }]
    )
    expect(multi.transcriptDescriptions[0]).toBe('Image 1:\nfirst')
    expect(multi.transcriptDescriptions[1]).toBe('Image 2:\nsecond')
  })

  it('fails open: a null narration result is treated as visual so PRIMARY still sees the raw image', () => {
    const result = partitionNarrationResults([bufA], [null])
    expect(result.visualBuffers).toEqual([bufA])
    expect(result.transcriptDescriptions).toEqual([])
    expect(result.allDescriptions).toEqual([])
  })
})
