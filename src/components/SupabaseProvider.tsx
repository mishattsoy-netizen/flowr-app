'use client';

import { useEffect, useRef } from 'react';
import { useStore, Entity, AppTask, Workspace } from '@/data/store';
import { loadFromSupabase, subscribeRealtime, upsertWorkspace } from '@/lib/sync';
import { isSupabaseEnabled, supabase } from '@/lib/supabase';

const RECONCILE_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes

/**
 * Merge cloud data into the store, dropping synced items that no longer exist in the cloud.
 * Entities/workspaces with syncMode !== 'local-only' that are absent from
 * the cloud were deleted on another device — remove them. Only keep items explicitly
 * marked syncMode = 'local-only'.
 */
function mergeCloudData(data: {
  entities: Entity[];
  tasks: AppTask[];
  workspaces: Workspace[];
}) {
  const store = useStore.getState;

  // ── Entities ──
  if (data.entities.length > 0) {
    const localEntities = store().entities;
    const byId = new Map<string, Entity>();
    for (const ce of data.entities) byId.set(ce.id, ce);
    for (const le of localEntities) {
      const ce = byId.get(le.id);
      if (!ce) {
        if (le.syncMode !== 'local-only') continue; // deleted on another device — drop
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
        // Not in cloud — assume deleted on another device (or RLS now blocks it). Drop it.
        continue;
      }
      // Both exist — prefer the newer one (approximate: local writes are newer during
      // a session, but on a fresh page load cloud is authoritative).
      if ((lt as any).lastModified && (ct as any).lastModified &&
          (lt as any).lastModified > (ct as any).lastModified) {
        byId.set(lt.id, lt);
      }
    }
    store().setTasks(Array.from(byId.values()));
  }

  // ── Workspaces ──
  if (data.workspaces.length > 0) {
    const localWorkspaces = store().workspaces;
    const merged = [...data.workspaces];
    for (const lw of localWorkspaces) {
      if (!merged.find((mw: any) => mw.id === lw.id)) {
        if ((lw as any).syncMode !== 'local-only') continue; // deleted on another device — drop
        merged.push(lw);
      }
    }
    store().setWorkspaces(merged);
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
  const setWorkspaces = useStore(s => s.setWorkspaces);
  const setShortcutsState = useStore(s => s.setShortcutsState);

  const getEntities = () => useStore.getState().entities;
  const getTasks = () => useStore.getState().tasks;
  const getWorkspaces = () => useStore.getState().workspaces;

  const loaded = useRef(false);
  const reconcilerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isSupabaseEnabled || loaded.current) {
      if (!loaded.current) useStore.getState().setInitialSync(false);
      return;
    }
    loaded.current = true;

    // 1. Initial load
    loadFromSupabase().then(async (data) => {
      if (!data) {
        useStore.getState().setInitialSync(false);
        return;
      }

      // Ensure the personal workspace exists in the DB if it's missing.
      const hasPersonalWs = data.workspaces.some(w => w.id === 'ws-personal');
      if (!hasPersonalWs && supabase) {
        const { data: { user } } = await supabase!.auth.getUser();
        if (user) {
          const s = useStore.getState();
          const personalWs = s.workspaces.find(w => w.id === 'ws-personal');
          if (personalWs) {
            try {
              const updatedWs = { ...personalWs, ownerId: user.id };
              setWorkspaces([...data.workspaces, updatedWs]);
              await upsertWorkspace(updatedWs);
            } catch (err: any) {
              console.warn('[Flowr sync] Could not sync personal workspace (likely RLS collision):', err.message);
              setWorkspaces([...data.workspaces, personalWs]);
            }
          }
        }
      }

      // 3. Merge cloud + local data
      mergeCloudData(data);

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

      // 5. Restore cross-device shortcuts
      if (data.settings?.shortcuts) {
        useStore.getState().setShortcutsState(data.settings.shortcuts);
      }

      useStore.getState().setInitialSync(false);
      scanForStaleLocalFiles();
    }).catch(err => {
      console.error('[Flowr sync] Initial load from Supabase failed, falling back to local state:', err);
      useStore.getState().setInitialSync(false);
    });

    // 2. Realtime subscription
    const unsubscribeCore = subscribeRealtime({
      setEntities, getEntities,
      setTasks, getTasks,
      setWorkspaces, getWorkspaces,
      setShortcutsState,
    });

    // 3. Periodic reconciliation — catches missed realtime events (e.g. other browser
    //    deleted items while this tab was closed or offline).
    const reconcile = () => {
      loadFromSupabase().then(data => {
        if (data) mergeCloudData(data);
      });
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
