import { describe, it, expect } from 'vitest'
import { applyPatchOps } from './handlers'

describe('applyPatchOps', () => {
  it('applies a single find/replace', () => {
    expect(applyPatchOps('# Title\n\nHello world', [{ find: 'Hello world', replace: 'Hello Flowr' }]))
      .toBe('# Title\n\nHello Flowr')
  })

  it('applies multiple ops in order', () => {
    const md = 'one two three'
    const result = applyPatchOps(md, [
      { find: 'one', replace: '1' },
      { find: 'three', replace: '3' },
    ])
    expect(result).toBe('1 two 3')
  })

  it('throws and changes nothing when a find string is missing (atomic)', () => {
    const md = 'alpha beta gamma'
    expect(() => applyPatchOps(md, [
      { find: 'alpha', replace: 'ALPHA' },
      { find: 'does-not-exist', replace: 'x' },
    ])).toThrow(/does-not-exist/)
  })

  it('reports every missing find string, not just the first', () => {
    expect(() => applyPatchOps('text', [
      { find: 'missing-one', replace: 'a' },
      { find: 'missing-two', replace: 'b' },
    ])).toThrow(/missing-one/)
  })

  it('only replaces the first occurrence of a find string (String.replace semantics)', () => {
    expect(applyPatchOps('cat cat cat', [{ find: 'cat', replace: 'dog' }]))
      .toBe('dog cat cat')
  })
})
