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
vi.mock('@/lib/frameLayout', () => ({ computeAutoLayout: vi.fn() }));
vi.mock('@/lib/groupUtils', () => ({ generateGroupId: () => 'group-1' }));
vi.mock('@/lib/env', () => ({ isDesktop: () => false }));
vi.mock('@/lib/persistence', () => ({ saveEntity: vi.fn().mockResolvedValue(undefined) }));

import { useStore } from './store';

describe('moveEntity syncMode adoption across workspace roots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({
      workspaces: [
        { id: 'ws-personal', name: 'Personal', type: 'personal', ownerId: null, createdAt: 0, syncMode: 'cloud-only' },
      ],
      entities: [
        { id: 'w1', title: 'Cloud Workspace', type: 'workspace', parentId: null, lastModified: 0, workspaceId: 'ws-personal', syncMode: 'cloud-only' },
        { id: 'w2', title: 'Local Workspace', type: 'workspace', parentId: null, lastModified: 0, workspaceId: 'ws-personal', syncMode: 'local-only' },
        { id: 'f1', title: 'Folder under w2', type: 'folder', parentId: 'w2', lastModified: 0, workspaceId: 'ws-personal', syncMode: 'local-only' },
        { id: 'n1', title: 'Note', type: 'note', parentId: 'w1', lastModified: 0, workspaceId: 'ws-personal', syncMode: 'cloud-only' },
      ] as any,
    });
  });

  it('adopts the destination workspace-root sync mode when moved under a different workspace root', () => {
    useStore.getState().moveEntity('n1', 'f1');
    const entity = useStore.getState().entities.find(e => e.id === 'n1');
    expect(entity?.syncMode).toBe('local-only');
  });

  it('keeps the existing syncMode when moved within the same workspace root', () => {
    useStore.getState().moveEntity('n1', 'w1');
    const entity = useStore.getState().entities.find(e => e.id === 'n1');
    expect(entity?.syncMode).toBe('cloud-only');
  });

  it('keeps the existing syncMode when moved to a null parent (top-level) and was already at top-level under no workspace root', () => {
    useStore.getState().moveEntity('w1', null);
    const entity = useStore.getState().entities.find(e => e.id === 'w1');
    expect(entity?.syncMode).toBe('cloud-only');
  });
});
