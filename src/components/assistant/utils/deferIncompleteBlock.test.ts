import { describe, it, expect } from 'vitest'
import { deferIncompleteBlock } from './deferIncompleteBlock'

describe('deferIncompleteBlock', () => {
  it('returns text unchanged when there is no open block', () => {
    const text = 'Just some plain prose with no tables or code.'
    expect(deferIncompleteBlock(text, false)).toBe(text)
  })

  it('truncates an open table with no closing blank line', () => {
    const text = 'Here is a table:\n\n| a | b |\n| - | - |\n| 1 | 2'
    const result = deferIncompleteBlock(text, false)
    expect(result).toBe('Here is a table:')
  })

  it('returns full text when a table is closed by a blank line followed by more prose', () => {
    const text = 'Here is a table:\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\nDone.'
    expect(deferIncompleteBlock(text, false)).toBe(text)
  })

  it('truncates an open code fence', () => {
    const text = 'Some code:\n\n```js\nconst x = 1;'
    const result = deferIncompleteBlock(text, false)
    expect(result).toBe('Some code:')
  })

  it('returns full text when a code fence is closed', () => {
    const text = 'Some code:\n\n```js\nconst x = 1;\n```\n\nDone.'
    expect(deferIncompleteBlock(text, false)).toBe(text)
  })

  it('truncates an open [m]...[/m] pill', () => {
    const text = 'Click here: [m]Open Note'
    const result = deferIncompleteBlock(text, false)
    expect(result).toBe('Click here:')
  })

  it('returns full text when a pill is closed', () => {
    const text = 'Click here: [m]Open Note[/m] to continue.'
    expect(deferIncompleteBlock(text, false)).toBe(text)
  })

  it('always returns full text when isDone is true, regardless of open blocks', () => {
    const text = 'Here is a table:\n\n| a | b |\n| - | - |\n| 1 | 2'
    expect(deferIncompleteBlock(text, true)).toBe(text)
  })

  it('handles empty string', () => {
    expect(deferIncompleteBlock('', false)).toBe('')
    expect(deferIncompleteBlock('', true)).toBe('')
  })
})
