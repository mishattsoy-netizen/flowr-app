import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/sync', () => ({
  upsertEntity: vi.fn().mockResolvedValue({ error: null }),
  upsertTask: vi.fn().mockResolvedValue({ error: null }),
  upsertSpace: vi.fn().mockResolvedValue({ error: null }),
  deleteEntityFromDB: vi.fn().mockResolvedValue({ error: null }),
  deleteTaskFromDB: vi.fn().mockResolvedValue({ error: null }),
  clearAllDataFromCloud: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/supabase', () => ({ supabase: null, isSupabaseEnabled: false }));
vi.mock('@/lib/chat', () => ({
  fetchConversations: vi.fn(), createConversation: vi.fn(), updateConversationTitle: vi.fn(),
  deleteConversation: vi.fn(), fetchMessages: vi.fn(), insertMessage: vi.fn(),
}));
vi.mock('@/lib/canvasSync', () => ({ upsertCanvasBlock: vi.fn(), deleteCanvasBlock: vi.fn() }));
vi.mock('@/lib/groupUtils', () => ({ generateGroupId: () => 'group-1' }));
vi.mock('@/lib/env', () => ({ isDesktop: () => false }));
vi.mock('@/lib/persistence', () => ({ saveEntity: vi.fn().mockResolvedValue(undefined) }));

import { useStore } from './store';
import { upsertEntity } from '@/lib/sync';

describe('debounced Supabase push, wired through real store mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    useStore.setState({
      entities: [{
        id: 'e-1', title: 'Note', type: 'note', parentId: null,
        lastModified: 0, syncMode: 'full-sync', pairedEntityId: null,
      } as any],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('collapses rapid updateEntityContent calls on the same entity into a single push', () => {
    const { updateEntityContent } = useStore.getState();

    updateEntityContent('e-1', [{ id: 'b1', type: 'text', content: 'a' } as any]);
    updateEntityContent('e-1', [{ id: 'b1', type: 'text', content: 'ab' } as any]);
    updateEntityContent('e-1', [{ id: 'b1', type: 'text', content: 'abc' } as any]);

    expect(upsertEntity).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1500);

    expect(upsertEntity).toHaveBeenCalledTimes(1);
    const pushedEntity = (upsertEntity as any).mock.calls[0][0];
    expect(pushedEntity.content).toEqual([{ id: 'b1', type: 'text', content: 'abc' }]);
  });

  it('does not push at all when setEntities (the pull/merge path) is used instead of a mutation action', () => {
    useStore.getState().setEntities([
      { id: 'e-2', title: 'Pulled from cloud', type: 'note', parentId: null, lastModified: 999, syncMode: 'full-sync', pairedEntityId: null } as any,
    ]);

    vi.advanceTimersByTime(5000);

    expect(upsertEntity).not.toHaveBeenCalled();
  });
});
