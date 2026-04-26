import type { BentoLayoutItem } from '@/components/bento/types';

export const HALF_COLS = 6;
export const MAX_ROWS = 4;
export const MAX_PER_ROW = 3;

// ─── Row Queries ──────────────────────────────────────────────────────────────

export function getNativeItems(layout: BentoLayoutItem[], row: number): BentoLayoutItem[] {
  return layout.filter(it => it.row === row).sort((a, b) => a.order - b.order);
}

export function getSpannersWidth(layout: BentoLayoutItem[], row: number): number {
  return layout.filter(it => it.row < row && row < it.row + it.h).reduce((s, it) => s + it.w, 0);
}

export function availableHalfCols(layout: BentoLayoutItem[], row: number, excludeId?: string): number {
  const spanW = layout.filter(it => it.i !== excludeId && it.row < row && row < it.row + it.h).reduce((s, it) => s + it.w, 0);
  return HALF_COLS - spanW;
}

// ─── Rebalance ────────────────────────────────────────────────────────────────

import { widgetRegistry } from '@/components/bento/registry';

export function rebalanceRow(items: BentoLayoutItem[], total: number = HALF_COLS): BentoLayoutItem[] {
  const n = items.length;
  if (n === 0) return items;
  
  // 1. Get min widths from registry
  const minWidths = items.map(it => widgetRegistry[it.type]?.minW ?? 2);
  const totalMin = minWidths.reduce((s, w) => s + w, 0);
  
  // 2. If existing widths already sum to total and satisfy minW, preserve them
  const currentTotal = items.reduce((s, it) => s + it.w, 0);
  const allSatisfyMin = items.every((it, i) => it.w >= minWidths[i]);
  if (currentTotal === total && allSatisfyMin) {
    return items;
  }

  // 3. Special cases for common distributions
  if (n === 1) return [{ ...items[0], w: total }];
  
  // 4. Handle underflow (total < totalMin)
  // We must shrink items below minW to fit the grid and avoid "out of boundaries" errors.
  // validateLayout will catch if they are too small.
  if (total < totalMin) {
    const ratio = total / totalMin;
    let distributedW = items.map((it, i) => Math.floor(minWidths[i] * ratio));
    let currentSum = distributedW.reduce((s, w) => s + w, 0);
    let diff = total - currentSum;
    
    // Distribute rounding error
    for (let i = 0; i < diff; i++) {
      distributedW[i % n]++;
    }
    
    return items.map((it, i) => ({ ...it, w: distributedW[i] }));
  }

  // 5. Proportional distribution with minW enforcement
  const extra = total - totalMin;
  const perItemExtra = Math.floor(extra / n);
  const remainder = extra % n;

  return items.map((it, i) => {
    const minW = minWidths[i];
    const w = minW + perItemExtra + (i < remainder ? 1 : 0);
    return { ...it, w };
  });
}

export function rebalanceAll(layout: BentoLayoutItem[]): BentoLayoutItem[] {
  try {
    let result = [...layout];
    
    for (let r = 0; r < MAX_ROWS; r++) {
      // 1. Calculate space taken by spanners from previous rows (use result!)
      const spanW = result.filter(it => it.row < r && r < it.row + it.h).reduce((s, it) => s + it.w, 0);
      const avail = Math.max(0, HALF_COLS - spanW);
      
      // 2. Get native items for this row, sorted by order
      let natives = result.filter(it => it.row === r).sort((a, b) => a.order - b.order);
      
      // 3. Push items that don't fit (considering minW and MAX_PER_ROW)
      const getMinTotal = (items: BentoLayoutItem[]) => items.reduce((s, it) => s + (widgetRegistry[it.type]?.minW ?? 2), 0);
      
      while (r < MAX_ROWS - 1 && natives.length > 0 && (natives.length > MAX_PER_ROW || getMinTotal(natives) > avail)) {
        const toPush = natives.pop()!;
        const idx = result.findIndex(it => it.i === toPush.i);
        if (idx !== -1) {
          const nextRow = r + 1;
          const clampedH = Math.max(widgetRegistry[toPush.type]?.minH ?? 1, Math.min(toPush.h, MAX_ROWS - nextRow));
          result[idx] = { ...toPush, row: nextRow, order: 99, h: clampedH };
        }
      }
      
      // 4. Rebalance the items that stayed in this row to fill the available space
      if (natives.length > 0) {
        const balanced = rebalanceRow(natives, avail);
        
        balanced.forEach((b, i) => {
          const resIdx = result.findIndex(it => it.i === b.i);
          if (resIdx !== -1) {
            result[resIdx] = { ...b, order: i };
          }
        });
      }
    }
    
    return result;
  } catch (e) {
    console.error("rebalanceAll crashed:", e);
    return layout;
  }
}
 
// ─── Fill Gaps (vertical expansion) ──────────────────────────────────────────

// Expand widgets downward into empty cells so no grid space is wasted.
export function fillGaps(layout: BentoLayoutItem[]): BentoLayoutItem[] {
  let result = layout.map(it => ({ ...it }));
  const order = [...result].sort((a, b) => a.row - b.row || a.order - b.order).map(it => it.i);

  // Compute grid once from the original layout so widget positions don't shift
  // as we mutate heights. Only the expanding widget's own cells are updated.
  const { grid, positions } = computeGridPositions(layout);

  for (const id of order) {
    const entry = widgetRegistry[result.find(it => it.i === id)?.type ?? ''];
    const maxH = entry?.maxH ?? 4;
    const pos = positions.get(id);
    if (!pos) continue;

    while (true) {
      const idx = result.findIndex(it => it.i === id);
      if (idx === -1) break;
      const item = result[idx];
      if (item.h >= maxH) break;

      const nextRow = item.row + item.h;
      if (nextRow >= MAX_ROWS) break;

      let canExpand = true;
      for (let c = pos.x; c < pos.x + pos.w; c++) {
        if (grid[nextRow][c] !== null) { canExpand = false; break; }
      }
      if (!canExpand) break;

      // Mark the new row cells as occupied before moving to next iteration
      for (let c = pos.x; c < pos.x + pos.w; c++) {
        grid[nextRow][c] = id;
      }
      result[idx] = { ...item, h: item.h + 1 };
    }
  }

  return result;
}

 // ─── Compact (gravity) ────────────────────────────────────────────────────────


export function compactLayout(layout: BentoLayoutItem[]): BentoLayoutItem[] {
  const occupied = new Set<number>();
  for (const it of layout) {
    for (let r = it.row; r < it.row + it.h; r++) occupied.add(r);
  }
  const sorted = [...occupied].sort((a, b) => a - b);
  const remap = new Map<number, number>();
  sorted.forEach((oldRow, newRow) => remap.set(oldRow, newRow));
  return layout.map(it => ({ ...it, row: remap.get(it.row) ?? it.row }));
}

// ─── Drop Resolution ──────────────────────────────────────────────────────────
//
// Each rule below maps one of the 7 canonical diagram patterns into a layout
// candidate. A rule returns `null` if it can't produce a valid candidate; the
// dispatcher (`resolveDrop`) tries them in priority order and returns the
// first valid one. Returning `null` from the dispatcher means the drop is
// rejected — the caller should snap back and show feedback.

type DropTarget =
  | { kind: 'widget'; id: string; intent: 'swap' | 'insert-before' | 'insert-after' }
  | { kind: 'empty'; row: number; order: number };

const clampHForRow = (item: BentoLayoutItem, destRow: number): BentoLayoutItem => {
  const entry = widgetRegistry[item.type];
  const maxH = Math.min(entry?.maxH ?? 4, MAX_ROWS - destRow);
  const minH = entry?.minH ?? 1;
  return { ...item, h: Math.max(minH, Math.min(item.h, Math.max(1, maxH))) };
};

const tryFinalize = (candidate: BentoLayoutItem[], expectedLen: number): BentoLayoutItem[] | null => {
  const balanced = rebalanceAll(candidate);
  if (balanced.length !== expectedLen) return null;
  if (!validateLayout(balanced).valid) return null;
  return compactLayout(balanced);
};

// Rule 4 / Rule 6 — direct positional swap (also covers cross-row counter-swap).
// Each widget adopts the other's height (clamped to its own maxH) so no gaps are created.
function ruleDirectSwap(layout: BentoLayoutItem[], dragged: BentoLayoutItem, target: BentoLayoutItem): BentoLayoutItem[] | null {
  const draggedEntry = widgetRegistry[dragged.type];
  const targetEntry  = widgetRegistry[target.type];

  // Dragged widget adopts target's height (clamped to dragged widget's maxH and row bounds).
  const draggedNewH = Math.max(
    draggedEntry?.minH ?? 1,
    Math.min(target.h, draggedEntry?.maxH ?? 4, MAX_ROWS - target.row)
  );
  // Target widget adopts dragged's height (clamped to target widget's maxH and row bounds).
  const targetNewH = Math.max(
    targetEntry?.minH ?? 1,
    Math.min(dragged.h, targetEntry?.maxH ?? 4, MAX_ROWS - dragged.row)
  );

  // Width adoption — each widget takes the other's width, clamped to its own registry bounds
  const draggedNewW = Math.max(draggedEntry?.minW ?? 2, Math.min(target.w, draggedEntry?.maxW ?? 6));
  const targetNewW  = Math.max(targetEntry?.minW ?? 2, Math.min(dragged.w, targetEntry?.maxW ?? 6));

  const swapped = layout.map(it => {
    if (it.i === dragged.i) return { ...it, row: target.row, order: target.order, w: draggedNewW, h: draggedNewH };
    if (it.i === target.i)  return { ...it, row: dragged.row, order: dragged.order, w: targetNewW, h: targetNewH };
    return it;
  });
  return tryFinalize(swapped, layout.length);
}

// Rule 1 — row swap: every widget in dragged.row exchanges rows with every widget in target.row.
// Heights of all swapped widgets are clamped to fit at the destination row.
function ruleRowSwap(layout: BentoLayoutItem[], dragged: BentoLayoutItem, target: BentoLayoutItem): BentoLayoutItem[] | null {
  if (dragged.row === target.row) return null;
  const draggedRowH = Math.max(...layout.filter(it => it.row === dragged.row).map(it => it.h));
  const targetRowH  = Math.max(...layout.filter(it => it.row === target.row).map(it => it.h));
  const swapped = layout.map(it => {
    if (it.row === dragged.row) {
      const entry = widgetRegistry[it.type];
      const newH = Math.max(entry?.minH ?? 1, Math.min(targetRowH, entry?.maxH ?? 4, MAX_ROWS - target.row));
      return { ...it, row: target.row, h: newH };
    }
    if (it.row === target.row) {
      const entry = widgetRegistry[it.type];
      const newH = Math.max(entry?.minH ?? 1, Math.min(draggedRowH, entry?.maxH ?? 4, MAX_ROWS - dragged.row));
      return { ...it, row: dragged.row, h: newH };
    }
    return it;
  });
  return tryFinalize(swapped, layout.length);
}

// Rule 5 — insert + displace: dragged inserts at target row at minW; target row is rebalanced.
//   `position`: 'before' or 'after' the target widget.
function ruleInsertDisplace(
  layout: BentoLayoutItem[],
  dragged: BentoLayoutItem,
  target: BentoLayoutItem,
  position: 'before' | 'after'
): BentoLayoutItem[] | null {
  const entry = widgetRegistry[dragged.type];
  const insertW = entry?.minW ?? 2;
  const insertH = Math.max(entry?.minH ?? 1, Math.min(dragged.h, MAX_ROWS - target.row));

  const targetOrder = position === 'before' ? target.order : target.order + 1;

  // Remove dragged, shift target row to make room.
  const without = layout.filter(it => it.i !== dragged.i);
  const shifted = without.map(it =>
    it.row === target.row && it.order >= targetOrder
      ? { ...it, order: it.order + 1 }
      : it
  );
  const inserted = [...shifted, { ...dragged, row: target.row, order: targetOrder, w: insertW, h: insertH }];
  return tryFinalize(inserted, layout.length);
}

// Rule 7 — drop fills row: dragged moves to target row, dropped at given order; rebalance grows it.
function ruleDropFillsRow(
  layout: BentoLayoutItem[],
  dragged: BentoLayoutItem,
  targetRow: number,
  targetOrder: number
): BentoLayoutItem[] | null {
  const without = layout.filter(it => it.i !== dragged.i);
  const order = Math.min(targetOrder, getNativeItems(without, targetRow).length);
  const shifted = without.map(it =>
    it.row === targetRow && it.order >= order
      ? { ...it, order: it.order + 1 }
      : it
  );
  const placed = [...shifted, clampHForRow({ ...dragged, row: targetRow, order }, targetRow)];
  return tryFinalize(placed, layout.length);
}

// Smart-swap fallback: shrink row-mates to minW, then positional swap with height adoption.
function ruleSmartSwap(layout: BentoLayoutItem[], dragged: BentoLayoutItem, target: BentoLayoutItem): BentoLayoutItem[] | null {
  const affectedRows = new Set([dragged.row, target.row]);
  const roomMade = layout.map(it => {
    if (affectedRows.has(it.row) && it.i !== dragged.i && it.i !== target.i) {
      return { ...it, w: widgetRegistry[it.type]?.minW ?? 2 };
    }
    return it;
  });
  const draggedEntry = widgetRegistry[dragged.type];
  const targetEntry  = widgetRegistry[target.type];
  const draggedNewH = Math.max(draggedEntry?.minH ?? 1, Math.min(target.h, draggedEntry?.maxH ?? 4, MAX_ROWS - target.row));
  const targetNewH  = Math.max(targetEntry?.minH ?? 1, Math.min(dragged.h, targetEntry?.maxH ?? 4, MAX_ROWS - dragged.row));
  const swapped = roomMade.map(it => {
    if (it.i === dragged.i) return { ...it, row: target.row, order: target.order, h: draggedNewH };
    if (it.i === target.i)  return { ...it, row: dragged.row, order: dragged.order, h: targetNewH };
    return it;
  });
  return tryFinalize(swapped, layout.length);
}

// Dispatcher — picks the rule for a given drop intent and returns the resulting
// layout, or `null` if no rule produces a valid layout (caller should snap back).
export function resolveDrop(
  layout: BentoLayoutItem[],
  draggedId: string,
  target: DropTarget
): BentoLayoutItem[] | null {
  const dragged = layout.find(it => it.i === draggedId);
  if (!dragged) return null;

  if (target.kind === 'empty') {
    // Empty cell drop → Rule 7 (drop fills row). Fall through to Rule 5 if it fails.
    const r7 = ruleDropFillsRow(layout, dragged, target.row, target.order);
    if (r7) return r7;
    return null;
  }

  // Widget drop
  const targetItem = layout.find(it => it.i === target.id);
  if (!targetItem || targetItem.i === dragged.i) return null;

  if (target.intent === 'insert-before' || target.intent === 'insert-after') {
    const position = target.intent === 'insert-before' ? 'before' : 'after';
    const r5 = ruleInsertDisplace(layout, dragged, targetItem, position);
    if (r5) return r5;
    // Fall through to swap if insert can't fit.
  }

  // Swap intent — direct swap first (just the two widgets exchange positions),
  // then row swap as fallback, then smart swap as last resort.
  const r4 = ruleDirectSwap(layout, dragged, targetItem);
  if (r4) return r4;

  const r1 = ruleRowSwap(layout, dragged, targetItem);
  if (r1) return r1;

  const rSmart = ruleSmartSwap(layout, dragged, targetItem);
  if (rSmart) return rSmart;

  return null;
}

// ─── Swap (legacy wrapper, retained for back-compat) ─────────────────────────

export function calculateSwapLayout(
  layout: BentoLayoutItem[],
  draggedId: string,
  targetId: string
): BentoLayoutItem[] {
  const result = resolveDrop(layout, draggedId, { kind: 'widget', id: targetId, intent: 'swap' });
  return result ?? layout;
}

// ─── Insert / Push ────────────────────────────────────────────────────────────

export function calculatePushLayout(
  layout: BentoLayoutItem[],
  draggedId: string,
  targetRow: number,
  targetOrder: number
): BentoLayoutItem[] | null {
  const dragged = layout.find(it => it.i === draggedId);
  if (!dragged) return layout;
  let result = layout.filter(it => it.i !== draggedId);

  const order = Math.min(targetOrder, getNativeItems(result, targetRow).length);
  const shifted = result.map(it =>
    it.row === targetRow && it.order >= order
      ? { ...it, order: it.order + 1 }
      : it
  );

  const rebalanced = rebalanceAll([...shifted, { ...dragged, row: targetRow, order }]);

  if (!validateLayout(rebalanced).valid || rebalanced.length < layout.length) {
    return layout; // Reject if it pushes something off grid
  }

  return compactLayout(rebalanced);
}

// ─── Divider Adjust ───────────────────────────────────────────────────────────

/** Snap divider to nearest of 3 positions: 2+4, 3+3, 4+2, filtered by min widths */
export function snapDivider(
  rawFraction: number, 
  minL: number = 2, 
  minR: number = 2, 
  total: number = HALF_COLS
): [number, number] {
  const allOptions: [number, number][] = [[2, 4], [3, 3], [4, 2]];
  const options = allOptions.filter(opt => opt[0] >= minL && opt[1] >= minR);
  
  if (options.length === 0) {
    // If no preset matches, just return the most balanced fit that respects minW
    const w0 = Math.max(minL, Math.min(total - minR, Math.round(rawFraction * total)));
    return [w0, total - w0];
  }

  const raw = rawFraction * total;
  let best = options[0];
  let bestDist = Infinity;
  for (const opt of options) {
    const d = Math.abs(opt[0] - raw);
    if (d < bestDist) { bestDist = d; best = opt; }
  }
  return best;
}

export function adjustDivider(
  layout: BentoLayoutItem[],
  leftId: string,
  rightId: string,
  w0: number,
  w1: number
): BentoLayoutItem[] {
  const updated = layout.map(it => {
    if (it.i === leftId) return { ...it, w: w0 };
    if (it.i === rightId) return { ...it, w: w1 };
    return it;
  });

  // Rebalance to ensure grid invariants are maintained after width shift
  return rebalanceAll(updated);
}

export function adjustVerticalDivider(
  layout: BentoLayoutItem[],
  topId: string,
  bottomId: string,
  h0: number,
  h1: number
): BentoLayoutItem[] {
  const { positions } = computeGridPositions(layout);
  const topWidget = layout.find(it => it.i === topId);
  const bottomWidget = layout.find(it => it.i === bottomId);
  if (!topWidget || !bottomWidget) return layout;

  if (h0 === topWidget.h) return layout;

  const posT = positions.get(topId);
  const posB = positions.get(bottomId);
  if (!posT || !posB) return layout;

  const oldBottomRow = bottomWidget.row;
  const newBottomRow = topWidget.row + h0;

  // Only move widgets whose column range overlaps with the top widget's column range.
  // Widgets in the same bottom row but outside the top widget's columns are unrelated
  // to this divider and must not be moved.
  const topLeft = posT.x;
  const topRight = posT.x + posT.w;

  const updated = layout.map(it => {
    if (it.i === topId) return { ...it, h: h0 };

    const posIt = positions.get(it.i);
    if (!posIt) return it;
    const overlapL = Math.max(topLeft, posIt.x);
    const overlapR = Math.min(topRight, posIt.x + posIt.w);
    if (overlapL >= overlapR) return it; // no column overlap — leave alone

    // Spanner: starts before oldBottomRow but extends into it (e.g. C in the diagram).
    // Trim its height so it ends at newBottomRow instead of spilling into the vacated space.
    if (it.row < oldBottomRow && it.row + it.h > oldBottomRow) {
      const entry = widgetRegistry[it.type];
      const minH = entry?.minH ?? 1;
      const clampedH = Math.max(minH, newBottomRow - it.row);
      return { ...it, h: clampedH };
    }

    if (it.row !== oldBottomRow) return it;
    return { ...it, row: newBottomRow, h: it.i === bottomId ? Math.max(1, h1) : it.h };
  });

  return rebalanceAll(updated);
}

// ─── Unified Resize Divider ───────────────────────────────────────────────────
//
// Replaces adjustDivider + adjustVerticalDivider.
// claimerId: widget growing into new cells.
// victimId:  widget losing cells.
// newBoundary: absolute grid position of the new divider edge.
//   axis='horizontal' → newBoundary is a col (0–6), divider moves left/right.
//   axis='vertical'   → newBoundary is a row (0–4), divider moves up/down.
// Returns null if the resize is invalid (any widget violates min/max, or gaps remain).

export function resizeDivider(
  layout: BentoLayoutItem[],
  claimerId: string,
  victimId: string,
  newBoundary: number,
  axis: 'horizontal' | 'vertical'
): BentoLayoutItem[] | null {
  const { positions } = computeGridPositions(layout);
  const claimer = layout.find(it => it.i === claimerId);
  const victim  = layout.find(it => it.i === victimId);
  if (!claimer || !victim) return null;

  const posC = positions.get(claimerId);
  const posV = positions.get(victimId);
  if (!posC || !posV) return null;

  // ── Step 1: Transfer band & old boundary ─────────────────────────────────
  // For horizontal axis (left/right): band is row overlap, boundary is a col.
  // For vertical axis (up/down):      band is col overlap, boundary is a row.

  let oldBoundary: number;
  let bandStart: number;
  let bandEnd: number;   // exclusive

  if (axis === 'horizontal') {
    const claimerIsLeft = posC.x + posC.w === posV.x;
    oldBoundary = claimerIsLeft ? posC.x + posC.w : posV.x + posV.w;
    bandStart = Math.max(posC.y, posV.y);
    bandEnd   = Math.min(posC.y + posC.h, posV.y + posV.h);
  } else {
    const claimerIsAbove = posC.y + posC.h === posV.y;
    oldBoundary = claimerIsAbove ? posC.y + posC.h : posV.y + posV.h;
    bandStart = Math.max(posC.x, posV.x);
    bandEnd   = Math.min(posC.x + posC.w, posV.x + posV.w);
  }

  if (newBoundary === oldBoundary) return layout; // no-op
  if (bandStart >= bandEnd) return null;          // no overlap band

  // ── Step 2: Reshape claimer ───────────────────────────────────────────────
  const claimerEntry = widgetRegistry[claimer.type];
  let newClaimer = { ...claimer };

  if (axis === 'horizontal') {
    const claimerIsLeft = posC.x + posC.w === posV.x;
    if (claimerIsLeft) {
      newClaimer.w = posC.w + (newBoundary - oldBoundary);
    } else {
      newClaimer.w = posC.w + (oldBoundary - newBoundary);
    }
    if (newClaimer.w < (claimerEntry?.minW ?? 2)) return null;
    if (newClaimer.w > (claimerEntry?.maxW ?? 6)) return null;
  } else {
    const claimerIsAbove = posC.y + posC.h === posV.y;
    if (claimerIsAbove) {
      newClaimer.h = posC.h + (newBoundary - oldBoundary);
    } else {
      newClaimer.h = posC.h + (oldBoundary - newBoundary);
      newClaimer.row = posC.y - (oldBoundary - newBoundary);
    }
    if (newClaimer.h < (claimerEntry?.minH ?? 1)) return null;
    if (newClaimer.h > (claimerEntry?.maxH ?? 4)) return null;
    if (newClaimer.row < 0 || newClaimer.row + newClaimer.h > MAX_ROWS) return null;
  }

  // ── Step 3: Reshape victim ────────────────────────────────────────────────
  const victimEntry = widgetRegistry[victim.type];
  let newVictim = { ...victim };

  if (axis === 'horizontal') {
    const claimerIsLeft = posC.x + posC.w === posV.x;
    if (claimerIsLeft) {
      const stripCoversAllRows = bandStart === posV.y && bandEnd === posV.y + posV.h;
      if (stripCoversAllRows) {
        const colsLost = newBoundary - oldBoundary;
        newVictim.w = posV.w - colsLost;
      } else {
        const bandIsAtTop = bandStart === posV.y;
        if (bandIsAtTop) {
          const rowsLost = bandEnd - bandStart;
          newVictim.h = posV.h - rowsLost;
          newVictim.row = posV.y + rowsLost;
        } else {
          const rowsLost = bandEnd - bandStart;
          newVictim.h = posV.h - rowsLost;
        }
      }
    } else {
      const stripCoversAllRows = bandStart === posV.y && bandEnd === posV.y + posV.h;
      if (stripCoversAllRows) {
        const colsLost = oldBoundary - newBoundary;
        newVictim.w = posV.w - colsLost;
      } else {
        const bandIsAtTop = bandStart === posV.y;
        if (bandIsAtTop) {
          const rowsLost = bandEnd - bandStart;
          newVictim.h = posV.h - rowsLost;
          newVictim.row = posV.y + rowsLost;
        } else {
          const rowsLost = bandEnd - bandStart;
          newVictim.h = posV.h - rowsLost;
        }
      }
    }

    if (newVictim.w < (victimEntry?.minW ?? 2)) return null;
    if (newVictim.w > (victimEntry?.maxW ?? 6)) return null;
    if (newVictim.h < (victimEntry?.minH ?? 1)) return null;
  } else {
    const claimerIsAbove = posC.y + posC.h === posV.y;
    if (claimerIsAbove) {
      const stripCoversAllCols = bandStart === posV.x && bandEnd === posV.x + posV.w;
      if (stripCoversAllCols) {
        const rowsLost = newBoundary - oldBoundary;
        newVictim.h = posV.h - rowsLost;
        newVictim.row = posV.y + rowsLost;
      } else {
        const stripIsAtLeft = bandStart === posV.x;
        if (stripIsAtLeft) {
          const colsLost = bandEnd - bandStart;
          newVictim.w = posV.w - colsLost;
        } else {
          const colsLost = bandEnd - bandStart;
          newVictim.w = posV.w - colsLost;
        }
      }
    } else {
      const stripCoversAllCols = bandStart === posV.x && bandEnd === posV.x + posV.w;
      if (stripCoversAllCols) {
        const rowsLost = oldBoundary - newBoundary;
        newVictim.h = posV.h - rowsLost;
      } else {
        const stripIsAtLeft = bandStart === posV.x;
        if (stripIsAtLeft) {
          const colsLost = bandEnd - bandStart;
          newVictim.w = posV.w - colsLost;
        } else {
          const colsLost = bandEnd - bandStart;
          newVictim.w = posV.w - colsLost;
        }
      }
    }

    if (newVictim.h < (victimEntry?.minH ?? 1)) return null;
    if (newVictim.h > (victimEntry?.maxH ?? 4)) return null;
    if (newVictim.w < (victimEntry?.minW ?? 2)) return null;
    if (newVictim.row < 0 || newVictim.row + newVictim.h > MAX_ROWS) return null;
  }

  // ── Step 4: Build candidate layout with claimer + victim reshaped ─────────
  let candidate = layout.map(it => {
    if (it.i === claimerId) return newClaimer;
    if (it.i === victimId)  return newVictim;
    return it;
  });

  // ── Step 5: Fill freed cells ──────────────────────────────────────────────
  const freedCells: { col: number; row: number }[] = [];
  for (let r = posV.y; r < posV.y + posV.h; r++) {
    for (let c = posV.x; c < posV.x + posV.w; c++) {
      const { positions: newPos } = computeGridPositions(candidate);
      const newPosV = newPos.get(victimId);
      const inNewVictim = newPosV &&
        r >= newPosV.y && r < newPosV.y + newPosV.h &&
        c >= newPosV.x && c < newPosV.x + newPosV.w;
      const newPosC = newPos.get(claimerId);
      const inNewClaimer = newPosC &&
        r >= newPosC.y && r < newPosC.y + newPosC.h &&
        c >= newPosC.x && c < newPosC.x + newPosC.w;
      if (!inNewVictim && !inNewClaimer) {
        freedCells.push({ col: c, row: r });
      }
    }
  }

  let remaining = [...freedCells];
  let maxIter = 24;
  while (remaining.length > 0 && maxIter-- > 0) {
    const { positions: curPos, grid: curGrid } = computeGridPositions(candidate);
    const before = remaining.length;

    remaining = remaining.filter(({ col, row }) => {
      if (curGrid[row]?.[col] !== null) return false;

      const directions = [
        { dr: -1, dc: 0 },
        { dr:  1, dc: 0 },
        { dr:  0, dc: -1 },
        { dr:  0, dc:  1 },
      ];

      for (const { dr, dc } of directions) {
        const nr = row + dr;
        const nc = col + dc;
        if (nr < 0 || nr >= MAX_ROWS || nc < 0 || nc >= 6) continue;
        const neighborId = curGrid[nr]?.[nc];
        if (!neighborId) continue;

        const neighbor = candidate.find(it => it.i === neighborId);
        const nPos = curPos.get(neighborId);
        if (!neighbor || !nPos) continue;

        const entry = widgetRegistry[neighbor.type];

        let grown = { ...neighbor };
        if (dr === -1) {
          grown.h = neighbor.h + 1;
          grown.row = neighbor.row - 1;
          if (grown.row < 0 || grown.h > (entry?.maxH ?? 4)) continue;
        } else if (dr === 1) {
          grown.h = neighbor.h + 1;
          if (grown.row + grown.h > MAX_ROWS || grown.h > (entry?.maxH ?? 4)) continue;
        } else if (dc === -1) {
          grown.w = neighbor.w + 1;
          if (grown.w > (entry?.maxW ?? 6)) continue;
        } else {
          grown.w = neighbor.w + 1;
          if (grown.w > (entry?.maxW ?? 6)) continue;
        }

        candidate = candidate.map(it => it.i === neighborId ? grown : it);
        return false;
      }

      return true;
    });

    if (remaining.length === before) break;
  }

  if (remaining.length > 0) return null;

  // ── Step 6: Validate ──────────────────────────────────────────────────────
  const validation = validateLayout(candidate);
  if (!validation.valid) return null;

  return candidate;
}

/** Snap vertical divider to nearest of 3 positions: 4+8, 6+6, 8+4 */
export function snapVerticalDivider(
  rawFraction: number,
  total: number = 12 // 6 + 6
): [number, number] {
  const options: [number, number][] = [[4, 8], [6, 6], [8, 4]];
  const raw = rawFraction * total;
  let best = options[0];
  let bestDist = Infinity;
  for (const opt of options) {
    const d = Math.abs(opt[0] - raw);
    if (d < bestDist) {
      bestDist = d;
      best = opt;
    }
  }
  return best;
}

// ─── Find First Fit ───────────────────────────────────────────────────────────

export function findFirstFit(
  layout: BentoLayoutItem[],
  w: number,
  h: number
): { row: number; order: number } | null {
  for (let row = 0; row < MAX_ROWS; row++) {
    const avail = availableHalfCols(layout, row);
    const natives = getNativeItems(layout, row);
    if (natives.length < MAX_PER_ROW && avail >= Math.max(2, w) && row + h - 1 < MAX_ROWS) {
      return { row, order: natives.length };
    }
  }
  const usedRows = [...new Set(layout.map(it => it.row))];
  const nextRow = usedRows.length > 0 ? Math.max(...usedRows) + 1 : 0;
  if (nextRow < MAX_ROWS && nextRow + h - 1 < MAX_ROWS) return { row: nextRow, order: 0 };
  return null;
}

export function canFit(layout: BentoLayoutItem[], w: number, h: number): boolean {
  return findFirstFit(layout, w, h) !== null;
}

export function validateLayout(layout: BentoLayoutItem[]): { valid: boolean; error?: string } {
  const { positions, grid } = computeGridPositions(layout);

  if (positions.size < layout.length) {
    return { valid: false, error: "Some widgets were pushed off-grid or have invalid dimensions" };
  }

  for (const item of layout) {
    const pos = positions.get(item.i);
    if (!pos) continue;

    const entry = widgetRegistry[item.type];
    const minW = entry?.minW ?? 2;
    const minH = entry?.minH ?? 1;
    const maxW = entry?.maxW ?? 6;
    const maxH = entry?.maxH ?? 4;

    if (pos.w < minW || pos.h < minH) {
      return { valid: false, error: `Widget ${item.type} (${item.i}) is smaller than its minimum dimensions (${minW}x${minH})` };
    }
    if (pos.w > maxW || pos.h > maxH) {
      return { valid: false, error: `Widget ${item.type} (${item.i}) exceeds its maximum dimensions (${maxW}x${maxH})` };
    }
    if (pos.y < 0 || pos.y + pos.h > MAX_ROWS || pos.x < 0 || pos.x + pos.w > 6) {
      return { valid: false, error: `Widget ${item.i} is out of grid boundaries` };
    }
  }

  // Reject layouts with horizontal gaps: every occupied row must be fully covered.
  const occupiedRows = new Set<number>();
  for (const item of layout) {
    for (let r = item.row; r < item.row + item.h; r++) occupiedRows.add(r);
  }
  for (const r of occupiedRows) {
    const rowCoverage = grid[r].filter(cell => cell !== null).length;
    if (rowCoverage !== HALF_COLS) {
      return { valid: false, error: `Row ${r} has a horizontal gap (${rowCoverage}/${HALF_COLS} cols covered)` };
    }
  }

  return { valid: true };
}

// Attempt to salvage a broken saved layout before falling back to defaults.
// Steps: drop unknown types → clamp w/h to registry bounds → rebalance → validate.
export function recoverLayout(layout: BentoLayoutItem[]): BentoLayoutItem[] | null {
  const known = layout.filter(it => !!widgetRegistry[it.type]);

  const clamped = known.map(it => {
    const entry = widgetRegistry[it.type];
    const minW = entry?.minW ?? 2;
    const maxW = entry?.maxW ?? 6;
    const minH = entry?.minH ?? 1;
    const maxH = entry?.maxH ?? 4;
    return {
      ...it,
      w: Math.min(Math.max(it.w, minW), maxW),
      h: Math.min(Math.max(it.h, minH), maxH),
      row: Math.min(Math.max(it.row, 0), MAX_ROWS - 1),
    };
  });

  const recovered = compactLayout(rebalanceAll(clamped));
  return validateLayout(recovered).valid ? recovered : null;
}

export function computeGridPositions(layout: BentoLayoutItem[]) {

  const grid = Array(MAX_ROWS).fill(null).map(() => Array(6).fill(null));
  
  const sorted = [...layout].sort((a, b) => {
    if (a.row !== b.row) return a.row - b.row;
    return a.order - b.order;
  });

  const positions = new Map<string, {x: number, y: number, w: number, h: number}>();

  for (const item of sorted) {
    let x = 0;
    const row = item.row;
    if (row >= MAX_ROWS || row < 0) continue;

    while (x < 6 && grid[row] && grid[row][x] !== null) {
      x++;
    }
    
    // Removed hard-capping. The engine must ensure item.w fits.
    // If it doesn't fit, we still set it, and validateLayout will catch it.
    const finalW = item.w;
    const finalH = item.h;
    
    if (finalW > 0 && finalH > 0) {
      positions.set(item.i, { x, y: item.row, w: finalW, h: finalH });
      
      for (let r = item.row; r < item.row + finalH; r++) {
        for (let c = x; c < x + finalW; c++) {
          if (r < MAX_ROWS && c < 6) {
             grid[r][c] = item.i;
          }
        }
      }
    } else {
      positions.set(item.i, { x, y: item.row, w: 0, h: 0 });
    }
  }
  return { positions, grid };
}
