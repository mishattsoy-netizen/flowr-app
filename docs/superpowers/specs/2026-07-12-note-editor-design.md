# Note Editor — Design

**Date:** 2026-07-12
**Status:** Approved, pending implementation plan

## Goal

Fast, seamless note taking and knowledge management. The editor must **feel like a plain text document** while keeping the block affordances that make it worth using.

### The governing rule

> Typing, selecting, deleting, and pasting behave exactly as they do in a plain text document. Blocks are only visible when you deliberately reach for them — hover (drag handle), `/` commands, colors, folding, media.

A block is a paragraph. The user never decides "should this be a new block" — pressing Enter makes one, which is where a paragraph break goes anyway. Blocks are a pure addition on top of plain-text behavior, never a tax on it.

### Platforms

- **N1 (99% of use):** desktop + web. macOS 11–13", Windows large screen. Mouse + keyboard. Safari/Chrome. **Single-column and split/two-column modes both matter.**
- **N2:** iPhone — deferred entirely. Not in scope for this spec.

## Root cause of the current pain

[`src/components/editor/BlockRenderer.tsx:1496`](../../../src/components/editor/BlockRenderer.tsx)

```tsx
contentEditable={(isFocused && !isReadOnly) ? true : undefined}
```

`isFocused` is **per-block local state** (line 175). Each block independently decides whether it is editable, and is editable *only while focused*. Every unfocused block is an inert, non-editable div.

This conditional causes the focus problems directly:

- **Focus is lost when Enter creates a new row.** The new block is not editable at the moment it is created, so focus has nowhere to land.
- **Clicking the empty bottom area does not reliably start typing.** Same cause.

**Text selection has a second, deeper cause** — each block being its own **editing host**. See §1.1: a native selection cannot cross an editing-host boundary, so *no* amount of toggling `contentEditable` per block fixes it. The blocks must live inside one shared host.

**Non-goal: migration.** A previous attempt migrated to TipTap/ProseMirror, destroyed the editor, and was reverted. Note the fix in §1.1 is emphatically **not** that migration in disguise: a single `contentEditable` wrapper around our own React components is not a new editor engine, and requires no library and no data migration. TipTap deps remain in `package.json` and should be removed as cleanup.

## Phase 1 — Feels like plain text

Shipped **alone** and tested before anything else is stacked on top. This is the risky change; everything in Phase 2 is independent of it.

**Scope honesty.** Phase 1 is not a one-line fix. Moving to a single editing host (§1.1) changes where input is handled and how the DOM syncs back to the store — the load-bearing parts of the editor. It is contained (no library, no data migration, no new engine) but it is real surgery. If it starts destabilizing the editor, stop and report rather than piling fixes on top; that is the failure mode that destroyed the previous attempt.

### 1.1 One editing host, blocks as plain divs inside it

**The browser constraint (measured, not assumed).** Two sibling `contenteditable="true"` elements are two independent **editing hosts**, and a native `Selection` *cannot cross an editing-host boundary*. Verified in headless Chromium:

| Model | Structure | Drag from block 1 → block 2 |
|---|---|---|
| **A** | each block its own `contenteditable` | selects `"t "` — anchor **and** focus both stay in block 1. **Selection never leaves the block.** |
| **B** | one `contenteditable` wrapper, blocks are plain `<div>`s inside | selects `"t block text\nSecond"` — anchor in block 1, focus in block 2. **True character-level cross-block selection.** |

Making every block always-editable (Model A) therefore **does not fix anything** — it reproduces the original complaint with every block editable and still trapped. This is why Notion snaps to whole-block selection, and why Obsidian gets character-level selection: Obsidian is *one* CodeMirror document, i.e. one host.

**Therefore: Model B.** The blocks container becomes a single `contentEditable` host. Individual blocks are plain `<div>`s inside it — no longer editing hosts of their own. `isFocused` stops gating editability.

The browser then implements our merge rule natively. Same probe, typing `X` over the cross-block selection:

```
before:  <div id="b1">First block text</div>   <div id="b2">Second block text</div>
after :  <div id="b1">FirsX block text</div>
```

First block wins, keeps its identity, the fully-selected block is gone, cursor at the seam — exactly §1.3.

**This is not a library migration.** Model B is a single wrapper around *our own* React components, blocks, and store. No TipTap, no ProseMirror, no data migration, no new editor engine. It is larger than flipping one conditional — `beforeinput`/`input` handling moves to the container, and DOM↔store sync changes — but it is a fix to the editor we have, not a replacement of it.

### 1.2 Intercept destructive cross-block operations

Block content is stored as **HTML** (`innerHTML`, BlockRenderer.tsx:344) and written back to the store on every `onInput`. Once selection can span blocks, an uncontrolled edit would let the browser rewrite several blocks' DOM at once while only one block fires `onInput` — silently losing text.

Therefore: when a selection spans more than one block, **we intercept** typing, Backspace, Delete, Cut, and Paste and apply them as a controlled store operation, then re-render. Selection itself stays fully native. The intercept is invisible in normal use.

### 1.3 The merge rule (first block wins)

When a multi-block selection is deleted or typed over:

1. The surviving text is the **unselected head of the first block** joined with the **unselected tail of the last block**, forming one block.
2. That block **keeps the first block's type and formatting.** Fully-selected blocks in between are deleted outright.
3. The **cursor lands at the seam** between the surviving head and tail.
4. **Inline formatting in the surviving head and tail is preserved.** Bold, links and other inline markup live on through the merge. Text the user never selected must never lose its formatting because of an edit elsewhere — that would be silent data loss. The merge therefore operates on sliced **HTML**, not on flattened plain text.

"First" means first in **document order**, so the result is identical whether the user dragged top-to-bottom or bottom-to-top.

This is Word, Google Docs, Notion, and Obsidian behavior. It is also what a plain text file does when deleting a selection spanning several lines: the surviving head and tail join into one line. The only addition is "the block keeps its type," which is the minimum required for blocks to exist at all.

#### Worked example (the acceptance test)

Given H1 `My Great Title` / paragraph / H2 `Another subheading`, select from offset 8 in the H1 (after `My Great`), through the entire paragraph, to offset 7 in the H2 (after `Another`), and type `X`.

Offsets are exact and were verified by running the algorithm: `'Another subheading'.slice(7) === ' subheading'`, keeping the leading space so the merged result reads naturally.

```
BEFORE                          AFTER
─────────────────────────       ─────────────────────────
# My Great Title                # My GreatX subheading
       └─ selection starts      (one H1 block, cursor after X)

Some paragraph text here        (fully selected → deleted)
  all of it selected

## Another subheading           (H2 gone as a block; surviving
   selection ends ─┘             tail "subheading" merged into H1)
```

Result: a single H1 reading `My GreatX subheading`, cursor immediately after `X`.

#### Consequent cases (surprising but correct)

- Selecting a whole heading plus part of the next paragraph, then typing, leaves a **heading** containing the paragraph's tail. Obeys rule 2, matches Word, rare in practice, undoable.
- Select-all + type leaves **one empty block of the first block's type**, cursor in it.

### 1.4 Selection highlight

Native character-level text highlight, **plus** a subtle tint on each block the selection touches. (Explicit user request: "text selection + block of the selected text highlights a bit.")

### 1.5 Undo

`Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y` restore across the whole merge as a single step. A history stack already exists at `NoteEditor.tsx:519–688`; wire it, do not rebuild it.

### Phase 1 acceptance criteria

A passing `tsc --noEmit` is **not** evidence that Enter puts the cursor in the right place. Verification is split in two, to keep browser use (and the user's quota) to a minimum.

**Machine-verified — pure logic, vitest, no browser.**

The merge rule is extracted as a pure function: given the block list, a start block + offset, and an end block + offset, return the new block list and the cursor position. Exhaustively tested:

- [ ] The worked example above produces exactly the stated result.
- [ ] Selection dragged bottom-to-top produces the identical result (document order).
- [ ] Partial first block only; partial last block only; both partial; neither partial.
- [ ] Adjacent blocks; blocks with fully-selected blocks between them.
- [ ] Select-all → one empty block of the first block's type.
- [ ] Surviving block always keeps the **first** block's type.

**Human-verified — wiring and feel, by the user in the running app.**

Whether the browser's `Selection` maps to the right block IDs and offsets, whether focus lands correctly, and whether always-editable blocks broke anything else, is what a person notices in five seconds and a test suite struggles to see:

- [ ] Drag-select a passage spanning four blocks → continuous native highlight, touched blocks tinted.
- [ ] Type over a multi-block selection → merge is correct, no text loss.
- [ ] Backspace over a multi-block selection → same.
- [ ] Cut / Paste over a multi-block selection → same; clipboard correct.
- [ ] `Ctrl+Z` restores the pre-merge state in one step.
- [ ] Focus is never lost during any of the above.
- [ ] Nothing else regressed — drag handle, click-to-focus, `/` menu, typing in a single block.

**Reporting rule.** When handing a build over, state exactly what was verified and what was not. If the tests pass but the app has not been run, say so plainly: *"logic is tested, wiring is unverified — please try X, Y, Z."* Never report "it works" when the actual claim is "it compiles."

**Phase 1 is a failure if the editor still feels like fighting boxes.** The success measure is not "cross-block selection works" — it is *"I can select a passage spanning four paragraphs, type over it, and it does what a text file would do."*

## Phase 2 — UI/UX polish

Only after the user has tested and accepted Phase 1. Every item here is independent of Phase 1 and of every other item.

| # | Item | Notes |
|---|---|---|
| 1 | **Cursor** | I-beam on text, default arrow on chrome, `grab`/`grabbing` **only** on the drag handle. No cross/crosshair anywhere. |
| 2 | **Colors** | **One-line fix.** `BlockRenderer.tsx:1474` reads `style={{ ...(block.bgColor ? colorStyle : {}) }}` — the style object holding *both* text and background color is applied only when a background color exists, so text color alone does nothing. Other block variants (984, 1080, 1367) already apply `colorStyle` unconditionally. |
| 3 | **Enter scheme** | `Enter` → soft line break in text; new row in a list. `Shift+Enter` → new block. `Ctrl+Enter` → in a list, exit to a plain block; in text, regular break. |
| 4 | **New-block shortcut** | Answers "which shortcut creates a new block under the current one?" — `Shift+Enter`, per above. |
| 5 | **Bottom-click** | Clicking the empty area below the last block creates a block **and focuses it immediately**, so typing just works. |
| 6 | **Popups** | Menus near the bottom of the viewport must flip upward instead of opening below the visible area. |
| 7 | **Selection toolbar** | Appears on any text selection. Exactly six items: **Bold, Italic, Strikethrough, Code, Link, Text color/Highlight.** No font sizes, no alignment, no block-type switcher — `/` and Markdown shortcuts cover that. Component already exists (`SelectionToolbar.tsx`); do not rebuild. |
| 8 | **Delete columns** | Cut the `columns` block type entirely. Columns force a structural decision while writing, are the least-used and fiddliest block, and are unusable on a 13" screen in split view. Media grids cover the one case that benefits. **Migration:** scan existing notes for `columns` blocks and flatten to stacked blocks first — nothing may vanish. |
| 9 | **Unified media block** | Replaces separate image/video blocks. Drop or paste any image, GIF, video, or URL. Splittable into 2 / 3 / 4 side by side in one row. Minimal. **No scale bar in the top-right corner.** |

### Sizing note

Item 9 (unified media block) is a **new block type, not a tweak** — the largest item in Phase 2 by a wide margin. If Phase 2 runs long, media is the natural split into its own phase.

## Verifying the editing-host constraint

The §1.1 table is a **measurement**, not a belief. Playwright is already a dependency; to re-check, render two sibling `contenteditable="true"` divs and one `contenteditable="true"` wrapper containing two plain divs, drag-select from the first block into the second in each, and read back `window.getSelection()`'s `anchorNode`/`focusNode`. Model A keeps both in block 1; Model B spans them.

Do not re-derive this from memory. It is the single fact the entire design rests on, and the previous attempt's fatal error was asserting the opposite without checking.

## What already exists — do not rebuild

The previous attempt proposed building features that were already present, a symptom of never having read the code:

- **Undo/redo stack** — `NoteEditor.tsx:519–688` (`history`, `historyIndex`, `undo`, `redo`).
- **Selection toolbar** — `SelectionToolbar.tsx`, 323 lines, `execCommand`-based, with `selectionchange` wiring.

## Working agreement

- **Questions get answered before action.** Changes are decided together.
- **Verify by driving the app.** `tsc --noEmit` passing is not evidence a behavior works.
- **Follow proven apps** (Obsidian, Notion, Apple Notes). Do not invent unproven mechanisms.
- **Phase 1 alone, then test, then Phase 2.**
