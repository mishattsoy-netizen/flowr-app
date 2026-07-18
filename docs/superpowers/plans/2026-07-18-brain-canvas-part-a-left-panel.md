# Brain Canvas Part A — Left Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the separate top-left brain switcher (`BrainPresetPicker`) and top-right stats readout (`BrainStatsPanel`) with one richer left-anchored panel that has a compact default view and an expandable analytics section, plus the backend to set a brain as default, track AI-request usage per brain, and expose `per_node_cap` to the client.

**Architecture:** Backend-first, then UI. New `setDefaultBrain` + `logBrainUsageEvent` service functions and a `brain_usage_events` table feed new API actions; `listBrain` gains `perNodeCap`; a new `BrainLeftPanel` component consumes it. Data-only tier-limit `UPDATE` ships alongside the migration.

**Tech Stack:** Next.js API routes, Supabase (`supabaseAdmin`), React + Tailwind, vitest for pure-logic tests.

**Spec:** `docs/superpowers/specs/2026-07-18-brain-canvas-details-design.md` §3.

---

## File Structure

- `supabase/migrations/20260718100000_brain_usage_events.sql` — new table + tier-limit UPDATE (create)
- `src/lib/bot/services/brainStore.ts` — add `setDefaultBrain`, `logBrainUsageEvent`, `getBrainUsageStats`, `resetBrainUsage`; expose `perNodeCap` in `listBrain` (modify)
- `src/lib/bot/services/brainStore.usage.test.ts` — pure tests for the usage-stats bucketing helper (create)
- `src/lib/bot/services/brainUsageStats.ts` — pure helper: raw event rows → { requests, activeDays, streak, calendar } (create)
- `src/lib/bot/services/brainUsageStats.test.ts` — tests for the pure helper (create)
- `src/lib/bot/services/brainStore.ts` — call `logBrainUsageEvent` inside `getBrainBlockForSession` (modify)
- `src/app/api/ai/user-brain/route.ts` — new actions `set_default_brain`, `brain_usage_stats`, `reset_brain_usage` (modify)
- `src/components/brain/canvas/BrainLeftPanel.tsx` — the new merged panel (create)
- `src/components/brain/canvas/BrainCanvasPage.tsx` — swap `BrainPresetPicker` + `BrainStatsPanel` for `BrainLeftPanel` (modify)
- `src/components/brain/canvas/useBrainData.ts` — add `perNodeCap` to `BrainCanvasState` (modify)

---

## Task 1: Migration — `brain_usage_events` table + tier-limit change

**Files:**
- Create: `supabase/migrations/20260718100000_brain_usage_events.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Brain usage tracking (spec 2026-07-18-brain-canvas-details-design.md §3.5):
-- one row per chat request that actually injected a brain's compiled block.
-- Powers the left panel's Requests/Active-days/streak/activity-calendar stats.
CREATE TABLE IF NOT EXISTS brain_usage_events (
  id         bigserial PRIMARY KEY,
  user_id    uuid NOT NULL,
  brain_id   uuid NOT NULL REFERENCES brains(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Stats queries always filter by (user_id, brain_id) and bucket by day.
CREATE INDEX IF NOT EXISTS idx_brain_usage_events_brain
  ON brain_usage_events(user_id, brain_id, created_at);

ALTER TABLE brain_usage_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "brain_usage_events_own" ON brain_usage_events;
CREATE POLICY "brain_usage_events_own" ON brain_usage_events
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Tier limit change (spec §3.6): business decision, data-only. Free has no AI
-- access so its row is inert and untouched. per_node_cap unchanged for all.
UPDATE brain_config SET token_limit = 8000  WHERE tier = 'pro';
UPDATE brain_config SET token_limit = 14000 WHERE tier = 'max';
```

- [ ] **Step 2: Apply the migration locally**

Run: `npx supabase migration up` (or the project's migration command — check `package.json` scripts; if a `db push` script exists prefer it)
Expected: table `brain_usage_events` created; `brain_config` shows pro=8000, max=14000.

- [ ] **Step 3: Verify the config values**

Run: `npx supabase db reset` is NOT needed — instead query: connect and `SELECT tier, token_limit, per_node_cap FROM brain_config ORDER BY tier;`
Expected: `free 2000 1000`, `max 14000 3000`, `pro 8000 2000`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260718100000_brain_usage_events.sql
git commit -m "feat(brain): add brain_usage_events table + pro/max tier limit change"
```

---

## Task 2: Pure usage-stats helper

Extract the bucketing logic into a pure function so it's testable without a DB. `getBrainUsageStats` (Task 3) fetches rows and delegates to this.

**Files:**
- Create: `src/lib/bot/services/brainUsageStats.ts`
- Test: `src/lib/bot/services/brainUsageStats.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/bot/services/brainUsageStats.test.ts`
Expected: FAIL — "computeUsageStats is not a function" / module not found.

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/bot/services/brainUsageStats.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/bot/services/brainUsageStats.test.ts`
Expected: PASS (all 6).

- [ ] **Step 5: Commit**

```bash
git add src/lib/bot/services/brainUsageStats.ts src/lib/bot/services/brainUsageStats.test.ts
git commit -m "feat(brain): pure usage-stats helper (requests/activeDays/streak/calendar)"
```

---

## Task 3: Backend — `setDefaultBrain`, `logBrainUsageEvent`, `getBrainUsageStats`, `resetBrainUsage`

**Files:**
- Modify: `src/lib/bot/services/brainStore.ts` (add functions near the other exported brain functions; `setDefaultBrain` after `getOrCreateDefaultBrain`, usage functions after `computeBrainVersion`)

- [ ] **Step 1: Add `setDefaultBrain`**

Insert after `getOrCreateDefaultBrain` (around line 90, after its closing brace):

```typescript
export async function setDefaultBrain(userId: string, brainId: string): Promise<{ success: true } | { error: string }> {
  if (!supabaseAdmin) return { error: 'Supabase not configured' }
  if (!(await assertOwnedBrain(userId, brainId))) return { error: `Brain '${brainId}' not found.` }
  // Two writes, not one atomic statement — brains.is_default has a unique
  // partial index (one default per user), so the old default must be cleared
  // before the new one is set or the unique index rejects the update.
  const { error: clearErr } = await supabaseAdmin.from('brains')
    .update({ is_default: false }).eq('user_id', userId).eq('is_default', true)
  if (clearErr) return { error: clearErr.message }
  const { error: setErr } = await supabaseAdmin.from('brains')
    .update({ is_default: true, updated_at: new Date().toISOString() })
    .eq('id', brainId).eq('user_id', userId)
  if (setErr) return { error: setErr.message }
  return { success: true }
}
```

- [ ] **Step 2: Add the usage functions**

Insert after `computeBrainVersion` (around line 217). Import the pure helper at the top of the file (add to the existing import block near line 5): `import { computeUsageStats } from './brainUsageStats'`

```typescript
export async function logBrainUsageEvent(userId: string, brainId: string): Promise<void> {
  if (!supabaseAdmin) return
  // Fire-and-forget; a failed log must never break the chat request.
  const { error } = await supabaseAdmin.from('brain_usage_events').insert({ user_id: userId, brain_id: brainId })
  if (error) logger.error('brain usage log failed:', error)
}

export async function getBrainUsageStats(userId: string, brainId: string) {
  if (!supabaseAdmin) return { requests: 0, activeDays: 0, streak: 0, calendar: [] }
  if (!(await assertOwnedBrain(userId, brainId))) return { requests: 0, activeDays: 0, streak: 0, calendar: [] }
  // ~6 months back, matching the calendar window in the panel.
  const since = new Date(Date.now() - 190 * 24 * 60 * 60 * 1000).toISOString()
  const { data } = await supabaseAdmin.from('brain_usage_events')
    .select('created_at').eq('user_id', userId).eq('brain_id', brainId)
    .gte('created_at', since).order('created_at', { ascending: true })
  return computeUsageStats((data ?? []) as { created_at: string }[], new Date())
}

export async function resetBrainUsage(userId: string, brainId: string): Promise<{ success: true } | { error: string }> {
  if (!supabaseAdmin) return { error: 'Supabase not configured' }
  if (!(await assertOwnedBrain(userId, brainId))) return { error: `Brain '${brainId}' not found.` }
  const { error } = await supabaseAdmin.from('brain_usage_events')
    .delete().eq('user_id', userId).eq('brain_id', brainId)
  if (error) return { error: error.message }
  return { success: true }
}
```

- [ ] **Step 3: Log a usage event on injection**

In `getBrainBlockForSession` (starts line 260), find where the compiled block is returned non-empty after a fresh (non-pinned) compile. Add a `logBrainUsageEvent(userId, brainId)` call there — fire-and-forget (do not await in a way that can throw; the function already swallows its own errors). Read the function body first to place it precisely: the log belongs wherever a non-empty block is actually produced for this request. Add:

```typescript
      // Track that this brain was injected (spec §3.5) — fire-and-forget.
      void logBrainUsageEvent(userId, brainId)
```

immediately before the `return` of the compiled block (both the pinned-hit and fresh-compile return paths that yield a non-empty block — a request that injects the brain counts regardless of cache state).

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors from `brainStore.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bot/services/brainStore.ts
git commit -m "feat(brain): setDefaultBrain + usage-event logging/stats/reset backend"
```

---

## Task 4: Expose `perNodeCap` in `listBrain`

**Files:**
- Modify: `src/lib/bot/services/brainStore.ts:486-494` (the `listBrain` return)
- Modify: `src/components/brain/canvas/useBrainData.ts` (`BrainCanvasState` — the `budget` interface neighborhood, line ~47)

- [ ] **Step 1: Add `perNodeCap` to the `listBrain` return**

In `listBrain` (line 468), `cfg` is already fetched (line 471). Add `perNodeCap` to the returned object:

```typescript
  return {
    brainId, nodes, edges, deletedNodes, availableWorkspaces,
    compiledPreview: compiled.compiled,
    budget: {
      used: compiled.tokenCount, limit: cfg.token_limit,
      dropped: compiled.droppedNodeIds, broken: compiled.brokenNodeIds,
    },
    perNodeTokens: compiled.perNodeTokens,
    perNodeCap: cfg.per_node_cap,
  }
```

- [ ] **Step 2: Add `perNodeCap` to `BrainCanvasState`**

In `useBrainData.ts`, find the `BrainCanvasState` interface (the one with `budget: { used; limit; dropped; broken }` and `perNodeTokens` near line 47). Add:

```typescript
  perNodeCap: number;
```

Then find where the fetched `listBrain` response is mapped into state and thread `perNodeCap` through (default to `2000` if absent, matching the pro default, so a stale server response never divides by zero). Read the mapping site and mirror how `perNodeTokens` is already carried.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. If TS complains that a consumer constructs `BrainCanvasState` without `perNodeCap`, add the field at that construction site with the fetched value (or `2000` fallback).

- [ ] **Step 4: Commit**

```bash
git add src/lib/bot/services/brainStore.ts src/components/brain/canvas/useBrainData.ts
git commit -m "feat(brain): expose per_node_cap to the canvas client"
```

---

## Task 5: API actions — `set_default_brain`, `brain_usage_stats`, `reset_brain_usage`

**Files:**
- Modify: `src/app/api/ai/user-brain/route.ts` (the `switch (body.action)` block, ~line 63; the import block, ~line 8)

- [ ] **Step 1: Import the new functions**

Add `setDefaultBrain, getBrainUsageStats, resetBrainUsage` to the existing import from `brainStore` at the top of the route.

- [ ] **Step 2: Add the three cases**

Follow the exact shape of the existing cases (e.g. `update_brain` at line 89). Insert alongside them:

```typescript
      case 'set_default_brain':
        return NextResponse.json(await setDefaultBrain(userId, body.brain_id))
      case 'brain_usage_stats':
        return NextResponse.json(await getBrainUsageStats(userId, body.brain_id))
      case 'reset_brain_usage':
        return NextResponse.json(await resetBrainUsage(userId, body.brain_id))
```

Match the surrounding cases for how `userId` and `body` fields are referenced (read lines 63–102 first to copy the exact variable names and response wrapper).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/ai/user-brain/route.ts
git commit -m "feat(brain): set_default_brain + usage stats/reset API actions"
```

---

## Task 6: `BrainLeftPanel` — compact view

Build the compact (always-visible) view first: brain name/switcher + budget bar + 4-stat grid. Reuse the existing floating-panel styling and the brain-list logic from `BrainPresetPicker`.

**Files:**
- Create: `src/components/brain/canvas/BrainLeftPanel.tsx`

- [ ] **Step 1: Read the components being replaced**

Read `src/components/brain/canvas/BrainPresetPicker.tsx` and `src/components/brain/canvas/BrainStatsPanel.tsx` in full. Copy their panel container classes (`bg-panel/98 backdrop-blur-xl border border-[var(--bone-12)] shadow-[...] rounded-[14px] canvas-floating-panel`), the brain-list dropdown logic, and the budget-bar gauge markup verbatim as the starting point.

- [ ] **Step 2: Write the compact panel**

Create `BrainLeftPanel.tsx`. Props: the current brain, the brain list, `budget` (`{ used, limit }`), node/edge counts, and the usage stats (`{ requests, activeDays }`, fetched via the `brain_usage_stats` action — pass in from the parent). Structure per spec §3.2:

- Row 1: brain icon + name (click → the same dropdown `BrainPresetPicker` renders; reuse that list, adding a "Set as default" and "Rename" action per row) + a chevron/expand toggle on the right.
- Row 2: budget bar (`used/limit`, percentage inline) — reuse `BrainStatsPanel`'s gauge markup.
- Row 3: a 4-cell grid — Nodes (`nodes.length`), Edges (`edges.length`), Active days (`stats.activeDays`), Requests (`stats.requests`).

Keep the expanded section behind an `expanded` state flag but render nothing for it yet (Task 7 fills it).

- [ ] **Step 3: Wire rename + set-default actions**

In the brain-list dropdown, each brain row gets:
- Rename → inline edit committing via the existing `update_brain` action (`updateBrainMeta` with `{ title }`; the route action already exists — confirm by reading line 89).
- Set as default → calls the new `set_default_brain` action, then refetches the brain list.

- [ ] **Step 4: Typecheck + eyeball**

Run: `npx tsc --noEmit`
Expected: no errors. (Visual verification happens in Task 8 once it's mounted.)

- [ ] **Step 5: Commit**

```bash
git add src/components/brain/canvas/BrainLeftPanel.tsx
git commit -m "feat(brain): BrainLeftPanel compact view (switcher + budget + stat grid)"
```

---

## Task 7: `BrainLeftPanel` — expanded analytics view

**Files:**
- Modify: `src/components/brain/canvas/BrainLeftPanel.tsx`

- [ ] **Step 1: Fetch full stats on expand**

When `expanded` becomes true, fetch `brain_usage_stats` (full: `streak`, `calendar`) if not already loaded. The compact view only needed `requests`/`activeDays`; the calendar/streak load lazily on first expand.

- [ ] **Step 2: Render the expanded sections (spec §3.4)**

Below the compact header, in order:
1. **Top 5 by usage** — the 5 nodes with the highest `perNodeTokens[id] / budget.limit`, as horizontal gradient bars with the percentage label inside the bar. Compute from props (`perNodeTokens`, `nodes`, `budget.limit`); no fetch.
2. **Priority distribution** — % of nodes at High/Medium/Low (map `priority` per `BrainNodeCard`'s existing thresholds: `<=1` high, `<=2` medium, else low), thin colored bars.
3. **Nodes by custom tag** — chip list, one per distinct `(tag_color, tag_name)` combo in use + an "Untagged" chip. (Depends on Part C's tag columns being present in node data; if Part C hasn't shipped, this section shows only "Untagged" — guard on `node.tag_color` existing.)
4. **Activity calendar** — GitHub-style grid from `stats.calendar`, 4 intensity levels via the cell's `level`.
5. **Reset statistics** — pinned at the very bottom, its own row. Calls `reset_brain_usage`, then refetches stats. Confirm before clearing.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/brain/canvas/BrainLeftPanel.tsx
git commit -m "feat(brain): BrainLeftPanel expanded analytics (top-5, priority, tags, calendar, reset)"
```

---

## Task 8: Mount `BrainLeftPanel`, remove old components

**Files:**
- Modify: `src/components/brain/canvas/BrainCanvasPage.tsx`

- [ ] **Step 1: Find the mount sites**

In `BrainCanvasPage.tsx`, locate where `<BrainPresetPicker .../>` (top-left) and `<BrainStatsPanel .../>` (top-right) are rendered. Note every prop each receives.

- [ ] **Step 2: Replace both with `BrainLeftPanel`**

Render a single `<BrainLeftPanel .../>` in the top-left slot, passing the union of props both old components needed (brain list, current brain, budget, nodes, edges, perNodeTokens, budget.limit). Remove the `<BrainStatsPanel .../>` render and the `<BrainPresetPicker .../>` render.

- [ ] **Step 3: Remove now-orphaned imports**

Delete the `BrainPresetPicker` and `BrainStatsPanel` imports if nothing else uses them. Leave the component files on disk (don't delete files — only remove YOUR orphaned imports, per CLAUDE.md §3). Grep to confirm no other importer:

Run: `git grep -n "BrainPresetPicker\|BrainStatsPanel" src/`
Expected: only the (now-removed) canvas page and the component files' own definitions remain.

- [ ] **Step 4: Typecheck + run the app**

Run: `npx tsc --noEmit` then start the dev server and open the brain canvas.
Expected: one left panel; compact view shows name/budget/stats; expanding reveals analytics; switching/renaming/set-default work; no top-right stats panel remains.

- [ ] **Step 5: Commit**

```bash
git add src/components/brain/canvas/BrainCanvasPage.tsx
git commit -m "feat(brain): mount BrainLeftPanel, retire separate switcher + stats panel"
```

---

## Self-Review Notes (Part A)

- **Spec coverage:** §3.2 (Task 6), §3.3 set-default/rename (Tasks 3,5,6), §3.4 expanded sections (Task 7), §3.5 usage tracking (Tasks 1–3), §3.6 tier change (Task 1), §3.8 perNodeCap exposure (Task 4). §3.7 (tag) is Part C — Task 7 §3.4-item-4 degrades gracefully until then.
- **Cross-plan dependency:** the "Nodes by custom tag" section (Task 7) reads `tag_color`/`tag_name`, added in Part C. Guarded so Part A ships standalone.
- **Type consistency:** `perNodeCap` added to both the `listBrain` return and `BrainCanvasState`; usage-stats shape (`{ requests, activeDays, streak, calendar }`) is identical in the pure helper, the store function, and the panel.
