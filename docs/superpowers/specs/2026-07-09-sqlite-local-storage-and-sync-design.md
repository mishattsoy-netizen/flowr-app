# Flowr: SQLite Local Storage & Sync — MVP Design

## Context

This spec finalizes `architecture_design_doc.md` (repo root) into an implementable MVP scope. That document is the locked architectural decision: replace the current file-vault (Markdown + frontmatter files, entity-level Supabase sync) with a local **SQLite** source of truth, a **block-based** data model, and **row-level Last-Write-Wins (LWW)** sync against Supabase. This spec resolves the open implementation questions the source doc left unstated and scopes it to "ship an MVP as fast as possible."

Current system being replaced (for context, not preserved): Zustand store (`src/data/store.ts`) persisted to `localStorage`, notes written to Markdown files with frontmatter via `src/lib/persistence.ts` + `src/lib/fileVault.ts` (desktop only), and direct per-entity Supabase upsert via `src/lib/sync.ts`.

## 1. Storage Model

- **Engine:** SQLite via `better-sqlite3`, running in the Electron **main process** (not the renderer — `better-sqlite3` is a native module and cannot run inside the Next.js renderer/webview).
- **Security:** Unencrypted at rest, per the locked doc's "Open Ecosystem" rationale — power users with local tool access (Claude Code, Python scripts, etc.) can read/edit the DB directly. This is intentional, not a gap.
- **Granularity: coarse.** One SQLite row per note/canvas in an `entities` table. Each row stores a `blocks` column as a JSON blob — the same `EditorBlock[]` shape the app already uses in memory today. This is a storage swap (localStorage/Markdown → SQLite), not a schema redesign of the block model itself.
  - Sync and LWW conflict resolution operate at the **note level**, not per-block. True per-block rows (needed later for per-block AI embeddings and fine-grained merge) are explicitly deferred post-MVP.
- **No migration path for existing local users' data structure** — this is the storage architecture for the SQLite-backed release going forward. The one exception is the one-time importer described in Section 5.

### Schema (MVP)

```sql
CREATE TABLE entities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,            -- note | canvas | folder | workspace | task ...
  title TEXT,
  blocks TEXT,                   -- JSON blob (EditorBlock[])
  space_id TEXT,
  parent_id TEXT,
  sync_mode TEXT NOT NULL,       -- local-only | cloud-only | full-sync
  last_modified INTEGER NOT NULL, -- epoch ms, local write clock
  dirty INTEGER NOT NULL DEFAULT 0, -- 1 = pending push to Supabase
  deleted INTEGER NOT NULL DEFAULT 0
);
```

Mirrors the shape of today's `Entity` type (`src/data/store.types.ts`) closely enough that the Zustand store's existing read/write call sites need minimal changes — swap the persistence backend, not the in-memory model.

## 2. Sync Engine

- **Push (local → Supabase):** Writes to SQLite are immediate and synchronous (main-process write, always succeeds locally regardless of network). A debounced background push (~1.5s after the last edit to a given entity) sends the changed row to Supabase, setting `updated_at` server-side. Debounce avoids spamming Supabase on every keystroke while staying near-real-time.
- **Pull (Supabase → local):** A Supabase Realtime subscription per authenticated user listens for changes on their `entities` table. On event, compare `remote.updated_at` vs local `last_modified`; if remote is newer, overwrite the local row and mark it clean, then notify the renderer (via IPC) to re-render.
- **Conflict resolution:** Whole-row LWW — newer timestamp wins entirely, no field/block-level merge. **Known MVP trade-off:** if the same note is edited offline on two devices before either syncs, one edit is fully discarded. This matches the doc's explicit anti-CRDT stance ("DO NOT build complex CRDT merging algorithms"). Not addressed further for MVP.
- **Tier gating:** SQLite writes always happen regardless of subscription tier. The push/pull layer no-ops entirely when `sync_mode = 'local-only'` (Free tier or post-downgrade state) — no network calls are attempted.
- **Electron IPC surface:** Parallel to the existing `flowrFS` IPC bridge (`electron/preload.js`) for file operations, add a `flowrDB` IPC surface exposing query/write/subscribe methods from the main-process SQLite instance to the renderer. The renderer never touches SQLite directly.

## 3. Storage Limits & Supabase Scaling

- **Free tier:** Unlimited local SQLite storage. No cloud sync.
- **Pro/Max tier:** Cloud sync enabled. Per-attachment/canvas cap of 5MB enforced **client-side**, checked in the push layer before any Supabase upload call — oversized entities are rejected with a clear in-app error, not silently dropped or truncated.
- Caps scale up as the Supabase backend is upgraded (e.g., to the $25/mo Pro plan); this is an operational/config change, not something the client needs to detect dynamically for MVP — cap value can be a client-side constant updated on release.

## 4. Downgrade Protocol (Pro → Free)

1. **Instant lock:** On subscription expiry, `sync_mode` flips app-wide to `local-only`. Local SQLite data is untouched. Sync push/pull layer no-ops immediately (per Section 2).
2. **Cloud grace period:** A Supabase-side scheduled job (cron/edge function) marks the user's cloud rows read-only and stamps `grace_period_ends_at` (now + 30 days) on the account/profile.
3. **Purge:** A second scheduled job purges cloud rows for accounts past `grace_period_ends_at` with no renewal.
4. **UI:** The app shows a persistent warning banner whenever `grace_period_ends_at` is non-null and in the future, driving the user toward renewal.

## 5. One-Time Legacy Import

To avoid silently losing existing users' data when they update into the SQLite-backed release:

- On first launch of the new version, check for existing legacy data: `localStorage` (`flowr-storage`, the current Zustand `persist` key) and/or a file-vault (via the current `getVaultPath()` / `fileVault.ts` detection logic).
- If found and not already marked migrated, run a one-shot importer: read entities directly from the `localStorage` snapshot where available (fast path — no parsing needed, the coarse JSON-blob model maps almost directly), falling back to parsing Markdown frontmatter + body (`serializeFrontmatter`/block-backup logic already in `src/lib/editor/frontmatter.ts`) back into `EditorBlock[]` for file-vault-only data. Insert as rows into the new `entities` table.
- Mark the source as migrated (e.g., a sentinel file or app-level flag) so the importer never re-runs.
- This importer is one-directional and one-time — no ongoing dual-write support between the old storage and SQLite.

## Out of Scope for MVP

- Per-block SQLite rows / per-block sync granularity.
- Field-level or CRDT-based conflict merging.
- Dynamic/live storage-cap detection from backend plan tier.
- Any continued support for editing the vault as Markdown files after migration.

## Open Implementation Details (resolve during planning, not blocking spec approval)

- Exact IPC method names/shapes for `flowrDB`.
- Whether `dirty`/`deleted` flags need a dedicated outbox table vs. columns on `entities` (columns are sufficient for MVP volume).
