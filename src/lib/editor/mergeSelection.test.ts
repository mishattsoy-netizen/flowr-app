import { describe, it, expect } from 'vitest';
import { mergeAcrossBlocks, type BlockSelection, type SurvivingHtml } from './mergeSelection';
import type { EditorBlock } from '@/data/store.types';

/**
 * NOTE ON THE REAL DATA MODEL: this editor has no `heading1` block type.
 * Headings are `type: 'text'` carrying a `style` of 'title' | 'heading' |
 * 'subheading' | 'body' | 'mono' (see store.types.ts). So "the first block's
 * type wins" means its `style` must survive too — otherwise merging into a
 * title would silently demote it to body text.
 */
const b = (
  id: string,
  content: string,
  style?: EditorBlock['style'],
  type: EditorBlock['type'] = 'text',
): EditorBlock => ({ id, type, content, style } as EditorBlock);

// The spec's worked example: title / body paragraph / subheading
const doc = (): EditorBlock[] => [
  b('h1', 'My Great Title', 'title'),
  b('p', 'Some paragraph text here', 'body'),
  b('h2', 'Another subheading', 'subheading'),
];

const sel = (s: string, so: number, e: string, eo: number): BlockSelection =>
  ({ startBlockId: s, startOffset: so, endBlockId: e, endOffset: eo });

/**
 * Test helper standing in for the caller's DOM slicing. In production, the
 * editor calls sliceHtmlByTextOffset (domSelection.ts) to produce these.
 * These fixtures are plain text, so a plain-text slice is the equivalent.
 */
const surv = (blocks: EditorBlock[], s: BlockSelection): SurvivingHtml => {
  const aIdx = blocks.findIndex(x => x.id === s.startBlockId);
  const bIdx = blocks.findIndex(x => x.id === s.endBlockId);
  if (aIdx === -1 || bIdx === -1) return { headHtml: '', tailHtml: '' };
  const fwd = aIdx < bIdx;
  const first = blocks[fwd ? aIdx : bIdx];
  const last = blocks[fwd ? bIdx : aIdx];
  const headOffset = fwd ? s.startOffset : s.endOffset;
  const tailOffset = fwd ? s.endOffset : s.startOffset;
  return {
    headHtml: first.content.slice(0, headOffset),
    tailHtml: last.content.slice(tailOffset),
  };
};

/** Merge using the fixture's own surviving slices. */
const merge = (blocks: EditorBlock[], s: BlockSelection, insert: string) =>
  mergeAcrossBlocks(blocks, s, insert, surv(blocks, s));

// Offsets below are exact. `'My Great Title'.slice(0, 8) === 'My Great'` and
// `'Another subheading'.slice(7) === ' subheading'` (offset 7 keeps the leading
// space; offset 8 would give 'subheading' with none). Verified by running the
// algorithm — do not "correct" them by eye.

describe('mergeAcrossBlocks — the worked example', () => {
  it('typing X over an H1→H2 selection leaves one H1, cursor at the seam', () => {
    const r = merge(doc(), sel('h1', 8, 'h2', 7), 'X');

    expect(r.blocks).toHaveLength(1);
    expect(r.blocks[0].style).toBe('title');         // first block's style wins
    expect(r.blocks[0].id).toBe('h1');               // first block's identity wins
    expect(r.blocks[0].content).toBe('My GreatX subheading');
    expect(r.cursorBlockId).toBe('h1');
    expect(r.cursorOffset).toBe(9);                  // after "My Great" + "X"
  });

  it('deleting the same selection leaves one H1 with no X', () => {
    const r = merge(doc(), sel('h1', 8, 'h2', 7), '');

    expect(r.blocks).toHaveLength(1);
    expect(r.blocks[0].style).toBe('title');
    expect(r.blocks[0].content).toBe('My Great subheading');
    expect(r.cursorOffset).toBe(8);                  // at the seam
  });
});

describe('mergeAcrossBlocks — document order', () => {
  it('is identical whether dragged top-to-bottom or bottom-to-top', () => {
    const forward  = merge(doc(), sel('h1', 8, 'h2', 7), 'X');
    const backward = merge(doc(), sel('h2', 7, 'h1', 8), 'X');

    expect(backward.blocks).toEqual(forward.blocks);
    expect(backward.cursorBlockId).toBe(forward.cursorBlockId);
    expect(backward.cursorOffset).toBe(forward.cursorOffset);
  });
});

describe('mergeAcrossBlocks — partial coverage', () => {
  it('partial first block, whole last block', () => {
    const r = merge(doc(), sel('h1', 8, 'h2', 18), '');
    expect(r.blocks).toHaveLength(1);
    expect(r.blocks[0].content).toBe('My Great');   // last block fully consumed
    expect(r.cursorOffset).toBe(8);
  });

  it('whole first block, partial last block', () => {
    const r = merge(doc(), sel('h1', 0, 'h2', 8), '');
    expect(r.blocks).toHaveLength(1);
    expect(r.blocks[0].style).toBe('title');         // still the FIRST block's style
    expect(r.blocks[0].content).toBe('subheading');
    expect(r.cursorOffset).toBe(0);
  });

  it('adjacent blocks with nothing between them', () => {
    const r = merge(doc(), sel('h1', 8, 'p', 4), '');
    expect(r.blocks).toHaveLength(2);               // h1(merged) + h2 survives
    expect(r.blocks[0].content).toBe('My Great paragraph text here');
    expect(r.blocks[1].id).toBe('h2');
  });

  it('deletes every fully-selected block in between', () => {
    const four = [...doc(), b('h3', 'tail block', 'body')];
    const r = merge(four, sel('h1', 8, 'h3', 4), '');
    expect(r.blocks).toHaveLength(1);
    expect(r.blocks[0].content).toBe('My Great block');   // 'tail block'.slice(4) === ' block'
  });
});

describe('mergeAcrossBlocks — select all', () => {
  it('leaves one empty block of the first block type', () => {
    const r = merge(doc(), sel('h1', 0, 'h2', 18), '');
    expect(r.blocks).toHaveLength(1);
    expect(r.blocks[0].style).toBe('title');
    expect(r.blocks[0].content).toBe('');
    expect(r.cursorOffset).toBe(0);
  });
});

describe('mergeAcrossBlocks — guards', () => {
  it('returns input unchanged when the selection is within one block', () => {
    const input = doc();
    const r = merge(input, sel('p', 2, 'p', 6), 'X');
    expect(r.blocks).toEqual(input);
  });

  it('returns input unchanged when a block id is not in the top-level list', () => {
    const input = doc();
    const r = merge(input, sel('h1', 0, 'nope', 3), 'X');
    expect(r.blocks).toEqual(input);
  });

  it('preserves other block properties on the surviving block', () => {
    const styled = [
      { ...b('h1', 'My Great Title', 'title'), bgColor: '#ff0000', align: 'center' } as EditorBlock,
      b('p', 'Some paragraph text here', 'body'),
    ];
    const r = merge(styled, sel('h1', 8, 'p', 4), '');
    expect(r.blocks[0].bgColor).toBe('#ff0000');
    expect(r.blocks[0].align).toBe('center');
  });
});

describe('mergeAcrossBlocks — inline formatting must survive', () => {
  // The point of SurvivingHtml. Bold/links in text the user NEVER SELECTED
  // must not be destroyed by an edit somewhere else. Losing them is data loss.
  it('keeps bold in the unselected head of the first block', () => {
    const blocks = [
      b('h1', 'Some <b>bold</b> title here', 'title'),   // text: "Some bold title here"
      b('p', 'paragraph', 'body'),
      b('h2', 'Another subheading', 'subheading'),
    ];
    // Select from offset 16 in h1 (start of "here") through to offset 7 in h2.
    const r = mergeAcrossBlocks(
      blocks,
      sel('h1', 16, 'h2', 7),
      '',
      { headHtml: 'Some <b>bold</b> title ', tailHtml: ' subheading' },
    );

    expect(r.blocks).toHaveLength(1);
    expect(r.blocks[0].content).toBe('Some <b>bold</b> title  subheading');
    expect(r.blocks[0].content).toContain('<b>bold</b>');   // NOT flattened to plain text
  });

  it('keeps a link in the unselected tail of the last block', () => {
    const blocks = [
      b('h1', 'Title', 'title'),
      b('p', 'gone', 'body'),
      b('h2', 'see <a href="/x">the docs</a>', 'subheading'),
    ];
    const r = mergeAcrossBlocks(
      blocks,
      sel('h1', 5, 'h2', 4),
      '',
      { headHtml: 'Title', tailHtml: '<a href="/x">the docs</a>' },
    );

    expect(r.blocks[0].content).toBe('Title<a href="/x">the docs</a>');
    expect(r.blocks[0].content).toContain('href="/x"');
  });

  it('escapes typed text so it cannot inject markup', () => {
    const r = mergeAcrossBlocks(
      doc(),
      sel('h1', 8, 'h2', 7),
      '<script>',
      { headHtml: 'My Great', tailHtml: ' subheading' },
    );
    expect(r.blocks[0].content).toBe('My Great&lt;script&gt; subheading');
  });

  it('places the cursor by plain-text length, ignoring tags in the head', () => {
    const r = mergeAcrossBlocks(
      [b('a', '<b>Bold</b> tail', 'body'), b('c', 'second', 'body')],
      sel('a', 9, 'c', 3),
      'X',
      { headHtml: '<b>Bold</b> ', tailHtml: 'ond' },   // head plain text = "Bold " = 5 chars
    );
    expect(r.cursorOffset).toBe(6);                    // 5 + len("X")
  });
});
