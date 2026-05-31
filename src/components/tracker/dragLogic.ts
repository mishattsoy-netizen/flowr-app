import type { AppTask } from '@/data/store';

export type ColumnItems = Record<string, AppTask[]>;
export type Edge = 'top' | 'bottom';

/** The vertical extent of a rendered card, in viewport (client) coordinates. */
export type CardRect = { id: string; top: number; bottom: number };

/** The horizontal extent of a rendered column, in viewport coordinates. */
export type ColumnRect = { id: string; left: number; right: number };

/**
 * Resolve an insertion index from a pointer's Y position against the ordered
 * card rects of a column. A card "owns" everything above its vertical midpoint;
 * the inter-card gaps therefore resolve to the nearest adjacent card rather than
 * to the bottom of the column. Returns the append sentinel -1 only when the
 * pointer is genuinely below the last card's midpoint (or the column is empty).
 *
 * The returned index is against the array BEFORE the dragged item is removed —
 * the same convention used by `edgeToIndex` and `computeFinalColumns`.
 */
export function indexFromPointer(clientY: number, rects: CardRect[]): number {
  for (let i = 0; i < rects.length; i++) {
    const mid = (rects[i].top + rects[i].bottom) / 2;
    if (clientY < mid) return i;
  }
  return -1;
}

/**
 * The column a given X coordinate falls into, by horizontal span. We resolve
 * the destination from the dragged card's CENTER X (not the bare cursor), so
 * the gap follows where the card visually sits — the column it overlaps most —
 * rather than the cursor pixel, which is offset from the card by wherever it
 * was grabbed.
 *
 * Inside a column's span → that column. In a gap BETWEEN columns → the nearest
 * by center distance. But OUTSIDE the board entirely (left of the first column
 * or right of the last) → null, so the caller can fall back to the card's
 * origin: dragging out to the sidebar/header should return the drop-box home,
 * not snap it to the edge column. Returns null when there are no columns.
 */
export function columnIdFromX(centerX: number, columns: ColumnRect[]): string | null {
  if (columns.length === 0) return null;
  // Off the board entirely → no column (caller falls back to origin).
  const first = columns[0];
  const last = columns[columns.length - 1];
  if (centerX < first.left || centerX > last.right) return null;
  // Inside a column's span → that column.
  for (const col of columns) {
    if (centerX >= col.left && centerX <= col.right) return col.id;
  }
  // In a gap between columns → nearest by center distance.
  let best = columns[0];
  let bestDist = Infinity;
  for (const col of columns) {
    const mid = (col.left + col.right) / 2;
    const dist = Math.abs(centerX - mid);
    if (dist < bestDist) {
      bestDist = dist;
      best = col;
    }
  }
  return best.id;
}

export function findContainer(id: string, cols: ColumnItems): string | null {
  if (id in cols) return id;
  for (const key of Object.keys(cols)) {
    if (cols[key].find(item => item.id === id)) return key;
  }
  return null;
}

/**
 * Convert a drop on a target card into an insertion index within the target
 * column. `top` inserts before the target, `bottom` after it. A null edge means
 * the drop landed on the column body (not a card) → append sentinel -1.
 */
export function edgeToIndex(targetIndex: number | null, edge: Edge | null): number {
  if (targetIndex === null || edge === null) return -1;
  return edge === 'bottom' ? targetIndex + 1 : targetIndex;
}

/**
 * Produce the final column arrangement after dropping `activeId` into
 * `destColumn` at `destIndex` (or appended when destIndex === -1).
 * `destIndex` is interpreted against the destination array BEFORE removal of the
 * active item; same-column upward/downward shifts are handled here.
 * Returns the same `cols` reference when nothing changes.
 */
export function computeFinalColumns(
  cols: ColumnItems,
  activeId: string,
  destColumn: string,
  destIndex: number
): ColumnItems {
  const srcColumn = findContainer(activeId, cols);
  if (!srcColumn || !(destColumn in cols)) return cols;

  const srcItems = [...cols[srcColumn]];
  const srcIndex = srcItems.findIndex(i => i.id === activeId);
  if (srcIndex === -1) return cols;
  const [moved] = srcItems.splice(srcIndex, 1);

  // Destination array after the item was removed from the source.
  const destItems = srcColumn === destColumn ? srcItems : [...cols[destColumn]];

  // Resolve insert position. Append sentinel -1 → end.
  let insertAt = destIndex === -1 ? destItems.length : destIndex;
  // Same column, moving down: the removal shifted indices left by one.
  if (srcColumn === destColumn && destIndex !== -1 && srcIndex < destIndex) {
    insertAt = destIndex - 1;
  }
  insertAt = Math.max(0, Math.min(insertAt, destItems.length));

  // No-op detection: item ends exactly where it started.
  if (srcColumn === destColumn && insertAt === srcIndex) return cols;

  destItems.splice(insertAt, 0, moved);

  if (srcColumn === destColumn) {
    return { ...cols, [destColumn]: destItems };
  }
  return { ...cols, [srcColumn]: srcItems, [destColumn]: destItems };
}

export function getTaskImplicitPosition(task: AppTask): number {
  if (typeof task.position === 'number') {
    return task.position;
  }
  if (task.completed) {
    const time = task.completedAt ?? task.createdAt ?? 0;
    return -time;
  }
  return task.createdAt ?? 0;
}

export function getOrGeneratePositions(tasks: AppTask[]): number[] {
  if (tasks.length === 0) return [];

  const positions: number[] = new Array(tasks.length);

  // 1. Fill in existing manual or implicit positions
  for (let i = 0; i < tasks.length; i++) {
    if (typeof tasks[i].position === 'number') {
      positions[i] = tasks[i].position!;
    }
  }

  // 2. Interpolate/extrapolate missing positions
  let i = 0;
  while (i < tasks.length) {
    if (positions[i] !== undefined) {
      i++;
      continue;
    }

    // Find the end of this missing block
    let j = i;
    while (j < tasks.length && positions[j] === undefined) {
      j++;
    }

    // Missing block is from index i to j-1
    // Left position bound
    let leftPos: number;
    if (i > 0) {
      leftPos = positions[i - 1];
    } else {
      // If we are at the very beginning of the array, look at the first non-missing position at j
      const nextVal = j < tasks.length ? positions[j] : undefined;
      if (typeof nextVal === 'number') {
        leftPos = nextVal - (j - i + 1) * 1000;
      } else {
        // Entire array is missing, use implicit positions!
        leftPos = getTaskImplicitPosition(tasks[0]) - 1000;
      }
    }

    // Right position bound
    let rightPos: number;
    if (j < tasks.length) {
      rightPos = positions[j];
    } else {
      // If we are at the very end of the array, extrapolate from leftPos
      rightPos = leftPos + (j - i + 1) * 1000;
    }

    // Space the elements evenly between leftPos and rightPos
    const count = j - i;
    const step = (rightPos - leftPos) / (count + 1);
    for (let k = 0; k < count; k++) {
      positions[i + k] = leftPos + step * (k + 1);
    }

    i = j;
  }

  return positions;
}

/**
 * Compute a `position` for a card being dropped at `destIndex` in `ordered`
 * (the destination column already arranged in the desired visual order, INCLUDING
 * the moved card at destIndex; -1 means appended at the end). The position is
 * chosen strictly between the EFFECTIVE positions (`getTaskImplicitPosition`,
 * which honours explicit `position` and falls back to `createdAt`) of the cards
 * on either side — so the drop lands correctly even next to never-dragged,
 * createdAt-only neighbours. Neighbours are skipped over the moved card itself.
 */
export function positionForDrop(ordered: AppTask[], movedId: string, destIndex: number): number {
  const movedIdx = destIndex === -1 ? ordered.length - 1 : destIndex;
  const neighbours = ordered.filter(t => t.id !== movedId);
  // The moved card sits between neighbour (movedIdx-1) and neighbour (movedIdx)
  // in the neighbour-only array.
  const before = movedIdx - 1 >= 0 ? neighbours[movedIdx - 1] : undefined;
  const after = movedIdx < neighbours.length ? neighbours[movedIdx] : undefined;

  const beforePos = before ? getTaskImplicitPosition(before) : undefined;
  const afterPos = after ? getTaskImplicitPosition(after) : undefined;

  if (beforePos === undefined && afterPos === undefined) return 0;  // empty column
  if (beforePos === undefined) return afterPos! - 1000;             // dropped at top
  if (afterPos === undefined) return beforePos + 1000;              // dropped at bottom
  if (afterPos > beforePos) {
    // Midpoint, unless the gap is too small for float precision to represent a
    // value strictly between the neighbours (only reachable after very many
    // drops into the exact same sub-unit gap). In that rare case there's no
    // numeric room; return the midpoint anyway — the displayed order is still
    // resolved deterministically by the id tiebreak in buildColumns.
    return beforePos + (afterPos - beforePos) / 2;
  }
  // Neighbours out of numeric order (explicit position sitting out of createdAt
  // order): place just above the `before` neighbour so visual order is kept.
  return beforePos + 1;
}
