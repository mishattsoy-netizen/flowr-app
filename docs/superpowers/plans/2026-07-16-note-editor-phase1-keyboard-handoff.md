# Note Editor Phase 1 — Keyboard Relocation Handoff

> **You are a different, weaker model picking this up cold. Read this entire document before writing any code.** Every fact here was discovered the hard way — by running things, not by reading code and guessing. Do not skip the "why" sections; they exist because the obvious-looking fix was wrong five separate times this session.

## Your situation in one paragraph

A note-taking app's block editor was rebuilt so text selection can span multiple blocks (previously each block was its own isolated `contentEditable`, so you couldn't drag-select across them — a top user complaint). Making the whole editor **one** `contentEditable` container fixed selection, but broke every per-block keyboard shortcut, because keyboard events now target the container, not the individual block the user is typing in. You are finishing the relocation of those shortcuts.

**Already done for you, do not redo:** the `/` slash menu (reference pattern — read it first), Ctrl+Z/Ctrl+Shift+Z/Ctrl+Y undo (Task 6 below — skip that section, it's there for context only), and `src/lib/editor/listRowOps.ts` (a tested pure-function module for Task 4's row structural edits — Task 4 wires it in, it does not redesign it). **Your actual remaining work is Tasks 1, 2, 3, 4 (wiring only), and 5.**

## Ground truth — verified facts, do not re-derive or second-guess these

1. **The editor's blocks container (`blocksHostRef` in `NoteEditor.tsx`) is the single `contentEditable` host.** Individual blocks (`BlockRenderer.tsx`) and list rows (`ListBlock.tsx`) are plain, non-editable `<div>`s. This is intentional and correct — do not add `contentEditable` or `tabIndex` back to any block or row. Doing so re-fragments the editing host and breaks cross-block selection, which is the entire point of this architecture.

2. **`document.activeElement` is always the container, never a block.** Clicking into a block does not focus it in the DOM sense. This is why every per-block `onKeyDown`, and previously `onInput`, stopped firing — native keyboard/input events dispatch to `document.activeElement`.

3. **React's `onBeforeInput` prop is NOT the native `beforeinput` event.** It's a legacy polyfilled synthetic event that doesn't carry the real `inputType` and doesn't fire for deletions at all. This cost an entire debugging cycle to discover. **For any new native-event listening on the host, use `host.addEventListener(...)` in a `useEffect`, never a React `on*` JSX prop**, unless you have first verified with a real headless probe that the specific React synthetic event behaves identically to the native one. `onClick`, `onMouseDown` are fine (always have been used correctly in this codebase). `onKeyDown` was tested once (see the slash implementation) and worked as a native listener — **stick with native listeners for consistency; do not try switching any of this back to React props.**

4. **`window.getSelection()` correctly resolves which block/row the caret is in, even though `activeElement` cannot.** This is the mechanism every fix in this session uses: climb from `getSelection().anchorNode` up to the nearest `[data-block-id]` (or `[data-row-id]` for list rows — rows are more deeply nested, check for `[data-row-id]` FIRST).

5. **The persistence primitives already exist and are correct — call them, do not reinvent them.** Line numbers below WILL have drifted from commits made after this document was written — use them as a starting search point, not gospel; search for the function name (`const updateBlock = useCallback` etc.) to find the current location:
   - `updateBlock(id, updates)` (was ~line 787) — updates any block or row by id (it recurses into `children` to arbitrary depth — confirmed by reading `updateBlockRecursive`). Does **not** by itself push undo history (Task 6's coalescing timer, already wired into `handleHostInput`, handles that for typing).
   - `persistBlocks(newBlocks, skipHistory?)` (was ~line 526) — replaces the entire block list, pushes undo history unless `skipHistory` is `true`.
   - `insertAfter(afterId, forceType?, openSlash?, inside?)` (was ~line 863)
   - `deleteBlock(id)` (was ~line 845)
   - `indentBlock(id)` / `unindentBlock(id)` (was ~line 968 / 1005)
   - `handleSlash(blockId, rect)` — opens the slash menu — already wired, see the reference implementation.
   - `undo()` / `redo()` — already wired to Ctrl+Z/Y (Task 6, done). You will not call these directly in Tasks 1-5.

6. **There is no dev server auth to fight.** A dev-only route exists at `src/app/dev-note/page.tsx` that renders the real `NoteEditor` component with a fixture note, no login required. **Use it for every verification step in this document. Do not delete it — a later cleanup step removes it, not you.**

7. **Arrow key navigation (ArrowUp/ArrowDown) across blocks and rows already works natively.** Verified with a headless probe: pressing ArrowDown at the end of one block moves the caret into the next block correctly, with no code changes. **`ListBlock.tsx` has its own `ArrowUp`/`ArrowDown` handlers (inside its `handleKeyDown`, currently dead) — do NOT port these. They are redundant with working native behavior. Leave them as dead code; do not delete them either (out of scope, low risk, not worth touching).**

8. **A passing `npx tsc --noEmit` is not evidence anything works.** It has been dead wrong multiple times this session — code that typechecked cleanly and did nothing when actually run in the browser. **Every task below has a runnable probe with an exact expected output. If your result doesn't match, STOP and report — do not "fix" the probe to match wrong output, and do not proceed to the next task.**

## The reference pattern — read this file section before doing anything else

Open `src/components/editor/NoteEditor.tsx` and read from `const handleSlash = useCallback` through the `useEffect` that registers `handleHostKeyDown` with `host.addEventListener('keydown', ...)` (search for these strings — exact line numbers shift as commits land; do not trust hardcoded line numbers anywhere in this document without confirming with a search first, including the ones later in this file, which were accurate at the time of writing but may have drifted after Task 6 landed and shifted everything below it). This is the reference pattern — a working, verified slash-menu relocation AND a working, verified Ctrl+Z/undo implementation (Task 6, see below — already done, do not redo it).

**You will extend this exact function** with more `if` blocks — one per task — rather than creating separate handlers. This keeps a single keydown listener on the host, matching the existing `handleHostBeforeInput`/`handleHostInput` pattern.

### The final assembled shape — THIS EXACT ORDER, do not rearrange

This is not a suggestion — the ordering is load-bearing and was found by tracing a real bug in an earlier draft of this handoff. **Ctrl+Z/Ctrl+Y must be checked BEFORE any block/row resolution**, because undo must work regardless of where the caret is (including when there's no valid selection at all, e.g. right after an operation that cleared it). If Ctrl+Z is checked after the `if (!blockEl) return;` guard, it silently fails to fire whenever the caret isn't resolvable — a real, easy-to-miss bug. Build toward this final shape as you complete tasks, in this order:

```tsx
const handleHostKeyDown = useCallback((e: KeyboardEvent) => {
  if (isReadMode) return;
  const host = blocksHostRef.current;
  if (!host) return;

  // 1. UNDO/REDO FIRST (Task 6 — ALREADY DONE, shown here only as the
  //    reference pattern; do not implement this again). Must work with no
  //    caret/selection resolvable at all. Clears any pending coalescing
  //    timer so a stale debounced snapshot can't re-push over the undo.
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    if (typingHistoryTimer.current) { clearTimeout(typingHistoryTimer.current); typingHistoryTimer.current = null; }
    if (e.shiftKey) redo(); else undo();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
    e.preventDefault();
    if (typingHistoryTimer.current) { clearTimeout(typingHistoryTimer.current); typingHistoryTimer.current = null; }
    redo();
    return;
  }

  // 2. Resolve the caret's position in the DOM.
  const sel = window.getSelection();
  const anchorNode = sel?.anchorNode ?? null;
  const anchorEl = anchorNode?.nodeType === Node.TEXT_NODE ? anchorNode.parentElement : (anchorNode as HTMLElement | null);
  if (!anchorEl) return;

  // 3. ROW CHECK BEFORE BLOCK CHECK. A list row is nested inside its list
  //    block's [data-block-id] wrapper, so it is the more specific target —
  //    exactly the same ordering handleHostInput already uses (re-read
  //    NoteEditor.tsx lines ~816-824 for the existing precedent).
  const rowEl = anchorEl.closest<HTMLElement>('[data-row-id]');
  if (rowEl && host.contains(rowEl)) {
    const rowId = rowEl.dataset.rowId;
    if (rowId) {
      // Task 4's row-specific Enter/Tab/Backspace logic goes HERE, inside
      // this `if (rowEl && ...)` block. It must `return` after handling a
      // key so execution never falls through to the block-level checks below.
    }
    return; // IMPORTANT: always return here, even if no row key matched —
            // never let a row-caret keystroke fall through to block logic.
  }

  // 4. Not a row — resolve the containing block.
  const blockEl = anchorEl.closest<HTMLElement>('[data-block-id]');
  if (!blockEl || !host.contains(blockEl)) return;
  const blockId = blockEl.dataset.blockId;
  if (!blockId) return;

  // 5. Block-level keys. Order within this section does not matter much,
  //    but each branch should `return` once it handles its key.
  if (e.key === '/') {
    // ... existing, already-implemented logic ...
  }

  if (e.key === ' ') {
    // Task 1 goes here.
  }

  if (e.key === 'Enter' && !e.shiftKey) {
    // Task 2 goes here.
  }

  if (e.key === 'Tab') {
    // Task 3 goes here.
  }

  if (e.key === 'Backspace') {
    // Task 5 goes here.
  }
}, [isReadMode, handleSlash, undo, redo /* add each task's new dependencies here */]);
```

Add each task's logic in the marked slot, in whatever order is convenient for you to implement — but the STRUCTURE above (undo first, row before block, each block returning) must be the end state after all tasks are done. If you complete tasks out of order, that's fine; just make sure the final file matches this skeleton's ordering.

## What you are porting FROM — the dead source logic

Two files have complete, correct *logic* that simply never executes anymore because it's attached to dead per-block/per-row `onKeyDown` props:

- **`src/components/editor/BlockRenderer.tsx`**, function `handleKeyDown`, lines **361–566** (note: the `/` case that was there is already removed and replaced with a comment — see line ~558). This handles: Enter (new block / list item / soft break), Tab (indent/unindent), Backspace (delete empty block), Space-triggered markdown shortcuts (`#`, `##`, `###`, `-`, `1.`, `[]`, `"`, `>`, ` ``` `, `---`, `/table`, `|`), and inline `/button`/`/link` shortcuts.
- **`src/components/editor/ListBlock.tsx`**, function `handleKeyDown`, lines **295–~470** (read the file to find the exact end — search for the closing `}, [` of this function). This handles: Enter (new row / unindent empty row / exit list), Tab (indent/unindent row), Backspace (unindent or merge into previous row), Space-triggered markdown shortcuts on a row, ArrowUp/ArrowDown (**do not port these — see fact 7 above**).

**Do not delete these functions' bodies wholesale.** You are reading their logic to understand *what* each keystroke should do, then writing equivalent logic in `handleHostKeyDown` that resolves the block/row via `getSelection()` instead of via the closure variables (`block`, `index`, `depth`, `row`, `rowIndex` — these do not exist in the container's scope; you must derive the equivalent information from the DOM or from `blocks` state).

## Tasks — do them in this exact order, one at a time, each gated

Each task: make the change, run the probe, compare to expected output **character-for-character** (or the stated semantic equivalent), commit only if it matches, then move to the next. **If a probe fails, stop and write what you tried and what happened instead of the change you attempted — do not attempt more than 2 fix iterations per task before stopping entirely and reporting.**

Start the dev server first if it is not already running: `npm run dev` (it may print "port 3000 in use" and pick 3001 — check `/tmp` logs or just try both; the dev-note route works on whichever port is live).

All probes are Playwright scripts. Create them as `tmp-taskN-probe.mjs` in the repo root, run with `node tmp-taskN-probe.mjs`, then **delete the probe file** after the task's commit (do not commit probe scripts — they are scratch, matching this session's convention. The one exception is `scripts/probe-selection.mjs`, already committed, which you should leave alone).

---

### Task 1: Markdown shortcuts (`#`, `##`, `###`, `-`, `1.`, `[]`, `"`, `>`, ` ``` `, `---`)

**What it does:** typing one of these strings then pressing Space transforms the current (empty-ish) block into a different type — e.g. `# ` + space → the block becomes a title-styled text block with empty content, ready to type the heading text.

**Source logic to port:** `BlockRenderer.tsx` lines ~511–556 (the `if (e.key === ' ' && contentRef.current)` block, specifically the `transform` helper and the chain of `if (text === '#') return transform(...)` statements — **only port the markdown chain, NOT the `/button`/`/link` inline-shortcut logic above it in the same block, and NOT the arrow-symbol replacements (`->`, `<-` etc.) — those are separate, lower-priority, and out of scope for this handoff**).

**Add to `handleHostKeyDown`:**

```tsx
if (e.key === ' ') {
  const contentEl = blockEl.querySelector<HTMLElement>('[data-block-content]');
  const text = contentEl?.textContent ?? '';

  const transform = (updates: Partial<EditorBlock>) => {
    e.preventDefault();
    if (contentEl) contentEl.innerHTML = '';
    updateBlock(blockId, { content: '', ...updates });
  };

  if (text === '#') return transform({ type: 'text', style: 'title' });
  if (text === '##') return transform({ type: 'text', style: 'heading' });
  if (text === '###') return transform({ type: 'text', style: 'subheading' });
  if (text === '-') return transform({ type: 'bulletList' });
  if (text === '1.') return transform({ type: 'numberedList' });
  if (text === '[]') return transform({ type: 'checklist', checked: false });
  if (text === '"' || text === '>') return transform({ type: 'quote' });
  if (text === '```') return transform({ type: 'text', style: 'mono' });
  if (text === '---') return transform({ type: 'divider' });
  if (text === '/table' || text === '|') return transform({ type: 'table', tableData: [['', '', ''], ['', '', ''], ['', '', '']] });
}
```

Add `updateBlock` to the `useCallback` dependency array.

**Then**, in `BlockRenderer.tsx`, find the corresponding dead code (the whole `if (e.key === ' ' && contentRef.current)` block, roughly lines 511–556) and replace ONLY the markdown-chain portion with a comment pointing to the relocation, exactly like the existing `/` comment. **Leave the `/button`/`/link` and arrow-symbol logic in place in `BlockRenderer.tsx` even though it's currently dead — that is separately tracked, not part of this task.** Do not delete more than you're told to.

**Probe** (`tmp-task1-probe.mjs`) — **already run once against the current, un-implemented code (VERIFIED baseline below, not a guess). Wait time is 1300ms, not 200ms — the store write goes through a 1000ms debounce (`debouncedSyncToStore` in `NoteEditor.tsx`); a shorter wait reads a stale store and makes a correct fix look like a failure:**

```js
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', e => console.log('PAGE ERROR:', e.message));
await page.goto('http://localhost:3000/dev-note', { waitUntil: 'networkidle', timeout: 20000 });
await page.waitForTimeout(1200);

// Clear the body block, then type "# " and check it became a title.
const body = page.locator('[data-block-id="blk-body"] [data-block-content]');
await body.click();
await page.keyboard.press('Home');
await page.keyboard.down('Shift'); await page.keyboard.press('End'); await page.keyboard.up('Shift');
await page.keyboard.press('Backspace');
await page.waitForTimeout(150);
await page.keyboard.type('#');
await page.keyboard.press('Space');
await page.waitForTimeout(1300);

const result = await page.evaluate(() => {
  const s = window.__store.getState();
  const b = s.entities.find(e => e.id === 'dev-note-fixture').content.find(x => x.id === 'blk-body');
  return { type: b.type, style: b.style, content: b.content };
});
console.log('RESULT:', result);
console.log('EXPECTED AFTER YOUR FIX: { type: "text", style: "title", content: "" }');
```

**VERIFIED baseline (measured against the current, un-implemented code, so you can tell "my fix did nothing" apart from "my fix did the wrong thing"):**
```
{ type: 'text', style: 'body', content: '#&nbsp;' }
```
The `#&nbsp;` is the browser's own default handling of typing `#` then Space in a contenteditable div — completely unrelated to your fix, this is what happens with NO markdown-shortcut interception at all. After your fix, this must become `{ type: 'text', style: 'title', content: '' }`.
await browser.close();
```

**Expected output:** `RESULT: { type: 'text', style: 'title', content: '' }`

---

### Task 2: Enter — new block below, or new list item

**What it does:** pressing Enter in a plain text block creates a new empty text block after it, with focus moving to the new block. Pressing Enter in a list row creates a new row (or exits the list if the row is empty).

**Source logic to port — TWO separate sources:**
- Plain-block Enter: `BlockRenderer.tsx` — inside `handleKeyDown`, the `if (e.key === 'Enter')` block, specifically the tail end after the inline-button-shortcut check (roughly lines 415–433): checks if the block is a list-like type with an empty value (escape list), a list-like type with children (insert as first child), or otherwise calls `onInsertAfter(block.id, isListLike ? block.type : 'text')`.
- **Skip list-row Enter for this task — it is Task 4, because it requires resolving `[data-row-id]`, not `[data-block-id]`, and has much more branching logic (see Task 4). Task 2 is ONLY for plain (non-list) blocks.**

**How to detect "is this a list block" in the container:** you have `blocks` (React state, the full array) in scope. Find the block by id: `blocks.find(b => b.id === blockId)`, then check `['bulletList','numberedList','dashedList','checklist'].includes(b.type)`. If it IS one of these types, **skip this branch entirely — Task 4 handles it** (the row-level Enter will already be reached because rows have `[data-row-id]` nested inside the list's `[data-block-id]`, and your `[data-row-id]` check — added in Task 4 — must run BEFORE this general block check, exactly as `handleHostInput` already does for persistence; re-read `NoteEditor.tsx` lines ~805–843 to see this exact "row check before block check" pattern already implemented for input).

**Add to `handleHostKeyDown`** (add this AFTER the Task 4 row-Enter check once Task 4 exists, or write Task 4 first if that's easier — either order is fine as long as row-check precedes block-check in the final code):

```tsx
if (e.key === 'Enter' && !e.shiftKey) {
  const block = blocks.find(b => b.id === blockId);
  if (!block) return;
  const isListLike = ['bulletList', 'numberedList', 'dashedList', 'checklist'].includes(block.type);
  if (isListLike) return; // handled by the row-level Enter logic (Task 4)

  e.preventDefault();
  insertAfter(blockId, 'text');
  return;
}
```

Add `blocks` and `insertAfter` to the dependency array.

**Note on focus after insert:** `insertAfter` already exists and was presumably designed to work with the old per-block-focus model. It may or may not correctly focus the new block under the new single-host architecture — **this is worth checking as part of your probe below**. If the new block is created but NOT focused/editable-ready, that is a real finding — report it in your summary rather than trying to fix it (focus-after-insert may need its own follow-up; do not scope-creep into rewriting `insertAfter`).

**Probe** (`tmp-task2-probe.mjs`) — wait time is 1300ms (debounce, see Task 1's note):

```js
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', e => console.log('PAGE ERROR:', e.message));
await page.goto('http://localhost:3000/dev-note', { waitUntil: 'networkidle', timeout: 20000 });
await page.waitForTimeout(1200);

const body = page.locator('[data-block-id="blk-body"] [data-block-content]');
await body.click();
await page.keyboard.press('End');
await page.keyboard.press('Enter');
await page.waitForTimeout(1300);

const result = await page.evaluate(() => {
  const s = window.__store.getState();
  const blocks = s.entities.find(e => e.id === 'dev-note-fixture').content;
  const bodyIdx = blocks.findIndex(b => b.id === 'blk-body');
  return { totalBlocks: blocks.length, bodyContent: blocks[bodyIdx].content, blockAfterBody: blocks[bodyIdx + 1] ? { type: blocks[bodyIdx + 1].type, content: blocks[bodyIdx + 1].content } : null };
});
console.log('RESULT:', result);
console.log('EXPECTED AFTER YOUR FIX: totalBlocks: 5, bodyContent unchanged, blockAfterBody: { type: "text", content: "" }');
```

**VERIFIED baseline (measured against current, un-implemented code):**
```
{ totalBlocks: 4, bodyContent: 'Some paragraph text here', blockAfterBody: { type: 'text', content: 'Another subheading' } }
```
Enter currently does **nothing at all** — not even a native soft-break — the block count stays at 4 and nothing changes. This confirms the container is correctly swallowing the keystroke (it just isn't doing anything useful with it yet). After your fix: `totalBlocks: 5`, `bodyContent` still `'Some paragraph text here'` (unchanged), and a NEW block exists between body and sub with `{ type: 'text', content: '' }`.

---

### Task 3: Tab — indent / Shift+Tab — unindent (plain blocks only)

**Source logic:** `BlockRenderer.tsx`, the `if (e.key === 'Tab')` block (roughly lines 435–443): `e.preventDefault()`, then `onIndent(block.id)` or `onUnindent(block.id)` depending on `e.shiftKey`.

**Add to `handleHostKeyDown`:**

```tsx
if (e.key === 'Tab') {
  e.preventDefault();
  if (e.shiftKey) unindentBlock(blockId);
  else indentBlock(blockId);
  return;
}
```

Add `indentBlock`, `unindentBlock` to the dependency array.

**Note:** this fires for list rows too, since `[data-block-id]` matches the list's wrapper if no more specific `[data-row-id]` check exists yet. **If you did Task 4 already, its row-level Tab handling must run first (same ordering rule as Task 2).** If you have NOT done Task 4 yet, this is fine to commit now — Task 4 will supersede it for rows later.

**Probe** (`tmp-task3-probe.mjs`) — the fixture's `blk-sub` is a plain block with a sibling before it, so it can indent:

```js
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', e => console.log('PAGE ERROR:', e.message));
await page.goto('http://localhost:3000/dev-note', { waitUntil: 'networkidle', timeout: 20000 });
await page.waitForTimeout(1200);

const sub = page.locator('[data-block-id="blk-sub"] [data-block-content]');
await sub.click();
await page.keyboard.press('Tab');
await page.waitForTimeout(1300);

const result = await page.evaluate(() => {
  const s = window.__store.getState();
  const blocks = s.entities.find(e => e.id === 'dev-note-fixture').content;
  const topLevelIds = blocks.map(b => b.id);
  const bodyBlock = blocks.find(b => b.id === 'blk-body');
  return { stillTopLevel: topLevelIds.includes('blk-sub'), bodyHasChildren: !!(bodyBlock?.children?.length), allTopLevelIds: topLevelIds };
});
console.log('RESULT:', result);
console.log('EXPECTED AFTER YOUR FIX: stillTopLevel: false, bodyHasChildren: true');
```

**VERIFIED baseline (measured against current, un-implemented code):**
```
{ stillTopLevel: true, bodyHasChildren: false, allTopLevelIds: [ 'blk-title', 'blk-body', 'blk-sub', 'blk-list' ] }
```
Tab currently does nothing at all. **The post-fix expectation IS verified** — read directly from `indentBlock`'s real implementation (`NoteEditor.tsx:968-1000`): it finds the block's previous sibling and does `prevSibling.children = [...(prevSibling.children || []), target]`, splicing the target out of the top-level list. So indenting `blk-sub` makes it a child of `blk-body` (its immediately preceding sibling), confirming `stillTopLevel: false, bodyHasChildren: true` is the correct expectation, not a guess.

---

### Task 4: List row Enter / Tab / Backspace

**This task's hard part is ALREADY DONE for you — do not redesign it.** `src/lib/editor/listRowOps.ts` already exists, is already tested (16 passing vitest cases), and is already committed. Your job here is much smaller than it might look: **wire these existing pure functions into `handleHostKeyDown`'s row branch.** Do not write your own row-restructuring logic; call the functions below.

**CRITICAL FACT, already verified against the real rendered DOM — do not re-derive or doubt this:** `flattenRows(block)` (exported from `ListBlock.tsx`) returns an array where **index 0 is the list BLOCK ITSELF** (`id === block.id`, its own `content`), and actual list items start at index 1. This was confirmed by counting `[data-row-id]` elements in the real DOM for a 2-item list fixture — there are 3, not 2. Every function in `listRowOps.ts` already accounts for this; you do not need to think about it, just don't be confused when `rows[0].id` isn't a list-item id.

**Read `src/lib/editor/listRowOps.ts` in full before writing code** — every function has a docstring naming exactly which branch of `ListBlock.tsx`'s `handleKeyDown` (lines 295–467) it mirrors.

**Import at the top of `NoteEditor.tsx`:**
```tsx
import { flattenRows, nestRows } from './ListBlock';
import { insertRowAfter, unindentRow, indentRow, mergeRowIntoPrevious, removeEmptyRow, removeEmptyTrailingRow } from '@/lib/editor/listRowOps';
```

**Add to `handleHostKeyDown`, inside the `if (rowEl && host.contains(rowEl))` block from the skeleton above:**

```tsx
const rowEl = anchorEl.closest<HTMLElement>('[data-row-id]');
if (rowEl && host.contains(rowEl)) {
  const rowId = rowEl.dataset.rowId;
  if (rowId) {
    // Find the list block that owns this row by walking `blocks` — a row's
    // owning block is whichever top-level block's flattened rows include this id.
    const listBlock = blocks.find(b => {
      if (!['bulletList', 'numberedList', 'dashedList', 'checklist'].includes(b.type)) return false;
      return flattenRows(b).some(r => r.id === rowId);
    });

    if (listBlock) {
      const flatRows = flattenRows(listBlock);
      const applyRows = (newRows: typeof flatRows | null) => {
        if (newRows === null) {
          // Signal to exit the list entirely — same as ListBlock's onExitTop/onExitBottom.
          // Simplest correct behavior: convert the list block to a plain empty text block.
          updateBlock(listBlock.id, { type: 'text', style: 'body', content: '', children: undefined });
        } else {
          const nested = nestRows(newRows, listBlock.type);
          updateBlock(listBlock.id, { content: nested.content, checked: nested.checked, children: nested.children });
        }
      };

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const row = flatRows.find(r => r.id === rowId);
        if (row && !row.content.trim()) {
          applyRows(removeEmptyTrailingRow(flatRows, rowId));
        } else {
          applyRows(insertRowAfter(flatRows, rowId, { id: crypto.randomUUID(), content: '', depth: row?.depth ?? 0 }));
        }
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        applyRows(e.shiftKey ? unindentRow(flatRows, rowId) : indentRow(flatRows, rowId));
        return;
      }

      if (e.key === 'Backspace') {
        const contentEl = rowEl.querySelector<HTMLElement>('[data-block-content]') ?? rowEl;
        const text = contentEl.textContent ?? '';
        if (!text.trim()) {
          e.preventDefault();
          applyRows(removeEmptyRow(flatRows, rowId));
          return;
        }
        // Non-empty row backspace-at-start-of-text (merge into previous) is
        // lower priority than the empty-row case above — if you have time,
        // detect caret-at-start via window.getSelection() (see ListBlock.tsx
        // lines 441-449 for the exact detection logic) and call
        // applyRows(mergeRowIntoPrevious(flatRows, rowId)). If you run out
        // of time, leaving this specific sub-case unimplemented is
        // acceptable — state so in your final report.
      }
    }
  }
  return; // ALWAYS return here — never let a row keystroke fall through to block logic.
}
```

**Note on `applyRows(null)`:** `ListBlock.tsx`'s real "exit list" behavior (`onExitTop`/`onExitBottom` props, wired in `BlockRenderer.tsx` around line 1416) does more than the simple version above (it can insert a new plain block rather than converting the list block itself). The simplified version here (convert the list block in place to an empty text block) is a **deliberate, acceptable simplification** for this handoff — it is not wrong, just not feature-identical to the original. Do not spend time trying to replicate the exact original behavior for this edge case; note the simplification in your final report.

**Probe for row Enter** (`tmp-task4-enter-probe.mjs`) — **already run against current, un-implemented code:**

```js
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', e => console.log('PAGE ERROR:', e.message));
await page.goto('http://localhost:3000/dev-note', { waitUntil: 'networkidle', timeout: 20000 });
await page.waitForTimeout(1200);

const row1 = page.locator('[data-row-id="blk-list-row1"]');
await row1.click();
await page.keyboard.press('End');
await page.keyboard.press('Enter');
await page.waitForTimeout(1300);

const result = await page.evaluate(() => {
  const s = window.__store.getState();
  const list = s.entities.find(e => e.id === 'dev-note-fixture').content.find(b => b.id === 'blk-list');
  return { rowCount: list.children.length, firstRowContent: list.children[0].content, secondRowContent: list.children[1]?.content };
});
console.log('RESULT:', result);
console.log('EXPECTED AFTER YOUR FIX: rowCount: 3, firstRowContent: "First bullet row", secondRowContent: "" (the new empty row)');
```

**VERIFIED baseline (measured against current, un-implemented code):**
```
{ rowCount: 2, firstRowContent: '<br>', secondRowContent: 'Second bullet row' }
```
**Important nuance in this baseline:** Enter is NOT fully inert here, unlike the plain-block case — the browser's native contenteditable default for Enter (inserting a `<br>`) already happened and got persisted via the row-persistence fix (a previous, separate fix in this session), corrupting row1's content to `'<br>'`. This is expected pre-fix behavior, not a new bug to chase — your Task 4 fix intercepts and prevents this by calling `e.preventDefault()`. After your fix, `rowCount: 3`, `firstRowContent` back to `'First bullet row'` (no stray `<br>`), and a new empty row 2.

Write analogous probes for Tab (indent `blk-list-row2`, check it becomes nested under `blk-list-row1` via `children` in the store — read `nestRows`'s logic to confirm the exact resulting shape: a `depth`-1 row becomes a `children` entry of the preceding `depth`-0 row) and Backspace-on-empty-row (clear `blk-list-row2`'s content first, then Backspace, confirm the row disappears and `rowCount` drops by one — you do not need a probe for the merge-into-previous sub-case if you did not implement it).

---

### Task 5: Backspace on an empty plain block (delete it)

**Source logic:** `BlockRenderer.tsx`, the `if (e.key === 'Backspace')` block (roughly lines 445–461): if the block's text is empty, delete the block (unless it's the only block or index 0).

**Add to `handleHostKeyDown`:**

```tsx
if (e.key === 'Backspace') {
  const contentEl = blockEl.querySelector<HTMLElement>('[data-block-content]');
  const text = contentEl?.textContent ?? '';
  if (!text.trim()) {
    const idx = blocks.findIndex(b => b.id === blockId);
    if (idx > 0) {
      e.preventDefault();
      deleteBlock(blockId);
    }
    return;
  }
}
```

Add `deleteBlock` to the dependency array. **This must NOT fire for list rows — check that your `[data-row-id]` resolution (Task 4) short-circuits before reaching this, exactly like Task 2's ordering note.**

**Probe** (`tmp-task5-probe.mjs`):

```js
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', e => console.log('PAGE ERROR:', e.message));
await page.goto('http://localhost:3000/dev-note', { waitUntil: 'networkidle', timeout: 20000 });
await page.waitForTimeout(1200);

const sub = page.locator('[data-block-id="blk-sub"] [data-block-content]');
await sub.click();
await page.keyboard.press('Home');
await page.keyboard.down('Shift'); await page.keyboard.press('End'); await page.keyboard.up('Shift');
await page.keyboard.press('Backspace'); // clear the block's text first
await page.waitForTimeout(150);
await page.keyboard.press('Backspace'); // second backspace on now-empty block: should delete it
await page.waitForTimeout(1300);

const result = await page.evaluate(() => {
  const s = window.__store.getState();
  const blocks = s.entities.find(e => e.id === 'dev-note-fixture').content;
  return { blockStillExists: blocks.some(b => b.id === 'blk-sub'), totalBlocks: blocks.length, allIds: blocks.map(b=>b.id) };
});
console.log('RESULT:', result);
console.log('EXPECTED AFTER YOUR FIX: { blockStillExists: false, totalBlocks: 3 }');
```

**VERIFIED baseline (measured against current, un-implemented code):**
```
{ blockStillExists: true, totalBlocks: 4, allIds: [ 'blk-title', 'blk-body', 'blk-sub', 'blk-list' ] }
```
Backspace on an empty block currently does nothing — the block survives untouched. After your fix: `blockStillExists: false`, `totalBlocks: 3`.

---

### Task 6: Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y — ALREADY DONE, do not redo

**This task is complete and committed. Skip it. Do not implement it again.** It was pre-built and verified against the real running component (not just typechecked), same as the slash-menu scaffold and `listRowOps.ts`, because it was identified as design-bearing rather than a mechanical port.

**What's already in place, for your context (you do not need to act on this):**
- `handleHostInput` (`NoteEditor.tsx`) debounces a `persistBlocks(blocksRef.current)` call 600ms after the last block-or-row edit, giving typing coalesced undo history without per-keystroke entries.
- `handleHostKeyDown` checks Ctrl+Z/Ctrl+Shift+Z/Ctrl+Y **first**, before any block/row resolution — already matches the skeleton at the top of this document.
- Verified live: type into a block, cross-block-merge it into a neighbor, Ctrl+Z once (merge reverts, typed text still present), Ctrl+Z again (typed text reverts too, back to original).

**If you find Ctrl+Z broken while testing another task, that is a regression from something YOU changed, not a pre-existing gap** — check what you touched in `handleHostKeyDown` or `handleHostInput` before assuming this task needs rework.

---

## After all tasks: final steps (do these, do not skip)

1. Run `npx tsc --noEmit` — must be clean (or have ONLY pre-existing errors unrelated to files you touched; if unsure, run `git stash` and re-run typecheck to compare against the baseline, then `git stash pop`).
2. Run `npm test -- mergeSelection` and `npm test -- domSelection` (or whatever your new test file is named, if you added `listRowOps.test.ts`) — all must pass.
3. Re-run **every probe from every task above, in one pass**, on a freshly loaded `/dev-note` page (a fresh Playwright browser context per probe, not one long session — state can leak between tests otherwise, as discovered earlier in this project). Confirm all still pass together, not just individually — a later task's fix could regress an earlier one.
4. **Do NOT delete `src/app/dev-note/`.** That happens in a separate, later cleanup step, not by you. Leave it as-is.
5. Commit each task separately as you complete it (not one giant commit at the end) — matches this project's convention and makes it possible to find exactly which change broke something if a later probe fails.
6. Write a final summary comment (as a new file `docs/superpowers/plans/2026-07-16-keyboard-handoff-RESULTS.md`) listing: which tasks fully passed their probe, which were partially completed with what's missing, and any deviations you made from this document's exact instructions and why. This is for the next person (a stronger model) who will verify your work — be honest about gaps, do not claim something works if you only got the typecheck to pass.

## Absolute do-not-do list (repeating, because it matters)

- Do not add `contentEditable` or `tabIndex` to any block or row div.
- Do not use a React `on*` JSX prop for any new native-event listening on the host — use `addEventListener` in a `useEffect`, matching `handleHostBeforeInput`/`handleHostInput`/`handleHostKeyDown`.
- Do not port `ListBlock.tsx`'s `ArrowUp`/`ArrowDown` handlers — already proven unnecessary.
- Do not install any new npm package (no jsdom, no editor library, nothing). Everything needed already exists in this repo.
- Do not claim a task is done because it typechecks. Only the stated probe, actually run, with matching output, counts.
- Do not delete `src/app/dev-note/`.
- Do not touch `main`'s unrelated files — check `git status` before every commit and `git add` only the exact files you changed for that task.
