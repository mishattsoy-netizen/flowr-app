import { describe, it, expect } from 'vitest'
import { toolHandlers } from './handlers'

// Same no-DB testing pattern as handlers.test.ts: sessionId 'temp' returns a
// real SessionState without touching Supabase, and anonymous users are
// rejected before any DB call — so gate/validation paths run for real.
const fakeUser = { userId: '11111111-1111-1111-1111-111111111111', sessionId: 'temp' }

describe('manage_brain gates', () => {
  it('rejects anonymous users', async () => {
    const res = await toolHandlers.manage_brain({ op: 'list' }, { userId: 'anonymous', sessionId: 'temp' })
    expect(res.error).toBeDefined()
  })

  it('rejects an unknown op', async () => {
    const res = await toolHandlers.manage_brain({ op: 'explode' }, fakeUser)
    expect(res.error).toMatch(/unknown op/i)
  })

  it('rejects remove of multiple nodes with confirmed:true but no matching pending_action', async () => {
    // Regression guard for the §6b gate: a bare confirmed:true with nothing
    // on record must be rejected via the no-DB pending_action match, not
    // pass through some other early return (e.g. a missing-Supabase error)
    // that would make this test green without ever exercising the gate.
    const res = await toolHandlers.manage_brain(
      { op: 'remove_node', node_ids: ['a', 'b'], confirmed: true }, fakeUser)
    expect(res.error).toMatch(/no matching pending confirmation/i)
    expect(res.success).toBeUndefined()
  })

  it('requires node_id or node_ids for remove_node', async () => {
    const res = await toolHandlers.manage_brain({ op: 'remove_node' }, fakeUser)
    expect(res.error).toMatch(/node_id/i)
  })

  it('requires from/to/edge_label for connect', async () => {
    const res = await toolHandlers.manage_brain({ op: 'connect', from: 'a' }, fakeUser)
    expect(res.error).toMatch(/edge_label/i)
  })
})

describe('manage_memory retirement', () => {
  it('manage_memory handler no longer exists', () => {
    expect((toolHandlers as any).manage_memory).toBeUndefined()
  })
})
