// src/lib/geometry/resolvePoints.ts
import type { EditorBlock } from '@/data/store';
import { resolveBindingPosition } from './binding';

/**
 * Compute the full resolved path for an arrow block.
 * For standalone arrows (no bindings): returns block.points directly.
 * For bound arrows: returns [resolvedStart, ...block.points, resolvedEnd].
 */
export function resolvePoints(block: EditorBlock, allBlocks: EditorBlock[]): [number, number][] {
  const start: [number, number] | null = resolveBindingPosition(block.startBinding, allBlocks);
  const end: [number, number] | null = resolveBindingPosition(block.endBinding, allBlocks);

  const mids: [number, number][] = block.points ?? [];

  if (!start && !end) return mids;

  const pts: [number, number][] = [];
  if (start) pts.push(start);
  pts.push(...mids);
  if (end) pts.push(end);
  return pts;
}
