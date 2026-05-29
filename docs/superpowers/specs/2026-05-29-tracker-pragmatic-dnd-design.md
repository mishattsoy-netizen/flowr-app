# Tracker Kanban — Migrate drag-and-drop to pragmatic-drag-and-drop

**Date:** 2026-05-29
**Status:** Approved design

## Problem

The tracker kanban (To do / In progress / Today / Overdue / Done) uses `@dnd-kit`.
Across many iterations it has cycled between two unsolvable states:

- **Live array reorder during drag** → "Maximum update depth exceeded" infinite
  loop (`onDragOver` → `setState` → dnd-kit re-measures collisions against the new
  DOM → fires `onDragOver` again → repeat).
- **Reorder from a fixed snapshot** → no loop, but the placeholder mismatches the
  cursor.

These are mutually exclusive under dnd-kit's collision-on-render architecture.
Additional symptoms hit along the way: variable-height cards stretch/shrink
(`rectSortingStrategy` assumes uniform height), drops into empty columns fail
(custom collision never returned a column), and the drag overlay flickered.

## Decision

Replace `@dnd-kit` **only in the 3 tracker files** with
`@atlaskit/pragmatic-drag-and-drop`. The other 6 dnd-kit usages (Sidebar tree,
admin router grid, NoteEditor, TableBlock, TreeItem, BlockRenderer) are
independent, working, and stay on dnd-kit. The two libraries coexist.

### Why this fixes the whole bug class

pragmatic-dnd is event-based, not React-state-driven. Drop-target detection is
native pointer hit-testing performed on **pointer movement**, not in response to
our `setState`. There is no "re-measure collisions on every render" step, so the
`setState → recompute → setState` loop is structurally impossible. Variable
heights are a non-issue because nothing computes transforms from cached uniform
rects.

## Requirements (firm)

1. **Live gap + placeholder.** As you drag, cards part and a **card-sized bone-3
   box** opens at the drop position. Not an edge line — a full placeholder box.
2. Placeholder height = the dragged card's measured height (captured at drag
   start), so it matches small and tall cards alike.
3. The dragged card does not appear twice: its source slot is hidden/zero-height
   while a floating drag preview follows the cursor.
4. Drops into **empty** columns (In progress, Today) work.
5. No infinite loop under long/fast drags.
6. No card stretching/shrinking.

## Behavior contract to preserve (must match current `handleDragEnd`)

- Cross-column drop applies property updates by destination column:
  - `todo` → `{ status:'todo', dueDate:undefined, completed:false }`
  - `inProgress` → `{ status:'in-progress', completed:false }`
  - `today` → `{ status:'todo', dueDate:today, completed:false }`
  - `overdue` → `{ status:'todo', dueDate:yesterday, completed:false }`
  - `completed` → `{ completed:true }`
- `completedAt` = now when newly completed, preserved if already completed,
  `undefined` when un-completed.
- Single store transaction `useStore.setState({ tasks })`, then
  `useStore.getState().updateTask(id, updates)` for DB sync **only if the column
  changed**.
- Multi-workspace: tasks from other workspaces are kept in place when flattening.
- Filtered view (`trackerFilterWorkspace`) respected.

## Architecture

### Dependencies
- `@atlaskit/pragmatic-drag-and-drop@1.8.1`
- (drag preview helpers from the same package; no separate drop-indicator package
  needed since we render our own bone-3 placeholder)

### Shared state (TrackerPage)
```ts
type DragState = {
  taskId: string;          // the card being dragged
  height: number;          // measured source card height (px) for the placeholder
  overColumnId: string | null;
  overIndex: number | null; // insertion index within overColumnId
} | null;
```
Updated only when the hovered target/index changes (pragmatic fires on target
change, not per frame).

### TaskCard
- `useEffect` registers the element as `draggable({ getInitialData })` with data
  `{ type:'task', taskId, columnId }`.
- Provides a **custom drag preview** (`setCustomNativeDragPreview` /
  `onGenerateDragPreview`) so a card-shaped preview follows the cursor.
- `onDragStart` sets local `isDragging`; `onDrop` clears it.
- Also a `dropTargetForElements` so hovering a card yields a target + edge
  (top/bottom via `attachClosestEdge`) → drives `overIndex`.
- When `isDragging`, the source renders zero-height/hidden so no duplicate.

### KanbanColumn
- `useEffect` registers the column body as `dropTargetForElements` with data
  `{ type:'column', columnId }` → empty columns are valid targets.
- Renders its tasks; when `dragState.overColumnId === id`, inserts a bone-3
  placeholder `<div style={{height}}>` at `dragState.overIndex`. Cards below
  reflow naturally (normal layout, no transforms).

### TrackerPage
- `monitorForElements({ canMonitor, onDrag, onDropTargetChange, onDrop })`:
  - `onDragStart`: capture `taskId` + measured height → `dragState`.
  - `onDropTargetChange`/`onDrag`: resolve `overColumnId` + `overIndex` from the
    innermost target (card edge → index, or column → end) → update `dragState`.
  - `onDrop`: compute final order via existing `dragLogic` helpers, apply the
    full store update + side-effects above, clear `dragState`.
- No `DndContext`, no collision strategy, no per-frame optimistic reorder.

### Reused as-is
`src/components/tracker/dragLogic.ts` (`findContainer`, `dragEndReorder`,
`ColumnItems`) and its 8 vitest cases — library-agnostic array math. The drop
handler computes the destination index from pragmatic's target+edge, then uses
these to produce the final flattened task list.

## Index computation (card edge → insertion index)

When the innermost drop target is a card, `attachClosestEdge` reports `top` or
`bottom`. Insertion index = the hovered card's index, +1 if edge is `bottom`,
adjusted down by 1 when moving within the same column from above the target.
When the target is the column itself (empty area), index = column length (append).

## Error / edge handling

- Drop with no valid target → no-op, clear `dragState`.
- Drop onto the same slot → no-op (no store write).
- `canMonitor`/`canDrop` restricts to `type:'task'` sources so unrelated drags
  (sidebar, editor) never interact with the board.

## Testing

- Keep the 8 `dragLogic.test.ts` cases (pure logic) green.
- Add unit tests for the new index-from-edge helper (`edgeToIndex(...)`):
  same-column up, same-column down, cross-column into middle, into empty column,
  drop-on-self no-op.
- Manual verification (the recurring failure modes): long drag (no loop), tall
  card drag (no stretch), drop into empty In progress/Today, placeholder height
  matches dragged card, gap tracks cursor.

## Out of scope (flagged, not changed)

- Done column manual order does not persist — `buildColumns` re-sorts `completed`
  by `completedAt`. Pre-existing behavior; left as-is.
- The other 6 dnd-kit files are untouched.
