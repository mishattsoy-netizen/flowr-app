import { describe, it, expect, beforeAll } from 'vitest'
import { supabaseAdmin } from '../../supabase'
import {
  getOrCreateDefaultBrain, createBrain, addBrainNode, listBrain, deleteBrain, assertOwnedBrain,
} from './brainStore'

// A fixed, obviously-fake UUID used only as a test fixture user — this test
// creates real rows against a real Supabase connection, so it needs a
// consistent userId to scope its own fixtures and clean up predictably.
const TEST_USER_ID = '99999999-9999-4999-8999-999999999999'

describe.skipIf(!supabaseAdmin)('brain_id isolation (P2a security gate)', () => {
  let brainA: string
  let brainB: string

  beforeAll(async () => {
    const main = await getOrCreateDefaultBrain(TEST_USER_ID)
    brainA = main.id
    const created = await createBrain(TEST_USER_ID, 'Test Brain B')
    if ('error' in created) throw new Error(created.error)
    brainB = created.id
  })

  it('a node added to Brain A does not appear when listing Brain B', async () => {
    const res = await addBrainNode(TEST_USER_ID, 'user', brainA, {
      type: 'memory', content: 'This fact belongs ONLY to Brain A.',
    })
    expect('id' in res).toBe(true)

    const stateB = await listBrain(TEST_USER_ID, brainB)
    const leaked = stateB.nodes.some(n => n.content === 'This fact belongs ONLY to Brain A.')
    expect(leaked).toBe(false)

    const stateA = await listBrain(TEST_USER_ID, brainA)
    const present = stateA.nodes.some(n => n.content === 'This fact belongs ONLY to Brain A.')
    expect(present).toBe(true)
  })

  it('assertOwnedBrain rejects a brain_id that does not belong to the user', async () => {
    const owned = await assertOwnedBrain(TEST_USER_ID, brainA)
    expect(owned).toBe(true)
    const notOwned = await assertOwnedBrain('11111111-1111-4111-8111-111111111111', brainA)
    expect(notOwned).toBe(false)
  })

  it('deleteBrain refuses to delete the last remaining brain', async () => {
    // brainA and brainB both exist for TEST_USER_ID at this point (from
    // beforeAll), so deleting brainB should succeed, but a second delete
    // attempting to remove the now-only-remaining brainA must fail.
    const resB = await deleteBrain(TEST_USER_ID, brainB)
    expect('success' in resB).toBe(true)

    const resA = await deleteBrain(TEST_USER_ID, brainA)
    expect('error' in resA).toBe(true)
  })
})
