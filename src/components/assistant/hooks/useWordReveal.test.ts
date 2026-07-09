import { describe, it, expect } from 'vitest'
import { getWordRevealDelay } from './useWordReveal'

describe('getWordRevealDelay', () => {
  it('returns the same delay regardless of word count', () => {
    const delays = [0, 1, 2, 3, 10, 100, 1000, 10000].map(getWordRevealDelay)
    const first = delays[0]
    for (const d of delays) {
      expect(d).toBe(first)
    }
  })

  it('returns a positive, reasonably brisk delay', () => {
    const delay = getWordRevealDelay(50)
    expect(delay).toBeGreaterThan(0)
    expect(delay).toBeLessThan(100)
  })
})
