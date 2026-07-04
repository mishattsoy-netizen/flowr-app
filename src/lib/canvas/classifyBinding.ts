import type { ArrowBinding, EditorBlock } from '@/data/store.types';
import { blockOutlineKind, pointToFocus, BINDING_GAP } from '@/lib/geometry/binding';
import { isPointInsideShape, distanceToOutline, nearestPointOnOutline } from '@/lib/geometry/outline';

export const EDGE_BIND_THRESHOLD = 12;

const NON_BINDABLE_SHAPEKINDS = new Set(['arrow', 'line', 'freedraw']);

export function isBindable(block: EditorBlock): boolean {
  if (block.type === 'shape') return !NON_BINDABLE_SHAPEKINDS.has(block.shapeKind ?? '');
  return block.type === 'text' || block.type === 'image' || block.type === 'video' || block.type === 'frame';
}

function rectOf(b: EditorBlock) {
  return { x: b.x ?? 0, y: b.y ?? 0, width: b.width ?? 280, height: b.height ?? 100 };
}

/** Mode 2 (inside → fixedPoint) or mode 3 (near edge → focus); null if too far. */
export function classifyBindingAt(point: [number, number], block: EditorBlock): ArrowBinding | null {
  const rect = rectOf(block);
  const kind = blockOutlineKind(block);
  if (isPointInsideShape(kind, rect, point)) {
    return { blockId: block.id, fixedPoint: [point[0] - rect.x, point[1] - rect.y], gap: BINDING_GAP };
  }
  if (distanceToOutline(kind, rect, point) <= EDGE_BIND_THRESHOLD) {
    const onOutline = nearestPointOnOutline(kind, rect, point);
    return { blockId: block.id, focus: pointToFocus(onOutline[0], onOutline[1], rect), gap: BINDING_GAP };
  }
  return null;
}

/** Mode 1: side-center dot → focus at that side's midpoint. */
export function sideCenterBinding(block: EditorBlock, side: 'top' | 'right' | 'bottom' | 'left'): ArrowBinding {
  const rect = rectOf(block);
  const mid: Record<string, [number, number]> = {
    top: [rect.x + rect.width / 2, rect.y],
    right: [rect.x + rect.width, rect.y + rect.height / 2],
    bottom: [rect.x + rect.width / 2, rect.y + rect.height],
    left: [rect.x, rect.y + rect.height / 2],
  };
  const [mx, my] = mid[side];
  return { blockId: block.id, focus: pointToFocus(mx, my, rect), gap: BINDING_GAP };
}

/** Cursor proximity radius (canvas units) within which an individual side-center bind dot
 * lights up. Smaller than EDGE_BIND_THRESHOLD's outline-hugging test — this is a point-to-point
 * distance check against the dot's own screen position, not the whole shape's outline. */
export const DOT_HOVER_THRESHOLD = 18;

/** Which single side-center dot (if any) the cursor is close enough to, for per-dot proximity
 * highlighting — independent of whether the point is within the whole-shape bind zone. */
export function nearestBindDotSide(point: [number, number], block: EditorBlock): 'top' | 'right' | 'bottom' | 'left' | null {
  const rect = rectOf(block);
  const mids: Record<'top' | 'right' | 'bottom' | 'left', [number, number]> = {
    top: [rect.x + rect.width / 2, rect.y],
    right: [rect.x + rect.width, rect.y + rect.height / 2],
    bottom: [rect.x + rect.width / 2, rect.y + rect.height],
    left: [rect.x, rect.y + rect.height / 2],
  };
  let best: 'top' | 'right' | 'bottom' | 'left' | null = null;
  let bestDist = DOT_HOVER_THRESHOLD;
  for (const side of ['top', 'right', 'bottom', 'left'] as const) {
    const [mx, my] = mids[side];
    const d = Math.hypot(point[0] - mx, point[1] - my);
    if (d <= bestDist) { bestDist = d; best = side; }
  }
  return best;
}

/** Topmost bindable block whose bind zone (inside or ≤ threshold from outline) contains the point. */
export function findBindableBlockAt(point: [number, number], blocks: EditorBlock[]): EditorBlock | null {
  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i];
    if (!isBindable(b)) continue;
    const rect = rectOf(b);
    const kind = blockOutlineKind(b);
    if (isPointInsideShape(kind, rect, point) || distanceToOutline(kind, rect, point) <= EDGE_BIND_THRESHOLD) return b;
  }
  return null;
}
