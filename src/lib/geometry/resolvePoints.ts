// src/lib/geometry/resolvePoints.ts
import type { EditorBlock } from '@/data/store';
import { resolveBindingTarget, resolveBindingEndpoint } from './binding';

/**
 * Full resolved path for an arrow/line block.
 * Standalone: block.points. Bound: [clippedStart, ...points, clippedEnd].
 * Each bound end is aimed at its adjacent path point (waypoint if present,
 * otherwise the other end's binding target / free point).
 */
export function resolvePoints(block: EditorBlock, allBlocks: EditorBlock[]): [number, number][] {
  const mids: [number, number][] = block.points ?? [];
  const sB = block.startBinding, eB = block.endBinding;
  if (!sB && !eB) return mids;

  const sBlock = sB ? allBlocks.find(b => b.id === sB.blockId) : undefined;
  const eBlock = eB ? allBlocks.find(b => b.id === eB.blockId) : undefined;

  const startTarget = sB && sBlock ? resolveBindingTarget(sB, sBlock) : undefined;
  const endTarget = eB && eBlock ? resolveBindingTarget(eB, eBlock) : undefined;

  // Aim points: prefer nearest waypoint; else the opposite end's target; else opposite free point.
  const startAim = mids[0] ?? endTarget ?? mids[mids.length - 1];
  const endAim = mids[mids.length - 1] ?? startTarget ?? mids[0];

  const pts: [number, number][] = [];
  if (sB) {
    const p = startAim ? resolveBindingEndpoint(sB, startAim, allBlocks) : startTarget ?? null;
    if (p) pts.push(p);
  }
  pts.push(...mids);
  if (eB) {
    const p = endAim ? resolveBindingEndpoint(eB, endAim, allBlocks) : endTarget ?? null;
    if (p) pts.push(p);
  }
  return pts;
}
