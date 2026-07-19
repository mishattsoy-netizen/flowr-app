# Nested Lists in Notes + Bot Markdown Bridge — Design

**Date:** 2026-05-13
**Status:** Approved, pending implementation plan

## Goal

Bring Notion-style nested list behavior to the note editor and make the bot able to produce/consume the same formatting — both via direct tool calls and via plain copy/paste from chat to a note.

## Behavior Requirements

1. **Depth via Tab** — Tab increases the nesting level of a list/checklist item; Shift+Tab decreases it. Already implemented; visual depth treatment is the new piece.
2. **Style rotation by depth** — Marker style depends on the block's depth in the tree, cycling every 3 levels:

   | depth % 3 | bulletList | dashedList | numberedList |
   |---|---|---|---|
   | 0 | • solid dot | — em-dash | `1.` arabic |
   | 1 | ○ open circle | – en-dash | `a.` lowercase alpha |
   | 2 | ■ filled square | · middle-dot | `i.` lowercase roman |

3. **Smart numbering** — Each nesting level has an independent counter scoped to consecutive same-type siblings. Returning to a parent level continues that level's existing sequence.
4. **Group movement** — Indenting a parent moves all its children with it. Already works because children are nested in the data model.
5. **Breaking out** — Shift+Tab unindents one level. Enter on an empty list item unindents (or converts to text at top level). Already works for the top-level case; needs no extra logic for nested unindent because Shift+Tab already lifts to the parent level.
6. **Enter inside a parent with children** — New: when Enter is pressed on a non-empty list or checklist block (`bulletList`, `dashedList`, `numberedList`, `checklist`) that has children, insert the new block as the **first child** so the new item appears immediately under its parent, not after the children block.

## Non-Goals

- Full CommonMark parsing (tables, footnotes, HTML passthrough beyond inline subset).
- Drag-and-drop changes — existing dnd-kit logic stays as-is.
- Visual depth-guide vertical lines (the lines Notion draws on hover).
- Migration of existing notes — they render unchanged at depth 0.

## Architecture

### Data model

`EditorBlock.children?: EditorBlock[]` already exists and is the single source of truth for nesting. **No schema change.** Depth is computed at render time, never stored.

### Rendering — depth-derived markers

**File: `src/components/editor/NoteEditor.tsx`**

`renderBlocksRecursive(list, depth)` already receives `depth`. It must:
- Pass `depth` to `BlockRenderer` as a new prop.
- Provide each list block with its sibling index *within its parent's children array*, scoped to the consecutive same-type streak. Compute this in the parent (a `getListCounter(list, blockId, depth)` helper that resets on type breaks).

**File: `src/components/editor/BlockRenderer.tsx`**

- Add `depth: number` to props.
- Rewrite `listMarker()` to switch on `depth % 3` and `block.type`:
  - `bulletList`: depth 0 → solid 5.5px dot; 1 → 5.5px ring (border-only); 2 → 5.5px filled square.
  - `dashedList`: depth 0 → 8px em-dash bar; 1 → 6px en-dash bar; 2 → 2.5px middle-dot.
  - `numberedList`: depth 0 → arabic; 1 → lowercase alpha (`a, b, ..., z, aa, ab, ...`); 2 → lowercase roman (`i, ii, iii, iv, v, ...`).
- Provide pure utility `formatCounter(n: number, style: 'arabic' | 'alpha' | 'roman'): string` colocated with `BlockRenderer` or in a new `src/components/editor/listMarkers.ts` if it grows.

**Counter scoping rule** — `getListCounter` walks the sibling array at the relevant depth. The counter increments only for consecutive blocks of the same type (`numberedList`). A non-numbered-list sibling resets it. Each `children` array has its own counter independent from parents and siblings.

### Keyboard fix — Enter into children

**File: `src/components/editor/BlockRenderer.tsx`, `handleKeyDown`**

Current Enter behavior (line ~105): on a non-empty list block, insert a new sibling of the same type *after* the current block. When the current block has `children`, this places the new block below all children — surprising.

New rule: if `block.children?.length > 0` and the block is a list type and non-empty, `onInsertAfter` should be called in *inside* mode (existing parameter, already supported in `insertAfter` at NoteEditor.tsx:680). This inserts at the start of `children`.

**Bug fix as part of this work:** `BlockRenderer.tsx:214` uses `isList`/`isChecklist` before they're declared at line 249. Hoist the `isList`/`isChecklist` declarations above `handleKeyDown` (or compute them inside the handler).

### Markdown ⇄ Blocks bridge

**New file: `src/lib/editor/markdownBlocks.ts`**

Two pure functions:

```ts
export function parseMarkdownToBlocks(md: string): EditorBlock[]
export function blocksToMarkdown(blocks: EditorBlock[]): string
```

**Parser grammar (intentionally small):**

| Line pattern | Block |
|---|---|
| `# X` | `text` style `title` |
| `## X` | `text` style `heading` |
| `### X` | `text` style `subheading` |
| `- X` or `* X` | `bulletList` |
| `1. X` / `a. X` / `i. X` (any numeric/alpha/roman prefix + `.`) | `numberedList` |
| `[ ] X` / `[x] X` | `checklist` (checked when `[x]`) |
| `> X` | `quote` |
| ` ``` ` fenced block | `text` style `mono` |
| `---` on its own line | `divider` |
| Anything else (non-empty) | `text` style `body` |

**Indentation rule:** every 2 spaces, or every 1 tab, at the start of a line = one nesting level. The parser maintains a stack of `(block, depth)`. When a line's depth is greater than the previous, the new block becomes a child of the previous; equal = sibling; less = pop the stack until depths match.

**Inline conversion** — `content` is HTML in the editor model. The parser converts:
- `**x**` → `<strong>x</strong>`
- `*x*` / `_x_` → `<em>x</em>`
- `` `x` `` → `<code>x</code>`
- `[t](u)` → `<a href="u">t</a>`

Everything else is escaped (`& < >`).

**Serializer (`blocksToMarkdown`)** is the inverse, used for bot reference output and tests. Numbered-list markers in the serialized output always use `1.` regardless of depth — depth-derived style is a render-only concern.

### Paste interception

**File: `src/components/editor/NoteEditor.tsx`, `handlePaste`**

Before the existing plain-text fallback (line ~942):

1. Read `text/plain` from clipboard.
2. `looksLikeMarkdown(text: string): boolean` — returns true when ≥2 non-empty lines match one of: leading `-`/`*`/digits+`.`/`[ ]`/`[x]`/`#`/`>`, OR any of those with leading indentation. Heuristic must reject ordinary prose (e.g. a single sentence containing a hyphen).
3. If true: `parseMarkdownToBlocks(text)` → splice into `blocks` after the currently focused block (or replace it if it's empty), call `persistBlocks`.
4. If false: existing plain-text `execCommand('insertText', ...)` path runs unchanged.

The "Copy to Note" button in `ChatMessage` does not need a special path — selection + Ctrl+V now produces the same result. The existing copy button keeps copying plain text.

### Bot tool changes

**File: `src/lib/bot/tools/definitions.ts`**

`create_note` schema additions:
```
blocks?: array of { type, content?, style?, checked?, children? }
```
Same for `update_note`.

New tool `append_note_blocks`:
```
{ id: string, blocks: BlockInput[] }
```

`BlockInput` is a recursive JSON Schema that accepts the subset of `EditorBlock` fields the bot can meaningfully produce: `type`, `content`, `style`, `checked`, `children`. IDs are server-assigned.

**File: `src/lib/bot/tools/handlers.ts`**

- `create_note({ title, content, blocks, parentId })`:
  - If `blocks` is present: run `normalizeBlocks(blocks)` (assigns IDs, validates types, drops unknown fields, clamps tree depth to a sane max like 20 to prevent abuse).
  - Else if `content` is a string: run `parseMarkdownToBlocks(content)`.
  - Else: empty content.
- `update_note({ id, title, content, blocks })`: same logic for body. If neither `content` nor `blocks` is passed, only title updates.
- `append_note_blocks({ id, blocks })`: fetch entity, normalize blocks, append to existing `content` array, save with new `last_modified`.

`normalizeBlocks` and `parseMarkdownToBlocks` are both imported from `src/lib/editor/markdownBlocks.ts` (or a sibling file) — same code path the client uses, so output is identical.

**File: `bot prompts(premission to edit needed!)/mode-default.txt` and `mode-pro.txt`**

Append a short paragraph:

> When writing notes via tools, prefer the `blocks` parameter (structured nested blocks) for any content with lists, headings, or checklists. When answering in chat, format lists as Markdown — indent each nested level by 2 spaces. The user can paste your reply directly into a note and it will render with full nesting.

## Components & Files Changed

| File | Change |
|---|---|
| `src/components/editor/NoteEditor.tsx` | Pass `depth` to BlockRenderer; new `getListCounter`; markdown paste path in `handlePaste`; Enter-into-children routing through `insertAfter(..., inside=true)` |
| `src/components/editor/BlockRenderer.tsx` | Depth-aware `listMarker()`; hoist `isList`/`isChecklist` declarations; route Enter to inside-mode when block has children |
| `src/components/editor/listMarkers.ts` (new, optional) | `formatCounter` helpers (arabic/alpha/roman) if BlockRenderer grows too large |
| `src/lib/editor/markdownBlocks.ts` (new) | `parseMarkdownToBlocks`, `blocksToMarkdown`, `normalizeBlocks`, `looksLikeMarkdown` |
| `src/lib/bot/tools/definitions.ts` | `blocks` param on create/update_note; new `append_note_blocks` |
| `src/lib/bot/tools/handlers.ts` | Honor `blocks` param; fallback to markdown parsing on plain `content`; new handler |
| `bot prompts(premission to edit needed!)/mode-default.txt` | Bot-side formatting guidance |
| `bot prompts(premission to edit needed!)/mode-pro.txt` | Same |

## Data Flow

**User types in note:**
NoteEditor → `indentBlock`/`unindentBlock` mutates tree → `renderBlocksRecursive(list, depth)` → BlockRenderer receives `depth` → `listMarker()` picks style by `depth % 3` → `getListCounter` produces label for numbered lists.

**User pastes markdown from chat:**
NoteEditor `handlePaste` → `looksLikeMarkdown(text)` → `parseMarkdownToBlocks(text)` → splice into `blocks` → `persistBlocks`.

**Bot writes via tool:**
Bot calls `update_note({ id, blocks: [...] })` → handler runs `normalizeBlocks` → stores in Supabase `entities.content` → on next client read, NoteEditor renders identically.

**Bot writes via markdown string fallback:**
Bot calls `update_note({ id, content: "- a\n  - b" })` → handler runs `parseMarkdownToBlocks(content)` → same storage path.

## Error Handling

- **Parser**: malformed indentation is forgiven (round down to nearest valid level). Empty input returns `[]`. Inline parsing failures fall back to escaped plain text.
- **Bot handlers**: `normalizeBlocks` rejects (returns error) on cycle, on depth > 20, on unknown `type`, or on missing required fields. Caller gets a structured error.
- **Paste heuristic false positives**: if `parseMarkdownToBlocks` returns a single `text` block matching the original input, the paste path effectively no-ops — same end state as the plain-text fallback would produce.
- **Existing notes**: depth-derived rendering uses `depth=0` for top-level blocks, so flat notes look unchanged.

## Testing

Unit tests for `src/lib/editor/markdownBlocks.ts`:
- `parseMarkdownToBlocks` round-trips through `blocksToMarkdown` for a representative sample.
- Mixed indentation (tabs and spaces) parses correctly.
- Inline formatting converts to the HTML the editor expects.
- `looksLikeMarkdown` returns false on a paragraph of prose with a single hyphen.

Manual UI checks:
- Tab/Shift+Tab through 5 levels deep on each list type; markers cycle correctly.
- Numbered list with mixed nesting: outer continues `1, 2, 3` after a nested `a, b, c` group.
- Enter on a parent with children inserts at top of children.
- Paste a 3-level nested markdown list into an empty note — produces correct nested blocks.
- Bot tool: `update_note` with `blocks` round-trips; `update_note` with markdown `content` parses correctly.

## Open Questions

None at design time. Implementation plan can proceed.
