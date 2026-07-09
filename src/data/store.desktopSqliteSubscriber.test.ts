import { describe, it, expect, vi, beforeEach } from 'vitest';

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
// This is the key difference from other store tests: isDesktop() must return true
// so the module-level `if (isDesktop()) { useStore.subscribe(...) }` block in
// store.ts actually registers the SQLite write-through subscribers under test.
vi.mock('@/lib/env', () => ({ isDesktop: () => true }));

describe('desktop SQLite write-through subscribers (Tasks 7-8)', () => {
  let flowrDB: { upsertEntity: ReturnType<typeof vi.fn>; upsertTask: ReturnType<typeof vi.fn>; upsertSpace: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.resetModules();
    flowrDB = {
      upsertEntity: vi.fn(),
      upsertTask: vi.fn(),
      upsertSpace: vi.fn(),
    };
    const localStorageStub = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    };
    (global as any).window = { flowrDB, localStorage: localStorageStub };
    (global as any).localStorage = localStorageStub;
  });

  it('writes a note entity through to SQLite when its lastModified changes', async () => {
    const { useStore } = await import('./store');

    // First setState (prev undefined -> present) itself counts as a lastModified
    // change per the subscriber's `!prev || prev.lastModified !== ...` condition,
    // so it also writes through. That's correct: a brand-new entity should be
    // persisted to SQLite immediately, not only on its second edit.
    useStore.setState({
      entities: [
        { id: 'e-local', title: 'Local note', type: 'note', parentId: null, lastModified: 1, syncMode: 'full-sync', pairedEntityId: null } as any,
      ],
    });
    expect(flowrDB.upsertEntity).toHaveBeenCalledTimes(1);
    flowrDB.upsertEntity.mockClear();

    useStore.setState({
      entities: [
        { id: 'e-local', title: 'Local note', type: 'note', parentId: null, lastModified: 2, syncMode: 'full-sync', pairedEntityId: null } as any,
      ],
    });

    expect(flowrDB.upsertEntity).toHaveBeenCalledTimes(1);
    expect(flowrDB.upsertEntity.mock.calls[0][0]).toMatchObject({ id: 'e-local', last_modified: 2 });
  });

  it('DOES write cloud-only entities to SQLite too (mirrors everything, so boot-time SQLite hydration is a complete snapshot)', async () => {
    const { useStore } = await import('./store');

    useStore.setState({
      entities: [
        { id: 'e-cloud', title: 'Cloud note', type: 'note', parentId: null, lastModified: 1, syncMode: 'cloud-only', pairedEntityId: null } as any,
      ],
    });
    flowrDB.upsertEntity.mockClear();

    useStore.setState({
      entities: [
        { id: 'e-cloud', title: 'Cloud note', type: 'note', parentId: null, lastModified: 2, syncMode: 'cloud-only', pairedEntityId: null } as any,
      ],
    });

    expect(flowrDB.upsertEntity).toHaveBeenCalledTimes(1);
    expect(flowrDB.upsertEntity.mock.calls[0][0]).toMatchObject({ id: 'e-cloud', sync_mode: 'cloud-only', last_modified: 2 });
  });

  it('writes a task through to SQLite when its lastModified changes', async () => {
    const { useStore } = await import('./store');

    useStore.setState({ tasks: [{ id: 't-1', title: 'Task', completed: false, lastModified: 1, syncMode: 'local-only' } as any] });
    flowrDB.upsertTask.mockClear();

    useStore.setState({ tasks: [{ id: 't-1', title: 'Task', completed: true, lastModified: 2, syncMode: 'local-only' } as any] });

    expect(flowrDB.upsertTask).toHaveBeenCalledTimes(1);
    expect(flowrDB.upsertTask.mock.calls[0][0]).toMatchObject({ id: 't-1', last_modified: 2 });
  });

  it('writes a space through to SQLite when its lastModified changes', async () => {
    const { useStore } = await import('./store');

    useStore.setState({ spaces: [{ id: 's-1', name: 'Personal', type: 'personal', ownerId: null, createdAt: 0, lastModified: 1, syncMode: 'local-only' } as any] });
    flowrDB.upsertSpace.mockClear();

    useStore.setState({ spaces: [{ id: 's-1', name: 'Personal', type: 'personal', ownerId: null, createdAt: 0, lastModified: 2, syncMode: 'local-only' } as any] });

    expect(flowrDB.upsertSpace).toHaveBeenCalledTimes(1);
    expect(flowrDB.upsertSpace.mock.calls[0][0]).toMatchObject({ id: 's-1', last_modified: 2 });
  });
});
