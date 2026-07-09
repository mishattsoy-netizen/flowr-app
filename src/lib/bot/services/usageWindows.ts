export interface UsageWindowResult { spent: number; cap: number; resets_at: string }

export interface UsageWindowsResult {
  window: UsageWindowResult
  weekly: UsageWindowResult
  monthly: UsageWindowResult
}

export function computeUsageWindows(
  sub: {
    window_5h_anchor: string | null
    window_week_anchor: string | null
    period_start: string
    period_end: string
  },
  tier: {
    price_usd: number
    credit_percent: number
    weekly_tightness: number
    sessions_per_week: number
    window_hours: number
  },
  spend: { spend5h: number; spendWeek: number; spendMonth: number }
): UsageWindowsResult {
  const now = new Date()
  const window5hAnchor = sub.window_5h_anchor ? new Date(sub.window_5h_anchor) : now
  const windowWeekAnchor = sub.window_week_anchor ? new Date(sub.window_week_anchor) : now

  const monthlyCredit = tier.price_usd * tier.credit_percent / 100
  const weeklyCap = monthlyCredit * tier.weekly_tightness / 4.33
  const windowCap = weeklyCap / Math.max(tier.sessions_per_week, 1)

  return {
    window: {
      spent: spend.spend5h,
      cap: windowCap,
      resets_at: new Date(window5hAnchor.getTime() + tier.window_hours * 3600_000).toISOString(),
    },
    weekly: {
      spent: spend.spendWeek,
      cap: weeklyCap,
      resets_at: new Date(windowWeekAnchor.getTime() + 7 * 24 * 3600_000).toISOString(),
    },
    monthly: {
      spent: spend.spendMonth,
      cap: monthlyCredit,
      resets_at: sub.period_end,
    },
  }
}
