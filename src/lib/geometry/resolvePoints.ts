// src/lib/geometry/resolvePoints.ts
import type { EditorBlock } from '@/data/store';
import { resolveBindingPosition } from './binding';

export function resolvePoints(block: EditorBlock, allBlocks: EditorBlock[]): [number, number][] {
  const start = resolveBindingPosition(block.startBinding, allBlocks);
  const end = resolveBindingPosition(block.endBinding, allBlocks);
  const mids = block.keyPoints ?? [];

  if (!start && !end && mids.length < 2) return block.points ?? [];

  const pts: [number, number][] = [];
  if (start) pts.push(start);
  pts.push(...mids);
  if (end) pts.push(end);
  if (pts.length === 1) pts.push([pts[0][0] + 0.01, pts[0][1] + 0.01]);
  if (pts.length === 0) {
    const x = block.x ?? 0, y = block.y ?? 0;
    pts.push([x, y], [x + (block.width ?? 100), y + (block.height ?? 60)]);
  }
  return pts;
}
