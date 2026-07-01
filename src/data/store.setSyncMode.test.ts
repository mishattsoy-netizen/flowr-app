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

// The "workspace" a user sees in the sidebar (e.g. "Personal") is an Entity
// with type 'workspace'/'collection', whose id is what setSyncMode is called
// with (see WorkspacePage.tsx). Its descendants are found via parentId
// tree-walking (getDescendantIds), the same mechanism deleteEntity already
// uses — NOT via the Entity.workspaceId field, which instead points at the
// account-level Workspace record (e.g. 'ws-personal') and is shared by every
// entity in that account regardless of which top-level workspace they're under.
describe('setSyncMode cascading to workspace-entity descendants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({
      workspaces: [
        { id: 'ws-personal', name: 'Personal', type: 'personal', ownerId: null, createdAt: 0, syncMode: 'cloud-only' },
      ],
      entities: [
        { id: 'w1', title: 'Personal', type: 'workspace', parentId: null, lastModified: 0, workspaceId: 'ws-personal', syncMode: 'cloud-only' },
        { id: 'f1', title: 'Folder 1', type: 'folder', parentId: 'w1', lastModified: 0, workspaceId: 'ws-personal', syncMode: 'cloud-only' },
        { id: 'n1', title: 'Note 1', type: 'note', parentId: 'f1', lastModified: 0, workspaceId: 'ws-personal', syncMode: 'cloud-only' },
        { id: 'n2', title: 'Note 2 (sibling workspace)', type: 'note', parentId: 'w2', lastModified: 0, workspaceId: 'ws-personal', syncMode: 'cloud-only' },
        { id: 'w2', title: 'Other Workspace', type: 'workspace', parentId: null, lastModified: 0, workspaceId: 'ws-personal', syncMode: 'cloud-only' },
      ] as any,
    });
  });

  it('updates the target entity and every descendant found via parentId, but not entities under a sibling workspace entity', async () => {
    await useStore.getState().setSyncMode('w1', 'full-sync');

    const state = useStore.getState();
    expect(state.entities.find(e => e.id === 'w1')?.syncMode).toBe('full-sync');
    expect(state.entities.find(e => e.id === 'f1')?.syncMode).toBe('full-sync');
    expect(state.entities.find(e => e.id === 'n1')?.syncMode).toBe('full-sync');
    expect(state.entities.find(e => e.id === 'n2')?.syncMode).toBe('cloud-only');
    expect(state.entities.find(e => e.id === 'w2')?.syncMode).toBe('cloud-only');
  });

  it('persists every cascaded entity via saveEntity, including the target itself', async () => {
    const { saveEntity } = await import('@/lib/persistence');

    await useStore.getState().setSyncMode('w1', 'local-only');

    const savedIds = (saveEntity as any).mock.calls.map((call: any[]) => call[0].id);
    expect(savedIds.sort()).toEqual(['f1', 'n1', 'w1']);
  });

  it('leaves a single leaf entity id behaving as before (cascades to itself only, no children)', async () => {
    await useStore.getState().setSyncMode('n1', 'local-only');

    const state = useStore.getState();
    expect(state.entities.find(e => e.id === 'n1')?.syncMode).toBe('local-only');
    expect(state.entities.find(e => e.id === 'f1')?.syncMode).toBe('cloud-only');
  });
});
