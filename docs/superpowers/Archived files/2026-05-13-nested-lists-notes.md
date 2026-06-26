# Nested Lists in Notes + Bot Markdown Bridge — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add depth-aware visual styling to nested list blocks in the note editor, add a markdown↔block bridge used by paste interception and bot tools, and extend bot tool definitions/handlers to write structured blocks.

**Architecture:** Depth is computed at render time from the block tree (`children` nesting); no schema change. A new pure module `src/lib/editor/markdownBlocks.ts` provides parsing, serialization, normalization, and the paste heuristic — shared between the client editor and the server-side bot handlers. UI changes are confined to `BlockRenderer.tsx` (depth-aware marker) and `NoteEditor.tsx` (depth prop threading, paste interception, Enter-into-children routing).

**Tech Stack:** TypeScript, React (Next.js App Router), Zustand store (`useStore`), vitest (test runner — installed as part of this plan), Supabase (server-side entity persistence).

---

## File Map

| Status | File | Role |
|---|---|---|
| NEW | `src/lib/editor/markdownBlocks.ts` | `parseMarkdownToBlocks`, `blocksToMarkdown`, `normalizeBlocks`, `looksLikeMarkdown`, `formatCounter` |
| NEW | `src/lib/editor/markdownBlocks.test.ts` | Unit tests for the above |
| MOD | `src/components/editor/BlockRenderer.tsx` | Depth-aware `listMarker()`; hoist `isList`/`isChecklist`; Enter-into-children |
| MOD | `src/components/editor/NoteEditor.tsx` | Thread `depth` prop; `getListCounter`; paste interception |
| MOD | `src/lib/bot/tools/definitions.ts` | `blocks` param on create/update_note; new `append_note_blocks` tool |
| MOD | `src/lib/bot/tools/handlers.ts` | Honor `blocks`, markdown fallback, new `append_note_blocks` handler |
| MOD | `bot prompts(premission to edit needed!)/mode-default.txt` | Bot formatting guidance |
| MOD | `bot prompts(premission to edit needed!)/mode-pro.txt` | Bot formatting guidance |

---

## Task 1: Install vitest and scaffold the test file

No tests exist in this project. We install vitest so we can drive the markdown bridge with tests before writing the implementation.

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/lib/editor/markdownBlocks.test.ts`

- [ ] **Step 1: Install vitest**

```bash
npm install --save-dev vitest
```

Expected output: vitest appears in `package.json` devDependencies.

- [ ] **Step 2: Add test script to package.json**

In `package.json`, add to the `"scripts"` object:

```json
"test": "vitest run"
```

- [ ] **Step 3: Create vitest config**

Create `vitest.config.ts` at the repo root:

```ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

- [ ] **Step 4: Create the (empty) source file so imports resolve**

Create `src/lib/editor/markdownBlocks.ts` with just the exports the test will import:

```ts
import { EditorBlock, BlockType, BlockStyle } from '@/data/store.types';
import { generateId } from '@/data/store';

export type BlockInput = {
  type: BlockType;
  content?: string;
  style?: BlockStyle;
  checked?: boolean;
  children?: BlockInput[];
};

export function looksLikeMarkdown(_text: string): boolean {
  throw new Error('not implemented');
}

export function parseMarkdownToBlocks(_md: string): EditorBlock[] {
  throw new Error('not implemented');
}

export function blocksToMarkdown(_blocks: EditorBlock[]): string {
  throw new Error('not implemented');
}

export function normalizeBlocks(_input: BlockInput[]): EditorBlock[] {
  throw new Error('not implemented');
}

export function formatCounter(n: number, style: 'arabic' | 'alpha' | 'roman'): string {
  throw new Error('not implemented');
}
```

- [ ] **Step 5: Write failing tests**

Create `src/lib/editor/markdownBlocks.test.ts`:

```ts
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

  it('returns false for a single-line bullet (only 1 match)', () => {
    expect(looksLikeMarkdown('- only one item')).toBe(false);
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
    expect(blocks[0]).toMatchObject({ type: 'numberedList' });
  });

  it('parses checklist with checked state', () => {
    const blocks = parseMarkdownToBlocks('[ ] todo\n[x] done');
    expect(blocks[0]).toMatchObject({ type: 'checklist', checked: false });
    expect(blocks[1]).toMatchObject({ type: 'checklist', checked: true });
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

  it('serializes numbered list with "1." always', () => {
    const blocks = parseMarkdownToBlocks('1. first\n2. second');
    expect(blocksToMarkdown(blocks)).toBe('1. first\n1. second');
  });

  it('serializes nested list with 2-space indentation', () => {
    const blocks = parseMarkdownToBlocks('- parent\n  - child');
    expect(blocksToMarkdown(blocks)).toBe('- parent\n  - child');
  });

  it('serializes headings', () => {
    const blocks = parseMarkdownToBlocks('# Title');
    expect(blocksToMarkdown(blocks)).toBe('# Title');
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
```

- [ ] **Step 6: Run tests — verify they all fail with "not implemented"**

```bash
npm test
```

Expected: all tests FAIL with `Error: not implemented`. If any pass, there's a stub bug.

- [ ] **Step 7: Commit**

```bash
git add package.json vitest.config.ts src/lib/editor/markdownBlocks.ts src/lib/editor/markdownBlocks.test.ts
git commit -m "test: scaffold vitest + markdownBlocks test suite (all failing)"
```

---

## Task 2: Implement `formatCounter` and `looksLikeMarkdown`

**Files:**
- Modify: `src/lib/editor/markdownBlocks.ts`

- [ ] **Step 1: Implement `formatCounter`**

Replace the `formatCounter` stub in `src/lib/editor/markdownBlocks.ts`:

```ts
export function formatCounter(n: number, style: 'arabic' | 'alpha' | 'roman'): string {
  if (style === 'arabic') return String(n);

  if (style === 'alpha') {
    let result = '';
    let num = n;
    while (num > 0) {
      num--;
      result = String.fromCharCode(97 + (num % 26)) + result;
      num = Math.floor(num / 26);
    }
    return result;
  }

  // roman
  const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
  const syms = ['m','cm','d','cd','c','xc','l','xl','x','ix','v','iv','i'];
  let result = '';
  let num = n;
  for (let i = 0; i < vals.length; i++) {
    while (num >= vals[i]) {
      result += syms[i];
      num -= vals[i];
    }
  }
  return result;
}
```

- [ ] **Step 2: Implement `looksLikeMarkdown`**

Replace the `looksLikeMarkdown` stub:

```ts
export function looksLikeMarkdown(text: string): boolean {
  if (!text.trim()) return false;
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  const mdLineRe = /^(\s*)(-|\*|\d+\.|[a-z]+\.|[ivxlcdm]+\.|#{1,3} |\[[ x]\] |>)/;
  const matches = lines.filter(l => mdLineRe.test(l));
  return matches.length >= 2;
}
```

- [ ] **Step 3: Run formatCounter and looksLikeMarkdown tests**

```bash
npm test -- --reporter=verbose 2>&1 | head -60
```

Expected: `formatCounter` and `looksLikeMarkdown` tests PASS. Others still fail with "not implemented".

- [ ] **Step 4: Commit**

```bash
git add src/lib/editor/markdownBlocks.ts
git commit -m "feat: implement formatCounter and looksLikeMarkdown"
```

---

## Task 3: Implement `parseMarkdownToBlocks`

**Files:**
- Modify: `src/lib/editor/markdownBlocks.ts`

- [ ] **Step 1: Add the inline HTML conversion helper (private)**

Add this function before the `parseMarkdownToBlocks` export. It converts markdown inline syntax to the HTML that the editor stores in `content`:

```ts
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inlineToHtml(text: string): string {
  // Process inline patterns: order matters (bold before italic, backtick first)
  let s = escapeHtml(text);
  // inline code first (no further processing inside)
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  // bold
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // italic (single * or _)
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  s = s.replace(/_([^_]+)_/g, '<em>$1</em>');
  // links
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return s;
}
```

- [ ] **Step 2: Implement the line classifier (private)**

```ts
type LineKind =
  | { kind: 'heading'; level: 1 | 2 | 3; text: string }
  | { kind: 'bullet'; text: string }
  | { kind: 'numbered'; text: string }
  | { kind: 'checklist'; checked: boolean; text: string }
  | { kind: 'quote'; text: string }
  | { kind: 'fenceOpen' }
  | { kind: 'fenceClose' }
  | { kind: 'divider' }
  | { kind: 'text'; text: string }
  | { kind: 'blank' };

function classifyLine(raw: string): { indent: number; kind: LineKind } {
  // Measure indent (tabs count as 1 level each, 2 spaces = 1 level)
  const indentMatch = raw.match(/^(\t| {2})+/);
  const indent = indentMatch ? indentMatch[0].replace(/\t/g, '  ').length / 2 : 0;
  const line = raw.replace(/^(\t| {2})*/, '').replace(/^\t/, '');

  if (line === '') return { indent, kind: { kind: 'blank' } };
  if (line === '---') return { indent, kind: { kind: 'divider' } };
  if (line.startsWith('```')) return { indent, kind: { kind: line === '```' ? 'fenceOpen' : (line.endsWith('```') && line.length > 3 ? 'fenceClose' : 'fenceOpen') } };

  const h = line.match(/^(#{1,3}) (.+)/);
  if (h) return { indent, kind: { kind: 'heading', level: h[1].length as 1|2|3, text: h[2] } };

  const bullet = line.match(/^[-*] (.+)/);
  if (bullet) return { indent, kind: { kind: 'bullet', text: bullet[1] } };

  const numbered = line.match(/^(?:\d+|[a-z]+|[ivxlcdm]+)\. (.+)/i);
  if (numbered) return { indent, kind: { kind: 'numbered', text: numbered[1] } };

  const check = line.match(/^\[([ x])\] (.+)/);
  if (check) return { indent, kind: { kind: 'checklist', checked: check[1] === 'x', text: check[2] } };

  const quote = line.match(/^> (.+)/);
  if (quote) return { indent, kind: { kind: 'quote', text: quote[1] } };

  return { indent, kind: { kind: 'text', text: line } };
}
```

- [ ] **Step 3: Implement `parseMarkdownToBlocks`**

Replace the stub:

```ts
export function parseMarkdownToBlocks(md: string): EditorBlock[] {
  if (!md.trim()) return [];

  const lines = md.split('\n');
  const root: EditorBlock[] = [];
  // stack entries: [block, depth]
  const stack: Array<{ block: EditorBlock; depth: number }> = [];
  let inFence = false;
  let fenceLines: string[] = [];

  const pushBlock = (block: EditorBlock, depth: number) => {
    // Pop stack until we find the right parent depth
    while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
      stack.pop();
    }
    if (stack.length === 0) {
      root.push(block);
    } else {
      const parent = stack[stack.length - 1].block;
      if (!parent.children) parent.children = [];
      parent.children.push(block);
    }
    stack.push({ block, depth });
  };

  for (const rawLine of lines) {
    // Handle fenced code blocks
    if (inFence) {
      if (rawLine.trim() === '```') {
        inFence = false;
        const monoBlock: EditorBlock = {
          id: generateId(),
          type: 'text',
          content: fenceLines.join('\n'),
          style: 'mono',
        };
        pushBlock(monoBlock, 0);
        fenceLines = [];
      } else {
        fenceLines.push(rawLine);
      }
      continue;
    }

    const { indent, kind } = classifyLine(rawLine);

    if (kind.kind === 'blank') continue;

    if (kind.kind === 'fenceOpen') {
      inFence = true;
      fenceLines = [];
      continue;
    }

    if (kind.kind === 'fenceClose') {
      inFence = false;
      continue;
    }

    let block: EditorBlock;

    switch (kind.kind) {
      case 'heading': {
        const styleMap: Record<1|2|3, BlockStyle> = { 1: 'title', 2: 'heading', 3: 'subheading' };
        block = { id: generateId(), type: 'text', content: inlineToHtml(kind.text), style: styleMap[kind.level] };
        break;
      }
      case 'bullet':
        block = { id: generateId(), type: 'bulletList', content: inlineToHtml(kind.text) };
        break;
      case 'numbered':
        block = { id: generateId(), type: 'numberedList', content: inlineToHtml(kind.text) };
        break;
      case 'checklist':
        block = { id: generateId(), type: 'checklist', content: inlineToHtml(kind.text), checked: kind.checked };
        break;
      case 'quote':
        block = { id: generateId(), type: 'quote', content: inlineToHtml(kind.text) };
        break;
      case 'divider':
        block = { id: generateId(), type: 'divider', content: '' };
        break;
      case 'text':
      default:
        block = { id: generateId(), type: 'text', content: inlineToHtml(kind.text), style: 'body' };
        break;
    }

    pushBlock(block, indent);
  }

  return root;
}
```

- [ ] **Step 4: Run parse tests**

```bash
npm test -- --reporter=verbose 2>&1 | head -80
```

Expected: `parseMarkdownToBlocks` tests PASS. `blocksToMarkdown` and `normalizeBlocks` tests still fail.

- [ ] **Step 5: Commit**

```bash
git add src/lib/editor/markdownBlocks.ts
git commit -m "feat: implement parseMarkdownToBlocks with inline HTML and nested indentation"
```

---

## Task 4: Implement `blocksToMarkdown` and `normalizeBlocks`

**Files:**
- Modify: `src/lib/editor/markdownBlocks.ts`

- [ ] **Step 1: Implement `blocksToMarkdown`**

Replace the stub:

```ts
function htmlToText(html: string): string {
  return html
    .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
    .replace(/<em>(.*?)<\/em>/g, '*$1*')
    .replace(/<code>(.*?)<\/code>/g, '`$1`')
    .replace(/<a href="([^"]+)">([^<]+)<\/a>/g, '[$2]($1)')
    .replace(/<[^>]+>/g, '');
}

function serializeBlocks(blocks: EditorBlock[], depth: number): string {
  const indent = '  '.repeat(depth);
  const lines: string[] = [];
  for (const b of blocks) {
    let line: string;
    switch (b.type) {
      case 'bulletList':
        line = `${indent}- ${htmlToText(b.content)}`;
        break;
      case 'dashedList':
        line = `${indent}- ${htmlToText(b.content)}`;
        break;
      case 'numberedList':
        line = `${indent}1. ${htmlToText(b.content)}`;
        break;
      case 'checklist':
        line = `${indent}[${b.checked ? 'x' : ' '}] ${htmlToText(b.content)}`;
        break;
      case 'quote':
        line = `${indent}> ${htmlToText(b.content)}`;
        break;
      case 'divider':
        line = `${indent}---`;
        break;
      case 'text':
        if (b.style === 'title') line = `${indent}# ${htmlToText(b.content)}`;
        else if (b.style === 'heading') line = `${indent}## ${htmlToText(b.content)}`;
        else if (b.style === 'subheading') line = `${indent}### ${htmlToText(b.content)}`;
        else if (b.style === 'mono') line = `${indent}\`\`\`\n${b.content}\n${indent}\`\`\``;
        else line = `${indent}${htmlToText(b.content)}`;
        break;
      default:
        line = `${indent}${htmlToText(b.content)}`;
    }
    lines.push(line);
    if (b.children && b.children.length > 0) {
      lines.push(serializeBlocks(b.children, depth + 1));
    }
  }
  return lines.join('\n');
}

export function blocksToMarkdown(blocks: EditorBlock[]): string {
  if (!blocks.length) return '';
  return serializeBlocks(blocks, 0);
}
```

- [ ] **Step 2: Implement `normalizeBlocks`**

Replace the stub:

```ts
const VALID_TYPES = new Set<BlockType>([
  'text','checklist','bulletList','dashedList','numberedList',
  'quote','divider','columns','column','embed','database',
  'table','image','video','shape','section','comment','connection','link',
]);

function normalizeBlocksInner(input: BlockInput[], depth: number): EditorBlock[] {
  if (depth > 20) throw new Error('Block tree depth exceeds maximum of 20');
  const result: EditorBlock[] = [];
  for (const raw of input) {
    if (!VALID_TYPES.has(raw.type)) continue;
    const block: EditorBlock = {
      id: generateId(),
      type: raw.type,
      content: raw.content ?? '',
      style: raw.style,
      checked: raw.checked,
    };
    if (raw.children && raw.children.length > 0) {
      block.children = normalizeBlocksInner(raw.children, depth + 1);
    }
    result.push(block);
  }
  return result;
}

export function normalizeBlocks(input: BlockInput[]): EditorBlock[] {
  return normalizeBlocksInner(input, 0);
}
```

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: **ALL tests PASS.** If any fail, fix before continuing.

- [ ] **Step 4: Commit**

```bash
git add src/lib/editor/markdownBlocks.ts
git commit -m "feat: implement blocksToMarkdown and normalizeBlocks — all tests passing"
```

---

## Task 5: Depth-aware markers in BlockRenderer

This task is purely in the UI. No tests (the marker is a DOM element, verified visually).

**Files:**
- Modify: `src/components/editor/BlockRenderer.tsx`

- [ ] **Step 1: Hoist `isList` and `isChecklist` above `handleKeyDown`**

In `BlockRenderer`, find these two lines near line 249 (after `handleContentClick`):

```tsx
const isList = ['bulletList', 'dashedList', 'numberedList'].includes(block.type);
const isChecklist = block.type === 'checklist';
```

Move them to be declared **before** the `handleKeyDown` callback (currently line ~103), right after the `colorStyle` line:

```tsx
const colorStyle = getBlockColorStyle(block);

// Hoist before handleKeyDown so they are accessible inside the handler
const isList = ['bulletList', 'dashedList', 'numberedList'].includes(block.type);
const isChecklist = block.type === 'checklist';
```

Remove the duplicate declarations that remain later in the file.

- [ ] **Step 2: Add `depth` to BlockRenderer props**

Find the `BlockViewProps` interface near line 15 and add:

```tsx
depth?: number;
```

In the `BlockRenderer` function signature (the `any` typed one at line 39), destructure `depth = 0`:

```tsx
export function BlockRenderer({
  block,
  index,
  onUpdate,
  onDelete,
  onInsertAfter,
  onSlash,
  listNumber,
  slashMenuOpen,
  menuOpen,
  onOpenMenu,
  onFocus,
  onIndent,
  onUnindent,
  isSelected = false,
  isInsideColumn = false,
  onDragStart,
  isDragOverlay = false,
  depth = 0,       // ← add this
}: any) {
```

- [ ] **Step 3: Replace `listMarker()` with depth-aware version**

Find the `listMarker` function near line 608. Replace the entire function:

```tsx
const listMarker = () => {
  const d = depth % 3;

  if (block.type === 'bulletList') {
    if (d === 0) return <div className="w-[5.5px] h-[5.5px] rounded-full bg-[var(--bone-70)] flex-shrink-0" />;
    if (d === 1) return <div className="w-[5.5px] h-[5.5px] rounded-full border border-[var(--bone-70)] flex-shrink-0" />;
    // d === 2
    return <div className="w-[5.5px] h-[5.5px] bg-[var(--bone-70)] flex-shrink-0" />;
  }

  if (block.type === 'dashedList') {
    if (d === 0) return <div className="w-[8px] h-[1px] bg-[var(--bone-70)] flex-shrink-0" />;
    if (d === 1) return <div className="w-[6px] h-[1px] bg-[var(--bone-70)] flex-shrink-0" />;
    // d === 2
    return <div className="w-[3px] h-[3px] rounded-full bg-[var(--bone-70)] flex-shrink-0" />;
  }

  if (block.type === 'numberedList') {
    const counterStyle = d === 0 ? 'arabic' : d === 1 ? 'alpha' : 'roman';
    const label = formatCounter(listNumber ?? 1, counterStyle);
    return <span className="text-bone-70/40 text-[18px] font-medium leading-none" style={{ fontFamily: '"Crimson Text"' }}>{label}.</span>;
  }

  if (block.type === 'checklist') {
    return (
      <div onClick={() => onUpdate(block.id, { checked: !block.checked })} className={clsx("w-[16px] h-[16px] shrink-0 rounded-[4px] border-[1.5px] flex items-center justify-center transition-all cursor-pointer", block.checked ? "bg-white/20 border-white/40" : "border-white/20 hover:border-white/40")}>
        {block.checked && <Check className="w-[12px] h-[12px] text-bone-100" strokeWidth={3} />}
      </div>
    );
  }

  return null;
};
```

- [ ] **Step 4: Add `formatCounter` import**

At the top of `BlockRenderer.tsx`, add:

```tsx
import { formatCounter } from '@/lib/editor/markdownBlocks';
```

- [ ] **Step 5: Fix Enter-into-children routing in `handleKeyDown`**

Inside `handleKeyDown`, find the Enter handling block (~line 105). The section that handles non-empty list Enter currently reads:

```tsx
onInsertAfter(block.id, isList ? block.type : 'text');
```

Replace it with:

```tsx
const hasChildren = (block.children?.length ?? 0) > 0;
const isListLike = isList || isChecklist;
if (isListLike && hasChildren && block.content.trim()) {
  // Insert as first child so new item appears directly below the parent
  onInsertAfter(block.id, block.type, false, true);
} else {
  onInsertAfter(block.id, isList ? block.type : 'text');
}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to the files we changed. (Unrelated pre-existing errors are acceptable.)

- [ ] **Step 7: Commit**

```bash
git add src/components/editor/BlockRenderer.tsx
git commit -m "feat: depth-aware list markers and Enter-into-children in BlockRenderer"
```

---

## Task 6: Thread `depth` through NoteEditor and add `getListCounter`

**Files:**
- Modify: `src/components/editor/NoteEditor.tsx`

- [ ] **Step 1: Replace `getListNumber` with `getListCounter`**

In `NoteEditor.tsx`, find `getListNumber` (~line 1059). Replace it entirely:

```tsx
const getListCounter = useCallback((blockId: string, siblings: EditorBlock[]): number => {
  let count = 0;
  for (const b of siblings) {
    if (b.type === 'numberedList') count++;
    else count = 0; // reset streak on non-numbered sibling
    if (b.id === blockId) return count;
  }
  return 1;
}, []);
```

- [ ] **Step 2: Update `renderBlocksRecursive` to pass `depth` and use `getListCounter`**

Find `renderBlocksRecursive` (~line 1069). Replace it:

```tsx
const renderBlocksRecursive = (list: EditorBlock[], depth: number = 0): React.ReactNode[] => {
  return list.flatMap((block, idx) => {
    const rendered = [
      <BlockRenderer
        key={block.id}
        block={block}
        index={idx}
        depth={depth}
        onUpdate={updateBlock}
        onDelete={deleteBlock}
        onIndent={indentBlock}
        onUnindent={unindentBlock}
        onInsertAfter={insertAfter}
        onSlash={handleSlash}
        onOpenMenu={handleOpenMenu}
        onFocus={handleBlockFocus}
        isSelected={selectedBlockIds.has(block.id)}
        onDragStart={handleDragStart}
        listNumber={block.type === 'numberedList' ? getListCounter(block.id, list) : undefined}
        slashMenuOpen={slashMenu?.blockId === block.id}
        menuOpen={activeOptionsMenu?.blockId === block.id}
      />
    ];
    if (block.children && block.children.length > 0 && !block.isFolded) {
      rendered.push(
        <div key={`${block.id}-children`} className="pl-8">
          {renderBlocksRecursive(block.children, depth + 1)}
        </div>
      );
    }
    return rendered;
  });
};
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/editor/NoteEditor.tsx
git commit -m "feat: thread depth prop and getListCounter through NoteEditor"
```

---

## Task 7: Markdown paste interception in NoteEditor

**Files:**
- Modify: `src/components/editor/NoteEditor.tsx`

- [ ] **Step 1: Add import for markdown utilities**

At the top of `NoteEditor.tsx`, add to the imports:

```tsx
import { looksLikeMarkdown, parseMarkdownToBlocks } from '@/lib/editor/markdownBlocks';
```

- [ ] **Step 2: Update `handlePaste` to intercept markdown**

Find `handlePaste` (~line 896). Find the section near line 942 that handles text paste:

```tsx
const target = e.target as HTMLElement;
if (target.isContentEditable) {
  e.preventDefault();
  const plainText = e.clipboardData.getData('text/plain');
  document.execCommand('insertText', false, plainText);
}
```

Replace it with:

```tsx
const target = e.target as HTMLElement;
if (target.isContentEditable) {
  e.preventDefault();
  const plainText = e.clipboardData.getData('text/plain');

  if (looksLikeMarkdown(plainText)) {
    const parsedBlocks = parseMarkdownToBlocks(plainText);
    if (parsedBlocks.length > 0) {
      // Find focused block to insert after (or replace if empty)
      const blockEl = (document.activeElement as HTMLElement)?.closest('[data-block-id]');
      const focusedId = blockEl?.getAttribute('data-block-id');
      const focusedBlock = focusedId ? blocks.find(b => b.id === focusedId) : null;

      if (focusedBlock && !focusedBlock.content.trim()) {
        // Replace the empty focused block with the first parsed block, append rest after
        const idx = blocks.findIndex(b => b.id === focusedId);
        const newBlocks = [...blocks];
        newBlocks.splice(idx, 1, ...parsedBlocks);
        persistBlocks(newBlocks);
      } else if (focusedId) {
        // Insert after the focused block
        const idx = blocks.findIndex(b => b.id === focusedId);
        const newBlocks = [...blocks];
        newBlocks.splice(idx + 1, 0, ...parsedBlocks);
        persistBlocks(newBlocks);
      } else {
        persistBlocks([...blocks, ...parsedBlocks]);
      }
      return;
    }
  }

  document.execCommand('insertText', false, plainText);
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/editor/NoteEditor.tsx
git commit -m "feat: markdown paste interception in NoteEditor"
```

---

## Task 8: Extend bot tool definitions

**Files:**
- Modify: `src/lib/bot/tools/definitions.ts`

- [ ] **Step 1: Add `blocks` parameter to `create_note`**

Find the `create_note` tool definition. Replace the `parameters` object:

```ts
{
  name: "create_note",
  description: "Creates a new note in the workspace. Use `blocks` for structured content with lists, headings, or checklists. Use `content` (markdown string) as a simpler fallback.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "Title of the note." },
      content: { type: "string", description: "Markdown text content (optional, used if blocks is not provided)." },
      parentId: { type: "string", description: "ID of the parent folder (optional)." },
      blocks: {
        type: "array",
        description: "Structured content blocks (preferred over content for lists/headings). Each block: { type, content?, style?, checked?, children? }",
        items: {
          type: "object",
          properties: {
            type: { type: "string" },
            content: { type: "string" },
            style: { type: "string" },
            checked: { type: "boolean" },
            children: { type: "array" }
          },
          required: ["type"]
        }
      }
    },
    required: ["title"]
  }
},
```

- [ ] **Step 2: Add `blocks` parameter to `update_note`**

Find the `update_note` tool definition. Replace its `parameters`:

```ts
{
  name: "update_note",
  description: "Updates the content or title of an existing note. Use `blocks` for structured content with lists/headings/checklists. Use `content` (markdown) as a simpler fallback.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "The ID of the note to update." },
      title: { type: "string", description: "New title for the note (optional)." },
      content: { type: "string", description: "New markdown text content (optional, used if blocks is not provided)." },
      blocks: {
        type: "array",
        description: "Structured content blocks (preferred over content for lists/headings). Each block: { type, content?, style?, checked?, children? }",
        items: {
          type: "object",
          properties: {
            type: { type: "string" },
            content: { type: "string" },
            style: { type: "string" },
            checked: { type: "boolean" },
            children: { type: "array" }
          },
          required: ["type"]
        }
      }
    },
    required: ["id"]
  }
},
```

- [ ] **Step 3: Add `append_note_blocks` tool**

After the `update_note` entry and before `delete_note`, insert:

```ts
{
  name: "append_note_blocks",
  description: "Appends structured blocks to the end of an existing note without replacing existing content. Good for incrementally building a note.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "The ID of the note to append to." },
      blocks: {
        type: "array",
        description: "Structured blocks to append. Each block: { type, content?, style?, checked?, children? }",
        items: {
          type: "object",
          properties: {
            type: { type: "string" },
            content: { type: "string" },
            style: { type: "string" },
            checked: { type: "boolean" },
            children: { type: "array" }
          },
          required: ["type"]
        }
      }
    },
    required: ["id", "blocks"]
  }
},
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/bot/tools/definitions.ts
git commit -m "feat: add blocks param to create/update_note and new append_note_blocks tool"
```

---

## Task 9: Update bot tool handlers

**Files:**
- Modify: `src/lib/bot/tools/handlers.ts`

- [ ] **Step 1: Add import for markdown utilities**

At the top of `handlers.ts`, add:

```ts
import { parseMarkdownToBlocks, normalizeBlocks, BlockInput } from '@/lib/editor/markdownBlocks';
```

- [ ] **Step 2: Update `create_note` handler**

Find the `create_note` handler (~line 176). Replace the `content` line in the insert call:

Current:
```ts
content: content ? [{ id: 'b1', type: 'text', content }] : [],
```

Replace with this logic (add before the `supabaseAdmin.from('entities').insert` call):

```ts
let entityContent: any[] = [];
if (blocks && Array.isArray(blocks)) {
  try {
    entityContent = normalizeBlocks(blocks as BlockInput[]);
  } catch (e: any) {
    return { error: `Invalid blocks: ${e.message}` };
  }
} else if (content) {
  entityContent = parseMarkdownToBlocks(content);
}
```

And change the insert to use `entityContent`:

```ts
const { error } = await supabaseAdmin.from('entities').insert({
  id,
  title,
  type: 'note',
  content: entityContent,
  parent_id: parentId || null,
  workspace_id: workspaceId,
  last_modified: Date.now()
})
```

Also update the function signature to accept `blocks`:

```ts
async create_note({ title, content, blocks, parentId }: { title: string, content?: string, blocks?: any[], parentId?: string }, context: any) {
```

- [ ] **Step 3: Update `update_note` handler**

Find the `update_note` handler (~line 212). Update signature:

```ts
async update_note({ id, title, content, blocks }: { id: string, title?: string, content?: string, blocks?: any[] }, context: any) {
```

Update the body content logic. Find:

```ts
if (content) updates.content = [{ id: 'b1', type: 'text', content }]
```

Replace with:

```ts
if (blocks && Array.isArray(blocks)) {
  try {
    updates.content = normalizeBlocks(blocks as BlockInput[]);
  } catch (e: any) {
    return { error: `Invalid blocks: ${e.message}` };
  }
} else if (content) {
  updates.content = parseMarkdownToBlocks(content);
}
```

- [ ] **Step 4: Add `append_note_blocks` handler**

After the `update_note` handler and before `delete_note`, add:

```ts
/**
 * Append Note Blocks
 */
async append_note_blocks({ id, blocks }: { id: string, blocks: any[] }, context: any) {
  if (!supabaseAdmin) return { error: 'Supabase not configured' }
  if (!context?.userId) return { error: 'User not identified' }
  if (!blocks || !Array.isArray(blocks)) return { error: 'blocks is required and must be an array' }

  try {
    let normalized: any[];
    try {
      normalized = normalizeBlocks(blocks as BlockInput[]);
    } catch (e: any) {
      return { error: `Invalid blocks: ${e.message}` };
    }

    const { data: entity, error: fetchError } = await supabaseAdmin
      .from('entities')
      .select('content')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    const existing = Array.isArray(entity?.content) ? entity.content : [];
    const merged = [...existing, ...normalized];

    const { error } = await supabaseAdmin
      .from('entities')
      .update({ content: merged, last_modified: Date.now() })
      .eq('id', id);

    if (error) throw error;
    return { success: true, id, appended: normalized.length }
  } catch (e: any) {
    logger.error('Failed to append note blocks:', e.message)
    return { error: e.message }
  }
},
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/bot/tools/handlers.ts
git commit -m "feat: update create/update_note and add append_note_blocks handler"
```

---

## Task 10: Update bot prompts and run full test suite

**Files:**
- Modify: `bot prompts(premission to edit needed!)/mode-default.txt`
- Modify: `bot prompts(premission to edit needed!)/mode-pro.txt`

- [ ] **Step 1: Append formatting guidance to mode-default.txt**

Open `bot prompts(premission to edit needed!)/mode-default.txt` and append at the end:

```
When writing notes via tools, prefer the `blocks` parameter (structured nested blocks) for any content with lists, headings, or checklists. When answering in chat, format lists as Markdown — indent each nested level by 2 spaces. The user can paste your reply directly into a note and it will render with full nesting.
```

- [ ] **Step 2: Append the same guidance to mode-pro.txt**

Open `bot prompts(premission to edit needed!)/mode-pro.txt` and append at the end the same paragraph as Step 1.

- [ ] **Step 3: Run the full test suite**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 4: Commit everything**

```bash
git add "bot prompts(premission to edit needed!)/mode-default.txt" "bot prompts(premission to edit needed!)/mode-pro.txt"
git commit -m "docs: add bot formatting guidance for nested lists and markdown paste"
```

---

## Manual Verification Checklist

After all tasks complete, verify these in the browser (run `npm run dev` first):

- [ ] Open a note, create a `- bullet` list item, press Tab → marker becomes ○ (open circle)
- [ ] Press Tab again → marker becomes ■ (filled square)
- [ ] Press Tab again → marker cycles back to • (solid dot)
- [ ] Same cycle for numbered list: `1.` → `a.` → `i.`
- [ ] Numbered list: create `1, 2` items, Tab the second → it becomes `1.a`, the outer continues at `2` after unindenting
- [ ] Enter on a non-empty bullet that has sub-items → new item appears as first child, not after all children
- [ ] Paste this text into an empty note body (Ctrl+V):
  ```
  - First item
    - Nested item
      - Deep item
  - Second item
  ```
  → Should render as 2 top-level bullets, with nesting, not flat text
- [ ] Paste plain prose → renders as plain text (no false conversion)

---

## Self-Review Notes

- **Spec coverage:** All 6 behavior requirements covered. `formatCounter` (arabic/alpha/roman) ✓. Paste heuristic `looksLikeMarkdown` ✓. Bot `blocks` param ✓. `append_note_blocks` ✓. Bot prompt guidance ✓.
- **Placeholder scan:** No TBD/TODO. All code complete.
- **Type consistency:** `BlockInput` defined in Task 1, imported in Tasks 4, 8, 9. `formatCounter` defined in Task 1 (stub) / Task 2 (impl), imported in Task 5. `getListCounter` replaces `getListNumber` in Task 6 only.
- **Bug fix included:** `isList`/`isChecklist` hoisted in Task 5 (was referenced before declaration on line 214).
