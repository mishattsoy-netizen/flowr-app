# Stable Refresh — Design

**Date:** 2026-07-15
**Status:** Approved (pending spec review)

## Problem

Hitting refresh (F5) causes visible instability:

1. The app "transforms" — skeletons play on tabs, Recents, the task widget, and Shortcuts on **every** refresh, even though that data is already cached locally.
2. The user is transferred to the **dashboard** instead of staying on the page they had open.
3. Recents cards and Shortcuts **sometimes clear/disappear** with no obvious pattern (suspected worse on the dev server).
4. All content is **re-fetched from the cloud** on every boot instead of only fetching what changed.

The goal: refresh should keep the same page, not visibly reload the UI, keep recents/shortcuts stable, and (on the cloud path) fetch only new/changed items.

## Root causes (all verified against the code)

None of these are data loss in localStorage — persistence is implemented correctly. They are rendering-gate and cloud-merge bugs.

| Symptom | Cause | File |
|---|---|---|
| Skeleton shimmer on tabs/Recents/task widget/Shortcuts every refresh | Artificial readiness gate: `isReady = isMounted && storeHydrated && minTimePassed`, with a hardcoded 600ms `MINIMUM_LOADING_TIME` and an `isMounted` flag that only flips after first paint. Forces `isLoading = true` for ≥600ms even though the persisted store (synchronous localStorage) is already hydrated on first render. Widgets read persisted state directly and only shimmer because `isLoading` is forced true. | `src/hooks/useAppReady.ts`; consumed in `src/components/EntityPageRenderer.tsx`, `src/components/dashboard/Dashboard.tsx`, `src/components/workspace/widgets/ShortcutsWidget.tsx`, `src/components/layout/Shell.tsx` |
| Lands on dashboard, not the open page | `EntityPageRenderer.tsx:28` gates the entity lookup on `storeHydrated`; while the gate is closed, `entity` is `undefined`, and the `!entity && isLoading` fallback (lines 48–57) *guesses* the page type — rendering a fake `SpacePage` or `Dashboard` before swapping to the real page. `WorkspaceRouter.tsx:11` receives an `initialEntityId` prop (from the `flowr-initial-entity` cookie set in `layout.tsx`) but ignores it (line 30). | `src/components/EntityPageRenderer.tsx`, `src/components/WorkspaceRouter.tsx`, `src/app/layout.tsx`, `src/app/app/page.tsx` |
| Recents/shortcuts/tabs sometimes clear | On boot, `mergeCloudData(data)` (`SupabaseProvider.tsx:227`) applies cloud `settings`/`ui_state` **raw**: it overwrites local `recentEntityIds` (line 125), `shortcuts` (line 122), and `openTabIds`/`activeTabId`/`activeEntityId` (lines 107–116). When the cloud copy is stale/empty (dev server), local data is clobbered. The "merge local+cloud recents" union (lines 261–269) is **dead code** — it reads `getState().recentEntityIds` *after* line 125 already overwrote it with the cloud value, so it preserves nothing. The periodic reconciler already defends against this by stripping settings (`mergeCloudData({ ...data, settings: undefined })`, line 330); the boot path does not. | `src/components/SupabaseProvider.tsx` |
| Re-fetches everything each boot | `loadFromSupabase()` (`sync.ts:248`) does an unconditional full-table `select('*')` for entities/tasks/spaces/settings. No `last_modified` cursor. Deletions are hard deletes (`.delete().eq('id', id)`, no tombstone). | `src/lib/sync.ts` |

## Platform behavior (important constraint)

- **Free / local-only desktop** (`isSupabaseEnabled === false`): the entire Supabase block in `SupabaseProvider` is skipped (`SupabaseProvider.tsx:192–198`). Data comes only from local SQLite (`loadFromSQLite`) + the localStorage persist snapshot. **No cloud, no network, ever.** Scope 2 and Scope 3 (both cloud-path only) are complete no-ops for these users — their offline guarantee is untouched.
- **Web / signed-in desktop** (`isSupabaseEnabled === true`): SQLite hydration (desktop) → `loadFromSupabase` full-fetch → `mergeCloudData` layers cloud over local (LWW by `lastModified`), then realtime subscription + periodic reconciler + refetch-on-tab-refocus.

Scope 1 is pure client rendering and behaves identically on both platforms (desktop is faster — SQLite is local disk).

## Design — three scopes, sequenced by risk, independently shippable

Ship order: **1 → 3 → 2.** Scope 1 delivers essentially all of the "feels instant" win and can ship without waiting on the riskier sync work.

### Scope 1 — Instant cached render (low risk)

Fixes symptoms 1 and 2. No platform branching, no backend.

1. **`useAppReady.ts`** — remove `MINIMUM_LOADING_TIME` (600ms timer) and the `isMounted` gate. Base readiness on `storeHydrated` alone (synchronous localStorage hydration means this is effectively true on first render). Keep the `onFinishHydration` fallback for the rare async-storage case.
2. **`EntityPageRenderer.tsx`** — once readiness is instant, the entity is found on first paint, so the wrong-component-flash stops. Remove/clean up the `!entity && isLoading` page-type-guessing fallback (lines 48–57) that renders a fake `SpacePage`/`Dashboard`.
3. **`WorkspaceRouter.tsx`** — use the `initialEntityId` prop (from the `flowr-initial-entity` cookie) as the render seed instead of ignoring it, so even the server's first paint targets the correct page.

**Risk:** minimal. Removes artificial waiting and a guessing bug; the app still waits for genuine data readiness.

**Acceptance:** Refresh on a note/canvas/folder/tracker page → stays on that page, no skeleton shimmer on tabs/Recents/task widget/Shortcuts, no dashboard flash. Verified on both web and desktop.

### Scope 3 — Non-destructive cloud settings merge (medium risk — touches sync semantics)

Fixes symptom 3. Cloud path only. **Chosen policy: non-destructive union** — local recents/shortcuts/tabs are never dropped; cloud additions still appear.

1. **Recents** (`SupabaseProvider.tsx`): remove the raw overwrite at line 125. Perform a real union: local `recentEntityIds` first (preserving current-device order), then any cloud IDs not already present, capped at the existing limit. The union block at 261–269 becomes live once the earlier overwrite is gone.
2. **Shortcuts** (line 122): replace the raw `setShortcutsState(data.settings.shortcuts)` with a union-by-key. Shortcuts have **no per-item timestamp**, so conflicts can't use LWW — policy is **local-wins** on key collision (local device's version of a shortcut is kept; cloud only contributes keys local doesn't have). Preserve the existing legacy-unscoped-key stripping (lines 290–306).
3. **UI state / tabs** (lines 88–116): stop letting stale cloud `ui_state` override the just-restored local page/tabs on boot. Prefer local `activeEntityId`/`openTabIds` (already restored from persist); only fall back to cloud `ui_state` when local is genuinely empty. This reinforces Scope 1's "stay on page."

**Constraint:** do not regress cross-device sync — the reason cloud settings are applied at all is legitimate (recents/shortcuts/tabs follow the user across devices). The fix is *non-destructive merge*, not disabling cloud settings.

**Acceptance:** On the dev server, repeated refreshes never clear locally-added recents or shortcuts. A recent/shortcut added on another device still appears after sync.

### Scope 2 — Delta sync via ID-list diff (bigger; cloud path only; backend queries)

Fixes symptom 4. Cloud path only — free desktop users never execute it. **No schema change, no tombstones, catches offline deletions.**

Per table (entities, tasks, spaces):

1. **All-IDs query:** `select('id, last_modified')` for every row — tiny compared to `select('*')` (which drags `content`/`widget_layout`/`subtasks` payloads). This is where the bandwidth win comes from.
2. **Delta query:** `select('*').gt('last_modified', cursor)` — full rows only for creates/edits since the last sync.
3. **Merge:** upsert the delta rows (LWW by `lastModified`); then drop any local row whose ID is **absent from the all-IDs set** — this catches deletions, including ones made while this client was offline (which realtime misses because it wasn't subscribed).
4. **Cursor:** store `lastSyncedAt` (per-table or global) in the persisted store; new cursor = `max(last_modified)` seen.

**`mergeCloudData` restructure:** its current deletion handling infers "deleted" from *absence in a full snapshot* (entities lines 33–41, tasks 57–60). With a delta payload that assumption is false and would wipe every unchanged local row. Split into: (a) apply delta rows via upsert + LWW, (b) reconcile deletions against the explicit all-IDs set. This also hardens the same partial-snapshot fragility that Scope 3 touches.

**Constraints:**
- `filterLocalOnlyForWeb` means the web all-IDs set includes `local-only` rows filtered out of the store — the diff must not try to drop rows that were never in the store, nor resurrect them.
- Keep the existing `markSelfDeleted` / self-delete-echo machinery for the "I just deleted this myself" race.
- Realtime (`subscribeRealtime`) stays as-is for live updates while connected; delta sync only changes the boot/reconcile fetch.

**Framing:** Scope 2 is bandwidth/cost hygiene, **not** what makes refresh feel fast — Scope 1 already delivers the felt instantness because the UI paints from cache before any fetch runs. Scope 2 makes the invisible background fetch cheap.

**Acceptance:** On boot with unchanged data, network payload for entities/tasks/spaces is ID-lists only (no full-row bodies). A row created, edited, or deleted (including while offline) on another device reconciles correctly on next boot.

**Future (out of scope):** soft-delete tombstones (`deleted_at`) would make offline deletions propagate *instantly* via realtime rather than at next reconcile — bigger lift, marginal benefit, not in v1.

## Out of scope

- Rebuilding a full-app skeleton (explicitly removed by the user; the fix is to render cached data, not to skeleton better).
- Any change to the free/local-only desktop data path.
- Tombstone/soft-delete schema changes.
