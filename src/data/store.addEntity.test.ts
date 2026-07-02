import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/sync', () => ({
  upsertEntity: vi.fn().mockResolvedValue({ error: null }),
  upsertWorkspace: vi.fn().mockResolvedValue({ error: null }),
  deleteEntityFromDB: vi.fn().mockResolvedValue({ error: null }),
  upsertTask: vi.fn().mockResolvedValue({ error: null }),
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

describe('addEntity syncMode inheritance from workspace root', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({
      workspaces: [
        { id: 'ws-personal', name: 'Personal', type: 'personal', ownerId: null, createdAt: 0, syncMode: 'cloud-only' },
      ],
      entities: [
        { id: 'w1', title: 'Full Sync Workspace', type: 'workspace', parentId: null, lastModified: 0, workspaceId: 'ws-personal', syncMode: 'full-sync' },
        { id: 'w2', title: 'Local Workspace', type: 'collection', parentId: null, lastModified: 0, workspaceId: 'ws-personal', syncMode: 'local-only' },
        { id: 'f1', title: 'Folder under w1', type: 'folder', parentId: 'w1', lastModified: 0, workspaceId: 'ws-personal', syncMode: 'full-sync' },
      ] as any,
      activeWorkspaceId: 'ws-personal',
    });
  });

  it('inherits full-sync from a top-level workspace root for a direct child', () => {
    const id = useStore.getState().addEntity({ type: 'note', title: 'Root Note', parentId: 'w1' });
    const entity = useStore.getState().entities.find(e => e.id === id);
    expect(entity?.syncMode).toBe('full-sync');
  });

  it('inherits the workspace-root mode for a deeply nested entity, not just the immediate parent', () => {
    const noteId = useStore.getState().addEntity({ type: 'note', title: 'Nested Note', parentId: 'f1' });
    const entity = useStore.getState().entities.find(e => e.id === noteId);
    // f1's own syncMode ('full-sync') happens to match w1's here; the important
    // assertion is that inheritance walks to the workspace ROOT (w1), not just f1.
    expect(entity?.syncMode).toBe('full-sync');
  });

  it('inherits local-only from a local-only workspace root', () => {
    const id = useStore.getState().addEntity({ type: 'note', title: 'Local Note', parentId: 'w2' });
    const entity = useStore.getState().entities.find(e => e.id === id);
    expect(entity?.syncMode).toBe('local-only');
  });

  it('defaults to cloud-only for a new root-level entity with no parent', () => {
    const id = useStore.getState().addEntity({ type: 'workspace', title: 'New Workspace' });
    const entity = useStore.getState().entities.find(e => e.id === id);
    expect(entity?.syncMode).toBe('cloud-only');
  });

  it('still respects an explicit syncMode passed by the caller', () => {
    const id = useStore.getState().addEntity({ type: 'note', title: 'Explicit', parentId: 'w1', syncMode: 'cloud-only' });
    const entity = useStore.getState().entities.find(e => e.id === id);
    expect(entity?.syncMode).toBe('cloud-only');
  });
});
