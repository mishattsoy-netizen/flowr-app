import { describe, it, expect } from 'vitest'
import { computeUsageWindows } from './usageWindows'

describe('computeUsageWindows', () => {
  const tier = {
    price_usd: 20,
    credit_percent: 70,
    weekly_tightness: 1.0,
    sessions_per_week: 14,
    window_hours: 5,
  }
  const sub = {
    window_5h_anchor: '2026-07-09T10:00:00.000Z',
    window_week_anchor: '2026-07-09T10:00:00.000Z',
    period_start: '2026-07-01T00:00:00.000Z',
    period_end: '2026-08-01T00:00:00.000Z',
  }

  it('computes monthly credit as price_usd * credit_percent / 100', () => {
    const result = computeUsageWindows(sub, tier, { spend5h: 0, spendWeek: 0, spendMonth: 0 })
    expect(result.monthly.cap).toBeCloseTo(20 * 70 / 100, 10)
  })

  it('computes weekly cap as monthlyCredit * weeklyTightness / 4.33', () => {
    const result = computeUsageWindows(sub, tier, { spend5h: 0, spendWeek: 0, spendMonth: 0 })
    const monthlyCredit = 20 * 70 / 100
    expect(result.weekly.cap).toBeCloseTo(monthlyCredit * 1.0 / 4.33, 10)
  })

  it('computes window cap as weeklyCap / sessionsPerWeek', () => {
    const result = computeUsageWindows(sub, tier, { spend5h: 0, spendWeek: 0, spendMonth: 0 })
    const monthlyCredit = 20 * 70 / 100
    const weeklyCap = monthlyCredit * 1.0 / 4.33
    expect(result.window.cap).toBeCloseTo(weeklyCap / 14, 10)
  })

  it('passes through spend amounts unchanged', () => {
    const result = computeUsageWindows(sub, tier, { spend5h: 0.05, spendWeek: 0.3, spendMonth: 1.2 })
    expect(result.window.spent).toBe(0.05)
    expect(result.weekly.spent).toBe(0.3)
    expect(result.monthly.spent).toBe(1.2)
  })

  it('computes resets_at for the 5h window as anchor + window_hours', () => {
    const result = computeUsageWindows(sub, tier, { spend5h: 0, spendWeek: 0, spendMonth: 0 })
    const expected = new Date('2026-07-09T10:00:00.000Z').getTime() + 5 * 3600_000
    expect(new Date(result.window.resets_at).getTime()).toBe(expected)
  })

  it('computes resets_at for the weekly window as anchor + 7 days', () => {
    const result = computeUsageWindows(sub, tier, { spend5h: 0, spendWeek: 0, spendMonth: 0 })
    const expected = new Date('2026-07-09T10:00:00.000Z').getTime() + 7 * 24 * 3600_000
    expect(new Date(result.weekly.resets_at).getTime()).toBe(expected)
  })

  it('uses sub.period_end directly as the monthly resets_at', () => {
    const result = computeUsageWindows(sub, tier, { spend5h: 0, spendWeek: 0, spendMonth: 0 })
    expect(result.monthly.resets_at).toBe('2026-08-01T00:00:00.000Z')
  })

  it('falls back to now for missing window anchors', () => {
    const subNoAnchors = { ...sub, window_5h_anchor: null, window_week_anchor: null }
    const before = Date.now()
    const result = computeUsageWindows(subNoAnchors, tier, { spend5h: 0, spendWeek: 0, spendMonth: 0 })
    const after = Date.now()
    const resetsAtMs = new Date(result.window.resets_at).getTime() - 5 * 3600_000
    expect(resetsAtMs).toBeGreaterThanOrEqual(before)
    expect(resetsAtMs).toBeLessThanOrEqual(after)
  })
})
