# Local-Only Desktop Exclusivity, Cloud Purge, and Vault Removal — Design

**Date:** 2026-07-10
**Status:** Approved by user (brainstorming session 2026-07-10)
**Builds on:** `2026-07-09-sqlite-local-storage-and-sync-design.md` (SQLite migration, shipped)

## Locked decisions (from user)

1. **Web app never shows `local-only`.** Not as an entity/workspace in any list, not as an option in the sync-mode dropdown. Web only ever shows and offers `cloud-only` and `full-sync`. Local-only can only be set from the desktop app, where all three modes remain available.
2. **Switching a workspace to `local-only` deletes it from the cloud DB** — after a 48-hour grace period, with a confirmation dialog up front. During the grace window the row still physically exists in Supabase but is invisible everywhere (mode is already `local-only`).
3. **Cancellation:** switching back to `cloud-only`/`full-sync` within the grace window cancels the pending purge and resumes normal sync (the row was never deleted, so this is a plain update).
4. **Purge trigger: server-side `pg_cron` job** in Supabase (user chose this over desktop-boot check; user will run the Supabase-side enablement steps with guidance).
5. **Workspace-level only.** Sync mode is only switchable on workspaces (this is already true in the UI — `SpacePage.tsx` dropdown). Going local-only cascades to ALL children: folders, notes, canvases, nested folders, and **tasks assigned to that workspace**.
6. **Vault/file-watcher system: fully removed** (locked in earlier this session). The SQLite DB becomes the sole local storage mechanism.
7. **Local SQLite DB stays open/unencrypted** (locked in earlier; no code change — recorded here for the record).

## Current-state facts (verified in code)

- Sync-mode dropdown lives in `src/components/workspace/SpacePage.tsx` (~line 438–490), rendered on workspace pages only. It currently offers all three modes on both platforms.
- `setSyncMode` (`src/data/store.ts:191`) cascades via `getDescendantIds` (entities only — **tasks are not touched**), flips modes locally, pushes the space via `debouncedPushSpace`, calls `saveEntity` per entity, and (desktop) runs vault stale-file scanning (`syncFileScan`) — the latter goes away with vault removal.
- Every push path in `store.ts` is hard-suppressed for `local-only` (`if (x.syncMode !== 'local-only') debouncedPush...`). Consequence: flipping to `local-only` today never informs Supabase — the cloud row silently keeps its old `sync_mode` forever. The purge design must therefore use an **explicit, one-shot cloud write**, not the normal push path.
- Supabase schema (`supabase/schema.sql`): `entities` (workspaces are `entities` rows with `type='workspace'`; there is also a separate legacy `spaces` concept in the store but the switchable unit is the workspace entity), `tasks`. `entities.parent_id` is `on delete cascade`; `tasks.entity_id` is `on delete set null` — **deleting entities does NOT delete their tasks**. RLS is enabled per-owner.
- `loadFromSupabase` (`src/lib/sync.ts`) currently pulls all rows for the user regardless of `sync_mode`.
- Tasks are associated to workspaces via `workspace_id` and/or via `entity_id` pointing into the workspace's entity subtree.

## Design

### A. Web visibility filter

- `SpacePage.tsx` mode dropdown: on web (`isWeb()`), render only Cloud Only and Full Sync options. On desktop, all three.
- `loadFromSupabase` / realtime handlers: on web, filter out rows with `sync_mode = 'local-only'` (both initial load and realtime inserts/updates). This is a safety net for the grace window, during which local-only rows still exist in Supabase.
- `mergeCloudData` on web must also drop any `local-only` row that arrives (defense in depth).
- Desktop behavior unchanged: SQLite mirrors all modes (existing invariant).

### B. Desktop switch to local-only (confirm + grace period)

1. User picks Local Only in the workspace dropdown (desktop only).
2. Confirmation modal: "This workspace and everything in it (N items, M tasks) will be removed from the cloud in 48 hours and will only exist on this device." Confirm / Cancel.
3. On confirm, `setSyncMode` does:
   - Build the cascade set: workspace entity + `getDescendantIds` (entities) + **all tasks** whose `workspaceId` is this workspace or whose `entityId` is in the entity cascade set.
   - Flip `syncMode: 'local-only'` + bump `lastModified` on all of them locally (store → SQLite write-through handles local persistence).
   - **Explicit one-shot Supabase call** (`markForPurge` in `src/lib/sync.ts`): `UPDATE entities/tasks SET sync_mode='local-only', purge_at = now() + interval '48 hours' WHERE id IN (...)`. This bypasses the local-only push suppression deliberately and is the only code path allowed to write `local-only` to Supabase.
4. Result: web stops showing it immediately (filter A + the mode itself); cloud rows persist for 48h.

### C. Cancellation (within grace window)

Switching the workspace back to `cloud-only`/`full-sync`:
- Normal cascade mode-flip locally (entities + tasks, same set logic).
- Explicit `clearPurge` Supabase call: `UPDATE ... SET sync_mode=<new mode>, purge_at = NULL WHERE id IN (...)`.
- Normal debounced push resumes thereafter. Rows were never deleted, so no re-creation needed.
- If the grace period already expired and the cron deleted the rows, the same flow still works: the debounced push path upserts the rows fresh from local state (re-upload from the local copy — locked in earlier as "both directions").

### D. Server-side purge (Supabase)

New migration `supabase/migrations/20260710_local_only_purge.sql`:
- `ALTER TABLE entities ADD COLUMN IF NOT EXISTS purge_at timestamptz;`
- `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS purge_at timestamptz;`
- `ALTER TABLE spaces ADD COLUMN IF NOT EXISTS purge_at timestamptz;` — Supabase also has a `spaces` table (`sync.ts:334` deletes from it), and `setSyncMode` flips the matching `spaces` row when the switched id is a space; `markForPurge`/`clearPurge`/the cron function must cover it the same way (verify at implementation time whether workspace switches ever target a `spaces` row in practice).
- Function `purge_local_only_rows()`:
  - `DELETE FROM tasks WHERE purge_at IS NOT NULL AND purge_at < now();` (**first** — tasks don't cascade from entities)
  - `DELETE FROM entities WHERE purge_at IS NOT NULL AND purge_at < now();` (children cascade via `parent_id on delete cascade`; descendants that somehow lack `purge_at` are still removed by the cascade from the workspace root)
- `pg_cron` schedule, hourly: `select cron.schedule('purge-local-only', '0 * * * *', $$select purge_local_only_rows()$$);`
- Runs as a privileged role — bypasses RLS by design (server-side maintenance, not a client request).
- **User action required:** enable the `pg_cron` extension in the Supabase dashboard and run the migration; step-by-step guidance to be provided at implementation time.

### E. Vault/file-watcher removal

Remove entirely:
- `src/lib/fileVault.ts`, `src/lib/vaultSyncBridge.ts`, `src/lib/syncFileScan.ts`
- `src/components/modals/SyncFileCleanupModal.tsx`, `src/components/modals/VaultSetupModal.tsx`
- "Vault Directory" sections in `src/components/modals/SettingsModal.tsx` and `src/components/settings/SettingsPage.tsx`
- `saveEntityToFile` in `src/lib/persistence.ts` (was retained solely for the vault watcher)
- File-watcher wiring: `flowrFS.onFileChanged` registration in `src/components/SupabaseProvider.tsx`, watcher setup in `electron/main.js`, and `scanForStaleLocalFiles()` call in `SupabaseProvider.tsx`
- The vault stale-file block inside `setSyncMode` (`store.ts:221–239`)
- Any `flowrFS` IPC surface used only by the above (keep `flowrFS` methods still used elsewhere, e.g. by export features, if any — verify at implementation time)
- Existing user vault folders on disk are left untouched (no deletion of user files); the app just stops reading/writing them.

## Known limitations (accepted)

- **Local-only is single-device.** Same account on two desktops: going local-only on one purges the cloud copy the other relied on. UI copy says "only exist on this device"; no further mitigation in this iteration.
- If the desktop app is offline when the user confirms the switch, the `markForPurge` cloud write can't happen; retry on next launch (queue the pending purge ids locally in SQLite/app state until acknowledged by Supabase).
- Grace period fixed at 48 hours (not user-configurable in this iteration).

## Testing

- Unit: cascade-set builder (entities + tasks, nested), `markForPurge`/`clearPurge` row selection, web filter in `loadFromSupabase`/`mergeCloudData`.
- Integration: switch → confirm → local flip + cloud rows get `purge_at`; cancel → `purge_at` cleared; post-expiry re-enable → rows re-upserted from local.
- SQL: `purge_local_only_rows()` deletes tasks first, then entities with cascade; rows without `purge_at` untouched.
- Regression: existing 258-test suite stays green; pull-echo invariant preserved (bulk setters still never push).
- Vault removal: `tsc --noEmit` clean after deletions (this exact class of break happened in Task 14 of the previous plan — grep for every deleted symbol before declaring done).
