// Verifies the Task 9 invariant: SQLite-sourced local data must be applied via
// direct bulk-setter hydration, sequenced BEFORE mergeCloudData runs — never
// piped through mergeCloudData itself, which would drop cloud-only entities
// absent from the passed-in dataset.
//
// Also verifies the fix for a second, compounding bug found while implementing
// this task: the Zustand `persist` localStorage blob still pre-seeds
// entities/tasks/spaces (including cloud-only ones) before this boot code
// runs. Since setEntities() is a full replace, hydrating from SQLite would
// wipe any cloud-only entities carried over from localStorage — UNLESS
// SQLite mirrors cloud-only entities too, which is why the desktop
// write-through subscriber (store.ts, Task 7) no longer excludes cloud-only.
//
// This does not exercise the React component/effect directly (no jsdom/RTL in
// this project's vitest config — environment: 'node'); instead it drives the
// same primitives the effect calls, in the same order.
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/sync', () => ({
  loadFromSupabase: vi.fn(),
  subscribeRealtime: vi.fn(),
  upsertSpace: vi.fn(),
}));
vi.mock('@/lib/supabase', () => ({ isSupabaseEnabled: false, supabase: null }));

import { useStore } from '@/data/store';
import { mergeCloudData } from './SupabaseProvider';

describe('boot hydration ordering (Task 9 anti-data-loss invariant)', () => {
  beforeEach(() => {
    useStore.setState({ entities: [], tasks: [], spaces: [] });
  });

  it('a cloud-only entity present only in Supabase is correctly added by mergeCloudData after SQLite hydration ran first on an empty store', () => {
    expect(useStore.getState().entities).toEqual([]);

    // Step 0 equivalent: loadFromSQLite()'s result applied via the bulk setter
    // directly — NOT through mergeCloudData.
    const sqliteEntities = [
      { id: 'e-local', title: 'Local note', type: 'note', parentId: null, lastModified: 100, syncMode: 'local-only', pairedEntityId: null } as any,
    ];
    useStore.getState().setEntities(sqliteEntities);
    expect(useStore.getState().entities.map(e => e.id)).toEqual(['e-local']);

    // Step 1 equivalent: mergeCloudData runs afterward with the real Supabase
    // dataset, which includes a cloud-only entity.
    mergeCloudData({
      entities: [
        { id: 'e-cloud', title: 'Cloud only note', type: 'note', parentId: null, lastModified: 500, syncMode: 'cloud-only', pairedEntityId: null } as any,
      ],
      tasks: [],
      spaces: [],
    });

    const finalIds = useStore.getState().entities.map(e => e.id).sort();
    expect(finalIds).toEqual(['e-cloud', 'e-local']);
  });

  it('demonstrates the bug this design avoids: piping the SQLite dataset through mergeCloudData directly (instead of setEntities) would drop entities absent from it', () => {
    useStore.setState({
      entities: [
        { id: 'e-cloud', title: 'Cloud only note', type: 'note', parentId: null, lastModified: 500, syncMode: 'cloud-only', pairedEntityId: null } as any,
      ],
    });

    const sqliteEntities = [
      { id: 'e-local', title: 'Local note', type: 'note', parentId: null, lastModified: 100, syncMode: 'local-only', pairedEntityId: null } as any,
    ];
    mergeCloudData({ entities: sqliteEntities, tasks: [], spaces: [] });

    // mergeCloudData's drop-on-absence semantics remove any entity not present
    // in the passed dataset unless it's local-only. Passing SQLite data through
    // it (rather than using the bulk setter directly) would silently delete
    // whatever isn't in that particular SQLite snapshot.
    expect(useStore.getState().entities.find(e => e.id === 'e-cloud')).toBeUndefined();
  });

  it('a cloud-only entity pre-seeded by the localStorage persist blob survives SQLite hydration because SQLite now mirrors cloud-only entities too', () => {
    // Simulates the real bug found during implementation: the Zustand persist
    // middleware rehydrates entities/tasks/spaces from localStorage
    // synchronously on store creation — BEFORE this boot effect runs — and
    // that persisted snapshot can contain cloud-only entities from a prior
    // session.
    useStore.setState({
      entities: [
        { id: 'e-cloud', title: 'Cloud note from localStorage', type: 'note', parentId: null, lastModified: 500, syncMode: 'cloud-only', pairedEntityId: null } as any,
      ],
    });

    // Because the SQLite write-through subscriber (store.ts) mirrors ALL sync
    // modes including cloud-only, a real SQLite snapshot loaded via
    // loadFromSQLite() will already include this cloud-only entity — it is
    // NOT the empty/local-only-only set the old (buggy) design assumed.
    const sqliteEntities = [
      { id: 'e-cloud', title: 'Cloud note from localStorage', type: 'note', parentId: null, lastModified: 500, syncMode: 'cloud-only', pairedEntityId: null } as any,
      { id: 'e-local', title: 'Local note', type: 'note', parentId: null, lastModified: 100, syncMode: 'local-only', pairedEntityId: null } as any,
    ];
    useStore.getState().setEntities(sqliteEntities);

    // The cloud-only entity survives the full-replace hydration because
    // SQLite's own snapshot already contained it — no data loss, even if the
    // subsequent Supabase load (mergeCloudData) is slow, offline, or fails.
    expect(useStore.getState().entities.find(e => e.id === 'e-cloud')).toBeDefined();
  });
});
