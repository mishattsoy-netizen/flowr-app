import { describe, it, expect } from 'vitest'
import { capNarrationText } from './image-narration'

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
