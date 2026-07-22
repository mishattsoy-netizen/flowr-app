import { describe, it, expect } from 'vitest'
import { applyPatchOps, sanitizeBlocks, toolHandlers, isPendingActionFresh, isPendingActionSameNextTurn } from './handlers'

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

describe('sanitizeBlocks', () => {
  it('strips system blocks from a block\'s content field', () => {
    const blocks = [{ type: 'text', content: '[CURRENT CONTEXT]\nDate: today\n\n[CURRENT REQUEST]\nreal text' }]
    expect(sanitizeBlocks(blocks as any)![0].content).toBe('real text')
  })

  it('recurses into nested children', () => {
    const blocks = [{ type: 'bulletList', children: [{ type: 'text', content: '[FOCUS]\nCurrent: x\n\nclean text' }] }]
    expect(sanitizeBlocks(blocks as any)![0].children![0].content).toBe('clean text')
  })

  it('leaves clean content unchanged', () => {
    const blocks = [{ type: 'text', content: 'just a normal block' }]
    expect(sanitizeBlocks(blocks as any)![0].content).toBe('just a normal block')
  })

  it('passes through undefined without throwing', () => {
    expect(sanitizeBlocks(undefined)).toBeUndefined()
  })
})

describe('delete_content confirmed:true server-side gate', () => {
  // Regression test for a live bug (2026-07-13): the model called
  // delete_content({ ids, confirmed: true }) as its FIRST and ONLY call —
  // no prior dry-run in that confirmation cycle — after re-deriving a bare
  // "yes" as "delete this" from raw conversation history. Trusting
  // confirmed:true alone (no server-side match against a stored
  // pending_action) let it execute anyway. getSessionState('temp') returns
  // a real SessionState with pending_action: null and touches no DB, so
  // this exercises the gate without mocking Supabase.
  const fakeUser = { userId: '11111111-1111-1111-1111-111111111111', sessionId: 'temp' }

  it('rejects confirmed:true with no matching pending_action on record', async () => {
    const result = await toolHandlers.delete_content({ ids: ['task-123'], confirmed: true }, fakeUser)
    expect(result.error).toBeDefined()
    expect(result.success).toBeUndefined()
  })
})

describe('update_content confirmed:true server-side gate', () => {
  const fakeUser = { userId: '11111111-1111-1111-1111-111111111111', sessionId: 'temp' }

  it('rejects a full-replace confirmed:true with no matching pending_action on record', async () => {
    const result = await toolHandlers.update_content({ id: 'e-123', content: 'new body', confirmed: true }, fakeUser)
    expect(result.error).toBeDefined()
    expect(result.success).toBeUndefined()
  })
})

describe('isPendingActionFresh', () => {
  // Regression test for a live gap (2026-07-13): an abandoned dry-run from
  // several turns ago stays matchable indefinitely without a TTL, so an
  // unrelated later "yes" can still pass the ids/id-match gate and execute
  // a stale action.

  it('rejects a missing pending action', () => {
    expect(isPendingActionFresh(null)).toBe(false)
    expect(isPendingActionFresh(undefined)).toBe(false)
  })

  it('rejects a pending action with no created_at', () => {
    expect(isPendingActionFresh({})).toBe(false)
  })

  it('accepts a pending action created moments ago', () => {
    expect(isPendingActionFresh({ created_at: new Date().toISOString() })).toBe(true)
  })

  it('rejects a pending action older than the TTL (abandoned dry-run from turns ago)', () => {
    const staleTime = new Date(Date.now() - 40 * 60 * 1000).toISOString()
    expect(isPendingActionFresh({ created_at: staleTime })).toBe(false)
  })

  // Regression: a real user took ~15 minutes to reply "yes" to a delete
  // confirmation (reading the generated report first) and the old 5-minute
  // TTL silently expired the dry-run — the model still said "yes" was heard
  // and called confirmed:true, but the server rejected it as stale, so the
  // delete never ran. 30 minutes is a human-realistic reply window.
  it('accepts a confirmation ~15 minutes after the dry-run (realistic reading time)', () => {
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()
    expect(isPendingActionFresh({ created_at: fifteenMinAgo })).toBe(true)
  })

  it('rejects a pending action with a clock-skewed future timestamp', () => {
    const futureTime = new Date(Date.now() + 60 * 1000).toISOString()
    expect(isPendingActionFresh({ created_at: futureTime })).toBe(false)
  })
})

describe('isPendingActionSameNextTurn', () => {
  // Deterministic replacement/companion for the TTL check above: a stale
  // pending_action shouldn't survive an intervening turn regardless of how
  // little wall-clock time has passed (a fast back-and-forth conversation
  // can cover several turns well within the 5-minute TTL window). This
  // requires confirmation to land on exactly the next turn after the dry-run.

  it('accepts a confirmation on the immediately following turn', () => {
    expect(isPendingActionSameNextTurn({ turn_seq: 3 }, 4)).toBe(true)
  })

  it('rejects a confirmation on the same turn as the dry-run (no turn has elapsed)', () => {
    expect(isPendingActionSameNextTurn({ turn_seq: 3 }, 3)).toBe(false)
  })

  it('rejects a confirmation after an intervening turn was skipped', () => {
    expect(isPendingActionSameNextTurn({ turn_seq: 3 }, 5)).toBe(false)
  })

  it('rejects when turn_seq is missing on the pending action', () => {
    expect(isPendingActionSameNextTurn({}, 4)).toBe(false)
    expect(isPendingActionSameNextTurn(null, 4)).toBe(false)
    expect(isPendingActionSameNextTurn(undefined, 4)).toBe(false)
  })

  it('rejects when the current turn_seq is missing', () => {
    expect(isPendingActionSameNextTurn({ turn_seq: 3 }, undefined)).toBe(false)
  })
})

describe('pending_action injection/gate alignment (chainRouter)', () => {
  // Regression: promptBuilder injects "[PENDING CONFIRMATION] — act on this"
  // into the model's context whenever sessionState.pending_action exists, with
  // no freshness/turn check of its own — only the confirmed:true gate in
  // delete_content enforces those. That mismatch let the model be told to
  // confirm a dry-run the server would then reject, so a user's genuine "yes"
  // silently did nothing. chainRouter must run the SAME two checks the gate
  // runs before it decides whether to inject pending_action at all — this
  // documents that composed check independent of chainRouter's DB plumbing.
  function shouldInject(pending: { created_at?: string; turn_seq?: number } | null, currentTurnSeq: number | undefined) {
    if (!pending) return false
    return isPendingActionFresh(pending) && isPendingActionSameNextTurn(pending, currentTurnSeq)
  }

  it('injects when the pending action is fresh and lands on the next turn', () => {
    const pending = { created_at: new Date().toISOString(), turn_seq: 5 }
    expect(shouldInject(pending, 6)).toBe(true)
  })

  it('does NOT inject a pending action older than the TTL, even if turn_seq lines up', () => {
    const pending = { created_at: new Date(Date.now() - 40 * 60 * 1000).toISOString(), turn_seq: 5 }
    expect(shouldInject(pending, 6)).toBe(false)
  })

  it('does NOT inject a pending action from a skipped turn, even if it is still fresh', () => {
    const pending = { created_at: new Date().toISOString(), turn_seq: 5 }
    expect(shouldInject(pending, 8)).toBe(false)
  })

  it('does NOT inject when there is no pending action', () => {
    expect(shouldInject(null, 6)).toBe(false)
  })
})
