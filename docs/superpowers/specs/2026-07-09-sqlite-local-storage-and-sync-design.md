# Flowr: SQLite Local Storage & Sync — MVP Design

## Context

This spec finalizes `architecture_design_doc.md` (repo root) into an implementable MVP scope. That document is the locked architectural decision: replace the current file-vault (Markdown + frontmatter files, entity-level Supabase sync) with a local **SQLite** source of truth, a **block-based** data model, and **row-level Last-Write-Wins (LWW)** sync against Supabase. This spec resolves the open implementation questions the source doc left unstated and scopes it to "ship an MVP as fast as possible."

Current system being replaced (for context, not preserved): Zustand store (`src/data/store.ts`) persisted to `localStorage`, notes written to Markdown files with frontmatter via `src/lib/persistence.ts` + `src/lib/fileVault.ts` (desktop only), and direct per-entity Supabase upsert via `src/lib/sync.ts`.

## 1. Storage Model

- **Engine:** SQLite via `better-sqlite3`, running in the Electron **main process** (not the renderer — `better-sqlite3` is a native module and cannot run inside the Next.js renderer/webview).
- **Security:** Unencrypted at rest, per the locked doc's "Open Ecosystem" rationale — power users with local tool access (Claude Code, Python scripts, etc.) can read/edit the DB directly. This is intentional, not a gap.
- **Granularity: coarse.** One SQLite row per entity (note/canvas/folder/workspace) in an `entities` table. Each row stores a `content` column as a JSON blob — the same `EditorBlock[]` shape the app already uses in memory and already sends to Supabase's `entities.content` jsonb column today. This is a storage swap (localStorage blob / Markdown files → SQLite rows), not a schema redesign of the block model itself.
  - Sync and LWW conflict resolution operate at the **note level**, not per-block. True per-block rows (needed later for per-block AI embeddings and fine-grained merge) are explicitly deferred post-MVP.
- **No migration path for existing local users' data structure** — this is the storage architecture for the SQLite-backed release going forward. The one exception is the one-time importer described in Section 5.

### Schema (MVP)

Mirrors the real Supabase `entities` table (`supabase/schema.sql` + `supabase/migrations/20260627_sync_mode.sql`, `20260706_rename_workspace_to_space.sql`) column-for-column, so the existing `rowToEntity`/`entityToRow` mapper shapes in `src/lib/sync.ts` can be reused for the SQLite side with the same field names:

```sql
CREATE TABLE entities (
  id             TEXT PRIMARY KEY,
  title          TEXT NOT NULL DEFAULT '',
  type           TEXT NOT NULL,              -- note | canvas | folder | workspace | collection
  parent_id      TEXT REFERENCES entities(id) ON DELETE CASCADE,
  last_modified  INTEGER NOT NULL DEFAULT 0, -- epoch ms; compared directly against Supabase's last_modified for LWW
  icon           TEXT,
  tags           TEXT,                       -- JSON array
  content        TEXT,                       -- JSON blob (EditorBlock[])
  sort_order     INTEGER DEFAULT 0,
  space_id       TEXT,
  sync_mode      TEXT NOT NULL DEFAULT 'local-only', -- local-only | cloud-only | full-sync
  paired_entity_id TEXT,
  widget_layout  TEXT,                       -- JSON, nullable
  dirty          INTEGER NOT NULL DEFAULT 0  -- 1 = pending push to Supabase
);

CREATE INDEX entities_parent_id_idx ON entities(parent_id);
CREATE INDEX entities_type_idx      ON entities(type);
```

No `deleted` flag/tombstone column for MVP — deletes are applied immediately (`DELETE FROM entities WHERE id = ?`) and pushed to Supabase the same way `deleteEntityFromDB` already works, matching the doc's "no complex conflict machinery" stance. A delete arriving from Supabase Realtime after a local delete is a no-op (row already gone).

### Tables in scope: `entities`, `tasks`, `spaces`

The same per-row LWW pattern applies to all three tables the store already syncs (`src/data/store.types.ts`: `AppTask`, `Space`), not just `entities` — shipping only entities on SQLite while tasks/spaces stay on the old path would leave the app in an inconsistent, half-migrated state.

**Gap found and closed:** neither `tasks` nor `spaces` (Supabase) currently has a `last_modified` column — only `created_at`/`completed_at` on tasks, `created_at` on spaces. The existing `mergeCloudData()` merge for tasks isn't true LWW today; it's a rough cast to `(lt as any).lastModified` that's usually absent, so cloud effectively wins on every fresh load. This spec adds the missing column so SQLite-backed sync is LWW-correct for all three tables, not just entities:

```sql
-- Supabase migration
ALTER TABLE tasks  ADD COLUMN IF NOT EXISTS last_modified bigint NOT NULL DEFAULT 0;
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS last_modified bigint NOT NULL DEFAULT 0;
```

`taskToRow`/`spaceToRow` (`src/lib/sync.ts`) and the `AppTask`/`Space` types gain a `lastModified` field set on every local mutation, mirroring how `Entity.lastModified` already works. `mergeCloudData()`'s task/space merge branches switch from the current ad-hoc/cloud-wins logic to the same `local.lastModified > remote.lastModified` comparison already used for entities.

Local SQLite schema for the other two tables, mirroring their Supabase columns the same way `entities` does:

```sql
CREATE TABLE tasks (
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
  subtasks       TEXT,          -- JSON
  attachments    TEXT,          -- JSON
  description    TEXT,
  user_due_date  TEXT,
  tag            TEXT,
  sync_mode      TEXT NOT NULL DEFAULT 'local-only',
  dirty          INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE spaces (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  type           TEXT NOT NULL DEFAULT 'personal',
  icon           TEXT,
  color          TEXT,
  settings       TEXT,          -- JSON
  is_default     INTEGER NOT NULL DEFAULT 0,
  created_at     INTEGER,
  last_modified  INTEGER NOT NULL DEFAULT 0,
  sync_mode      TEXT NOT NULL DEFAULT 'local-only',
  dirty          INTEGER NOT NULL DEFAULT 0
);
```

`flowrDB` IPC methods (`upsertEntity`, `deleteEntity`, `getAllEntities`, `getDirtyEntities`, `clearDirty`) get `Task`/`Space` counterparts (`upsertTask`, `upsertSpace`, etc.) following the identical shape.

## 2. Data Flow (renderer ↔ SQLite)

Tracing the current codebase (`src/data/store.ts`, `src/lib/persistence.ts`, `src/lib/sync.ts`) shows the store **already writes per-entity**, not as a single blob, for anything sync-relevant:

- `addEntity`/`updateEntityContent`/etc. call `set()` to update in-memory state, then call `saveEntity(entity)` (`src/lib/persistence.ts`) for that one changed entity.
- `saveEntity()` today branches on `syncMode`: cloud modes call `upsertEntity()` (`src/lib/sync.ts`, direct Supabase upsert), desktop-local modes call `saveEntityToFile()` (writes a Markdown file via the `flowrFS` IPC bridge).
- The Zustand `persist`/`localStorage` blob (`store.ts` around line 3447) is a **separate, redundant snapshot** used for instant reload in the browser/no-Electron case — it is not the mechanism `saveEntity` or Supabase sync goes through.

**This means SQLite plugs in as a new branch inside `saveEntity()`, parallel to `saveEntityToFile()` — not a replacement of the Zustand persist blob.** The persist/localStorage blob for UI state (theme, sidebar, tabs, etc., via `partialize`) is unchanged and out of scope. Only the entity-content persistence path changes for desktop builds.

- **Write path:** `saveEntity(entity)` → when desktop and `syncMode` is `local-only` or `full-sync` → `window.flowrDB.upsertEntity(entityRow)` (new IPC call) → main process does a synchronous `better-sqlite3` write, immediately marking the row `dirty = 1`.
- **Push (local → Supabase):** main process runs a debounced (~1.5s) sweep of `dirty = 1` rows and pushes each via the existing `upsertEntity()` Supabase call shape (reusing `entityToRow`), then clears `dirty`.
- **Read/boot path:** on app boot (desktop only), a new `loadFromSQLite()` bulk-reads all rows via IPC and merges into the store using the **same LWW-by-`lastModified` pattern already implemented in `mergeCloudData()`** (`src/components/SupabaseProvider.tsx`), so cloud and local merges use one consistent rule.
- **Pull (Supabase → local):** the existing Supabase Realtime subscription (`subscribeRealtime` in `sync.ts`) gets one addition: after merging an incoming row into the store, also write it back into SQLite (via `flowrDB.upsertEntity`) so the local DB stays the durable mirror, not just an in-memory cache.
- **Electron IPC surface:** parallel to the existing `flowrFS` bridge (`electron/preload.js`), add `flowrDB` exposing `upsertEntity`, `deleteEntity`, `getAllEntities`, `getDirtyEntities`, `clearDirty`. The renderer never touches SQLite directly, matching the existing `flowrFS` pattern exactly.

## 3. Sync Engine

- **Push (local → Supabase):** SQLite writes are immediate and synchronous (main-process write, always succeeds locally regardless of network). A debounced background push (~1.5s after the last edit to a given entity) sends the changed row to Supabase via the existing `entityToRow`/`upsertEntity` shape.
- **Pull (Supabase → local):** the existing Supabase Realtime subscription per authenticated user (already implemented in `sync.ts`/`SupabaseProvider.tsx`) continues to drive `mergeCloudData`, comparing `remote.lastModified` vs local `lastModified` (both stored as `last_modified` epoch-ms — there is no separate server `updated_at` clock in the current schema, so this spec does not introduce one). The merge result is additionally written back into SQLite per Section 2.
- **Conflict resolution:** Whole-row LWW — newer `lastModified` wins entirely, no field/block-level merge. **Known MVP trade-off:** if the same note is edited offline on two devices before either syncs, one edit is fully discarded. This matches the doc's explicit anti-CRDT stance ("DO NOT build complex CRDT merging algorithms"). Not addressed further for MVP.
- **Tier gating:** SQLite writes always happen regardless of subscription tier. The push layer no-ops entirely when `sync_mode = 'local-only'` (Free tier or post-downgrade state) — no network calls are attempted.

## 4. Storage Limits & Supabase Scaling

- **Free tier:** Unlimited local SQLite storage. No cloud sync.
- **Pro/Max tier:** Cloud sync enabled. Per-attachment/canvas cap of 5MB enforced **client-side**, checked in the push layer before any Supabase upload call — oversized entities are rejected with a clear in-app error, not silently dropped or truncated.
- Caps scale up as the Supabase backend is upgraded (e.g., to the $25/mo Pro plan); this is an operational/config change, not something the client needs to detect dynamically for MVP — cap value can be a client-side constant updated on release.

## 5. Downgrade Protocol (Pro → Free)

1. **Instant lock:** On subscription expiry, `sync_mode` flips app-wide to `local-only`. Local SQLite data is untouched. Sync push/pull layer no-ops immediately (per Section 2).
2. **Cloud grace period:** A Supabase-side scheduled job (cron/edge function) marks the user's cloud rows read-only and stamps `grace_period_ends_at` (now + 30 days) on the account/profile.
3. **Purge:** A second scheduled job purges cloud rows for accounts past `grace_period_ends_at` with no renewal.
4. **UI:** The app shows a persistent warning banner whenever `grace_period_ends_at` is non-null and in the future, driving the user toward renewal.

## 6. One-Time Legacy Import

To avoid silently losing existing users' data when they update into the SQLite-backed release:

- On first launch of the new version (desktop only), check for existing legacy local data: the Zustand `persist` blob in `localStorage` (key `flowr-storage`, holds `state.entities`, `state.tasks`, `state.spaces` in their current in-memory shapes) and/or a file-vault (via the current `getVaultPath()` / `fileVault.ts` detection logic, entities only).
- If found and not already marked migrated, run a one-shot importer: read `state.entities`/`state.tasks`/`state.spaces` directly from the `localStorage` snapshot where available (fast path — each shape maps directly onto its SQLite row schema in Section 1, field-for-field; `lastModified` defaults to import time if absent, e.g. for legacy tasks/spaces predating the new column), falling back to parsing Markdown frontmatter + body (`serializeFrontmatter`/block-backup logic already in `src/lib/editor/frontmatter.ts`) back into `EditorBlock[]` for file-vault-only entities not present in the localStorage snapshot. Insert as rows into the corresponding SQLite tables via `flowrDB.upsertEntity`/`upsertTask`/`upsertSpace`.
- Mark the source as migrated (e.g., a sentinel file in the vault directory, or an Electron `app.getPath('userData')`-scoped flag file) so the importer never re-runs.
- This importer is one-directional and one-time — no ongoing dual-write support between the old storage and SQLite.

## Out of Scope for MVP

- Per-block SQLite rows / per-block sync granularity.
- Field-level or CRDT-based conflict merging.
- Dynamic/live storage-cap detection from backend plan tier.
- Any continued support for editing the vault as Markdown files after migration.

## Open Implementation Details (resolve during planning, not blocking spec approval)

- Exact IPC method names/shapes for `flowrDB`.
- Whether `dirty`/`deleted` flags need a dedicated outbox table vs. columns on `entities` (columns are sufficient for MVP volume).
