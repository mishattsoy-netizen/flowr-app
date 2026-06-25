// src/lib/geometry/resolvePoints.ts
import type { EditorBlock } from '@/data/store';
import { resolveBindingPosition } from './binding';

function legacyEndpoint(blockId: string | undefined, side: string | undefined, allBlocks: EditorBlock[]): [number, number] | null {
  if (!blockId) return null;
  const b = allBlocks.find(x => x.id === blockId);
  if (!b) return null;
  const x = b.x ?? 0, y = b.y ?? 0;
  const w = b.width ?? 280, h = b.height ?? 100;
  switch (side) {
    case 'top': return [x + w / 2, y];
    case 'right': return [x + w, y + h / 2];
    case 'bottom': return [x + w / 2, y + h];
    case 'left': return [x, y + h / 2];
    default: return [x + w / 2, y + h / 2];
  }
}

/**
 * Compute the full resolved path for an arrow block.
 * For standalone arrows (no bindings): returns block.points directly.
 * For bound arrows: returns [resolvedStart, ...block.points, resolvedEnd].
 */
export function resolvePoints(block: EditorBlock, allBlocks: EditorBlock[]): [number, number][] {
  let start: [number, number] | null = resolveBindingPosition(block.startBinding, allBlocks);
  let end: [number, number] | null = resolveBindingPosition(block.endBinding, allBlocks);

  if (!start && block.fromId) start = legacyEndpoint(block.fromId, block.fromSide, allBlocks);
  if (!end && block.toId) end = legacyEndpoint(block.toId, block.toSide, allBlocks);

  const mids: [number, number][] = block.points ?? [];

  if (!start && !end) return mids;

  const pts: [number, number][] = [];
  if (start) pts.push(start);
  pts.push(...mids);
  if (end) pts.push(end);
  return pts;
}
