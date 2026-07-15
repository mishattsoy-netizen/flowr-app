import { describe, it, expect } from 'vitest'
import { computeVisionTokenCredit } from './context'

describe('computeVisionTokenCredit', () => {
  it('returns 0 when there are no current-turn images and no legacy placeholders', () => {
    expect(computeVisionTokenCredit(0, [])).toBe(0)
  })

  it('charges a flat credit per buffer actually fed to PRIMARY this turn', () => {
    expect(computeVisionTokenCredit(1, [])).toBe(258)
    expect(computeVisionTokenCredit(2, [])).toBe(516)
  })

  it('charges a flat credit per legacy [Image:] placeholder in history', () => {
    expect(computeVisionTokenCredit(0, ['some text [Image: a cat] more text'])).toBe(258)
  })

  it('charges a flat credit per legacy [Image attached] placeholder in history', () => {
    expect(computeVisionTokenCredit(0, ['user sent a photo [Image attached]'])).toBe(258)
  })

  // Regression test for a live bug (2026-07-15): a [VISION CONTEXT - DIGITAL TWIN]
  // block is real transcript/description text that's already counted via
  // estimateTokens() on the caller's concatenated history string. Charging a flat
  // 258-token credit ALSO for the twin marker double-counted every described
  // attachment on every turn it stayed in the active history window.
  it('does NOT charge a flat credit for a [VISION CONTEXT - DIGITAL TWIN] block (no double-count)', () => {
    const historyText = 'can see this image?\n\n[VISION CONTEXT - DIGITAL TWIN]\nA dimly lit workspace with dual monitors.'
    expect(computeVisionTokenCredit(0, [historyText])).toBe(0)
  })

  it('sums credits across current-turn buffers and multiple history messages, excluding twin blocks', () => {
    const history = [
      'first message [Image: old photo]',
      'second message\n\n[VISION CONTEXT - DIGITAL TWIN]\nA contract transcript.',
      'third message [Image attached]',
    ]
    // 2 current-turn visual buffers (2*258) + 1 legacy [Image:] (258) + 1 legacy
    // [Image attached] (258) = 4 * 258. The twin block contributes 0.
    expect(computeVisionTokenCredit(2, history)).toBe(4 * 258)
  })
})
