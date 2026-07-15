// Verifies Scope 2: a delta merge must reconcile deletions against an explicit
// id set (not by "absent from the payload"), so unchanged local rows survive a
// partial delta while genuinely-deleted rows (absent from the id set) are dropped.
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/sync', () => ({
  loadFromSupabase: vi.fn(),
  loadDeltaFromSupabase: vi.fn(),
  subscribeRealtime: vi.fn(),
  upsertSpace: vi.fn(),
}));
vi.mock('@/lib/supabase', () => ({ isSupabaseEnabled: false, supabase: null }));

import { useStore } from '@/data/store';
import { mergeDeltaData } from './SupabaseProvider';

describe('Scope 2: mergeDeltaData deletion reconciliation', () => {
  beforeEach(() => {
    useStore.setState({
      entities: [
        { id: 'e-keep', title: 'Unchanged', type: 'note', parentId: null, lastModified: 100, syncMode: 'full-sync', pairedEntityId: null } as any,
        { id: 'e-gone', title: 'Deleted elsewhere', type: 'note', parentId: null, lastModified: 100, syncMode: 'full-sync', pairedEntityId: null } as any,
      ],
      tasks: [], spaces: [],
    });
  });

  it('keeps an unchanged local row absent from the delta but present in the id set', () => {
    mergeDeltaData({
      entities: [], tasks: [], spaces: [], settings: {},
      entityIds: new Set(['e-keep', 'e-gone']),
      taskIds: new Set(), spaceIds: new Set(),
    });
    expect(useStore.getState().entities.map(e => e.id).sort()).toEqual(['e-gone', 'e-keep']);
  });

  it('drops a local row whose id is absent from the id set (deleted on another device)', () => {
    mergeDeltaData({
      entities: [], tasks: [], spaces: [], settings: {},
      entityIds: new Set(['e-keep']), // e-gone deleted remotely
      taskIds: new Set(), spaceIds: new Set(),
    });
    expect(useStore.getState().entities.map(e => e.id)).toEqual(['e-keep']);
  });

  it('applies a changed delta row via upsert (LWW) without dropping unchanged rows', () => {
    mergeDeltaData({
      entities: [
        { id: 'e-keep', title: 'Now edited', type: 'note', parentId: null, lastModified: 999, syncMode: 'full-sync', pairedEntityId: null } as any,
      ],
      tasks: [], spaces: [], settings: {},
      entityIds: new Set(['e-keep', 'e-gone']),
      taskIds: new Set(), spaceIds: new Set(),
    });
    const byId = Object.fromEntries(useStore.getState().entities.map(e => [e.id, e]));
    expect(byId['e-keep'].title).toBe('Now edited');
    expect(byId['e-gone']).toBeDefined();
  });
});
