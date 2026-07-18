# Ctrl+Enter New Block Shortcut + Mid-Block Delete Fix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a universal Ctrl+Enter shortcut that inserts a new plain text block immediately below the current block (works from anywhere — list rows, table cells, title, dividers, any block type) without requiring the user to first empty a row to "exit" a list. Also fix a real bug where Delete does nothing when the caret sits at the start of a non-final line inside a multi-line block (a block with a soft line break via Shift+Enter).

**Architecture:** `NoteEditor.tsx`'s `blocksHostRef` div is the single `contentEditable` host for every block except the note title (`<h1>`, a separate standalone `contentEditable` element with its own React `onKeyDown`). All keyboard handling for blocks/rows lives in one native `keydown` listener, `handleHostKeyDown`, registered via `useEffect`. Ctrl+Enter must be checked there, in the SAME early position as the existing Ctrl+Z/Ctrl+Y checks (before any row/block DOM resolution), plus separately in the title's own `onKeyDown` prop. The existing `insertAfter(afterId, forceType?, openSlash?, inside?)` function already does "insert a new block after a given block id and focus it" — Ctrl+Enter reuses it unchanged; the only new logic is resolving "what is the correct `afterId` for whatever the caret is currently in."

**Tech Stack:** Next.js 16, React 19, TypeScript, Zustand, vitest, Playwright (headless probes against `/dev-note`, the dev-only test harness at `src/app/dev-note/page.tsx`).

## Global Constraints

- Work directly on `main`. One commit per task, exact messages given below.
- Do NOT attempt any editor-library migration (no TipTap/ProseMirror). Fix in place.
- Do NOT delete or modify `src/app/dev-note/page.tsx` (the test harness).
- After EVERY task: run `npx tsc --noEmit` (must be clean) and `npm test -- src/lib/editor/` (all 82 tests must still pass) before committing.
- Do not "improve" anything not listed here. No refactors, no style changes, no extra cleanup.
- The dev server: `npm run dev`. If port 3000 is taken, Next.js will print the actual port in its startup log — check `.next\dev\logs\next-development.log` if a fetch to port 3000 fails, or check with `node -e "fetch('http://localhost:3000/dev-note').then(r=>console.log(r.status))"` first and try 3001 if that fails.
- Probe page: `http://localhost:3000/dev-note` (or whatever port the dev server actually bound). The page exposes `window.__store` (Zustand store; read state via `window.__store.getState()`, and you can seed fixture content via `window.__store.getState().updateEntityContent('dev-note-fixture', [...])`).
- The fixture entity's blocks: `blk-title` (title, style `title`), `blk-body` (body paragraph, content "Some paragraph text here"), `blk-sub` (subheading), `blk-list` (bulletList with child rows `blk-list-row1` "First bullet row", `blk-list-row2` "Second bullet row"). The note's actual title (the separate `<h1>`, NOT a block) defaults to "Dev Note".
- Playwright verification pattern used throughout this codebase: `const ctx = await browser.newContext(); const page = await ctx.newPage();` — use a FRESH context per test case, not just a fresh page, because the Zustand store persists to localStorage and a fresh Page alone shares state with earlier pages in the same script.
- After any store-modifying keystroke sequence in a probe, wait at least 1500ms before reading `window.__store.getState()` — there are two debounces in this file (600ms typing-history coalescing, 1000ms store-sync) that must settle first.
- Delete all temporary probe scripts (`tmp-*.mjs` in the repo root) before your final commit of each task. Do not commit them.

---

### Task 1: Ctrl+Enter inserts a new block after the current block, from any block type or list row

**Files:**
- Modify: `src/components/editor/NoteEditor.tsx`

**Interfaces:**
- Consumes: the existing `insertAfter(afterId: string, forceType?: BlockType, openSlash?: boolean, inside?: boolean): void` function (already defined in this file, do not modify it).
- Produces: nothing new exported; this is purely new branches inside the existing `handleHostKeyDown` callback and the title's inline `onKeyDown` handler.

- [ ] **Step 1: Add the Ctrl+Enter check inside `handleHostKeyDown`, immediately after the existing Ctrl+Y check and BEFORE the row/block resolution split.**

Find this exact block (search for `'y'` in the file — it's the redo shortcut):

```ts
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      if (typingHistoryTimer.current) { clearTimeout(typingHistoryTimer.current); typingHistoryTimer.current = null; }
      redo();
      return;
    }

    const sel = window.getSelection();
    const anchorNode = sel?.anchorNode ?? null;
    const anchorEl = anchorNode?.nodeType === Node.TEXT_NODE ? anchorNode.parentElement : (anchorNode as HTMLElement | null);
    if (!anchorEl) return;
```

Insert a new block of code between the closing `}` of the Ctrl+Y check and the `const sel = window.getSelection();` line, so the file reads:

```ts
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      if (typingHistoryTimer.current) { clearTimeout(typingHistoryTimer.current); typingHistoryTimer.current = null; }
      redo();
      return;
    }

    // Ctrl+Enter: insert a new plain text block immediately after the
    // CURRENT TOP-LEVEL BLOCK, regardless of what's focused inside it —
    // a list row, a table cell, plain paragraph text, anything. This is
    // the escape hatch for "I'm inside a list/table and want a normal
    // block below it" without needing to empty a row first (the only
    // other way to exit a list today). Checked here, before the
    // row-vs-block resolution split below, because the answer is the
    // same either way: resolve to the nearest [data-block-id] ancestor.
    // For a list row that IS the list's own wrapper (rows live nested
    // inside it) — exactly the "parent block" id insertAfter needs.
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      const selCE = window.getSelection();
      const anchorNodeCE = selCE?.anchorNode ?? null;
      const anchorElCE = anchorNodeCE?.nodeType === Node.TEXT_NODE ? anchorNodeCE.parentElement : (anchorNodeCE as HTMLElement | null);
      const targetBlockEl = anchorElCE?.closest<HTMLElement>('[data-block-id]');
      const targetBlockId = targetBlockEl?.dataset.blockId;
      if (targetBlockId && host.contains(targetBlockEl!)) {
        insertAfter(targetBlockId, 'text');
      }
      return;
    }

    const sel = window.getSelection();
    const anchorNode = sel?.anchorNode ?? null;
    const anchorEl = anchorNode?.nodeType === Node.TEXT_NODE ? anchorNode.parentElement : (anchorNode as HTMLElement | null);
    if (!anchorEl) return;
```

- [ ] **Step 2: Add `insertAfter` to `handleHostKeyDown`'s dependency array.** Find the end of the callback:

```ts
  }, [isReadMode, handleSlash, undo, redo, persistBlockUpdate, blocks, insertAfter, indentBlock, unindentBlock, setBlocks, entity.id, updateEntityContent]);
```

`insertAfter` is ALREADY in this array — no change needed here. (Confirm this is still true when you read the file; if it isn't, add it.)

- [ ] **Step 3: Add the same shortcut to the title's own `onKeyDown`.** The title is a separate `<h1 ref={titleRef} contentEditable={isEditingTitle} ...>` element outside the shared host, with its own inline `onKeyDown` prop. Find:

```tsx
                      onKeyDown={e => {
                        if (e.key === 'Enter' && isEditingTitle) {
                          e.preventDefault();
                          e.currentTarget.blur();
                        }
                        if (e.key === 'Escape' && isEditingTitle) {
                          e.currentTarget.textContent = entity.title;
                          setEditingEntityId(null);
                        }
                      }}
```

Replace with:

```tsx
                      onKeyDown={e => {
                        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && isEditingTitle) {
                          // The title isn't a block (no data-block-id, lives
                          // outside blocksHostRef entirely) — there's no
                          // "afterId" to reuse insertAfter with. Insert a
                          // fresh text block at the very front of the array
                          // instead, unconditionally (the array is never
                          // empty — blocks.length === 0 renders a
                          // click-to-create empty state, not this path).
                          e.preventDefault();
                          const newBlock = createBlock('text');
                          persistBlocks([newBlock, ...blocks]);
                          setTimeout(() => {
                            const el = document.querySelector(`[data-block-id="${newBlock.id}"] [data-block-content]`) as HTMLElement;
                            if (el) focusAtEnd(el);
                          }, 50);
                          return;
                        }
                        if (e.key === 'Enter' && isEditingTitle) {
                          e.preventDefault();
                          e.currentTarget.blur();
                        }
                        if (e.key === 'Escape' && isEditingTitle) {
                          e.currentTarget.textContent = entity.title;
                          setEditingEntityId(null);
                        }
                      }}
```

This uses `createBlock` (already imported/defined at the top of this file) and `persistBlocks`/`focusAtEnd` (already defined earlier in this component) — no new imports needed.

- [ ] **Step 4: Typecheck and unit tests**

Run: `npx tsc --noEmit` → must be clean (no new errors in `NoteEditor.tsx`).
Run: `npm test -- src/lib/editor/` → all 82 tests must still pass.

- [ ] **Step 5: Write and run a live verification probe.** Start the dev server if not already running (`npm run dev`, wait for it to report "Ready", confirm with a fetch to `/dev-note`). Create `tmp-verify-ctrl-enter.mjs` in the repo root with this exact content:

```js
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
let fails = 0;
function log(name, pass, extra) {
  console.log(`${pass ? 'PASS' : 'FAIL'} - ${name}${extra ? ' | ' + JSON.stringify(extra) : ''}`);
  if (!pass) fails++;
}

async function setCollapsedCaret(page, selector, offset) {
  await page.evaluate(({ selector, offset }) => {
    const el = document.querySelector(selector);
    el.focus();
    const textNode = el.firstChild || el;
    const range = document.createRange();
    const target = textNode.nodeType === Node.TEXT_NODE ? textNode : el;
    const maxOffset = target.textContent?.length ?? 0;
    range.setStart(target, Math.min(offset, maxOffset));
    range.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }, { selector, offset });
}

// Test 1: Ctrl+Enter inside a list row inserts a new block AFTER THE WHOLE LIST, not inside it
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('http://localhost:3000/dev-note', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-block-id="blk-title"]');
  await setCollapsedCaret(page, '[data-row-id="blk-list-row1"]', 'First bullet row'.length);
  await page.keyboard.press('Control+Enter');
  await page.waitForTimeout(300);
  const store = await page.evaluate(() => window.__store.getState().entities.find(e => e.id === 'dev-note-fixture'));
  const listIdx = store.content.findIndex(b => b.id === 'blk-list');
  const nextBlock = store.content[listIdx + 1];
  const listUnchanged = store.content.find(b => b.id === 'blk-list').children.length === 2;
  log('Ctrl+Enter in a list row inserts new block after the WHOLE list', nextBlock?.type === 'text' && listUnchanged, { listIdx, nextBlock, listChildren: store.content.find(b => b.id === 'blk-list').children });
  await ctx.close();
}

// Test 2: focus lands in the newly created block, typing goes there
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('http://localhost:3000/dev-note', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-block-id="blk-title"]');
  await setCollapsedCaret(page, '[data-row-id="blk-list-row2"]', 'Second bullet row'.length);
  await page.keyboard.press('Control+Enter');
  await page.waitForTimeout(300);
  await page.keyboard.type('hello from ctrl enter');
  await page.waitForTimeout(1500);
  const store = await page.evaluate(() => window.__store.getState().entities.find(e => e.id === 'dev-note-fixture'));
  const listIdx = store.content.findIndex(b => b.id === 'blk-list');
  const nextBlock = store.content[listIdx + 1];
  log('Typed text after Ctrl+Enter lands in the new block', nextBlock?.content === 'hello from ctrl enter', { nextBlock });
  await ctx.close();
}

// Test 3: Ctrl+Enter in a plain paragraph block (not a list) still works
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('http://localhost:3000/dev-note', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-block-id="blk-title"]');
  await setCollapsedCaret(page, '[data-block-id="blk-body"] [data-block-content]', 'Some paragraph text here'.length);
  await page.keyboard.press('Control+Enter');
  await page.waitForTimeout(300);
  const store = await page.evaluate(() => window.__store.getState().entities.find(e => e.id === 'dev-note-fixture'));
  const bodyIdx = store.content.findIndex(b => b.id === 'blk-body');
  const nextBlock = store.content[bodyIdx + 1];
  log('Ctrl+Enter in a plain paragraph block inserts new block after it', nextBlock?.type === 'text' && nextBlock?.id !== 'blk-sub', { nextBlock });
  await ctx.close();
}

// Test 4: Ctrl+Enter in the TITLE inserts a new block at the very front of blocks
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('http://localhost:3000/dev-note', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-block-id="blk-title"]');
  // Double-click the real note title (the h1) to enter edit mode
  await page.dblclick('h1');
  await page.waitForTimeout(300);
  await page.keyboard.press('Control+Enter');
  await page.waitForTimeout(300);
  const store = await page.evaluate(() => window.__store.getState().entities.find(e => e.id === 'dev-note-fixture'));
  const firstBlock = store.content[0];
  log('Ctrl+Enter in the title inserts a new block at index 0', firstBlock?.type === 'text' && firstBlock?.id !== 'blk-title', { firstBlock });
  await ctx.close();
}

// Test 5: Ctrl+Enter in a table cell inserts a new block after the table
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('http://localhost:3000/dev-note', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-block-id="blk-title"]');
  await page.evaluate(() => {
    const s = window.__store.getState();
    const ent = s.entities.find(e => e.id === 'dev-note-fixture');
    s.updateEntityContent('dev-note-fixture', [...ent.content, { id: 'blk-table', type: 'table', content: '', tableData: [['H1','H2'],['a','b']] }]);
  });
  await page.waitForTimeout(500);
  const cellSelector = '[data-block-id="blk-table"] [contenteditable], [data-block-id="blk-table"] td, [data-block-id="blk-table"] [data-block-content]';
  const cellCount = await page.locator(cellSelector).count();
  if (cellCount > 0) {
    await page.locator(cellSelector).first().click();
    await page.waitForTimeout(200);
    await page.keyboard.press('Control+Enter');
    await page.waitForTimeout(300);
    const store = await page.evaluate(() => window.__store.getState().entities.find(e => e.id === 'dev-note-fixture'));
    const tableIdx = store.content.findIndex(b => b.id === 'blk-table');
    const nextBlock = store.content[tableIdx + 1];
    log('Ctrl+Enter in a table cell inserts new block after the table', nextBlock?.type === 'text', { nextBlock });
  } else {
    console.log('SKIP - Test 5: could not locate an editable table cell to click (informational, inspect table DOM structure manually if this matters)');
  }
  await ctx.close();
}

// Regression: normal Enter in a list row still creates a new ROW, not a new top-level block
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('http://localhost:3000/dev-note', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-block-id="blk-title"]');
  await setCollapsedCaret(page, '[data-row-id="blk-list-row1"]', 'First bullet row'.length);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const store = await page.evaluate(() => window.__store.getState().entities.find(e => e.id === 'dev-note-fixture'));
  const listBlock = store.content.find(b => b.id === 'blk-list');
  log('Regression: plain Enter in a list row still creates a new ROW (not affected by Ctrl+Enter change)', listBlock.children.length === 3, { children: listBlock.children.map(c => c.content) });
  await ctx.close();
}

await browser.close();
console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAILURES`);
process.exit(fails === 0 ? 0 : 1);
```

Run: `node tmp-verify-ctrl-enter.mjs`. Expected: `ALL PASS` (Test 5 may print `SKIP` if the table's cell selector doesn't match this codebase's actual table DOM structure — if so, inspect `src/components/editor/TableBlock.tsx` for the real cell markup and adjust the selector, then re-run; do not skip verifying table behavior entirely).

- [ ] **Step 6: Delete the probe script**

```bash
rm tmp-verify-ctrl-enter.mjs
```

- [ ] **Step 7: Commit**

```bash
git add src/components/editor/NoteEditor.tsx
git commit -m "feat(editor): Ctrl+Enter inserts a new block below the current one, from any block type"
```

---

### Task 2: Fix Delete doing nothing when the caret is at the start of a non-final line in a multi-line block

**Files:**
- Modify: `src/components/editor/NoteEditor.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: no new exports; fixes the existing `if (e.key === 'Delete')` branch inside `handleHostKeyDown`.

**Root cause (confirmed by live reproduction):** a block can contain a soft line break (`<br>`, inserted by Shift+Enter) — the whole block is still ONE `[data-block-content]` div with multiple visual lines. The current Delete handler only checks whether the caret is at the very END of the ENTIRE block's text (by measuring from the caret to the end of `contentEl` and checking if that's empty) — it has no concept of "delete the character/br immediately after the caret" for any other position. So placing the caret at the very start of line 2 (with more text after it on that same line) does nothing at all: the "at the end" check is false (there's still text after the caret), and there is no other code path for Delete, so the keystroke is silently swallowed.

- [ ] **Step 1: Read the current Delete branch to confirm line numbers before editing** (they may have shifted slightly from Task 1's insertion above it — re-grep for `if (e.key === 'Delete')` in `NoteEditor.tsx` rather than trusting a hardcoded line number).

- [ ] **Step 2: Add a native character-forward-delete fallback for the case where the caret is collapsed but NOT at the true end of the block.** Find the existing Delete branch:

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
      return;
    }
```

Replace the final `return;` (the one right after the closing `}` of the `if (test.toString().length === 0) { ... }` block, still INSIDE the outer `if (contentEl && selD?.rangeCount && ...)` block) with a fallback that lets the browser handle an ordinary forward-delete WITHIN the block, but keeps it inside React's tracking by manually deleting the next character/node and syncing state — matching how this codebase already treats same-block edits (it does NOT rely on native uncontrolled DOM edits; see `handleHostInput`'s comment about the container being the single editing host). The safest correct approach: don't `preventDefault()` for this case at all, and let it fall through to the browser's native `deleteContentForward`, which will fire a native `beforeinput`/`input` event that `handleHostBeforeInput`/`handleHostInput` already handle correctly for same-block edits (confirmed: those handlers only intercept CROSS-block or destructive multi-block operations; a same-block forward-delete keeps the block's own `[data-block-content]` div, and `handleHostInput`'s existing block-resolution + `updateBlock(blockId, {content: contentEl.innerHTML})` call already persists it). The bug is NOT that native deletion is unsafe here — it's that the current code's `return;` at the bottom of this `if` block prevents the key from ever reaching that native path, because `e.preventDefault()` runs unconditionally as part of your reading before this fix... **verify this claim before implementing**: re-read the current code exactly as it exists in the file (Step 1) and confirm whether `e.preventDefault()` is called unconditionally for `Delete` or only inside the `if (test.toString().length === 0)` block. If it's only inside that inner `if` (as shown above), then the bug is NOT "prevented" — it's that NOTHING is done at all for the mid-block case, meaning the key event should already be falling through to native behavior. If your live reproduction (Task 2, Step 4) still shows Delete doing nothing even after confirming this, the actual root cause is different: check whether `handleHostBeforeInput`'s `DESTRUCTIVE` set intercepts `deleteContentForward` even for collapsed, same-block carets, and whether it's incorrectly returning without persisting in that case. Read `handleHostBeforeInput` (search for `deleteContentForward` in the `DESTRUCTIVE` Set) and its early-return logic (`if (!selection) { ... return; }`) — a collapsed, same-block Delete has `getBlockSelection` return `null`, which under the current code just returns without calling `preventDefault()`, meaning the browser's native deletion SHOULD proceed unobstructed. If it doesn't, instrument with a `console.log` of `native.inputType` inside `handleHostBeforeInput` and reproduce live to see what's actually happening before writing any fix — do not guess further than this plan already has.

- [ ] **Step 3: Given the ambiguity above, the concrete fix (apply after confirming via Step 2's live instrumentation):** most likely the actual bug is that `handleHostInput` (which persists same-block edits after the browser's native DOM change) resolves the WRONG content when a `<br>`-containing block is edited, OR the caret-position math elsewhere in this file (the `textOffsetWithin`/`restoreCursor` functions in `src/lib/editor/domSelection.ts`) miscounts offsets across a `<br>` boundary, causing a subsequent `pendingCursor` restore to silently fail and leave the caret looking "stuck" even though the underlying content DID change. Test this specific hypothesis: after pressing Delete in the reproduction case, check `window.__store.getState()` for whether the CONTENT actually changed (even if the visible caret didn't appear to move) — this determines whether the fix belongs in `handleHostInput`/`handleHostBeforeInput` (content not persisting) or in `restoreCursor`/cursor math (content persisted correctly but caret visually appears stuck). Do not implement a fix until you know which of these it is — write the live reproduction probe in Step 4 FIRST, inspect its output, THEN make the minimal targeted fix in whichever location the evidence points to.

- [ ] **Step 4: Write and run a live reproduction probe BEFORE attempting any fix.** Create `tmp-repro-delete-midblock.mjs`:

```js
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGE ERROR:', e.message));
await page.goto('http://localhost:3000/dev-note', { waitUntil: 'networkidle' });
await page.waitForSelector('[data-block-id="blk-title"]');

// Build a block with an empty first line and text on the second line via Shift+Enter
await page.evaluate(() => {
  const el = document.querySelector('[data-block-id="blk-body"] [data-block-content]');
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
});
await page.keyboard.press('Enter');
await page.waitForTimeout(200);
await page.keyboard.press('Shift+Enter');
await page.waitForTimeout(200);
await page.keyboard.type('second line text');
await page.waitForTimeout(1500);

const store0 = await page.evaluate(() => window.__store.getState().entities.find(e => e.id === 'dev-note-fixture'));
const newBlockId = store0.content.find(b => !['blk-title','blk-body','blk-sub','blk-list'].includes(b.id))?.id;
console.log('block BEFORE delete:', JSON.stringify(store0.content.find(b => b.id === newBlockId)));

// Move caret to the very start of "second line text" (right after the <br>)
await page.evaluate((id) => {
  const el = document.querySelector(`[data-block-id="${id}"] [data-block-content]`);
  el.focus();
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (node.textContent.includes('second')) break;
  }
  const range = document.createRange();
  range.setStart(node, 0);
  range.collapse(true);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}, newBlockId);
await page.waitForTimeout(200);

const domBefore = await page.evaluate((id) => document.querySelector(`[data-block-id="${id}"] [data-block-content]`).innerHTML, newBlockId);
console.log('DOM innerHTML BEFORE delete:', JSON.stringify(domBefore));

await page.keyboard.press('Delete');
await page.waitForTimeout(500);

const domAfter = await page.evaluate((id) => document.querySelector(`[data-block-id="${id}"] [data-block-content]`)?.innerHTML, newBlockId);
console.log('DOM innerHTML immediately AFTER delete keypress:', JSON.stringify(domAfter));

await page.waitForTimeout(1500);
const store1 = await page.evaluate(() => window.__store.getState().entities.find(e => e.id === 'dev-note-fixture'));
console.log('block in STORE after delete + settle:', JSON.stringify(store1.content.find(b => b.id === newBlockId)));

await browser.close();
```

Run: `node tmp-repro-delete-midblock.mjs`. Read the three logged states carefully:
- If `domAfter` differs from `domBefore` (the DOM actually changed) but the STORE value is unchanged or reverts — the bug is in persistence (`handleHostInput` or `handleHostBeforeInput`).
- If `domAfter` equals `domBefore` (nothing happened in the DOM at all) — the bug is that the key event is being fully swallowed somewhere with no native fallback and no store change either; search `handleHostBeforeInput` for where `deleteContentForward` might be preventDefault'd incorrectly for a same-block, collapsed-caret case.

- [ ] **Step 5: Based on the Step 4 output, implement the minimal fix.** Do not write speculative code for both hypotheses — the probe output tells you which one is real. If it's the persistence path: check `handleHostInput`'s content-resolution — it currently does `updateBlock(blockId, { content: contentEl.innerHTML })`, which should correctly pick up ANY DOM change including a `<br>` removal; if this isn't firing, check whether `getBlockSelection(host)` is incorrectly returning non-null for this case (which would make `handleHostInput` skip via its early `if (selection) return;`), even though the edit is entirely within one block — if so, the fix belongs in `src/lib/editor/domSelection.ts`'s `getBlockSelection`/`blockOf` functions, which is DOM-manipulation-sensitive code outside this file's direct control; flag this precisely in your final RESULTS notes rather than modifying `domSelection.ts` without instruction, since that file has its own existing unit-test coverage (`src/lib/editor/*.test.ts`) that a change here could invalidate.

- [ ] **Step 6: Verify the fix.** Re-run `node tmp-repro-delete-midblock.mjs` after your fix. Expected final store state: the block's content should be exactly `Some paragraph text heresecond line text` if you also verify the ORIGINAL bug report context (the user said the FIRST line was empty and they were pressing Delete at the start of the SECOND line) — actually, re-read the user's exact words: "when my focus is in front of first character on the second paragraph line in the block, and first line is empty... when i press delete, nothing happens." This means: pressing Delete at the START of line 2, with line 1 EMPTY, should delete FORWARD — removing the `<br>` and merging line 2's text up into line 1's (empty) position, NOT deleting a character of "second line text". Confirm the fix produces content `second line text` (the `<br>` and the empty first line collapsed away, cursor now at the true start of the block) — not `econd line text` (which would mean it incorrectly deleted the first character of "second" instead of the line break before it). This distinction matters: standard editor behavior for Delete-at-line-start-with-empty-line-above is "remove the line break", exactly like Backspace-at-line-start removes the line break behind it.

- [ ] **Step 7: Add a targeted regression check for normal end-of-block Delete (block-boundary merge) to confirm this fix didn't break it.** Using the same probe pattern: place a collapsed caret at the TRUE end of `blk-body`'s content (offset = full text length, no trailing `<br>`), press Delete, confirm it still forward-merges `blk-sub`'s content into `blk-body` exactly as before (this is pre-existing, tested behavior — see the existing block-boundary-Delete logic already in this file; do not regress it).

- [ ] **Step 8: Typecheck and unit tests**

Run: `npx tsc --noEmit` → clean.
Run: `npm test -- src/lib/editor/` → 82/82 pass.

- [ ] **Step 9: Delete probe scripts**

```bash
rm -f tmp-repro-delete-midblock.mjs
```

- [ ] **Step 10: Commit**

```bash
git add src/components/editor/NoteEditor.tsx
git commit -m "fix(editor): Delete does nothing when caret is at start of a non-final line in a multi-line block"
```

If your commit also touches `src/lib/editor/domSelection.ts` per Step 5's finding, add that file to the `git add` and mention it explicitly in the commit body, and re-run `npm test -- src/lib/editor/` one more time to confirm its existing unit tests still pass after your change.

---

### Task 3: Final combined verification and results write-up

**Files:**
- Create: `docs/superpowers/plans/2026-07-17-ctrl-enter-and-delete-fix-RESULTS.md`

- [ ] **Step 1: Run the complete verification sweep one final time, from a clean state.**

```bash
npx tsc --noEmit
npm test -- src/lib/editor/
```

Both must be clean/passing.

- [ ] **Step 2: Confirm no `tmp-*.mjs` files remain in the repo root.**

```bash
git status --short
```

Should show only the two/three modified files from Tasks 1 and 2, plus this new RESULTS file. No untracked `tmp-*` files.

- [ ] **Step 3: Write the RESULTS file** with: per-task status (done/blocked), the verbatim final output of `npx tsc --noEmit` and `npm test -- src/lib/editor/`, a summary of what Task 2's live-reproduction probe actually revealed (DOM-changed-but-not-persisted vs. fully-swallowed vs. something else) and which fix you applied as a result, and the outcome of every probe test case run across both tasks (paste real PASS/FAIL lines, not paraphrased summaries). If Task 2's root cause pointed into `domSelection.ts` and you did not modify it per the plan's instruction, say so explicitly and describe what you found instead — this is a legitimate outcome to report, not a failure to hide.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/2026-07-17-ctrl-enter-and-delete-fix-RESULTS.md
git commit -m "docs: Ctrl+Enter and mid-block Delete fix results"
```
