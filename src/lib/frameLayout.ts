import type { EditorBlock } from '@/data/store.types';

// ─── Group bounds ────────────────────────────────────────────────────────────

/**
 * Compute the bounding box that encloses all member blocks.
 * Returns { x, y, width, height } of the combined rectangle.
 */
export function computeGroupBounds(
  members: EditorBlock[],
): { x: number; y: number; width: number; height: number } {
  if (members.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const m of members) {
    const mx = m.x ?? 0;
    const my = m.y ?? 0;
    const mw = m.width ?? 0;
    const mh = m.height ?? 0;
    if (mx < minX) minX = mx;
    if (my < minY) minY = my;
    if (mx + mw > maxX) maxX = mx + mw;
    if (my + mh > maxY) maxY = my + mh;
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

// ─── Group spacing ───────────────────────────────────────────────────────────

/**
 * If all adjacent members in a selection have equal spacing (within 1px
 * tolerance), return that gap value. Otherwise return `null`.
 *
 * Members are sorted by position along the dominant axis inferred from their
 * arrangement (horizontal if they share a similar y, vertical otherwise).
 */
export function computeGroupSpacing(members: EditorBlock[]): number | null {
  if (members.length < 2) return null;

  // Determine dominant axis
  const yValues = members.map((m) => m.y ?? 0);
  const ySpread = Math.max(...yValues) - Math.min(...yValues);
  // If they're mostly in a row (similar y), sort by x
  const horizontal = ySpread < 20;

  const sorted = [...members].sort((a, b) =>
    horizontal
      ? (a.x ?? 0) - (b.x ?? 0)
      : (a.y ?? 0) - (b.y ?? 0),
  );

  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = horizontal ? sorted[i - 1].x ?? 0 : sorted[i - 1].y ?? 0;
    const prevSize = horizontal ? sorted[i - 1].width ?? 0 : sorted[i - 1].height ?? 0;
    const curr = horizontal ? sorted[i].x ?? 0 : sorted[i].y ?? 0;
    gaps.push(curr - (prev + prevSize));
  }

  // Check if all gaps are equal within tolerance
  const first = gaps[0];
  return gaps.every((g) => Math.abs(g - first) < 1) ? first : null;
}
