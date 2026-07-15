// Verifies Scope 3: boot-time cloud settings must MERGE (non-destructively)
// into local recents/shortcuts/tabs, never raw-overwrite them. On the dev
// server the cloud settings row is often stale/empty; a raw overwrite there
// silently clears locally-added recents and shortcuts.
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/sync', () => ({
  loadFromSupabase: vi.fn(),
  subscribeRealtime: vi.fn(),
  upsertSpace: vi.fn(),
}));
vi.mock('@/lib/supabase', () => ({ isSupabaseEnabled: false, supabase: null }));

import { useStore } from '@/data/store';
import { mergeCloudData } from './SupabaseProvider';

describe('Scope 3: non-destructive cloud settings merge', () => {
  beforeEach(() => {
    useStore.setState({
      entities: [
        { id: 'e-1', title: 'Note 1', type: 'note', parentId: null, lastModified: 1, syncMode: 'full-sync', pairedEntityId: null } as any,
        { id: 'e-2', title: 'Note 2', type: 'note', parentId: null, lastModified: 1, syncMode: 'full-sync', pairedEntityId: null } as any,
      ],
      tasks: [],
      spaces: [],
      recentEntityIds: ['e-1'],
      shortcuts: { dashboard: [{ id: 's-local', type: 'url', label: 'Local', value: 'x' }] },
    });
  });

  it('keeps a locally-added recent when cloud settings recents are empty/stale', () => {
    mergeCloudData({
      entities: [], tasks: [], spaces: [],
      settings: { recentEntityIds: [] },
    });
    expect(useStore.getState().recentEntityIds).toContain('e-1');
  });

  it('unions cloud recents in without dropping local ones (local order first)', () => {
    mergeCloudData({
      entities: [], tasks: [], spaces: [],
      settings: { recentEntityIds: ['e-2'] },
    });
    const recents = useStore.getState().recentEntityIds;
    expect(recents).toContain('e-1'); // local preserved
    expect(recents).toContain('e-2'); // cloud added
    expect(recents.indexOf('e-1')).toBeLessThan(recents.indexOf('e-2')); // local first
  });

  it('keeps a locally-added shortcut when cloud shortcuts for that context are empty', () => {
    mergeCloudData({
      entities: [], tasks: [], spaces: [],
      settings: { shortcuts: {} },
    });
    expect(useStore.getState().shortcuts.dashboard).toHaveLength(1);
    expect(useStore.getState().shortcuts.dashboard[0].id).toBe('s-local');
  });

  it('unions cloud shortcuts in per context; local wins on id collision', () => {
    mergeCloudData({
      entities: [], tasks: [], spaces: [],
      settings: { shortcuts: {
        dashboard: [
          { id: 's-local', type: 'url', label: 'Cloud version', value: 'y' }, // collision: local must win
          { id: 's-cloud', type: 'url', label: 'Cloud only', value: 'z' },     // new: added
        ],
      } },
    });
    const dash = useStore.getState().shortcuts.dashboard;
    const byId = Object.fromEntries(dash.map((s: any) => [s.id, s]));
    expect(byId['s-local'].label).toBe('Local');       // local wins collision
    expect(byId['s-cloud'].label).toBe('Cloud only');  // cloud-only added
  });
});

describe('Scope 3: local page/tabs win over stale cloud ui_state', () => {
  beforeEach(() => {
    useStore.setState({
      entities: [
        { id: 'e-open', title: 'Open note', type: 'note', parentId: null, lastModified: 1, syncMode: 'full-sync', pairedEntityId: null } as any,
      ],
      tasks: [], spaces: [],
      activeEntityId: 'e-open',
      openTabIds: ['e-open'],
      activeTabId: 'e-open',
    });
  });

  it('does not overwrite the local open page with stale cloud ui_state', () => {
    mergeCloudData({
      entities: [], tasks: [], spaces: [],
      settings: { ui_state: { activeEntityId: 'dashboard', openTabIds: ['dashboard'], activeTabId: 'dashboard' } },
    });
    expect(useStore.getState().activeEntityId).toBe('e-open');
  });
});
