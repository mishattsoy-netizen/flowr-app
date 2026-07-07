// src/lib/geometry/resolvePoints.ts
import type { EditorBlock } from '@/data/store';
import { resolveBindingEndpoint } from './binding';

/**
 * Full resolved path for an arrow/line block.
 * Standalone: block.points. Bound: [clippedStart, ...points, clippedEnd].
 * Each bound end is aimed at its adjacent path point: the nearest waypoint if one exists,
 * otherwise the CENTER of the opposite bound shape (not its perimeter target — a perimeter
 * point goes degenerate the moment the shapes overlap, flipping the arrow to far edges;
 * centers stay distinct and the clip degrades gracefully, matching Excalidraw's focus-0
 * behavior), otherwise the opposite free point.
 */
export function resolvePoints(block: EditorBlock, allBlocks: EditorBlock[]): [number, number][] {
  const mids: [number, number][] = block.points ?? [];
  const sB = block.startBinding, eB = block.endBinding;
  if (!sB && !eB) return mids;

  const sBlock = sB ? allBlocks.find(b => b.id === sB.blockId) : undefined;
  const eBlock = eB ? allBlocks.find(b => b.id === eB.blockId) : undefined;

  const centerOf = (b?: EditorBlock): [number, number] | undefined =>
    b ? [(b.x ?? 0) + (b.width ?? 280) / 2, (b.y ?? 0) + (b.height ?? 100) / 2] : undefined;

  const startAim = mids[0] ?? centerOf(eBlock) ?? mids[mids.length - 1];
  const endAim = mids[mids.length - 1] ?? centerOf(sBlock) ?? mids[0];

  const pts: [number, number][] = [];
  if (sB) {
    const p = startAim ? resolveBindingEndpoint(sB, startAim, allBlocks) : null;
    if (p) pts.push(p);
  }
  pts.push(...mids);
  if (eB) {
    const p = endAim ? resolveBindingEndpoint(eB, endAim, allBlocks) : null;
    if (p) pts.push(p);
  }
  return pts;
}
