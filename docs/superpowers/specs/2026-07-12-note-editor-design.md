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

This single conditional causes the whole cluster of reported problems:

- **Text selection is trapped per block / per list row.** Dragging from outside a block, or from block A into block B, has no editable node to extend the selection into. The browser is not "preventing selection across contenteditable elements" — that claim is false. The blocks simply aren't editable at drag time.
- **Focus is lost when Enter creates a new row.** The new block is not editable at the moment it is created, so focus has nowhere to land.
- **Clicking the empty bottom area does not reliably start typing.** Same cause.

**Non-goal: migration.** A previous attempt migrated to TipTap/ProseMirror on the false premise that the browser cannot select across contenteditable blocks. It destroyed the editor and was reverted. This design fixes the editor in place. TipTap deps remain in `package.json` and should be removed as cleanup.

## Phase 1 — Feels like plain text

Shipped **alone** and tested before anything else is stacked on top. This is the risky change; everything in Phase 2 is independent of it.

### 1.1 Always-editable blocks

All blocks are `contentEditable` at all times (when not read-only). This alone restores native, character-level, cross-block text selection. This is what Notion does.

### 1.2 Intercept destructive cross-block operations

Block content is stored as **HTML** (`innerHTML`, BlockRenderer.tsx:344) and written back to the store on every `onInput`. Once selection can span blocks, an uncontrolled edit would let the browser rewrite several blocks' DOM at once while only one block fires `onInput` — silently losing text.

Therefore: when a selection spans more than one block, **we intercept** typing, Backspace, Delete, Cut, and Paste and apply them as a controlled store operation, then re-render. Selection itself stays fully native. The intercept is invisible in normal use.

### 1.3 The merge rule (first block wins)

When a multi-block selection is deleted or typed over:

1. The surviving text is the **unselected head of the first block** joined with the **unselected tail of the last block**, forming one block.
2. That block **keeps the first block's type and formatting.** Fully-selected blocks in between are deleted outright.
3. The **cursor lands at the seam** between the surviving head and tail.

"First" means first in **document order**, so the result is identical whether the user dragged top-to-bottom or bottom-to-top.

This is Word, Google Docs, Notion, and Obsidian behavior. It is also what a plain text file does when deleting a selection spanning several lines: the surviving head and tail join into one line. The only addition is "the block keeps its type," which is the minimum required for blocks to exist at all.

#### Worked example (the acceptance test)

Given H1 / paragraph / H2, select from mid-H1, through the entire paragraph, to mid-H2, and type `X`:

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

Verified by **driving the running app**, not by typecheck. A passing `tsc --noEmit` is not evidence that Enter puts the cursor in the right place.

- [ ] Drag-select a passage spanning four blocks → continuous native highlight, touched blocks tinted.
- [ ] The worked example above produces exactly the stated result.
- [ ] Backspace over a multi-block selection → same merge, no text loss.
- [ ] Cut and Paste over a multi-block selection → same merge; clipboard correct.
- [ ] Select-all + type → one empty block of the first block's type.
- [ ] `Ctrl+Z` restores the pre-merge state in one step.
- [ ] Focus is never lost during any of the above.

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

## What already exists — do not rebuild

The previous attempt proposed building features that were already present, a symptom of never having read the code:

- **Undo/redo stack** — `NoteEditor.tsx:519–688` (`history`, `historyIndex`, `undo`, `redo`).
- **Selection toolbar** — `SelectionToolbar.tsx`, 323 lines, `execCommand`-based, with `selectionchange` wiring.

## Working agreement

- **Questions get answered before action.** Changes are decided together.
- **Verify by driving the app.** `tsc --noEmit` passing is not evidence a behavior works.
- **Follow proven apps** (Obsidian, Notion, Apple Notes). Do not invent unproven mechanisms.
- **Phase 1 alone, then test, then Phase 2.**
