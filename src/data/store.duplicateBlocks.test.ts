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
let groupIdCounter = 0;
vi.mock('@/lib/groupUtils', () => ({ generateGroupId: () => `new-group-${++groupIdCounter}` }));
vi.mock('@/lib/env', () => ({ isDesktop: () => false }));
vi.mock('@/lib/persistence', () => ({ saveEntity: vi.fn().mockResolvedValue(undefined) }));

import { useStore } from './store';
import type { EditorBlock } from './store.types';

const shapeA: EditorBlock = { id: 'S1', type: 'shape', shapeKind: 'rect', content: '', x: 0, y: 0, width: 100, height: 50, canvasId: 'c1', groupId: 'g1' } as EditorBlock;
const shapeB: EditorBlock = { id: 'S2', type: 'shape', shapeKind: 'rect', content: '', x: 200, y: 0, width: 100, height: 50, canvasId: 'c1', groupId: 'g1' } as EditorBlock;
const boundArrow: EditorBlock = {
  id: 'A1', type: 'shape', shapeKind: 'arrow', content: '', canvasId: 'c1',
  x: 0, y: 0, width: 0, height: 0, points: [[100, 25], [200, 25]],
  startBinding: { blockId: 'S1', focus: 0.5, gap: 4 },
  endBinding: { blockId: 'S2', focus: 0.5, gap: 4 },
} as EditorBlock;
const label: EditorBlock = { id: 'L1', type: 'text', content: 'hi', canvasId: 'c1', containerId: 'S1' } as EditorBlock;
const outsideShape: EditorBlock = { id: 'S3', type: 'shape', shapeKind: 'rect', content: '', x: 400, y: 0, width: 100, height: 50, canvasId: 'c1' } as EditorBlock;
const frame: EditorBlock = { id: 'F1', type: 'frame', content: '', canvasId: 'c1', x: -10, y: -10, width: 400, height: 200 } as EditorBlock;
const arrowToOutside: EditorBlock = {
  id: 'A2', type: 'shape', shapeKind: 'arrow', content: '', canvasId: 'c1',
  x: 0, y: 0, width: 0, height: 0, points: [[100, 25], [400, 25]],
  startBinding: { blockId: 'S1', focus: 0.5, gap: 4 },
  endBinding: { blockId: 'S3', focus: 0.5, gap: 4 },
} as EditorBlock;

describe('duplicateBlocks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    groupIdCounter = 0;
    useStore.setState({ blocks: [shapeA, shapeB, boundArrow, label, outsideShape, frame, arrowToOutside] } as any);
  });

  it('remaps bindings between two copied bound shapes + arrow to point at the NEW ids', () => {
    const newIds = useStore.getState().duplicateBlocks(['S1', 'S2', 'A1']);
    expect(newIds.length).toBe(3);

    const all = useStore.getState().blocks;
    const cloneArrow = all.find(b => newIds.includes(b.id) && b.shapeKind === 'arrow')!;
    const cloneS1 = newIds.find(id => id !== cloneArrow.id && all.find(b => b.id === id)!.x === 0)!;
    const cloneS2 = newIds.find(id => id !== cloneArrow.id && id !== cloneS1)!;

    expect(cloneArrow.startBinding?.blockId).toBe(cloneS1);
    expect(cloneArrow.endBinding?.blockId).toBe(cloneS2);
    // Must NOT still point at the originals.
    expect(cloneArrow.startBinding?.blockId).not.toBe('S1');
    expect(cloneArrow.endBinding?.blockId).not.toBe('S2');

    // Originals are untouched.
    const origArrow = all.find(b => b.id === 'A1')!;
    expect(origArrow.startBinding?.blockId).toBe('S1');
    expect(origArrow.endBinding?.blockId).toBe('S2');
  });

  it('clones the bound label and remaps its containerId to the new shape id', () => {
    const newIds = useStore.getState().duplicateBlocks(['S1']);
    const cloneId = newIds[0];
    const all = useStore.getState().blocks;
    const cloneLabel = all.find(b => b.type === 'text' && b.containerId === cloneId);
    expect(cloneLabel).toBeDefined();
    expect(cloneLabel!.id).not.toBe('L1');
  });

  it('drops bindings whose target is outside the copied set', () => {
    const newIds = useStore.getState().duplicateBlocks(['S1', 'A2']);
    const all = useStore.getState().blocks;
    const cloneArrow = all.find(b => newIds.includes(b.id) && b.shapeKind === 'arrow')!;
    // S1 was copied (its clone id is in newIds), so startBinding remaps.
    const cloneS1 = newIds.find(id => id !== cloneArrow.id)!;
    expect(cloneArrow.startBinding?.blockId).toBe(cloneS1);
    // S3 was NOT copied, so endBinding must be dropped rather than pointing at the original S3.
    expect(cloneArrow.endBinding).toBeUndefined();
  });

  it('assigns copied group members a shared NEW groupId, distinct from the original', () => {
    const newIds = useStore.getState().duplicateBlocks(['S1', 'S2']);
    const all = useStore.getState().blocks;
    const clones = all.filter(b => newIds.includes(b.id));
    expect(clones[0].groupId).toBeDefined();
    expect(clones[0].groupId).not.toBe('g1');
    expect(clones[0].groupId).toBe(clones[1].groupId);
  });

  it('remaps parentId (frame membership) only when the parent frame is also copied', () => {
    useStore.setState({
      blocks: [frame, { ...shapeA, parentId: 'F1' }],
    } as any);
    const newIds = useStore.getState().duplicateBlocks(['F1', 'S1']);
    const all = useStore.getState().blocks;
    const cloneFrameId = newIds.find(id => all.find(b => b.id === id)!.type === 'frame')!;
    const cloneShapeId = newIds.find(id => id !== cloneFrameId)!;
    const cloneShape = all.find(b => b.id === cloneShapeId)!;
    expect(cloneShape.parentId).toBe(cloneFrameId);
  });

  it('applies the given offset to x/y and points', () => {
    const newIds = useStore.getState().duplicateBlocks(['S1'], { dx: 20, dy: 30 });
    const clone = useStore.getState().blocks.find(b => b.id === newIds[0])!;
    expect(clone.x).toBe(20);
    expect(clone.y).toBe(30);
  });

  it('defaults to zero offset (used by Alt+drag duplicate-in-place)', () => {
    const newIds = useStore.getState().duplicateBlocks(['S1']);
    const clone = useStore.getState().blocks.find(b => b.id === newIds[0])!;
    expect(clone.x).toBe(0);
    expect(clone.y).toBe(0);
  });
});
