# Split View v3: Paired Columns

**Date:** 2026-07-04
**Status:** Design approved, awaiting implementation plan

## Overview

Replace the current tab-per-column split view with a simpler paired-column model. Each column shows exactly one entity. Entities can be temporarily split side-by-side, or permanently paired (bidirectional pin) so opening either always opens both in split view.

## Motivation

- Current v2 implementation (tab-per-column) is confusing: both column headers show all `openTabIds`, tab assignment across columns is ambiguous, and the global HeaderBar stays visible
- User's primary workflow: work on a text note while visualizing it in a canvas, or create diagrams in parallel
- Old `type: 'mixed'` entity approach was removed — this replaces it with a cleaner model

## Core Model

### Entity field

```ts
// Added to Entity type in store.types.ts
pairedEntityId: string | null;
```

### Store state (replaces current split view state)

```
// Remove: isSplitView, splitViewLeftId, splitViewRightId (keep splitViewPosition) // Add: pairedEntityId on Entity type splitViewActive: boolean // is split view currently showing? splitViewLeftId: string | null // always set when split splitViewRightId: string | null // null = empty placeholder splitViewPinned: boolean // derived from pairedEntityId match
```

### Pin logic

- Pinning is **bidirectional**: when Note A is pinned to Canvas B, both store each other's ID in `pairedEntityId`
- Opening either entity later auto-opens the paired entity in split view
- Unpinning clears `pairedEntityId` on both
- Pin button is a toggle: click to pin current pair, click again to unpin

## Header Bar

### Single view (not split)

- Columns2 button always visible on the right side of the header when 1+ tabs are open
- 28x28px square button, rounded-10px
- Click → enters split view

### Split view (global HeaderBar hidden)

- SplitViewLayout replaces the entire HeaderBar + main content area
- Right side of SplitViewLayout (or right column's header): Columns2 button (exit split) + Pin button
- Pin button shows filled icon when `splitViewPinned` is true, outlined when false

## Column Headers

Each column has a simplified header (not a full tab strip):

- Entity icon + title (same styling as current tab labels)
- X close button on the right
- No tab strip — each column shows exactly one entity
- Closing a column's entity: removes from `openTabIds`; if it was the only open tab, exits split view

## Empty Column Placeholder

When a column has no entity assigned (`splitViewRightId === null`):

1. **Logo** — centered near the top
2. **Quick action buttons** — "New Note" and "New Canvas" (creates entity in unsorted, opens in this column)
3. **Search bar** — type to filter entities, click to open in this column
4. **Instruction text** — "Drag and drop any entity from the sidebar to open it here"
5. **Recent entities** — 3 rows of recently opened entities, clickable to open in this column

## Interactions

### Entering split view

1. User clicks Columns2 in HeaderBar (1+ tabs required)
2. Left column: current `activeEntityId`
3. Right column:
   - If `activeEntityId` has a `pairedEntityId`, open that → `splitViewPinned = true`
   - Otherwise → empty placeholder → `splitViewPinned = false`

### Dropping entities from sidebar

- While split is active, dragging any entity from the sidebar onto a column replaces that column's entity
- If the replaced entity was part of a pinned pair, the pin breaks (both `pairedEntityId` cleared), pin button goes to unpinned state
- User can click pin again to lock the new pair

### Clicking entities in placeholder

- Recent entities or search results: click → opens in that column
- "New Note" / "New Canvas": creates entity → opens in that column

### Exiting split view

- Click Columns2 in the header → exits split, returns to single view
- Close the last tab in either column → exits split
- The entity that was in the left column becomes the active entity in single view

### Auto-split on open

- If user opens an entity that has a `pairedEntityId`, auto-enter split view with both entities
- User can still close split normally

## Files

| File | Action | Notes |
|---|---|---|
| `src/data/store.types.ts` | Edit | Remove old split fields, add `pairedEntityId`, new split fields |
| `src/data/store.ts` | Edit | Remove old actions, add pin/pair logic, new split actions |
| `src/components/layout/Shell.tsx` | Edit | Simplify split view conditional |
| `src/components/layout/SplitViewLayout.tsx` | Rewrite | Two columns with simple headers, divider with pin button |
| `src/components/layout/ColumnHeader.tsx` | Rewrite | Simplified: icon + title + close, no tab strip |
| `src/components/layout/ColumnPlaceholder.tsx` | New | Empty column state with logo, actions, search, recents |
| `src/components/layout/HeaderBar.tsx` | Edit | Columns2 button right-side positioning (already done), remove isSplitView styling |
| `src/components/layout/Sidebar.tsx` | Edit | Enable drag-from-sidebar to drop zones in SplitViewLayout columns |

## Migration

- Existing `isSplitView` / `splitViewLeftId` / `splitViewRightId` in persisted state → ignored on next save (new fields replace them)
- Entities gain `pairedEntityId: null` by default
- No data loss — old split state just resets to non-split

## Verification

1. `npx tsc --noEmit` passes
2. Open 2+ tabs → Columns2 button visible on right
3. Click Columns2 → left shows active tab, right shows placeholder
4. Pick entity from placeholder → opens in right column
5. Click pin → both entities paired
6. Close split → single view
7. Reopen either paired entity → auto-splits with partner
8. Drag entity from sidebar onto a column → replaces current entity
9. Unpin → pair broken, stays split
10. Close column → exits split if last tab
