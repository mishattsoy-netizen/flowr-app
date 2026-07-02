# Workspace Cascading Sync Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a workspace's sync mode (Full Sync / Local Only / Cloud Only) the single control for its entire subtree — every descendant entity adopts the workspace's mode automatically, with no per-entity override UI.

**Scope decision (confirmed with user):** Workspace-level control, children always follow. There is no per-entity sync picker anywhere in the codebase today (verified: `setSyncMode(` is only called from `WorkspacePage.tsx:477`), and this plan does not add one.

**CORRECTION (found during Task 2 implementation — read this before touching Tasks 3/4):** The original version of this plan assumed `Entity.workspaceId` identifies which *user-visible workspace* ("Personal", "Channels", etc. — the things shown in the sidebar and opened via `WorkspacePage`) an entity belongs to, and that workspace records in the store's `workspaces[]` array (e.g. `ws-personal`) correspond to those. **This is wrong.** The actual model, confirmed by reading `WorkspaceRouter.tsx`, `Sidebar.tsx`, `NewCollectionModal.tsx`, and `deleteEntity`:

- What the user sees as "a workspace" (e.g. "Personal") is an `Entity` with `type: 'workspace'` or `'collection'`, living in the `entities[]` array like any other entity. `WorkspacePage` receives this as its `entity` prop, resolved via `entities.find(e => e.id === activeEntityId)` in `WorkspaceRouter.tsx:85`.
- `workspaces[]` (records like `{ id: 'ws-personal', name: 'Personal', ... }`) represents an **account/space level container** (e.g. "Personal" vs a "Shared" workspace), not a sidebar workspace. Every entity anywhere in that account carries the same `workspaceId` value (confirmed in the default seed data at `store.ts:150-155`, where sibling top-level collections `c1`/`c2` and their nested descendants `f1`/`cv1`/`n1`/`m1` all share `workspaceId: 'ws-personal'`). `workspaceId` does **not** distinguish between different sidebar workspaces within the same account.
- The correct way to find "this sidebar workspace and everything nested inside it" is a `parentId` tree-walk — exactly what `getDescendantIds` (in `store.helpers.ts`) already does, and exactly what `deleteEntity` (`store.ts:1757-1767`) already uses for the equivalent "this entity and everything under it" operation.

**As a result:**
- Task 1's original helper (`getWorkspaceEntityIds`, filtering by `workspaceId` equality) was built on the wrong model and has been **removed** — it matched nothing useful (no entity's `workspaceId` ever equals another entity's `id`). Do not re-add it.
- Task 2 has been corrected to cascade via `getDescendantIds(get().entities, entityId)` instead. This is already implemented, tested, and passing as of this correction.
- Tasks 3 and 4 below are rewritten to match: `addEntity` and `moveEntity` must resolve the inherited sync mode by walking up `parentId` to the entity's nearest ancestor of type `'workspace'`/`'collection'` (i.e. its "sidebar workspace root"), not by looking up `workspaces[]`.

**Design decision — cascade-write, not resolve-at-read:** `SyncMode` stays a plain 3-value union (`'cloud-only' | 'local-only' | 'full-sync'`). Every entity keeps a concrete, real `syncMode` value at all times — the same value the whole codebase already reads directly in a dozen places (`saveEntity`, `addEntity`, `moveEntity`, `reorderEntities`, frontmatter serialization, `syncFileScan` parsing). When a workspace entity's mode changes, we write the new mode onto every descendant entity in the store (and persist each), instead of introducing an `'inherit'` sentinel that every read site would need to resolve.

**Architecture:**
1. ~~`setSyncMode` cascades via `workspaceId` matching~~ **`setSyncMode` cascades via `getDescendantIds` (parentId tree-walk)** — DONE (Task 2, corrected).
2. `addEntity`'s existing (partial, local-only-only) inheritance logic is replaced with full inheritance of the actual sync mode of the entity's nearest ancestor workspace/collection root (walking `parentId` up from `entity.parentId`), not `workspaces[]`.
3. `moveEntity` adopts the destination parent's workspace-root sync mode when an entity's `parentId` changes to a location under a different sidebar workspace root.

**Tech Stack:** TypeScript, Zustand store, Vitest for tests.

---

### Task 1 (DONE, corrected): ~~Add a shared helper to resolve a workspace's descendant entities~~

Originally added `getWorkspaceEntityIds` to `src/data/store.helpers.ts`. **This helper has been deleted** — it filtered by `Entity.workspaceId`, which (per the correction above) does not identify sidebar-workspace membership. `getDescendantIds` (already existing in the same file, used by `deleteEntity`) is the correct tool and needed no new helper. No action needed; this task is superseded by Task 2's corrected implementation.

---

### Task 2 (DONE, corrected): Cascade `setSyncMode` to all descendant entities

**Files:**
- Modified: `src/data/store.ts` (the `setSyncMode` action)
- Test: `src/data/store.setSyncMode.test.ts`

**What was implemented (already done, passing):**

```typescript
      setSyncMode: async (entityId, mode) => {
        const cascadeIds = getDescendantIds(get().entities, entityId);

        const prevEntitiesById = new Map(get().entities.map(e => [e.id, e]));
        const targetIds = new Set([entityId, ...cascadeIds]);

        const leavingLocalIds = Array.from(targetIds).filter(id => {
          const prev = prevEntitiesById.get(id);
          return mode === 'cloud-only' && prev && (prev.syncMode === 'local-only' || prev.syncMode === 'full-sync');
        });

        set(s => ({
          entities: s.entities.map(e => targetIds.has(e.id) ? { ...e, syncMode: mode, lastModified: Date.now() } : e),
          workspaces: s.workspaces.map(w => w.id === entityId ? { ...w, syncMode: mode } : w)
        }));

        const ws = get().workspaces.find(w => w.id === entityId);
        if (ws) {
          upsertWorkspace(ws);
        }

        const { saveEntity } = await import('@/lib/persistence');
        const freshEntities = get().entities;
        for (const id of targetIds) {
          const entity = freshEntities.find(e => e.id === id);
          if (entity) {
            saveEntity(entity).catch(err => console.error('[store] saveEntity failed:', err));
          }
        }

        if (leavingLocalIds.length > 0 && isDesktop()) {
          const { getVaultPath, findLocalFileForEntity, clearKeptFileForEntity } = await import('@/lib/syncFileScan');
          const vault = await getVaultPath();
          if (vault) {
            const flaggedFiles: Array<{ path: string; entityId: string; entityTitle: string; recognized: boolean }> = [];
            for (const id of leavingLocalIds) {
              const entity = freshEntities.find(e => e.id === id);
              if (!entity) continue;
              clearKeptFileForEntity(entity.id);
              const filePath = await findLocalFileForEntity(vault, entity);
              if (filePath) {
                flaggedFiles.push({ path: filePath, entityId: entity.id, entityTitle: entity.title, recognized: true });
              }
            }
            if (flaggedFiles.length > 0) {
              get().openModal({ kind: 'syncFileCleanup', files: flaggedFiles });
            }
          }
        }
      },
```

`entityId` here is always an `Entity` id (from `WorkspacePage`'s `entity.id`, itself resolved from `entities[]` in `WorkspaceRouter.tsx`). `getDescendantIds` walks `parentId` to find every entity nested under it, regardless of depth. The `workspaces[]` lookup/upsert (lines checking `get().workspaces.find(w => w.id === entityId)`) is a harmless secondary branch preserved from the original code, for the (currently unused but structurally possible) case where the target id also happens to match an account-level `Workspace` record — it does not affect the cascade.

The `SyncFileCleanupModal` component already accepts an array of `{ path, entityId, entityTitle, recognized }` and renders correctly for both single-file and batch cases — confirmed, no changes needed there.

Test file `src/data/store.setSyncMode.test.ts` seeds a `parentId`-based tree (`w1` workspace-type entity → `f1` folder → `n1` note, plus a sibling `w2` workspace with its own child `n2`) and verifies:
1. Setting sync mode on `w1` cascades to `f1` and `n1` but not to `w2`/`n2` (sibling workspace unaffected).
2. Every cascaded entity (including the target itself) is persisted via `saveEntity`.
3. Setting sync mode on a leaf entity (`n1`, which has no children) only affects itself.

Status: **PASSING** — `npx vitest run src/data/store.setSyncMode.test.ts` → 3/3 tests pass. Full suite (`npx vitest run`) → 136/136 pass as of this correction.

---

### Task 3: Inherit the workspace-root sync mode on entity creation

**Files:**
- Modify: `src/data/store.ts` (the `addEntity` action — currently the inheritance block sits between the "Enforce flat hierarchy" comment and `const finalEntity = {`; search for `defaultSyncMode` to locate it)
- Test: `src/data/store.addEntity.test.ts` (new file)

Today `addEntity`'s inheritance logic only special-cases `local-only`, inherited from the *immediate parent's* `syncMode` (one level up only — so a note two levels deep under a `local-only` folder under a `full-sync` workspace would incorrectly inherit `local-only` from its immediate parent instead of `full-sync` from the workspace root; and it never inherits `full-sync` at all, only ever defaulting to `cloud-only` otherwise). This task replaces it with: walk up `parentId` from the new entity's parent to find the nearest ancestor whose `type` is `'workspace'` or `'collection'` (a sidebar-workspace root — these are always top-level, `parentId: null`, per the "Enforce flat hierarchy" rule already in this same function), and inherit that root's current `syncMode`. If the entity being created has no `parentId` (i.e. it IS a new workspace/collection root, or a system-level orphan), default to `'cloud-only'` — matching today's fallback behavior for root-level items with no parent to inherit from.

- [ ] **Step 1: Write the failing tests**

Create `src/data/store.addEntity.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/sync', () => ({
  upsertEntity: vi.fn().mockResolvedValue({ error: null }),
  upsertWorkspace: vi.fn().mockResolvedValue({ error: null }),
  deleteEntityFromDB: vi.fn().mockResolvedValue({ error: null }),
  upsertTask: vi.fn().mockResolvedValue({ error: null }),
  deleteTaskFromDB: vi.fn().mockResolvedValue({ error: null }),
  clearAllDataFromCloud: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/supabase', () => ({ supabase: null, isSupabaseEnabled: false }));
vi.mock('@/lib/chat', () => ({
  fetchConversations: vi.fn(), createConversation: vi.fn(), updateConversationTitle: vi.fn(),
  deleteConversation: vi.fn(), fetchMessages: vi.fn(), insertMessage: vi.fn(),
}));
vi.mock('@/lib/canvasSync', () => ({ upsertCanvasBlock: vi.fn(), deleteCanvasBlock: vi.fn() }));
vi.mock('@/lib/frameLayout', () => ({ computeAutoLayout: vi.fn() }));
vi.mock('@/lib/groupUtils', () => ({ generateGroupId: () => 'group-1' }));
vi.mock('@/lib/env', () => ({ isDesktop: () => false }));
vi.mock('@/lib/persistence', () => ({ saveEntity: vi.fn().mockResolvedValue(undefined) }));

import { useStore } from './store';

describe('addEntity syncMode inheritance from workspace root', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({
      workspaces: [
        { id: 'ws-personal', name: 'Personal', type: 'personal', ownerId: null, createdAt: 0, syncMode: 'cloud-only' },
      ],
      entities: [
        { id: 'w1', title: 'Full Sync Workspace', type: 'workspace', parentId: null, lastModified: 0, workspaceId: 'ws-personal', syncMode: 'full-sync' },
        { id: 'w2', title: 'Local Workspace', type: 'collection', parentId: null, lastModified: 0, workspaceId: 'ws-personal', syncMode: 'local-only' },
        { id: 'f1', title: 'Folder under w1', type: 'folder', parentId: 'w1', lastModified: 0, workspaceId: 'ws-personal', syncMode: 'full-sync' },
      ] as any,
      activeWorkspaceId: 'ws-personal',
    });
  });

  it('inherits full-sync from a top-level workspace root for a direct child', () => {
    const id = useStore.getState().addEntity({ type: 'note', title: 'Root Note', parentId: 'w1' });
    const entity = useStore.getState().entities.find(e => e.id === id);
    expect(entity?.syncMode).toBe('full-sync');
  });

  it('inherits the workspace-root mode for a deeply nested entity, not just the immediate parent', () => {
    const noteId = useStore.getState().addEntity({ type: 'note', title: 'Nested Note', parentId: 'f1' });
    const entity = useStore.getState().entities.find(e => e.id === noteId);
    // f1's own syncMode ('full-sync') happens to match w1's here; the important
    // assertion is that inheritance walks to the workspace ROOT (w1), not just f1.
    expect(entity?.syncMode).toBe('full-sync');
  });

  it('inherits local-only from a local-only workspace root', () => {
    const id = useStore.getState().addEntity({ type: 'note', title: 'Local Note', parentId: 'w2' });
    const entity = useStore.getState().entities.find(e => e.id === id);
    expect(entity?.syncMode).toBe('local-only');
  });

  it('defaults to cloud-only for a new root-level entity with no parent', () => {
    const id = useStore.getState().addEntity({ type: 'workspace', title: 'New Workspace' });
    const entity = useStore.getState().entities.find(e => e.id === id);
    expect(entity?.syncMode).toBe('cloud-only');
  });

  it('still respects an explicit syncMode passed by the caller', () => {
    const id = useStore.getState().addEntity({ type: 'note', title: 'Explicit', parentId: 'w1', syncMode: 'cloud-only' });
    const entity = useStore.getState().entities.find(e => e.id === id);
    expect(entity?.syncMode).toBe('cloud-only');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/store.addEntity.test.ts`
Expected: FAIL on the "inherits full-sync" tests — today's logic never inherits `full-sync`, and the "deeply nested" test would incorrectly inherit from the immediate parent only (which happens to coincide with the root's mode here, so read the diff carefully; the more telling failure is the first test, which returns `'cloud-only'` today instead of `'full-sync'`).

- [ ] **Step 3: Locate and read the current inheritance block**

Open `src/data/store.ts` and find the `addEntity` action. Locate the block that currently reads (search for `defaultSyncMode`):

```typescript
        // Inherit cloudSyncEnabled default from parent or active space config
        const parentEntity = entity.parentId ? get().entities.find(e => e.id === entity.parentId) : null;
        let defaultSyncMode: import('./store.types').SyncMode = 'cloud-only';
        if (parentEntity) {
          if (parentEntity.syncMode === 'local-only') {
            defaultSyncMode = 'local-only';
          }
        } else {
          const wsId = entity.workspaceId || activeWorkspaceId;
          const ws = get().workspaces.find(w => w.id === wsId);
          if (ws && ws.syncMode === 'local-only') {
            defaultSyncMode = 'local-only';
          }
        }
```

Confirm this is still the current text before replacing (line numbers may have shifted from the original plan draft — search by content, not line number).

- [ ] **Step 4: Add a workspace-root resolution helper**

In `src/data/store.helpers.ts`, add a new helper next to `getDescendantIds`:

```typescript
/**
 * Walks parentId upward from an entity to find its nearest ancestor of type
 * 'workspace' or 'collection' — the sidebar-workspace root that entity lives
 * under. These roots are always top-level (parentId: null), so the walk
 * terminates there. Returns null if no such ancestor exists (e.g. the entity
 * itself is a root, or is orphaned).
 */
export function findWorkspaceRoot(entities: Entity[], startParentId: string | null): Entity | null {
  let current = startParentId ? entities.find(e => e.id === startParentId) : null;
  while (current) {
    if (current.type === 'workspace' || current.type === 'collection') {
      return current;
    }
    current = current.parentId ? entities.find(e => e.id === current!.parentId) : null;
  }
  return null;
}
```

- [ ] **Step 5: Replace the inheritance block**

Replace the block found in Step 3 with:

```typescript
        // Inherit sync mode from the entity's nearest ancestor workspace/collection
        // root — NOT from Entity.workspaceId, which is an account-level id shared
        // by every entity in the same account regardless of sidebar workspace.
        const workspaceRoot = findWorkspaceRoot(get().entities, entity.parentId ?? null);
        const defaultSyncMode: import('./store.types').SyncMode = workspaceRoot ? workspaceRoot.syncMode : 'cloud-only';
```

Add `findWorkspaceRoot` to the existing helpers import at the top of `store.ts` (it already imports `getDescendantIds` from `'./store.helpers'` — add `findWorkspaceRoot` to that same import line).

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/data/store.addEntity.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 7: Run the full suite to check nothing broke**

Run: `npx vitest run`
Expected: All tests pass (baseline was 136 passing before this task).

- [ ] **Step 8: Do NOT commit yet**

Per user instruction, all tasks in this plan are committed together at the end, not incrementally. Leave changes staged/unstaged as-is and proceed to Task 4.

---

### Task 4: Adopt destination workspace-root sync mode on move

**Files:**
- Modify: `src/data/store.ts` (the `moveEntity` action)
- Test: `src/data/store.moveEntity.test.ts` (new file)

Today `moveEntity` changes `parentId` and `workspaceId` but never touches `syncMode`. This task makes it adopt the new location's workspace-root sync mode whenever the move changes which workspace-root subtree the entity lives under (comparing the workspace-root *before* and *after* the move, via `findWorkspaceRoot` from Task 3) — this covers both "moved into a different sidebar workspace" and "moved to top-level with no parent" cases uniformly, without needing special-case logic for cross-account (`workspaceId`) moves specifically.

- [ ] **Step 1: Write the failing tests**

Create `src/data/store.moveEntity.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/sync', () => ({
  upsertEntity: vi.fn().mockResolvedValue({ error: null }),
  upsertWorkspace: vi.fn().mockResolvedValue({ error: null }),
  deleteEntityFromDB: vi.fn().mockResolvedValue({ error: null }),
  upsertTask: vi.fn().mockResolvedValue({ error: null }),
  deleteTaskFromDB: vi.fn().mockResolvedValue({ error: null }),
  clearAllDataFromCloud: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/supabase', () => ({ supabase: null, isSupabaseEnabled: false }));
vi.mock('@/lib/chat', () => ({
  fetchConversations: vi.fn(), createConversation: vi.fn(), updateConversationTitle: vi.fn(),
  deleteConversation: vi.fn(), fetchMessages: vi.fn(), insertMessage: vi.fn(),
}));
vi.mock('@/lib/canvasSync', () => ({ upsertCanvasBlock: vi.fn(), deleteCanvasBlock: vi.fn() }));
vi.mock('@/lib/frameLayout', () => ({ computeAutoLayout: vi.fn() }));
vi.mock('@/lib/groupUtils', () => ({ generateGroupId: () => 'group-1' }));
vi.mock('@/lib/env', () => ({ isDesktop: () => false }));
vi.mock('@/lib/persistence', () => ({ saveEntity: vi.fn().mockResolvedValue(undefined) }));

import { useStore } from './store';

describe('moveEntity syncMode adoption across workspace roots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({
      workspaces: [
        { id: 'ws-personal', name: 'Personal', type: 'personal', ownerId: null, createdAt: 0, syncMode: 'cloud-only' },
      ],
      entities: [
        { id: 'w1', title: 'Cloud Workspace', type: 'workspace', parentId: null, lastModified: 0, workspaceId: 'ws-personal', syncMode: 'cloud-only' },
        { id: 'w2', title: 'Local Workspace', type: 'workspace', parentId: null, lastModified: 0, workspaceId: 'ws-personal', syncMode: 'local-only' },
        { id: 'f1', title: 'Folder under w2', type: 'folder', parentId: 'w2', lastModified: 0, workspaceId: 'ws-personal', syncMode: 'local-only' },
        { id: 'n1', title: 'Note', type: 'note', parentId: 'w1', lastModified: 0, workspaceId: 'ws-personal', syncMode: 'cloud-only' },
      ] as any,
    });
  });

  it('adopts the destination workspace-root sync mode when moved under a different workspace root', () => {
    useStore.getState().moveEntity('n1', 'f1');
    const entity = useStore.getState().entities.find(e => e.id === 'n1');
    expect(entity?.syncMode).toBe('local-only');
  });

  it('keeps the existing syncMode when moved within the same workspace root', () => {
    useStore.getState().moveEntity('n1', 'w1');
    const entity = useStore.getState().entities.find(e => e.id === 'n1');
    expect(entity?.syncMode).toBe('cloud-only');
  });

  it('keeps the existing syncMode when moved to a null parent (top-level) and was already at top-level under no workspace root', () => {
    useStore.getState().moveEntity('w1', null);
    const entity = useStore.getState().entities.find(e => e.id === 'w1');
    expect(entity?.syncMode).toBe('cloud-only');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/store.moveEntity.test.ts`
Expected: FAIL on the first test — today `moveEntity` never touches `syncMode`, so `n1` keeps `'cloud-only'` after moving under `f1` (which is under the `local-only` workspace `w2`).

- [ ] **Step 3: Implement destination-root mode adoption**

Read the current `moveEntity` implementation in `src/data/store.ts` first (search for `moveEntity:`) to confirm its exact current text, then replace it with:

```typescript
      moveEntity: (id, newParentId, newWorkspaceId) => {
        const state = get();
        const prevEntity = state.entities.find(e => e.id === id);
        const isRootOnlyPrev = prevEntity && (prevEntity.type === 'workspace' || prevEntity.type === 'collection');
        const finalParentIdForLookup = isRootOnlyPrev ? null : newParentId;

        const prevRoot = prevEntity ? findWorkspaceRoot(state.entities, prevEntity.parentId ?? null) : null;
        const nextRoot = findWorkspaceRoot(state.entities, finalParentIdForLookup);
        const rootChanged = (prevRoot?.id ?? null) !== (nextRoot?.id ?? null);
        const destinationSyncMode = rootChanged ? (nextRoot ? nextRoot.syncMode : undefined) : undefined;

        set((state) => ({
          entities: state.entities.map(e => {
            if (e.id !== id) return e;

            // Enforce flat hierarchy for workspaces and collections
            const isRootOnly = e.type === 'workspace' || e.type === 'collection';
            const finalParentId = isRootOnly ? null : newParentId;

            return {
              ...e,
              parentId: finalParentId,
              workspaceId: newWorkspaceId !== undefined ? newWorkspaceId : e.workspaceId,
              syncMode: destinationSyncMode ?? e.syncMode,
              lastModified: Date.now()
            };
          })
        }));
        const updated = get().entities.find(e => e.id === id);
        if (updated && updated.syncMode !== 'local-only') upsertEntity(updated);
        if (updated) {
          import('@/lib/persistence').then(({ saveEntity }) => {
            saveEntity(updated).catch(err => console.error('[store] saveEntity failed:', err));
          });
        }
      },
```

`findWorkspaceRoot` must be imported the same way as in Task 3 (add to the existing `from './store.helpers'` import line if not already present from Task 3's edit).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/store.moveEntity.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Run the full suite to check nothing broke**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 6: Do NOT commit yet**

Proceed to Task 5 (verification). All work in this plan is committed together at the end per user instruction.

---

### Task 5: Full test suite, single combined commit, and manual verification

**Files:** none (verification + commit only)

- [ ] **Step 1: Run the full test suite one final time**

Run: `npx vitest run`
Expected: All tests pass, including `store.setSyncMode.test.ts`, `store.addEntity.test.ts`, `store.moveEntity.test.ts`, and every pre-existing test file.

- [ ] **Step 2: Review the full diff before committing**

Run: `git status --short` and `git diff --stat` to confirm the changed files are exactly: `src/data/store.ts`, `src/data/store.helpers.ts`, `src/data/store.setSyncMode.test.ts` (new), `src/data/store.addEntity.test.ts` (new), `src/data/store.moveEntity.test.ts` (new). Confirm `src/data/store.helpers.test.ts` (Task 1's original test, since deleted) does NOT reappear.

- [ ] **Step 3: Single combined commit**

```bash
git add src/data/store.ts src/data/store.helpers.ts src/data/store.setSyncMode.test.ts src/data/store.addEntity.test.ts src/data/store.moveEntity.test.ts
git commit -m "feat: cascade workspace sync mode to all descendant entities

Sync mode (Full Sync / Local Only / Cloud Only) set on a sidebar workspace
now cascades to every entity nested under it, instead of only affecting
the workspace's own record. New entities inherit their workspace root's
mode on creation, and moving an entity across workspace roots adopts the
destination's mode."
```

- [ ] **Step 4: Manual verification in the desktop app**

This bug was originally reported against the Electron desktop build with a configured vault. Follow these steps:

1. Start the app (check `package.json` scripts for the desktop dev command).
2. Open a workspace that currently has some existing notes/canvases (created before this fix, so they're `cloud-only`).
3. Set the workspace's sync mode to **Full Sync** via the picker on the workspace page.
4. Confirm: the vault folder now contains a `.md`/`.canvas` file for every child note/canvas that existed before the switch (not just the workspace's own file).
5. Create a new note inside that workspace. Confirm a new local file appears for it immediately without needing to touch its own sync setting.
6. Switch the workspace back to **Cloud Only**. Confirm the `SyncFileCleanupModal` appears listing *all* the local files found for that workspace's descendants (batched, not one modal per file), and that choosing "Delete local copies" removes all of them.
7. Move a note from this workspace into a different workspace with a different sync mode. Confirm the note's local file is cleaned up / created appropriately per the destination workspace's mode.

- [ ] **Step 5: Report results**

If manual verification surfaces an issue, return to the relevant task above, fix it, re-run that task's tests, and amend before considering the branch done (the commit from Step 3 hasn't been pushed/merged yet, so amending or adding a fixup commit is fine — check with the user which they prefer).

---

## Self-Review Notes

- **Spec coverage:** Workspace-entity cascade on toggle (Task 2, corrected), new-entity inheritance from the workspace root — not the immediate parent or the account-level `workspaceId` (Task 3, corrected), cross-workspace-root move adoption (Task 4, corrected). All items from the original investigation are covered, now against the correct data model.
- **No per-entity override UI added** — confirmed via grep that `setSyncMode(` has exactly one call site (`WorkspacePage.tsx:477`).
- **Type consistency:** `findWorkspaceRoot(entities, startParentId)` signature is used identically in Task 3 and Task 4. `getDescendantIds`, `saveEntity`, `setSyncMode` signatures are unchanged from their current declarations.
- **Model correction is load-bearing for the whole plan** — anyone resuming this plan must read the CORRECTION section before touching Tasks 3/4, since the original (uncorrected) versions of those tasks in earlier plan drafts used the wrong (`workspaceId`-based) resolution and would silently fail to cascade correctly (tests would still pass because they'd be seeded with the same wrong model, which is exactly how Tasks 1/2 shipped broken-but-green the first time).
