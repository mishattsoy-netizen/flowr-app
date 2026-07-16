// Proves the boot-order bug behind "Kanban columns disappear for a split second".
//
// setEntities has a side effect: it reassigns activeSpaceId if the current one
// isn't found in state.spaces. On boot, SupabaseProvider called
// setEntities -> setTasks -> setSpaces, so setEntities ran against the STALE
// spaces array. When the user's real space wasn't in that stale array,
// activeSpaceId got clobbered, TrackerPage's `t.spaceId === activeSpaceId`
// filter matched nothing, and the Kanban columns went empty until the correct
// value was restored a moment later.
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/sync', () => ({
  loadFromSupabase: vi.fn(),
  loadDeltaFromSupabase: vi.fn(),
  subscribeRealtime: vi.fn(),
  upsertSpace: vi.fn(),
}));
vi.mock('@/lib/supabase', () => ({ isSupabaseEnabled: false, supabase: null }));

import { useStore } from '@/data/store';

const SPACE_REAL = 'ws-real-space';

const makeSpace = (id: string) => ({
  id,
  name: id,
  type: 'personal' as const,
  ownerId: null,
  createdAt: 1,
  lastModified: 1,
  syncMode: 'full-sync' as const,
});

const makeEntity = (id: string) => ({
  id,
  title: id,
  type: 'note' as const,
  parentId: null,
  lastModified: 1,
  syncMode: 'full-sync' as const,
  pairedEntityId: null,
}) as any;

describe('setEntities must not clobber activeSpaceId when spaces are applied first', () => {
  beforeEach(() => {
    // Simulate the pre-boot state: the user's real space is the active one,
    // but the spaces array has not yet been populated from the sync payload.
    useStore.setState({
      entities: [],
      tasks: [],
      spaces: [],
      activeSpaceId: SPACE_REAL,
    });
  });

  it('keeps the user activeSpaceId when setSpaces runs BEFORE setEntities (the fix)', () => {
    const s = useStore.getState();
    // Correct order: spaces first, so setEntities sees the real space exists.
    s.setSpaces([makeSpace(SPACE_REAL)]);
    s.setEntities([makeEntity('e-1')]);

    expect(useStore.getState().activeSpaceId).toBe(SPACE_REAL);
  });

  it('demonstrates the bug: setEntities BEFORE setSpaces clobbers activeSpaceId', () => {
    const s = useStore.getState();
    // Buggy order: entities first, while spaces is still empty.
    s.setEntities([makeEntity('e-1')]);

    // activeSpaceId got reassigned away from the user's real space, because
    // setEntities checked it against an empty spaces array.
    expect(useStore.getState().activeSpaceId).not.toBe(SPACE_REAL);
  });
});
