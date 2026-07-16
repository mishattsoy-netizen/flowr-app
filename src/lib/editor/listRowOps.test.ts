import { describe, it, expect } from 'vitest';
import {
  insertRowAfter,
  unindentRow,
  indentRow,
  mergeRowIntoPrevious,
  removeEmptyRow,
  removeEmptyTrailingRow,
  type ListRow,
} from './listRowOps';

// row[0] is always the list BLOCK itself (matches ListBlock.tsx's flattenRows).
const fixture = (): ListRow[] => [
  { id: 'blk-list', content: '', depth: 0 },
  { id: 'r1', content: 'First', depth: 0 },
  { id: 'r2', content: 'Second', depth: 0 },
  { id: 'r3', content: 'Third', depth: 0 },
];

describe('insertRowAfter', () => {
  it('inserts a new row immediately after the given id, same depth semantics preserved', () => {
    const r = insertRowAfter(fixture(), 'r1', { id: 'new', content: '', depth: 0 });
    expect(r.map(x => x.id)).toEqual(['blk-list', 'r1', 'new', 'r2', 'r3']);
  });

  it('returns input unchanged if the id is not found', () => {
    const input = fixture();
    expect(insertRowAfter(input, 'nope', { id: 'new', content: '', depth: 0 })).toEqual(input);
  });
});

describe('unindentRow', () => {
  it('decreases depth by one', () => {
    const rows = [fixture()[0], { id: 'r1', content: 'x', depth: 1 }];
    const r = unindentRow(rows, 'r1');
    expect(r[1].depth).toBe(0);
  });

  it('does nothing at depth 0', () => {
    const input = fixture();
    expect(unindentRow(input, 'r1')).toEqual(input);
  });
});

describe('indentRow', () => {
  it('increases depth by one when the previous row allows it', () => {
    const r = indentRow(fixture(), 'r2'); // prev row r1 is depth 0, so max is 1
    expect(r.find(x => x.id === 'r2')?.depth).toBe(1);
  });

  it('caps at previous row depth + 1 (cannot skip a level)', () => {
    // r1 depth 0, r2 depth 0 -> indenting r2 twice should still cap at 1
    let rows = indentRow(fixture(), 'r2');
    rows = indentRow(rows, 'r2');
    expect(rows.find(x => x.id === 'r2')?.depth).toBe(1); // capped, not 2
  });

  it('cannot indent the first row (idx 0, the block itself)', () => {
    const input = fixture();
    expect(indentRow(input, 'blk-list')).toEqual(input);
  });
});

describe('mergeRowIntoPrevious', () => {
  it('merges content into the previous row and removes this row', () => {
    const r = mergeRowIntoPrevious(fixture(), 'r2');
    expect(r.map(x => x.id)).toEqual(['blk-list', 'r1', 'r3']);
    expect(r[1].content).toBe('FirstSecond');
  });

  it('merges the first actual row into the BLOCK row (idx 0) — verified against ListBlock.tsx: rowIndex 0 is the block itself, rendered as a normal row, so "no previous row" only applies when idx is truly 0', () => {
    const r = mergeRowIntoPrevious(fixture(), 'r1');
    expect(r.map(x => x.id)).toEqual(['blk-list', 'r2', 'r3']);
    expect(r[0].content).toBe('First'); // '' (block) + 'First' (r1)
  });

  it('does nothing when the target IS the block row (idx 0, nothing before it)', () => {
    const input = fixture();
    expect(mergeRowIntoPrevious(input, 'blk-list')).toEqual(input);
  });
});

describe('removeEmptyRow', () => {
  it('unindents instead of removing when depth > 0', () => {
    const rows = [fixture()[0], { id: 'r1', content: '', depth: 1 }, fixture()[2]];
    const r = removeEmptyRow(rows, 'r1');
    expect(r).not.toBeNull();
    expect(r!.find(x => x.id === 'r1')?.depth).toBe(0);
  });

  it('signals exit-list (null) when it is the ONLY item row at depth 0', () => {
    const rows = [fixture()[0], { id: 'r1', content: '', depth: 0 }];
    expect(removeEmptyRow(rows, 'r1')).toBeNull();
  });

  it('removes the row when it is the first item but others remain', () => {
    const r = removeEmptyRow(fixture(), 'r1');
    expect(r).not.toBeNull();
    expect(r!.map(x => x.id)).toEqual(['blk-list', 'r2', 'r3']);
  });

  it('removes a middle empty row', () => {
    const r = removeEmptyRow(fixture(), 'r2');
    expect(r).not.toBeNull();
    expect(r!.map(x => x.id)).toEqual(['blk-list', 'r1', 'r3']);
  });
});

describe('removeEmptyTrailingRow', () => {
  it('removes the trailing row when other rows remain', () => {
    const r = removeEmptyTrailingRow(fixture(), 'r3');
    expect(r).not.toBeNull();
    expect(r!.map(x => x.id)).toEqual(['blk-list', 'r1', 'r2']);
  });

  it('signals exit-list (null) when removing the only remaining row', () => {
    const rows = [fixture()[0], { id: 'r1', content: '', depth: 0 }];
    expect(removeEmptyTrailingRow(rows, 'r1')).toBeNull();
  });
});
