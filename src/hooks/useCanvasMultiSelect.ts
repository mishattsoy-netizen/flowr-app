import { useState, useCallback, useRef } from 'react';
import type { EditorBlock } from '@/data/store';

export interface SelectionRect {
  x: number; y: number; width: number; height: number;
}

export function useCanvasMultiSelect(blocks: EditorBlock[]) {
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
  const selectedIdsRef = useRef<Set<string>>(new Set());
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const getLatestSelectedIds = useCallback(() => selectedIdsRef.current, []);

  const startSelection = useCallback((canvasX: number, canvasY: number) => {
    startRef.current = { x: canvasX, y: canvasY };
    setSelectionRect({ x: canvasX, y: canvasY, width: 0, height: 0 });
    selectedIdsRef.current = new Set();
  }, []);

  const updateSelection = useCallback((canvasX: number, canvasY: number) => {
    if (!startRef.current) return;
    const sx = startRef.current.x, sy = startRef.current.y;
    const rect: SelectionRect = {
      x: Math.min(sx, canvasX),
      y: Math.min(sy, canvasY),
      width: Math.abs(canvasX - sx),
      height: Math.abs(canvasY - sy),
    };
    setSelectionRect(rect);

    const intersecting = new Set<string>();
    for (const b of blocks) {
      let bx = b.x ?? 0, by = b.y ?? 0, bw = b.width ?? 100, bh = b.height ?? 40;

      const pointArray = b.points;
      if (pointArray && Array.isArray(pointArray) && pointArray.length > 0) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const p of pointArray) {
          minX = Math.min(minX, p[0]);
          maxX = Math.max(maxX, p[0]);
          minY = Math.min(minY, p[1]);
          maxY = Math.max(maxY, p[1]);
        }
        bx = minX;
        by = minY;
        bw = Math.max(maxX - minX, 1);
        bh = Math.max(maxY - minY, 1);
      }

      if (
        bx < rect.x + rect.width &&
        bx + bw > rect.x &&
        by < rect.y + rect.height &&
        by + bh > rect.y
      ) {
        intersecting.add(b.id);
      }
    }
    selectedIdsRef.current = intersecting;
  }, [blocks]);

  const endSelection = useCallback(() => {
    startRef.current = null;
    setSelectionRect(null);
  }, []);

  const clearSelection = useCallback(() => {
    const empty = new Set<string>();
    selectedIdsRef.current = empty;
    setSelectionRect(null);
  }, []);

  return { selectionRect, getLatestSelectedIds, startSelection, updateSelection, endSelection, clearSelection };
}
