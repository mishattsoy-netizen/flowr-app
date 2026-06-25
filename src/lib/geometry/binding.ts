import type { ArrowBinding, EditorBlock } from '@/data/store';

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

export function resolveBindingPosition(binding: ArrowBinding | undefined, blocks: EditorBlock[]): [number, number] | null {
  if (!binding) return null;
  const block = blocks.find(b => b.id === binding.blockId);
  if (!block) return null;
  const rect: BlockRect = { x: block.x ?? 0, y: block.y ?? 0, width: block.width ?? 280, height: block.height ?? 100 };
  if (binding.fixedPoint) return [rect.x + binding.fixedPoint[0], rect.y + binding.fixedPoint[1]];
  return focusToPerimeter(binding.focus ?? 0.5, rect, binding.gap ?? 0);
}

export function getBlockFixedPoints(rect: BlockRect) {
  return {
    corners: [[0,0],[rect.width,0],[rect.width,rect.height],[0,rect.height]] as [number,number][],
    edgeCenters: [[rect.width/2,0],[rect.width,rect.height/2],[rect.width/2,rect.height],[0,rect.height/2]] as [number,number][],
  };
}
