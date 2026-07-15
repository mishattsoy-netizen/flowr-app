'use client';

import { useEffect, useRef } from 'react';
import { useStore, Entity, AppTask, Space } from '@/data/store';
import type { Shortcut } from '@/data/store.types';
import { loadFromSupabase, subscribeRealtime, upsertSpace } from '@/lib/sync';
import { isSupabaseEnabled, supabase } from '@/lib/supabase';
import { parseLegacyLocalStorageSnapshot, entityToSQLiteRow, taskToSQLiteRow, spaceToSQLiteRow } from '@/lib/legacyImport';
import { loadFromSQLite } from '@/lib/loadFromSQLite';
import { isDesktop } from '@/lib/env';

const RECONCILE_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes

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
  local: Record<string, Shortcut[]>,
  cloud: Record<string, Shortcut[]>,
): Record<string, Shortcut[]> {
  const result: Record<string, Shortcut[]> = { ...local };
  for (const [ctx, cloudList] of Object.entries(cloud)) {
    const localList = local[ctx] ?? [];
    const localIds = new Set(localList.map(s => s.id));
    const additions = cloudList.filter(s => !localIds.has(s.id));
    result[ctx] = [...localList, ...additions].slice(0, 12);
  }
  return result;
}

/**
 * Merge cloud data into the store, dropping synced items that no longer exist in the cloud.
 * Entities/spaces with syncMode !== 'local-only' that are absent from
 * the cloud were deleted on another device — remove them. Only keep items explicitly
 * marked syncMode = 'local-only'.
 */
export function mergeCloudData(data: {
  entities: Entity[];
  tasks: AppTask[];
  spaces: Space[];
  settings?: Record<string, any>;
}) {
  const store = useStore.getState;
  const desktop = isDesktop();

  // ── Entities ──
  if (data.entities.length > 0) {
    const localEntities = store().entities;
    const byId = new Map<string, Entity>();
    for (const ce of data.entities) byId.set(ce.id, ce);
    for (const le of localEntities) {
      const ce = byId.get(le.id);
      if (!ce) {
        // Web must never keep a local-only entity — local-only is desktop-
        // exclusive and shouldn't survive here even if it somehow ended up in
        // web's local state (defense in depth; loadFromSupabase already
        // filters it out of `data`, so this only matters for stale local
        // state absent from the cloud response).
        if (le.syncMode !== 'local-only' || !desktop) continue; // deleted on another device — drop
        byId.set(le.id, le);
        continue;
      }
      const localTs = le.lastModified ?? 0;
      const cloudTs = ce.lastModified ?? 0;
      if (localTs > cloudTs) byId.set(le.id, le);
    }
    store().setEntities(Array.from(byId.values()));
  }

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

  // ── Workspaces ──
  if (data.spaces.length > 0) {
    const localWorkspaces = store().spaces;
    const byId = new Map<string, Space>();
    for (const cw of data.spaces) byId.set(cw.id, cw);
    for (const lw of localWorkspaces) {
      const cw = byId.get(lw.id);
      if (!cw) {
        if (lw.syncMode !== 'local-only' || !desktop) continue; // deleted on another device — drop
        byId.set(lw.id, lw);
        continue;
      }
      const localTs = lw.lastModified ?? 0;
      const cloudTs = cw.lastModified ?? 0;
      if (localTs > cloudTs) byId.set(lw.id, lw);
    }
    store().setSpaces(Array.from(byId.values()));
  }

  // ── UI State ──
  if (data.settings && data.settings.ui_state) {
    const ui = data.settings.ui_state;
    // System routes (dashboard/tracker/chat/settings) aren't real entities, so
    // only entity-like ids need to be checked against what actually exists —
    // a stale id here (e.g. from an entity deleted since this was last synced)
    // must not resurrect a dead reference and blank the page.
    const SYSTEM_ROUTES = new Set(['dashboard', 'tracker', 'chat', 'settings']);
    const knownIds = new Set(useStore.getState().entities.map(e => e.id));
    const isValidId = (id: string | null | undefined) =>
      !!id && (SYSTEM_ROUTES.has(id) || knownIds.has(id));

    const openTabIds = (ui.openTabIds || []).filter(isValidId);
    const activeTabId = isValidId(ui.activeTabId) ? ui.activeTabId : (openTabIds[0] || 'dashboard');
    const activeEntityId = isValidId(ui.activeEntityId) ? ui.activeEntityId : activeTabId;
    const splitViewLeftId = isValidId(ui.splitViewLeftId) ? ui.splitViewLeftId : null;
    const splitViewRightId = isValidId(ui.splitViewRightId) ? ui.splitViewRightId : null;

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
  }

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
}

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

/**
 * Mounts once at app root.
 * - Loads initial data from Supabase on boot (overrides localStorage if Supabase is configured).
 * - Subscribes to realtime changes so edits from other devices appear instantly.
 * - Periodically reconciles with the cloud to catch missed realtime events.
 * - Reconciles on visibilitychange (tab refocus) for cross-browser consistency.
 */
export default function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const setEntities = useStore(s => s.setEntities);
  const setTasks = useStore(s => s.setTasks);
  const setSpaces = useStore(s => s.setSpaces);
  const setShortcutsState = useStore(s => s.setShortcutsState);

  const getEntities = () => useStore.getState().entities;
  const getTasks = () => useStore.getState().tasks;
  const getWorkspaces = () => useStore.getState().spaces;

  const loaded = useRef(false);
  const reconcilerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;

    // 0. Hydrate from local SQLite first (desktop only), regardless of whether
    //    Supabase is configured — SQLite is the local source of truth and must
    //    load even fully offline. This is a direct hydration via the bulk
    //    setters, NOT a merge through mergeCloudData: loadFromSQLite() never
    //    returns cloud-only rows (the desktop write-through subscriber
    //    deliberately excludes them), so piping this dataset through
    //    mergeCloudData's drop-on-absence semantics would delete every
    //    cloud-only entity/task/space already in the store. The Supabase
    //    load below (step 1) is awaited AFTER this so its mergeCloudData call
    //    — which correctly preserves local-only entries and applies LWW —
    //    always layers on top of a fully-hydrated local base instead of
    //    racing it.
    const sqliteHydration = isDesktop()
      ? (async () => {
          if ((window as any).flowrDB) {
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
          return loadFromSQLite().then((localData) => {
            const s = useStore.getState();
            s.setEntities(localData.entities);
            s.setTasks(localData.tasks);
            s.setSpaces(localData.spaces);
          });
        })().catch(err => {
          console.error('[Flowr sync] SQLite hydration/import failed:', err);
        })
      : Promise.resolve();

    if (!isSupabaseEnabled) {
      // Same early-return as before this change, just deferred until after
      // SQLite hydration: no Supabase realtime/reconciliation/fs-watcher setup
      // when Supabase isn't configured.
      sqliteHydration.then(() => useStore.getState().setInitialSync(false));
      return;
    }

    // 1. Initial load. Use a delta load (changed rows + all-id sets) once a sync
    //    cursor exists from a prior session; otherwise a full load on first boot.
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

    sqliteHydration.then(() => initialLoad()).then(async (data) => {
      if (!data) {
        useStore.getState().setInitialSync(false);
        return;
      }

      // Ensure the personal workspace exists in the DB if it's missing.
      // Under a delta load, data.spaces holds ONLY changed spaces — ws-personal
      // rarely changes, so it's usually absent from the delta even though it
      // exists. Check the full cloud id-set (always present on delta results)
      // so we don't spuriously run the branch below and truncate spaces.
      const hasPersonalWs = 'spaceIds' in data
        ? (data as any).spaceIds.has('ws-personal')
        : data.spaces.some(w => w.id === 'ws-personal');
      if (!hasPersonalWs && supabase) {
        const { data: { user } } = await supabase!.auth.getUser();
        if (user) {
          const s = useStore.getState();
          const personalWs = s.spaces.find(w => w.id === 'ws-personal');
          if (personalWs) {
            const updatedWs = { ...personalWs, ownerId: user.id };
            // Merge onto EXISTING local spaces (not data.spaces, which under a
            // delta load holds only changed spaces) so unchanged spaces survive.
            const otherSpaces = s.spaces.filter(w => w.id !== 'ws-personal');
            setSpaces([...otherSpaces, updatedWs]);
            const { error } = await upsertSpace(updatedWs);
            if (error) {
              // RLS collision: another user owns 'ws-personal'. Keep it local-only.
              setSpaces([...otherSpaces, personalWs]);
            }
          }
        }
      }

      // 3. Merge cloud + local data. The delta result carries id-sets for
      //    deletion reconciliation; the full result does not.
      if ('entityIds' in data) {
        mergeDeltaData(data as any);
      } else {
        mergeCloudData(data);
      }
      const s = useStore.getState();

      // --- Auto-cleanup for dead entities and corrupted spaceIds ---
      s.fixDatabaseIntegrity();

      // --- Seed defaults for first-time users ---
      if (s.entities.length === 0 && !s.defaultsSeeded) {
        const { data: { user } } = await supabase!.auth.getUser();
        if (user) {
          s.seedDefaults();
        }
      }
      
      // --- Auto-cleanup for duplicate "Untitled Canvas" entities ---
      const canvases = s.entities.filter(e => e.title === 'Untitled Canvas');
      if (canvases.length > 1) {
        canvases.sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
        const toDelete = canvases.slice(1);
        let cleaned = 0;
        toDelete.forEach(c => {
          const isEmpty = !c.content || (Array.isArray(c.content) && c.content.length === 0) || (typeof c.content === 'string' && c.content === '');
          if (isEmpty) {
            s.deleteEntity(c.id);
            cleaned++;
          }
        });
        if (cleaned > 0) {
          console.log(`[Flowr] Auto-cleaned ${cleaned} empty 'Untitled Canvas' duplicates.`);
        }
      }
      // -------------------------------------------------------------

      // 4. Restore cross-device recent items (handled by mergeCloudData)

      // 4b. Prune stale recent entities — IDs that point to entities/spaces that
      //     no longer exist (e.g. dropped by mergeCloudData when the cloud doesn't
      //     have them yet, or deleted on another device). Without this, the recents
      //     widget silently shows "No recent documents" because the IDs fail to
      //     resolve, even though the array itself persists correctly in localStorage.
      {
        const state = useStore.getState();
        const knownIds = new Set([
          ...state.entities.map(e => e.id),
          ...state.spaces.map(s => s.id),
        ]);
        const pruned = state.recentEntityIds.filter(id => knownIds.has(id));
        if (pruned.length !== state.recentEntityIds.length) {
          useStore.getState().setRecentEntityIds(pruned);
        }
      }

      // 5. Restore cross-device shortcuts (strip legacy unscoped keys)
      if (data.settings?.shortcuts) {
        const cloudShortcuts = data.settings.shortcuts;
        const cleaned: Record<string, any> = {};
        let hadUnscoped = false;
        for (const [key, value] of Object.entries(cloudShortcuts)) {
          if (key.includes(':')) {
            cleaned[key] = value;
          } else {
            hadUnscoped = true;
          }
        }
        useStore.getState().setShortcutsState(cleaned);
        // Push cleaned shortcuts back to Supabase so unscoped keys don't come back
        if (hadUnscoped) {
          import('@/lib/sync').then(({ upsertSetting }) => upsertSetting('shortcuts', cleaned));
        }
      }

      // Advance the delta cursor to the newest last_modified we now hold, so the
      // next boot only fetches rows changed after this point.
      {
        const s2 = useStore.getState();
        const maxTs = (rows: Array<{ lastModified?: number }>) =>
          rows.reduce((m, r) => Math.max(m, r.lastModified ?? 0), 0);
        s2.setSyncCursor('entities', Math.max(cursors.entities ?? 0, maxTs(s2.entities)));
        s2.setSyncCursor('tasks', Math.max(cursors.tasks ?? 0, maxTs(s2.tasks)));
        s2.setSyncCursor('spaces', Math.max(cursors.spaces ?? 0, maxTs(s2.spaces)));
      }

      useStore.getState().setInitialSync(false);
      import('@/data/store').then(({ drainPendingModeWrites }) => drainPendingModeWrites());
    }).catch(err => {
      console.error('[Flowr sync] Initial load from Supabase failed, falling back to local state:', err);
      useStore.getState().setInitialSync(false);
    });

    // 2. Realtime subscription
    const unsubscribeCore = subscribeRealtime({
      setEntities, getEntities,
      setTasks, getTasks,
      setSpaces, getWorkspaces,
      setShortcutsState,
    });

    // 3. Periodic reconciliation — catches missed realtime events (e.g. other browser
    //    deleted items while this tab was closed or offline).
    //    IMPORTANT: Only sync data (entities/tasks/spaces), NOT UI state — otherwise
    //    switching tabs and back overwrites the user's current page with stale cloud data.
    const reconcile = async () => {
      const data = await loadFromSupabase();
      if (data) {
        mergeCloudData({ ...data, settings: undefined });
        const rs = useStore.getState();
        if (rs.entities.length === 0 && !rs.defaultsSeeded) {
          const { data: { user } } = await supabase!.auth.getUser();
          if (user) rs.seedDefaults();
        }
      }
    };

    reconcilerRef.current = setInterval(reconcile, RECONCILE_INTERVAL_MS);

    // 4. Reconcile on tab refocus — when the user switches back to this tab,
    //    catch up on any changes made on other devices while it was backgrounded.
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') reconcile();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      unsubscribeCore();
      if (reconcilerRef.current) clearInterval(reconcilerRef.current);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);
 // eslint-disable-line react-hooks/exhaustive-deps

  return <>{children}</>;
}
