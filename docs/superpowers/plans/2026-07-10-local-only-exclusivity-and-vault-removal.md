# Local-Only Desktop Exclusivity, Cloud Purge & Vault Removal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `local-only` a true desktop-exclusive mode — invisible on web, cascading to tasks, with a 48h-grace-period cloud purge via pg_cron — and fully remove the legacy vault/file-watcher system.

**Architecture:** Workspace-level sync-mode switch gains a confirm dialog and an explicit one-shot Supabase write (`markForPurge`) that stamps `purge_at` on all cascaded rows; an hourly pg_cron job hard-deletes expired rows server-side. Web filters `local-only` out of every read path. The Markdown vault (fileVault/vaultSyncBridge/syncFileScan + watcher + modals + settings UI) is deleted outright; SQLite is the sole local store.

**Tech Stack:** Next.js/React, Zustand, Supabase (Postgres + pg_cron), Electron, better-sqlite3, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-10-local-only-exclusivity-and-vault-removal-design.md`

---

## Execution Assignment & Protocol

Same protocol as the SQLite migration plan: each task ends with tests + `tsc --noEmit`; Claude independently re-verifies every externally-executed task (re-run real tests, inspect real diffs, grep for deleted symbols — never trust self-reports).

| Tier | Tasks | Assign to |
|---|---|---|
| A (mechanical) | 1 (SQL file), 8 (settings UI removal parts) | cheap model |
| B (moderate) | 2, 3, 5, 6 | mid model |
| C (hard / correctness-critical) | 4 (setSyncMode rework), 7 (retry queue), 8 (vault removal core — this exact class broke the build last time), 9 (final verify) | Claude |

**Verification protocol per task:** run the named tests, run `npx tsc --noEmit`, and for any deletion task run `grep -rn "<deleted symbol>" src/ electron/` and require zero hits before committing.

---

## Known facts the executor must not rediscover the hard way

- Web sync-mode dropdown ALREADY hides Local Only (`src/components/workspace/SpacePage.tsx:458-468`). Do not re-add it. What's missing is read-path filtering.
- All normal push paths are hard-suppressed for `local-only` (`if (x.syncMode !== 'local-only') debouncedPush...` throughout `store.ts`). `markForPurge`/`clearPurge` are the ONLY functions allowed to write `local-only` state to Supabase, and they bypass the debounced path on purpose.
- The bulk setters `setEntities`/`setTasks`/`setSpaces` must NEVER trigger a push (pull-echo invariant, tested in `src/data/store.debouncedPush.test.ts`). Don't touch them.
- Tasks do NOT cascade from entity deletion in Postgres (`tasks.entity_id` is `on delete set null`). The purge function must delete tasks explicitly, before entities.
- Workspaces are `entities` rows with `type='workspace'`, `parentId: null`. The separate `spaces` table is legacy (`ws-personal`); `setSyncMode` also flips a matching `spaces` row if ids collide — mirror that in the cloud calls for safety.
- Many test files mock `@/lib/env` with `isDesktop: () => false` (= web). New web-filter behavior will interact with existing fixtures; update fixtures rather than weakening assertions.
- Test count baseline: 258 passing. `npm test` = `vitest run`.

---

### Task 1: SQL migration — purge columns, purge function, pg_cron schedule

**Files:**
- Create: `supabase/migrations/20260710_local_only_purge.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- Local-only purge: rows marked local-only get a purge_at deadline;
-- an hourly pg_cron job hard-deletes them after the 48h grace window.

ALTER TABLE entities ADD COLUMN IF NOT EXISTS purge_at timestamptz;
ALTER TABLE tasks    ADD COLUMN IF NOT EXISTS purge_at timestamptz;
ALTER TABLE spaces   ADD COLUMN IF NOT EXISTS purge_at timestamptz;

CREATE INDEX IF NOT EXISTS entities_purge_at_idx ON entities(purge_at) WHERE purge_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS tasks_purge_at_idx    ON tasks(purge_at)    WHERE purge_at IS NOT NULL;

CREATE OR REPLACE FUNCTION purge_local_only_rows()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Tasks FIRST: tasks.entity_id is ON DELETE SET NULL, so they do NOT
  -- cascade when their entity is deleted. Deleting entities first would
  -- orphan the tasks instead of removing them.
  DELETE FROM tasks    WHERE purge_at IS NOT NULL AND purge_at < now();
  -- Entities: children cascade via parent_id ON DELETE CASCADE, so even a
  -- descendant that somehow missed its purge_at stamp is removed when the
  -- workspace root goes.
  DELETE FROM entities WHERE purge_at IS NOT NULL AND purge_at < now();
  DELETE FROM spaces   WHERE purge_at IS NOT NULL AND purge_at < now();
END;
$$;

-- Requires the pg_cron extension (Dashboard > Database > Extensions > enable "pg_cron").
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Hourly. Unschedule first so re-running the migration doesn't duplicate the job.
SELECT cron.unschedule('purge-local-only')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-local-only');

SELECT cron.schedule('purge-local-only', '0 * * * *', $$SELECT purge_local_only_rows()$$);
```

- [ ] **Step 2: Verify SQL syntax locally (no live DB needed)**

There is no local Postgres in this repo's toolchain; verification is by careful read + the user running it. Confirm: tasks deleted before entities; `WHERE purge_at IS NOT NULL` on every delete; unschedule-before-schedule guard present.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260710_local_only_purge.sql
git commit -m "feat(db): purge_at columns + pg_cron purge job for local-only rows"
```

**USER ACTION (at rollout, not blocking later tasks):** In Supabase Dashboard → Database → Extensions, enable `pg_cron`. Then SQL Editor → run this migration file. Verify with `SELECT * FROM cron.job;` — one row named `purge-local-only`.

---

### Task 2: `markForPurge` / `clearPurge` in sync.ts

**Files:**
- Modify: `src/lib/sync.ts` (append after `deleteTaskFromDB`, ~line 425)
- Test: `src/lib/sync.purge.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/sync.purge.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const updateCalls: Array<{ table: string; values: any; ids: string[] }> = [];

vi.mock('./supabaseClient', () => ({
  supabase: {
    from: (table: string) => ({
      update: (values: any) => ({
        in: (_col: string, ids: string[]) => {
          updateCalls.push({ table, values, ids });
          return Promise.resolve({ error: null });
        },
      }),
    }),
  },
  isSupabaseEnabled: true,
}));

import { markForPurge, clearPurge, PURGE_GRACE_MS } from './sync';

beforeEach(() => { updateCalls.length = 0; });

describe('markForPurge', () => {
  it('stamps sync_mode local-only and a future purge_at on entities and tasks', async () => {
    const before = Date.now();
    await markForPurge({ entityIds: ['e1', 'e2'], taskIds: ['t1'] });
    const ent = updateCalls.find(c => c.table === 'entities')!;
    const tsk = updateCalls.find(c => c.table === 'tasks')!;
    expect(ent.ids).toEqual(['e1', 'e2']);
    expect(tsk.ids).toEqual(['t1']);
    for (const c of [ent, tsk]) {
      expect(c.values.sync_mode).toBe('local-only');
      const purgeAt = new Date(c.values.purge_at).getTime();
      expect(purgeAt).toBeGreaterThanOrEqual(before + PURGE_GRACE_MS - 5000);
      expect(purgeAt).toBeLessThanOrEqual(Date.now() + PURGE_GRACE_MS + 5000);
    }
  });

  it('skips empty id lists entirely', async () => {
    await markForPurge({ entityIds: [], taskIds: [] });
    expect(updateCalls).toHaveLength(0);
  });
});

describe('clearPurge', () => {
  it('sets the new mode and nulls purge_at', async () => {
    await clearPurge({ entityIds: ['e1'], taskIds: ['t1'] }, 'full-sync');
    for (const c of updateCalls) {
      expect(c.values.sync_mode).toBe('full-sync');
      expect(c.values.purge_at).toBeNull();
    }
  });
});
```

Note: check the actual import path of the supabase client used inside `src/lib/sync.ts` (top of that file) and mock THAT module path; adjust the `vi.mock` target if it differs from `./supabaseClient`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/sync.purge.test.ts`
Expected: FAIL — `markForPurge` is not exported.

- [ ] **Step 3: Implement in `src/lib/sync.ts`**

```typescript
// ─── Local-only purge (grace period) ─────────────────────────────────────────
// These are the ONLY functions allowed to write local-only state to Supabase.
// Every normal push path is suppressed for local-only; without this explicit
// write the cloud row would silently keep its old sync_mode forever.

export const PURGE_GRACE_MS = 48 * 60 * 60 * 1000;

export interface PurgeTargets {
  entityIds: string[];
  taskIds: string[];
  spaceIds?: string[];
}

export async function markForPurge(targets: PurgeTargets): Promise<{ error: any }> {
  if (!supabase) return { error: null };
  const purgeAt = new Date(Date.now() + PURGE_GRACE_MS).toISOString();
  const values = { sync_mode: 'local-only', purge_at: purgeAt };
  const ops: Promise<{ error: any }>[] = [];
  if (targets.entityIds.length) ops.push(supabase.from('entities').update(values).in('id', targets.entityIds));
  if (targets.taskIds.length)   ops.push(supabase.from('tasks').update(values).in('id', targets.taskIds));
  if (targets.spaceIds?.length) ops.push(supabase.from('spaces').update(values).in('id', targets.spaceIds));
  const results = await Promise.all(ops);
  const firstError = results.find(r => r.error)?.error ?? null;
  if (firstError) console.error('[Flowr sync] markForPurge:', firstError.message);
  return { error: firstError };
}

export async function clearPurge(targets: PurgeTargets, newMode: 'cloud-only' | 'full-sync'): Promise<{ error: any }> {
  if (!supabase) return { error: null };
  const values = { sync_mode: newMode, purge_at: null };
  const ops: Promise<{ error: any }>[] = [];
  if (targets.entityIds.length) ops.push(supabase.from('entities').update(values).in('id', targets.entityIds));
  if (targets.taskIds.length)   ops.push(supabase.from('tasks').update(values).in('id', targets.taskIds));
  if (targets.spaceIds?.length) ops.push(supabase.from('spaces').update(values).in('id', targets.spaceIds));
  const results = await Promise.all(ops);
  const firstError = results.find(r => r.error)?.error ?? null;
  if (firstError) console.error('[Flowr sync] clearPurge:', firstError.message);
  return { error: firstError };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/sync.purge.test.ts` → PASS. Then `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sync.ts src/lib/sync.purge.test.ts
git commit -m "feat(sync): markForPurge/clearPurge one-shot cloud writes for local-only grace period"
```

---

### Task 3: Cascade-set helper (entities + tasks)

**Files:**
- Modify: `src/data/store.helpers.ts` (add after `getDescendantIds`, line 32)
- Test: `src/data/store.helpers.cascade.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```typescript
// src/data/store.helpers.cascade.test.ts
import { describe, it, expect } from 'vitest';
import { getSyncModeCascade } from './store.helpers';
import type { Entity, AppTask } from './store.types';

const e = (id: string, parentId: string | null, type = 'note'): Entity =>
  ({ id, parentId, type, title: id, lastModified: 0, syncMode: 'cloud-only', content: [] } as any);
const t = (id: string, entityId: string | null, spaceId: string | null = null): AppTask =>
  ({ id, entityId, spaceId, title: id, completed: false, lastModified: 0, syncMode: 'cloud-only' } as any);

describe('getSyncModeCascade', () => {
  const entities = [
    e('ws1', null, 'workspace'),
    e('f1', 'ws1', 'folder'),
    e('n1', 'f1'),          // nested note
    e('n2', 'ws1'),         // direct child
    e('other', null, 'workspace'),
    e('otherNote', 'other'),
  ];
  const tasks = [
    t('t1', 'n1'),           // task on nested note → included
    t('t2', 'ws1'),          // task on the workspace itself → included
    t('t3', 'otherNote'),    // other workspace → excluded
    t('t4', null),           // unassigned/global → excluded
    t('t5', null, 'ws1'),    // assigned via spaceId → included
  ];

  it('collects workspace, all descendant entities, and all associated tasks', () => {
    const result = getSyncModeCascade(entities, tasks, 'ws1');
    expect(result.entityIds.sort()).toEqual(['f1', 'n1', 'n2', 'ws1']);
    expect(result.taskIds.sort()).toEqual(['t1', 't2', 't5']);
  });

  it('handles a workspace with no children or tasks', () => {
    const result = getSyncModeCascade(entities, tasks, 'other');
    expect(result.entityIds.sort()).toEqual(['other', 'otherNote']);
    expect(result.taskIds).toEqual(['t3']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/store.helpers.cascade.test.ts`
Expected: FAIL — `getSyncModeCascade` is not exported.

- [ ] **Step 3: Implement in `store.helpers.ts`**

```typescript
import type { AppTask } from './store.types'; // merge into the existing type import at the top

/**
 * Full cascade set for a workspace-level sync-mode switch: the workspace
 * entity, every descendant entity, and every task tied to any of them
 * (via entityId) or to the workspace directly (via spaceId).
 * Unassigned tasks (no entityId, no matching spaceId) are NOT included.
 */
export function getSyncModeCascade(
  entities: Entity[],
  tasks: AppTask[],
  workspaceId: string
): { entityIds: string[]; taskIds: string[] } {
  const entityIds = [workspaceId, ...getDescendantIds(entities, workspaceId)];
  const entitySet = new Set(entityIds);
  const taskIds = tasks
    .filter(t => (t.entityId && entitySet.has(t.entityId)) || t.spaceId === workspaceId)
    .map(t => t.id);
  return { entityIds, taskIds };
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run src/data/store.helpers.cascade.test.ts` → PASS. `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/data/store.helpers.ts src/data/store.helpers.cascade.test.ts
git commit -m "feat(store): getSyncModeCascade — entities + tasks cascade for workspace mode switch"
```

---

### Task 4: Rework `setSyncMode` — task cascade, purge calls, drop vault block

**Files:**
- Modify: `src/data/store.ts:191-240` (the `setSyncMode` action)
- Test: `src/data/store.setSyncMode.test.ts` (exists — extend)

- [ ] **Step 1: Read the existing test file** `src/data/store.setSyncMode.test.ts` to match its setup style, then add failing tests:

```typescript
// Add to src/data/store.setSyncMode.test.ts — adapt store setup to the file's existing pattern.
// Mock '@/lib/sync' so markForPurge/clearPurge are spies:
//   vi.mock('@/lib/sync', async (importOriginal) => ({
//     ...(await importOriginal<any>()),
//     markForPurge: vi.fn().mockResolvedValue({ error: null }),
//     clearPurge: vi.fn().mockResolvedValue({ error: null }),
//     upsertEntity: vi.fn().mockResolvedValue({ error: null }),
//     upsertTask: vi.fn().mockResolvedValue({ error: null }),
//     upsertSpace: vi.fn().mockResolvedValue({ error: null }),
//   }));

it('switching workspace to local-only flips tasks in the cascade too', async () => {
  // seed: workspace ws1 > note n1; task t1 with entityId n1; task t2 unassigned
  await useStore.getState().setSyncMode('ws1', 'local-only');
  const s = useStore.getState();
  expect(s.tasks.find(t => t.id === 't1')!.syncMode).toBe('local-only');
  expect(s.tasks.find(t => t.id === 't2')!.syncMode).toBe('cloud-only'); // untouched
});

it('switching to local-only calls markForPurge with the full cascade, not the push path', async () => {
  const { markForPurge } = await import('@/lib/sync');
  await useStore.getState().setSyncMode('ws1', 'local-only');
  expect(markForPurge).toHaveBeenCalledWith(
    expect.objectContaining({
      entityIds: expect.arrayContaining(['ws1', 'n1']),
      taskIds: ['t1'],
    })
  );
});

it('switching back to full-sync calls clearPurge and resumes normal push', async () => {
  const { clearPurge } = await import('@/lib/sync');
  await useStore.getState().setSyncMode('ws1', 'local-only');
  await useStore.getState().setSyncMode('ws1', 'full-sync');
  expect(clearPurge).toHaveBeenCalledWith(
    expect.objectContaining({ entityIds: expect.arrayContaining(['ws1']) }),
    'full-sync'
  );
  expect(useStore.getState().tasks.find(t => t.id === 't1')!.syncMode).toBe('full-sync');
});
```

- [ ] **Step 2: Run to verify failures**

Run: `npx vitest run src/data/store.setSyncMode.test.ts`
Expected: new tests FAIL (tasks not cascaded; markForPurge never called).

- [ ] **Step 3: Replace the `setSyncMode` body**

```typescript
setSyncMode: async (entityId, mode) => {
  const { getSyncModeCascade } = await import('./store.helpers');
  const { entityIds, taskIds } = getSyncModeCascade(get().entities, get().tasks, entityId);
  const entitySet = new Set(entityIds);
  const taskSet = new Set(taskIds);
  const now = Date.now();

  set(s => ({
    entities: s.entities.map(e => entitySet.has(e.id) ? { ...e, syncMode: mode, lastModified: now } : e),
    tasks:    s.tasks.map(t => taskSet.has(t.id) ? { ...t, syncMode: mode, lastModified: now } : t),
    spaces:   s.spaces.map(w => w.id === entityId ? { ...w, syncMode: mode, lastModified: now } : w)
  }));

  const spaceIds = get().spaces.some(w => w.id === entityId) ? [entityId] : [];

  if (mode === 'local-only') {
    // Explicit one-shot cloud write: stamps sync_mode + purge_at on the rows.
    // The normal push path is suppressed for local-only and must stay that way.
    const { markForPurge } = await import('@/lib/sync');
    const { error } = await markForPurge({ entityIds, taskIds, spaceIds });
    if (error) get().queuePendingModeWrite({ entityIds, taskIds, spaceIds, action: 'purge', mode });
  } else {
    // Cancels a pending purge if one exists (purge_at → NULL) and sets the new
    // mode. If the grace period already expired and rows are gone, the pushes
    // below recreate them from local state.
    const { clearPurge } = await import('@/lib/sync');
    const { error } = await clearPurge({ entityIds, taskIds, spaceIds }, mode);
    if (error) get().queuePendingModeWrite({ entityIds, taskIds, spaceIds, action: 'clear', mode });

    const fresh = get();
    for (const id of entityIds) {
      const e = fresh.entities.find(x => x.id === id);
      if (e) debouncedPushEntity(e);
    }
    for (const id of taskIds) {
      const t = fresh.tasks.find(x => x.id === id);
      if (t) debouncedPushTask(t);
    }
    const ws = fresh.spaces.find(w => w.id === entityId);
    if (ws) debouncedPushSpace(ws);
  }
},
```

Notes for the executor:
- This DELETES the old vault stale-file block (`syncFileScan` import, `openModal({ kind: 'syncFileCleanup', ... })`) and the old `saveEntity` loop — the debounced pushes above replace it for cloud modes; for local-only nothing may push.
- `queuePendingModeWrite` is defined in Task 7. If executing tasks in order, add a temporary no-op action `queuePendingModeWrite: () => {}` to the store (and its type to `AppState` in `store.types.ts`: `queuePendingModeWrite: (w: PendingModeWrite) => void;`) so this task compiles; Task 7 replaces it. Define the type now in `store.types.ts`:

```typescript
export interface PendingModeWrite {
  entityIds: string[];
  taskIds: string[];
  spaceIds: string[];
  action: 'purge' | 'clear';
  mode: SyncMode;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/data/store.setSyncMode.test.ts` → all PASS (old tests may need fixture updates if they asserted the `saveEntity` loop — update them to assert debounced pushes / markForPurge instead; do not delete assertions without replacing them).
Then: `npx vitest run` → full suite green. `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/data/store.ts src/data/store.types.ts src/data/store.setSyncMode.test.ts
git commit -m "feat(store): setSyncMode cascades to tasks and drives cloud purge/clear writes"
```

---

### Task 5: Confirmation modal for going local-only

**Files:**
- Modify: `src/data/store.types.ts:233-246` (ModalType union)
- Create: `src/components/modals/LocalOnlyConfirmModal.tsx`
- Modify: `src/components/layout/Shell.tsx` (mount, near lines 510-511)
- Modify: `src/components/workspace/SpacePage.tsx:472-483` (intercept local-only selection)
- Test: `src/components/modals/LocalOnlyConfirmModal.test.tsx` (create)

- [ ] **Step 1: Add the modal kind**

In `store.types.ts` ModalType union add:

```typescript
| { kind: 'localOnlyConfirm'; workspaceId: string }
```

- [ ] **Step 2: Write the failing test**

```typescript
// src/components/modals/LocalOnlyConfirmModal.test.tsx
import { describe, it, expect } from 'vitest';
import { buildLocalOnlyConfirmText } from './LocalOnlyConfirmModal';

describe('buildLocalOnlyConfirmText', () => {
  it('reports item and task counts', () => {
    expect(buildLocalOnlyConfirmText(5, 3)).toContain('5 items');
    expect(buildLocalOnlyConfirmText(5, 3)).toContain('3 tasks');
    expect(buildLocalOnlyConfirmText(5, 3)).toContain('48 hours');
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/components/modals/LocalOnlyConfirmModal.test.tsx` → FAIL (module not found).

- [ ] **Step 4: Implement the modal**

Follow the structure/styling of `src/components/modals/SyncFileCleanupModal.tsx` (glass panel, store-driven open state) — read it first; it is deleted in Task 8 but is the house pattern reference. Core:

```tsx
// src/components/modals/LocalOnlyConfirmModal.tsx
"use client";
import { useStore } from '@/data/store';
import { getSyncModeCascade } from '@/data/store.helpers';

export function buildLocalOnlyConfirmText(entityCount: number, taskCount: number): string {
  return `This workspace and everything in it (${entityCount} items, ${taskCount} tasks) will be removed from the cloud in 48 hours and will only exist on this device. You can undo this by switching back to a cloud mode within 48 hours.`;
}

export function LocalOnlyConfirmModal() {
  const modal = useStore(s => s.activeModal);
  const closeModal = useStore(s => s.closeModal);
  const setSyncMode = useStore(s => s.setSyncMode);
  const entities = useStore(s => s.entities);
  const tasks = useStore(s => s.tasks);

  if (!modal || modal.kind !== 'localOnlyConfirm') return null;
  const { entityIds, taskIds } = getSyncModeCascade(entities, tasks, modal.workspaceId);

  return (
    /* glass overlay + panel per house pattern */
    <div /* ... */>
      <p>{buildLocalOnlyConfirmText(entityIds.length, taskIds.length)}</p>
      <button onClick={closeModal}>Cancel</button>
      <button
        onClick={async () => {
          closeModal();
          await setSyncMode(modal.workspaceId, 'local-only');
        }}
      >
        Switch to Local Only
      </button>
    </div>
  );
}
```

(Check the store's actual modal state/action names — grep `activeModal|closeModal|openModal` in `store.ts` and use exactly those.)

- [ ] **Step 5: Wire into SpacePage**

In the dropdown option `onClick` (`SpacePage.tsx:472`), intercept local-only:

```typescript
onClick={async () => {
  setShowSyncPicker(false);
  if (syncPending) return;
  if (mode === 'local-only') {
    openModal({ kind: 'localOnlyConfirm', workspaceId: entity.id });
    return;
  }
  setSyncPending(true);
  try {
    await setSyncMode(entity.id, mode as any);
  } catch (err) {
    console.error('[Flowr] set sync mode failed:', err);
  } finally {
    setSyncPending(false);
  }
}}
```

(Add `const openModal = useStore(state => state.openModal);` beside the existing store hooks at `SpacePage.tsx:234-239`.)

Also update the dropdown `desc` strings — they still say "Local file" from the vault era: `full-sync` → `'On this device + cloud'`, `local-only` → `'This device only — leaves the cloud'`, `cloud-only` → `'Cloud only'`.

- [ ] **Step 6: Mount in Shell** — next to the other modals (`Shell.tsx:510-511`): `<LocalOnlyConfirmModal key="local-only-confirm" />` + import.

- [ ] **Step 7: Run tests + typecheck**

`npx vitest run src/components/modals/LocalOnlyConfirmModal.test.tsx` → PASS. `npx tsc --noEmit` → clean.

- [ ] **Step 8: Commit**

```bash
git add src/components/modals/LocalOnlyConfirmModal.tsx src/components/modals/LocalOnlyConfirmModal.test.tsx src/components/workspace/SpacePage.tsx src/components/layout/Shell.tsx src/data/store.types.ts
git commit -m "feat(ui): confirmation modal before switching a workspace to local-only"
```

---

### Task 6: Web read-path filtering of local-only rows

**Files:**
- Modify: `src/lib/sync.ts:239-276` (`loadFromSupabase`), plus the realtime subscribe handler in the same file (grep `subscribeRealtime`)
- Modify: `src/components/SupabaseProvider.tsx` (`mergeCloudData`)
- Test: `src/lib/sync.webFilter.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/sync.webFilter.test.ts
import { describe, it, expect } from 'vitest';
import { filterLocalOnlyForWeb } from './sync';

const mk = (id: string, syncMode: string) => ({ id, syncMode } as any);

describe('filterLocalOnlyForWeb', () => {
  it('drops local-only rows on web', () => {
    const rows = [mk('a', 'cloud-only'), mk('b', 'local-only'), mk('c', 'full-sync')];
    expect(filterLocalOnlyForWeb(rows, false).map(r => r.id)).toEqual(['a', 'c']);
  });
  it('keeps everything on desktop', () => {
    const rows = [mk('a', 'cloud-only'), mk('b', 'local-only')];
    expect(filterLocalOnlyForWeb(rows, true).map(r => r.id)).toEqual(['a', 'b']);
  });
});
```

- [ ] **Step 2: Run to verify failure** → FAIL (not exported).

- [ ] **Step 3: Implement**

In `sync.ts`:

```typescript
// Web must never see local-only rows. They can still exist in Supabase during
// the 48h purge grace window; this filter is the safety net for that window.
export function filterLocalOnlyForWeb<T extends { syncMode: string }>(rows: T[], desktop: boolean): T[] {
  return desktop ? rows : rows.filter(r => r.syncMode !== 'local-only');
}
```

Apply in `loadFromSupabase`'s return (import `isDesktop` from `./env`):

```typescript
const desktop = isDesktop();
return {
  entities: filterLocalOnlyForWeb((entityRows ?? []).map(rowToEntity), desktop),
  tasks:    filterLocalOnlyForWeb((taskRows   ?? []).map(rowToTask),   desktop),
  spaces:   filterLocalOnlyForWeb((workspaceRows ?? []).map(rowToWorkspace), desktop),
  settings,
};
```

Then find `subscribeRealtime` in `sync.ts` and, in its INSERT/UPDATE row handlers, drop the event when `!isDesktop() && row.sync_mode === 'local-only'` (for UPDATE to local-only on web, treat it as a delete — remove the item from state, since it just became invisible). Show the actual handler code in the diff; if the handler shape makes "treat as delete" non-trivial, removing-by-filter via the setter is acceptable.

In `mergeCloudData` (`SupabaseProvider.tsx`), after the merge computes final arrays, add on web: filter `syncMode === 'local-only'` out of the merged entities/tasks/spaces before the bulk setters. Guard with `isWeb()` (import from `@/lib/env`) so desktop behavior is untouched.

- [ ] **Step 4: Run tests**

`npx vitest run src/lib/sync.webFilter.test.ts` → PASS.
`npx vitest run` full suite → some `mergeCloudData` tests mock `isDesktop: () => false` and may now drop local-only fixtures — update those fixtures to cloud modes where the local-only-ness was incidental, keep/adjust assertions where it was the point. `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sync.ts src/lib/sync.webFilter.test.ts src/components/SupabaseProvider.tsx
git commit -m "feat(sync): web never loads or merges local-only rows"
```

---

### Task 7: Offline retry queue for purge/clear cloud writes

**Files:**
- Modify: `src/data/store.ts` (real `queuePendingModeWrite` + persisted `pendingModeWrites` state; check `partialize` to include it)
- Modify: `src/components/SupabaseProvider.tsx` (drain queue after boot hydration)
- Test: `src/data/store.pendingModeWrites.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```typescript
// src/data/store.pendingModeWrites.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('@/lib/env', () => ({ isDesktop: () => true, isWeb: () => false }));
import { useStore } from './store';
import { drainPendingModeWrites } from './store';

describe('pending mode writes queue', () => {
  beforeEach(() => useStore.setState({ pendingModeWrites: [] }));

  it('queuePendingModeWrite appends', () => {
    useStore.getState().queuePendingModeWrite({ entityIds: ['e1'], taskIds: [], spaceIds: [], action: 'purge', mode: 'local-only' });
    expect(useStore.getState().pendingModeWrites).toHaveLength(1);
  });

  it('drain retries each write and removes successes', async () => {
    const markForPurge = vi.fn().mockResolvedValue({ error: null });
    const clearPurge = vi.fn().mockResolvedValue({ error: null });
    useStore.setState({ pendingModeWrites: [
      { entityIds: ['e1'], taskIds: [], spaceIds: [], action: 'purge', mode: 'local-only' },
      { entityIds: ['e2'], taskIds: ['t1'], spaceIds: [], action: 'clear', mode: 'full-sync' },
    ]});
    await drainPendingModeWrites({ markForPurge, clearPurge });
    expect(markForPurge).toHaveBeenCalledTimes(1);
    expect(clearPurge).toHaveBeenCalledWith(expect.objectContaining({ entityIds: ['e2'] }), 'full-sync');
    expect(useStore.getState().pendingModeWrites).toHaveLength(0);
  });

  it('drain keeps failed writes queued', async () => {
    const markForPurge = vi.fn().mockResolvedValue({ error: { message: 'offline' } });
    useStore.setState({ pendingModeWrites: [
      { entityIds: ['e1'], taskIds: [], spaceIds: [], action: 'purge', mode: 'local-only' },
    ]});
    await drainPendingModeWrites({ markForPurge, clearPurge: vi.fn() });
    expect(useStore.getState().pendingModeWrites).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify failure** → FAIL.

- [ ] **Step 3: Implement**

In `store.ts`: add `pendingModeWrites: []` to initial state, the real action, and an exported drain function:

```typescript
queuePendingModeWrite: (w) => set(s => ({ pendingModeWrites: [...s.pendingModeWrites, w] })),
```

```typescript
// Module-level export in store.ts (alongside the store):
export async function drainPendingModeWrites(fns?: {
  markForPurge: (t: import('@/lib/sync').PurgeTargets) => Promise<{ error: any }>;
  clearPurge: (t: import('@/lib/sync').PurgeTargets, m: 'cloud-only' | 'full-sync') => Promise<{ error: any }>;
}): Promise<void> {
  const pending = useStore.getState().pendingModeWrites;
  if (pending.length === 0) return;
  const sync = fns ?? await import('@/lib/sync');
  const stillPending: typeof pending = [];
  for (const w of pending) {
    const { error } = w.action === 'purge'
      ? await sync.markForPurge({ entityIds: w.entityIds, taskIds: w.taskIds, spaceIds: w.spaceIds })
      : await sync.clearPurge({ entityIds: w.entityIds, taskIds: w.taskIds, spaceIds: w.spaceIds }, w.mode as 'cloud-only' | 'full-sync');
    if (error) stillPending.push(w);
  }
  useStore.setState({ pendingModeWrites: stillPending });
}
```

Add `pendingModeWrites: PendingModeWrite[];` to `AppState` in `store.types.ts`. Check the persist `partialize` in `store.ts` — if it whitelists keys, add `pendingModeWrites`; if it blacklists, verify it survives.

In `SupabaseProvider.tsx`, after the Supabase initial load completes (right after `setInitialSync(false)` at ~line 341): `import('@/data/store').then(({ drainPendingModeWrites }) => drainPendingModeWrites());`

- [ ] **Step 4: Run tests** → new file PASS, full suite green, `tsc --noEmit` clean.

- [ ] **Step 5: Commit**

```bash
git add src/data/store.ts src/data/store.types.ts src/data/store.pendingModeWrites.test.ts src/components/SupabaseProvider.tsx
git commit -m "feat(store): persist and retry failed purge/clear cloud writes"
```

---

### Task 8: Vault/file-watcher removal

**Files:**
- Delete: `src/lib/fileVault.ts`, `src/lib/vaultSyncBridge.ts`, `src/lib/syncFileScan.ts`, `src/lib/syncFileScan.test.ts`, `src/components/modals/VaultSetupModal.tsx`, `src/components/modals/SyncFileCleanupModal.tsx`
- Modify: `src/lib/persistence.ts` (delete `saveEntityToFile` + its imports; keep `saveEntity`)
- Modify: `src/components/layout/Shell.tsx:17-18,510-511` (remove imports + mounts)
- Modify: `src/components/layout/ContextMenu.tsx:457-489` (remove "Show in Explorer" / "Open local file" block + now-unused `FolderOpen`/`File` icon imports if unreferenced elsewhere in the file)
- Modify: `src/components/modals/SettingsModal.tsx` (~lines 60-70, 287-290: vaultPath state, fileVault imports, Vault Directory section)
- Modify: `src/components/settings/SettingsPage.tsx` (~lines 72-79: same)
- Modify: `src/components/SupabaseProvider.tsx` (delete `scanForStaleLocalFiles` fn at ~131 and its call at ~342; delete fs-watcher block at ~356-367 and the `unsubscribeFsWatcher` cleanup in the effect teardown)
- Modify: `src/data/store.types.ts:245` (remove `syncFileCleanup` modal kind)
- Modify: `electron/main.js` (~370-429: `vaultWatcher`, `getStoredVaultPath`, `startWatchingVault`, initial-watch call; plus all `fs:`/vault IPC handlers with no remaining renderer callers)
- Modify: `electron/preload.js` (remove the `flowrFS` bridge if zero renderer references remain)

**Order matters: delete consumers before providers, keep `tsc` green at every commit.**

- [ ] **Step 1: Remove UI consumers** — Shell mounts/imports, ContextMenu block, SettingsModal + SettingsPage vault sections, `syncFileCleanup` modal kind from `store.types.ts`. Run `npx tsc --noEmit` → clean.

- [ ] **Step 2: Remove SupabaseProvider wiring** — `scanForStaleLocalFiles` (definition + call), fs-watcher block + its teardown. `npx tsc --noEmit` → clean.

- [ ] **Step 3: Trim persistence.ts** to only:

```typescript
import { Entity } from '@/data/store.types';

export async function saveEntity(entity: Entity): Promise<void> {
  if (entity.syncMode === 'cloud-only' || entity.syncMode === 'full-sync') {
    const { upsertEntity } = await import('@/lib/sync');
    await upsertEntity(entity);
  }
}
```

Check first: `grep -rn "saveEntity" src/` — if Task 4 removed the last caller of `saveEntity` too, delete `persistence.ts` entirely instead and remove its importers.

- [ ] **Step 4: Delete the lib/modal files**

```bash
git rm src/lib/fileVault.ts src/lib/vaultSyncBridge.ts src/lib/syncFileScan.ts src/lib/syncFileScan.test.ts src/components/modals/VaultSetupModal.tsx src/components/modals/SyncFileCleanupModal.tsx
```

- [ ] **Step 5: Grep-verify zero remaining references (the Task-14 lesson)**

```bash
grep -rn "fileVault\|vaultSyncBridge\|syncFileScan\|saveEntityToFile\|VaultSetupModal\|SyncFileCleanupModal\|scanForStaleLocalFiles\|handleLocalFileChanged\|syncFileCleanup" src/ electron/
```

Expected: zero hits. `noUnusedLocals` is OFF in this tsconfig — `tsc` will NOT catch dead imports; the grep is the real check.

- [ ] **Step 6: Clean electron side** — in `main.js` remove `vaultWatcher`/`getStoredVaultPath`/`startWatchingVault`/initial-watch call and the `fs:file-changed` send. Then for each `fs:*`/vault IPC handler (`fs:readFile`, `fs:writeFile`, `fs:deleteFile`, `fs:getVaultPath`, `fs:setVaultPath`, `fs:pickVaultFolder`, `fs:getDefaultVaultPath`, `fs:readdir`, `fs:listAllFiles`, `fs:showItemInFolder`, `fs:openPath` — enumerate what actually exists in the file): `grep -rn "<channel>" src/` and remove the handler only on zero hits. If ALL are removable, also remove the `flowrFS` bridge from `preload.js` (`grep -rn "flowrFS" src/` must be zero first). User vault folders on disk are never touched.

- [ ] **Step 7: Full verification**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: clean, full suite green (count will drop by the deleted `syncFileScan.test.ts` tests — note the new baseline).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: remove legacy vault/file-watcher system — SQLite is the sole local store"
```

---

### Task 9: End-to-end verification + production build

**Files:** none (verification only)

- [ ] **Step 1: Full suite + typecheck** — `npx vitest run && npx tsc --noEmit` → green/clean.

- [ ] **Step 2: Re-verify the pull-echo invariant** — `npx vitest run src/data/store.debouncedPush.test.ts src/components/SupabaseProvider.bootHydration.test.ts` → PASS (these guard the invariants most at risk from the setSyncMode/mergeCloudData edits).

- [ ] **Step 3: Grep audit** — rerun the Task 8 Step 5 grep + `grep -rn "local-only" src/lib/sync.ts` and confirm the only Supabase writes of `local-only` are inside `markForPurge`.

- [ ] **Step 4: Production build smoke** — `npm run electron:build`, launch the packaged app, confirm: boots (no missing-module errors), no VaultSetupModal/cleanup popups, Settings has no Vault Directory, workspace dropdown shows all 3 modes, switching to Local Only shows the confirm dialog.

- [ ] **Step 5: Rollout note** — remind the user to run `supabase/migrations/20260710_local_only_purge.sql` (Task 1 USER ACTION) before shipping; until then, `markForPurge` fails on the missing `purge_at` column and writes land in the retry queue — harmless but purge won't happen.

- [ ] **Step 6: Final commit if any fixups**

```bash
git add -A && git commit -m "chore: verification fixups for local-only exclusivity + vault removal"
```

---

## Self-review notes (spec → plan coverage)

- Spec A (web filter): Task 6. Dropdown already web-correct (verified in code, noted).
- Spec B (confirm + grace + explicit cloud write + task cascade): Tasks 2, 3, 4, 5.
- Spec C (cancellation + post-expiry re-upload): Task 4 (`clearPurge` + debounced re-push path).
- Spec D (pg_cron purge, tasks-before-entities, spaces column): Task 1.
- Spec E (vault removal, incl. `flowrFS` audit and on-disk files untouched): Task 8.
- Spec limitation "offline retry queue": Task 7.
- Single-device limitation: UI copy in Task 5's confirm text ("only exist on this device").
