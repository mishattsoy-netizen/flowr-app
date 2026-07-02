import { useCallback, useState } from 'react';
import { useStore, type EditorBlock } from '@/data/store';
import { blockOutlineKind } from '@/lib/geometry/binding';
import { isPointInsideShape, distanceToOutline } from '@/lib/geometry/outline';
import { resolvePoints } from '@/lib/geometry/resolvePoints';

function distToPolyline(p: [number, number], pts: [number, number][]): number {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const abx = bx - ax, aby = by - ay;
    const len2 = abx * abx + aby * aby;
    const t = len2 < 1e-12 ? 0 : Math.max(0, Math.min(1, ((p[0] - ax) * abx + (p[1] - ay) * aby) / len2));
    best = Math.min(best, Math.hypot(ax + t * abx - p[0], ay + t * aby - p[1]));
  }
  return best;
}

export function hitTestBlock(p: [number, number], block: EditorBlock, allBlocks: EditorBlock[], tolerance: number): boolean {
  const isLinear = block.type === 'shape' && ['arrow', 'line', 'freedraw'].includes(block.shapeKind ?? '');
  if (isLinear) {
    const pts = resolvePoints(block, allBlocks);
    return pts.length >= 2 && distToPolyline(p, pts) <= tolerance;
  }
  const rect = { x: block.x ?? 0, y: block.y ?? 0, width: block.width ?? 0, height: block.height ?? 0 };
  const kind = blockOutlineKind(block);
  const hasFill = block.type !== 'shape' ||
    (!!block.canvasStyleExt?.fill && block.canvasStyleExt.fill !== 'transparent' && (block.canvasStyleExt.fillOpacity ?? 1) > 0);
  if (hasFill && isPointInsideShape(kind, rect, p)) return true;
  return distanceToOutline(kind, rect, p) <= tolerance;
}

export function useEraser({ canvasId, onCommit }: { canvasId: string; onCommit: () => void }) {
  const [markedIds, setMarkedIds] = useState<Set<string>>(new Set());

  const handleEraserDown = useCallback((toCanvas: (ev: PointerEvent) => [number, number], firstEvent: PointerEvent) => {
    const marked = new Set<string>();
    const mark = (ev: PointerEvent) => {
      const p = toCanvas(ev);
      const blocks = useStore.getState().blocks.filter(b => b.canvasId === canvasId && !b.canvasStyleExt?.locked);
      for (const b of blocks) {
        if (!marked.has(b.id) && hitTestBlock(p, b, blocks, 8)) {
          marked.add(b.id); // labels erase individually; container→label deletion is handled by the store cascade
        }
      }
      setMarkedIds(new Set(marked));
    };
    const up = () => {
      cleanup();
      if (marked.size > 0) {
        const del = useStore.getState().deleteCanvasBlock;
        marked.forEach(id => del(id));
        onCommit(); // single history push for the whole gesture
      }
      setMarkedIds(new Set());
    };
    const cancel = (e: KeyboardEvent) => { if (e.key === 'Escape') { marked.clear(); setMarkedIds(new Set()); cleanup(); } };
    const cleanup = () => {
      document.removeEventListener('pointermove', mark);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('keydown', cancel);
    };
    document.addEventListener('pointermove', mark);
    document.addEventListener('pointerup', up);
    document.addEventListener('keydown', cancel);
    mark(firstEvent);
  }, [canvasId, onCommit]);

  return { markedIds, handleEraserDown };
}
