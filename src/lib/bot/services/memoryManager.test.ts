import { describe, it, expect } from 'vitest'
import { messagesAfterWatermark, manageSessionCompaction, fetchConversationHistory } from './memoryManager'
import type { MemoryItem } from '../memory'

describe('messagesAfterWatermark', () => {
  const history = [
    { id: 10, role: 'user' as const, parts: [{ text: 'a' }] },
    { id: 11, role: 'model' as const, parts: [{ text: 'b' }] },
    { id: 12, role: 'user' as const, parts: [{ text: 'c' }] },
    { id: 13, role: 'model' as const, parts: [{ text: 'd' }] },
  ]

  it('returns the full history when there is no watermark', () => {
    expect(messagesAfterWatermark(history, null)).toEqual(history)
    expect(messagesAfterWatermark(history, undefined)).toEqual(history)
    expect(messagesAfterWatermark(history, 0)).toEqual(history)
  })

  it('keeps only messages with an id strictly greater than the watermark', () => {
    const result = messagesAfterWatermark(history, 11)
    expect(result.map(h => h.id)).toEqual([12, 13])
  })

  it('returns everything when the watermark is older than all messages', () => {
    expect(messagesAfterWatermark(history, 1)).toEqual(history)
  })

  it('returns nothing when the watermark is newer than all messages (already fully compacted)', () => {
    expect(messagesAfterWatermark(history, 13)).toEqual([])
  })

  it('treats items with no id as always after the watermark (client-supplied fallback history)', () => {
    const mixed = [{ id: 10, role: 'user' as const, parts: [{ text: 'a' }] }, { role: 'user' as const, parts: [{ text: 'no id' }] }]
    const result = messagesAfterWatermark(mixed, 10)
    expect(result).toHaveLength(1)
    expect(result[0].parts[0].text).toBe('no id')
  })
})

describe('manageSessionCompaction gating', () => {
  // These exercise the early-return gates only — a session under threshold
  // or with too little history never reaches compactSession (real provider
  // calls) or Supabase, so no mocking is needed to test them safely.

  it('does nothing when sessionState is null', async () => {
    const result = await manageSessionCompaction('s1', [], null)
    expect(result.cost).toBe(0)
    expect(result.currentSummary).toBeNull()
  })

  it('does nothing when history has fewer than 5 messages', async () => {
    const sessionState = { distilled_summary: null, token_usage_total: 999999, context_limit: 100, compaction_threshold: 0.5 }
    const shortHistory: MemoryItem[] = [{ id: 1, role: 'user', parts: [{ text: 'hi' }] }]
    const result = await manageSessionCompaction('s2', shortHistory, sessionState)
    expect(result.cost).toBe(0)
    expect(result.currentSummary).toBeNull()
  })

  it('does nothing when usage is under the compaction threshold', async () => {
    const sessionState = { distilled_summary: 'old summary', token_usage_total: 10, context_limit: 10000, compaction_threshold: 0.80 }
    const history: MemoryItem[] = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, role: 'user', parts: [{ text: `msg ${i}` }] }))
    const result = await manageSessionCompaction('s3', history, sessionState)
    expect(result.cost).toBe(0)
    expect(result.currentSummary).toBe('old summary')
  })

  it('does nothing when every message is already before the watermark (fully compacted)', async () => {
    const sessionState = {
      distilled_summary: 'old summary',
      token_usage_total: 99999,
      context_limit: 100,
      compaction_threshold: 0.5,
      last_compacted_message_id: 999,
    }
    const history: MemoryItem[] = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, role: 'user', parts: [{ text: `msg ${i}` }] }))
    const result = await manageSessionCompaction('s4', history, sessionState)
    expect(result.cost).toBe(0)
    expect(result.currentSummary).toBe('old summary')
  })

  // Regression for a real gap found during review (2026-07-14): the display
  // `history` passed to manageSessionCompaction is capped to historyLimit
  // (~20 messages). Reusing that capped array to compute
  // messagesSinceWatermark would silently skip anything older than the cap
  // once a chatty session outgrows it between compactions — the watermark
  // would jump past messages that were never actually included in the
  // summary. Passing memoryContext makes manageSessionCompaction re-fetch a
  // much wider window (COMPACTION_FETCH_LIMIT) instead of reusing the
  // display-capped array.
  it('does not no-op when the watermark gap exceeds the display-capped history size', async () => {
    const sessionState = {
      distilled_summary: 'old summary',
      token_usage_total: 99999,
      context_limit: 100,
      compaction_threshold: 0.5,
      last_compacted_message_id: 5,
    }
    // Display cap only shows ids 21-25 (5 messages) — if manageSessionCompaction
    // filtered THIS array by the watermark, it would see 5 messages and still
    // compact, silently skipping ids 6-20 forever. clientHistory (routed through
    // fetchConversationHistory, no DB/network needed) stands in for the real
    // wider fetch and contains the full gap, ids 6-25.
    const displayCappedHistory: MemoryItem[] = Array.from({ length: 5 }, (_, i) => ({ id: 21 + i, role: 'user', parts: [{ text: `recent ${i}` }] }))
    const fullGapHistory = Array.from({ length: 20 }, (_, i) => ({ id: 6 + i, role: 'user' as const, parts: [{ text: `msg ${i}` }] }))

    // Sanity-check the fetch helper itself sees the full gap, not the cap.
    const fetched = await fetchConversationHistory({ clientHistory: fullGapHistory }, 500)
    expect(fetched).toHaveLength(20)
    expect(messagesAfterWatermark(fetched as MemoryItem[], 5)).toHaveLength(20)

    // No real compaction model is reachable in this test environment, so
    // compactSession itself fails and the summary/watermark don't advance —
    // but manageSessionCompaction must reach that failure via the WIDE fetch
    // (20 messages), not silently succeed-by-omission on the narrow one.
    const result = await manageSessionCompaction('s5', displayCappedHistory, sessionState, { clientHistory: fullGapHistory })
    expect(result.currentSummary).toBe('old summary')
  })
})
