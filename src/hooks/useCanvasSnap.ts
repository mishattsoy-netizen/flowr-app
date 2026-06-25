import { useCallback } from 'react';
import type { EditorBlock } from '@/data/store';

const GRID = 20;
const SCREEN_SNAP_THRESHOLD = 5;

export function useCanvasSnap(snapEnabled: boolean, blocks: EditorBlock[], scale: number) {
  const snapToGrid = useCallback((x: number, y: number): { x: number; y: number } => {
    if (!snapEnabled) return { x, y };
    return {
      x: Math.round(x / GRID) * GRID,
      y: Math.round(y / GRID) * GRID,
    };
  }, [snapEnabled]);

  const snapWithObjects = useCallback((
    x: number, y: number, width: number, height: number, excludeId: string
  ): { x: number; y: number; guides: { type: 'h' | 'v'; coord: number; start: number; end: number }[] } => {
    if (!snapEnabled) return { x, y, guides: [] };

    let snappedX = x;
    let snappedY = y;
    const guides: { type: 'h' | 'v'; coord: number; start: number; end: number }[] = [];

    // Scale-aware visual threshold (constant screen distance)
    const threshold = SCREEN_SNAP_THRESHOLD / scale;

    // Snap to other objects
    for (const b of blocks) {
      if (b.id === excludeId || b.type === 'connection') continue;
      const bx = b.x ?? 0, by = b.y ?? 0, bw = b.width ?? 0, bh = b.height ?? 0;

      let guideX: number | null = null;
      let guideY: number | null = null;

      if (Math.abs(x - (bx + bw)) < threshold) {
        snappedX = bx + bw;
        guideX = bx + bw;
      } else if (Math.abs((x + width) - bx) < threshold) {
        snappedX = bx - width;
        guideX = bx;
      } else if (Math.abs(x - bx) < threshold) {
        snappedX = bx;
        guideX = bx;
      } else if (Math.abs((x + width) - (bx + bw)) < threshold) {
        snappedX = bx + bw - width;
        guideX = bx + bw;
      }

      if (Math.abs(y - (by + bh)) < threshold) {
        snappedY = by + bh;
        guideY = by + bh;
      } else if (Math.abs((y + height) - by) < threshold) {
        snappedY = by - height;
        guideY = by;
      } else if (Math.abs(y - by) < threshold) {
        snappedY = by;
        guideY = by;
      } else if (Math.abs((y + height) - (by + bh)) < threshold) {
        snappedY = by + bh - height;
        guideY = by + bh;
      }

      if (guideX !== null) {
        guides.push({
          type: 'v',
          coord: guideX,
          start: Math.min(y, by),
          end: Math.max(y + height, by + bh)
        });
      }
      if (guideY !== null) {
        guides.push({
          type: 'h',
          coord: guideY,
          start: Math.min(x, bx),
          end: Math.max(x + width, bx + bw)
        });
      }
    }

    return { x: snappedX, y: snappedY, guides };
  }, [snapEnabled, blocks, scale]);

  const snapForResize = useCallback((
    x: number, y: number, width: number, height: number, handle: string, excludeId: string
  ): { x: number; y: number; width: number; height: number; guides: { type: 'h' | 'v'; coord: number; start: number; end: number }[] } => {
    if (!snapEnabled) return { x, y, width, height, guides: [] };

    let snappedX = x;
    let snappedY = y;
    let snappedW = width;
    let snappedH = height;
    const guides: { type: 'h' | 'v'; coord: number; start: number; end: number }[] = [];

    const threshold = SCREEN_SNAP_THRESHOLD / scale;
    const rightEdge = x + width;
    const bottomEdge = y + height;

    for (const b of blocks) {
      if (b.id === excludeId || b.type === 'connection') continue;
      const bx = b.x ?? 0, by = b.y ?? 0, bw = b.width ?? 0, bh = b.height ?? 0;

      let guideX: number | null = null;
      let guideY: number | null = null;

      // Snapping horizontal edges (width changes)
      if (handle.includes('w')) {
        if (Math.abs(x - (bx + bw)) < threshold) {
          snappedX = bx + bw;
          guideX = bx + bw;
        } else if (Math.abs(x - bx) < threshold) {
          snappedX = bx;
          guideX = bx;
        }
        if (guideX !== null) {
          snappedW = rightEdge - snappedX;
        }
      } else if (handle.includes('e') || handle === 'e') {
        if (Math.abs(rightEdge - bx) < threshold) {
          guideX = bx;
        } else if (Math.abs(rightEdge - (bx + bw)) < threshold) {
          guideX = bx + bw;
        }
        if (guideX !== null) {
          snappedW = guideX - x;
        }
      }

      // Snapping vertical edges (height changes)
      if (handle.includes('n') || handle === 'nw' || handle === 'ne') {
        if (Math.abs(y - (by + bh)) < threshold) {
          snappedY = by + bh;
          guideY = by + bh;
        } else if (Math.abs(y - by) < threshold) {
          snappedY = by;
          guideY = by;
        }
        if (guideY !== null) {
          snappedH = bottomEdge - snappedY;
        }
      } else if (handle.includes('s') || handle === 'sw' || handle === 'se') {
        if (Math.abs(bottomEdge - by) < threshold) {
          guideY = by;
        } else if (Math.abs(bottomEdge - (by + bh)) < threshold) {
          guideY = by + bh;
        }
        if (guideY !== null) {
          snappedH = guideY - y;
        }
      }

      if (guideX !== null) {
        guides.push({
          type: 'v',
          coord: guideX,
          start: Math.min(y, by),
          end: Math.max(y + height, by + bh)
        });
      }
      if (guideY !== null) {
        guides.push({
          type: 'h',
          coord: guideY,
          start: Math.min(x, bx),
          end: Math.max(x + width, bx + bw)
        });
      }
    }

    return { x: snappedX, y: snappedY, width: snappedW, height: snappedH, guides };
  }, [snapEnabled, blocks, scale]);

  return { snapToGrid, snapWithObjects, snapForResize };
}
