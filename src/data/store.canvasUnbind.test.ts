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
import type { EditorBlock } from './store.types';

const rect: EditorBlock = { id: 'S1', type: 'shape', shapeKind: 'rect', content: '', x: 100, y: 100, width: 200, height: 100, canvasId: 'c1' } as EditorBlock;
const arrow: EditorBlock = {
  id: 'A1', type: 'shape', shapeKind: 'arrow', content: '', canvasId: 'c1',
  x: 0, y: 0, width: 0, height: 0, points: [[0, 150]],
  endBinding: { blockId: 'S1', focus: 0.5, gap: 4 },
} as EditorBlock;

describe('deleteCanvasBlock unbinds dependent arrows in place', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({ blocks: [rect, arrow] } as any);
  });
  it('removes the binding and freezes the endpoint as a free waypoint', () => {
    useStore.getState().deleteCanvasBlock('S1');
    const a = useStore.getState().blocks.find(b => b.id === 'A1')!;
    expect(a.endBinding).toBeUndefined();
    expect(a.points!.length).toBe(2); // original waypoint + frozen endpoint
    const frozen = a.points![1];
    expect(frozen[0]).toBeGreaterThan(0); // a real resolved coordinate, not [0,0]
  });
});
