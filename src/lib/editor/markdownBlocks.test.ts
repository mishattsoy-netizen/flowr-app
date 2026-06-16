import { describe, it, expect } from 'vitest';
import {
  looksLikeMarkdown,
  parseMarkdownToBlocks,
  blocksToMarkdown,
  normalizeBlocks,
  formatCounter,
} from './markdownBlocks';

// ── formatCounter ──────────────────────────────────────
describe('formatCounter', () => {
  it('arabic: 1→"1", 26→"26"', () => {
    expect(formatCounter(1, 'arabic')).toBe('1');
    expect(formatCounter(26, 'arabic')).toBe('26');
  });

  it('alpha: 1→"a", 26→"z", 27→"aa"', () => {
    expect(formatCounter(1, 'alpha')).toBe('a');
    expect(formatCounter(26, 'alpha')).toBe('z');
    expect(formatCounter(27, 'alpha')).toBe('aa');
  });

  it('roman: 1→"i", 4→"iv", 9→"ix", 14→"xiv"', () => {
    expect(formatCounter(1, 'roman')).toBe('i');
    expect(formatCounter(4, 'roman')).toBe('iv');
    expect(formatCounter(9, 'roman')).toBe('ix');
    expect(formatCounter(14, 'roman')).toBe('xiv');
  });
});

// ── looksLikeMarkdown ─────────────────────────────────
describe('looksLikeMarkdown', () => {
  it('returns true for two bullet lines', () => {
    expect(looksLikeMarkdown('- item one\n- item two')).toBe(true);
  });

  it('returns true for a numbered list', () => {
    expect(looksLikeMarkdown('1. first\n2. second')).toBe(true);
  });

  it('returns true for checklist', () => {
    expect(looksLikeMarkdown('[ ] todo\n[x] done')).toBe(true);
  });

  it('returns true for indented nested bullets', () => {
    expect(looksLikeMarkdown('- parent\n  - child')).toBe(true);
  });

  it('returns false for plain prose with a single hyphen', () => {
    expect(looksLikeMarkdown('Hello - world, how are you today?')).toBe(false);
  });

  it('returns false for a single empty string', () => {
    expect(looksLikeMarkdown('')).toBe(false);
  });

  it('returns false when fewer than 2 markdown-pattern lines are found (single bullet)', () => {
    expect(looksLikeMarkdown('- only one item')).toBe(false);
  });
});

describe('parseMarkdownToBlocks — tables', () => {
  const tableMd = [
    '| Day | Focus | Time split |',
    '|-----|-------|------------|',
    '| **Thu 21** | Math fundamentals | ~4h |',
    '| Fri 22 | Math practice | ~4h |',
  ].join('\n');

  it('parses a pipe table into a single table block, dropping the separator row', () => {
    const blocks = parseMarkdownToBlocks(tableMd);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('table');
    expect(blocks[0].tableData).toEqual([
      ['Day', 'Focus', 'Time split'],
      ['<strong>Thu 21</strong>', 'Math fundamentals', '~4h'],
      ['Fri 22', 'Math practice', '~4h'],
    ]);
  });

  it('does not eat the table separator row as text', () => {
    const blocks = parseMarkdownToBlocks(tableMd);
    expect(blocks.some(b => b.type === 'text' && /---/.test(b.content))).toBe(false);
  });

  it('pads short rows to the widest column count', () => {
    const md = '| a | b | c |\n| --- | --- | --- |\n| 1 | 2 |';
    const blocks = parseMarkdownToBlocks(md);
    expect(blocks[0].tableData?.[1]).toEqual(['1', '2', '']);
  });

  it('round-trips a table through blocksToMarkdown', () => {
    const blocks = parseMarkdownToBlocks(tableMd);
    const md = blocksToMarkdown(blocks);
    const reparsed = parseMarkdownToBlocks(md);
    expect(reparsed[0].tableData).toEqual(blocks[0].tableData);
  });

  it('does not treat a single prose line with a trailing pipe as a table', () => {
    const blocks = parseMarkdownToBlocks('just some text\nmore text');
    expect(blocks.every(b => b.type !== 'table')).toBe(true);
  });
});

// ── parseMarkdownToBlocks ─────────────────────────────
describe('parseMarkdownToBlocks', () => {
  it('empty string returns empty array', () => {
    expect(parseMarkdownToBlocks('')).toEqual([]);
  });

  it('parses headings', () => {
    const blocks = parseMarkdownToBlocks('# Title\n## Heading\n### Sub');
    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toMatchObject({ type: 'text', style: 'title' });
    expect(blocks[1]).toMatchObject({ type: 'text', style: 'heading' });
    expect(blocks[2]).toMatchObject({ type: 'text', style: 'subheading' });
  });

  it('parses bullet list', () => {
    const blocks = parseMarkdownToBlocks('- alpha\n- beta');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ type: 'bulletList', content: 'alpha' });
    expect(blocks[1]).toMatchObject({ type: 'bulletList', content: 'beta' });
  });

  it('parses numbered list', () => {
    const blocks = parseMarkdownToBlocks('1. first\n2. second');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ type: 'numberedList', content: 'first' });
    expect(blocks[1]).toMatchObject({ type: 'numberedList', content: 'second' });
  });

  it('parses checklist with checked state', () => {
    const blocks = parseMarkdownToBlocks('[ ] todo\n[x] done');
    expect(blocks[0]).toMatchObject({ type: 'checklist', checked: false });
    expect(blocks[1]).toMatchObject({ type: 'checklist', checked: true });
  });

  it('parses checklist with bullet, dash, or plus prefixes and case-insensitive check state', () => {
    const blocks = parseMarkdownToBlocks('- [ ] todo 1\n* [x] done 2\n+ [X] done 3');
    expect(blocks[0]).toMatchObject({ type: 'checklist', checked: false, content: 'todo 1' });
    expect(blocks[1]).toMatchObject({ type: 'checklist', checked: true, content: 'done 2' });
    expect(blocks[2]).toMatchObject({ type: 'checklist', checked: true, content: 'done 3' });
  });

  it('parses quote', () => {
    const blocks = parseMarkdownToBlocks('> A quoted line');
    expect(blocks[0]).toMatchObject({ type: 'quote', content: 'A quoted line' });
  });

  it('parses divider', () => {
    const blocks = parseMarkdownToBlocks('---');
    expect(blocks[0]).toMatchObject({ type: 'divider' });
  });

  it('parses fenced code block', () => {
    const blocks = parseMarkdownToBlocks('```\nconst x = 1;\n```');
    expect(blocks[0]).toMatchObject({ type: 'text', style: 'mono' });
  });

  it('produces nested children for indented bullets (2 spaces)', () => {
    const blocks = parseMarkdownToBlocks('- parent\n  - child');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].children).toHaveLength(1);
    expect(blocks[0].children![0]).toMatchObject({ type: 'bulletList' });
  });

  it('produces nested children for indented bullets (tab)', () => {
    const blocks = parseMarkdownToBlocks('- parent\n\t- child');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].children).toHaveLength(1);
  });

  it('3-level nesting', () => {
    const md = '- L1\n  - L2\n    - L3';
    const blocks = parseMarkdownToBlocks(md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].children).toHaveLength(1);
    expect(blocks[0].children![0].children).toHaveLength(1);
  });

  it('converts **bold** to <strong>', () => {
    const blocks = parseMarkdownToBlocks('- **bold** text');
    expect(blocks[0].content).toBe('<strong>bold</strong> text');
  });

  it('converts *italic* to <em>', () => {
    const blocks = parseMarkdownToBlocks('- *italic*');
    expect(blocks[0].content).toBe('<em>italic</em>');
  });

  it('converts `code` to <code>', () => {
    const blocks = parseMarkdownToBlocks('- `snippet`');
    expect(blocks[0].content).toBe('<code>snippet</code>');
  });

  it('converts [text](url) to <a>', () => {
    const blocks = parseMarkdownToBlocks('- [click](https://example.com)');
    expect(blocks[0].content).toBe('<a href="https://example.com">click</a>');
  });

  it('assigns unique ids to all blocks', () => {
    const blocks = parseMarkdownToBlocks('- a\n- b\n- c');
    const ids = blocks.map(b => b.id);
    expect(new Set(ids).size).toBe(3);
  });
});

// ── blocksToMarkdown ──────────────────────────────────
describe('blocksToMarkdown', () => {
  it('empty array returns empty string', () => {
    expect(blocksToMarkdown([])).toBe('');
  });

  it('serializes bullet list', () => {
    const blocks = parseMarkdownToBlocks('- alpha\n- beta');
    expect(blocksToMarkdown(blocks)).toBe('- alpha\n- beta');
  });

  it('serializes numbered list with incrementing numbers', () => {
    const blocks = parseMarkdownToBlocks('1. first\n2. second');
    expect(blocksToMarkdown(blocks)).toBe('1. first\n2. second');
  });

  it('serializes nested list with 2-space indentation', () => {
    const blocks = parseMarkdownToBlocks('- parent\n  - child');
    expect(blocksToMarkdown(blocks)).toBe('- parent\n  - child');
  });

  it('serializes headings', () => {
    const blocks = parseMarkdownToBlocks('# Title');
    expect(blocksToMarkdown(blocks)).toBe('# Title');
  });

  it('serializes a hand-constructed bulletList block', () => {
    const block = { id: 'test-1', type: 'bulletList' as const, content: 'hello world' };
    expect(blocksToMarkdown([block])).toBe('- hello world');
  });
});

// ── normalizeBlocks ───────────────────────────────────
describe('normalizeBlocks', () => {
  it('assigns ids to blocks missing them', () => {
    const result = normalizeBlocks([{ type: 'bulletList', content: 'hi' }]);
    expect(result[0].id).toBeTruthy();
  });

  it('drops unknown type', () => {
    const result = normalizeBlocks([{ type: 'bulletList', content: 'ok' }, { type: 'unknownType' as any }]);
    expect(result).toHaveLength(1);
  });

  it('normalizes children recursively', () => {
    const result = normalizeBlocks([{
      type: 'bulletList',
      content: 'parent',
      children: [{ type: 'bulletList', content: 'child' }]
    }]);
    expect(result[0].children![0].id).toBeTruthy();
  });

  it('rejects depth > 20 by throwing', () => {
    const deep = (depth: number): any => depth === 0
      ? { type: 'bulletList', content: 'leaf' }
      : { type: 'bulletList', content: `L${depth}`, children: [deep(depth - 1)] };
    expect(() => normalizeBlocks([deep(21)])).toThrow();
  });
});
