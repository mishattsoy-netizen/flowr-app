import { describe, it, expect } from 'vitest'
import { shouldFailEmptyToolTurn } from './emptyToolTurn'

describe('shouldFailEmptyToolTurn', () => {
  it('fails a turn with only successful reads', () => {
    expect(shouldFailEmptyToolTurn([{ tool: 'list_content', success: true }])).toBe(true)
  })

  it('allows the summary when a mutation succeeded', () => {
    expect(shouldFailEmptyToolTurn([
      { tool: 'list_content', success: true },
      { tool: 'create_content', success: true },
    ])).toBe(false)
  })

  it('allows the summary when a mutation failed (user must see the error)', () => {
    expect(shouldFailEmptyToolTurn([{ tool: 'delete_content', success: false, error: 'not found' }])).toBe(false)
  })

  it('allows the summary for a pending confirmation', () => {
    expect(shouldFailEmptyToolTurn([{ tool: 'delete_content', status: 'pending_confirmation', success: false }])).toBe(false)
  })

  it('fails an empty call list', () => {
    expect(shouldFailEmptyToolTurn([])).toBe(true)
  })
})
