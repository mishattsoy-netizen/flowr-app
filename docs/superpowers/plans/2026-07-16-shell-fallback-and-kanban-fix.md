# Shell Fallback + Kanban Space-Filter Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two independent fixes: (1) replace the blank area shown while the app's JavaScript downloads with the app's static frame, and (2) fix Kanban columns briefly emptying on refresh, caused by a boot-order bug that clobbers the space filter.

**Architecture:** These are unrelated bugs that happen to surface at the same moment (page load), so they are planned together but are fully independent — either can ship without the other.

**Tech Stack:** Next.js 16.2.4 (App Router), React 19.2.4, Zustand (`persist`), Vitest (`environment: node`, no React renderer).

---

## Background — required reading

**Fix 1 (blank frame):** `src/app/app/AppClient.tsx` loads the app interior via `next/dynamic` with `ssr: false` and **no `loading:` fallback**, so Next renders literally nothing until the JavaScript chunk downloads.

The critical constraint: **this fallback runs before any app code exists, so it cannot know any of the user's data** — not their open page, tabs, split view, sidebar tree, or content. Any fallback that *guesses* at content would reintroduce the exact "wrong UI flashes then snaps" bug that the client-only change was made to eliminate.

Therefore the fallback must contain **only** what is identical for every user regardless of data: the outer frame (sidebar column of the correct width, header bar strip, background). **No skeleton rows, no fake cards, no placeholder text, no icons, no page-specific anything.** This is deliberate and is the whole point — do not "improve" it by adding content.

**Fix 2 (Kanban):** `TrackerPage` filters tasks by `activeSpaceId` (`t.spaceId === activeSpaceId`). Both tasks and `activeSpaceId` are persisted and restore correctly on refresh. However, `setEntities` in `src/data/store.ts` has a **hidden side effect**: it reassigns `activeSpaceId` if the current one isn't found in `s.spaces`:

```ts
setEntities: (entities) => {
  set((s) => {
    let newActiveSpaceId = s.activeSpaceId;
    const globalSpaces = s.spaces; // Use actual global spaces, not entities
    if (!newActiveSpaceId || !globalSpaces.some(ws => ws.id === newActiveSpaceId)) {
      newActiveSpaceId = globalSpaces.length > 0 ? globalSpaces[0].id : 'ws-personal';
    }
    return { entities, activeSpaceId: newActiveSpaceId };
  });
},
```

On boot, `SupabaseProvider` calls these setters in the order **`setEntities` → `setTasks` → `setSpaces`** (three separate places). Because `setSpaces` runs *last*, `setEntities` evaluates `s.spaces` against the **old/stale/empty** spaces array. When the check fails, `activeSpaceId` is reassigned to something wrong, `TrackerPage`'s filter matches no tasks, and the Kanban columns empty — until the correct value is restored a moment later. That is the reported "columns disappear for a split second."

**The fix is to reorder the calls so `setSpaces` runs first**, not to change `setEntities`. `setEntities`' reassignment is a legitimate safety net for a genuinely-missing space; it is only wrong when it runs against stale spaces. Reordering is the smaller, lower-risk change.

---

## IMPORTANT — read before touching anything

- This repo has unrelated work in progress. **Never run `git add -A` or `git add .`.** Each commit step lists exact files.
- Before every commit, run `git status` and confirm only that task's files are staged.
- If any "before" code block does not match the file exactly, STOP and report the mismatch instead of guessing.
- Do not fix anything not explicitly instructed. Report it instead.
- Note: this project has **no React test renderer** (`vitest` runs with `environment: node`, and there is no `@testing-library/react`). Do not attempt to write component-rendering tests. Task 2's logic fix is unit-testable because it is pure store logic; Task 1's is visual only.

---

## File Structure

- Modify: `src/app/app/AppClient.tsx` — add a data-independent static frame as the `dynamic()` loading fallback.
- Modify: `src/components/SupabaseProvider.tsx` — reorder three setter call-sites so spaces land before entities.
- Test: `src/data/store.setEntitiesSpaceOrder.test.ts` (new) — proves the ordering bug and its fix.

---

### Task 1: Show the app's static frame instead of a blank area while JS loads

**Files:**
- Modify: `src/app/app/AppClient.tsx`

- [ ] **Step 1: Confirm the current contents**

Open `src/app/app/AppClient.tsx`. Confirm it contains these two `dynamic(...)` calls (the long explanatory comment above them may be present — that's expected, leave it):

```tsx
const Shell = dynamic(
  () => import('@/components/layout/Shell').then(m => m.Shell),
  { ssr: false },
);

const WorkspaceRouter = dynamic(
  () => import('@/components/WorkspaceRouter').then(m => m.WorkspaceRouter),
  { ssr: false },
);
```

If this does not match, STOP and report.

- [ ] **Step 2: Add the static frame fallback**

Replace the two `dynamic(...)` calls shown above with:

```tsx
/**
 * Shown only while the app's JavaScript chunk is downloading, before any app
 * code exists on the page.
 *
 * This deliberately contains ONLY the app's outer frame — a sidebar-width
 * column and a header strip — and no content whatsoever.
 *
 * That is not an oversight. At this point nothing about the user is known:
 * not their open page, tabs, split view, sidebar tree, or content. Anything
 * resembling content here would be a guess, and a wrong guess produces
 * exactly the "wrong UI appears then snaps to the real thing" flash that
 * rendering this route client-only was meant to eliminate. Only draw things
 * that are identical for every user on every page.
 *
 * Do not add skeleton rows, cards, icons, or placeholder text here.
 */
function AppFrameFallback() {
  return (
    <div className="flex flex-col h-screen w-full bg-[var(--app-dark)]">
      {/* Header strip */}
      <div className="w-full shrink-0" style={{ height: 42 }} />
      {/* Sidebar column + main area */}
      <div className="flex-1 flex flex-row min-h-0 w-full">
        <div
          className="h-full shrink-0"
          style={{ width: 'var(--sidebar-w, 280px)' }}
        />
        <div className="flex-1 h-full min-w-0" />
      </div>
    </div>
  );
}

const Shell = dynamic(
  () => import('@/components/layout/Shell').then(m => m.Shell),
  { ssr: false, loading: () => <AppFrameFallback /> },
);

const WorkspaceRouter = dynamic(
  () => import('@/components/WorkspaceRouter').then(m => m.WorkspaceRouter),
  { ssr: false },
);
```

Note: only `Shell` gets the fallback. `WorkspaceRouter` renders *inside* `Shell`, so if both had fallbacks you would briefly see two stacked frames.

Note on `var(--sidebar-w, 280px)`: this CSS variable is set by the inline script in `src/app/layout.tsx` from the user's saved sidebar width, before this renders. It is a safe thing to read here — it's already applied to the page, and the `280px` default matches the app's default. Do not replace it with a hardcoded value.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors mentioning `AppClient.tsx`.

- [ ] **Step 4: Run the test suite**

Run: `npm test`
Expected: all pass. Report the count.

- [ ] **Step 5: Verify visually — use a production build, not dev**

Dev mode loads chunks far more slowly and will misrepresent this. Run:

```bash
npm run build && npm start
```

Open the app and refresh several times.

Expected: instead of a fully blank area, you briefly see the app's frame (a dark background with a sidebar-width column), then the real UI fills in. There should be **no visible layout jump** when the real UI appears — the frame's dimensions match.

Report: (a) does the frame appear instead of blank, (b) is there any layout shift/jump when real content arrives, (c) roughly how long the frame is visible.

- [ ] **Step 6: Commit**

```bash
git status
```
Confirm only `src/app/app/AppClient.tsx` is staged.

```bash
git add src/app/app/AppClient.tsx
git commit -m "feat(refresh): show static app frame while JS chunk downloads

Replaces a fully blank area with the app's outer frame (sidebar column
+ header strip). Deliberately contains no content: this renders before
any app code exists, so nothing about the user's state is knowable, and
any guessed content would reintroduce the wrong-UI-flash it was made to
prevent."
```

---

### Task 2: Fix Kanban columns emptying — write the failing test

**Files:**
- Test: `src/data/store.setEntitiesSpaceOrder.test.ts` (new)

**Background:** This test proves the bug described in the Background section: calling `setEntities` while `spaces` is still stale causes `activeSpaceId` to be silently reassigned, which breaks the Kanban space filter.

- [ ] **Step 1: Write the failing test**

Create `src/data/store.setEntitiesSpaceOrder.test.ts` with exactly this content:

```ts
// Proves the boot-order bug behind "Kanban columns disappear for a split second".
//
// setEntities has a side effect: it reassigns activeSpaceId if the current one
// isn't found in state.spaces. On boot, SupabaseProvider called
// setEntities -> setTasks -> setSpaces, so setEntities ran against the STALE
// spaces array. When the user's real space wasn't in that stale array,
// activeSpaceId got clobbered, TrackerPage's `t.spaceId === activeSpaceId`
// filter matched nothing, and the Kanban columns went empty until the correct
// value was restored a moment later.
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/sync', () => ({
  loadFromSupabase: vi.fn(),
  loadDeltaFromSupabase: vi.fn(),
  subscribeRealtime: vi.fn(),
  upsertSpace: vi.fn(),
}));
vi.mock('@/lib/supabase', () => ({ isSupabaseEnabled: false, supabase: null }));

import { useStore } from '@/data/store';

const SPACE_REAL = 'ws-real-space';

const makeSpace = (id: string) => ({
  id,
  name: id,
  type: 'personal' as const,
  ownerId: null,
  createdAt: 1,
  lastModified: 1,
  syncMode: 'full-sync' as const,
});

const makeEntity = (id: string) => ({
  id,
  title: id,
  type: 'note' as const,
  parentId: null,
  lastModified: 1,
  syncMode: 'full-sync' as const,
  pairedEntityId: null,
}) as any;

describe('setEntities must not clobber activeSpaceId when spaces are applied first', () => {
  beforeEach(() => {
    // Simulate the pre-boot state: the user's real space is the active one,
    // but the spaces array has not yet been populated from the sync payload.
    useStore.setState({
      entities: [],
      tasks: [],
      spaces: [],
      activeSpaceId: SPACE_REAL,
    });
  });

  it('keeps the user activeSpaceId when setSpaces runs BEFORE setEntities (the fix)', () => {
    const s = useStore.getState();
    // Correct order: spaces first, so setEntities sees the real space exists.
    s.setSpaces([makeSpace(SPACE_REAL)]);
    s.setEntities([makeEntity('e-1')]);

    expect(useStore.getState().activeSpaceId).toBe(SPACE_REAL);
  });

  it('demonstrates the bug: setEntities BEFORE setSpaces clobbers activeSpaceId', () => {
    const s = useStore.getState();
    // Buggy order: entities first, while spaces is still empty.
    s.setEntities([makeEntity('e-1')]);

    // activeSpaceId got reassigned away from the user's real space, because
    // setEntities checked it against an empty spaces array.
    expect(useStore.getState().activeSpaceId).not.toBe(SPACE_REAL);
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run src/data/store.setEntitiesSpaceOrder.test.ts`

Expected: **both tests PASS.** This is intentional and is not a mistake — this test documents current behavior and locks in the contract. The first test proves the correct ordering preserves `activeSpaceId`; the second proves the buggy ordering destroys it. Task 3 changes the *caller* (`SupabaseProvider`) to use the correct order; this test guards the store behavior both fixes rely on.

If either test fails, STOP and report — that would mean `setEntities`' behavior differs from this plan's analysis and Task 3's fix may be wrong.

- [ ] **Step 3: Commit**

```bash
git status
```
Confirm only `src/data/store.setEntitiesSpaceOrder.test.ts` is staged.

```bash
git add src/data/store.setEntitiesSpaceOrder.test.ts
git commit -m "test(refresh): document setEntities' activeSpaceId reassignment ordering contract"
```

---

### Task 3: Fix the boot order so spaces land before entities

**Files:**
- Modify: `src/components/SupabaseProvider.tsx`

**Background:** There are **three** places calling these setters in the wrong order. All three must be fixed — they are different code paths (full cloud merge, delta merge, and local SQLite hydration), and any one left unfixed reproduces the bug on that path.

- [ ] **Step 1: Fix the full-merge path (`mergeCloudData`)**

Run: `grep -n "store().setEntities(Array.from(byId.values()));" src/components/SupabaseProvider.tsx`

This appears inside `mergeCloudData`, where entities/tasks/spaces are each merged in their own block. The three `store().setX(...)` calls happen at the end of each block, in source order: entities (~line 78), tasks (~line 95), spaces (~line 114).

**Do not reorder the merge blocks themselves** — they are independent computations and moving them risks changing merge behavior. Instead, only the *application* order matters.

Find the entities block's setter call:

```tsx
    store().setEntities(Array.from(byId.values()));
```

and the spaces block's setter call:

```tsx
    store().setSpaces(Array.from(byId.values()));
```

Both use the same local variable name `byId` inside their own block scope, so you cannot simply move one line. Instead, capture the entities result and apply it after spaces.

In the **entities** block, change:

```tsx
    store().setEntities(Array.from(byId.values()));
```

to:

```tsx
    pendingEntities = Array.from(byId.values());
```

Then declare that variable at the top of `mergeCloudData`'s body (immediately after the opening `{` of the function, before the `// ── Entities ──` comment):

```tsx
  // Applied after setSpaces below: setEntities reassigns activeSpaceId if the
  // current one isn't found in state.spaces, so it must never run before the
  // fresh spaces have landed or it clobbers the user's active space.
  let pendingEntities: Entity[] | null = null;
```

Then, immediately **after** the spaces block's `store().setSpaces(...)` line, add:

```tsx
  if (pendingEntities) {
    store().setEntities(pendingEntities);
  }
```

- [ ] **Step 2: Fix the delta-merge path (`mergeDeltaData`)**

Run: `grep -n "store().setEntities(reconcile" src/components/SupabaseProvider.tsx`

Find these three consecutive lines:

```tsx
  store().setEntities(reconcile(store().entities, delta.entities, delta.entityIds));
  store().setTasks(reconcile(store().tasks, delta.tasks, delta.taskIds));
  store().setSpaces(reconcile(store().spaces, delta.spaces, delta.spaceIds));
```

Replace them with:

```tsx
  // setSpaces must run before setEntities: setEntities reassigns activeSpaceId
  // if the current one isn't found in state.spaces, so running it against the
  // pre-merge spaces clobbers the user's active space (emptying the Kanban
  // board's space filter until the correct value is restored).
  const nextEntities = reconcile(store().entities, delta.entities, delta.entityIds);
  const nextTasks = reconcile(store().tasks, delta.tasks, delta.taskIds);
  const nextSpaces = reconcile(store().spaces, delta.spaces, delta.spaceIds);
  store().setSpaces(nextSpaces);
  store().setEntities(nextEntities);
  store().setTasks(nextTasks);
```

Note the `reconcile(...)` calls are all evaluated *before* any setter runs, so each still reads the pre-merge store state exactly as before — only the application order changes.

- [ ] **Step 3: Fix the SQLite hydration path**

Run: `grep -n "s.setEntities(localData.entities);" src/components/SupabaseProvider.tsx`

Find these three consecutive lines:

```tsx
            s.setEntities(localData.entities);
            s.setTasks(localData.tasks);
            s.setSpaces(localData.spaces);
```

Replace with:

```tsx
            // setSpaces first: setEntities reassigns activeSpaceId if the
            // current one isn't in state.spaces, so it must not run first.
            s.setSpaces(localData.spaces);
            s.setEntities(localData.entities);
            s.setTasks(localData.tasks);
```

- [ ] **Step 4: Confirm no other call sites were missed**

Run: `grep -n "setEntities" src/components/SupabaseProvider.tsx`

Expected: the three you fixed, plus a `const setEntities = useStore(s => s.setEntities);` declaration and its use in the `subscribeRealtime({ setEntities, ... })` call. The realtime one is fine and must NOT be changed — it applies single-row updates after boot, when spaces are already correct.

If you find any other `setEntities` call that applies a bulk array before a `setSpaces`, STOP and report it rather than fixing it.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors mentioning `SupabaseProvider.tsx`. If you get an error that `Entity` is not defined (from the `pendingEntities` type in Step 1), confirm `Entity` is imported at the top of the file — it should already be, via `import { useStore, Entity, AppTask, Space } from '@/data/store';`.

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: all pass, including the existing `SupabaseProvider.mergeCloudData.test.ts`, `SupabaseProvider.bootHydration.test.ts`, `SupabaseProvider.deltaMerge.test.ts`, and `SupabaseProvider.settingsMerge.test.ts`. Report the count.

These existing tests specifically cover merge correctness — if any fail, the reordering changed merge behavior and you should STOP and report.

- [ ] **Step 7: Verify visually**

Run: `npm run dev`. Open the Tasks/Kanban page with tasks visible. Refresh several times.

Expected: the Kanban columns and their tasks stay visible throughout — no moment where the columns go empty and then repopulate.

Also refresh on the Dashboard a few times and confirm nothing regressed there (the same space filter affects widgets).

- [ ] **Step 8: Commit**

```bash
git status
```
Confirm only `src/components/SupabaseProvider.tsx` is staged.

```bash
git add src/components/SupabaseProvider.tsx
git commit -m "fix(refresh): apply spaces before entities on boot

setEntities silently reassigns activeSpaceId when the current one isn't
found in state.spaces. All three boot paths applied entities before
spaces, so it ran against stale/empty spaces and clobbered the user's
active space — emptying the Kanban board's space filter until the
correct value was restored a moment later."
```

---

### Task 4: Final verification

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: all pass, 0 failed. Report the count.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean (exit 0). Report anything else without fixing it.

- [ ] **Step 3: Production build check**

Run: `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 4: Visual verification (production build)**

Run: `npm start` (after the build above). Refresh several times on each of: Dashboard, Tasks/Kanban, an active chat, a note.

Report for each:
1. Does the static frame appear instead of a blank area while loading?
2. Is there any layout jump when the real UI replaces the frame?
3. Do Kanban columns stay populated (no empty flash)?
4. Anything that looks worse than before this plan.

- [ ] **Step 5: Report**

Do **not** fix anything beyond this plan's tasks — report it instead; the reviewer wants to do final verification. Include:
- Test count, tsc result, build result.
- Answers to each question in Step 4.
- Any step where a "before" block didn't match and you stopped.
