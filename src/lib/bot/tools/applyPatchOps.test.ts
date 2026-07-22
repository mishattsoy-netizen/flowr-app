import { describe, it, expect } from 'vitest'
import { applyPatchOps } from './handlers'

describe('applyPatchOps', () => {
  it('replaces an exact match', () => {
    expect(applyPatchOps('net **~−$4,865** total', [{ find: '~−$4,865', replace: '-$4,699.07' }]))
      .toBe('net **-$4,699.07** total')
  })

  it('falls back to an HTML-stripped find when the raw find misses', () => {
    const body = 'net **~−$4,865** total'
    const out = applyPatchOps(body, [{ find: '<strong>~−$4,865</strong>', replace: '-$4,699.07' }])
    expect(out).toBe('net -$4,699.07 total')
  })

  it('strips HTML from replace text when falling back', () => {
    const body = 'net **~−$4,865** total'
    const out = applyPatchOps(body, [{ find: '<strong>~−$4,865</strong>', replace: '<strong>-$4,699.07</strong>' }])
    expect(out).toBe('net **-$4,699.07** total')
  })

  it('still throws listing genuinely missing finds', () => {
    expect(() => applyPatchOps('abc', [{ find: 'zzz', replace: 'y' }]))
      .toThrow(/were not found/)
  })
})
