import { describe, it, expect, vi, beforeEach } from 'vitest'

// Regression coverage for a live DATA-LOSS bug (2026-07-14): update_content and
// append_to_note only ever returned {success, id, title, type} — never the
// content they actually wrote. The web client's local mirror falls back to
// stale/empty content when the result doesn't carry it (see
// handlers.createContent.test.ts for the create_content half, which is the
// destructive case via a debounced re-upload). This file locks in that both
// handlers now echo back what they persisted.

let entityRow: { content: any[]; title: string; type: string }
const updateCalls: any[] = []

vi.mock('../../supabase', () => {
  const builder = () => {
    const q: any = {
      eq: () => q,
      // Handlers call .single() to fetch the existing row before writing, and
      // (after .update()) chain .select(...) awaited directly as a thenable —
      // support all three shapes on the same object rather than branching on
      // which columns were requested.
      select: () => q,
      single: () => Promise.resolve({ data: entityRow, error: null }),
      maybeSingle: () => Promise.resolve({ data: entityRow, error: null }),
      then: (resolve: any) => resolve({ data: [{ id: 'doc-1', title: entityRow.title, type: entityRow.type }], error: null }),
      update: (patch: any) => {
        updateCalls.push(patch)
        if (patch.content) entityRow = { ...entityRow, content: patch.content }
        return q
      },
    }
    return q
  }
  return { supabaseAdmin: { from: () => builder() } }
})

const ctx = { userId: '11111111-1111-1111-1111-111111111111', sessionId: 'temp' }

beforeEach(() => {
  entityRow = { content: [{ id: 'b1', type: 'text', content: 'Existing paragraph' }], title: 'My Note', type: 'note' }
  updateCalls.length = 0
})

describe('update_content: returns persisted content', () => {
  // The full-replace path requires a server-side confirmed:true gate matched
  // against a stored pending_action (see handlers.test.ts's dedicated coverage
  // of that gate) — out of scope here. `patch` writes immediately without
  // confirmation, so it exercises the same updates.content assignment and is
  // enough to pin the content-echo contract for the write path.
  it('echoes the patched content (not just the confirmation) for a `patch` call', async () => {
    const { toolHandlers } = await import('./handlers')
    const result: any = await toolHandlers.update_content(
      { id: 'doc-1', patch: [{ find: 'Existing paragraph', replace: 'Replaced paragraph' }] },
      ctx
    )
    expect(result.success).toBe(true)
    expect(JSON.stringify(result.content)).toContain('Replaced paragraph')
  })
})

describe('append_to_note: returns the appended blocks', () => {
  it('echoes only the newly appended blocks, not the full body', async () => {
    const { toolHandlers } = await import('./handlers')
    const result: any = await toolHandlers.append_to_note(
      { id: 'doc-1', content: 'A brand new paragraph' },
      ctx
    )
    expect(result.success).toBe(true)
    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0].content).toBe('A brand new paragraph')
  })
})
