import { describe, it, expect } from 'vitest'
import { compactSession } from './compaction'
import type { MemoryItem } from './memory'

// getRouterChain hits Next.js's unstable_cache + Supabase, both unavailable
// in this test environment; compactSession already wraps that call in
// .catch(() => ({ chain: [] })), so these exercise the real "all
// compaction models failed/unavailable" fallback path — a legitimate
// scenario (e.g. all COMPACTION-chain models disabled in admin), not a
// test-only shortcut.
describe('compactSession watermark on the all-models-failed path', () => {
  it('preserves the existing watermark and summary when no model succeeds', async () => {
    const history: MemoryItem[] = [
      { id: 5, role: 'user', parts: [{ text: 'a' }] },
      { id: 6, role: 'model', parts: [{ text: 'b' }] },
    ]
    const result = await compactSession('chat:test', history, 'existing summary', 3)
    expect(result.summary).toBe('existing summary')
    expect(result.newWatermark).toBe(3)
  })

  it('preserves a null watermark (never compacted before) rather than inventing one', async () => {
    const history: MemoryItem[] = [{ id: 1, role: 'user', parts: [{ text: 'a' }] }]
    const result = await compactSession('chat:test2', history, null, null)
    expect(result.summary).toBeNull()
    expect(result.newWatermark).toBeNull()
  })
})
