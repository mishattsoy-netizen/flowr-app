# SyncMode / Local File Consistency Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop cloud-only entities from getting local `.md`/`.canvas` files with incorrect `syncMode: "full-sync"` frontmatter, and clean up files already corrupted by the bug.

**Architecture:** Two bugs are fixed at the source (`persistence.ts` frontmatter fallback, `store.ts` ungated file-write subscriber). A new confirm-dialog modal (`SyncFileCleanupModal`) handles both the mode-switch-triggered case and a batched startup scan, sharing one file-existence/deletion helper module (`src/lib/syncFileScan.ts`).

**Tech Stack:** TypeScript, Zustand store, Electron IPC (`flowrFS`), Vitest.

---

## Task 1: Fix the frontmatter fallback bug

**Files:**
- Modify: `src/lib/persistence.ts:22`
- Test: `src/lib/persistence.test.ts` (new file)

- [ ] **Step 1: Write the failing test**

Create `src/lib/persistence.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveEntityToFile } from './persistence';
import type { Entity } from '@/data/store.types';

vi.mock('./env', () => ({ isDesktop: () => true }));
vi.mock('./fileVault', () => ({
  getVaultPath: async () => '/fake/vault',
  sanitizeFileName: (s: string) => s,
}));

describe('saveEntityToFile', () => {
  beforeEach(() => {
    (window as any).flowrFS = { writeFile: vi.fn().mockResolvedValue(undefined) };
  });

  it('writes the entity\'s actual syncMode into frontmatter, not a hardcoded fallback', async () => {
    const entity: Entity = {
      id: 'e1',
      title: 'Test Note',
      type: 'note',
      parentId: null,
      lastModified: 1000,
      tags: [],
      content: [],
      syncMode: 'cloud-only',
    } as unknown as Entity;

    await saveEntityToFile(entity, []);

    const [, content] = (window as any).flowrFS.writeFile.mock.calls[0];
    expect(content).toContain('"syncMode":"cloud-only"');
    expect(content).not.toContain('"syncMode":"full-sync"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/persistence.test.ts`
Expected: FAIL — content contains `"syncMode":"full-sync"` instead of `"syncMode":"cloud-only"`.

- [ ] **Step 3: Fix the fallback**

In `src/lib/persistence.ts`, change line 22:

```typescript
      syncMode: entity.syncMode || 'full-sync',
```

to:

```typescript
      syncMode: entity.syncMode,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/persistence.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/persistence.ts src/lib/persistence.test.ts
git commit -m "fix: write entity's actual syncMode to frontmatter instead of hardcoded fallback"
```

---

## Task 2: Gate the store file-write subscriber on syncMode

**Files:**
- Modify: `src/data/store.ts:2596-2610`

This subscriber has no existing test file and is wired directly into module-load-time `useStore.subscribe`, which is awkward to unit test in isolation. We verify this task via the manual test plan in Task 6 instead of an automated test, consistent with how the rest of this subscriber block is (currently) untested.

- [ ] **Step 1: Read current code**

Current (`src/data/store.ts:2596-2611`):

```typescript
if (isDesktop()) {
  useStore.subscribe((state, prevState) => {
    // Basic detection for M3: if lastModified changed, save it
    // In M4 this will be replaced by direct calls to saveEntity() on store actions
    for (const entity of state.entities) {
      if (entity.type !== 'note' && entity.type !== 'canvas' && entity.type !== 'mixed') continue;
      const prev = prevState.entities.find(e => e.id === entity.id);
      if (!prev || prev.lastModified !== entity.lastModified) {
        const blocks = entity.type === 'canvas'
          ? state.blocks.filter(b => b.canvasId === entity.id)
          : (entity.content || []);
        saveEntityToFile(entity, blocks);
      }
    }
  });
}
```

- [ ] **Step 2: Add the syncMode gate**

Replace the block with:

```typescript
if (isDesktop()) {
  useStore.subscribe((state, prevState) => {
    // Basic detection for M3: if lastModified changed, save it
    // In M4 this will be replaced by direct calls to saveEntity() on store actions
    for (const entity of state.entities) {
      if (entity.type !== 'note' && entity.type !== 'canvas' && entity.type !== 'mixed') continue;
      if (entity.syncMode === 'cloud-only') continue;
      const prev = prevState.entities.find(e => e.id === entity.id);
      if (!prev || prev.lastModified !== entity.lastModified) {
        const blocks = entity.type === 'canvas'
          ? state.blocks.filter(b => b.canvasId === entity.id)
          : (entity.content || []);
        saveEntityToFile(entity, blocks);
      }
    }
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/data/store.ts
git commit -m "fix: skip local file writes for cloud-only entities"
```

---

## Task 3: Add the shared sync-file-scan helper module

**Files:**
- Create: `src/lib/syncFileScan.ts`
- Test: `src/lib/syncFileScan.test.ts`

This module centralizes: computing an entity's expected file path, reading+parsing a file's `id`/`syncMode` from frontmatter (or the JSON `.canvas` format), listing vault files, and deleting a file. Both the mode-switch popup (Task 4) and the startup scan (Task 5) use it.

- [ ] **Step 1: Write the failing test**

Create `src/lib/syncFileScan.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseVaultFile, findLocalFileForEntity } from './syncFileScan';
import type { Entity } from '@/data/store.types';

describe('parseVaultFile', () => {
  it('parses a markdown file frontmatter id', () => {
    const content = '---\n"id": "abc123"\n"title": "My Note"\n"syncMode": "full-sync"\n"lastModified": 1000\n"version": 1\n---\n\nBody';
    const result = parseVaultFile('My Note.md', content);
    expect(result).toEqual({ id: 'abc123', syncMode: 'full-sync' });
  });

  it('parses a .canvas JSON file', () => {
    const content = JSON.stringify({ entity: { id: 'canvas1', syncMode: 'local-only' }, blocks: [] });
    const result = parseVaultFile('My Canvas.canvas', content);
    expect(result).toEqual({ id: 'canvas1', syncMode: 'local-only' });
  });

  it('returns null for unparseable content', () => {
    expect(parseVaultFile('broken.md', 'not frontmatter at all')).toBeNull();
  });
});

describe('findLocalFileForEntity', () => {
  beforeEach(() => {
    (window as any).flowrFS = {
      readdir: vi.fn().mockResolvedValue(['Test Note.md', 'Other.md']),
      readFile: vi.fn((path: string) => {
        if (path.includes('Test Note.md')) {
          return Promise.resolve('---\n"id": "e1"\n"title": "Test Note"\n"syncMode": "full-sync"\n"lastModified": 1000\n"version": 1\n---\n\nBody');
        }
        return Promise.resolve('---\n"id": "other"\n"title": "Other"\n"syncMode": "cloud-only"\n"lastModified": 1000\n"version": 1\n---\n\nBody');
      }),
    };
  });

  it('finds the file matching the given entity id', async () => {
    const entity = { id: 'e1', title: 'Test Note', type: 'note' } as Entity;
    const result = await findLocalFileForEntity('/vault', entity);
    expect(result).toBe('/vault/Test Note.md');
  });

  it('returns null when no file matches the entity id', async () => {
    const entity = { id: 'missing', title: 'Nope', type: 'note' } as Entity;
    const result = await findLocalFileForEntity('/vault', entity);
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/syncFileScan.test.ts`
Expected: FAIL — module `./syncFileScan` does not exist.

- [ ] **Step 3: Implement the module**

Create `src/lib/syncFileScan.ts`:

```typescript
import { parseFrontmatter } from './editor/frontmatter';
import { getVaultPath } from './fileVault';

export interface ParsedVaultFile {
  id: string;
  syncMode: string;
}

/**
 * Extracts { id, syncMode } from a vault file's content, handling both the
 * markdown-frontmatter format (.md) and the raw-JSON format (.canvas).
 * Returns null if the content can't be parsed as either.
 */
export function parseVaultFile(fileName: string, content: string): ParsedVaultFile | null {
  if (fileName.endsWith('.canvas')) {
    try {
      const parsed = JSON.parse(content);
      const id = parsed?.entity?.id;
      const syncMode = parsed?.entity?.syncMode;
      if (typeof id === 'string' && typeof syncMode === 'string') {
        return { id, syncMode };
      }
      return null;
    } catch {
      return null;
    }
  }

  const { meta } = parseFrontmatter(content);
  if (typeof meta.id === 'string' && typeof meta.syncMode === 'string') {
    return { id: meta.id, syncMode: meta.syncMode };
  }
  return null;
}

/**
 * Lists every file in the vault along with its parsed { id, syncMode }.
 * Files that fail to parse are silently skipped.
 */
export async function listVaultFiles(vaultPath: string): Promise<Array<{ path: string; fileName: string; parsed: ParsedVaultFile }>> {
  const flowrFS = (window as any).flowrFS;
  if (!flowrFS) return [];

  const fileNames: string[] = await flowrFS.readdir(vaultPath);
  const results: Array<{ path: string; fileName: string; parsed: ParsedVaultFile }> = [];

  for (const fileName of fileNames) {
    if (!fileName.endsWith('.md') && !fileName.endsWith('.canvas')) continue;
    const path = `${vaultPath}/${fileName}`;
    try {
      const content: string = await flowrFS.readFile(path);
      const parsed = parseVaultFile(fileName, content);
      if (parsed) results.push({ path, fileName, parsed });
    } catch {
      // Unreadable file — skip it.
    }
  }

  return results;
}

/**
 * Finds the vault file (if any) whose frontmatter/JSON id matches the given entity,
 * regardless of what the current filename would be (handles the case where the
 * entity's title changed while it was cloud-only, leaving an old-titled orphan).
 */
export async function findLocalFileForEntity(vaultPath: string, entity: { id: string }): Promise<string | null> {
  const files = await listVaultFiles(vaultPath);
  const match = files.find(f => f.parsed.id === entity.id);
  return match ? match.path : null;
}

export async function deleteVaultFile(path: string): Promise<void> {
  const flowrFS = (window as any).flowrFS;
  if (!flowrFS) return;
  await flowrFS.deleteFile(path);
}

export { getVaultPath };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/syncFileScan.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/syncFileScan.ts src/lib/syncFileScan.test.ts
git commit -m "feat: add vault file scanning helpers for sync-mode cleanup"
```

---

## Task 4: Add the mode-switch confirm popup

**Files:**
- Modify: `src/data/store.types.ts` (add `ModalType` variant)
- Modify: `src/data/store.ts` (wire `setSyncMode` to check for an existing file and open the modal)
- Create: `src/components/modals/SyncFileCleanupModal.tsx`
- Modify: `src/components/layout/Shell.tsx` (mount the modal)

- [ ] **Step 1: Update the `setSyncMode` type signature**

In `src/data/store.types.ts`, find (around line 628):

```typescript
  setSyncMode: (entityId: string, mode: SyncMode) => void;
```

Change to:

```typescript
  setSyncMode: (entityId: string, mode: SyncMode) => Promise<void>;
```

(Step 2 below makes the implementation `async`; existing callers that don't `await` it remain valid since they simply ignore the returned promise.)

- [ ] **Step 2: Add the modal type variant**

In `src/data/store.types.ts`, find the `ModalType` union (around line 236-247) and add a new variant before the closing `;`:

```typescript
export type ModalType =
  | null
  | { kind: 'newItem'; parentId?: string | null; initialType?: EntityType; defaultToFirstCollection?: boolean }
  | { kind: 'newCollection' }
  | { kind: 'deleteConfirm'; entityId?: string; entityIds?: string[]; isChat?: boolean }
  | { kind: 'moveTo'; entityId: string }
  | { kind: 'rename'; entityId: string }
  | { kind: 'newTask'; taskId?: string; sourceColumn?: string }
  | { kind: 'settings'; tab?: SettingsTab }
  | { kind: 'newWorkspace' }
  | { kind: 'mediaViewer'; url: string; mediaType: 'image' | 'audio' | 'video' | 'file'; description?: string; messageId?: string }
  | { kind: 'summaryPreview'; summary: string }
  | { kind: 'syncFileCleanup'; files: Array<{ path: string; entityId: string; entityTitle: string; recognized: boolean }> };
```

- [ ] **Step 3: Wire `setSyncMode` to detect an existing file and open the popup**

In `src/data/store.ts`, find `setSyncMode` (around line 189-206):

```typescript
      setSyncMode: (entityId, mode) => {
        set(s => ({
          entities: s.entities.map(e => e.id === entityId ? { ...e, syncMode: mode, lastModified: Date.now() } : e),
          workspaces: s.workspaces.map(w => w.id === entityId ? { ...w, syncMode: mode } : w)
        }));
        const ws = get().workspaces.find(w => w.id === entityId);
        if (ws) {
          upsertWorkspace(ws);
        }
        const entity = get().entities.find(e => e.id === entityId);
        if (entity) {
          import('@/lib/persistence').then(({ saveEntity }) => {
            saveEntity(entity).catch(err => console.error('[store] saveEntity failed:', err));
          });
        }
      },
```

Replace with (adds a check, before applying the mode change, for whether we're switching an entity *to* cloud-only while a local file exists — if so, apply the mode change but route file cleanup through the confirm modal instead of the normal `saveEntity` local-write path):

```typescript
      setSyncMode: async (entityId, mode) => {
        const prevEntity = get().entities.find(e => e.id === entityId);
        const switchingToCloudOnly = mode === 'cloud-only' &&
          prevEntity && (prevEntity.syncMode === 'local-only' || prevEntity.syncMode === 'full-sync');

        set(s => ({
          entities: s.entities.map(e => e.id === entityId ? { ...e, syncMode: mode, lastModified: Date.now() } : e),
          workspaces: s.workspaces.map(w => w.id === entityId ? { ...w, syncMode: mode } : w)
        }));
        const ws = get().workspaces.find(w => w.id === entityId);
        if (ws) {
          upsertWorkspace(ws);
        }
        const entity = get().entities.find(e => e.id === entityId);
        if (entity) {
          import('@/lib/persistence').then(({ saveEntity }) => {
            saveEntity(entity).catch(err => console.error('[store] saveEntity failed:', err));
          });
        }

        if (switchingToCloudOnly && entity && isDesktop()) {
          const { getVaultPath, findLocalFileForEntity } = await import('@/lib/syncFileScan');
          const vault = await getVaultPath();
          if (vault) {
            const filePath = await findLocalFileForEntity(vault, entity);
            if (filePath) {
              get().openModal({
                kind: 'syncFileCleanup',
                files: [{ path: filePath, entityId: entity.id, entityTitle: entity.title, recognized: true }],
              });
            }
          }
        }
      },
```

Note: `isDesktop` is already imported at the top of `store.ts` (used elsewhere in the file for the file-write subscriber in Task 2) — no new import needed for it.

- [ ] **Step 4: Create the modal component**

Create `src/components/modals/SyncFileCleanupModal.tsx`, modeled on the existing `DeleteConfirmModal`:

```tsx
"use client";

import { useState } from 'react';
import { useStore } from '@/data/store';
import { AlertTriangle } from 'lucide-react';
import { deleteVaultFile } from '@/lib/syncFileScan';

export function SyncFileCleanupModal() {
  const { modal, closeModal } = useStore();
  const [pending, setPending] = useState(false);

  if (!modal || modal.kind !== 'syncFileCleanup') return null;

  const { files } = modal;

  const handleResolve = async (deletePaths: string[]) => {
    setPending(true);
    try {
      await Promise.all(deletePaths.map(p => deleteVaultFile(p)));
    } catch (err) {
      console.error('[SyncFileCleanupModal] failed to delete file(s):', err);
    } finally {
      setPending(false);
      closeModal();
    }
  };

  const isBatch = files.length > 1;
  const title = isBatch
    ? `Found ${files.length} local file${files.length === 1 ? '' : 's'} out of sync`
    : `"${files[0].entityTitle}" is now cloud-only`;

  const description = isBatch
    ? `These items are cloud-only but still have local copies on disk. Choose whether to delete or keep each local copy.`
    : `A local copy of this file still exists on disk. You can delete it or keep it as an offline snapshot — it will not be updated while the item stays cloud-only.`;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-overlay" onClick={closeModal}>
      <div
        className="bg-panel border border-[var(--bone-12)] rounded-[1.25rem] p-5 w-[420px]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-full bg-danger/10">
            <AlertTriangle strokeWidth={2} className="w-4.5 h-4.5 text-danger" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          {description}
        </p>

        {isBatch && (
          <ul className="mb-4 max-h-48 overflow-y-auto text-sm text-foreground space-y-1">
            {files.map(f => (
              <li key={f.path} className="truncate">
                {f.recognized ? f.entityTitle : `Unrecognized file: ${f.path.split('/').pop()}`}
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            disabled={pending}
            onClick={() => handleResolve([])}
            className="px-4 py-2 border border-[var(--bone-6)] text-sm rounded-full text-muted-foreground hover:text-foreground hover:bg-hover disabled:opacity-50"
          >
            Keep local {isBatch ? 'copies' : 'copy'}
          </button>
          <button
            disabled={pending}
            onClick={() => handleResolve(files.map(f => f.path))}
            className="px-4 py-2 text-sm rounded-full bg-danger hover:bg-danger/80 text-white font-medium disabled:opacity-50"
          >
            Delete local {isBatch ? 'copies' : 'copy'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Mount the modal in Shell.tsx**

In `src/components/layout/Shell.tsx`, add the import near the other modal imports (around line 9, alongside `DeleteConfirmModal`):

```typescript
import { SyncFileCleanupModal } from '../modals/SyncFileCleanupModal';
```

And mount it near the other modals (around line 486, after `VaultSetupModal`):

```typescript
        <VaultSetupModal key="vault-setup" />
        <SyncFileCleanupModal key="sync-file-cleanup" />
```

- [ ] **Step 6: Manually verify types compile**

Run: `npx tsc --noEmit`
Expected: no new type errors introduced by this task's changes.

- [ ] **Step 7: Commit**

```bash
git add src/data/store.types.ts src/data/store.ts src/components/modals/SyncFileCleanupModal.tsx src/components/layout/Shell.tsx
git commit -m "feat: confirm popup for deleting/keeping local file when switching entity to cloud-only"
```

---

## Task 5: Add the startup stale-file scan

**Files:**
- Modify: `src/components/SupabaseProvider.tsx`

- [ ] **Step 1: Add the scan function**

In `src/components/SupabaseProvider.tsx`, add a new function above the `SupabaseProvider` component (after `mergeCloudData`, before the component definition around line 77):

```typescript
/**
 * After cloud data has loaded, scan the local vault for files that shouldn't
 * exist anymore: files belonging to now-cloud-only entities (stale orphans,
 * often left over from the syncMode-frontmatter bug), and files whose id
 * doesn't match any known entity at all (unrecognized). Surfaces one batched
 * confirm popup rather than one per file.
 */
async function scanForStaleLocalFiles() {
  const { isDesktop } = await import('@/lib/env');
  if (!isDesktop()) return;

  const { getVaultPath, listVaultFiles } = await import('@/lib/syncFileScan');
  const vault = await getVaultPath();
  if (!vault) return;

  const files = await listVaultFiles(vault);
  if (files.length === 0) return;

  const entities = useStore.getState().entities;
  const entityById = new Map(entities.map(e => [e.id, e]));

  const flagged: Array<{ path: string; entityId: string; entityTitle: string; recognized: boolean }> = [];

  for (const file of files) {
    const entity = entityById.get(file.parsed.id);
    if (!entity) {
      flagged.push({ path: file.path, entityId: file.parsed.id, entityTitle: file.fileName, recognized: false });
    } else if (entity.syncMode === 'cloud-only') {
      flagged.push({ path: file.path, entityId: entity.id, entityTitle: entity.title, recognized: true });
    }
  }

  if (flagged.length > 0) {
    useStore.getState().openModal({ kind: 'syncFileCleanup', files: flagged });
  }
}
```

- [ ] **Step 2: Call the scan after initial load completes**

In the `loadFromSupabase().then(async (data) => { ... })` block, find the end (around line 151):

```typescript
      useStore.getState().setInitialSync(false);
    }).catch(err => {
```

Change to:

```typescript
      useStore.getState().setInitialSync(false);
      scanForStaleLocalFiles();
    }).catch(err => {
```

- [ ] **Step 3: Manually verify types compile**

Run: `npx tsc --noEmit`
Expected: no new type errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/SupabaseProvider.tsx
git commit -m "feat: scan vault for stale/unrecognized local files on startup"
```

---

## Task 6: Manual end-to-end verification (desktop build)

**Files:** none (manual test only)

- [ ] **Step 1: Build and launch the desktop app**

Run: `npm run electron:dev` (or the project's existing desktop dev script — check `package.json` `scripts` if this name differs)

- [ ] **Step 2: Verify cloud-only entities get no local file**

Create a new note (defaults to `cloud-only` per `store.ts:1692`). Confirm no `.md` file appears in the vault folder for it.

- [ ] **Step 3: Verify switching to local-only writes a correct file**

Switch the note to `local-only` via its sync picker. Confirm a `.md` file appears in the vault with frontmatter `"syncMode":"local-only"` (not `full-sync`).

- [ ] **Step 4: Verify the mode-switch popup on switching back to cloud-only**

Switch the same note back to `cloud-only`. Confirm the `SyncFileCleanupModal` appears with a single-file message. Test "Delete local copy" — confirm the file is removed from the vault folder. Repeat with a second note, choosing "Keep local copy" instead — confirm the file remains untouched on disk.

- [ ] **Step 5: Verify startup scan catches pre-existing corrupted files**

With the app closed, manually create a file in the vault folder named `Orphan.md` with content:
```
---
"id": "fake-orphan-id"
"title": "Orphan"
"syncMode": "full-sync"
"lastModified": 1000
"version": 1
---

Some body text
```
This simulates a file left over from an entity that's now cloud-only, OR is fully unrecognized (since `fake-orphan-id` won't match any real entity, it'll show as "Unrecognized"). Relaunch the app. Confirm the batched `SyncFileCleanupModal` appears listing `Orphan.md` as unrecognized, and that choosing delete removes it.

- [ ] **Step 6: Verify title-change orphan scenario**

Create a note, switch it to `local-only` (file appears as `Test.md`). Switch to `cloud-only`, choose "Keep local copy" in the popup. Edit the entity's title via Supabase directly (or via a second device/browser session against the same account) to `Test Renamed`. Switch the entity back to `local-only` in the desktop app. Confirm a *new* file `Test Renamed.md` is written, and relaunching the app flags the original `Test.md` (matched by frontmatter id, now belonging to a `local-only` entity whose current file lives elsewhere) — note: per the design, only `cloud-only`-owned or unrecognized files are flagged, so if the entity is `local-only` again this stale `Test.md` will show up as **unrecognized** only if its id doesn't match the entity — but the id *does* match. Confirm actual behavior and, if the old-titled file for a currently-local-only entity is not flagged, note this as a known gap for follow-up (not a blocker — out of scope per the design's non-goals on merge semantics).

---

## Self-Review Notes

- **Spec coverage:** Fix #1 (frontmatter fallback) → Task 1. Fix #2 (gated subscriber) → Task 2. Mode-switch popup → Task 4. Startup batched scan → Task 5. Frontmatter-id matching with recognized/unrecognized split → Task 3 (`syncFileScan.ts`) + Task 5. `.canvas` JSON format handled explicitly in `parseVaultFile`. Manual verification of the full flow, including the title-change edge case discussed during brainstorming → Task 6.
- **Known limitation surfaced during planning:** Task 6 Step 6 identifies that an old-titled orphan file belonging to an entity that has since returned to `local-only` won't be flagged by the current scan logic (which only flags `cloud-only`-owned or fully-unrecognized files) — the id *does* match a `local-only` entity, so it's silently ignored, but it's a duplicate/stale file at a stale path. This is out of scope per the spec's non-goals ("not deduplicating/merging content"), but is called out explicitly for the user to decide on a follow-up if it matters in practice.
