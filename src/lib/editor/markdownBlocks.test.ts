import { describe, it, expect } from 'vitest';
import {
  looksLikeMarkdown,
  parseMarkdownToBlocks,
  blocksToMarkdown,
  blocksToHtml,
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

  it('converts standard [text](url) to <a>', () => {
    const blocks = parseMarkdownToBlocks('- [click](https://example.com)');
    expect(blocks[0].content).toBe('<a href="https://example.com" target="_blank" rel="noopener noreferrer">click</a>');
  });

  it('converts [pill:text](url) to inline-link-btn pill and round-trips correctly', () => {
    const blocks = parseMarkdownToBlocks('- [pill:click](https://example.com)');
    expect(blocks[0].content).toContain('class="inline-link-btn');
    expect(blocks[0].content).toContain('data-label="click"');
    
    // Test serialization back to markdown
    const md = blocksToMarkdown(blocks);
    expect(md).toBe('- [pill:click](https://example.com)');
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

  // A list block's `children` are same-level sibling rows at runtime (see
  // ListBlock.tsx flattenRows/nestRows, which the editor uses to render):
  // pressing Enter twice produces {content:'parent', children:[{content:'child'}]}
  // with both at depth 0. Only Tab explicitly raises a row's depth. The
  // serializer must render list children flat by default to match what's
  // actually on screen, not indent them just because they're nested in the
  // data structure.
  it('serializes list block children as flat siblings by default (matches on-screen rendering)', () => {
    const block = {
      id: 'p', type: 'bulletList' as const, content: 'parent',
      children: [{ id: 'c', type: 'bulletList' as const, content: 'child' }],
    };
    expect(blocksToMarkdown([block])).toBe('- parent\n- child');
  });

  it('serializes a genuinely nested row (grandchild in the tree) with 2-space indentation', () => {
    const block = {
      id: 'p', type: 'bulletList' as const, content: 'parent',
      children: [{ id: 'c', type: 'bulletList' as const, content: 'child', children: [
        { id: 'g', type: 'bulletList' as const, content: 'grandchild' },
      ] }],
    };
    expect(blocksToMarkdown([block])).toBe('- parent\n- child\n  - grandchild');
  });

  it('numbers a flat numbered-list run correctly across children (no restart)', () => {
    const block = {
      id: 'a', type: 'numberedList' as const, content: 'first',
      children: [
        { id: 'b', type: 'numberedList' as const, content: 'second' },
        { id: 'c', type: 'numberedList' as const, content: 'third' },
      ],
    };
    expect(blocksToMarkdown([block])).toBe('1. first\n2. second\n3. third');
  });

  // ListBlock.tsx renders nested numbered rows with an alpha counter
  // (a./b./c.) at depth 1, restarting per depth level — see RowEl's marker()
  // at ListBlock.tsx:145-153, which resets `count` whenever a shallower row
  // is seen and picks counterStyle from `row.depth % 3`.
  it('restarts numbering with alpha style for a genuinely nested sub-run, then resumes parent numbering after', () => {
    const block = {
      id: 'a', type: 'numberedList' as const, content: 'first',
      children: [
        { id: 'b', type: 'numberedList' as const, content: 'second', children: [
          { id: 'n', type: 'numberedList' as const, content: 'nested' },
        ] },
        { id: 'c', type: 'numberedList' as const, content: 'third' },
      ],
    };
    expect(blocksToMarkdown([block])).toBe('1. first\n2. second\n  a. nested\n3. third');
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

// ── blocksToHtml ───────────────────────────────────────
describe('blocksToHtml', () => {
  it('empty array returns empty string', () => {
    expect(blocksToHtml([])).toBe('');
  });

  it('wraps consecutive bullet list blocks in a single <ul>', () => {
    const blocks = [
      { id: '1', type: 'bulletList' as const, content: 'alpha' },
      { id: '2', type: 'bulletList' as const, content: 'beta' },
    ];
    expect(blocksToHtml(blocks)).toBe('<ul><li>alpha</li><li>beta</li></ul>');
  });

  it('wraps numbered list blocks in a single <ol>', () => {
    const blocks = [
      { id: '1', type: 'numberedList' as const, content: 'first' },
      { id: '2', type: 'numberedList' as const, content: 'second' },
    ];
    expect(blocksToHtml(blocks)).toBe('<ol><li>first</li><li>second</li></ol>');
  });

  it('renders checklist items as disabled checkboxes', () => {
    const blocks = [
      { id: '1', type: 'checklist' as const, content: 'todo', checked: false },
      { id: '2', type: 'checklist' as const, content: 'done', checked: true },
    ];
    expect(blocksToHtml(blocks)).toBe(
      '<ul style="list-style:none;padding-left:0;">' +
      '<li><input type="checkbox" disabled> todo</li>' +
      '<li><input type="checkbox" checked disabled> done</li>' +
      '</ul>'
    );
  });

  it('does not merge a bulletList and a numberedList into the same wrapper', () => {
    const blocks = [
      { id: '1', type: 'bulletList' as const, content: 'a' },
      { id: '2', type: 'numberedList' as const, content: 'b' },
    ];
    expect(blocksToHtml(blocks)).toBe('<ul><li>a</li></ul><ol><li>b</li></ol>');
  });

  it('preserves inline HTML content (bold) inside a paragraph', () => {
    const block = { id: '1', type: 'text' as const, content: 'hello <strong>world</strong>' };
    expect(blocksToHtml([block])).toBe('<p>hello <strong>world</strong></p>');
  });

  it('renders heading styles as h1/h2/h3', () => {
    const blocks = [
      { id: '1', type: 'text' as const, content: 'Title', style: 'title' as const },
      { id: '2', type: 'text' as const, content: 'Heading', style: 'heading' as const },
      { id: '3', type: 'text' as const, content: 'Sub', style: 'subheading' as const },
    ];
    expect(blocksToHtml(blocks)).toBe('<h1>Title</h1><h2>Heading</h2><h3>Sub</h3>');
  });

  it('renders quote blocks as blockquote', () => {
    const block = { id: '1', type: 'quote' as const, content: 'said something' };
    expect(blocksToHtml([block])).toBe('<blockquote>said something</blockquote>');
  });

  it('renders divider as hr', () => {
    const block = { id: '1', type: 'divider' as const, content: '' };
    expect(blocksToHtml([block])).toBe('<hr>');
  });

  // A list block's direct children are same-level siblings at runtime (see
  // ListBlock.tsx flattenRows/nestRows) — not nested sub-items. Only a
  // child's OWN children (a genuinely deeper row in the tree) render as a
  // nested <ul>/<ol> inside that child's <li>.
  it('renders direct list children as flat sibling <li> items, not nested', () => {
    const blocks = [
      {
        id: '1', type: 'bulletList' as const, content: 'parent',
        children: [{ id: '2', type: 'bulletList' as const, content: 'child' }],
      },
    ];
    expect(blocksToHtml(blocks)).toBe('<ul><li>parent</li><li>child</li></ul>');
  });

  it('renders a genuinely nested row (grandchild in the tree) as a nested <ul>', () => {
    const blocks = [
      {
        id: '1', type: 'bulletList' as const, content: 'parent',
        children: [{ id: '2', type: 'bulletList' as const, content: 'child', children: [
          { id: '3', type: 'bulletList' as const, content: 'grandchild' },
        ] }],
      },
    ];
    expect(blocksToHtml(blocks)).toBe('<ul><li>parent</li><li>child<ul><li>grandchild</li></ul></li></ul>');
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

describe('parseMarkdownToBlocks — pill links', () => {
  it('parses pill links correctly', () => {
    const md = 'Here is a [pill:Doc Name](doc-id)';
    const blocks = parseMarkdownToBlocks(md);
    expect(blocks[0].content).toContain('<a href="doc-id" data-type="entity-link" data-id="doc-id" class="entity-pill">Doc Name</a>');
  });

  it('round-trips entity pill links correctly', () => {
    const original = '<a href="doc-id" data-type="entity-link" data-id="doc-id" class="entity-pill">Doc Name</a>';
    const block = { id: '1', type: 'text' as const, content: original, style: 'body' as const };
    const md = blocksToMarkdown([block]);
    expect(md).toBe('[pill:Doc Name](doc-id)');

    const parsed = parseMarkdownToBlocks(md);
    expect(parsed[0].content).toBe('<a href="doc-id" data-type="entity-link" data-id="doc-id" class="entity-pill">Doc Name</a>');
  });
});

describe('heading + numbered-list interaction', () => {
  it('keeps "### 1. Title" as a single subheading block', () => {
    const blocks = parseMarkdownToBlocks('### 1. Size that assumed an edge');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('text');
    expect(blocks[0].style).toBe('subheading');
    expect(blocks[0].content).toBe('1. Size that assumed an edge');
  });

  it('still splits mashed numbered lists after prose', () => {
    const blocks = parseMarkdownToBlocks('Steps: 1. First 2. Second');
    const numbered = blocks.filter(b => b.type === 'numberedList');
    expect(numbered).toHaveLength(2);
  });

  it('does NOT split a lone number mid-prose (date/amount sentence boundary)', () => {
    // "Oct 24, 2025. You took…" must stay one bullet — the "2025. You" split
    // was injecting a phantom numbered item that reset the rendered counter.
    const blocks = parseMarkdownToBlocks('* *Example:* Oct 24, 2025. You took 5 trades in one day.');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('bulletList');
    expect(blocks.some(b => b.type === 'numberedList')).toBe(false);
  });

  it('does NOT split "…lots in 2026. This preserved…" into a phantom item', () => {
    const blocks = parseMarkdownToBlocks('1. Scaled down to 0.6 lots in 2026. This preserved the account.');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('numberedList');
    // The whole sentence stays in the single item, not split at "2026. ".
    expect(blocks[0].content).toContain('This preserved the account');
  });

  it('nests indented bullet children under a numbered item without splitting', () => {
    const md = [
      '1. **The Avalanche Effect:**',
      '   * *Example:* Oct 24, 2025. You took 5 trades.',
      '   * *The Mistake:* Over-trading to recover losses.',
      '2. **Lot Size Inconsistency:**',
      '   * *Example:* Swinging from 2.5 lots down to 0.6 lots.',
    ].join('\n');
    const blocks = parseMarkdownToBlocks(md);
    const topNumbered = blocks.filter(b => b.type === 'numberedList');
    // Exactly two top-level numbered items — no phantom third from a split.
    expect(topNumbered).toHaveLength(2);
    // Each carries its bullet sub-points as children, still typed bulletList.
    expect(topNumbered[0].children?.every(c => c.type === 'bulletList')).toBe(true);
    expect(topNumbered[0].children).toHaveLength(2);
  });

  it('drops a bare ### line instead of emitting a text block', () => {
    const blocks = parseMarkdownToBlocks('###\n1. First item');
    expect(blocks.some(b => b.content === '###')).toBe(false);
    expect(blocks[0].type).toBe('numberedList');
  });

  it('parses #### as a heading (clamped to subheading), not literal text', () => {
    const blocks = parseMarkdownToBlocks('#### Strictly Protect the Buffer');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('text');
    expect(blocks[0].style).toBe('subheading');
    expect(blocks[0].content).toBe('Strictly Protect the Buffer');
    expect(blocks[0].content).not.toContain('#');
  });

  it('parses ##### and ###### as headings too (clamped to subheading)', () => {
    const five = parseMarkdownToBlocks('##### Deep');
    expect(five[0].style).toBe('subheading');
    expect(five[0].content).toBe('Deep');
    const six = parseMarkdownToBlocks('###### Deeper');
    expect(six[0].style).toBe('subheading');
    expect(six[0].content).toBe('Deeper');
  });

  it('keeps "#### 1. Title" as a single subheading, not a stray #### + list', () => {
    const blocks = parseMarkdownToBlocks('#### 1. Strictly Protect the Buffer');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].style).toBe('subheading');
    expect(blocks[0].content).toBe('1. Strictly Protect the Buffer');
    expect(blocks.some(b => b.content === '####')).toBe(false);
  });

  it('drops a bare #### / ##### / ###### line instead of emitting text', () => {
    for (const marker of ['####', '#####', '######']) {
      const blocks = parseMarkdownToBlocks(`${marker}\n1. First item`);
      expect(blocks.some(b => b.content === marker)).toBe(false);
      expect(blocks[0].type).toBe('numberedList');
    }
  });

  it('treats + as a bullet marker so it does not break a numbered-list run', () => {
    const blocks = parseMarkdownToBlocks('+ alpha\n+ beta');
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe('bulletList');
    expect(blocks[0].content).toBe('alpha');
    expect(blocks[1].type).toBe('bulletList');
  });

  it('does not reset numbered-list counter when a + sub-bullet appears mid-list', () => {
    // Regression: "1. A\n+ note\n2. B" wedged a text block between the list
    // items, which reset the rendered counter to 1 for item B.
    const blocks = parseMarkdownToBlocks('1. First\n+ a sub point\n2. Second');
    const textBlocks = blocks.filter(b => b.type === 'text' && b.content.startsWith('+'));
    expect(textBlocks).toHaveLength(0);
    const numbered = blocks.filter(b => b.type === 'numberedList');
    expect(numbered).toHaveLength(2);
  });
});

describe('lazy continuation — flush-left paragraph after a list item', () => {
  it('nests a non-indented paragraph directly under the preceding numbered item', () => {
    // The all-"1." bug: models write the description flush-left with no blank
    // line, so it landed as a top-level text sibling BETWEEN numbered items and
    // reset the render counter. It must attach as the item's child instead.
    const blocks = parseMarkdownToBlocks(
      '1. **Size escalation**\nJumping to 2.5 lots turned bad days worse.\n\n2. **Revenge trading**\nOct 24 was the textbook day.'
    );
    const topNumbered = blocks.filter(b => b.type === 'numberedList');
    expect(topNumbered).toHaveLength(2);
    // No description text left stranded at the top level between the items.
    const topText = blocks.filter(b => b.type === 'text' && b.style === 'body');
    expect(topText).toHaveLength(0);
    expect(blocks[0].children?.[0]?.content).toContain('Jumping to 2.5 lots');
    expect(blocks[1].children?.[0]?.content).toContain('Oct 24');
  });

  it('nests the continuation under bullets and checklists too', () => {
    const bullets = parseMarkdownToBlocks('- Point one\nExpanded explanation here.');
    expect(bullets).toHaveLength(1);
    expect(bullets[0].type).toBe('bulletList');
    expect(bullets[0].children?.[0]?.content).toContain('Expanded explanation');
  });

  it('does NOT nest when a blank line separates the paragraph (real standalone paragraph)', () => {
    const blocks = parseMarkdownToBlocks('1. Item\n\nStandalone paragraph.');
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe('numberedList');
    expect(blocks[0].children ?? []).toHaveLength(0);
    expect(blocks[1].type).toBe('text');
  });

  it('keeps two separate numbered lists distinct: list A, paragraph, list B restarts', () => {
    // Blast-radius guard: a blank-separated paragraph between two lists must
    // stay a top-level sibling so list B is a fresh list (renders 1,2 again).
    const blocks = parseMarkdownToBlocks(
      '1. A\n2. B\n3. C\n\nA separating paragraph.\n\n1. X\n2. Y'
    );
    const types = blocks.map(b => b.type);
    // 3 numbered + 1 text + 2 numbered, all at top level, in order.
    expect(types).toEqual([
      'numberedList', 'numberedList', 'numberedList',
      'text',
      'numberedList', 'numberedList',
    ]);
  });

  it('does not treat a following list item as a continuation of the previous item', () => {
    // "1. A\n2. B" — B is a sibling item, never a child of A.
    const blocks = parseMarkdownToBlocks('1. A\n2. B');
    expect(blocks).toHaveLength(2);
    expect(blocks[0].children ?? []).toHaveLength(0);
  });
});

describe('mash-up splitter — mid-sentence + / * must not become bullets', () => {
  it('does not split "EURUSD + EURGBP" prose into a bullet', () => {
    const blocks = parseMarkdownToBlocks('several EURUSD + EURGBP entries in a window');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('text');
    expect(blocks[0].content).toContain('EURUSD + EURGBP');
    expect(blocks.some(b => b.type === 'bulletList')).toBe(false);
  });

  it('does not split "high conviction + calm sizing" prose', () => {
    const blocks = parseMarkdownToBlocks('makes sense at high conviction + calm sizing under load');
    expect(blocks.some(b => b.type === 'bulletList')).toBe(false);
    expect(blocks[0].content).toContain('conviction + calm');
  });

  it('still splits genuinely run-together bullet items written with *', () => {
    const blocks = parseMarkdownToBlocks('* first item\n* second item');
    expect(blocks).toHaveLength(2);
    expect(blocks.every(b => b.type === 'bulletList')).toBe(true);
  });
});

describe('flowr entity mention pills', () => {
  it('converts [@Title](flowr:note:id) to a mention-pill anchor', () => {
    const blocks = parseMarkdownToBlocks('See [@Trade History](flowr:note:doc-123) for data.')
    expect(blocks[0].content).toContain('data-mention="1"')
    expect(blocks[0].content).toContain('data-mention-ref="flowr:note:doc-123"')
    expect(blocks[0].content).toContain('contenteditable="false"')
    expect(blocks[0].content).toContain('>Trade History</a>')
    expect(blocks[0].content).not.toContain('target="_blank"')
  })

  it('keeps href as "#" so the browser status bar never shows the raw flowr: id', () => {
    const blocks = parseMarkdownToBlocks('See [@Trade History](flowr:note:doc-123) for data.')
    expect(blocks[0].content).toContain('href="#"')
    expect(blocks[0].content).not.toContain('href="flowr:')
  })

  it('handles a flowr link whose label lacks the @ prefix', () => {
    const blocks = parseMarkdownToBlocks('See [Trade History](flowr:note:doc-123).')
    expect(blocks[0].content).toContain('data-mention="1"')
    expect(blocks[0].content).toContain('>Trade History</a>')
  })

  it('round-trips a mention pill back to [@Title](flowr:type:id) markdown', () => {
    const md = 'See [@Trade History](flowr:note:doc-123) for data.'
    const roundTripped = blocksToMarkdown(parseMarkdownToBlocks(md))
    expect(roundTripped).toContain('[@Trade History](flowr:note:doc-123)')
  })

  it('leaves ordinary web links untouched', () => {
    const blocks = parseMarkdownToBlocks('See [docs](https://example.com).')
    expect(blocks[0].content).toContain('target="_blank"')
    expect(blocks[0].content).not.toContain('data-mention')
  })

  it('still round-trips a legacy pill (href="flowr:...", no data-mention-ref) saved before this change', () => {
    const legacyBlock = {
      id: '1',
      type: 'text' as const,
      content: '<a href="flowr:note:doc-123" data-mention="1" class="entity-pill" contenteditable="false">Trade History</a>',
      style: 'body' as const,
    };
    const md = blocksToMarkdown([legacyBlock]);
    expect(md).toContain('[@Trade History](flowr:note:doc-123)');
  })
})
