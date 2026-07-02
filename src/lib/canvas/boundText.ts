import type { EditorBlock } from '@/data/store.types';
import { measureTextSize } from '@/components/canvas/CanvasTextElement';

export const LABEL_PADDING = 12;

export function getBoundText(containerBlockId: string, blocks: EditorBlock[]): EditorBlock | undefined {
  return blocks.find(b => b.type === 'text' && b.containerId === containerBlockId);
}

/** Greedy word-wrap against a max width using the DOM measurer. */
export function wrapText(text: string, fontSize: number, maxWidth: number): string {
  const out: string[] = [];
  for (const rawLine of text.split('\n')) {
    const words = rawLine.split(' ');
    let line = '';
    for (const w of words) {
      const candidate = line ? `${line} ${w}` : w;
      if (measureTextSize(candidate, fontSize).width <= maxWidth || !line) line = candidate;
      else { out.push(line); line = w; }
    }
    out.push(line);
  }
  return out.join('\n');
}

export function layoutLabelInShape(container: EditorBlock, fontSize: number, text: string):
  { x: number; y: number; width: number; height: number; wrapped: string; containerGrowsTo?: number } {
  const cw = container.width ?? 0, ch = container.height ?? 0;
  const maxW = Math.max(cw - 2 * LABEL_PADDING, fontSize);
  const wrapped = wrapText(text, fontSize, maxW);
  const size = measureTextSize(wrapped, fontSize);
  const width = Math.min(size.width, maxW);
  const height = size.height;
  const neededH = height + 2 * LABEL_PADDING;
  const containerGrowsTo = neededH > ch ? neededH : undefined;
  const effectiveH = containerGrowsTo ?? ch;
  return {
    x: (container.x ?? 0) + (cw - width) / 2,
    y: (container.y ?? 0) + (effectiveH - height) / 2,
    width, height, wrapped, containerGrowsTo,
  };
}

export function pathMidpoint(pts: [number, number][]): [number, number] {
  if (pts.length === 0) return [0, 0];
  if (pts.length === 1) return pts[0];
  let total = 0;
  const segs: number[] = [];
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    segs.push(d); total += d;
  }
  let half = total / 2;
  for (let i = 0; i < segs.length; i++) {
    if (half <= segs[i]) {
      const t = segs[i] === 0 ? 0 : half / segs[i];
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t];
    }
    half -= segs[i];
  }
  return pts[pts.length - 1];
}
