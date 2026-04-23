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
  if (n === 1) return [{ ...items[0], w: Math.max(minWidths[0], total) }];
  
  // 4. Proportional distribution with minW enforcement
  // If total < totalMin, we will overflow, but rebalanceAll should prevent this.
  // We'll distribute the extra space beyond totalMin.
  const extra = Math.max(0, total - totalMin);
  const perItemExtra = Math.floor(extra / n);
  const remainder = extra % n;

  return items.map((it, i) => {
    const minW = minWidths[i];
    // Distribute extra space evenly, giving the remainder to the first few items
    const w = minW + perItemExtra + (i < remainder ? 1 : 0);
    return { ...it, w };
  });
}

export function rebalanceAll(layout: BentoLayoutItem[]): BentoLayoutItem[] {
  try {
    let result = [...layout];
    
    for (let r = 0; r < MAX_ROWS; r++) {
      // 1. Calculate space taken by spanners from previous rows
      const spanW = layout.filter(it => it.row < r && r < it.row + it.h).reduce((s, it) => s + it.w, 0);
      const avail = Math.max(0, HALF_COLS - spanW);
      
      // 2. Get native items for this row, sorted by order
      let natives = result.filter(it => it.row === r).sort((a, b) => a.order - b.order);
      
      // 3. Push items that don't fit (considering minW and MAX_PER_ROW)
      const getMinTotal = (items: BentoLayoutItem[]) => items.reduce((s, it) => s + (widgetRegistry[it.type]?.minW ?? 2), 0);
      
      while (natives.length > 0 && (natives.length > MAX_PER_ROW || getMinTotal(natives) > avail)) {
        const toPush = natives.pop()!;
        const idx = result.findIndex(it => it.i === toPush.i);
        if (idx !== -1) {
          // Push to next row, maintaining relative order (simplification: put at end)
          result[idx] = { ...toPush, row: r + 1, order: 99 }; 
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
    
    // Filter out anything pushed beyond MAX_ROWS
    // Instead of deleting, we keep them. validateLayout will catch them if they are off-grid.
    return result;
  } catch (e) {
    console.error("rebalanceAll crashed:", e);
    return layout;
  }
}

// ─── Compact (gravity) ────────────────────────────────────────────────────────

export function compactLayout(layout: BentoLayoutItem[]): BentoLayoutItem[] {
  const usedRows = [...new Set(layout.map(it => it.row))].sort((a, b) => a - b);
  const remap = new Map(usedRows.map((r, i) => [r, i]));
  return layout.map(it => ({ ...it, row: remap.get(it.row) ?? it.row }));
}

// ─── Swap ─────────────────────────────────────────────────────────────────────

export function calculateSwapLayout(
  layout: BentoLayoutItem[],
  draggedId: string,
  targetId: string
): BentoLayoutItem[] {
  const dragged = layout.find(it => it.i === draggedId);
  const target = layout.find(it => it.i === targetId);
  if (!dragged || !target) return layout;

   const result = layout.map(it => {
     if (it.i === draggedId) return { ...it, row: target.row, order: target.order };
     if (it.i === targetId) return { ...it, row: dragged.row, order: dragged.order };
     return it;
   });

  const rebalanced = rebalanceAll(result);

  if (!validateLayout(rebalanced).valid || rebalanced.length < layout.length) {
    return layout;
  }
  return rebalanced;
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
  // Find the widgets involved
  const topWidget = layout.find(it => it.i === topId);
  const bottomWidget = layout.find(it => it.i === bottomId);
  if (!topWidget || !bottomWidget) return layout;

  // Calculate delta in rows
  const delta = h0 - topWidget.h;
  if (delta === 0) return layout;

  const updated = layout.map(it => {
    // If it's the top widget, update height
    if (it.i === topId) return { ...it, h: h0 };
    // If it's the bottom widget, update height AND move down
    if (it.i === bottomId) return { ...it, row: it.row + delta, h: Math.max(1, h1) };
    return it;
  });

  // Rebalance to ensure grid invariants are maintained after height shift
  return rebalanceAll(updated);
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

    if (pos.w < minW || pos.h < minH) {
      return { valid: false, error: `Widget ${item.type} (${item.i}) is smaller than its minimum dimensions (${minW}x${minH})` };
    }

    if (pos.y < 0 || pos.y >= MAX_ROWS || pos.x < 0 || pos.x + pos.w > 6) {
      return { valid: false, error: `Widget ${item.i} is out of grid boundaries` };
    }
  }

  return { valid: true };
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
    
    const finalW = Math.max(0, Math.min(item.w, 6 - x));
    const finalH = Math.max(0, Math.min(item.h, MAX_ROWS - item.row));
    
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
      // Still set it so we don't crash, but w:0 will hide it in UI
      positions.set(item.i, { x, y: item.row, w: 0, h: 0 });
    }
  }
  return { positions, grid };
}
