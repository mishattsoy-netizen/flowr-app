import { describe, it, expect } from 'vitest'
import { summarizeToolCalls } from './toolSummary'

describe('summarizeToolCalls', () => {
  it('describes a create call with its title', () => {
    expect(summarizeToolCalls([{ tool: 'create_content', title: 'Buy groceries', success: true }]))
      .toBe('✅ Created "Buy groceries"')
  })

  it('joins multiple calls', () => {
    expect(summarizeToolCalls([
      { tool: 'create_content', title: 'A', success: true },
      { tool: 'update_content', title: 'B', success: true },
    ])).toBe('✅ Created "A" · Updated "B"')
  })

  it('reports failures honestly', () => {
    expect(summarizeToolCalls([{ tool: 'delete_content', title: 'X', success: false, error: 'not found' }]))
      .toBe('⚠️ Delete "X" failed (not found)')
  })

  it('handles list/search calls', () => {
    expect(summarizeToolCalls([{ tool: 'list_content', items: [1, 2, 3] }]))
      .toBe('✅ Looked up 3 item(s)')
  })

  it('falls back to a count when calls are unrecognizable', () => {
    expect(summarizeToolCalls([{}])).toBe('✅ Completed 1 action(s)')
  })
})
