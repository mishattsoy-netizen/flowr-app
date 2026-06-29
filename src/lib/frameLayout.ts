import type { EditorBlock } from '@/data/store.types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AutoLayoutResult {
  children: EditorBlock[];
  /** Updated frame width when in hug mode */
  frameWidth?: number;
  /** Updated frame height when in hug mode */
  frameHeight?: number;
}

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

// ─── Auto layout ─────────────────────────────────────────────────────────────

/**
 * Compute auto-layout positions for children of a frame.
 *
 * @param frame   - The frame block (reads direction, gap, padding, alignment, resizing).
 * @param children - The child blocks to arrange.
 * @returns An `AutoLayoutResult` with updated child positions and, for hug frames,
 *          the new frame dimensions.
 *
 * Supported modes (via `frame.layoutDirection`):
 *   - `horizontal`: children laid out left → right
 *   - `vertical`:   children laid out top → bottom
 *   - `grid`:       children wrap to new rows
 *   - `freeform`:   no automatic arrangement
 */
export function computeAutoLayout(
  frame: EditorBlock,
  children: EditorBlock[],
): AutoLayoutResult {
  if (children.length === 0) {
    return { children: [] };
  }

  const direction = frame.layoutDirection ?? 'horizontal';
  const gap = frame.layoutGap ?? 0;
  const pt = frame.layoutPaddingTop ?? 0;
  const pr = frame.layoutPaddingRight ?? 0;
  const pb = frame.layoutPaddingBottom ?? 0;
  const pl = frame.layoutPaddingLeft ?? 0;
  const crossAlign = frame.layoutCrossAlign ?? 'start';

  const frameW = frame.width ?? 800;
  const frameH = frame.height ?? 600;
  const contentW = Math.max(0, frameW - pl - pr);
  const contentH = Math.max(0, frameH - pt - pb);

  const frameHugW = frame.frameResizingH === 'hug';
  const frameHugH = frame.frameResizingV === 'hug';

  let resultFrameW: number | undefined;
  let resultFrameH: number | undefined;

  // ─── 1. Determine each child's dimensions (fixed / fill) ────────────────

  const sized: (EditorBlock & { _orig: EditorBlock })[] = children.map((c) => {
    const s = { ...c } as EditorBlock & { _orig: EditorBlock };
    s._orig = c;
    return s;
  });

  const fillH = sized.filter((s) => s._orig.childResizingH === 'fill');
  const fillV = sized.filter((s) => s._orig.childResizingV === 'fill');

  if (direction === 'horizontal') {
    // --- Horizontal fill-width distribution ---
    if (fillH.length > 0 && !frameHugW) {
      const fixedW = sized.reduce(
        (sum, s) => sum + (s._orig.childResizingH !== 'fill' ? s.width ?? 100 : 0),
        0,
      );
      const totalGaps = gap * (sized.length - 1);
      const remaining = Math.max(0, contentW - fixedW - totalGaps);
      const fillW = remaining / fillH.length;
      fillH.forEach((s) => {
        s.width = fillW;
      });
    }
    // For frameHugW the children keep their natural width

    // --- Vertical fill ─ all children fill content height ---
    if (fillV.length > 0 && !frameHugH) {
      if (fillV.length === sized.length) {
        sized.forEach((s) => {
          s.height = contentH;
        });
      }
    }
  }

  if (direction === 'vertical') {
    // --- Vertical fill-height distribution ---
    if (fillV.length > 0 && !frameHugH) {
      const fixedH = sized.reduce(
        (sum, s) => sum + (s._orig.childResizingV !== 'fill' ? s.height ?? 100 : 0),
        0,
      );
      const totalGaps = gap * (sized.length - 1);
      const remaining = Math.max(0, contentH - fixedH - totalGaps);
      const fillHt = remaining / fillV.length;
      fillV.forEach((s) => {
        s.height = fillHt;
      });
    }

    // --- Horizontal fill ─ all children fill content width ---
    if (fillH.length > 0 && !frameHugW) {
      if (fillH.length === sized.length) {
        sized.forEach((s) => {
          s.width = contentW;
        });
      }
    }
  }

  // ─── 2. Position children ───────────────────────────────────────────────

  switch (direction) {
    case 'horizontal':
      layoutHorizontal(sized, pl, pt, gap, crossAlign, contentH);
      // Hug width
      if (frameHugW) {
        const last = sized[sized.length - 1];
        const totalContentW = (last.x ?? 0) + (last.width ?? 0) - pl;
        resultFrameW = totalContentW + pl + pr;
      }
      // Hug height
      if (frameHugH) {
        const maxChildH = Math.max(...sized.map((s) => s.height ?? 0));
        resultFrameH = maxChildH + pt + pb;
      }
      break;

    case 'vertical':
      layoutVertical(sized, pl, pt, gap, crossAlign, contentW);
      // Hug width
      if (frameHugW) {
        const maxChildW = Math.max(...sized.map((s) => s.width ?? 0));
        resultFrameW = maxChildW + pl + pr;
      }
      // Hug height
      if (frameHugH) {
        const last = sized[sized.length - 1];
        const totalContentH = (last.y ?? 0) + (last.height ?? 0) - pt;
        resultFrameH = totalContentH + pt + pb;
      }
      break;

    case 'grid':
      layoutGrid(sized, pl, pt, gap, crossAlign, contentW, frameHugW);
      // Grid hug
      if (frameHugW) {
        const maxChildW = Math.max(...sized.map((s) => s.width ?? 0));
        resultFrameW = maxChildW + pl + pr;
      }
      if (frameHugH) {
        const lastRowY = sized.reduce((_, s) => (s.y ?? 0), 0);
        const bottom = sized.reduce(
          (max, s) => Math.max(max, (s.y ?? 0) + (s.height ?? 0)),
          0,
        );
        resultFrameH = bottom + pb;
      }
      break;

    case 'freeform':
      // Children keep their original positions — nothing to do
      break;
  }

  // ─── 3. Strip internal helpers and return ───────────────────────────────

  const childrenOut: EditorBlock[] = sized.map((s) => {
    const { _orig, ...clean } = s;
    return clean;
  });

  return {
    children: childrenOut,
    frameWidth: resultFrameW,
    frameHeight: resultFrameH,
  };
}

// ─── Internal layout helpers ─────────────────────────────────────────────────

/**
 * Arrange children left → right.
 * Main‑axis: align (start/center/end/space-between) affects initial cursor offset.
 * Cross‑axis: crossAlign controls y placement.
 */
function layoutHorizontal(
  children: (EditorBlock & { _orig: EditorBlock })[],
  pl: number,
  pt: number,
  gap: number,
  crossAlign: string,
  contentH: number,
): void {
  let cursor = pl;

  // For space-between we handle gaps after positioning
  const spaceBetween = false; // Not yet exposed via UI — reserved for future

  // Compute total width for center/end alignment
  if (crossAlign === 'center' || crossAlign === 'end') {
    // First pass: compute natural widths to know total
    const totalW = children.reduce((sum, ch) => {
      const w = ch._orig.childResizingH === 'fill' ? (ch.width ?? 0) : (ch.width ?? 100);
      return sum + w;
    }, 0);
    const totalSpan = totalW + gap * (children.length - 1);

    if (crossAlign === 'center') {
      cursor = pl + (contentH > 0 ? Math.max(0, (contentH - totalSpan)) / 2 : 0);
    } else if (crossAlign === 'end') {
      cursor = pl + (contentH > 0 ? Math.max(0, contentH - totalSpan) : 0);
    }
  }

  for (const ch of children) {
    ch.x = cursor;
    ch.y = applyCrossAlign(pt, ch.height ?? 100, crossAlign, contentH);

    // Current x cross‑align mode doesn't affect gap in horizontal — just y
    cursor += (ch.width ?? 100) + gap;
  }
}

/**
 * Arrange children top → bottom.
 */
function layoutVertical(
  children: (EditorBlock & { _orig: EditorBlock })[],
  pl: number,
  pt: number,
  gap: number,
  crossAlign: string,
  contentW: number,
): void {
  let cursor = pt;

  for (const ch of children) {
    ch.y = cursor;
    ch.x = applyCrossAlign(pl, ch.width ?? 100, crossAlign, contentW);
    cursor += (ch.height ?? 100) + gap;
  }
}

/**
 * Arrange children left → right, wrapping to new rows when exceeding content width.
 */
function layoutGrid(
  children: (EditorBlock & { _orig: EditorBlock })[],
  pl: number,
  pt: number,
  gap: number,
  crossAlign: string,
  contentW: number,
  hugW: boolean,
): void {
  let cursorX = pl;
  let cursorY = pt;
  let rowH = 0;
  const effectiveW = hugW ? Infinity : contentW;

  for (const ch of children) {
    const cw = ch.width ?? 100;
    const ch_ = ch.height ?? 100;

    // Wrap to next row if overflow
    if (cursorX + cw > pl + effectiveW && cursorX > pl) {
      cursorX = pl;
      cursorY += rowH + gap;
      rowH = 0;
    }

    ch.x = cursorX;
    ch.y = cursorY;
    rowH = Math.max(rowH, ch_);
    cursorX += cw + gap;
  }
}

// ─── Cross‑axis alignment ────────────────────────────────────────────────────

function applyCrossAlign(
  start: number,
  childSize: number,
  crossAlign: string,
  containerSize: number,
): number {
  switch (crossAlign) {
    case 'center':
      return start + (containerSize - childSize) / 2;
    case 'end':
      return start + Math.max(0, containerSize - childSize);
    case 'stretch':
      return start; // child was already stretched to fill containerSize
    case 'start':
    default:
      return start;
  }
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
