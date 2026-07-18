import { describe, it, expect } from 'vitest'
import { computeUsageStats } from './brainUsageStats'

// All timestamps are ISO strings, as returned from Supabase.
const at = (d: string) => ({ created_at: `${d}T12:00:00Z` })

describe('computeUsageStats', () => {
  it('counts total requests', () => {
    const out = computeUsageStats([at('2026-07-10'), at('2026-07-10'), at('2026-07-11')], new Date('2026-07-11T12:00:00Z'))
    expect(out.requests).toBe(3)
  })

  it('counts distinct active days', () => {
    const out = computeUsageStats([at('2026-07-10'), at('2026-07-10'), at('2026-07-11')], new Date('2026-07-11T12:00:00Z'))
    expect(out.activeDays).toBe(2)
  })

  it('computes the current streak ending today', () => {
    const out = computeUsageStats([at('2026-07-09'), at('2026-07-10'), at('2026-07-11')], new Date('2026-07-11T12:00:00Z'))
    expect(out.streak).toBe(3)
  })

  it('breaks the streak when yesterday and today are both empty', () => {
    const out = computeUsageStats([at('2026-07-01')], new Date('2026-07-11T12:00:00Z'))
    expect(out.streak).toBe(0)
  })

  it('buckets each day into an intensity level 0-4', () => {
    const rows = [at('2026-07-11'), at('2026-07-11'), at('2026-07-11')]
    const out = computeUsageStats(rows, new Date('2026-07-11T12:00:00Z'))
    const today = out.calendar.find(c => c.date === '2026-07-11')!
    expect(today.count).toBe(3)
    expect(today.level).toBeGreaterThanOrEqual(1)
    expect(today.level).toBeLessThanOrEqual(4)
  })

  it('returns zeros for an empty event list', () => {
    const out = computeUsageStats([], new Date('2026-07-11T12:00:00Z'))
    expect(out).toEqual({ requests: 0, activeDays: 0, streak: 0, calendar: [] })
  })
})
