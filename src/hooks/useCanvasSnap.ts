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

    let minDiffX = threshold;
    let minDiffY = threshold;

    // First pass: find the closest snap coordinate across all blocks
    for (const b of blocks) {
      if (b.id === excludeId || b.type === 'connection') continue;
      const bx = b.x ?? 0, by = b.y ?? 0, bw = b.width ?? 0, bh = b.height ?? 0;

      // X snapping
      if (Math.abs(x - (bx + bw)) < minDiffX) {
        minDiffX = Math.abs(x - (bx + bw));
        snappedX = bx + bw;
      }
      if (Math.abs((x + width) - bx) < minDiffX) {
        minDiffX = Math.abs((x + width) - bx);
        snappedX = bx - width;
      }
      if (Math.abs(x - bx) < minDiffX) {
        minDiffX = Math.abs(x - bx);
        snappedX = bx;
      }
      if (Math.abs((x + width) - (bx + bw)) < minDiffX) {
        minDiffX = Math.abs((x + width) - (bx + bw));
        snappedX = bx + bw - width;
      }
      if (Math.abs((x + width / 2) - (bx + bw / 2)) < minDiffX) {
        minDiffX = Math.abs((x + width / 2) - (bx + bw / 2));
        snappedX = bx + bw / 2 - width / 2;
      }

      // Y snapping
      if (Math.abs(y - (by + bh)) < minDiffY) {
        minDiffY = Math.abs(y - (by + bh));
        snappedY = by + bh;
      }
      if (Math.abs((y + height) - by) < minDiffY) {
        minDiffY = Math.abs((y + height) - by);
        snappedY = by - height;
      }
      if (Math.abs(y - by) < minDiffY) {
        minDiffY = Math.abs(y - by);
        snappedY = by;
      }
      if (Math.abs((y + height) - (by + bh)) < minDiffY) {
        minDiffY = Math.abs((y + height) - (by + bh));
        snappedY = by + bh - height;
      }
      if (Math.abs((y + height / 2) - (by + bh / 2)) < minDiffY) {
        minDiffY = Math.abs((y + height / 2) - (by + bh / 2));
        snappedY = by + bh / 2 - height / 2;
      }
    }

    // Second pass: draw all guide lines that align at the snapped positions (within 0.01 tolerance)
    if (minDiffX < threshold) {
      for (const b of blocks) {
        if (b.id === excludeId || b.type === 'connection') continue;
        const bx = b.x ?? 0, by = b.y ?? 0, bw = b.width ?? 0, bh = b.height ?? 0;

        if (Math.abs(snappedX - (bx + bw)) < 0.01) {
          guides.push({ type: 'v', coord: bx + bw, start: Math.min(y, by), end: Math.max(y + height, by + bh) });
        }
        if (Math.abs((snappedX + width) - bx) < 0.01) {
          guides.push({ type: 'v', coord: bx, start: Math.min(y, by), end: Math.max(y + height, by + bh) });
        }
        if (Math.abs(snappedX - bx) < 0.01) {
          guides.push({ type: 'v', coord: bx, start: Math.min(y, by), end: Math.max(y + height, by + bh) });
        }
        if (Math.abs((snappedX + width) - (bx + bw)) < 0.01) {
          guides.push({ type: 'v', coord: bx + bw, start: Math.min(y, by), end: Math.max(y + height, by + bh) });
        }
        if (Math.abs((snappedX + width / 2) - (bx + bw / 2)) < 0.01) {
          guides.push({ type: 'v', coord: bx + bw / 2, start: Math.min(y, by), end: Math.max(y + height, by + bh) });
        }
      }
    }

    if (minDiffY < threshold) {
      for (const b of blocks) {
        if (b.id === excludeId || b.type === 'connection') continue;
        const bx = b.x ?? 0, by = b.y ?? 0, bw = b.width ?? 0, bh = b.height ?? 0;

        if (Math.abs(snappedY - (by + bh)) < 0.01) {
          guides.push({ type: 'h', coord: by + bh, start: Math.min(x, bx), end: Math.max(x + width, bx + bw) });
        }
        if (Math.abs((snappedY + height) - by) < 0.01) {
          guides.push({ type: 'h', coord: by, start: Math.min(x, bx), end: Math.max(x + width, bx + bw) });
        }
        if (Math.abs(snappedY - by) < 0.01) {
          guides.push({ type: 'h', coord: by, start: Math.min(x, bx), end: Math.max(x + width, bx + bw) });
        }
        if (Math.abs((snappedY + height) - (by + bh)) < 0.01) {
          guides.push({ type: 'h', coord: by + bh, start: Math.min(x, bx), end: Math.max(x + width, bx + bw) });
        }
        if (Math.abs((snappedY + height / 2) - (by + bh / 2)) < 0.01) {
          guides.push({ type: 'h', coord: by + bh / 2, start: Math.min(x, bx), end: Math.max(x + width, bx + bw) });
        }
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

    let minDiffX = threshold;
    let minDiffY = threshold;
    let guideX: number | null = null;
    let guideY: number | null = null;
    let guideXBlock: EditorBlock | null = null;
    let guideYBlock: EditorBlock | null = null;

    for (const b of blocks) {
      if (b.id === excludeId || b.type === 'connection') continue;
      const bx = b.x ?? 0, by = b.y ?? 0, bw = b.width ?? 0, bh = b.height ?? 0;

      // Snapping horizontal edges (width changes)
      if (handle.includes('w')) {
        if (Math.abs(x - (bx + bw)) < minDiffX) {
          minDiffX = Math.abs(x - (bx + bw));
          snappedX = bx + bw;
          guideX = bx + bw;
          guideXBlock = b;
        }
        if (Math.abs(x - bx) < minDiffX) {
          minDiffX = Math.abs(x - bx);
          snappedX = bx;
          guideX = bx;
          guideXBlock = b;
        }
        if (Math.abs(x - (bx + bw / 2)) < minDiffX) {
          minDiffX = Math.abs(x - (bx + bw / 2));
          snappedX = bx + bw / 2;
          guideX = bx + bw / 2;
          guideXBlock = b;
        }
      } else if (handle.includes('e') || handle === 'e') {
        if (Math.abs(rightEdge - bx) < minDiffX) {
          minDiffX = Math.abs(rightEdge - bx);
          guideX = bx;
          guideXBlock = b;
        }
        if (Math.abs(rightEdge - (bx + bw)) < minDiffX) {
          minDiffX = Math.abs(rightEdge - (bx + bw));
          guideX = bx + bw;
          guideXBlock = b;
        }
        if (Math.abs(rightEdge - (bx + bw / 2)) < minDiffX) {
          minDiffX = Math.abs(rightEdge - (bx + bw / 2));
          guideX = bx + bw / 2;
          guideXBlock = b;
        }
      }

      // Snapping vertical edges (height changes)
      if (handle.includes('n') || handle === 'nw' || handle === 'ne') {
        if (Math.abs(y - (by + bh)) < minDiffY) {
          minDiffY = Math.abs(y - (by + bh));
          snappedY = by + bh;
          guideY = by + bh;
          guideYBlock = b;
        }
        if (Math.abs(y - by) < minDiffY) {
          minDiffY = Math.abs(y - by);
          snappedY = by;
          guideY = by;
          guideYBlock = b;
        }
        if (Math.abs(y - (by + bh / 2)) < minDiffY) {
          minDiffY = Math.abs(y - (by + bh / 2));
          snappedY = by + bh / 2;
          guideY = by + bh / 2;
          guideYBlock = b;
        }
      } else if (handle.includes('s') || handle === 'sw' || handle === 'se') {
        if (Math.abs(bottomEdge - by) < minDiffY) {
          minDiffY = Math.abs(bottomEdge - by);
          guideY = by;
          guideYBlock = b;
        }
        if (Math.abs(bottomEdge - (by + bh)) < minDiffY) {
          minDiffY = Math.abs(bottomEdge - (by + bh));
          guideY = by + bh;
          guideYBlock = b;
        }
        if (Math.abs(bottomEdge - (by + bh / 2)) < minDiffY) {
          minDiffY = Math.abs(bottomEdge - (by + bh / 2));
          guideY = by + bh / 2;
          guideYBlock = b;
        }
      }
    }

    if (guideX !== null) {
      if (handle.includes('w')) {
        snappedW = rightEdge - snappedX;
      } else {
        snappedW = guideX - x;
      }
    }
    if (guideY !== null) {
      if (handle.includes('n') || handle === 'nw' || handle === 'ne') {
        snappedH = bottomEdge - snappedY;
      } else {
        snappedH = guideY - y;
      }
    }

    // Draw all guide lines that align at the snapped positions (within 0.01 tolerance)
    if (minDiffX < threshold) {
      for (const b of blocks) {
        if (b.id === excludeId || b.type === 'connection') continue;
        const bx = b.x ?? 0, by = b.y ?? 0, bw = b.width ?? 0, bh = b.height ?? 0;

        if (Math.abs(snappedX - (bx + bw)) < 0.01) {
          guides.push({ type: 'v', coord: bx + bw, start: Math.min(snappedY, by), end: Math.max(snappedY + snappedH, by + bh) });
        }
        if (Math.abs((snappedX + snappedW) - bx) < 0.01) {
          guides.push({ type: 'v', coord: bx, start: Math.min(snappedY, by), end: Math.max(snappedY + snappedH, by + bh) });
        }
        if (Math.abs(snappedX - bx) < 0.01) {
          guides.push({ type: 'v', coord: bx, start: Math.min(snappedY, by), end: Math.max(snappedY + snappedH, by + bh) });
        }
        if (Math.abs((snappedX + snappedW) - (bx + bw)) < 0.01) {
          guides.push({ type: 'v', coord: bx + bw, start: Math.min(snappedY, by), end: Math.max(snappedY + snappedH, by + bh) });
        }
        if (Math.abs((snappedX + snappedW / 2) - (bx + bw / 2)) < 0.01) {
          guides.push({ type: 'v', coord: bx + bw / 2, start: Math.min(snappedY, by), end: Math.max(snappedY + snappedH, by + bh) });
        }
      }
    }

    if (minDiffY < threshold) {
      for (const b of blocks) {
        if (b.id === excludeId || b.type === 'connection') continue;
        const bx = b.x ?? 0, by = b.y ?? 0, bw = b.width ?? 0, bh = b.height ?? 0;

        if (Math.abs(snappedY - (by + bh)) < 0.01) {
          guides.push({ type: 'h', coord: by + bh, start: Math.min(snappedX, bx), end: Math.max(snappedX + snappedW, bx + bw) });
        }
        if (Math.abs((snappedY + snappedH) - by) < 0.01) {
          guides.push({ type: 'h', coord: by, start: Math.min(snappedX, bx), end: Math.max(snappedX + snappedW, bx + bw) });
        }
        if (Math.abs(snappedY - by) < 0.01) {
          guides.push({ type: 'h', coord: by, start: Math.min(snappedX, bx), end: Math.max(snappedX + snappedW, bx + bw) });
        }
        if (Math.abs((snappedY + snappedH) - (by + bh)) < 0.01) {
          guides.push({ type: 'h', coord: by + bh, start: Math.min(snappedX, bx), end: Math.max(snappedX + snappedW, bx + bw) });
        }
        if (Math.abs((snappedY + snappedH / 2) - (by + bh / 2)) < 0.01) {
          guides.push({ type: 'h', coord: by + bh / 2, start: Math.min(snappedX, bx), end: Math.max(snappedX + snappedW, bx + bw) });
        }
      }
    }

    return { x: snappedX, y: snappedY, width: snappedW, height: snappedH, guides };
  }, [snapEnabled, blocks, scale]);

  return { snapToGrid, snapWithObjects, snapForResize };
}
