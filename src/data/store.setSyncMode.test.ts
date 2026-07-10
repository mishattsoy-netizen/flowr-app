import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/sync', () => ({
  upsertEntity: vi.fn().mockResolvedValue({ error: null }),
  upsertWorkspace: vi.fn().mockResolvedValue({ error: null }),
  upsertSpace: vi.fn().mockResolvedValue({ error: null }),
  deleteEntityFromDB: vi.fn().mockResolvedValue({ error: null }),
  upsertTask: vi.fn().mockResolvedValue({ error: null }),
  deleteTaskFromDB: vi.fn().mockResolvedValue({ error: null }),
  clearAllDataFromCloud: vi.fn().mockResolvedValue(undefined),
  markForPurge: vi.fn().mockResolvedValue({ error: null }),
  clearPurge: vi.fn().mockResolvedValue({ error: null }),
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

// The "workspace" a user sees in the sidebar (e.g. "Personal") is an Entity
// with type 'workspace'/'collection', whose id is what setSyncMode is called
// with (see SpacePage.tsx). Its descendants are found via parentId
// tree-walking (getSyncModeCascade -> getDescendantIds), the same mechanism
// deleteEntity already uses — NOT via the Entity.workspaceId field, which
// instead points at the account-level Workspace record (e.g. 'ws-personal')
// and is shared by every entity in that account regardless of which
// top-level workspace they're under.
describe('setSyncMode cascading to workspace-entity descendants and tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({
      spaces: [
        { id: 'ws-personal', name: 'Personal', type: 'personal', ownerId: null, createdAt: 0, lastModified: 0, syncMode: 'cloud-only' },
      ],
      entities: [
        { id: 'w1', title: 'Personal', type: 'workspace', parentId: null, lastModified: 0, workspaceId: 'ws-personal', syncMode: 'cloud-only' },
        { id: 'f1', title: 'Folder 1', type: 'folder', parentId: 'w1', lastModified: 0, workspaceId: 'ws-personal', syncMode: 'cloud-only' },
        { id: 'n1', title: 'Note 1', type: 'note', parentId: 'f1', lastModified: 0, workspaceId: 'ws-personal', syncMode: 'cloud-only' },
        { id: 'n2', title: 'Note 2 (sibling workspace)', type: 'note', parentId: 'w2', lastModified: 0, workspaceId: 'ws-personal', syncMode: 'cloud-only' },
        { id: 'w2', title: 'Other Workspace', type: 'workspace', parentId: null, lastModified: 0, workspaceId: 'ws-personal', syncMode: 'cloud-only' },
      ] as any,
      tasks: [
        { id: 't1', title: 'Task on n1', completed: false, lastModified: 0, entityId: 'n1', syncMode: 'cloud-only' },
        { id: 't2', title: 'Task on sibling', completed: false, lastModified: 0, entityId: 'n2', syncMode: 'cloud-only' },
        { id: 't3', title: 'Unassigned task', completed: false, lastModified: 0, entityId: null, syncMode: 'cloud-only' },
      ] as any,
      pendingModeWrites: [],
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

  it('cascades to tasks belonging to descendant entities, but not to tasks on sibling or unassigned', async () => {
    await useStore.getState().setSyncMode('w1', 'full-sync');

    const state = useStore.getState();
    expect(state.tasks.find(t => t.id === 't1')?.syncMode).toBe('full-sync');
    expect(state.tasks.find(t => t.id === 't2')?.syncMode).toBe('cloud-only');
    expect(state.tasks.find(t => t.id === 't3')?.syncMode).toBe('cloud-only');
  });

  it('switching to local-only calls markForPurge with the full cascade (entities + tasks), not saveEntity for a normal push', async () => {
    const { markForPurge } = await import('@/lib/sync');

    await useStore.getState().setSyncMode('w1', 'local-only');

    expect(markForPurge).toHaveBeenCalledWith(
      expect.objectContaining({
        entityIds: expect.arrayContaining(['w1', 'f1', 'n1']),
        taskIds: ['t1'],
      })
    );
    expect(useStore.getState().entities.find(e => e.id === 'n1')?.syncMode).toBe('local-only');
    expect(useStore.getState().tasks.find(t => t.id === 't1')?.syncMode).toBe('local-only');
  });

  it('switching back to a cloud mode calls clearPurge and resumes normal push (does not touch markForPurge)', async () => {
    const { markForPurge, clearPurge } = await import('@/lib/sync');

    await useStore.getState().setSyncMode('w1', 'local-only');
    vi.clearAllMocks();

    await useStore.getState().setSyncMode('w1', 'full-sync');

    expect(clearPurge).toHaveBeenCalledWith(
      expect.objectContaining({ entityIds: expect.arrayContaining(['w1']) }),
      'full-sync'
    );
    expect(markForPurge).not.toHaveBeenCalled();
    expect(useStore.getState().tasks.find(t => t.id === 't1')?.syncMode).toBe('full-sync');
  });

  it('leaves a single leaf entity id behaving as before (cascades to itself only, no children)', async () => {
    await useStore.getState().setSyncMode('n1', 'local-only');

    const state = useStore.getState();
    expect(state.entities.find(e => e.id === 'n1')?.syncMode).toBe('local-only');
    expect(state.entities.find(e => e.id === 'f1')?.syncMode).toBe('cloud-only');
  });

  it('queues a pending write when the cloud call fails, so it can be retried later', async () => {
    const { markForPurge } = await import('@/lib/sync');
    (markForPurge as any).mockResolvedValueOnce({ error: { message: 'offline' } });

    await useStore.getState().setSyncMode('w1', 'local-only');

    const pending = useStore.getState().pendingModeWrites;
    expect(pending).toHaveLength(1);
    expect(pending[0].action).toBe('purge');
    expect(pending[0].mode).toBe('local-only');
  });
});
