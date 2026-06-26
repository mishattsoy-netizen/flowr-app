import { create } from 'zustand';

export interface DragStateOffset {
  dx: number;
  dy: number;
  startX?: number;
  startY?: number;
  resizeX?: number;
  resizeY?: number;
  resizeW?: number;
  resizeH?: number;
  rotation?: number;
  startPoints?: [number, number][];
}

interface DragState {
  offsets: Record<string, DragStateOffset>;
  setOffset: (id: string, offset: DragStateOffset) => void;
  deleteOffset: (id: string) => void;
}

export const useDragState = create<DragState>((set) => ({
  offsets: {},
  setOffset: (id, offset) => set((state) => ({ offsets: { ...state.offsets, [id]: offset } })),
  deleteOffset: (id) => set((state) => {
    const newOffsets = { ...state.offsets };
    delete newOffsets[id];
    return { offsets: newOffsets };
  }),
}));

// Export a legacy Map-like API for non-reactive writes (fast path)
export const activeDragOffsets = {
  get: (id: string) => useDragState.getState().offsets[id],
  set: (id: string, offset: DragStateOffset) => useDragState.getState().setOffset(id, offset),
  delete: (id: string) => useDragState.getState().deleteOffset(id),
  has: (id: string) => !!useDragState.getState().offsets[id],
};
