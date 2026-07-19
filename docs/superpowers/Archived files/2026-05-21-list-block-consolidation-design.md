# List Block Consolidation (Model B) — Design

**Date:** 2026-05-21
**Status:** Approved (model choice confirmed), pending implementation plan

## Problem

The note editor has **two incompatible models for lists** layered on top of each other:

- **Model A — one block per item.** The markdown parsers (`src/lib/editor/markdownBlocks.ts`, `src/lib/utils/markdownToBlocks.ts`) and the AI structured-block path (`normalizeBlocks`) emit each list line as a **separate sibling `EditorBlock`**. Numbering for these comes from `getListCounter` in `NoteEditor.tsx`, which counts consecutive sibling blocks. This was the originally-approved design (`2026-05-13-nested-lists-notes-design.md`).
- **Model B — one block per whole list.** `src/components/editor/ListBlock.tsx` (shipped later, diverging from the 2026-05-13 spec) treats a single block plus its `children` as an **entire list**, flattening it into rows with internal depth, computing its own continuous counter, and handling Enter/Tab internally.

These fight at the Enter and render boundaries, producing two visible bugs:

1. **Broken numbering.** A list authored by AI/paste arrives as N sibling `numberedList` blocks (numbered 1..N by `getListCounter`). Pressing **Enter** on the last item runs ListBlock's Model-B handler, which appends a **child row** to that block. The child's number is computed by ListBlock's *internal* counter, which only sees that one block's rows — so it shows `2` instead of `N+1`.
2. **Nesting doesn't work.** A nested list item stored as a Model-A child block is skipped by `renderBlocksRecursive` (the `isListBlock` guard) and mishandled by ListBlock (which flattens children but forces them to the parent's type/depth). The two models never compose.

## Decision

**Consolidate on Model B: one `EditorBlock` holds an entire list.** ListBlock already implements Model B's nesting and continuous, depth-scoped counting correctly. The fix is to make the *rest of the pipeline* agree with that invariant and remove the leftover Model-A plumbing.

## Invariant

A maximal run of consecutive list lines/blocks of the **same list type** (`bulletList`, `dashedList`, `numberedList`, `checklist`) becomes **one** `EditorBlock`:
- The first item is `block.content`.
- Items 2..n become `block.children`, nested by indentation (Model B's `flattenRows`/`nestRows` shape).
- A change in list type, or any non-list block, ends the run and starts a new block.

This is exactly the shape ListBlock persists on every edit (`nestRows` → `{ content, checked, children }`), so the editor and parsers converge on one representation.

## Changes

### 1. Shared coalescer — `src/lib/editor/markdownBlocks.ts`

New exported pure function:

```ts
export function coalesceListBlocks(blocks: EditorBlock[]): EditorBlock[]
```

- Walk the array. When a run of ≥1 consecutive blocks shares the same list `type`, merge them: keep the first as the head; for each subsequent sibling, append it (and recursively its own children) to the head's `children` at the correct relative depth.
- Indentation/nesting that the parser already expressed as `children` on individual items must be preserved: a parser-produced child stays a child; a flat sibling becomes a depth-0 child of the head.
- Recurse into the `children` of every non-list block (e.g. columns) so nested lists coalesce too.
- Idempotent: running it on an already-coalesced tree returns an equivalent tree.

Apply `coalesceListBlocks` at the end of:
- `parseMarkdownToBlocks` (markdownBlocks.ts) — paste + AI markdown.
- `normalizeBlocks` (markdownBlocks.ts) — AI structured blocks.

### 2. Second parser — `src/lib/utils/markdownToBlocks.ts`

Import and apply `coalesceListBlocks` to the return value of its `parseMarkdownToBlocks`. (This parser is used by `ChatMessage` "copy to note" and is a separate implementation with its own inline-HTML; we only post-process its output, not merge the two parsers.)

### 3. Remove Model-A plumbing — `src/components/editor/NoteEditor.tsx`

- Delete `getListCounter` and stop passing `listNumber` to `BlockRenderer` for list blocks (ListBlock computes its own continuous counter). Keep `listNumber` prop optional/undefined; ListBlock already falls back to its internal count when `listNumber == null`.
- Keep the `isListBlock` guard in `renderBlocksRecursive` (line ~1121) — list children are owned by ListBlock and must NOT be rendered by the recursive renderer.
- `indentBlock`/`unindentBlock` remain for non-list blocks; list Tab/Shift+Tab is handled inside ListBlock.

### 4. Rendering — `src/components/editor/BlockRenderer.tsx`

No structural change needed: list/checklist blocks already route through ListBlock. The `listNumber` prop becomes effectively unused for the common case; leave the prop in place (harmless) or drop it. Marker styling by depth already lives in ListBlock.

## Non-Goals

- No `EditorBlock` schema change — `children` is already the nesting model.
- No drag-and-drop changes.
- No migration script. Existing notes stored as Model-A siblings render through the new path: on first parse/edit they coalesce; already-persisted sibling blocks will be coalesced lazily — see Migration below.

## Migration of existing stored notes

Existing notes already saved with flat sibling list blocks need to render correctly **before** any edit. Two options:

- **(Chosen) Coalesce on load** in `NoteEditor`'s initial-content path and entity-switch path: run `coalesceListBlocks(entity.content)` when seeding `blocks` state. This is render-only until the user edits; the coalesced shape is persisted on the next `persistBlocks`. Cheap, no DB migration, no data loss.

## Error Handling

- `coalesceListBlocks` on empty input returns `[]`.
- Non-list blocks pass through untouched.
- Depth is bounded by existing `normalizeBlocks` depth clamp (≤20).
- Mixed types in a run correctly split into separate blocks (no accidental merge of a bullet into a numbered list).

## Testing

Update `src/lib/editor/markdownBlocks.test.ts` (current tests assert Model A and must change):

- `parseMarkdownToBlocks('1. first\n2. second')` → **one** `numberedList` block with `content: 'first'` and one child `content: 'second'`.
- `parseMarkdownToBlocks('- a\n- b\n- c')` → one `bulletList` block with two children.
- Mixed run: `- a\n1. b` → a `bulletList` block followed by a separate `numberedList` block.
- Nested: `1. a\n  1. a1\n2. b` → one numbered block, child `a1` under `a`, sibling `b` continues at top level.
- `coalesceListBlocks` is idempotent.
- `normalizeBlocks` coalesces a flat array of `numberedList` items into one block.

Manual UI checks:
- AI-generate a numbered list, press Enter at the end → next item is `N+1`, not `2`.
- Tab to nest mid-list → continuous parent numbering resumes after the nested group.
- Paste a 3-level markdown list into an empty note → correct nesting.
- Open a pre-existing note with flat numbered items → renders 1..N continuously.

## Files Changed

| File | Change |
|---|---|
| `src/lib/editor/markdownBlocks.ts` | New `coalesceListBlocks`; apply in `parseMarkdownToBlocks` and `normalizeBlocks` |
| `src/lib/utils/markdownToBlocks.ts` | Apply `coalesceListBlocks` to output |
| `src/components/editor/NoteEditor.tsx` | Remove `getListCounter`/`listNumber`; coalesce on initial load + entity switch |
| `src/components/editor/BlockRenderer.tsx` | Drop now-unused `listNumber` wiring (optional) |
| `src/lib/editor/markdownBlocks.test.ts` | Update assertions to Model B; add coalescing/nesting/idempotency tests |
