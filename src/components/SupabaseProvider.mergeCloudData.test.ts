// src/components/SupabaseProvider.mergeCloudData.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/sync', () => ({
  loadFromSupabase: vi.fn(),
  subscribeRealtime: vi.fn(),
  upsertSpace: vi.fn(),
}));
vi.mock('@/lib/supabase', () => ({ isSupabaseEnabled: false, supabase: null }));

import { useStore } from '@/data/store';

// mergeCloudData is not exported today; this test drives it indirectly via
// the store state it mutates. Import the function directly once exported (Step 2).
import { mergeCloudData } from './SupabaseProvider';

describe('mergeCloudData task LWW', () => {
  beforeEach(() => {
    useStore.setState({
      tasks: [{ id: 't-1', title: 'Local edit', completed: false, lastModified: 2000, syncMode: 'full-sync' } as any],
      entities: [],
      spaces: [],
    });
  });

  it('keeps the local task when local.lastModified is newer than remote', () => {
    mergeCloudData({
      entities: [],
      tasks: [{ id: 't-1', title: 'Stale remote', completed: false, lastModified: 1000, syncMode: 'full-sync' } as any],
      spaces: [],
    });
    expect(useStore.getState().tasks[0].title).toBe('Local edit');
  });

  it('takes the remote task when remote.lastModified is newer than local', () => {
    mergeCloudData({
      entities: [],
      tasks: [{ id: 't-1', title: 'Newer remote', completed: false, lastModified: 5000, syncMode: 'full-sync' } as any],
      spaces: [],
    });
    expect(useStore.getState().tasks[0].title).toBe('Newer remote');
  });
});
