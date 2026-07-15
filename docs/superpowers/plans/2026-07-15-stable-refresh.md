# Stable Refresh Implementation Plan

> **STATUS (2026-07-16):** Scope 1 ✅ done + committed (incl. SSR-hydration fix). Scope 3 ✅ done + committed (Tasks 4–6). Scope 2 ✅ done + committed (Tasks 7–13) — 459 tests pass, tsc clean. Scope 2 needs manual multi-space cloud smoke-test (node-env tests can't drive the boot effect; see Task 12 commit). A separate Scope 4 (zero-flash tab SSR) is specced in `docs/superpowers/specs/2026-07-15-zero-flash-shell-ssr-design.md`, not yet planned.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make browser refresh stable — stay on the same page, no skeleton shimmer over already-cached data, keep recents/shortcuts from disappearing, and (cloud path only) fetch only changed rows.

**Architecture:** Three independent scopes shipped in sequence. Scope 1 (client render) removes an artificial loading gate so cached data paints instantly. Scope 3 (cloud settings merge) makes boot-time cloud sync non-destructive to local recents/shortcuts/tabs via a union. Scope 2 (delta sync) replaces the full-table boot fetch with a changed-rows-plus-ID-list diff. Free/local-only desktop users never execute Scope 2 or 3.

**Tech Stack:** Next.js (App Router) + React, Zustand (`persist` middleware, synchronous localStorage), Supabase (cloud path), SQLite (desktop), Vitest (`environment: node`).

**Reference spec:** `docs/superpowers/specs/2026-07-15-stable-refresh-design.md`

**Ship order:** Scope 1 → Scope 3 → Scope 2. Each scope is independently shippable; Scope 1 delivers the felt "instant" win alone.

---

## File Structure

**Scope 1 — instant render:**
- Modify: `src/hooks/useAppReady.ts` — remove 600ms timer + `isMounted` gate; base readiness on `storeHydrated`.
- Modify: `src/components/EntityPageRenderer.tsx` — remove page-type-guessing fallback (lines 48–57).
- Modify: `src/components/WorkspaceRouter.tsx` — use `initialEntityId` prop as render seed.

**Scope 3 — non-destructive cloud settings merge:**
- Modify: `src/components/SupabaseProvider.tsx` — replace raw recents/shortcuts/ui_state overwrites in `mergeCloudData` with unions; helper functions for the union logic.
- Test: `src/components/SupabaseProvider.settingsMerge.test.ts` (new).

**Scope 2 — delta sync:**
- Modify: `src/lib/sync.ts` — add `loadDeltaFromSupabase(cursors)` returning changed rows + all-ID sets; keep `loadFromSupabase` for first-ever load.
- Modify: `src/components/SupabaseProvider.tsx` — call delta loader on boot when a cursor exists; split `mergeCloudData` deletion handling to use explicit ID sets.
- Modify: `src/data/store.ts` — add `syncCursors` state + persist it.
- Test: `src/lib/sync.delta.test.ts` (new), `src/components/SupabaseProvider.deltaMerge.test.ts` (new).

**Test conventions (match existing):** node environment, `vi.mock('@/lib/sync', ...)` and `vi.mock('@/lib/supabase', ...)` at top, drive `mergeCloudData` by setting `useStore.setState(...)` then asserting `useStore.getState()`. See `src/components/SupabaseProvider.mergeCloudData.test.ts` and `src/lib/sync.test.ts`.

---

# SCOPE 1 — Instant cached render

### Task 1: Remove the artificial readiness gate in `useAppReady`

**Files:**
- Modify: `src/hooks/useAppReady.ts`

- [ ] **Step 1: Replace the hook implementation**

Replace the entire contents of `src/hooks/useAppReady.ts` with:

```typescript
import { useState, useEffect } from 'react';
import { useStore } from '@/data/store';

/**
 * Readiness = the persisted Zustand store has hydrated from localStorage.
 * Because the persist storage adapter is synchronous localStorage, hasHydrated()
 * is effectively true on the first render, so cached data paints immediately with
 * no artificial delay. The onFinishHydration fallback covers the rare async case.
 */
export function useAppReady() {
  const [storeHydrated, setStoreHydrated] = useState(() => useStore.persist.hasHydrated());

  useEffect(() => {
    if (useStore.persist.hasHydrated()) {
      setStoreHydrated(true);
      return;
    }
    const unsub = useStore.persist.onFinishHydration(() => setStoreHydrated(true));
    return unsub;
  }, []);

  return {
    isReady: storeHydrated,
    storeHydrated,
  };
}
```

- [ ] **Step 2: Verify no other symbol from this file is imported elsewhere**

Run: `grep -rn "MINIMUM_LOADING_TIME\|globalMinTimePassed\|globalAppMounted" src/`
Expected: no matches outside the old file (all were module-internal). If any appear, they are stale references to delete.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors referencing `useAppReady`.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useAppReady.ts
git commit -m "fix(refresh): remove artificial 600ms loading gate in useAppReady"
```

---

### Task 2: Remove the page-type-guessing fallback in `EntityPageRenderer`

**Files:**
- Modify: `src/components/EntityPageRenderer.tsx:48-62`

- [ ] **Step 1: Replace the `!entity` block**

In `src/components/EntityPageRenderer.tsx`, replace this block (currently lines 48–63):

```tsx
  if (!entity) {
    if (isLoading) {
      // If we don't even know the entity type yet, we can't render the exact page.
      // We will fallback to the Space skeleton (like UnifiedAppSkeleton does) to avoid layout shifts
      const isSpace = entityId !== 'dashboard' && entityId !== 'chat' && entityId !== 'tracker' && entityId !== 'settings';
      if (isSpace) {
        return <SpacePage entity={{ id: entityId, title: 'Loading...', type: 'workspace', syncMode: 'full-sync', lastModified: Date.now() } as any} isLoading={true} />;
      }
      return <Dashboard isLoading={true} />;
    }
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Select an item from the sidebar.
      </div>
    );
  }
```

with:

```tsx
  if (!entity) {
    // Store is hydrated (isLoading is instant now — see useAppReady). A missing
    // entity here genuinely means the id resolves to nothing, so show the empty
    // state rather than guessing a page type and flashing the wrong layout.
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Select an item from the sidebar.
      </div>
    );
  }
```

- [ ] **Step 2: Remove now-unused imports if the linter flags them**

Run: `npx tsc --noEmit && npx next lint --file src/components/EntityPageRenderer.tsx`
Expected: PASS. `Dashboard` and `SpacePage` are still used by the system-route branches above (lines 32–33, 71), so no import removal is expected — but if lint reports an unused import, delete only that import line.

- [ ] **Step 3: Commit**

```bash
git add src/components/EntityPageRenderer.tsx
git commit -m "fix(refresh): stop guessing page type on cold render (wrong-component flash)"
```

---

### Task 3: Seed `WorkspaceRouter` from the `initialEntityId` cookie

**Files:**
- Modify: `src/components/WorkspaceRouter.tsx`

- [ ] **Step 1: Use the prop as the initial render target**

In `src/components/WorkspaceRouter.tsx`, change the component body. Currently:

```tsx
export const WorkspaceRouter = memo(function WorkspaceRouter({ initialEntityId }: { initialEntityId?: string }) {
  const activeEntityId = useStore(state => state.activeEntityId);
```

Change the render call at line 30 from:

```tsx
      <EntityPageRenderer entityId={activeEntityId ?? 'dashboard'} />
```

to:

```tsx
      <EntityPageRenderer entityId={activeEntityId ?? initialEntityId ?? 'dashboard'} />
```

Rationale: `activeEntityId` comes from the synchronous persist store and is normally set. `initialEntityId` (from the `flowr-initial-entity` cookie, written in `src/app/layout.tsx`) is the server-render fallback for the very first paint before hydration, so the server never renders dashboard for a user whose last page was elsewhere.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual verification (both platforms)**

Run the app (`npm run dev`, and separately `npm run electron:dev`). Open a note/canvas/folder/tracker page, hit refresh (F5).
Expected: stays on that page; no skeleton shimmer on tabs/Recents/task widget/Shortcuts; no dashboard flash.

- [ ] **Step 4: Commit**

```bash
git add src/components/WorkspaceRouter.tsx
git commit -m "fix(refresh): seed WorkspaceRouter from initialEntityId cookie"
```

---

# SCOPE 3 — Non-destructive cloud settings merge

Cloud path only. Policy: **non-destructive union** — local recents/shortcuts/tabs are never dropped; cloud additions still appear. Shortcuts use **local-wins** on key collision (no per-item timestamp to LWW on).

### Task 4: Write failing tests for non-destructive recents/shortcuts merge

**Files:**
- Test: `src/components/SupabaseProvider.settingsMerge.test.ts` (create)

Note: `mergeCloudData` currently overwrites recents/shortcuts from `data.settings` (SupabaseProvider.tsx:120–127) and ui_state (lines 88–116). These tests assert the *desired* union behavior and will fail until Task 5.

- [ ] **Step 1: Write the failing test file**

Create `src/components/SupabaseProvider.settingsMerge.test.ts`:

```typescript
// Verifies Scope 3: boot-time cloud settings must MERGE (non-destructively)
// into local recents/shortcuts/tabs, never raw-overwrite them. On the dev
// server the cloud settings row is often stale/empty; a raw overwrite there
// silently clears locally-added recents and shortcuts.
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/sync', () => ({
  loadFromSupabase: vi.fn(),
  subscribeRealtime: vi.fn(),
  upsertSpace: vi.fn(),
}));
vi.mock('@/lib/supabase', () => ({ isSupabaseEnabled: false, supabase: null }));

import { useStore } from '@/data/store';
import { mergeCloudData } from './SupabaseProvider';

describe('Scope 3: non-destructive cloud settings merge', () => {
  beforeEach(() => {
    useStore.setState({
      entities: [
        { id: 'e-1', title: 'Note 1', type: 'note', parentId: null, lastModified: 1, syncMode: 'full-sync', pairedEntityId: null } as any,
        { id: 'e-2', title: 'Note 2', type: 'note', parentId: null, lastModified: 1, syncMode: 'full-sync', pairedEntityId: null } as any,
      ],
      tasks: [],
      spaces: [],
      recentEntityIds: ['e-1'],
      shortcuts: { dashboard: [{ id: 's-local', type: 'link', label: 'Local', value: 'x' }] },
    });
  });

  it('keeps a locally-added recent when cloud settings recents are empty/stale', () => {
    mergeCloudData({
      entities: [], tasks: [], spaces: [],
      settings: { recentEntityIds: [] },
    });
    expect(useStore.getState().recentEntityIds).toContain('e-1');
  });

  it('unions cloud recents in without dropping local ones (local order first)', () => {
    mergeCloudData({
      entities: [], tasks: [], spaces: [],
      settings: { recentEntityIds: ['e-2'] },
    });
    const recents = useStore.getState().recentEntityIds;
    expect(recents).toContain('e-1'); // local preserved
    expect(recents).toContain('e-2'); // cloud added
    expect(recents.indexOf('e-1')).toBeLessThan(recents.indexOf('e-2')); // local first
  });

  it('keeps a locally-added shortcut when cloud shortcuts for that context are empty', () => {
    mergeCloudData({
      entities: [], tasks: [], spaces: [],
      settings: { shortcuts: {} },
    });
    expect(useStore.getState().shortcuts.dashboard).toHaveLength(1);
    expect(useStore.getState().shortcuts.dashboard[0].id).toBe('s-local');
  });

  it('unions cloud shortcuts in per context; local wins on id collision', () => {
    mergeCloudData({
      entities: [], tasks: [], spaces: [],
      settings: { shortcuts: {
        dashboard: [
          { id: 's-local', type: 'link', label: 'Cloud version', value: 'y' }, // collision: local must win
          { id: 's-cloud', type: 'link', label: 'Cloud only', value: 'z' },     // new: added
        ],
      } },
    });
    const dash = useStore.getState().shortcuts.dashboard;
    const byId = Object.fromEntries(dash.map((s: any) => [s.id, s]));
    expect(byId['s-local'].label).toBe('Local');       // local wins collision
    expect(byId['s-cloud'].label).toBe('Cloud only');  // cloud-only added
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/components/SupabaseProvider.settingsMerge.test.ts`
Expected: FAIL — current raw-overwrite drops local recents/shortcuts.

- [ ] **Step 3: Commit the failing tests**

```bash
git add src/components/SupabaseProvider.settingsMerge.test.ts
git commit -m "test(refresh): non-destructive cloud settings merge (failing)"
```

---

### Task 5: Implement non-destructive union for recents and shortcuts

**Files:**
- Modify: `src/components/SupabaseProvider.tsx:119-127`

- [ ] **Step 1: Replace the raw recents/shortcuts overwrite**

In `src/components/SupabaseProvider.tsx`, replace this block (currently lines 119–127):

```tsx
  // ── Shortcuts and Recent Entities ──
  if (data.settings) {
    if (data.settings.shortcuts) {
      store().setShortcutsState(data.settings.shortcuts);
    }
    if (data.settings.recentEntityIds) {
      useStore.setState({ recentEntityIds: data.settings.recentEntityIds });
    }
  }
```

with:

```tsx
  // ── Shortcuts and Recent Entities (non-destructive union) ──
  // Local data is the source of truth for the current device; cloud settings
  // only ADD entries the local device doesn't already have. A raw overwrite
  // here silently clears local recents/shortcuts whenever the cloud settings
  // row is stale or empty (common on the dev server).
  if (data.settings) {
    if (data.settings.shortcuts) {
      store().setShortcutsState(
        unionShortcuts(store().shortcuts, data.settings.shortcuts),
      );
    }
    if (Array.isArray(data.settings.recentEntityIds)) {
      useStore.setState({
        recentEntityIds: unionRecents(store().recentEntityIds, data.settings.recentEntityIds),
      });
    }
  }
```

- [ ] **Step 2: Add the union helpers**

Near the top of `src/components/SupabaseProvider.tsx`, above `export function mergeCloudData`, add:

```tsx
const RECENTS_LIMIT = 10;

/** Local recents first (current-device order preserved), then cloud-only ids, capped. */
export function unionRecents(local: string[], cloud: string[]): string[] {
  const merged = [...local];
  for (const id of cloud) {
    if (!merged.includes(id)) merged.push(id);
  }
  return merged.slice(0, RECENTS_LIMIT);
}

/** Per-context union of shortcut lists; on id collision the LOCAL entry wins
 *  (shortcuts have no per-item timestamp, so we can't LWW — the current device's
 *  version is authoritative). Cloud contributes only ids/contexts local lacks. */
export function unionShortcuts(
  local: Record<string, Array<{ id: string; [k: string]: any }>>,
  cloud: Record<string, Array<{ id: string; [k: string]: any }>>,
): Record<string, Array<{ id: string; [k: string]: any }>> {
  const result: Record<string, Array<{ id: string; [k: string]: any }>> = { ...local };
  for (const [ctx, cloudList] of Object.entries(cloud)) {
    const localList = local[ctx] ?? [];
    const localIds = new Set(localList.map(s => s.id));
    const additions = cloudList.filter(s => !localIds.has(s.id));
    result[ctx] = [...localList, ...additions].slice(0, 12);
  }
  return result;
}
```

- [ ] **Step 3: Delete the now-dead recents union block in the boot callback**

The union at lines 261–269 (`// 4. Restore cross-device recent items ...`) is now handled inside `mergeCloudData`. Remove that block (the `if (Array.isArray(data.settings?.recentEntityIds)) { ... }` at lines 261–270) to avoid double-merging. Leave the prune block (4b, lines 272–287) intact — it correctly removes recents pointing at genuinely-absent entities.

- [ ] **Step 4: Run the Scope 3 tests**

Run: `npx vitest run src/components/SupabaseProvider.settingsMerge.test.ts`
Expected: PASS (all 4).

- [ ] **Step 5: Run the full existing SupabaseProvider suite to check for regressions**

Run: `npx vitest run src/components/SupabaseProvider.mergeCloudData.test.ts src/components/SupabaseProvider.bootHydration.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/SupabaseProvider.tsx
git commit -m "fix(refresh): non-destructive union for cloud recents/shortcuts on boot"
```

---

### Task 6: Prefer local page/tabs over stale cloud ui_state on boot

**Files:**
- Modify: `src/components/SupabaseProvider.tsx:88-116`

- [ ] **Step 1: Guard the ui_state application so it never overrides a valid local page**

In `mergeCloudData`, the `// ── UI State ──` block (lines 88–116) currently applies cloud `ui_state` unconditionally via `useStore.setState`. Wrap its application so it only fills in when local is empty/default. Replace the final `useStore.setState({ ... })` in that block (lines 107–116) with:

```tsx
    // Only adopt cloud UI state when local has nothing meaningful yet (fresh
    // device / empty tabs). Otherwise the just-restored local page and tab set
    // (from the synchronous persist store) win — stale cloud ui_state must not
    // yank the user to another page on refresh.
    const localState = useStore.getState();
    const localHasTabs = (localState.openTabIds?.length ?? 0) > 0
      && !(localState.openTabIds.length === 1 && localState.openTabIds[0] === 'dashboard');
    const localHasPage = !!localState.activeEntityId && localState.activeEntityId !== 'dashboard';

    if (!localHasTabs && !localHasPage) {
      useStore.setState({
        openTabIds: openTabIds.length > 0 ? openTabIds : ['dashboard'],
        activeTabId,
        activeEntityId,
        splitViewActive: !!ui.splitViewActive && !!splitViewLeftId,
        splitViewLeftId,
        splitViewRightId,
        splitViewPinned: !!ui.splitViewPinned,
        splitViewPosition: typeof ui.splitViewPosition === 'number' ? ui.splitViewPosition : 50,
      });
    }
```

- [ ] **Step 2: Add a test for the ui_state guard**

Append to `src/components/SupabaseProvider.settingsMerge.test.ts`:

```typescript
describe('Scope 3: local page/tabs win over stale cloud ui_state', () => {
  beforeEach(() => {
    useStore.setState({
      entities: [
        { id: 'e-open', title: 'Open note', type: 'note', parentId: null, lastModified: 1, syncMode: 'full-sync', pairedEntityId: null } as any,
      ],
      tasks: [], spaces: [],
      activeEntityId: 'e-open',
      openTabIds: ['e-open'],
      activeTabId: 'e-open',
    });
  });

  it('does not overwrite the local open page with stale cloud ui_state', () => {
    mergeCloudData({
      entities: [], tasks: [], spaces: [],
      settings: { ui_state: { activeEntityId: 'dashboard', openTabIds: ['dashboard'], activeTabId: 'dashboard' } },
    });
    expect(useStore.getState().activeEntityId).toBe('e-open');
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/components/SupabaseProvider.settingsMerge.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/SupabaseProvider.tsx src/components/SupabaseProvider.settingsMerge.test.ts
git commit -m "fix(refresh): keep local page/tabs over stale cloud ui_state on boot"
```

---

# SCOPE 2 — Delta sync (ID-list diff)

Cloud path only. Free/local-only desktop never executes this. No schema change, no tombstones. Catches offline deletions via an explicit all-IDs set.

### Task 7: Add `syncCursors` state and persist it

**Files:**
- Modify: `src/data/store.ts`

- [ ] **Step 1: Add the state field**

In `src/data/store.ts`, in the store's initial state (near `lastSaved: null,` around line 171), add:

```typescript
      syncCursors: {} as Record<'entities' | 'tasks' | 'spaces', number>,
```

Add the setter near `setRecentEntityIds` (around line 268):

```typescript
      setSyncCursor: (table: 'entities' | 'tasks' | 'spaces', ts: number) =>
        set(s => ({ syncCursors: { ...s.syncCursors, [table]: ts } })),
```

- [ ] **Step 2: Persist it**

In the `partialize` block (around line 3620), add after `activeSpaceId: state.activeSpaceId,`:

```typescript
        syncCursors: state.syncCursors,
```

- [ ] **Step 3: Add the types**

In `src/data/store.types.ts` (the `AppState` interface), add:

```typescript
  syncCursors: Record<'entities' | 'tasks' | 'spaces', number>;
  setSyncCursor: (table: 'entities' | 'tasks' | 'spaces', ts: number) => void;
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/data/store.ts src/data/store.types.ts
git commit -m "feat(refresh): add persisted syncCursors state for delta sync"
```

---

### Task 8: Write failing test for `loadDeltaFromSupabase`

**Files:**
- Test: `src/lib/sync.delta.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/lib/sync.delta.test.ts`:

```typescript
// Verifies Scope 2: loadDeltaFromSupabase issues a delta query (changed rows
// only, last_modified > cursor) plus a lightweight all-ids query per table, so
// callers can reconcile deletions (ids absent from the all-ids set) without
// re-fetching full rows.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const selectCalls: Array<{ table: string; cols: string; gt?: [string, number] }> = [];

function makeQuery(table: string, rows: any[]) {
  const q: any = {
    _cols: '*',
    select(cols: string) { this._cols = cols; return this; },
    gt(col: string, val: number) { this._gt = [col, val]; return this; },
    then(resolve: any) {
      selectCalls.push({ table, cols: this._cols, gt: this._gt });
      // return only rows passing the gt filter if present
      const filtered = this._gt
        ? rows.filter(r => (r[this._gt[0]] ?? 0) > this._gt[1])
        : rows.map(r => (this._cols === 'id, last_modified' ? { id: r.id, last_modified: r.last_modified } : r));
      return Promise.resolve({ data: filtered, error: null }).then(resolve);
    },
  };
  return q;
}

vi.mock('@/lib/supabase', () => ({
  isSupabaseEnabled: true,
  supabase: {
    from(table: string) {
      const rowsByTable: Record<string, any[]> = {
        entities: [
          { id: 'e-old', last_modified: 100, title: 'Old', type: 'note' },
          { id: 'e-new', last_modified: 500, title: 'New', type: 'note' },
        ],
        tasks: [],
        spaces: [],
        settings: [],
      };
      return makeQuery(table, rowsByTable[table] ?? []);
    },
  },
}));
vi.mock('@/lib/env', () => ({ isDesktop: () => false, isWeb: () => true }));

import { loadDeltaFromSupabase } from './sync';

describe('loadDeltaFromSupabase', () => {
  beforeEach(() => { selectCalls.length = 0; });

  it('returns only rows changed after the cursor, plus the full id set for deletion reconciliation', async () => {
    const result = await loadDeltaFromSupabase({ entities: 200, tasks: 0, spaces: 0 });

    // delta rows: only e-new (last_modified 500 > 200)
    expect(result!.entities.map(e => e.id)).toEqual(['e-new']);
    // all-ids set includes BOTH e-old and e-new (unchanged + changed)
    expect([...result!.entityIds].sort()).toEqual(['e-new', 'e-old']);
  });

  it('issues a lightweight id-only query and a gt-filtered full query for entities', async () => {
    await loadDeltaFromSupabase({ entities: 200, tasks: 0, spaces: 0 });
    const entityCalls = selectCalls.filter(c => c.table === 'entities');
    expect(entityCalls.some(c => c.cols === 'id, last_modified')).toBe(true);
    expect(entityCalls.some(c => c.gt && c.gt[0] === 'last_modified' && c.gt[1] === 200)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/sync.delta.test.ts`
Expected: FAIL — `loadDeltaFromSupabase` is not exported yet.

- [ ] **Step 3: Commit the failing test**

```bash
git add src/lib/sync.delta.test.ts
git commit -m "test(refresh): loadDeltaFromSupabase delta+id-set (failing)"
```

---

### Task 9: Implement `loadDeltaFromSupabase`

**Files:**
- Modify: `src/lib/sync.ts`

- [ ] **Step 1: Add the delta loader**

In `src/lib/sync.ts`, after the existing `loadFromSupabase` function (ends ~line 286), add:

```typescript
export interface DeltaCursors {
  entities: number;
  tasks: number;
  spaces: number;
}

export interface DeltaResult {
  entities: Entity[];
  tasks: AppTask[];
  spaces: Space[];
  settings: Record<string, any>;
  entityIds: Set<string>;
  taskIds: Set<string>;
  spaceIds: Set<string>;
}

/**
 * Delta load: for each table, fetch only rows changed after the cursor
 * (last_modified > cursor) as full rows, PLUS a lightweight `id, last_modified`
 * list of ALL rows. Callers upsert the changed rows and drop any local row
 * whose id is absent from the full id set — this catches deletions (including
 * ones made while this client was offline) without a full-row re-fetch and
 * without tombstones.
 */
export async function loadDeltaFromSupabase(cursors: DeltaCursors): Promise<DeltaResult | null> {
  if (!supabase) return null;

  const [entDelta, entIds, taskDelta, taskIds, spaceDelta, spaceIds, setRes] = await Promise.all([
    supabase!.from('entities').select('*').gt('last_modified', cursors.entities),
    supabase!.from('entities').select('id, last_modified'),
    supabase!.from('tasks').select('*').gt('last_modified', cursors.tasks),
    supabase!.from('tasks').select('id, last_modified'),
    supabase!.from('spaces').select('*').gt('last_modified', cursors.spaces),
    supabase!.from('spaces').select('id, last_modified'),
    supabase!.from('settings').select('*'),
  ]);

  const desktop = isDesktop();
  const settings: Record<string, any> = {};
  (setRes.data ?? []).forEach((row: any) => { settings[row.key] = row.value; });

  return {
    entities: filterLocalOnlyForWeb((entDelta.data ?? []).map(rowToEntity), desktop),
    tasks:    filterLocalOnlyForWeb((taskDelta.data ?? []).map(rowToTask), desktop),
    spaces:   filterLocalOnlyForWeb((spaceDelta.data ?? []).map(rowToWorkspace), desktop),
    settings,
    entityIds: new Set((entIds.data ?? []).map((r: any) => r.id as string)),
    taskIds:   new Set((taskIds.data ?? []).map((r: any) => r.id as string)),
    spaceIds:  new Set((spaceIds.data ?? []).map((r: any) => r.id as string)),
  };
}
```

- [ ] **Step 2: Run the delta test**

Run: `npx vitest run src/lib/sync.delta.test.ts`
Expected: PASS (both).

- [ ] **Step 3: Run the existing sync test for regressions**

Run: `npx vitest run src/lib/sync.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/sync.ts
git commit -m "feat(refresh): loadDeltaFromSupabase (changed rows + all-id sets)"
```

---

### Task 10: Write failing test for delta-aware `mergeCloudData` deletion reconciliation

**Files:**
- Test: `src/components/SupabaseProvider.deltaMerge.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/components/SupabaseProvider.deltaMerge.test.ts`:

```typescript
// Verifies Scope 2: a delta merge must reconcile deletions against an explicit
// id set (not by "absent from the payload"), so unchanged local rows survive a
// partial delta while genuinely-deleted rows (absent from the id set) are dropped.
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/sync', () => ({
  loadFromSupabase: vi.fn(),
  loadDeltaFromSupabase: vi.fn(),
  subscribeRealtime: vi.fn(),
  upsertSpace: vi.fn(),
}));
vi.mock('@/lib/supabase', () => ({ isSupabaseEnabled: false, supabase: null }));

import { useStore } from '@/data/store';
import { mergeDeltaData } from './SupabaseProvider';

describe('Scope 2: mergeDeltaData deletion reconciliation', () => {
  beforeEach(() => {
    useStore.setState({
      entities: [
        { id: 'e-keep', title: 'Unchanged', type: 'note', parentId: null, lastModified: 100, syncMode: 'full-sync', pairedEntityId: null } as any,
        { id: 'e-gone', title: 'Deleted elsewhere', type: 'note', parentId: null, lastModified: 100, syncMode: 'full-sync', pairedEntityId: null } as any,
      ],
      tasks: [], spaces: [],
    });
  });

  it('keeps an unchanged local row absent from the delta but present in the id set', () => {
    mergeDeltaData({
      entities: [], tasks: [], spaces: [], settings: {},
      entityIds: new Set(['e-keep', 'e-gone']),
      taskIds: new Set(), spaceIds: new Set(),
    });
    expect(useStore.getState().entities.map(e => e.id).sort()).toEqual(['e-gone', 'e-keep']);
  });

  it('drops a local row whose id is absent from the id set (deleted on another device)', () => {
    mergeDeltaData({
      entities: [], tasks: [], spaces: [], settings: {},
      entityIds: new Set(['e-keep']), // e-gone deleted remotely
      taskIds: new Set(), spaceIds: new Set(),
    });
    expect(useStore.getState().entities.map(e => e.id)).toEqual(['e-keep']);
  });

  it('applies a changed delta row via upsert (LWW) without dropping unchanged rows', () => {
    mergeDeltaData({
      entities: [
        { id: 'e-keep', title: 'Now edited', type: 'note', parentId: null, lastModified: 999, syncMode: 'full-sync', pairedEntityId: null } as any,
      ],
      tasks: [], spaces: [], settings: {},
      entityIds: new Set(['e-keep', 'e-gone']),
      taskIds: new Set(), spaceIds: new Set(),
    });
    const byId = Object.fromEntries(useStore.getState().entities.map(e => [e.id, e]));
    expect(byId['e-keep'].title).toBe('Now edited');
    expect(byId['e-gone']).toBeDefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/SupabaseProvider.deltaMerge.test.ts`
Expected: FAIL — `mergeDeltaData` is not exported yet.

- [ ] **Step 3: Commit the failing test**

```bash
git add src/components/SupabaseProvider.deltaMerge.test.ts
git commit -m "test(refresh): mergeDeltaData deletion reconciliation (failing)"
```

---

### Task 11: Implement `mergeDeltaData`

**Files:**
- Modify: `src/components/SupabaseProvider.tsx`

- [ ] **Step 1: Add `mergeDeltaData`**

In `src/components/SupabaseProvider.tsx`, after `mergeCloudData`, add. It reuses the per-table LWW upsert but reconciles deletions against the explicit id set rather than "absent from payload":

```tsx
export function mergeDeltaData(delta: {
  entities: Entity[];
  tasks: AppTask[];
  spaces: Space[];
  settings?: Record<string, any>;
  entityIds: Set<string>;
  taskIds: Set<string>;
  spaceIds: Set<string>;
}) {
  const store = useStore.getState;
  const desktop = isDesktop();

  const reconcile = <T extends { id: string; lastModified?: number; syncMode?: string }>(
    local: T[],
    deltaRows: T[],
    cloudIds: Set<string>,
  ): T[] => {
    const byId = new Map<string, T>();
    // Start from local rows that still exist in the cloud id set (drop deletions),
    // except keep local-only rows on desktop (they never appear in the cloud id set).
    for (const l of local) {
      const keep = cloudIds.has(l.id) || (desktop && l.syncMode === 'local-only');
      if (keep) byId.set(l.id, l);
    }
    // Apply changed rows with LWW.
    for (const d of deltaRows) {
      const existing = byId.get(d.id);
      if (!existing || (d.lastModified ?? 0) >= (existing.lastModified ?? 0)) {
        byId.set(d.id, d);
      }
    }
    return Array.from(byId.values());
  };

  store().setEntities(reconcile(store().entities, delta.entities, delta.entityIds));
  store().setTasks(reconcile(store().tasks, delta.tasks, delta.taskIds));
  store().setSpaces(reconcile(store().spaces, delta.spaces, delta.spaceIds));

  // Settings reuse the same non-destructive union as the full path.
  if (delta.settings) {
    if (delta.settings.shortcuts) {
      store().setShortcutsState(unionShortcuts(store().shortcuts, delta.settings.shortcuts));
    }
    if (Array.isArray(delta.settings.recentEntityIds)) {
      useStore.setState({
        recentEntityIds: unionRecents(store().recentEntityIds, delta.settings.recentEntityIds),
      });
    }
  }
}
```

- [ ] **Step 2: Run the delta merge test**

Run: `npx vitest run src/components/SupabaseProvider.deltaMerge.test.ts`
Expected: PASS (all 3).

- [ ] **Step 3: Commit**

```bash
git add src/components/SupabaseProvider.tsx
git commit -m "feat(refresh): mergeDeltaData with id-set deletion reconciliation"
```

---

### Task 12: Wire the boot path to use delta load when a cursor exists

**Files:**
- Modify: `src/components/SupabaseProvider.tsx:200-227`

- [ ] **Step 1: Branch the initial load on cursor presence**

In the boot effect, the initial-load block currently is (lines 201–227):

```tsx
    sqliteHydration.then(() => loadFromSupabase()).then(async (data) => {
      if (!data) {
        useStore.getState().setInitialSync(false);
        return;
      }
      // ... personal ws check ...
      mergeCloudData(data);
```

Change the loader selection and merge so that when cursors exist (not first-ever load), it uses the delta path. Replace the `.then(() => loadFromSupabase())` and the `mergeCloudData(data)` call with cursor-aware logic. Insert before the load:

```tsx
    const cursors = useStore.getState().syncCursors;
    const hasCursors = typeof cursors.entities === 'number'
      || typeof cursors.tasks === 'number'
      || typeof cursors.spaces === 'number';
    const initialLoad = () => hasCursors
      ? import('@/lib/sync').then(({ loadDeltaFromSupabase }) =>
          loadDeltaFromSupabase({
            entities: cursors.entities ?? 0,
            tasks: cursors.tasks ?? 0,
            spaces: cursors.spaces ?? 0,
          }))
      : loadFromSupabase();
```

Change `sqliteHydration.then(() => loadFromSupabase())` to `sqliteHydration.then(() => initialLoad())`.

Then where `mergeCloudData(data)` is called (line 227), replace with:

```tsx
      if ('entityIds' in data) {
        mergeDeltaData(data as any);
      } else {
        mergeCloudData(data);
      }
```

- [ ] **Step 2: Update the cursor after a successful load**

After the merge and after `useStore.getState().setInitialSync(false);` (line 308), add cursor advancement:

```tsx
      {
        const s2 = useStore.getState();
        const maxTs = (rows: Array<{ lastModified?: number }>) =>
          rows.reduce((m, r) => Math.max(m, r.lastModified ?? 0), 0);
        s2.setSyncCursor('entities', Math.max(cursors.entities ?? 0, maxTs(s2.entities)));
        s2.setSyncCursor('tasks', Math.max(cursors.tasks ?? 0, maxTs(s2.tasks)));
        s2.setSyncCursor('spaces', Math.max(cursors.spaces ?? 0, maxTs(s2.spaces)));
      }
```

- [ ] **Step 3: Type-check and run all sync/provider tests**

Run: `npx tsc --noEmit && npx vitest run src/components/SupabaseProvider.deltaMerge.test.ts src/components/SupabaseProvider.mergeCloudData.test.ts src/components/SupabaseProvider.bootHydration.test.ts src/components/SupabaseProvider.settingsMerge.test.ts src/lib/sync.delta.test.ts src/lib/sync.test.ts`
Expected: PASS across the board.

- [ ] **Step 4: Manual verification (cloud path)**

Run `npm run dev` signed in. Open devtools Network tab. Refresh once (first load full). Refresh again.
Expected: second refresh's entity/task/space queries are `id, last_modified` id-lists plus small `gt`-filtered delta queries — no full-table `select=*` bodies. UI stays on the same page, no shimmer. Create a note on another device/session → appears after next refresh. Delete a note on another session while this tab is closed → gone after next refresh.

- [ ] **Step 5: Commit**

```bash
git add src/components/SupabaseProvider.tsx
git commit -m "feat(refresh): use delta load on boot when sync cursor exists"
```

---

### Task 13: Full regression run

- [ ] **Step 1: Run the entire test suite**

Run: `npm test`
Expected: all pass (no regressions in store/sync/provider suites).

- [ ] **Step 2: Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit any incidental fixes**

If Steps 1–2 surfaced fixes, commit them:

```bash
git add -A
git commit -m "fix(refresh): address regressions from stable-refresh work"
```

---

## Notes for the implementer

- **Do not touch the free/local-only desktop path.** Scopes 2 and 3 live entirely behind `isSupabaseEnabled` — the `SupabaseProvider.tsx:192-198` early return means none of this runs for a local-only user. Never introduce a Supabase call outside that guard.
- **Parallel edits:** commit only files named in each task. The repo has other uncommitted work (per project convention) — never `git add -A` except in Task 13 Step 3, and only after reviewing `git status`.
- **`store().shortcuts` shape:** `Record<contextId, Shortcut[]>` where `Shortcut = { id, type, label, value }`. Union is per-context then per-id.
- **Cursor semantics:** cursor is the max `last_modified` (ms epoch) seen. A row edited exactly at the cursor value is re-fetched (`>` is strict, but LWW makes a re-apply idempotent) — acceptable.
