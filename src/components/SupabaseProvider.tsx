'use client';

import { useEffect, useRef } from 'react';
import { useStore, Entity, AppTask, Space } from '@/data/store';
import { loadFromSupabase, subscribeRealtime, upsertSpace } from '@/lib/sync';
import { isSupabaseEnabled, supabase } from '@/lib/supabase';
import { parseLegacyLocalStorageSnapshot, entityToSQLiteRow, taskToSQLiteRow, spaceToSQLiteRow } from '@/lib/legacyImport';
import { loadFromSQLite } from '@/lib/loadFromSQLite';
import { isDesktop } from '@/lib/env';

const RECONCILE_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes

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

    // Apply UI state directly via useStore.setState
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

  // ── Shortcuts and Recent Entities ──
  if (data.settings) {
    if (data.settings.shortcuts) {
      store().setShortcutsState(data.settings.shortcuts);
    }
    if (data.settings.recentEntityIds) {
      useStore.setState({ recentEntityIds: data.settings.recentEntityIds });
    }
  }
}

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

  const { getVaultPath, listVaultFiles, isFileKeptByUser } = await import('@/lib/syncFileScan');
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
      const candidate = { path: file.path, entityId: file.parsed.id, entityTitle: file.fileName, recognized: false };
      if (!isFileKeptByUser(candidate)) flagged.push(candidate);
    } else if (entity.syncMode === 'cloud-only') {
      const candidate = { path: file.path, entityId: entity.id, entityTitle: entity.title, recognized: true };
      if (!isFileKeptByUser(candidate)) flagged.push(candidate);
    }
  }

  if (flagged.length > 0) {
    useStore.getState().openModal({ kind: 'syncFileCleanup', files: flagged });
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

    // 1. Initial load
    sqliteHydration.then(() => loadFromSupabase()).then(async (data) => {
      if (!data) {
        useStore.getState().setInitialSync(false);
        return;
      }

      // Ensure the personal workspace exists in the DB if it's missing.
      const hasPersonalWs = data.spaces.some(w => w.id === 'ws-personal');
      if (!hasPersonalWs && supabase) {
        const { data: { user } } = await supabase!.auth.getUser();
        if (user) {
          const s = useStore.getState();
          const personalWs = s.spaces.find(w => w.id === 'ws-personal');
          if (personalWs) {
            const updatedWs = { ...personalWs, ownerId: user.id };
            setSpaces([...data.spaces, updatedWs]);
            const { error } = await upsertSpace(updatedWs);
            if (error) {
              // RLS collision: another user owns 'ws-personal'. Keep it local-only.
              setSpaces([...data.spaces, personalWs]);
            }
          }
        }
      }

      // 3. Merge cloud + local data
      mergeCloudData(data);
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

      // 4. Restore cross-device recent items (prefer cloud if it has more entries)
      if (Array.isArray(data.settings?.recentEntityIds)) {
        const cloudRecent: string[] = data.settings.recentEntityIds;
        const localRecent = useStore.getState().recentEntityIds;
        // Merge: cloud items first (most recently opened across devices), then local-only ids
        const merged = [...cloudRecent];
        for (const id of localRecent) {
          if (!merged.includes(id)) merged.push(id);
        }
        useStore.getState().setRecentEntityIds(merged.slice(0, 10));
      }

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

      useStore.getState().setInitialSync(false);
      scanForStaleLocalFiles();
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

    // 2.5 Real-time Local File System Watcher
    let unsubscribeFsWatcher: (() => void) | null = null;
    const flowrFS = (window as any).flowrFS;
    if (flowrFS && flowrFS.onFileChanged) {
      import('@/lib/vaultSyncBridge').then(({ handleLocalFileChanged }) => {
        unsubscribeFsWatcher = flowrFS.onFileChanged((data: any) => {
          handleLocalFileChanged(data).catch((err: any) => {
            console.error('[Flowr FS watcher] Reconciler error:', err);
          });
        });
      });
    }

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
      if (unsubscribeFsWatcher) unsubscribeFsWatcher();
    };
  }, []);
 // eslint-disable-line react-hooks/exhaustive-deps

  return <>{children}</>;
}
