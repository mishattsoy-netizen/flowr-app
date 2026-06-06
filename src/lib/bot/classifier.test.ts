import { describe, it, expect } from 'vitest'
import { resolveImageContext } from './classifier'

// Reproduces the routing decision behind transcript ai-transcript-2026-06-04T17-52-23:
// an image sat in history, the user then asked to compare two NAMED models, and the
// classifier was biased into REGULAR (skipping web search) by a one-sided hint.
// resolveImageContext is the pure decision; these assert the hint no longer pushes
// toward REGULAR unless the message actually references the image.

const imageHistory = [
  { role: 'user', content: '[VISION CONTEXT - DIGITAL TWIN]\nHeader: Claude API Docs ... pricing table' },
  { role: 'model', content: 'The image shows Claude model pricing as of June 2026.' },
]

describe('resolveImageContext', () => {
  it('detects a vision digital twin in history', () => {
    const r = resolveImageContext('anything', imageHistory)
    expect(r.hasVisionContext).toBe(true)
  })

  it('reports no vision context when history has no image markers', () => {
    const r = resolveImageContext('compare gpt o4 mini and gemini 3.1 flash lite', [
      { role: 'user', content: 'hi' },
      { role: 'model', content: 'hello' },
    ])
    expect(r.hasVisionContext).toBe(false)
    expect(r.contextHint).toBe('')
  })

  describe('message references the prior image', () => {
    const refs = [
      'what does my image say',
      'from the screenshot, what is the price',
      'in the picture which model is cheapest',
      'answer question 3 from the document',
    ]
    for (const msg of refs) {
      it(`flags reference + forbids web search: "${msg}"`, () => {
        const r = resolveImageContext(msg, imageHistory)
        expect(r.refersToPriorImage).toBe(true)
        expect(r.contextHint).toContain('NEVER WEB_SEARCH')
      })
    }
  })

  describe('message raises a NEW named-product topic (the bug)', () => {
    const newTopics = [
      'im choosing between, gpt o4 mini and gemini 3.1 flash lite',
      'which is better, claude opus 4.8 or gpt-5',
      'is gemini 3.1 flash lite good for tool calling',
    ]
    for (const msg of newTopics) {
      it(`does NOT bias toward REGULAR: "${msg}"`, () => {
        const r = resolveImageContext(msg, imageHistory)
        expect(r.refersToPriorImage).toBe(false)
        // The leaky "prefer REGULAR over WEB_SEARCH" hint must be gone.
        expect(r.contextHint).not.toContain('prefer REGULAR')
        expect(r.contextHint).not.toContain('NEVER WEB_SEARCH')
        // The neutral hint must explicitly leave WEB_SEARCH on the table.
        expect(r.contextHint).toContain('WEB_SEARCH')
      })
    }
  })

  describe('mixed-intent: references the image AND compares to an external entity', () => {
    const mixed = [
      'how does the cheapest one in my screenshot compare to gemini 3.1 flash lite',
      'from the image, is the cheapest model better than gpt-5',
      'compare the model in my screenshot vs claude opus 4.8',
      'how does the one in the picture stack up against gemini 3.1 flash lite',
    ]
    for (const msg of mixed) {
      it(`flags mixedIntent and routes to WEB_SEARCH: "${msg}"`, () => {
        const r = resolveImageContext(msg, imageHistory)
        expect(r.refersToPriorImage).toBe(true)
        expect(r.mixedIntent).toBe(true)
        expect(r.contextHint).not.toContain('NEVER WEB_SEARCH')
        expect(r.contextHint).toContain('WEB_SEARCH')
      })
    }

    it('a bare image reference with no comparison is NOT mixed-intent (stays grounded)', () => {
      const r = resolveImageContext('from the image, which model is cheapest', imageHistory)
      expect(r.refersToPriorImage).toBe(true)
      expect(r.mixedIntent).toBe(false)
      expect(r.contextHint).toContain('NEVER WEB_SEARCH')
    })
  })

})
