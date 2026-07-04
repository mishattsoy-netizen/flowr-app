// src/lib/geometry/binding.ts
import type { ArrowBinding, EditorBlock } from '@/data/store';
import { intersectSegmentWithOutline, isPointInsideShape, nearestPointOnOutline, getCornerRadius, type OutlineKind } from './outline';

interface BlockRect { x: number; y: number; width: number; height: number; }

export function focusToPerimeter(focus: number, rect: BlockRect, gap: number = 0): [number, number] {
  const { x, y, width, height } = rect;
  const perim = 2 * (width + height);
  let f = ((focus % 1) + 1) % 1;
  let dist = f * perim;

  const top = width;
  if (dist <= top) return [x + dist, gap > 0 ? y - gap : y];
  dist -= top;
  const right = height;
  if (dist <= right) return [gap > 0 ? x + width + gap : x + width, y + dist];
  dist -= right;
  if (dist <= width) return [x + width - dist, gap > 0 ? y + height + gap : y + height];
  dist -= width;
  return [gap > 0 ? x - gap : x, y + height - dist];
}

export function pointToFocus(cx: number, cy: number, rect: BlockRect): number {
  const { x, y, width, height } = rect;
  const perim = 2 * (width + height);
  
  const candidates = [
    { d: Math.abs(cy - y), pd: Math.max(x, Math.min(cx, x + width)) - x },
    { d: Math.abs(cx - (x + width)), pd: width + (Math.max(y, Math.min(cy, y + height)) - y) },
    { d: Math.abs(cy - (y + height)), pd: width + height + (x + width - Math.max(x, Math.min(cx, x + width))) },
    { d: Math.abs(cx - x), pd: 2 * width + height + (y + height - Math.max(y, Math.min(cy, y + height))) },
  ];
  const nearest = candidates.reduce((a, b) => a.d < b.d ? a : b);
  return nearest.pd / perim;
}

export const BINDING_GAP = 4;

export function blockOutlineKind(block: EditorBlock): OutlineKind {
  if (block.type === 'shape') {
    if (block.shapeKind === 'ellipse') return 'ellipse';
    if (block.shapeKind === 'diamond') return 'diamond';
  }
  return 'rect';
}

function blockRect(block: EditorBlock): BlockRect {
  return { x: block.x ?? 0, y: block.y ?? 0, width: block.width ?? 280, height: block.height ?? 100 };
}

export function resolveBindingTarget(binding: ArrowBinding, block: EditorBlock): [number, number] {
  const rect = blockRect(block);
  if (binding.fixedPoint) return [rect.x + binding.fixedPoint[0], rect.y + binding.fixedPoint[1]];
  return focusToPerimeter(binding.focus ?? 0.5, rect, 0);
}

export function resolveBindingEndpoint(
  binding: ArrowBinding, aimFrom: [number, number], blocks: EditorBlock[],
): [number, number] | null {
  const block = blocks.find(b => b.id === binding.blockId);
  if (!block) return null;
  const rect = blockRect(block);
  const kind = blockOutlineKind(block);
  const gap = binding.gap ?? BINDING_GAP;
  const target = resolveBindingTarget(binding, block);
  const cornerRadius = getCornerRadius(block.canvasStyleExt?.roundCorners, rect.width, rect.height);

  if (isPointInsideShape(kind, rect, aimFrom)) {
    // Degenerate: the other end is inside this shape — sit on the nearest outline point.
    return nearestPointOnOutline(kind, rect, aimFrom);
  }
  // Aim from the free end toward the target; clip at the outline with gap.
  // For focus bindings the target is ON the perimeter; extend the ray slightly past it
  // toward the shape center so the intersection always registers.
  const cx = rect.x + rect.width / 2, cy = rect.y + rect.height / 2;
  const towardCenter: [number, number] = binding.fixedPoint ? target : [
    target[0] + (cx - target[0]) * 0.01, target[1] + (cy - target[1]) * 0.01,
  ];
  const hit = intersectSegmentWithOutline(kind, rect, aimFrom, towardCenter, gap, cornerRadius);
  if (hit) return hit;
  // Ray missed (e.g. focus on the far side): slide along the outline — nearest outline
  // point to the straight line aimFrom→target, approximated by projecting aimFrom.
  return nearestPointOnOutline(kind, rect, aimFrom);
}
