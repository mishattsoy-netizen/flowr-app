# SyncMode / Local File Consistency Fix

## Problem

Workspaces and entities in the UI show `cloud-only` sync mode, but local `.md` /
`.canvas` files on disk exist for them with frontmatter claiming
`syncMode: "full-sync"`. This is misleading and risks files being treated as
locally-authoritative when they shouldn't be.

## Root Cause (confirmed by reading the code)

Two independent bugs combine to produce the symptom:

1. **`src/lib/persistence.ts:22`** — `saveEntityToFile` writes
   `syncMode: entity.syncMode || 'full-sync'` into the markdown frontmatter.
   The `|| 'full-sync'` fallback is a leftover M3 placeholder
   (`git show 13a11e5` shows it replaced a hardcoded `'full-sync'` literal,
   but the fallback logic itself was never actually correct — it just made the
   bug conditional instead of removing it). `entity.syncMode` is always
   populated by the time an entity exists in the store
   (`store.ts:1711`: `syncMode: entity.syncMode ?? defaultSyncMode`), so the
   fallback should never trigger for legitimate writes — but it does, because:

2. **`src/data/store.ts:2596-2610`** — the desktop file-sync subscriber calls
   `saveEntityToFile` for *every* `note` / `canvas` / `mixed` entity whenever
   its `lastModified` changes, with **no `syncMode` check at all**. This is a
   different, ungated code path from `persistence.ts`'s own `saveEntity()`
   function (which *does* correctly gate on syncMode at line 34/38) — the
   gated function is simply not the one wired into the store subscription.
   Result: cloud-only entities get local files written despite the UI and DB
   saying they shouldn't have one, and those files get stamped with whatever
   `persistence.ts:22`'s fallback produces.

## Fix Design

### 1. Gate the store subscriber (`store.ts:2596-2610`)

Skip `saveEntityToFile` when `entity.syncMode === 'cloud-only'`. Cloud-only
entities never get a local file written going forward — this makes the
subscriber consistent with `persistence.ts`'s existing (already-correct)
gating logic.

### 2. Fix the frontmatter fallback (`persistence.ts:22`)

Replace `entity.syncMode || 'full-sync'` with `entity.syncMode`. No fallback —
the field is guaranteed populated by entity-creation time.

### 3. Mode-switch confirmation popup

When `setSyncMode` (`store.ts:189-206`) changes an entity's mode **to**
`cloud-only` **from** `local-only` or `full-sync`, and a local file currently
exists for that entity (check via `flowrFS.readFile` on the computed path, or
equivalent existence check), show a confirm dialog:

- **Delete local copy** — remove the file via `flowrFS.deleteFile`.
- **Keep local copy** — leave the file on disk. It becomes an orphan: the now
  cloud-only entity won't be written to it again (per fix #1), but the file
  isn't deleted either.

If the entity is later switched back to `local-only` / `full-sync`,
`saveEntityToFile` writes to the path computed from the *current* title. If
the title hasn't changed since the file was kept, this naturally overwrites
the kept orphan (expected — "update current local file" per user
requirement). If the title *did* change while cloud-only (e.g. edited on
web), the write goes to a *new* path, leaving the old-titled file as a
second orphan — this is caught by the startup scan (#4), matched via
frontmatter `id`, which is stable for the entity's lifetime.

### 4. Startup stale-file scan

After the vault is loaded (on app boot, after `loadFromSupabase` completes),
scan the vault directory:

- For each local file, parse its frontmatter `id`.
- Look up that `id` against the current entity list:
  - **Entity found, and entity is `cloud-only`** → stale/orphaned file.
    Include in the batched popup as a named entity ("Note: Project Plan").
  - **No entity with that `id`** → unknown file (deleted entity, or a
    hand-authored file with a colliding/foreign id). Include in the same
    batched popup under an "Unrecognized files" section.
  - **Entity found and is `local-only` / `full-sync`** → expected, skip.
- Show **one** batched dialog listing all flagged files (not one popup per
  file), each with independent Delete / Keep choice, so first launch after
  this fix doesn't spam multiple popups.
- "Keep" for a stale cloud-only file behaves the same as in #3 — left alone,
  eligible to be overwritten later if the entity returns to local sync.
- "Delete" removes the file via `flowrFS.deleteFile`.
- This scan only runs on desktop (`isDesktop()` guard, matching existing
  vault-dependent code).

## Non-goals

- No new IPC/preload APIs needed — `flowrFS.readFile` / `writeFile` /
  `deleteFile` / `readdir` already exist (`electron/preload.js`).
- Not touching workspace-level `syncMode` propagation logic — only the
  entity-level file-write path.
- Not deduplicating/merging content between a kept orphan and a live
  cloud-only entity — "keep" just means "don't delete," no merge semantics.

## Testing

- Unit: `persistence.ts` — `saveEntityToFile` frontmatter reflects
  `entity.syncMode` exactly, no `full-sync` fallback.
- Unit: store subscriber — cloud-only entity change does not call
  `saveEntityToFile`; local-only/full-sync changes still do.
- Manual (desktop): 
  1. Create note, verify local file written with correct `cloud-only` mode
     is *absent* (no file).
  2. Switch note to `local-only`, verify file appears with correct
     frontmatter.
  3. Switch back to `cloud-only` with existing file present → confirm popup
     appears; test both Delete and Keep paths.
  4. Manually plant a stale file (old bug's output) with mismatched
     `full-sync` frontmatter for a cloud-only entity id; relaunch app;
     confirm it's flagged in the startup scan popup.
  5. Rename entity while cloud-only via web/Supabase directly, switch back to
     local — confirm new file uses new title, old-titled orphan (if kept
     earlier) still flagged separately on next launch.
