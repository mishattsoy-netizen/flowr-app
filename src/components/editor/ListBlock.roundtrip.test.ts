import { describe, it, expect } from 'vitest';
import { flattenRows, nestRows } from './ListBlock';
import type { EditorBlock } from '@/data/store';

// A numberedList item whose sub-points are bulletList children — the exact
// shape the markdown parser produces for "1. Foo\n   * bar". Before the fix,
// flattenRows dropped each row's type and RowEl rendered the bullet children
// as spurious "2." numbers; nestRows then re-homogenized them to numberedList
// on the first edit, making the regression permanent.
const mixed: EditorBlock = {
  id: 'blk',
  type: 'numberedList',
  content: 'The Avalanche Effect',
  children: [
    { id: 'c1', type: 'bulletList', content: 'Example: Oct 24' },
    { id: 'c2', type: 'bulletList', content: 'The Mistake: over-trading' },
  ],
};

describe('flattenRows preserves each row\'s own type', () => {
  it('carries the bulletList children through as bulletList rows', () => {
    const rows = flattenRows(mixed);
    expect(rows).toHaveLength(3);
    expect(rows[0].type).toBe('numberedList'); // the block itself
    expect(rows[1].type).toBe('bulletList');
    expect(rows[2].type).toBe('bulletList');
  });
});

describe('nestRows round-trips mixed types without homogenizing', () => {
  it('keeps bulletList children bulletList after a flatten→nest cycle', () => {
    const rows = flattenRows(mixed);
    const rebuilt = nestRows(rows, 'numberedList');
    expect(rebuilt.children).toHaveLength(2);
    expect(rebuilt.children.every(c => c.type === 'bulletList')).toBe(true);
  });
});
