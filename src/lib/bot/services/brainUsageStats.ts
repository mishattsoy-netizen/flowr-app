export interface UsageEventRow { created_at: string }

export interface UsageCalendarCell { date: string; count: number; level: 0 | 1 | 2 | 3 | 4 }

export interface UsageStats {
  requests: number
  activeDays: number
  streak: number
  calendar: UsageCalendarCell[]
}

/** UTC day key, e.g. "2026-07-11". */
function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

function bucketLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0
  if (count === 1) return 1
  if (count <= 3) return 2
  if (count <= 6) return 3
  return 4
}

/**
 * Pure: raw event rows → panel stats. `now` is injected so tests are
 * deterministic. Calendar only includes days that actually have events
 * (the UI fills the visual grid; this returns the sparse data).
 */
export function computeUsageStats(rows: UsageEventRow[], now: Date): UsageStats {
  const counts = new Map<string, number>()
  for (const r of rows) {
    const k = dayKey(r.created_at)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const calendar: UsageCalendarCell[] = [...counts.entries()]
    .map(([date, count]) => ({ date, count, level: bucketLevel(count) }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Streak: consecutive days with >=1 event, counting back from today.
  let streak = 0
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const key = cursor.toISOString().slice(0, 10)
    if ((counts.get(key) ?? 0) > 0) {
      streak++
      cursor.setUTCDate(cursor.getUTCDate() - 1)
    } else {
      break
    }
  }

  return {
    requests: rows.length,
    activeDays: counts.size,
    streak,
    calendar,
  }
}
