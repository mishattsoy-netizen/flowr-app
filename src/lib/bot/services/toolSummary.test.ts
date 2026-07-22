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

  it('renders a delete dry-run as a confirmation prompt, NOT a failure', () => {
    // Regression: the dry-run result carries status:'pending_confirmation' and
    // is logged with success:false — it must never read as "Delete failed".
    const out = summarizeToolCalls([{
      tool: 'delete_content',
      status: 'pending_confirmation',
      success: false,
      items_to_delete: [{ id: 'doc-1', title: 'Trade Analysis Report', type: 'note' }],
    }])
    expect(out).toContain('❓')
    expect(out).toContain('Delete "Trade Analysis Report"?')
    expect(out).not.toMatch(/failed/i)
  })

  it('lists multiple items in a pending delete confirmation', () => {
    const out = summarizeToolCalls([{
      tool: 'delete_content',
      status: 'pending_confirmation',
      success: false,
      items_to_delete: [
        { id: 'a', title: 'Report A', type: 'note' },
        { id: 'b', title: 'Report B', type: 'note' },
      ],
    }])
    expect(out).toContain('"Report A", "Report B"')
    expect(out).not.toMatch(/failed/i)
  })

  it('a genuine failure still wins the icon over a pending confirmation', () => {
    const out = summarizeToolCalls([
      { tool: 'delete_content', status: 'pending_confirmation', success: false, items_to_delete: [{ title: 'X' }] },
      { tool: 'update_content', title: 'Y', success: false, error: 'boom' },
    ])
    expect(out.startsWith('⚠️')).toBe(true)
  })
})
