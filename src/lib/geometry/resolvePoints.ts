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

export function resolvePoints(block: EditorBlock, allBlocks: EditorBlock[]): [number, number][] {
  let start: [number, number] | null = resolveBindingPosition(block.startBinding, allBlocks);
  let end: [number, number] | null = resolveBindingPosition(block.endBinding, allBlocks);

  // Legacy fallback: old connection blocks with fromId/toId but no startBinding/endBinding
  if (!start && block.fromId) start = legacyEndpoint(block.fromId, block.fromSide, allBlocks);
  if (!end && block.toId) end = legacyEndpoint(block.toId, block.toSide, allBlocks);

  const mids = block.keyPoints ?? [];

  if (!start && !end && mids.length < 2) return block.points ?? [];

  const pts: [number, number][] = [];
  if (start) pts.push(start);
  pts.push(...mids);
  if (end) pts.push(end);
  if (pts.length === 1) pts.push([pts[0][0] + 0.01, pts[0][1] + 0.01]);
  if (pts.length === 0) {
    const px = block.x ?? 0, py = block.y ?? 0;
    pts.push([px, py], [px + (block.width ?? 100), py + (block.height ?? 60)]);
  }
  return pts;
}
