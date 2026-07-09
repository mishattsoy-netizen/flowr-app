# SQLite Local Storage & Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace desktop-local Markdown file-vault persistence with a local, unencrypted SQLite database (`better-sqlite3`, Electron main process), covering `entities`, `tasks`, and `spaces`, while debouncing the existing per-mutation Supabase push and adding a one-time importer for existing users' local data.

**Architecture:** SQLite lives entirely in the Electron main process, exposed to the renderer via a new `flowrDB` IPC bridge (parallel to the existing `flowrFS` bridge). The existing `isDesktop()` `useStore.subscribe()` watcher in `src/data/store.ts` (currently calling `saveEntityToFile`) becomes the single write-through point to SQLite, extended to also cover `tasks` and `spaces`. The ~13 existing per-mutation Supabase push call sites (`upsertEntity`/`upsertTask`/`upsertSpace`) are wrapped in a per-id 1.5s debounce at their call sites — never as a new subscriber — preserving the invariant that pulls (`mergeCloudData` via `setEntities`/`setTasks`/`setSpaces`) never re-trigger a Supabase push. `tasks`/`spaces` gain a `last_modified` column (Supabase + local) they don't have today, making their LWW merge correct for the first time.

**Tech Stack:** `better-sqlite3` (Electron main process, synchronous), Electron IPC (`ipcMain.handle`/`contextBridge`), existing Zustand store + Supabase (`@supabase/supabase-js`) + `src/lib/sync.ts` row mappers, Vitest for unit tests.

**Reference spec:** `docs/superpowers/specs/2026-07-09-sqlite-local-storage-and-sync-design.md`

---

## Execution Assignment & Protocol (multi-model split)

This plan is split across multiple AI coding assistants/models to conserve a limited Claude usage budget. Each task below is tagged with an assigned model tier. Follow the assignment — do not silently reassign a task to a stronger or weaker model without flagging it to the user first.

### Model tiers

- **Tier A (mechanical/boilerplate — cheapest models: DeepSeek V4 Flash, Qwen 3.7 Flash, GLM small, Gemini 3.5 Flash low):** Tasks 1, 2, 3, 4, 11, 13. Code blocks are already fully written in this plan; the task is "copy this in, wire it up, run the given commands." Subtasks are pre-split finer than usual for this tier — treat each Step as its own unit of work, do not batch steps.
- **Tier B (moderate — mid models: Qwen 3.7 Max/Plus, GLM 5.2, Gemini 3.5 Flash mid/high):** Tasks 5, 8, 10, 12, 14. Requires locating existing code correctly, integrating without regressing surrounding behavior, and coordinating 2-4 files. The exact logic is still pinned in the plan; the risk is misapplying it to the wrong call site or missing one.
- **Tier C (hardest — reserve for Claude or Gemini 3.1 Pro high):** Tasks 6, 9. These are the two places where a previous review pass in this same plan caught a real correctness bug (echo loop risk in Task 6's debounce placement; data-loss race in Task 9's boot hydration). A weaker model is likely to reintroduce a variant of one of these bugs while "simplifying" the approach. Do not delegate these to a Tier A/B model.

### Mandatory per-task protocol

For **every** task, regardless of tier, the assigned executor must:

1. **Execute** all steps in the task in order.
2. **Verify** — run every command marked `Run:` in the task and confirm the `Expected:` outcome actually occurred (paste/report the real output, not an assumption of success).
3. **Double-verify + compliance check against previous tasks** — before committing, re-read the tasks completed so far (their "Files" sections and any invariants called out in bold) and confirm this task didn't violate one. Specifically re-check, every time:
   - Did this task add any code that calls `upsertEntity`/`upsertTask`/`upsertSpace` (or the debounced wrappers) from inside `setEntities`/`setTasks`/`setSpaces` or any pull/merge path? (Must be NO — see Task 6's echo invariant.)
   - Did this task pass SQLite-sourced data through `mergeCloudData` or any other drop-on-absence merge? (Must be NO — see Task 9.)
   - Do all field names/row shapes match the schema exactly as defined in Task 1/3 (no silent renames)?
4. **Stop and report back to the user for review.** Do not proceed to the next task automatically, even if this task's own verification passed. State clearly: what was done, what was verified (with actual command output), and any deviation from the plan's written steps (and why).

If a task's steps don't match what the executor finds in the actual codebase (e.g. a line number has shifted, a function was renamed since this plan was written), the executor should adapt using its best judgment but must flag the deviation explicitly in its report rather than silently improvising past it.

---

## Task 1: Install `better-sqlite3` and open the local database in the main process

**Assigned model tier: A (mechanical) — e.g. DeepSeek V4 Flash, Qwen 3.7 Flash, Gemini 3.5 Flash low.**

**Files:**
- Modify: `package.json`
- Create: `electron/db.js`
- Modify: `electron/main.js`

- [x] **Step 1: Install the dependency**

Run: `npm install better-sqlite3`
Expected: adds `better-sqlite3` to `dependencies` in `package.json`, installs native binary via prebuild-install (no compiler toolchain needed on Windows/Mac for standard Node/Electron ABI versions).

- [x] **Step 2: Create `electron/db.js` — schema + connection module**

```javascript
// electron/db.js
const path = require('path');
const Database = require('better-sqlite3');

let db = null;

function getDbPath(app) {
  return path.join(app.getPath('userData'), 'flowr.db');
}

function initDb(app) {
  if (db) return db;
  db = new Database(getDbPath(app));
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS entities (
      id             TEXT PRIMARY KEY,
      title          TEXT NOT NULL DEFAULT '',
      type           TEXT NOT NULL,
      parent_id      TEXT,
      last_modified  INTEGER NOT NULL DEFAULT 0,
      icon           TEXT,
      tags           TEXT,
      content        TEXT,
      sort_order     INTEGER DEFAULT 0,
      space_id       TEXT,
      sync_mode      TEXT NOT NULL DEFAULT 'local-only',
      paired_entity_id TEXT,
      widget_layout  TEXT
    );
    CREATE INDEX IF NOT EXISTS entities_parent_id_idx ON entities(parent_id);
    CREATE INDEX IF NOT EXISTS entities_type_idx ON entities(type);

    CREATE TABLE IF NOT EXISTS tasks (
      id             TEXT PRIMARY KEY,
      title          TEXT NOT NULL DEFAULT '',
      completed      INTEGER NOT NULL DEFAULT 0,
      due_date       TEXT,
      end_date       TEXT,
      include_time   INTEGER,
      reminder       TEXT,
      entity_id      TEXT,
      space_id       TEXT,
      note           TEXT,
      color          TEXT,
      priority       TEXT,
      status         TEXT,
      position       REAL,
      created_at     INTEGER,
      completed_at   INTEGER,
      last_modified  INTEGER NOT NULL DEFAULT 0,
      subtasks       TEXT,
      attachments    TEXT,
      description    TEXT,
      user_due_date  TEXT,
      tag            TEXT,
      sync_mode      TEXT NOT NULL DEFAULT 'local-only'
    );

    CREATE TABLE IF NOT EXISTS spaces (
      id             TEXT PRIMARY KEY,
      name           TEXT NOT NULL,
      type           TEXT NOT NULL DEFAULT 'personal',
      icon           TEXT,
      color          TEXT,
      settings       TEXT,
      is_default     INTEGER NOT NULL DEFAULT 0,
      created_at     INTEGER,
      last_modified  INTEGER NOT NULL DEFAULT 0,
      sync_mode      TEXT NOT NULL DEFAULT 'local-only'
    );
  `);

  return db;
}

function getDb() {
  if (!db) throw new Error('[flowr-db] initDb() must be called before getDb()');
  return db;
}

module.exports = { initDb, getDb, getDbPath };
```

- [x] **Step 3: Wire `initDb` into `electron/main.js` app startup**

Find the `app.whenReady()` block in `electron/main.js` (search for `app.whenReady`) and add the db init call before `createWindow()` (or equivalent) runs. Example — locate the existing block:

```javascript
app.whenReady().then(() => {
  // ... existing setup ...
});
```

Add near the top of that block, after `app` is ready but before any window is created:

```javascript
const { initDb } = require('./db');
initDb(app);
```

- [x] **Step 4: Manual verification**

Run: `npm run electron:dev`
Expected: app launches without errors; check `%APPDATA%/flowr-beta/flowr.db` (or platform equivalent via `app.getPath('userData')`) exists after launch. Confirm no `better-sqlite3` native module load errors in the console/log (`electron/main.js` logs to `flowr-startup.log` in the OS temp dir — check there if the window doesn't appear).

- [x] **Step 5: Commit**

```bash
git add package.json package-lock.json electron/db.js electron/main.js
git commit -m "feat(db): add better-sqlite3 and local schema for entities/tasks/spaces"
```

---

## Task 2: Add `flowrDB` IPC handlers in main process for `entities`

**Assigned model tier: A (mechanical) — e.g. DeepSeek V4 Flash, Qwen 3.7 Flash, Gemini 3.5 Flash low.**

**Files:**
- Modify: `electron/db.js`
- Modify: `electron/main.js`

- [x] **Step 1: Add row mapper + CRUD functions to `electron/db.js`**

Append to `electron/db.js` (before `module.exports`):

```javascript
function upsertEntity(app, row) {
  const database = initDb(app);
  const stmt = database.prepare(`
    INSERT INTO entities (id, title, type, parent_id, last_modified, icon, tags, content, sort_order, space_id, sync_mode, paired_entity_id, widget_layout)
    VALUES (@id, @title, @type, @parent_id, @last_modified, @icon, @tags, @content, @sort_order, @space_id, @sync_mode, @paired_entity_id, @widget_layout)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      type = excluded.type,
      parent_id = excluded.parent_id,
      last_modified = excluded.last_modified,
      icon = excluded.icon,
      tags = excluded.tags,
      content = excluded.content,
      sort_order = excluded.sort_order,
      space_id = excluded.space_id,
      sync_mode = excluded.sync_mode,
      paired_entity_id = excluded.paired_entity_id,
      widget_layout = excluded.widget_layout
  `);
  stmt.run(row);
}

function deleteEntity(app, id) {
  const database = initDb(app);
  database.prepare('DELETE FROM entities WHERE id = ?').run(id);
}

function getAllEntities(app) {
  const database = initDb(app);
  return database.prepare('SELECT * FROM entities').all();
}

module.exports = { initDb, getDb, getDbPath, upsertEntity, deleteEntity, getAllEntities };
```

- [x] **Step 2: Register IPC handlers in `electron/main.js`**

Find the block of `ipcMain.handle('fs:...', ...)` registrations (around line 428). Add nearby:

```javascript
const flowrDb = require('./db');

ipcMain.handle('db:upsertEntity', async (_, row) => flowrDb.upsertEntity(app, row));
ipcMain.handle('db:deleteEntity', async (_, id) => flowrDb.deleteEntity(app, id));
ipcMain.handle('db:getAllEntities', async () => flowrDb.getAllEntities(app));
```

- [x] **Step 3: Expose `flowrDB` in `electron/preload.js`**

Add after the existing `flowrFS` block in `electron/preload.js`:

```javascript
contextBridge.exposeInMainWorld('flowrDB', {
  upsertEntity: (row) => ipcRenderer.invoke('db:upsertEntity', row),
  deleteEntity: (id) => ipcRenderer.invoke('db:deleteEntity', id),
  getAllEntities: () => ipcRenderer.invoke('db:getAllEntities'),
});
```

- [x] **Step 4: Manual verification**

Run: `npm run electron:dev`, open DevTools in the app window (Ctrl+Shift+I), run in the console:

```javascript
await window.flowrDB.upsertEntity({ id: 'test-1', title: 'Hello', type: 'note', parent_id: null, last_modified: Date.now(), icon: null, tags: '[]', content: '[]', sort_order: 0, space_id: null, sync_mode: 'local-only', paired_entity_id: null, widget_layout: null });
await window.flowrDB.getAllEntities();
```

Expected: second call returns an array containing the `test-1` row.

- [x] **Step 5: Commit**

```bash
git add electron/db.js electron/main.js electron/preload.js
git commit -m "feat(db): expose flowrDB IPC bridge for entities CRUD"
```

---

## Task 3: Extend `flowrDB` IPC handlers to `tasks` and `spaces`

**Assigned model tier: A (mechanical) — e.g. DeepSeek V4 Flash, Qwen 3.7 Flash, Gemini 3.5 Flash low.** Nearly identical in shape to Task 2 — same executor can likely do both back to back.

**Files:**
- Modify: `electron/db.js`
- Modify: `electron/main.js`
- Modify: `electron/preload.js`

- [x] **Step 1: Add task/space CRUD functions to `electron/db.js`**

Append before `module.exports`:

```javascript
function upsertTask(app, row) {
  const database = initDb(app);
  const stmt = database.prepare(`
    INSERT INTO tasks (id, title, completed, due_date, end_date, include_time, reminder, entity_id, space_id, note, color, priority, status, position, created_at, completed_at, last_modified, subtasks, attachments, description, user_due_date, tag, sync_mode)
    VALUES (@id, @title, @completed, @due_date, @end_date, @include_time, @reminder, @entity_id, @space_id, @note, @color, @priority, @status, @position, @created_at, @completed_at, @last_modified, @subtasks, @attachments, @description, @user_due_date, @tag, @sync_mode)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title, completed = excluded.completed, due_date = excluded.due_date,
      end_date = excluded.end_date, include_time = excluded.include_time, reminder = excluded.reminder,
      entity_id = excluded.entity_id, space_id = excluded.space_id, note = excluded.note,
      color = excluded.color, priority = excluded.priority, status = excluded.status,
      position = excluded.position, created_at = excluded.created_at, completed_at = excluded.completed_at,
      last_modified = excluded.last_modified, subtasks = excluded.subtasks, attachments = excluded.attachments,
      description = excluded.description, user_due_date = excluded.user_due_date, tag = excluded.tag,
      sync_mode = excluded.sync_mode
  `);
  stmt.run(row);
}

function deleteTask(app, id) {
  initDb(app).prepare('DELETE FROM tasks WHERE id = ?').run(id);
}

function getAllTasks(app) {
  return initDb(app).prepare('SELECT * FROM tasks').all();
}

function upsertSpace(app, row) {
  const database = initDb(app);
  const stmt = database.prepare(`
    INSERT INTO spaces (id, name, type, icon, color, settings, is_default, created_at, last_modified, sync_mode)
    VALUES (@id, @name, @type, @icon, @color, @settings, @is_default, @created_at, @last_modified, @sync_mode)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name, type = excluded.type, icon = excluded.icon, color = excluded.color,
      settings = excluded.settings, is_default = excluded.is_default, created_at = excluded.created_at,
      last_modified = excluded.last_modified, sync_mode = excluded.sync_mode
  `);
  stmt.run(row);
}

function deleteSpace(app, id) {
  initDb(app).prepare('DELETE FROM spaces WHERE id = ?').run(id);
}

function getAllSpaces(app) {
  return initDb(app).prepare('SELECT * FROM spaces').all();
}

module.exports = {
  initDb, getDb, getDbPath,
  upsertEntity, deleteEntity, getAllEntities,
  upsertTask, deleteTask, getAllTasks,
  upsertSpace, deleteSpace, getAllSpaces,
};
```

- [x] **Step 2: Register IPC handlers in `electron/main.js`**

Add next to the entity handlers from Task 2:

```javascript
ipcMain.handle('db:upsertTask', async (_, row) => flowrDb.upsertTask(app, row));
ipcMain.handle('db:deleteTask', async (_, id) => flowrDb.deleteTask(app, id));
ipcMain.handle('db:getAllTasks', async () => flowrDb.getAllTasks(app));

ipcMain.handle('db:upsertSpace', async (_, row) => flowrDb.upsertSpace(app, row));
ipcMain.handle('db:deleteSpace', async (_, id) => flowrDb.deleteSpace(app, id));
ipcMain.handle('db:getAllSpaces', async () => flowrDb.getAllSpaces(app));
```

- [x] **Step 3: Extend `electron/preload.js`**

```javascript
contextBridge.exposeInMainWorld('flowrDB', {
  upsertEntity: (row) => ipcRenderer.invoke('db:upsertEntity', row),
  deleteEntity: (id) => ipcRenderer.invoke('db:deleteEntity', id),
  getAllEntities: () => ipcRenderer.invoke('db:getAllEntities'),
  upsertTask: (row) => ipcRenderer.invoke('db:upsertTask', row),
  deleteTask: (id) => ipcRenderer.invoke('db:deleteTask', id),
  getAllTasks: () => ipcRenderer.invoke('db:getAllTasks'),
  upsertSpace: (row) => ipcRenderer.invoke('db:upsertSpace', row),
  deleteSpace: (id) => ipcRenderer.invoke('db:deleteSpace', id),
  getAllSpaces: () => ipcRenderer.invoke('db:getAllSpaces'),
});
```

- [x] **Step 4: Manual verification**

Run: `npm run electron:dev`, in DevTools console:

```javascript
await window.flowrDB.upsertTask({ id: 't-1', title: 'Test task', completed: 0, due_date: null, end_date: null, include_time: null, reminder: null, entity_id: null, space_id: null, note: null, color: null, priority: null, status: null, position: null, created_at: Date.now(), completed_at: null, last_modified: Date.now(), subtasks: null, attachments: null, description: null, user_due_date: null, tag: null, sync_mode: 'local-only' });
await window.flowrDB.getAllTasks();
```

Expected: returns array with `t-1`.

- [x] **Step 5: Commit**

```bash
git add electron/db.js electron/main.js electron/preload.js
git commit -m "feat(db): extend flowrDB IPC bridge to tasks and spaces"
```

---

## Task 4: Add `lastModified` to `AppTask` and `Space` types + Supabase migration

**Assigned model tier: A (mechanical) — e.g. DeepSeek V4 Flash, Qwen 3.7 Flash, Gemini 3.5 Flash low.** Step 4 (finding every task/space mutation site and adding `lastModified: Date.now()`) is the one part of this task requiring care — if using a Tier A model, consider splitting Step 4 into its own sub-pass: first `grep` and list every match, then edit each one individually and re-run `tsc --noEmit` after each, rather than editing all at once.

**Files:**
- Create: `supabase/migrations/20260709_tasks_spaces_last_modified.sql`
- Modify: `src/data/store.types.ts`
- Modify: `src/lib/sync.ts`

- [x] **Step 1: Write the Supabase migration**

```sql
-- supabase/migrations/20260709_tasks_spaces_last_modified.sql
ALTER TABLE tasks  ADD COLUMN IF NOT EXISTS last_modified bigint NOT NULL DEFAULT 0;
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS last_modified bigint NOT NULL DEFAULT 0;
```

Run this against the Supabase project (paste into Supabase Dashboard > SQL Editor, per the convention noted in `supabase/schema.sql`'s header comment). This is a manual/external step — no automated test covers a live Supabase schema change.

- [x] **Step 2: Add `lastModified` to the `AppTask` and `Space` TypeScript interfaces**

In `src/data/store.types.ts`, add `lastModified: number;` to `AppTask` (after `id`) and to `Space` (after `id`):

```typescript
export interface Space {
  id: string;
  name: string;
  type: SpaceType;
  ownerId: string | null;
  createdAt: number;
  lastModified: number;
  icon?: string;
  color?: string;
  settings?: Record<string, unknown>;
  syncMode: SyncMode;
  isDefault?: boolean;
}
```

```typescript
export interface AppTask {
  id: string;
  title: string;
  completed: boolean;
  lastModified: number;
  dueDate?: string;
  // ...(rest unchanged)
}
```

- [x] **Step 3: Update `rowToTask`/`taskToRow`/`rowToWorkspace`/`spaceToRow`-equivalent mappers in `src/lib/sync.ts`**

Find `rowToTask` (line 160) and add `lastModified: row.last_modified ?? 0,` to the returned object. Find `taskToRow` (line 185) and add `row.last_modified = t.lastModified ?? 0;`.

Find `rowToWorkspace` (search for `function rowToWorkspace`) and add `lastModified: row.last_modified ?? 0,`. Find the corresponding `spaceToRow`-style function used by `upsertSpace` (search for `function spaceToRow` or inline object construction inside `upsertSpace`) and add `row.last_modified = w.lastModified ?? 0;` (or equivalent field name for the local variable).

- [x] **Step 4: Set `lastModified` at every task/space mutation site in the store**

Run: `grep -n "setTasks\|updateTask\|addTask\|setSpaces\|updateSpace\|addSpace" src/data/store.ts` — for each action that mutates a task or space object, add `lastModified: Date.now()` to the updated object, following the same pattern already used for `Entity.lastModified` throughout the file (e.g. `updateEntityContent`'s `{ ...e, content, lastModified: now }`).

- [x] **Step 5: Run typecheck**

Run: `npx tsc --noEmit`
Expected: no new type errors (or fix any places constructing `AppTask`/`Space` literals that now need `lastModified`, e.g. test fixtures and seed data in `store.ts`).

- [x] **Step 6: Commit**

```bash
git add supabase/migrations/20260709_tasks_spaces_last_modified.sql src/data/store.types.ts src/lib/sync.ts src/data/store.ts
git commit -m "feat(sync): add lastModified to tasks and spaces for correct LWW merge"
```

---

## Task 5: Fix `mergeCloudData` to use real LWW for tasks and spaces

**Assigned model tier: B (moderate) — e.g. Qwen 3.7 Max/Plus, GLM 5.2, Gemini 3.5 Flash mid/high.** Requires correctly locating and replacing the existing (buggy) merge block without touching the adjacent, already-correct entity merge logic.

**Files:**
- Modify: `src/components/SupabaseProvider.tsx`
- Test: `src/components/SupabaseProvider.mergeCloudData.test.ts`

- [x] **Step 1: Write the failing test**

```typescript
// src/components/SupabaseProvider.mergeCloudData.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/sync', () => ({
  loadFromSupabase: vi.fn(),
  subscribeRealtime: vi.fn(),
  upsertSpace: vi.fn(),
}));
vi.mock('@/lib/supabase', () => ({ isSupabaseEnabled: false, supabase: null }));

import { useStore } from '@/data/store';

// mergeCloudData is not exported today; this test drives it indirectly via
// the store state it mutates. Import the function directly once exported (Step 2).
import { mergeCloudData } from './SupabaseProvider';

describe('mergeCloudData task LWW', () => {
  beforeEach(() => {
    useStore.setState({
      tasks: [{ id: 't-1', title: 'Local edit', completed: false, lastModified: 2000, syncMode: 'full-sync' } as any],
      entities: [],
      spaces: [],
    });
  });

  it('keeps the local task when local.lastModified is newer than remote', () => {
    mergeCloudData({
      entities: [],
      tasks: [{ id: 't-1', title: 'Stale remote', completed: false, lastModified: 1000, syncMode: 'full-sync' } as any],
      spaces: [],
    });
    expect(useStore.getState().tasks[0].title).toBe('Local edit');
  });

  it('takes the remote task when remote.lastModified is newer than local', () => {
    mergeCloudData({
      entities: [],
      tasks: [{ id: 't-1', title: 'Newer remote', completed: false, lastModified: 5000, syncMode: 'full-sync' } as any],
      spaces: [],
    });
    expect(useStore.getState().tasks[0].title).toBe('Newer remote');
  });
});
```

- [x] **Step 2: Export `mergeCloudData` from `SupabaseProvider.tsx`**

In `src/components/SupabaseProvider.tsx`, change `function mergeCloudData(` to `export function mergeCloudData(`.

- [x] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/components/SupabaseProvider.mergeCloudData.test.ts`
Expected: FAIL — the current task merge branch (lines ~44-62) doesn't correctly compare `lastModified` for tasks (it currently only cares whether the task exists in cloud data, not the timestamp comparison this test expects), so the "keeps local when local is newer" case fails.

- [x] **Step 4: Fix the task merge branch to use real LWW**

Replace the `// ── Tasks ──` block in `mergeCloudData` (`src/components/SupabaseProvider.tsx`, ~line 43-62) with:

```typescript
  // ── Tasks ──
  if (data.tasks.length > 0) {
    const localTasks = store().tasks;
    const byId = new Map<string, AppTask>();
    for (const ct of data.tasks) byId.set(ct.id, ct);
    for (const lt of localTasks) {
      const ct = byId.get(lt.id);
      if (!ct) {
        continue; // not in cloud — assume deleted on another device (or RLS now blocks it)
      }
      if ((lt.lastModified ?? 0) > (ct.lastModified ?? 0)) {
        byId.set(lt.id, lt);
      }
    }
    store().setTasks(Array.from(byId.values()));
  }
```

Apply the equivalent fix to the `// ── Workspaces ──` block for spaces, replacing its current merge-without-timestamp-comparison logic with the same `lastModified`-comparison pattern used for entities.

- [x] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/components/SupabaseProvider.mergeCloudData.test.ts`
Expected: PASS (both tests).

- [x] **Step 6: Commit**

```bash
git add src/components/SupabaseProvider.tsx src/components/SupabaseProvider.mergeCloudData.test.ts
git commit -m "fix(sync): use real lastModified-based LWW for tasks and spaces merge"
```

---

## Task 6: Add debounced Supabase push wrapper and use it at all per-mutation call sites

**Assigned model tier: C (hardest — Claude or Gemini 3.1 Pro high only). Do not delegate to a Tier A/B model.** This task carries the plan's core anti-echo invariant: the debounce MUST be added as a wrapper at existing call sites, never as a new `lastModified`-watching subscriber (a subscriber can't tell a user edit from a just-pulled state update and would reintroduce the exact echo bug this design avoids — see the spec's Section 2/3 for the full trace). It also requires finding and fixing an *unknown, not-fully-enumerated* set of existing test files (Step 6) — a task that rewards careful searching over speed. Keep this one for yourself.

**Files:**
- Create: `src/lib/debouncedPush.ts`
- Test: `src/lib/debouncedPush.test.ts`
- Modify: `src/data/store.ts`

- [x] **Step 1: Write the failing test for the debounce wrapper**

```typescript
// src/lib/debouncedPush.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDebouncedPush } from './debouncedPush';

describe('createDebouncedPush', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('collapses rapid calls for the same id into a single push after the delay', () => {
    const pushFn = vi.fn();
    const debouncedPush = createDebouncedPush(pushFn, 1500);

    debouncedPush({ id: 'a', v: 1 });
    debouncedPush({ id: 'a', v: 2 });
    debouncedPush({ id: 'a', v: 3 });

    expect(pushFn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1500);
    expect(pushFn).toHaveBeenCalledTimes(1);
    expect(pushFn).toHaveBeenCalledWith({ id: 'a', v: 3 });
  });

  it('pushes independently for different ids', () => {
    const pushFn = vi.fn();
    const debouncedPush = createDebouncedPush(pushFn, 1500);

    debouncedPush({ id: 'a', v: 1 });
    debouncedPush({ id: 'b', v: 1 });

    vi.advanceTimersByTime(1500);
    expect(pushFn).toHaveBeenCalledTimes(2);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/debouncedPush.test.ts`
Expected: FAIL with "Cannot find module './debouncedPush'"

- [x] **Step 3: Implement `createDebouncedPush`**

```typescript
// src/lib/debouncedPush.ts
export function createDebouncedPush<T extends { id: string }>(
  pushFn: (item: T) => void,
  delayMs: number
): (item: T) => void {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  return (item: T) => {
    const existing = timers.get(item.id);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      timers.delete(item.id);
      pushFn(item);
    }, delayMs);

    timers.set(item.id, timer);
  };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/debouncedPush.test.ts`
Expected: PASS.

- [x] **Step 5: Wire debounced instances into `store.ts` and replace direct push calls**

In `src/data/store.ts`, near the top (after the `upsertEntity`, `upsertTask`, `upsertSpace` imports), add:

```typescript
import { createDebouncedPush } from '@/lib/debouncedPush';

const debouncedPushEntity = createDebouncedPush<Entity>((e) => { upsertEntity(e); }, 1500);
const debouncedPushTask = createDebouncedPush<AppTask>((t) => { upsertTask(t); }, 1500);
const debouncedPushSpace = createDebouncedPush<Space>((s) => { upsertSpace(s); }, 1500);
```

Run: `grep -n "upsertEntity(\|upsertTask(\|upsertSpace(" src/data/store.ts` to list every call site (there are ~13 for entities, plus task/space call sites). For each call site **inside a mutation action** (e.g. `addEntity`, `updateEntityContent`, `duplicateBlocks`, task/space update actions), replace the direct call:

```typescript
// before
upsertEntity(finalEntity);
// after
debouncedPushEntity(finalEntity);
```

**Do not** touch `setEntities`/`setTasks`/`setSpaces` (`store.ts:234`, `:527`, `:3241`) — they must continue to never call any push function, direct or debounced, preserving the pull-echo invariant from the spec.

- [x] **Step 6: Find every existing test asserting on push call counts/args, then run the full suite**

Run: `grep -rln "upsertEntity\|upsertTask\|upsertSpace" src/data/*.test.ts src/**/*.test.ts` to get the complete list of test files that assert on these mocks — do not rely on the three files named in earlier steps of this plan, as that list may be incomplete. For every match, add `vi.useFakeTimers()` in `beforeEach` (or per-test) and `vi.advanceTimersByTime(1500)` immediately before any assertion on `upsertEntity`/`upsertTask`/`upsertSpace` call counts or arguments, since those calls now happen 1.5s after the triggering action via `debouncedPush` instead of synchronously.

Run: `npx vitest run`
Expected: PASS across the full suite once every matched file is updated.

- [x] **Step 7: Commit**

```bash
git add src/lib/debouncedPush.ts src/lib/debouncedPush.test.ts src/data/store.ts
git add $(grep -rln "upsertEntity\|upsertTask\|upsertSpace" src/data/*.test.ts src/**/*.test.ts 2>/dev/null)
git commit -m "feat(sync): debounce per-entity Supabase push by 1.5s at existing call sites"
```

---

## Task 7: Replace the desktop file-vault subscriber with SQLite write-through for entities

**Assigned model tier: B (moderate) — e.g. Qwen 3.7 Max/Plus, GLM 5.2, Gemini 3.5 Flash mid/high.** Single well-scoped subscriber replacement with the exact code already written; the judgment required is confirming the trigger condition (`syncMode === 'cloud-only'` exclusion) is preserved exactly, not "improved."

**Files:**
- Modify: `src/data/store.ts`

- [x] **Step 1: Locate and read the existing `isDesktop()` subscriber**

Run: `grep -n "if (isDesktop())" src/data/store.ts` — confirm it's still around line 3518 (may have shifted from earlier edits in this plan).

- [x] **Step 2: Replace `saveEntityToFile` call with `flowrDB.upsertEntity`**

Replace the subscriber body:

```typescript
if (isDesktop()) {
  useStore.subscribe((state, prevState) => {
    for (const entity of state.entities) {
      if (entity.type !== 'note' && entity.type !== 'canvas') continue;
      if (entity.syncMode === 'cloud-only') continue;
      const prev = prevState.entities.find(e => e.id === entity.id);
      if (!prev || prev.lastModified !== entity.lastModified) {
        const blocks = entity.type === 'canvas'
          ? state.blocks.filter(b => b.canvasId === entity.id)
          : (entity.content || []);
        const row = {
          id: entity.id,
          title: entity.title,
          type: entity.type,
          parent_id: entity.parentId ?? null,
          last_modified: entity.lastModified,
          icon: entity.icon ?? null,
          tags: JSON.stringify(entity.tags ?? []),
          content: JSON.stringify(blocks),
          sort_order: entity.sortOrder ?? 0,
          space_id: entity.spaceId ?? null,
          sync_mode: entity.syncMode,
          paired_entity_id: entity.pairedEntityId ?? null,
          widget_layout: entity.widgetLayout ? JSON.stringify(entity.widgetLayout) : null,
        };
        (window as any).flowrDB?.upsertEntity(row);
      }
    }
  });
}
```

- [x] **Step 3: Remove the now-unused `saveEntityToFile` import if no longer referenced elsewhere**

Run: `grep -n "saveEntityToFile" src/data/store.ts src/lib/persistence.ts` — if `store.ts` no longer calls it, remove its import from `store.ts`. Leave `saveEntityToFile` itself defined in `src/lib/persistence.ts` for now (removing the Markdown-writing code path entirely is a separate cleanup, not required for this task to function correctly — the spec's "Out of Scope" section defers continued Markdown support, not necessarily deleting the old function in this same task).

- [x] **Step 4: Manual verification**

Run: `npm run electron:dev`. Create a new note, type some content. In DevTools console: `await window.flowrDB.getAllEntities()`.
Expected: the new note appears as a row with `content` containing the typed text as JSON.

- [x] **Step 5: Commit**

```bash
git add src/data/store.ts
git commit -m "feat(db): write entities through to SQLite instead of Markdown file-vault"
```

---

## Task 8: Extend the desktop subscriber to `tasks` and `spaces`

**Assigned model tier: B (moderate) — e.g. Qwen 3.7 Max/Plus, GLM 5.2, Gemini 3.5 Flash mid/high.** Same pattern as Task 7, applied twice more; code is fully written in the plan.

**Files:**
- Modify: `src/data/store.ts`

- [x] **Step 1: Add task and space write-through subscribers**

Immediately after the entity subscriber from Task 7 (still inside `if (isDesktop()) { ... }`, or as a second `useStore.subscribe(...)` call within the same `if (isDesktop())` block), add:

```typescript
  useStore.subscribe((state, prevState) => {
    for (const task of state.tasks) {
      const prev = prevState.tasks.find(t => t.id === task.id);
      if (!prev || prev.lastModified !== task.lastModified) {
        const row = {
          id: task.id,
          title: task.title,
          completed: task.completed ? 1 : 0,
          due_date: task.dueDate ?? null,
          end_date: task.endDate ?? null,
          include_time: task.includeTime ? 1 : null,
          reminder: task.reminder ?? null,
          entity_id: task.entityId ?? null,
          space_id: task.spaceId ?? null,
          note: task.note ?? null,
          color: task.color ?? null,
          priority: task.priority ?? null,
          status: task.status ?? null,
          position: task.position ?? null,
          created_at: task.createdAt ?? null,
          completed_at: task.completedAt ?? null,
          last_modified: task.lastModified,
          subtasks: task.subtasks ? JSON.stringify(task.subtasks) : null,
          attachments: task.attachments ? JSON.stringify(task.attachments) : null,
          description: task.description ?? null,
          user_due_date: task.userDueDate ?? null,
          tag: task.tag ?? null,
          sync_mode: task.syncMode,
        };
        (window as any).flowrDB?.upsertTask(row);
      }
    }
  });

  useStore.subscribe((state, prevState) => {
    for (const space of state.spaces) {
      const prev = prevState.spaces.find(s => s.id === space.id);
      if (!prev || prev.lastModified !== space.lastModified) {
        const row = {
          id: space.id,
          name: space.name,
          type: space.type,
          icon: space.icon ?? null,
          color: space.color ?? null,
          settings: space.settings ? JSON.stringify(space.settings) : null,
          is_default: space.isDefault ? 1 : 0,
          created_at: space.createdAt ?? null,
          last_modified: space.lastModified,
          sync_mode: space.syncMode,
        };
        (window as any).flowrDB?.upsertSpace(row);
      }
    }
  });
```

- [x] **Step 2: Manual verification**

Run: `npm run electron:dev`. Create a task and rename a space. In DevTools console: `await window.flowrDB.getAllTasks()` and `await window.flowrDB.getAllSpaces()`.
Expected: both reflect the changes made.

- [x] **Step 3: Commit**

```bash
git add src/data/store.ts
git commit -m "feat(db): write tasks and spaces through to SQLite on desktop"
```

---

## Task 9: Boot-time load from SQLite, merged via the same LWW rule as Supabase

**Assigned model tier: C (hardest — Claude or Gemini 3.1 Pro high only). Do not delegate to a Tier A/B model.** This task previously contained a real data-loss bug (SQLite data piped through `mergeCloudData`'s drop-on-absence semantics would delete every `cloud-only` entity from the store on a boot-order race) that was only caught by a dedicated review pass, not by normal execution. The plan below has the fix already, but a weaker model asked to "simplify" or "just use mergeCloudData for consistency" is likely to silently reintroduce it. Keep this one for yourself.

**Files:**
- Create: `src/lib/loadFromSQLite.ts`
- Test: `src/lib/loadFromSQLite.test.ts`
- Modify: `src/components/SupabaseProvider.tsx`

- [ ] **Step 1: Write the failing test for the row-to-model mapping**

```typescript
// src/lib/loadFromSQLite.test.ts
import { describe, it, expect } from 'vitest';
import { sqliteRowToEntity, sqliteRowToTask, sqliteRowToSpace } from './loadFromSQLite';

describe('sqliteRowToEntity', () => {
  it('maps a SQLite row back into an Entity, parsing JSON columns', () => {
    const row = {
      id: 'e1', title: 'Note', type: 'note', parent_id: null, last_modified: 123,
      icon: null, tags: '["a","b"]', content: '[{"id":"b1","type":"text"}]',
      sort_order: 0, space_id: null, sync_mode: 'local-only',
      paired_entity_id: null, widget_layout: null,
    };
    const entity = sqliteRowToEntity(row);
    expect(entity).toMatchObject({
      id: 'e1', title: 'Note', type: 'note', parentId: null, lastModified: 123,
      tags: ['a', 'b'], content: [{ id: 'b1', type: 'text' }],
      syncMode: 'local-only',
    });
  });
});

describe('sqliteRowToTask', () => {
  it('maps a SQLite row back into an AppTask', () => {
    const row = {
      id: 't1', title: 'Task', completed: 1, due_date: null, end_date: null,
      include_time: null, reminder: null, entity_id: null, space_id: null,
      note: null, color: null, priority: null, status: null, position: null,
      created_at: 100, completed_at: null, last_modified: 200, subtasks: null,
      attachments: null, description: null, user_due_date: null, tag: null,
      sync_mode: 'local-only',
    };
    const task = sqliteRowToTask(row);
    expect(task).toMatchObject({ id: 't1', title: 'Task', completed: true, lastModified: 200 });
  });
});

describe('sqliteRowToSpace', () => {
  it('maps a SQLite row back into a Space', () => {
    const row = {
      id: 's1', name: 'Personal', type: 'personal', icon: null, color: null,
      settings: null, is_default: 1, created_at: 50, last_modified: 60,
      sync_mode: 'local-only',
    };
    const space = sqliteRowToSpace(row);
    expect(space).toMatchObject({ id: 's1', name: 'Personal', isDefault: true, lastModified: 60 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/loadFromSQLite.test.ts`
Expected: FAIL with "Cannot find module './loadFromSQLite'"

- [ ] **Step 3: Implement `src/lib/loadFromSQLite.ts`**

```typescript
// src/lib/loadFromSQLite.ts
import type { Entity, AppTask, Space } from '@/data/store.types';
import { isDesktop } from './env';

function parseJson<T>(str: string | null, fallback: T): T {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

export function sqliteRowToEntity(row: Record<string, any>): Entity {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    parentId: row.parent_id ?? null,
    lastModified: row.last_modified ?? 0,
    icon: row.icon ?? undefined,
    tags: parseJson(row.tags, []),
    content: parseJson(row.content, []),
    sortOrder: row.sort_order ?? undefined,
    spaceId: row.space_id ?? null,
    syncMode: row.sync_mode ?? 'local-only',
    pairedEntityId: row.paired_entity_id ?? null,
    widgetLayout: row.widget_layout ? parseJson(row.widget_layout, undefined) : undefined,
  } as Entity;
}

export function sqliteRowToTask(row: Record<string, any>): AppTask {
  return {
    id: row.id,
    title: row.title,
    completed: !!row.completed,
    dueDate: row.due_date ?? undefined,
    endDate: row.end_date ?? undefined,
    includeTime: row.include_time ? true : undefined,
    reminder: row.reminder ?? undefined,
    entityId: row.entity_id ?? null,
    spaceId: row.space_id ?? null,
    note: row.note ?? undefined,
    color: row.color ?? undefined,
    priority: row.priority ?? undefined,
    status: row.status ?? undefined,
    position: row.position ?? null,
    createdAt: row.created_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    lastModified: row.last_modified ?? 0,
    subtasks: row.subtasks ? parseJson(row.subtasks, undefined) : undefined,
    attachments: row.attachments ? parseJson(row.attachments, undefined) : undefined,
    description: row.description ?? undefined,
    userDueDate: row.user_due_date ?? undefined,
    tag: row.tag ?? undefined,
    syncMode: row.sync_mode ?? 'local-only',
  } as AppTask;
}

export function sqliteRowToSpace(row: Record<string, any>): Space {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    ownerId: null,
    createdAt: row.created_at ?? 0,
    lastModified: row.last_modified ?? 0,
    icon: row.icon ?? undefined,
    color: row.color ?? undefined,
    settings: row.settings ? parseJson(row.settings, undefined) : undefined,
    syncMode: row.sync_mode ?? 'local-only',
    isDefault: !!row.is_default,
  } as Space;
}

export async function loadFromSQLite(): Promise<{ entities: Entity[]; tasks: AppTask[]; spaces: Space[] }> {
  if (!isDesktop() || !(window as any).flowrDB) {
    return { entities: [], tasks: [], spaces: [] };
  }
  const [entityRows, taskRows, spaceRows] = await Promise.all([
    (window as any).flowrDB.getAllEntities(),
    (window as any).flowrDB.getAllTasks(),
    (window as any).flowrDB.getAllSpaces(),
  ]);
  return {
    entities: entityRows.map(sqliteRowToEntity),
    tasks: taskRows.map(sqliteRowToTask),
    spaces: spaceRows.map(sqliteRowToSpace),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/loadFromSQLite.test.ts`
Expected: PASS.

- [ ] **Step 5: Hydrate from SQLite as the base state, sequenced BEFORE the Supabase merge — do not reuse `mergeCloudData`'s drop semantics on it**

**Why not `mergeCloudData` for this dataset:** `mergeCloudData`'s entity branch drops any local entity *not present* in the passed-in dataset when that entity's `syncMode !== 'local-only'` (treats it as "deleted on another device" — correct for a *cloud* dataset). `loadFromSQLite()` never returns `cloud-only` entities (Task 7 deliberately excludes them from the SQLite mirror), so passing its result through `mergeCloudData` would delete every `cloud-only` entity/task/space already in the store the moment this runs — a real, intermittent (network-race-dependent) data-loss bug, not a hypothetical.

Instead, apply the SQLite dataset directly via the bulk setters (no drop logic) and make it a hard dependency that finishes **before** `loadFromSupabase` runs, so the Supabase merge (which correctly preserves `local-only` entries and applies LWW) always layers on top of a fully-hydrated local base rather than racing it:

In `src/components/SupabaseProvider.tsx`, find the `useEffect` that calls `loadFromSupabase().then(...)` (around line 176). Restructure it so the SQLite load is awaited first:

```typescript
import { loadFromSQLite } from '@/lib/loadFromSQLite';
import { isDesktop } from '@/lib/env';

// inside the boot useEffect, BEFORE the existing loadFromSupabase().then(...) call:
if (isDesktop()) {
  const localData = await loadFromSQLite();
  useStore.getState().setEntities(localData.entities);
  useStore.getState().setTasks(localData.tasks);
  useStore.getState().setSpaces(localData.spaces);
}

// existing call, now guaranteed to run after SQLite hydration on desktop:
loadFromSupabase().then((cloudData) => {
  mergeCloudData(cloudData); // unchanged — this merge's drop semantics are correct for cloud data
});
```

If the existing effect isn't already `async`, wrap the SQLite-load block in an inner async IIFE or convert the effect callback, following whatever pattern the surrounding code already uses for other awaited calls in that file. The key invariant: **`loadFromSQLite`'s result must never be passed through `mergeCloudData` or any drop-on-absence merge** — it's a direct hydration, not a reconciliation.

- [ ] **Step 6: Manual verification**

Run: `npm run electron:dev`. Create a note, close the app fully, relaunch.
Expected: the note is still present after relaunch, loaded from SQLite (works even with network disabled — test by disabling network in OS settings or unplugging, if practical).

- [ ] **Step 7: Commit**

```bash
git add src/lib/loadFromSQLite.ts src/lib/loadFromSQLite.test.ts src/components/SupabaseProvider.tsx
git commit -m "feat(db): load and merge local SQLite data on app boot"
```

---

## Task 10: One-time legacy import from `localStorage`/file-vault into SQLite

**Assigned model tier: B (moderate) — e.g. Qwen 3.7 Max/Plus, GLM 5.2, Gemini 3.5 Flash mid/high.** Multi-file (importer module, IPC flag handlers, boot wiring) but each piece is fully specified. The refactor called out in Step 6 (extracting shared row-mapping helpers so Tasks 7/8's subscribers and this importer don't duplicate field mapping) needs care — verify Tasks 7/8's subscribers still work identically after the extraction (re-run their manual verification, don't just trust the diff).

**Files:**
- Create: `src/lib/legacyImport.ts`
- Test: `src/lib/legacyImport.test.ts`
- Modify: `electron/main.js`
- Modify: `src/components/SupabaseProvider.tsx`

- [ ] **Step 1: Write the failing test for the localStorage-snapshot fast path**

```typescript
// src/lib/legacyImport.test.ts
import { describe, it, expect, vi } from 'vitest';
import { parseLegacyLocalStorageSnapshot } from './legacyImport';

describe('parseLegacyLocalStorageSnapshot', () => {
  it('extracts entities, tasks, and spaces from the flowr-storage blob', () => {
    const raw = JSON.stringify({
      state: {
        entities: [{ id: 'e1', title: 'Old note', type: 'note', lastModified: 100, syncMode: 'local-only' }],
        tasks: [{ id: 't1', title: 'Old task', completed: false, syncMode: 'local-only' }],
        spaces: [{ id: 's1', name: 'Personal', type: 'personal', syncMode: 'local-only' }],
      },
    });
    const result = parseLegacyLocalStorageSnapshot(raw);
    expect(result.entities).toHaveLength(1);
    expect(result.entities[0].id).toBe('e1');
    expect(result.tasks[0].id).toBe('t1');
    expect(result.spaces[0].id).toBe('s1');
  });

  it('defaults lastModified to the provided import time when absent (legacy tasks/spaces)', () => {
    const raw = JSON.stringify({ state: { entities: [], tasks: [{ id: 't1', title: 'X', completed: false, syncMode: 'local-only' }], spaces: [] } });
    const result = parseLegacyLocalStorageSnapshot(raw, 999);
    expect(result.tasks[0].lastModified).toBe(999);
  });

  it('returns empty arrays for invalid JSON', () => {
    const result = parseLegacyLocalStorageSnapshot('not json');
    expect(result).toEqual({ entities: [], tasks: [], spaces: [] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/legacyImport.test.ts`
Expected: FAIL with "Cannot find module './legacyImport'"

- [ ] **Step 3: Implement `parseLegacyLocalStorageSnapshot`**

```typescript
// src/lib/legacyImport.ts
import type { Entity, AppTask, Space } from '@/data/store.types';

export function parseLegacyLocalStorageSnapshot(
  raw: string,
  importTime: number = Date.now()
): { entities: Entity[]; tasks: AppTask[]; spaces: Space[] } {
  try {
    const parsed = JSON.parse(raw);
    const state = parsed?.state ?? {};
    const entities: Entity[] = Array.isArray(state.entities) ? state.entities : [];
    const tasks: AppTask[] = (Array.isArray(state.tasks) ? state.tasks : []).map((t: any) => ({
      ...t,
      lastModified: t.lastModified ?? importTime,
    }));
    const spaces: Space[] = (Array.isArray(state.spaces) ? state.spaces : []).map((s: any) => ({
      ...s,
      lastModified: s.lastModified ?? importTime,
    }));
    return { entities, tasks, spaces };
  } catch {
    return { entities: [], tasks: [], spaces: [] };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/legacyImport.test.ts`
Expected: PASS.

- [ ] **Step 5: Add a migration-sentinel IPC handler in `electron/main.js`**

```javascript
const LEGACY_IMPORT_FLAG = path.join(app.getPath('userData'), 'legacy-import-done.flag');

ipcMain.handle('db:isLegacyImportDone', async () => fs.existsSync(LEGACY_IMPORT_FLAG));
ipcMain.handle('db:markLegacyImportDone', async () => {
  fs.writeFileSync(LEGACY_IMPORT_FLAG, String(Date.now()), 'utf-8');
  return true;
});
```

Add corresponding entries to `electron/preload.js`'s `flowrDB` object:

```javascript
isLegacyImportDone: () => ipcRenderer.invoke('db:isLegacyImportDone'),
markLegacyImportDone: () => ipcRenderer.invoke('db:markLegacyImportDone'),
```

- [ ] **Step 6: Run the importer once on boot, before `loadFromSQLite`**

In `src/components/SupabaseProvider.tsx`, in the same boot effect from Task 9, before the `loadFromSQLite()` call:

```typescript
if (isDesktop() && (window as any).flowrDB) {
  const alreadyImported = await (window as any).flowrDB.isLegacyImportDone();
  if (!alreadyImported) {
    const raw = localStorage.getItem('flowr-storage');
    if (raw) {
      const { entities, tasks, spaces } = parseLegacyLocalStorageSnapshot(raw);
      for (const e of entities) await (window as any).flowrDB.upsertEntity(entityToSQLiteRow(e));
      for (const t of tasks) await (window as any).flowrDB.upsertTask(taskToSQLiteRow(t));
      for (const s of spaces) await (window as any).flowrDB.upsertSpace(spaceToSQLiteRow(s));
    }
    await (window as any).flowrDB.markLegacyImportDone();
  }
}
```

Note: `entityToSQLiteRow`/`taskToSQLiteRow`/`spaceToSQLiteRow` are the same row-shaping logic already written inline in the Task 7/8 subscribers — extract them into small exported helper functions in `src/lib/legacyImport.ts` (or a shared `src/lib/sqliteRows.ts`) so both the subscribers and the importer call the same code instead of duplicating the field mapping. Refactor Task 7/8's inline row construction to use these extracted helpers as part of this step.

- [ ] **Step 7: Manual verification**

Using a build from before this plan (or by manually seeding `localStorage['flowr-storage']` with a test blob in DevTools before Task 9's SQLite load runs), run: `npm run electron:dev`. Confirm the legacy entity/task/space appears in `await window.flowrDB.getAllEntities()` after boot, and that relaunching the app does not duplicate it (check `legacy-import-done.flag` exists in `userData`).

- [ ] **Step 8: Commit**

```bash
git add src/lib/legacyImport.ts src/lib/legacyImport.test.ts electron/main.js electron/preload.js src/components/SupabaseProvider.tsx src/data/store.ts
git commit -m "feat(db): one-time import of legacy localStorage data into SQLite"
```

---

## Task 11: Downgrade protocol — instant lock UI banner

**Assigned model tier: A (mechanical) — e.g. DeepSeek V4 Flash, Qwen 3.7 Flash, Gemini 3.5 Flash low.** Self-contained pure function + component + test, fully written in the plan. Step 6 (finding the right place to mount it in the app layout) is the one part needing a look around the codebase — if using a Tier A model, treat Step 6 as its own sub-task: first just report back what `grep` found and where it proposes to mount the component, before actually editing the layout file.

**Files:**
- Modify: `src/data/store.types.ts`
- Create: `src/components/DowngradeBanner.tsx`
- Test: `src/components/DowngradeBanner.test.ts`

Note: the Supabase-side scheduled jobs (grace-period stamping, purge cron) are out of scope for this client-side plan — they're backend/ops configuration, not application code. This task covers the client-observable behavior: reading `grace_period_ends_at` and showing the banner. Confirm with the team whether the scheduled jobs already exist before considering the downgrade protocol fully shipped.

- [ ] **Step 1: Add `gracePeriodEndsAt` to the app's profile/account state**

Run: `grep -n "subscriptionTier\|subscription_status\|profile" src/data/store.types.ts` to find the existing account/profile state shape. Add a `gracePeriodEndsAt: number | null` field alongside it, following the existing naming convention found.

- [ ] **Step 2: Write the failing test for the banner's visibility logic**

```typescript
// src/components/DowngradeBanner.test.ts
import { describe, it, expect } from 'vitest';
import { shouldShowGraceBanner } from './DowngradeBanner';

describe('shouldShowGraceBanner', () => {
  it('returns false when gracePeriodEndsAt is null', () => {
    expect(shouldShowGraceBanner(null)).toBe(false);
  });
  it('returns true when gracePeriodEndsAt is in the future', () => {
    expect(shouldShowGraceBanner(Date.now() + 1000 * 60 * 60)).toBe(true);
  });
  it('returns false when gracePeriodEndsAt is in the past', () => {
    expect(shouldShowGraceBanner(Date.now() - 1000)).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/components/DowngradeBanner.test.ts`
Expected: FAIL with "Cannot find module './DowngradeBanner'"

- [ ] **Step 4: Implement the banner component and its visibility helper**

```typescript
// src/components/DowngradeBanner.tsx
'use client';

export function shouldShowGraceBanner(gracePeriodEndsAt: number | null): boolean {
  return gracePeriodEndsAt !== null && gracePeriodEndsAt > Date.now();
}

export function DowngradeBanner({ gracePeriodEndsAt }: { gracePeriodEndsAt: number | null }) {
  if (!shouldShowGraceBanner(gracePeriodEndsAt)) return null;

  const daysLeft = Math.ceil(((gracePeriodEndsAt as number) - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <div className="w-full bg-amber-500/10 border-b border-amber-500/30 text-amber-700 dark:text-amber-300 text-sm px-4 py-2 text-center">
      Your cloud sync subscription has expired. Your cloud data will be permanently deleted in {daysLeft} day{daysLeft === 1 ? '' : 's'} unless you renew.
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/DowngradeBanner.test.ts`
Expected: PASS.

- [ ] **Step 6: Mount the banner in the app layout, reading from account/profile state**

Run: `grep -rn "SubscriptionsTable\|subscription_status" src/app --include="*.tsx" -l | head -5` to find where subscription state is already read/displayed, and mount `<DowngradeBanner gracePeriodEndsAt={...} />` in the top-level layout that wraps the main app shell (likely `src/app/layout.tsx` or a top-level client component already rendering global chrome), sourcing `gracePeriodEndsAt` from the store field added in Step 1.

- [ ] **Step 7: Manual verification**

Manually set `gracePeriodEndsAt` in the store to a future timestamp via DevTools (`useStore.setState({ gracePeriodEndsAt: Date.now() + 86400000 })` if exposed to `window`, or temporarily hardcode for visual check), confirm the banner renders. Set to `null`, confirm it disappears.

- [ ] **Step 8: Commit**

```bash
git add src/data/store.types.ts src/components/DowngradeBanner.tsx src/components/DowngradeBanner.test.ts src/app/layout.tsx
git commit -m "feat(billing): add downgrade grace-period warning banner"
```

---

## Task 12: Downgrade protocol — instant `local-only` lock on subscription expiry

**Assigned model tier: B (moderate) — e.g. Qwen 3.7 Max/Plus, GLM 5.2, Gemini 3.5 Flash mid/high.** Requires correctly locating the existing subscription-status handling before wiring in new behavior — a wrong guess about where to hook in silently fails to fire. Note the plan's explicit warning: this must use a raw `set()`, never `debouncedPush*` — verify this specifically in the double-verification pass.

**Files:**
- Modify: `src/data/store.ts`

- [ ] **Step 1: Locate the subscription-status handling in the store**

Run: `grep -n "subscriptionTier\|subscription_status\|setSubscription" src/data/store.ts` to find where subscription tier changes are already applied to store state (likely populated from a Supabase profile fetch/realtime subscription, given `SubscriptionsTable.tsx`/`actions.ts` exist in `src/app/admin/subscriptions/`).

- [ ] **Step 2: Add the instant-lock effect**

Wherever subscription tier transitions into `free`/expired is detected (from Step 1), add a call that flips `syncMode` app-wide to `local-only` for entities/tasks/spaces currently `cloud-only` or `full-sync`:

```typescript
function applyInstantDowngradeLock(): void {
  set((state) => ({
    entities: state.entities.map(e => e.syncMode !== 'local-only' ? { ...e, syncMode: 'local-only' as const, lastModified: Date.now() } : e),
    tasks: state.tasks.map(t => t.syncMode !== 'local-only' ? { ...t, syncMode: 'local-only' as const, lastModified: Date.now() } : t),
    spaces: state.spaces.map(s => s.syncMode !== 'local-only' ? { ...s, syncMode: 'local-only' as const, lastModified: Date.now() } : s),
  }));
}
```

**This intentionally uses a raw `set()`, not `debouncedPushEntity`/`debouncedPushTask`/`debouncedPushSpace`.** A downgrade lock must never push to Supabase — pushing would be pointless (the account no longer has cloud access) and could race with the account's cloud data entering its read-only grace period. Do not "fix" this into a push call.

Wire this as a store action (add to the store's action interface and implementation alongside other `set*` actions), called from the subscription-status-change handler found in Step 1.

- [ ] **Step 3: Manual verification**

In a dev environment with a test account, use the existing admin subscription tools (`src/app/admin/subscriptions/actions.ts`) to expire a subscription, confirm entities' `syncMode` flips to `local-only` in the store and Supabase pushes (via `debouncedPushEntity`) stop firing for that user's data (check network tab / Supabase logs for absence of new upserts).

- [ ] **Step 4: Commit**

```bash
git add src/data/store.ts
git commit -m "feat(billing): instantly lock entities to local-only on subscription expiry"
```

---

## Task 13: 5MB client-side attachment size cap enforcement

**Assigned model tier: A (mechanical) — e.g. DeepSeek V4 Flash, Qwen 3.7 Flash, Gemini 3.5 Flash low.** Pure function + test fully written; Step 1 (finding the actual upload call site) and Step 6 (wiring the check in) are the only parts requiring codebase lookup — if using a Tier A model, have it report the located call site back before editing, same as Task 11's approach.

**Files:**
- Modify: `src/lib/sync.ts` (or wherever attachment uploads are initiated — confirm exact call site first)
- Test: `src/lib/attachmentLimits.test.ts`
- Create: `src/lib/attachmentLimits.ts`

- [ ] **Step 1: Find where attachments/canvas content get uploaded to Supabase**

Run: `grep -rn "attachments\|uploadFile\|storage.from" src/lib/*.ts src/data/store.ts | grep -i upload` to locate the actual Supabase Storage upload call site(s) for attachments.

- [ ] **Step 2: Write the failing test for the size-check helper**

```typescript
// src/lib/attachmentLimits.test.ts
import { describe, it, expect } from 'vitest';
import { exceedsUploadCap, MAX_ATTACHMENT_BYTES } from './attachmentLimits';

describe('exceedsUploadCap', () => {
  it('returns false for a file under the cap', () => {
    expect(exceedsUploadCap(1024)).toBe(false);
  });
  it('returns true for a file over the cap', () => {
    expect(exceedsUploadCap(MAX_ATTACHMENT_BYTES + 1)).toBe(true);
  });
  it('returns false for a file exactly at the cap', () => {
    expect(exceedsUploadCap(MAX_ATTACHMENT_BYTES)).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/attachmentLimits.test.ts`
Expected: FAIL with "Cannot find module './attachmentLimits'"

- [ ] **Step 4: Implement the helper**

```typescript
// src/lib/attachmentLimits.ts
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5MB, MVP cap per architecture_design_doc.md §5

export function exceedsUploadCap(sizeBytes: number): boolean {
  return sizeBytes > MAX_ATTACHMENT_BYTES;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/attachmentLimits.test.ts`
Expected: PASS.

- [ ] **Step 6: Enforce the cap at the upload call site found in Step 1**

Add a check before the upload call:

```typescript
import { exceedsUploadCap, MAX_ATTACHMENT_BYTES } from '@/lib/attachmentLimits';

if (exceedsUploadCap(file.size)) {
  throw new Error(`File exceeds the ${MAX_ATTACHMENT_BYTES / 1024 / 1024}MB upload limit for cloud sync. It will remain local-only.`);
}
```

Surface this error to the user via whatever error-display mechanism the upload call site already uses (toast/inline error — follow the existing pattern at that call site rather than introducing a new one).

- [ ] **Step 7: Manual verification**

Attempt to upload/attach a file over 5MB with cloud sync enabled. Confirm a clear error is shown and the upload is rejected rather than silently truncated or dropped.

- [ ] **Step 8: Commit**

```bash
git add src/lib/attachmentLimits.ts src/lib/attachmentLimits.test.ts <upload-call-site-file>
git commit -m "feat(billing): enforce 5MB client-side attachment cap for cloud sync"
```

---

## Task 14: Remove Markdown file-vault writes for desktop builds (final cleanup)

**Assigned model tier: B (moderate) — e.g. Qwen 3.7 Max/Plus, GLM 5.2, Gemini 3.5 Flash mid/high.** Deletion-heavy task — the risk is removing something still in use (the plan already warns to check `fileVault.ts` has no other consumers before deleting). Run this only after Tasks 1-10 are confirmed working end-to-end by the user, per the note already in the task.

**Files:**
- Modify: `src/lib/persistence.ts`
- Modify: `src/data/store.ts` (if any remaining call sites)

Note: run this task last, after Tasks 7–10 are verified working end-to-end, since it removes the fallback path.

- [ ] **Step 1: Confirm no remaining callers of `saveEntityToFile`**

Run: `grep -rn "saveEntityToFile" src/`
Expected: only the definition in `src/lib/persistence.ts` and possibly its use inside `saveEntity()` itself remain (Task 7 Step 3 already removed the `store.ts` subscriber's call).

- [ ] **Step 2: Remove the file-vault branch from `saveEntity()`**

In `src/lib/persistence.ts`, remove the `if (isDesktop() && ...) { ...saveEntityToFile... }` branch from `saveEntity()`, leaving only the Supabase push branch. Delete the now-unused `saveEntityToFile` function and its import of `getVaultPath`/`fileVault.ts` helpers if nothing else in the codebase uses them (run `grep -rn "fileVault" src/` to check for other consumers, e.g. the importer in Task 10 which still needs `fileVault.ts`'s vault-detection — keep the module, only remove the write path).

- [ ] **Step 3: Run the full test suite**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 4: Manual verification**

Run: `npm run electron:dev`. Edit a note. Confirm no `.md` file is written/updated in the configured vault folder, and the change persists via SQLite (check `window.flowrDB.getAllEntities()` and relaunch to confirm durability).

- [ ] **Step 5: Commit**

```bash
git add src/lib/persistence.ts
git commit -m "chore(db): remove Markdown file-vault write path, SQLite is now the sole desktop-local store"
```

---

## Out of Scope (confirmed in spec, not covered by this plan)

- Per-block SQLite rows / per-block sync granularity.
- Field-level or CRDT-based conflict merging.
- Dynamic/live storage-cap detection from backend plan tier.
- Building/authenticating a second Supabase client inside the Electron main process.
- Supabase-side scheduled jobs (grace-period stamping cron, purge cron) — backend/ops config, not covered by client code changes in Task 11.
