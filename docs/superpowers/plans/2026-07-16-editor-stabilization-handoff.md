# Note Editor Stabilization Handoff (Phase 1 bugfix round 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 8 user-reported editor bugs by finishing the single-editing-host migration: remove the leftover legacy per-row/per-block interactive layer that now fights the host-level handlers, make chrome non-editable, route structural edits through undo history, and stop the browser from natively merging React-owned block divs.

**Architecture:** `NoteEditor`'s blocks container is the ONE `contentEditable` host. All keyboard/input handling lives on that host (`handleHostKeyDown`, `handleHostInput`, `handleHostBeforeInput` in `NoteEditor.tsx`). Everything else (rows, blocks) must be passive marked divs (`data-block-id`, `data-block-content`, `data-row-id`) with NO contentEditable of their own, NO keydown/input/focus handlers, and NO focus-stealing effects. All non-text chrome (checkboxes, bullets, drag handles) must be `contentEditable={false}` islands.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zustand, vitest, Playwright (headless probes against `/dev-note`).

## Why the previous round broke (context you MUST internalize)

The previous handoff relocated keyboard logic to the host but **left the old per-row system alive** in `ListBlock.tsx`. Clicking a list row sets local `isFocused` → the row becomes its OWN nested `contentEditable` host → the OLD per-row handlers (`RowEl.onKeyDown` → `ListBlock.handleKeyDown`, `RowEl.onInput`) fire **in addition to** the new host-level handlers. Two competing implementations mutate the same rows on every keystroke. That, plus editable chrome (caret can land in front of checkboxes / in layout gaps) and browser-default structural edits merging React-owned divs, produced all the "lists are unstable" chaos.

**The lesson: this plan is mostly about DELETING code. Do not keep "just in case" fallbacks. If this plan says delete, delete.**

## Global Constraints

- Work directly on `main`. One commit per task, exact messages given below.
- Do NOT attempt any editor-library migration (no TipTap/ProseMirror). Fix in place.
- Do NOT delete or modify `src/app/dev-note/page.tsx` (the test harness).
- Keep `flattenRows` and `nestRows` exported from `ListBlock.tsx` — `NoteEditor.tsx` imports them.
- After EVERY task: run `npx tsc --noEmit` (must be clean) and `npx vitest run src/lib/editor/` (all tests must pass) before committing.
- If a verification step fails and the fix isn't obvious within the task's own files, STOP, record the failure verbatim in the RESULTS file (Task 9), and move on. Do NOT improvise fixes in files this plan doesn't mention.
- Do not "improve" anything not listed here. No refactors, no style changes, no extra cleanup.
- The dev server for probes: `npm run dev` (assume port 3000; check output). Probe page: `http://localhost:3000/dev-note`. The page exposes `window.__store` (Zustand store; read state via `window.__store.getState()`).

---

### Task 1: Strip the legacy interactive layer from ListBlock

**Files:**
- Modify: `src/components/editor/ListBlock.tsx` (full-file replacement below)
- Test: existing `npx vitest run src/lib/editor/` must stay green (listRowOps tests rely on `flattenRows` conventions, which do not change)

**Interfaces:**
- Consumes: nothing new.
- Produces: `ListBlock` with the SAME props signature as today (call site in `BlockRenderer.tsx` must NOT need changes). `flattenRows(block)` and `nestRows(rows, type)` exports unchanged. Rows render as passive divs marked `data-row-id={row.id}`; the marker/checkbox column is `contentEditable={false}`.

What is being removed and why:
- `RowEl`'s `contentEditable={(isFocused && !isReadOnly) ? true : undefined}` — creates a nested editing host that resurrects the old dual-handling system. Rows inherit editability from the NoteEditor host; they must never be hosts themselves.
- `RowEl`'s `isFocused` state, `onFocus`/`onBlur`/`onMouseDown` handlers, and the focus-stealing effect — dead/harmful under the single-host architecture (`document.activeElement` is always the host; blur never fires, so the state sticks).
- `RowEl`'s `onKeyDown`, `onInput`, `onPaste` — keyboard/input handling now lives ONLY in `NoteEditor.handleHostKeyDown` / `handleHostInput` / `handlePaste`.
- `ListBlock`'s entire `handleKeyDown`, `handleRowUpdate` input path, `focusRow`, arrow-key navigation, `rowRefs`/`registerRef`, `pendingFocusId`, `ignoreNextInput` — all served the deleted per-row system. Native caret movement handles arrows now. The only interactive thing ListBlock keeps is the checkbox toggle.

- [ ] **Step 1: Replace the entire contents of `src/components/editor/ListBlock.tsx` with:**

```tsx
"use client";

import React, { useRef, useCallback, useEffect } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EditorBlock, BlockType } from '@/data/store';
import { formatCounter } from '@/lib/editor/markdownBlocks';

export interface ListRow {
  id: string;
  content: string;
  checked?: boolean;
  depth: number;
}

/**
 * NOTE: row[0] of the returned array is always the list BLOCK itself
 * (id === block.id), not a child item — verified against the real render:
 * ListBlock renders rows.map((row, i) => <RowEl rowIndex={i} .../>) for
 * EVERY entry including index 0, so the block's own content is rendered as
 * an ordinary row. Consumers (see src/lib/editor/listRowOps.ts) rely on
 * this exact convention.
 */
export function flattenRows(block: EditorBlock): ListRow[] {
  const rows: ListRow[] = [];

  function walk(items: EditorBlock[], depth: number) {
    for (const item of items) {
      rows.push({ id: item.id, content: item.content, checked: item.checked, depth });
      if (item.children) {
        walk(item.children, depth + 1);
      }
    }
  }

  rows.push({ id: block.id, content: block.content, checked: block.checked, depth: 0 });
  walk(block.children ?? [], 0);

  return rows;
}

export function nestRows(rows: ListRow[], blockType: BlockType): { content: string; checked?: boolean; children: EditorBlock[] } {
  if (rows.length === 0) return { content: '', children: [] };

  function buildTree(items: ListRow[], minDepth: number): EditorBlock[] {
    const result: EditorBlock[] = [];
    let i = 0;
    while (i < items.length) {
      const row = items[i];
      if (row.depth < minDepth) break;
      const node: EditorBlock = { id: row.id, type: blockType, content: row.content, checked: row.checked };
      const childRows: ListRow[] = [];
      i++;
      while (i < items.length && items[i].depth > row.depth) {
        childRows.push(items[i]);
        i++;
      }
      if (childRows.length > 0) node.children = buildTree(childRows, row.depth + 1);
      result.push(node);
    }
    return result;
  }

  const first = rows[0];
  return {
    content: first.content,
    checked: first.checked,
    children: buildTree(rows.slice(1), 0),
  };
}

interface ListBlockProps {
  block: EditorBlock;
  listNumber?: number;
  onUpdate: (id: string, updates: Partial<EditorBlock>) => void;
  onExitBottom: () => void;
  onExitTop: () => void;
  onFocus?: (id: string) => void;
  isDraggingGlobal?: boolean;
  isReadOnly?: boolean;
  onMouseMove?: (e: React.MouseEvent) => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

// Rows are PASSIVE under the single-editing-host architecture: the NoteEditor
// blocks container is the only contentEditable, and all keyboard/input logic
// lives in its handleHostKeyDown/handleHostInput. A row div only:
//   1. marks itself with data-row-id for those host-level handlers,
//   2. imperatively syncs innerHTML from the store (it has no React children),
//   3. renders non-editable chrome (bullet/number/checkbox) beside the text.
// Do NOT add contentEditable, onKeyDown, onInput, or focus state here — that
// recreates the nested-editing-host dual-handling bug this file used to have.
function RowEl({
  row,
  rowIndex,
  rows,
  blockType,
  listNumber,
  onToggleCheck,
  isDraggingGlobal = false,
  isReadOnly = false,
  onMouseMove,
  onMouseLeave,
  onContextMenu,
}: {
  row: ListRow;
  rowIndex: number;
  rows: ListRow[];
  blockType: BlockType;
  listNumber?: number;
  onToggleCheck: (rowId: string) => void;
  isDraggingGlobal?: boolean;
  isReadOnly?: boolean;
  onMouseMove?: (e: React.MouseEvent) => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const lastContent = useRef<string | null>(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const isInitialMount = lastContent.current === null;
    if (isInitialMount || (el.innerHTML !== row.content && row.content !== lastContent.current)) {
      el.innerHTML = row.content;
    }
    lastContent.current = row.content;
  }, [row.content]);

  const d = row.depth % 3;

  const marker = () => {
    if (blockType === 'bulletList') {
      if (d === 0) return <div className="w-[5.5px] h-[5.5px] rounded-full bg-[var(--bone-70)] flex-shrink-0" />;
      if (d === 1) return <div className="w-[5.5px] h-[5.5px] rounded-sm border border-[var(--bone-70)] flex-shrink-0" />;
      return <div className="w-[5.5px] h-[5.5px] bg-[var(--bone-70)] flex-shrink-0" />;
    }
    if (blockType === 'dashedList') {
      if (d === 0) return <div className="w-[8px] h-[1px] bg-[var(--bone-70)] flex-shrink-0" />;
      if (d === 1) return <div className="w-[6px] h-[1px] bg-[var(--bone-70)] flex-shrink-0" />;
      return <div className="w-[3px] h-[3px] rounded-full bg-[var(--bone-70)] flex-shrink-0" />;
    }
    if (blockType === 'numberedList') {
      const counterStyle = d === 0 ? 'arabic' : d === 1 ? 'alpha' : 'roman';
      let count = 0;
      for (let i = 0; i <= rowIndex; i++) {
        if (rows[i].depth === row.depth) count++;
        if (i < rowIndex && rows[i].depth < row.depth) count = 0;
      }
      if (rowIndex === 0 && row.depth === 0 && listNumber != null) count = listNumber;
      return <span className="text-bone-70/40 text-[16px] font-normal leading-[1.6]" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>{formatCounter(count, counterStyle)}.</span>;
    }
    return null;
  };

  return (
    <div className="flex items-start w-full py-0.5" style={{ paddingLeft: `${row.depth * 24}px` }}>
      <div
        // Chrome island: NOT part of the editable text. Without this the
        // caret can be placed in front of the checkbox/bullet (user bug #2)
        // and browser-default edits can chew the marker column.
        contentEditable={false}
        className="shrink-0 flex items-start justify-center mr-2.5 h-[1.7em] select-none"
        style={{
          width: '16px',
          paddingTop: blockType === 'checklist' ? '5px' : (blockType === 'numberedList' ? '0px' : '11px')
        }}
      >
        {blockType === 'checklist' ? (
          <div className={cn(
            "w-[16px] h-[16px] shrink-0 rounded-[4px] border flex items-center justify-center cursor-pointer border-[var(--bone-30)] hover:border-[var(--bone-70)] bg-[var(--app-dark)]",
            (isDraggingGlobal || isReadOnly) && "pointer-events-none opacity-50 cursor-default"
          )}
            onClick={(isDraggingGlobal || isReadOnly) ? undefined : () => onToggleCheck(row.id)}
          >
            {row.checked && <Check className="w-[10px] h-[10px] text-[var(--bone-100)]" strokeWidth={3} />}
          </div>
        ) : (
          marker()
        )}
      </div>
      <div
        ref={elRef}
        // Marks the row's editable text for NoteEditor's host-level handlers:
        // they resolve [data-row-id] BEFORE [data-block-id], since a row is
        // nested inside its list's block wrapper.
        data-row-id={row.id}
        suppressContentEditableWarning
        className={cn(
          "flex-1 outline-none min-h-[1.5em] leading-[1.6] text-[16px] font-normal font-display tracking-[-0.02em]",
          row.checked ? "text-[var(--bone-30)]" : "text-bone-100",
        )}
        style={{
          fontFamily: 'var(--font-display)',
          letterSpacing: '-0.01em',
          direction: 'ltr',
          ...(row.checked ? { textDecoration: 'line-through', textDecorationThickness: '1px', textDecorationColor: 'var(--bone-70)' } : {}),
        }}
        dir="ltr"
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        onContextMenu={onContextMenu}
      />
    </div>
  );
}

export function ListBlock({ block, listNumber, onUpdate, onExitBottom, onExitTop, onFocus, isDraggingGlobal = false, isReadOnly = false, onMouseMove, onMouseLeave, onContextMenu }: ListBlockProps) {
  const rows = flattenRows(block);

  const handleToggleCheck = useCallback((rowId: string) => {
    const current = flattenRows(block);
    const newRows = current.map(r => r.id === rowId ? { ...r, checked: !r.checked } : r);
    const nested = nestRows(newRows, block.type);
    onUpdate(block.id, { content: nested.content, checked: nested.checked, children: nested.children });
  }, [block, onUpdate]);

  return (
    <div className="flex flex-col w-full">
      {rows.map((row, i) => (
        <RowEl
          key={row.id}
          row={row}
          rowIndex={i}
          rows={rows}
          blockType={block.type}
          listNumber={listNumber}
          onToggleCheck={handleToggleCheck}
          isDraggingGlobal={isDraggingGlobal}
          isReadOnly={isReadOnly}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
          onContextMenu={onContextMenu}
        />
      ))}
    </div>
  );
}
```

Notes: `onExitBottom`, `onExitTop`, `onFocus` stay in the props interface so the call site in `BlockRenderer.tsx` compiles unchanged, but they are intentionally unused now (the host-level handlers cover those paths). `generateId` and `useState` imports are gone on purpose.

- [ ] **Step 2: Typecheck and unit tests**

Run: `npx tsc --noEmit` → clean. If it complains about unused `onExitBottom`/`onExitTop`/`onFocus` destructured variables, prefix them with underscores in the destructuring (`onExitBottom: _onExitBottom`) — do not remove them from the interface.
Run: `npx vitest run src/lib/editor/` → all pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/ListBlock.tsx
git commit -m "fix(editor): remove legacy per-row editing system from ListBlock"
```

---

### Task 2: Remove BlockRenderer's stuck isFocused machinery; make chrome non-editable

**Files:**
- Modify: `src/components/editor/BlockRenderer.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `BlockRendererProps` gains `isActive?: boolean`. All previous `isFocused` visual behavior (highlight bg, `focused` class, placeholder text, controls visibility) now derives from that prop. Task 3 wires the prop from NoteEditor.

Why: `isFocused` is set in `onMouseDown` (the content div's and via `onFocus` which never fires) and cleared only in `onBlur` — but under the single host the content div never actually receives focus, so blur NEVER fires and the highlight sticks forever (user bug #6). The state must be replaced by a prop computed from the real caret position (Task 3).

- [ ] **Step 1: Add the prop.** In the `BlockRendererProps` interface (top of file, where `isSelected`, `isReadOnly` etc. are declared), add:

```ts
  isActive?: boolean;
```

and in the component's destructured parameters add `isActive = false,`.

- [ ] **Step 2: Replace the state with a derived const.** Find (around line 175):

```ts
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (isFocused && contentRef.current && document.activeElement !== contentRef.current) {
      contentRef.current.focus();
    }
  }, [isFocused]);
```

Replace the whole thing with:

```ts
  // Derived from the real caret position (NoteEditor's selectionchange
  // listener). Local focus state is impossible here: under the single
  // contentEditable host this div never receives focus, so onBlur never
  // fires and any locally-set flag sticks forever (the "stuck highlight" bug).
  const isFocused = isActive && !isReadOnly;
```

Every existing use of `isFocused` (controls props, `focused` class, `bg-[var(--bone-2)]`, `getPlaceholder`) keeps compiling and now reflects reality.

- [ ] **Step 3: Delete the dead/harmful handlers on the content div** (around lines 1490–1521). Remove these three props from the `data-block-content` div:

```tsx
            onFocus={() => {
              if (!isReadOnly) {
                setIsFocused(true);
                onFocus?.(block.id);
              }
            }}
            onBlur={() => setIsFocused(false)}
```

and

```tsx
            onMouseDown={() => {
              if (!isReadOnly && !isFocused) setIsFocused(true);
            }}
```

(The block wrapper's own `onMouseDown={!isReadOnly ? () => onFocus?.(block.id) : undefined}` at the wrapper div stays — it still notifies NoteEditor on click.)

If `tsc` now reports OTHER remaining `setIsFocused` references anywhere in the file, delete those references too (they are all part of the same dead machinery).

- [ ] **Step 4: Make BlockControls and the fold chevron chrome islands.** In `BlockControls` (bottom of file, ~line 1677), add `contentEditable={false}` to its root div:

```tsx
    <div
      contentEditable={false}
      className={cn(
        "absolute right-full pr-[8px] flex items-start justify-center gap-1",
```

In the fold-chevron div (~line 1461, the one with `onClick={... onUpdate(block.id, { isFolded: !block.isFolded })}`), add `contentEditable={false}` as its first prop.

- [ ] **Step 5: Clear text selection when a drag starts from the handle** (user bug #7: with a text selection active, the browser starts a native text-drag instead of the block drag). In `BlockControls`, on the drag-handle div (the one with `ref={dragHandleRef}` and `onClick={handleGripClick}`), add:

```tsx
          onMouseDown={() => { window.getSelection()?.removeAllRanges(); }}
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit` → clean. Run: `npx vitest run src/lib/editor/` → all pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/editor/BlockRenderer.tsx
git commit -m "fix(editor): replace stuck local isFocused with isActive prop; non-editable chrome"
```

---

### Task 3: NoteEditor — drive isActive from the real caret (selectionchange)

**Files:**
- Modify: `src/components/editor/NoteEditor.tsx`

**Interfaces:**
- Consumes: `isActive` prop added in Task 2.
- Produces: `activeBlockId` state now tracks the caret live.

- [ ] **Step 1: Add a selectionchange listener.** In `NoteEditor`, directly AFTER the existing cursor-restore effect (the `useEffect` whose body starts `const target = pendingCursor.current;`, ~line 650), add:

```ts
  // Keep activeBlockId synced to the real caret. Under the single editing
  // host, per-block onFocus/onBlur never fire (document.activeElement is
  // always the host), so caret position is the only truthful focus signal.
  useEffect(() => {
    const onSelectionChange = () => {
      const host = blocksHostRef.current;
      if (!host) return;
      const sel = window.getSelection();
      const anchorNode = sel?.anchorNode ?? null;
      const anchorEl = anchorNode
        ? (anchorNode.nodeType === Node.TEXT_NODE ? anchorNode.parentElement : anchorNode as HTMLElement)
        : null;
      const blockEl = anchorEl?.closest?.('[data-block-id]') as HTMLElement | null;
      const id = blockEl && host.contains(blockEl) ? (blockEl.dataset.blockId ?? null) : null;
      setActiveBlockId(prev => (prev === id ? prev : id));
    };
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, []);
```

- [ ] **Step 2: Pass the prop.** In `renderBlocksRecursive`, inside the `<BlockRenderer ...>` JSX, add alongside `isSelected={...}`:

```tsx
          isActive={activeBlockId === block.id}
```

- [ ] **Step 3: Typecheck, then live sanity check**

Run: `npx tsc --noEmit` → clean.
Start the dev server if not running. Open `http://localhost:3000/dev-note` in headless Playwright or a browser: click into "Some paragraph text here", verify that block gets the highlight; click into "Another subheading", verify the FIRST block's highlight went away. (This was the stuck-highlight bug.)

- [ ] **Step 4: Commit**

```bash
git add src/components/editor/NoteEditor.tsx
git commit -m "fix(editor): drive block active highlight from selectionchange, not dead focus events"
```

---

### Task 4: Route structural list/markdown ops through undo history

**Files:**
- Modify: `src/components/editor/NoteEditor.tsx`

**Interfaces:**
- Produces: `persistBlockUpdate(id: string, updates: Partial<EditorBlock>): void` — like `updateBlock` but goes through `persistBlocks` so it lands in undo history.

Why: every structural row operation in `handleHostKeyDown` (row Enter/Tab/Backspace variants) and the markdown `transform` currently call `updateBlock`, which only does `setBlocks` — it never touches `history`. Result: Ctrl+Z does nothing after creating/indenting/removing list rows or after a `- ` conversion (user bug #1). `persistBlocks` is the function that pushes history.

- [ ] **Step 1: Add the helper.** Directly after the `updateBlock` definition (~line 794), add:

```ts
  // Same as updateBlock but recorded in undo history. Use for STRUCTURAL
  // one-shot edits (row insert/remove/indent, markdown conversions).
  // Per-keystroke typing must keep using updateBlock — its history entry is
  // coalesced separately by the typing timer in handleHostInput.
  const persistBlockUpdate = useCallback((id: string, updates: Partial<EditorBlock>) => {
    persistBlocks(updateBlockRecursive(blocksRef.current, id, updates));
  }, [persistBlocks]);
```

- [ ] **Step 2: Swap call sites inside `handleHostKeyDown` ONLY.** Within the `handleHostKeyDown` callback there are exactly these `updateBlock(` call sites — change each to `persistBlockUpdate(`:
  1. Row-level Enter, empty-row unindent branch: `updateBlock(parentBlockId, { content: nested.content, children: nested.children });` (there are several of these — in the Enter branch, the Tab branch (both shift and non-shift), and the Backspace branches). Change ALL `updateBlock(parentBlockId, ...)` occurrences inside the row-level section to `persistBlockUpdate(parentBlockId, ...)`. There are 9 of them.
  2. The markdown `transform` helper in the block-level Space branch: change `updateBlock(blockId, { content: '', ...updates });` to `persistBlockUpdate(blockId, { content: '', ...updates });`
- Do NOT touch `updateBlock` uses anywhere else (handleHostInput's typing path, insertBlock's link path, checkbox toggles, etc.).

- [ ] **Step 3: Add `*` as a bullet trigger** (user expects `* ` to work like `- `, matching Notion/Obsidian). In the same block-level Space branch, find:

```ts
      if (text === '-') return transform({ type: 'bulletList' });
```

Replace with:

```ts
      if (text === '-' || text === '*') return transform({ type: 'bulletList' });
```

- [ ] **Step 4: Update the dependency array** of `handleHostKeyDown`: add `persistBlockUpdate` to the deps list at the end of the callback.

- [ ] **Step 5: Typecheck + tests**

Run: `npx tsc --noEmit` → clean. Run: `npx vitest run src/lib/editor/` → all pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/editor/NoteEditor.tsx
git commit -m "fix(editor): record structural row/markdown ops in undo history; add * bullet trigger"
```

---

### Task 5: Handle collapsed-caret Backspace/Delete at block boundaries

**Files:**
- Modify: `src/components/editor/NoteEditor.tsx`

Why: with the container as the editing host, Backspace at the START of a non-empty block reaches the browser default, which natively merges two React-owned block divs — React never knows, the DOM and the store desync, and you get ghost text with no block chrome (user bugs #4/#8 fallout, and the misaligned unmanaged lines in the user's screenshots). Same for Delete at the END of a block. We must intercept and do the merge in the store ("first block wins", cursor at the seam) — this is also the expected plain-text-feel UX.

- [ ] **Step 1: Extend the block-level Backspace branch.** In `handleHostKeyDown`, the block-level section currently has:

```ts
    if (e.key === 'Backspace') {
      const contentEl = blockEl.querySelector<HTMLElement>('[data-block-content]');
      const text = contentEl?.textContent ?? '';
      if (!text.trim()) {
        // ... existing delete-empty-block logic ...
        return;
      }
    }
```

Immediately AFTER the closing brace of `if (!text.trim()) { ... }` (still inside `if (e.key === 'Backspace')`), add:

```ts
      // Non-empty block, caret at its very start → merge into the previous
      // block ourselves ("first block wins", caret at the seam). Without
      // this preventDefault the browser natively merges two React-owned
      // divs and the DOM desyncs from the store permanently.
      const selB = window.getSelection();
      if (contentEl && selB?.rangeCount && selB.getRangeAt(0).collapsed) {
        const r = selB.getRangeAt(0);
        const test = document.createRange();
        test.selectNodeContents(contentEl);
        test.setEnd(r.startContainer, r.startOffset);
        if (test.toString().length === 0) {
          e.preventDefault();
          const idx = blocks.findIndex(b => b.id === blockId);
          if (idx > 0) {
            const prev = blocks[idx - 1];
            const cur = blocks[idx];
            if (prev.type === 'divider') {
              // Backspace against a divider deletes the divider.
              pendingCursor.current = { blockId: cur.id, offset: 0 };
              persistBlocks(blocks.filter(b => b.id !== prev.id));
            } else if ((prev.type === 'text' || prev.type === 'quote') && (cur.type === 'text' || cur.type === 'quote')) {
              const prevEl = host.querySelector<HTMLElement>(`[data-block-id="${prev.id}"] [data-block-content]`);
              const prevLen = (prevEl?.textContent ?? '').length;
              const merged = blocks.slice();
              merged[idx - 1] = { ...prev, content: prev.content + cur.content };
              merged.splice(idx, 1);
              pendingCursor.current = { blockId: prev.id, offset: prevLen };
              persistBlocks(merged);
            }
            // Other neighbor types (lists, media, tables): swallow the key.
            // No merge yet (Phase 2), but crucially no native DOM corruption.
          }
          return;
        }
      }
      return;
```

- [ ] **Step 2: Add the symmetric Delete-forward branch.** Directly after the whole `if (e.key === 'Backspace') { ... }` block, add:

```ts
    if (e.key === 'Delete') {
      const contentEl = blockEl.querySelector<HTMLElement>('[data-block-content]');
      const selD = window.getSelection();
      if (contentEl && selD?.rangeCount && selD.getRangeAt(0).collapsed) {
        const r = selD.getRangeAt(0);
        const test = document.createRange();
        test.selectNodeContents(contentEl);
        test.setStart(r.startContainer, r.startOffset);
        if (test.toString().length === 0) {
          // Caret at the very end of this block → forward-merge next block in.
          e.preventDefault();
          const idx = blocks.findIndex(b => b.id === blockId);
          if (idx !== -1 && idx < blocks.length - 1) {
            const cur = blocks[idx];
            const next = blocks[idx + 1];
            if (next.type === 'divider') {
              persistBlocks(blocks.filter(b => b.id !== next.id));
            } else if ((cur.type === 'text' || cur.type === 'quote') && (next.type === 'text' || next.type === 'quote')) {
              const curLen = (contentEl.textContent ?? '').length;
              const merged = blocks.slice();
              merged[idx] = { ...cur, content: cur.content + next.content };
              merged.splice(idx + 1, 1);
              pendingCursor.current = { blockId: cur.id, offset: curLen };
              persistBlocks(merged);
            }
          }
          return;
        }
      }
    }
```

- [ ] **Step 3: Safety net for unhandled Enter.** In `handleHostBeforeInput`, find:

```ts
    const selection = getBlockSelection(host);
    if (!selection) return;   // single block or caret → native behavior
```

Replace with:

```ts
    const selection = getBlockSelection(host);
    if (!selection) {
      // Collapsed caret / single block. Everything is native EXCEPT
      // insertParagraph: every legitimate Enter is already handled (and
      // preventDefaulted) in handleHostKeyDown, so one reaching here means
      // the caret was somewhere we couldn't resolve (chrome, gap). Letting
      // the browser split host children creates unmanaged divs React
      // doesn't know about — swallow it instead.
      if (native.inputType === 'insertParagraph') native.preventDefault();
      return;
    }
```

- [ ] **Step 4: Typecheck + tests**

Run: `npx tsc --noEmit` → clean. Run: `npx vitest run src/lib/editor/` → all pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/NoteEditor.tsx
git commit -m "fix(editor): intercept block-boundary Backspace/Delete; never let the browser merge block divs"
```

---

### Task 6: Fix Shell.tsx Shift+Z global hijack

**Files:**
- Modify: `src/components/layout/Shell.tsx:108-110`

Why: the current condition `e.shiftKey && e.key.toLowerCase() === 'z'` fires for (a) Ctrl+Shift+Z — swallowing the editor's REDO, and (b) typing a capital "Z" anywhere, including inside the editor — `preventDefault()` even blocks the character. It must require no modifier and must not fire while typing.

- [ ] **Step 1: Replace the branch.** Find in `Shell.tsx`:

```ts
        } else if (e.shiftKey && e.key.toLowerCase() === 'z') {
          e.preventDefault();
          toggleCommandPalette();
        } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'r') {
```

Replace the first branch with:

```ts
        } else if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'z') {
          const t = e.target as HTMLElement | null;
          const isTyping = !!t && (t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA');
          if (!isTyping) {
            e.preventDefault();
            toggleCommandPalette();
          }
        } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'r') {
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit` → clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/Shell.tsx
git commit -m "fix(shell): Shift+Z palette shortcut no longer swallows Ctrl+Shift+Z redo or typed 'Z'"
```

---

### Task 7: Fix stale `[contenteditable]` selectors in NoteEditor

**Files:**
- Modify: `src/components/editor/NoteEditor.tsx` (three sites)

Why: blocks no longer carry `contenteditable`, so `querySelector('[data-block-id="..."] [contenteditable]')` returns null — new blocks created by double-click or by clicking the bottom area are silently never focused (contributes to user bug #3: typing after creating a block goes nowhere sensible).

- [ ] **Step 1: `handleDoubleClick` (~line 687).** Replace:

```ts
        const newEl = document.querySelector(`[data-block-id="${newBlock.id}"] [contenteditable]`) as HTMLElement;
        if (newEl) {
          newEl.focus();
```

with:

```ts
        const newEl = document.querySelector(`[data-block-id="${newBlock.id}"] [data-block-content]`) as HTMLElement;
        if (newEl) {
          blocksHostRef.current?.focus();
```

(keep the range-placement lines below unchanged — the range is what puts the caret in the block; the host is what must hold focus).

- [ ] **Step 2: Bottom-area click handler (~line 1933).** Same substitution:

```ts
                const el = document.querySelector(`[data-block-id="${newBlock.id}"] [contenteditable]`) as HTMLElement;
                if (el) {
                  el.focus();
```

becomes

```ts
                const el = document.querySelector(`[data-block-id="${newBlock.id}"] [data-block-content]`) as HTMLElement;
                if (el) {
                  blocksHostRef.current?.focus();
```

- [ ] **Step 3: `insertBlock` link path (~line 1350).** Replace:

```ts
      const el = document.querySelector(`[data-block-id="${blockId}"] [contenteditable]`) as HTMLElement;
      if (el) {
        el.focus();
```

with:

```ts
      const el = document.querySelector(`[data-block-id="${blockId}"] [data-block-content]`) as HTMLElement;
      if (el) {
        blocksHostRef.current?.focus();
```

- [ ] **Step 4: Typecheck + commit**

Run: `npx tsc --noEmit` → clean.

```bash
git add src/components/editor/NoteEditor.tsx
git commit -m "fix(editor): update stale [contenteditable] selectors to [data-block-content]"
```

---

### Task 8: Live verification probe (all 8 user bugs)

**Files:**
- Create: `tmp-verify-stabilization.mjs` in the repo root (DELETE it after this task; do not commit it)

Rules for this probe: use Playwright with `const ctx = await browser.newContext(); const page = await ctx.newPage();` **per test case** — a fresh Page alone SHARES localStorage/Zustand state with earlier pages and will give false results. Read store state via `await page.evaluate(() => window.__store.getState().entities.find(e => e.id === 'dev-note-fixture').content)`. After any typing burst, wait 1500ms before reading the store (600ms history timer + 1000ms store debounce). The fixture blocks are: `blk-title` (title), `blk-body` (body text "Some paragraph text here"), `blk-sub` (subheading), `blk-list` (bulletList with child rows `blk-list-row1` "First bullet row", `blk-list-row2` "Second bullet row").

- [ ] **Step 1: Write and run a probe that asserts ALL of the following.** Each numbered case = fresh context. Print `PASS`/`FAIL` per case and exit non-zero on any FAIL.

1. **Row Enter creates exactly one row.** Click at end of `[data-row-id="blk-list-row1"]`, press Enter, wait 300ms. Store: `blk-list` must now have exactly 3 rows total (row1, new empty row, row2) — count via flattened children. DOM: exactly 3 `[data-row-id]` elements under `[data-block-id="blk-list"]`. (Old dual-handler bug created 0 or 2.)
2. **Ctrl+Z undoes the row insert.** Continue from case 1's page: press Control+z, wait 300ms. Store: back to 2 child rows.
3. **Row Backspace merges rows once.** Click at START of `[data-row-id="blk-list-row2"]` (use `page.evaluate` to set a collapsed selection at offset 0 inside the row's text node), press Backspace, wait 300ms. Store: `blk-list` has 1 child row and its content is "First bullet rowSecond bullet row". `blk-list` block itself must STILL EXIST.
4. **Tab indents a row.** Click in `blk-list-row2`, press Tab, wait 300ms. Store: row2 is now a child of row1 (depth 1). Then Shift+Tab returns it to depth 0.
5. **Caret cannot land in row chrome.** `page.click` on the bullet marker area (the `contentEditable={false}` div — click at the marker's bounding box center). Then evaluate `window.getSelection().anchorNode` — it must NOT be inside the marker div (walk `parentElement` chain; the marker container has class `select-none`).
6. **`- ` + space converts to bulletList and Ctrl+Z restores.** Fresh context. Click at end of `blk-sub`'s content (`[data-block-id="blk-sub"] [data-block-content]`), press Ctrl+A? NO — instead: click into `blk-body`, select all its text via triple-click, type `-` (replaces text), then press Space, wait 300ms. Store: the block that was `blk-body` now has `type: 'bulletList'`. Press Ctrl+z, wait 300ms: type back to `'text'`.
7. **Block-boundary Backspace merges blocks.** Fresh context. Place collapsed caret at offset 0 of `blk-sub`'s text node, press Backspace, wait 1500ms. Store: `blk-sub` is GONE, `blk-body`'s content is "Some paragraph text hereAnother subheading". DOM: no unmanaged text — every visible text line is inside a `[data-block-id]`. Cursor: `window.getSelection().anchorOffset` sits at the seam (offset 24 = length of "Some paragraph text here") — allow anchorNode to be the text node with that offset.
8. **Highlight follows the caret.** Fresh context. Click into `blk-body`, assert `[data-block-id="blk-body"]` has class `focused`. Click into `blk-sub`, assert `blk-body` NO LONGER has class `focused` and `blk-sub` does.
9. **Slash menu closes on outside click.** Fresh context. Click at end of `blk-body`, press Enter (creates new empty block), type `/`, wait 300ms, assert the slash menu is visible (`.popup-glass-small` exists). Then `page.mouse.click` on `blk-title`'s text. Wait 300ms. Assert the menu is GONE. **If this case fails: do NOT attempt a fix. Record the failure + a DOM snapshot of the open menu in the RESULTS file.**
10. **Typing capital Z works.** Fresh context. Click into `blk-body` at end, type `Z` (Shift+z), wait 1500ms. Store: `blk-body` content ends with "Z". No command palette opened (assert no palette overlay element appeared; search for an element containing the command palette container — if unsure of its class, assert `document.body` text does not suddenly contain a palette search input that wasn't there).
11. **Checkbox toggle still works.** Fresh context. Seed a checklist: `await page.evaluate(() => { const s = window.__store.getState(); const ent = s.entities.find(e => e.id === 'dev-note-fixture'); s.updateEntityContent('dev-note-fixture', [...ent.content, { id: 'blk-check', type: 'checklist', content: 'todo item', checked: false }]); })`, wait 500ms. Click the checkbox chrome inside `[data-block-id="blk-check"]` (the 16x16 rounded div). Wait 300ms. Store: `blk-check.checked === true`.

- [ ] **Step 2: Run it**

```bash
node tmp-verify-stabilization.mjs
```

Expected: `PASS` for all 11 cases. Fix regressions in the files THIS PLAN touched if any case fails (except case 9 — report only). Re-run until green.

- [ ] **Step 3: Delete the probe, do not commit it**

```bash
rm tmp-verify-stabilization.mjs
```

---

### Task 9: Write the RESULTS file

**Files:**
- Create: `docs/superpowers/plans/2026-07-16-editor-stabilization-RESULTS.md`

- [ ] **Step 1: Write the file** with: per-task status, the verbatim final output of `npx tsc --noEmit`, `npx vitest run src/lib/editor/`, and the probe run (all 11 case lines), plus any case-9 findings or deviations from the plan. Be factual; paste real command output, do not paraphrase it.

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/plans/2026-07-16-editor-stabilization-RESULTS.md
git commit -m "docs: editor stabilization handoff results"
```
