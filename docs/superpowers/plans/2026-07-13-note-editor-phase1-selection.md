# Note Editor Phase 1 — Cross-Block Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the note editor feel like a plain text document — drag-select a passage spanning several blocks, type over it, and get what a text file would give you.

**Architecture:** The blocks container becomes a **single `contentEditable` editing host**. Individual blocks become plain `<div>`s inside it instead of each being its own editing host. Destructive multi-block operations (type / Backspace / Delete / Cut / Paste over a cross-block selection) are intercepted at the container via `beforeinput` and applied as a controlled store operation using a pure, unit-tested merge function.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zustand store, Tailwind, vitest (`environment: 'node'`), Playwright (already a devDependency).

---

## Read this first — you have no context, so do not re-derive these

### The one fact the entire plan rests on

**A native browser `Selection` cannot cross an editing-host boundary.** Every element with `contenteditable="true"` is its own editing host.

This was **measured in headless Chromium**, not assumed:

| Model | Structure | Drag-select from block 1 into block 2 |
|---|---|---|
| **A** | each block has its own `contenteditable="true"` | selects `"t "` — anchor **and** focus both remain in block 1. **Selection never leaves the block.** |
| **B** | one `contenteditable="true"` wrapper; blocks are plain `<div>`s inside | selects `"t block text\nSecond"` — anchor in block 1, focus in block 2. **True character-level cross-block selection.** |

**Consequences you must accept without re-litigating:**

1. **Making every block always-editable does NOT fix cross-block selection.** It reproduces the original bug with every block editable. Do not "simplify" this plan back to toggling `contentEditable` per block.
2. **This is why Notion snaps to whole-block selection** and **why Obsidian gets character-level selection** (Obsidian is one CodeMirror document = one host).
3. Under Model B, the browser **already implements our merge rule natively.** Typing `X` over a cross-block selection produced:
   ```
   before:  <div id="b1">First block text</div>   <div id="b2">Second block text</div>
   after :  <div id="b1">FirsX block text</div>
   ```
   First block wins, keeps its identity, fully-selected block gone, cursor at the seam. We still intercept — see below — because the store must stay in sync, but we are working *with* the browser, not against it.

To re-verify: render two sibling `contenteditable` divs and one `contenteditable` wrapper containing two plain divs, drag from block 1 to block 2 with Playwright's mouse API, and read `window.getSelection()`'s `anchorNode` / `focusNode`.

### Why we intercept at all

Block content is stored as **HTML** (`BlockRenderer.tsx:344`, `contentRef.current.innerHTML`) and written back to the Zustand store on every `onInput`. Under one editing host, an uncontrolled destructive edit lets the browser rewrite several blocks' DOM at once while React/the store only learns about one of them — **silently losing text.** So: selection stays fully native; destructive **multi-block** operations are intercepted and applied through the store.

Single-block edits are NOT intercepted. They keep working exactly as they do today.

### DO NOT DO THESE — a previous attempt did, and destroyed the editor

- **Do not install or use TipTap / ProseMirror / Lexical / Slate / CodeMirror or any editor library.** A previous attempt migrated to TipTap on the false premise that browsers cannot select across contenteditable blocks. It destroyed the notes and was reverted. This plan uses **our own React components and our own store**. `@tiptap/*` packages still linger in `package.json`; ignore them, do not import them.
- **Do not rebuild undo/redo.** It already exists: `NoteEditor.tsx:519-520` (`history`, `historyIndex`), `:672-688` (`undo`, `redo`), and `persistBlocks` at `:522` already pushes history.
- **Do not rebuild the selection toolbar.** `SelectionToolbar.tsx` (323 lines) already exists and is already mounted at `NoteEditor.tsx:1709`.
- **Do not claim success from a passing typecheck.** `npx tsc --noEmit` passing is NOT evidence that a cursor lands correctly. The previous attempt did exactly this and the user replied: *"only thing that changed is ctrl+z."*

### Scope discipline

This plan is **Phase 1 only**. Do **not** touch: cursor styles, the Enter/Shift+Enter/Ctrl+Enter scheme, block colors, popup positioning, the selection toolbar's contents, column removal, or the media block. Those are Phase 2 and are tracked in the spec. Fixing them here will make Phase 1 impossible to review.

**Spec:** `docs/superpowers/specs/2026-07-12-note-editor-design.md`

---

## Global Constraints

- **No new dependencies.** Nothing gets installed. Playwright and vitest are already present.
- **No editor library.** See DO NOT DO THESE above.
- **Blocks are stored as HTML strings** in `EditorBlock.content` (`src/data/store.types.ts:105-108`). Preserve that. Do not convert to Markdown or JSON nodes.
- **vitest runs with `environment: 'node'`** (`vitest.config.ts`). The merge function must be **pure** — no DOM APIs inside it — so it tests under node with no jsdom.
- **Test files are colocated**: `src/lib/editor/*.test.ts` (existing examples: `markdownBlocks.test.ts`, `frontmatter.test.ts`, `columnsMarkdown.test.ts`). Follow that convention.
- **Path alias:** `@/` → `./src/` (`vitest.config.ts`, `tsconfig.json`).
- **Run tests with:** `npm test` (`vitest run`). Typecheck with `npx tsc --noEmit`.
- **Platform:** Windows, PowerShell primary. A Bash tool is available. Prefer forward slashes in paths.
- **Do not stage or commit files you did not change.** The user keeps parallel uncommitted edits in the working tree. `git add` only the exact files named in each task.

---

## The merge rule (first block wins)

When a selection spans more than one block and is deleted or typed over:

1. The surviving text is the **unselected head of the first block** joined with the **unselected tail of the last block**, forming **one** block.
2. That block **keeps the first block's `type`, `style`, and all other properties.** Fully-selected blocks in between are deleted outright.
3. The **cursor lands at the seam** — at the boundary between the surviving head and the surviving tail, i.e. at offset `head.length` within the merged block.

"First" means **first in document order**, so the result is identical whether the user dragged top-to-bottom or bottom-to-top.

### Worked example (this is the acceptance test)

Blocks: H1 `My Great Title` / paragraph `Some paragraph text here` / H2 `Another subheading`.
Select from offset 8 in the H1 (after `My Great`), through the entire paragraph, to offset 7 in the H2 (after `Another`). Type `X`.

Offsets are exact: `'My Great Title'.slice(0, 8) === 'My Great'` and `'Another subheading'.slice(7) === ' subheading'` — the surviving tail keeps its leading space, which is what makes the result read naturally.

```
BEFORE                                AFTER
─────────────────────────────         ─────────────────────────────
# My Great Title                      # My GreatX subheading
          └─ selection starts          (ONE H1 block; cursor right after X)
                                       (paragraph: fully selected → deleted)
Some paragraph text here               (H2: gone as a block; its surviving
                                        tail "subheading" merged into the H1)
## Another subheading
           └─ selection ends
```

Result: a single **H1** reading `My GreatX subheading`, cursor immediately after `X`.

### Consequent cases (correct, though they may look surprising)

- Selecting a whole heading plus part of the next paragraph, then typing, leaves a **heading** containing the paragraph's tail. Obeys rule 2. Matches Microsoft Word. Rare in practice, and undoable with Ctrl+Z.
- Select-all + type leaves **one empty block of the first block's type**, cursor in it.

---

## File Structure

| File | Responsibility |
|---|---|
| **Create** `src/lib/editor/mergeSelection.ts` | Pure merge logic. No DOM. Given blocks + start/end block IDs + offsets, returns the new block list and the cursor position. |
| **Create** `src/lib/editor/mergeSelection.test.ts` | Exhaustive vitest coverage of the merge rule. |
| **Create** `src/lib/editor/domSelection.ts` | The DOM↔block bridge. Reads `window.getSelection()` and maps it to `{ startBlockId, startOffset, endBlockId, endOffset }` in document order. Also restores a cursor to a block at an offset. This is the only file allowed to touch `window.getSelection()`. |
| **Modify** `src/components/editor/BlockRenderer.tsx:1496` | Block content div stops being its own editing host. |
| **Modify** `src/components/editor/NoteEditor.tsx:1406-1409` | Blocks container becomes the single `contentEditable` host; add the `beforeinput` interceptor. |
| **Modify** `src/app/globals.css` | Subtle tint on blocks touched by the selection. |
| **Create** `scripts/probe-selection.mjs` | Headless Playwright probe proving the editing-host fact. Kept in the repo so it is never re-derived from memory. |

**Text offsets:** the merge function works on **plain text offsets** (`textContent`), not HTML offsets. Task 2 converts a DOM position into a plain-text offset within the block. Rich inline formatting inside the *unselected head/tail* is preserved by slicing the block's HTML at the corresponding position — Task 2 provides `sliceHtmlByTextOffset` for this.

---

### Task 1: Pure merge logic

**Files:**
- Create: `src/lib/editor/mergeSelection.ts`
- Test: `src/lib/editor/mergeSelection.test.ts`

**Interfaces:**
- Consumes: `EditorBlock` from `@/data/store.types` (fields used: `id`, `type`, `content`; all other fields are carried through untouched).
- Produces:
  ```ts
  export interface BlockSelection {
    startBlockId: string;
    startOffset: number;  // plain-text offset within the start block
    endBlockId: string;
    endOffset: number;    // plain-text offset within the end block
  }

  export interface MergeResult {
    blocks: EditorBlock[];      // the new full block list
    cursorBlockId: string;      // block the cursor lands in
    cursorOffset: number;       // plain-text offset within it (the seam)
  }

  /**
   * `survivingHtml` carries the unselected head of the first block and the
   * unselected tail of the last block, ALREADY SLICED AS HTML by the caller
   * (via sliceHtmlByTextOffset from Task 2, which has the DOM).
   *
   * This is why formatting is preserved: bold/links inside text the user never
   * selected must survive the merge. Rebuilding the block from plain text would
   * silently destroy them — that is data loss, not a cosmetic issue.
   *
   * The caller does the slicing because this function must stay DOM-free to run
   * under vitest's `environment: 'node'`.
   */
  export interface SurvivingHtml {
    headHtml: string;   // HTML of first block's content BEFORE the selection
    tailHtml: string;   // HTML of last block's content AFTER the selection
  }

  export function mergeAcrossBlocks(
    blocks: EditorBlock[],
    selection: BlockSelection,
    insertText: string,          // "" for delete/backspace; the typed text otherwise
    surviving: SurvivingHtml,
  ): MergeResult;
  ```
  Task 3 calls `mergeAcrossBlocks`. Task 2 produces both the `BlockSelection` and the `SurvivingHtml` that feed it.

**Note on `blocks`:** operate on the **flat top-level list** only. Nested `children` (used by lists/columns) are out of scope for Phase 1 — if either endpoint is not found in the top-level list, return the input unchanged (Task 3 then falls back to native behavior). This keeps Phase 1 contained; the user's reported pain is top-level paragraphs.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/editor/mergeSelection.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mergeAcrossBlocks, type BlockSelection, type SurvivingHtml } from './mergeSelection';
import type { EditorBlock } from '@/data/store.types';

const b = (id: string, type: EditorBlock['type'], content: string): EditorBlock =>
  ({ id, type, content } as EditorBlock);

// The spec's worked example: H1 / paragraph / H2
const doc = (): EditorBlock[] => [
  b('h1', 'heading1', 'My Great Title'),
  b('p', 'text', 'Some paragraph text here'),
  b('h2', 'heading2', 'Another subheading'),
];

const sel = (s: string, so: number, e: string, eo: number): BlockSelection =>
  ({ startBlockId: s, startOffset: so, endBlockId: e, endOffset: eo });

/**
 * Test helper standing in for the caller's DOM slicing. In production, Task 3
 * calls sliceHtmlByTextOffset (Task 2) to produce these. Here the fixtures are
 * plain text, so a plain-text slice is the correct equivalent.
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
// space; offset 8 would give 'subheading' with none). These were verified by
// running the algorithm — do not "correct" them by eye.

describe('mergeAcrossBlocks — the worked example', () => {
  it('typing X over an H1→H2 selection leaves one H1, cursor at the seam', () => {
    const r = merge(doc(), sel('h1', 8, 'h2', 7), 'X');

    expect(r.blocks).toHaveLength(1);
    expect(r.blocks[0].type).toBe('heading1');       // first block's type wins
    expect(r.blocks[0].id).toBe('h1');               // first block's identity wins
    expect(r.blocks[0].content).toBe('My GreatX subheading');
    expect(r.cursorBlockId).toBe('h1');
    expect(r.cursorOffset).toBe(9);                  // after "My Great" + "X"
  });

  it('deleting the same selection leaves one H1 with no X', () => {
    const r = merge(doc(), sel('h1', 8, 'h2', 7), '');

    expect(r.blocks).toHaveLength(1);
    expect(r.blocks[0].type).toBe('heading1');
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
    expect(r.blocks[0].type).toBe('heading1');       // still the FIRST block's type
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
    const four = [...doc(), b('h3', 'text', 'tail block')];
    const r = merge(four, sel('h1', 8, 'h3', 4), '');
    expect(r.blocks).toHaveLength(1);
    expect(r.blocks[0].content).toBe('My Great block');   // 'tail block'.slice(4) === ' block'
  });
});

describe('mergeAcrossBlocks — select all', () => {
  it('leaves one empty block of the first block type', () => {
    const r = merge(doc(), sel('h1', 0, 'h2', 18), '');
    expect(r.blocks).toHaveLength(1);
    expect(r.blocks[0].type).toBe('heading1');
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
      { ...b('h1', 'heading1', 'My Great Title'), bgColor: '#ff0000', align: 'center' } as EditorBlock,
      b('p', 'text', 'Some paragraph text here'),
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
      b('h1', 'heading1', 'Some <b>bold</b> title here'),   // text: "Some bold title here"
      b('p', 'text', 'paragraph'),
      b('h2', 'heading2', 'Another subheading'),
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
      b('h1', 'heading1', 'Title'),
      b('p', 'text', 'gone'),
      b('h2', 'heading2', 'see <a href="/x">the docs</a>'),
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
      [b('a', 'text', '<b>Bold</b> tail'), b('c', 'text', 'second')],
      sel('a', 9, 'c', 3),
      'X',
      { headHtml: '<b>Bold</b> ', tailHtml: 'ond' },   // head plain text = "Bold " = 5 chars
    );
    expect(r.cursorOffset).toBe(6);                    // 5 + len("X")
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npm test -- mergeSelection`
Expected: FAIL — `Failed to resolve import "./mergeSelection"`.

- [ ] **Step 3: Implement the merge function**

Create `src/lib/editor/mergeSelection.ts`:

```ts
import type { EditorBlock } from '@/data/store.types';

export interface BlockSelection {
  startBlockId: string;
  startOffset: number;
  endBlockId: string;
  endOffset: number;
}

export interface MergeResult {
  blocks: EditorBlock[];
  cursorBlockId: string;
  cursorOffset: number;
}

/**
 * The unselected HTML that must survive the merge, already sliced by the caller.
 * The caller owns the slicing because it has the DOM (sliceHtmlByTextOffset);
 * this module must stay DOM-free to run under vitest's node environment.
 */
export interface SurvivingHtml {
  headHtml: string;   // first block's content BEFORE the selection starts
  tailHtml: string;   // last block's content AFTER the selection ends
}

/** Plain text length of an HTML string — used to place the cursor at the seam. */
export function htmlTextLength(html: string): number {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .length;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Merge a selection that spans two or more top-level blocks.
 *
 * First block wins: the surviving block keeps the FIRST block's id, type and
 * every other property. Its content becomes
 *     headHtml + insertText + tailHtml
 * and blocks fully covered by the selection are removed.
 *
 * headHtml/tailHtml arrive as HTML, so bold, links and other inline formatting
 * inside text the user NEVER SELECTED survive the merge. Rebuilding from plain
 * text here would silently destroy them — that is data loss, not a rough edge.
 *
 * Returns the input unchanged if the selection does not span multiple
 * top-level blocks, so the caller can fall back to native browser behavior.
 */
export function mergeAcrossBlocks(
  blocks: EditorBlock[],
  selection: BlockSelection,
  insertText: string,
  surviving: SurvivingHtml,
): MergeResult {
  const noChange = (): MergeResult => ({
    blocks,
    cursorBlockId: selection.startBlockId,
    cursorOffset: selection.startOffset,
  });

  if (selection.startBlockId === selection.endBlockId) return noChange();

  const aIdx = blocks.findIndex(b => b.id === selection.startBlockId);
  const bIdx = blocks.findIndex(b => b.id === selection.endBlockId);
  if (aIdx === -1 || bIdx === -1) return noChange();

  // Normalize to document order — the result must not depend on drag direction.
  const forward = aIdx < bIdx;
  const firstIdx = forward ? aIdx : bIdx;
  const lastIdx = forward ? bIdx : aIdx;

  const first = blocks[firstIdx];
  const { headHtml, tailHtml } = surviving;

  const merged: EditorBlock = {
    ...first,                                    // first block wins: id, type, colors, align…
    content: headHtml + escapeHtml(insertText) + tailHtml,
  };

  const next = [
    ...blocks.slice(0, firstIdx),
    merged,
    ...blocks.slice(lastIdx + 1),
  ];

  return {
    blocks: next,
    cursorBlockId: merged.id,
    cursorOffset: htmlTextLength(headHtml) + insertText.length,
  };
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npm test -- mergeSelection`
Expected: PASS, all cases green.

If a test fails, fix the implementation — **not the test**. The tests encode the spec's agreed behavior.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors in `src/lib/editor/mergeSelection.ts`. (The repo may have pre-existing errors elsewhere; only your file must be clean.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/editor/mergeSelection.ts src/lib/editor/mergeSelection.test.ts
git commit -m "feat(editor): pure first-block-wins merge for cross-block selections"
```

---

### Task 2: DOM↔block selection bridge

**Files:**
- Create: `src/lib/editor/domSelection.ts`
- Test: `src/lib/editor/domSelection.test.ts`

**Interfaces:**
- Consumes: `BlockSelection` from `./mergeSelection` (Task 1).
- Produces:
  ```ts
  export function getBlockSelection(root: HTMLElement): BlockSelection | null;
  export function sliceHtmlByTextOffset(html: string, start: number, end: number): string;
  export function restoreCursor(root: HTMLElement, blockId: string, textOffset: number): void;
  ```
  Task 3 calls `getBlockSelection` and `restoreCursor`.

`getBlockSelection` returns `null` when there is no selection, when it is collapsed (a caret, not a range), or when both endpoints are in the same block — the caller then does nothing and lets the browser behave natively.

**How blocks are identified in the DOM:** each block's wrapper carries `data-block-id={block.id}` (already present, `BlockRenderer.tsx:1452`). Walk up from a selection node with `.closest('[data-block-id]')`.

- [ ] **Step 1: Write the failing test for `sliceHtmlByTextOffset`**

This is the only pure part; the DOM parts are covered by Task 5's Playwright probe instead (vitest runs under `environment: 'node'` with no DOM).

Create `src/lib/editor/domSelection.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { sliceHtmlByTextOffset } from './domSelection';

describe('sliceHtmlByTextOffset', () => {
  it('slices plain text by text offsets', () => {
    expect(sliceHtmlByTextOffset('Hello world', 0, 5)).toBe('Hello');
    expect(sliceHtmlByTextOffset('Hello world', 6, 11)).toBe('world');
  });

  it('keeps inline formatting that lies wholly inside the slice', () => {
    const html = 'a <b>bold</b> c';   // text: "a bold c"
    expect(sliceHtmlByTextOffset(html, 0, 8)).toBe('a <b>bold</b> c');
  });

  it('drops formatting that lies wholly outside the slice', () => {
    const html = 'a <b>bold</b> c';   // text: "a bold c"
    expect(sliceHtmlByTextOffset(html, 7, 8)).toBe('c');
  });

  it('returns an empty string for an empty range', () => {
    expect(sliceHtmlByTextOffset('Hello', 3, 3)).toBe('');
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm test -- domSelection`
Expected: FAIL — `Failed to resolve import "./domSelection"`.

- [ ] **Step 3: Implement the bridge**

Create `src/lib/editor/domSelection.ts`:

```ts
import type { BlockSelection } from './mergeSelection';

/** Plain-text offset of (node, offset) measured from the start of `root`. */
function textOffsetWithin(root: Node, node: Node, offset: number): number {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let total = 0;
  let current: Node | null;
  while ((current = walker.nextNode())) {
    if (current === node) return total + offset;
    total += (current.textContent ?? '').length;
  }
  // The node is an element (e.g. an empty block): offset counts child nodes.
  return total;
}

/**
 * Read the current selection and express it in block coordinates.
 * Returns null when there is no range, when it is collapsed, or when it lies
 * inside a single block — in all of those cases the browser handles it natively.
 */
export function getBlockSelection(root: HTMLElement): BlockSelection | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;

  const blockOf = (n: Node | null): HTMLElement | null => {
    const el = n?.nodeType === Node.TEXT_NODE ? n.parentElement : (n as HTMLElement | null);
    return el?.closest('[data-block-id]') ?? null;
  };

  const anchorBlock = blockOf(sel.anchorNode);
  const focusBlock = blockOf(sel.focusNode);
  if (!anchorBlock || !focusBlock) return null;
  if (!root.contains(anchorBlock) || !root.contains(focusBlock)) return null;

  const startBlockId = anchorBlock.dataset.blockId!;
  const endBlockId = focusBlock.dataset.blockId!;
  if (startBlockId === endBlockId) return null;   // single block → native

  return {
    startBlockId,
    startOffset: textOffsetWithin(anchorBlock, sel.anchorNode!, sel.anchorOffset),
    endBlockId,
    endOffset: textOffsetWithin(focusBlock, sel.focusNode!, sel.focusOffset),
  };
}

/**
 * Slice an HTML string by PLAIN-TEXT offsets, preserving inline tags that fall
 * inside the range. This is what keeps bold/links alive in the surviving head
 * and tail of a cross-block merge.
 *
 * Pass Number.MAX_SAFE_INTEGER as `end` to slice through to the end.
 */
export function sliceHtmlByTextOffset(html: string, start: number, end: number): string {
  if (start >= end) return '';
  const host = document.createElement('div');
  host.innerHTML = html;

  const range = document.createRange();
  // Default to the whole host, so an `end` past the text length slices to the
  // end instead of leaving the range unset.
  range.selectNodeContents(host);

  const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
  let seen = 0;
  let startSet = false;
  let endSet = false;
  let node: Node | null;

  while ((node = walker.nextNode())) {
    const len = (node.textContent ?? '').length;
    if (!startSet && seen + len >= start) {
      range.setStart(node, start - seen);
      startSet = true;
    }
    if (startSet && !endSet && seen + len >= end) {
      range.setEnd(node, end - seen);
      endSet = true;
      break;
    }
    seen += len;
  }
  if (!startSet) return '';   // start is past the end of the text

  const out = document.createElement('div');
  out.appendChild(range.cloneContents());
  return out.innerHTML;
}

/** Place the caret inside `blockId` at a plain-text offset. */
export function restoreCursor(root: HTMLElement, blockId: string, textOffset: number): void {
  const block = root.querySelector<HTMLElement>(`[data-block-id="${blockId}"]`);
  if (!block) return;

  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  let seen = 0;
  let target: Node | null = null;
  let localOffset = 0;
  let node: Node | null;

  while ((node = walker.nextNode())) {
    const len = (node.textContent ?? '').length;
    if (seen + len >= textOffset) {
      target = node;
      localOffset = textOffset - seen;
      break;
    }
    seen += len;
  }

  const range = document.createRange();
  if (target) {
    range.setStart(target, Math.min(localOffset, (target.textContent ?? '').length));
  } else {
    range.selectNodeContents(block);   // empty block
    range.collapse(true);
  }
  range.collapse(true);

  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npm test -- domSelection`
Expected: PASS.

**If `sliceHtmlByTextOffset` fails because `document` is undefined**, that means vitest's node environment has no DOM. In that case add exactly this line at the top of the test file — do not change `vitest.config.ts`, which other tests depend on:

```ts
// @vitest-environment jsdom
```

If `jsdom` is not installed, delete `domSelection.test.ts` entirely and rely on Task 5's Playwright probe to cover this function. **Do not install jsdom.** Note this decision in the commit message.

- [ ] **Step 5: Commit**

```bash
git add src/lib/editor/domSelection.ts src/lib/editor/domSelection.test.ts
git commit -m "feat(editor): DOM-to-block selection bridge"
```

---

### Task 3: One editing host + the interceptor

**This is the load-bearing task.** It is the one that can destabilize the editor.

**Files:**
- Modify: `src/components/editor/BlockRenderer.tsx:1496`
- Modify: `src/components/editor/NoteEditor.tsx:1405-1409`

**Interfaces:**
- Consumes: `mergeAcrossBlocks`, `BlockSelection` (Task 1); `getBlockSelection`, `restoreCursor` (Task 2); the existing `persistBlocks` (`NoteEditor.tsx:522`) and `blocks` state.
- Produces: nothing new for later tasks.

- [ ] **Step 1: Stop each block from being its own editing host**

In `src/components/editor/BlockRenderer.tsx`, line 1496 currently reads:

```tsx
            contentEditable={(isFocused && !isReadOnly) ? true : undefined}
```

Replace with:

```tsx
            // The blocks container is the single contentEditable host (see
            // NoteEditor). A per-block contenteditable would be its own editing
            // host, and a native Selection cannot cross an editing-host
            // boundary — that is what made selection stop at block edges.
            contentEditable={undefined}
```

Leave everything else in that element alone — `onInput`, `onKeyDown`, `onFocus`, `onPaste` and the refs all still work, because events bubble from inside the host.

- [ ] **Step 2: Make the blocks container the single editing host**

In `src/components/editor/NoteEditor.tsx`, the blocks container at lines 1405-1409 currently reads:

```tsx
            return (
              <div
                className="space-y-2 min-h-[50vh] note-editor-bg"
              >
                <div className="flex flex-col note-editor-bg">
```

Replace the **outer** div with:

```tsx
            return (
              <div
                ref={blocksHostRef}
                contentEditable={!isReadMode}
                suppressContentEditableWarning
                onBeforeInput={handleHostBeforeInput}
                className="space-y-2 min-h-[50vh] note-editor-bg outline-none"
              >
                <div className="flex flex-col note-editor-bg">
```

- [ ] **Step 3: Add the ref, the interceptor, and cursor restoration**

In `src/components/editor/NoteEditor.tsx`, add near the other refs (`editorRef` is at line 496):

```tsx
  const blocksHostRef = useRef<HTMLDivElement>(null);
  const pendingCursor = useRef<{ blockId: string; offset: number } | null>(null);
```

Add these imports at the top of the file:

```tsx
import { mergeAcrossBlocks } from '@/lib/editor/mergeSelection';
import { getBlockSelection, restoreCursor, sliceHtmlByTextOffset } from '@/lib/editor/domSelection';
```

Add the interceptor next to the other `useCallback`s (e.g. just after `persistBlocks`, which ends at line 557):

```tsx
  // A native Selection can span blocks now that they share one editing host.
  // Let the browser handle everything inside a single block; intercept only
  // DESTRUCTIVE edits that span two or more blocks, so the store cannot fall
  // out of sync with a DOM the browser rewrote across several blocks at once.
  const handleHostBeforeInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
    if (isReadMode) return;
    const host = blocksHostRef.current;
    if (!host) return;

    const native = e.nativeEvent as InputEvent;
    const DESTRUCTIVE = new Set([
      'insertText',
      'insertParagraph',
      'insertLineBreak',
      'insertFromPaste',
      'deleteContentBackward',
      'deleteContentForward',
      'deleteByCut',
      'deleteByDrag',
    ]);
    if (!DESTRUCTIVE.has(native.inputType)) return;

    const selection = getBlockSelection(host);
    if (!selection) return;   // single block or caret → native behavior

    e.preventDefault();

    const insert =
      native.inputType === 'insertText' ? (native.data ?? '')
      : native.inputType === 'insertFromPaste'
        ? (native.dataTransfer?.getData('text/plain') ?? '')
      : '';

    // Slice the surviving head/tail as HTML, so bold/links in text the user
    // never selected are preserved. Doing this here (not in mergeSelection)
    // keeps the merge function DOM-free and therefore unit-testable.
    const aIdx = blocks.findIndex(b => b.id === selection.startBlockId);
    const bIdx = blocks.findIndex(b => b.id === selection.endBlockId);
    if (aIdx === -1 || bIdx === -1) return;

    const forward = aIdx < bIdx;
    const first = blocks[forward ? aIdx : bIdx];
    const last = blocks[forward ? bIdx : aIdx];
    const headOffset = forward ? selection.startOffset : selection.endOffset;
    const tailOffset = forward ? selection.endOffset : selection.startOffset;

    const surviving = {
      headHtml: sliceHtmlByTextOffset(first.content, 0, headOffset),
      tailHtml: sliceHtmlByTextOffset(last.content, tailOffset, Number.MAX_SAFE_INTEGER),
    };

    const result = mergeAcrossBlocks(blocks, selection, insert, surviving);
    if (result.blocks === blocks) return;   // guard said no change

    pendingCursor.current = { blockId: result.cursorBlockId, offset: result.cursorOffset };
    persistBlocks(result.blocks);
  }, [blocks, isReadMode, persistBlocks]);

  // Put the caret at the seam after React has re-rendered the merged blocks.
  useLayoutEffect(() => {
    const target = pendingCursor.current;
    const host = blocksHostRef.current;
    if (!target || !host) return;
    pendingCursor.current = null;
    restoreCursor(host, target.blockId, target.offset);
  }, [blocks]);
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors in `NoteEditor.tsx` or `BlockRenderer.tsx`.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/NoteEditor.tsx src/components/editor/BlockRenderer.tsx
git commit -m "feat(editor): single contenteditable host + cross-block merge interceptor"
```

**Do not claim this works.** It compiles. Whether it behaves is Task 5 and Task 6.

---

### Task 4: Selection tint on touched blocks

The user asked for: *"text selection + block of the selected text highlights a bit."* Native character highlight **stays**; this adds a faint tint to every block the selection touches.

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add the tint**

Append to `src/app/globals.css`:

```css
/* Cross-block selection: the native text highlight remains, and every block the
   selection touches gets a faint tint so the span is obvious at a glance. */
.editor-block:has(::selection) {
  background-color: var(--bone-3, rgba(255, 255, 255, 0.03));
  border-radius: var(--radius-medium);
  transition: background-color 80ms ease-out;
}
```

`.editor-block` is the class already on each block wrapper (`BlockRenderer.tsx:1454`).

- [ ] **Step 2: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(editor): tint blocks touched by a cross-block selection"
```

If Task 6 shows `:has(::selection)` does not fire in Safari/Chrome, fall back to tagging touched blocks with a `data-selected` attribute from a `selectionchange` listener in `NoteEditor.tsx` and styling `[data-selected]`. Prefer the CSS-only version if it works.

---

### Task 5: Keep the editing-host proof in the repo

So no future session re-derives the browser fact from memory and gets it backwards — which is exactly what destroyed the previous attempt.

**Files:**
- Create: `scripts/probe-selection.mjs`

- [ ] **Step 1: Write the probe**

Create `scripts/probe-selection.mjs`:

```js
/**
 * Proves the fact the whole editor design rests on:
 *   a native Selection CANNOT cross an editing-host boundary.
 *
 * Model A — each block its own contenteditable → selection stays in block 1.
 * Model B — one contenteditable host, plain-div blocks → selection spans them.
 *
 * Run: node scripts/probe-selection.mjs
 */
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

await page.setContent(`
  <div id="A-wrap">
    <div class="blk" contenteditable="true" id="a1">First block text</div>
    <div class="blk" contenteditable="true" id="a2">Second block text</div>
  </div>
  <hr>
  <div id="B-wrap" contenteditable="true">
    <div class="blk" id="b1">First block text</div>
    <div class="blk" id="b2">Second block text</div>
  </div>
  <style>.blk{padding:8px;font:16px monospace}</style>
`);

async function dragSelect(fromSel, toSel) {
  const from = await page.locator(fromSel).boundingBox();
  const to = await page.locator(toSel).boundingBox();
  await page.mouse.move(from.x + 40, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + 60, to.y + to.height / 2, { steps: 15 });
  await page.mouse.up();
  return page.evaluate(() => {
    const s = window.getSelection();
    const blk = (n) => n?.parentElement?.closest?.('.blk')?.id;
    return {
      text: s.toString(),
      anchorBlock: blk(s.anchorNode),
      focusBlock: blk(s.focusNode),
      crossesBlocks: blk(s.anchorNode) !== blk(s.focusNode),
    };
  });
}

const a = await dragSelect('#a1', '#a2');
console.log('MODEL A (per-block contenteditable):', a);
if (a.crossesBlocks) throw new Error('UNEXPECTED: Model A crossed blocks.');

await page.evaluate(() => window.getSelection().removeAllRanges());

const b = await dragSelect('#b1', '#b2');
console.log('MODEL B (single host):            ', b);
if (!b.crossesBlocks) throw new Error('UNEXPECTED: Model B did NOT cross blocks.');

console.log('\n✓ Confirmed: only a single editing host permits cross-block selection.');
await browser.close();
```

- [ ] **Step 2: Run it**

Run: `node scripts/probe-selection.mjs`

Expected output:

```
MODEL A (per-block contenteditable): { text: 't ', anchorBlock: 'a1', focusBlock: 'a1', crossesBlocks: false }
MODEL B (single host):             { text: 't block text\nSecond', anchorBlock: 'b1', focusBlock: 'b2', crossesBlocks: true }

✓ Confirmed: only a single editing host permits cross-block selection.
```

- [ ] **Step 3: Commit**

```bash
git add scripts/probe-selection.mjs
git commit -m "test(editor): headless proof that selection cannot cross editing hosts"
```

---

### Task 6: Hand to the user for the feel test

**Stop here. Do not start Phase 2.** The whole point of shipping Phase 1 alone is that the user tests it before anything is stacked on top.

- [ ] **Step 1: Confirm the machine-verifiable parts**

```bash
npm test -- mergeSelection
npm test -- domSelection
node scripts/probe-selection.mjs
npx tsc --noEmit
```

All must pass.

- [ ] **Step 2: Report honestly**

Tell the user **exactly** what was verified and what was not. The required shape:

> Merge logic is unit-tested (N cases, including the H1→paragraph→H2 worked example). The editing-host fact is proven by the headless probe. Typecheck is clean.
>
> **The wiring is unverified** — whether the real browser Selection maps to the right blocks and offsets, and whether making the container the editing host broke anything else, I cannot know without the app running.
>
> Please try these and tell me what happens:
> 1. Drag-select a passage spanning four blocks. Continuous highlight? Are the touched blocks tinted?
> 2. Type over a multi-block selection. Does the first block win and keep its type? Cursor at the seam?
> 3. Backspace over a multi-block selection.
> 4. Cut, then Paste, over a multi-block selection.
> 5. Ctrl+Z. Does it restore in one step?
> 6. Anything else broken? Drag handle, click-to-focus, the `/` menu, typing in a single block.

**Never say "it works" when the accurate claim is "it compiles."** The previous attempt did that and the user replied *"only thing that changed is ctrl+z."*

- [ ] **Step 3: If it destabilizes the editor, stop and report**

Do **not** pile fixes on top of a broken editor. That is precisely how the previous attempt destroyed the notes. If cross-block selection does not work, or typing corrupts blocks, say so plainly and propose a diagnosis before changing more code.

---

## Known limitations of Phase 1 (accepted, not bugs)

- **Nested blocks (list children, column children) are out of scope.** `mergeAcrossBlocks` operates on the top-level list; a selection endpoint inside a nested child returns unchanged and the browser handles it natively. Lists get their own treatment if the user reports pain after testing.
- **Columns are still present.** They are removed in Phase 2.

**Inline formatting is NOT a limitation — it is preserved.** Bold, links and other inline markup inside the unselected head/tail survive the merge, because Task 3 slices them as HTML (`sliceHtmlByTextOffset`) and hands them to `mergeAcrossBlocks` via `SurvivingHtml`. Rebuilding the merged block from plain text would silently destroy formatting in text the user never selected — that is data loss, and it is why the merge function takes HTML rather than deriving text itself.

## Phase 2 (do not start without the user's go-ahead)

From `docs/superpowers/specs/2026-07-12-note-editor-design.md`: cursor styles; the Enter/Shift+Enter/Ctrl+Enter scheme; block/text colors (**a one-line fix at `BlockRenderer.tsx:1474`** — `colorStyle` is applied only when `bgColor` is set, so text color alone does nothing); popups flipping up near the viewport bottom; the six-item selection toolbar; deleting columns (wired into 5 files, needs a migration so nothing vanishes); and the unified media block (the largest item — a new block type, possibly its own phase).
