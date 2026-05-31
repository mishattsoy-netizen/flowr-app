import { describe, it, expect } from 'vitest';
import type { AppTask } from '@/data/store';
import {
  findContainer,
  edgeToIndex,
  computeFinalColumns,
  indexFromPointer,
  columnIdFromX,
  getOrGeneratePositions,
  getTaskImplicitPosition,
  type ColumnItems,
  type CardRect,
  type ColumnRect,
} from './dragLogic';

const t = (id: string, extra: Partial<AppTask> = {}): AppTask =>
  ({ id, title: id, completed: false, ...extra } as AppTask);

// Replicates commitDrop's position assignment: clear the moved task's position,
// regenerate, and read the moved index's value.
const assignPositionAt = (order: AppTask[], movedId: string): number => {
  const idx = order.findIndex(x => x.id === movedId);
  const cleared = order.map(x => (x.id === movedId ? { ...x, position: undefined } : x));
  return getOrGeneratePositions(cleared)[idx];
};

// Replicates buildColumns' sort (position/implicit, id tiebreak).
const sortByPosition = (tasks: AppTask[]): AppTask[] =>
  [...tasks].sort((a, b) => {
    const pa = getTaskImplicitPosition(a);
    const pb = getTaskImplicitPosition(b);
    return pa !== pb ? pa - pb : a.id.localeCompare(b.id);
  });

describe('findContainer', () => {
  it('finds the column key by container id', () => {
    const cols: ColumnItems = { todo: [t('a')], done: [] };
    expect(findContainer('todo', cols)).toBe('todo');
  });
  it('finds the column key by an item id', () => {
    const cols: ColumnItems = { todo: [t('a')], done: [t('x')] };
    expect(findContainer('x', cols)).toBe('done');
  });
  it('returns null when not found', () => {
    expect(findContainer('nope', { todo: [] })).toBeNull();
  });
});

describe('edgeToIndex', () => {
  it('top edge → the target index', () => {
    expect(edgeToIndex(2, 'top')).toBe(2);
  });
  it('bottom edge → after the target', () => {
    expect(edgeToIndex(2, 'bottom')).toBe(3);
  });
  it('null edge (dropped on column body) → append sentinel -1', () => {
    expect(edgeToIndex(null, null)).toBe(-1);
  });
});

describe('computeFinalColumns', () => {
  it('moves a card within the same column (down)', () => {
    const cols: ColumnItems = { todo: [t('a'), t('b'), t('c')], done: [] };
    // move 'a' to bottom edge of 'c' (index 2, bottom → 3)
    const next = computeFinalColumns(cols, 'a', 'todo', 3);
    expect(next.todo.map(i => i.id)).toEqual(['b', 'c', 'a']);
  });

  it('moves a card within the same column (up)', () => {
    const cols: ColumnItems = { todo: [t('a'), t('b'), t('c')], done: [] };
    // move 'c' to top edge of 'a' (index 0)
    const next = computeFinalColumns(cols, 'c', 'todo', 0);
    expect(next.todo.map(i => i.id)).toEqual(['c', 'a', 'b']);
  });

  it('moves a card to another column at an index', () => {
    const cols: ColumnItems = { todo: [t('a'), t('b')], done: [t('x'), t('y')] };
    const next = computeFinalColumns(cols, 'a', 'done', 1);
    expect(next.todo.map(i => i.id)).toEqual(['b']);
    expect(next.done.map(i => i.id)).toEqual(['x', 'a', 'y']);
  });

  it('appends to a column when index is the append sentinel -1', () => {
    const cols: ColumnItems = { todo: [t('a')], done: [] };
    const next = computeFinalColumns(cols, 'a', 'done', -1);
    expect(next.todo.map(i => i.id)).toEqual([]);
    expect(next.done.map(i => i.id)).toEqual(['a']);
  });

  it('no-op when dropping a card at its own position', () => {
    const cols: ColumnItems = { todo: [t('a'), t('b')], done: [] };
    // 'a' at index 0, top edge of itself → index 0 → unchanged
    const next = computeFinalColumns(cols, 'a', 'todo', 0);
    expect(next).toBe(cols);
  });
});

describe('indexFromPointer', () => {
  // Three 100px-tall cards stacked with a 12px gap between them.
  // a: 0..100 (mid 50), b: 112..212 (mid 162), c: 224..324 (mid 274)
  const rects: CardRect[] = [
    { id: 'a', top: 0, bottom: 100 },
    { id: 'b', top: 112, bottom: 212 },
    { id: 'c', top: 224, bottom: 324 },
  ];

  it('above the first card midpoint → before the first card (index 0)', () => {
    expect(indexFromPointer(10, rects)).toBe(0);
  });

  it('in the gap between cards resolves to the nearest edge, not the bottom', () => {
    // y=106 is in the 100..112 gap, below a.mid(50) and above b.mid(162)
    // → insert before b (index 1), NOT append (-1).
    expect(indexFromPointer(106, rects)).toBe(1);
  });

  it('below a card midpoint but above the next → after that card', () => {
    // y=80 is below a.mid(50), above b.mid(162) → before b (index 1)
    expect(indexFromPointer(80, rects)).toBe(1);
  });

  it('below the last card midpoint → append sentinel -1', () => {
    expect(indexFromPointer(300, rects)).toBe(-1);
  });

  it('empty column → append sentinel -1', () => {
    expect(indexFromPointer(50, [])).toBe(-1);
  });
});

describe('columnIdFromX', () => {
  // Three 300px columns with 12px gaps:
  // todo: 0..300, inProgress: 312..612, today: 624..924
  const cols: ColumnRect[] = [
    { id: 'todo', left: 0, right: 300 },
    { id: 'inProgress', left: 312, right: 612 },
    { id: 'today', left: 624, right: 924 },
  ];

  it('center inside a column span → that column', () => {
    expect(columnIdFromX(150, cols)).toBe('todo');
    expect(columnIdFromX(450, cols)).toBe('inProgress');
  });

  it('center just past a column boundary picks the column it has crossed into', () => {
    // 306 is in the 300..312 between-columns gap, nearer inProgress mid(462)?
    // No — nearer todo mid(150) by distance, BUT 306 is closer to the 300/312
    // edges; nearest-center wins → todo (|306-150|=156 vs |306-462|=156 tie→first).
    // The meaningful case: 320 is inside inProgress span → inProgress.
    expect(columnIdFromX(320, cols)).toBe('inProgress');
  });

  it('center in the between-column gap snaps to the nearest column center', () => {
    // 308 is in 300..312 gap; |308-150|=158 (todo) vs |308-462|=154 (inProgress)
    expect(columnIdFromX(308, cols)).toBe('inProgress');
  });

  it('center left of all columns (e.g. over the sidebar) → null, so the caller restores origin', () => {
    expect(columnIdFromX(-50, cols)).toBeNull();
  });

  it('center right of all columns (off the board) → null', () => {
    expect(columnIdFromX(2000, cols)).toBeNull();
  });

  it('center exactly on the outer edges still counts as on-board', () => {
    expect(columnIdFromX(0, cols)).toBe('todo');     // first.left
    expect(columnIdFromX(924, cols)).toBe('today');  // last.right
  });

  it('returns null when there are no columns', () => {
    expect(columnIdFromX(100, [])).toBeNull();
  });
});

describe('drop position assignment (commitDrop fractional indexing)', () => {
  it('placing a card before index i lands it before that card after re-sort', () => {
    // Start: three cards with spaced positions.
    let order = [
      t('a', { position: 1000 }),
      t('b', { position: 2000 }),
      t('c', { position: 3000 }),
    ];
    // Move 'c' to the top (index 0).
    order = [order[2], order[0], order[1]];
    const pos = assignPositionAt(order, 'c');
    const resorted = sortByPosition([
      t('a', { position: 1000 }),
      t('b', { position: 2000 }),
      t('c', { position: pos }),
    ]);
    expect(resorted.map(x => x.id)).toEqual(['c', 'a', 'b']);
  });

  it('repeatedly inserting into the SAME gap keeps a strict, correct order (no precision collapse)', () => {
    // This is the intermittent "doesn't drop where the box showed" suspect:
    // fractional midpoints between two fixed neighbors shrink toward float
    // epsilon and eventually collide, after which the id tiebreak — not the
    // drop slot — decides order.
    const left = t('L', { position: 0 });
    const right = t('R', { position: 1000 });
    // Each iteration drops a fresh card BETWEEN L and R (just before R).
    let movers: AppTask[] = [];
    for (let i = 0; i < 60; i++) {
      const id = `m${String(i).padStart(3, '0')}`;
      // Desired visual order: L, ...previous movers..., newMover, R
      const order = [left, ...movers, t(id), right];
      const pos = assignPositionAt(order, id);
      movers.push(t(id, { position: pos }));
      // After re-sort, the just-inserted card must be immediately before R
      // and after the previous mover — i.e. last among movers, before R.
      const resorted = sortByPosition([left, right, ...movers]);
      const ids = resorted.map(x => x.id);
      expect(ids[0]).toBe('L');
      expect(ids[ids.length - 1]).toBe('R');
      // The newest mover should sit just before R.
      expect(ids[ids.length - 2]).toBe(id);
    }
  });
});
