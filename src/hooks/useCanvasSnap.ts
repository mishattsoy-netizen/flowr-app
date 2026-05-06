import { useCallback } from 'react';
import type { EditorBlock } from '@/data/store';

const GRID = 20;
const SNAP_THRESHOLD = 8;

export function useCanvasSnap(snapEnabled: boolean, blocks: EditorBlock[]) {
  const snapToGrid = useCallback((x: number, y: number): { x: number; y: number } => {
    if (!snapEnabled) return { x, y };
    return {
      x: Math.round(x / GRID) * GRID,
      y: Math.round(y / GRID) * GRID,
    };
  }, [snapEnabled]);

  const snapWithObjects = useCallback((
    x: number, y: number, width: number, height: number, excludeId: string
  ): { x: number; y: number } => {
    if (!snapEnabled) return { x, y };

    let snappedX = Math.round(x / GRID) * GRID;
    let snappedY = Math.round(y / GRID) * GRID;

    for (const b of blocks) {
      if (b.id === excludeId || b.type === 'connection') continue;
      const bx = b.x ?? 0, by = b.y ?? 0, bw = b.width ?? 0, bh = b.height ?? 0;

      if (Math.abs(x - (bx + bw)) < SNAP_THRESHOLD) snappedX = bx + bw;
      if (Math.abs((x + width) - bx) < SNAP_THRESHOLD) snappedX = bx - width;
      if (Math.abs(x - bx) < SNAP_THRESHOLD) snappedX = bx;
      if (Math.abs(y - (by + bh)) < SNAP_THRESHOLD) snappedY = by + bh;
      if (Math.abs((y + height) - by) < SNAP_THRESHOLD) snappedY = by - height;
      if (Math.abs(y - by) < SNAP_THRESHOLD) snappedY = by;
    }

    return { x: snappedX, y: snappedY };
  }, [snapEnabled, blocks]);

  return { snapToGrid, snapWithObjects };
}
