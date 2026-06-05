# DnD Migration Plan: `@dnd-kit` → pragmatic-drag-and-drop

**Goal:** Eliminate drag stutter in the **notes editor** (block reordering) and the
**left sidebar** (page/folder tree) by migrating them off `@dnd-kit` onto
**pragmatic-drag-and-drop** — the same library the tracker already uses
smoothly.

**Status:** Planned. Not started. The tracker (Kanban) is already on
pragmatic-dnd and is the reference implementation.

---

## Why (root cause — confirmed empirically)

Profiling + React DevTools "highlight updates" proved that during a drag in
notes/sidebar, **every draggable item re-renders 90–480× per drag**:

- `@dnd-kit` propagates live drag state (`active`, `over`, `transform`) through
  **React context**. Every item calls `useSortable`, which subscribes to that
  context, so **a context update re-renders all items**.
- `React.memo` **cannot** stop this — memo doesn't block context-driven
  re-renders, and `useSortable` returns fresh `listeners`/`attributes` object
  identities each tick, which also busts any memoized child boundary.
- In notes this is catastrophic because each block's re-render rewrites a
  `contentEditable` via `innerHTML` (~70% of drag time was `set innerHTML` +
  `setProp` + `Parse HTML`).

Three in-place fixes were attempted and all failed for this structural reason:
1. `React.memo(BlockRenderer)` — crashed (and wouldn't have helped anyway).
2. `useMemo` on the rendered block node list — didn't reduce re-renders, broke drops.
3. `TreeItem` content/wrapper split with memoized child — still flashed x92
   (dnd-kit hands new `listeners` identities every tick).

**Why the tracker is immune:** it uses pragmatic-dnd, which keeps drag state in
**refs/DOM**, not React context. The actively-dragged element is moved via direct
DOM `transform` writes; idle items never re-render. That is the property we want.

---

## Reference: how the tracker already does it (pragmatic-dnd)

Files: `src/components/tracker/TaskCard.tsx`, `KanbanColumn.tsx`, `TrackerPage.tsx`.

Core primitives (from `@atlaskit/pragmatic-drag-and-drop`):

- **`draggable({ element, getInitialData, onGenerateDragPreview, onDrag, onDrop })`**
  — registers a DOM node as draggable. `onDrag` writes `transform` directly to a
  follower-preview node (no React render per move).
- **`dropTargetForElements({ element, canDrop, getData })`** — registers a drop
  zone; `getData` returns where a drop would land.
- **`monitorForElements({ onDragStart, onDrag, onDropTargetChange, onDrop })`** —
  a single board-level subscription that tracks the whole drag. State updates
  (the gap/placeholder) are **gated by a signature** so React only re-renders on
  an actual slot change, not per pointer move.
- **`disableNativeDragPreview`**, **`preventUnhandled`** — for a clean custom
  preview and to suppress the browser's snapback.

Key idea: **no per-item context.** Each item registers its own draggable/drop
target via `useEffect` (empty deps, reads latest props from a ref). The dragged
item's DOM moves via transform; idle items are never re-rendered.

---

## Scope (files touching `@dnd-kit`)

| File | Role | Migrate now? |
|---|---|---|
| `src/components/editor/NoteEditor.tsx` | block list `DndContext`+`SortableContext`, sensors, `onDragEnd` reorder | **Yes (Phase 2)** |
| `src/components/editor/BlockRenderer.tsx` | per-block `useSortable` (drag handle, transform) | **Yes (Phase 2)** |
| `src/components/editor/TableBlock.tsx` | nested row `DndContext`/`useSortable` | Yes (Phase 2b — nested) |
| `src/components/layout/Sidebar.tsx` | tree `DndContext`+`SortableContext`, `DragOverlay`, sensors, collision, `onDragEnd` move/reorder | **Yes (Phase 1)** |
| `src/components/layout/TreeItem.tsx` | per-row `useSortable` + `useDndContext` (drop highlight) | **Yes (Phase 1)** |
| `src/components/admin/SortableRouterGrid.tsx` | admin grid | Optional / later (low traffic) |

Recommended order: **Sidebar first** (Phase 1) — simpler items (no
contentEditable), and it validates the recursive-tree pattern. **Notes second**
(Phase 2) — higher payoff but the contentEditable + nested blocks make it the
riskiest.

---

## Phase 1 — Sidebar (`Sidebar.tsx` + `TreeItem.tsx`)

What dnd-kit currently provides here and the pragmatic-dnd replacement:

| dnd-kit | Replace with |
|---|---|
| `DndContext` + `onDragStart/Over/End` | one `monitorForElements` in `Sidebar` (in a `useEffect`) |
| `SortableContext` + `verticalListSortingStrategy` | nothing — ordering is computed from drop geometry, like the tracker |
| `useSortable` in `TreeItem` | `draggable({ element })` + `dropTargetForElements({ element })` per row, in `useEffect`s |
| `DragOverlay` + overlay-clone `TreeItem` | custom follower preview via `onGenerateDragPreview` + `disableNativeDragPreview` (see `TaskCard.tsx`) |
| `useDndContext().over` for drop highlight | local state set from `monitor.onDropTargetChange` (store the hovered row id + whether it's a "nest into folder" vs "insert between") |
| `arrayMove` + `reorderEntities` in `onDragEnd` | keep the **same** `handleDragEnd` business logic (move/reorder/unpin); only the *event source* changes. The drop data (`getData`) carries target id + edge. |

Notes / gotchas:
- **Drop semantics are richer than the tracker:** a sidebar drop can be
  *reorder among siblings*, *nest into a folder/collection/workspace*, *unpin*,
  or *move to unsorted/workspace root*. Preserve `handleDragEnd`'s branching;
  feed it the resolved target (id + drop kind) from pragmatic-dnd's drop data.
- **Drop highlight:** dnd-kit gave `isDropTarget` / `isFolderDropTarget` via
  context. Replace with a small piece of state in `Sidebar` (e.g.
  `{ overId, mode: 'between' | 'nest' }`) updated in `onDropTargetChange`, passed
  down to the hovered `TreeItem` only. Keep it gated by a signature so it doesn't
  thrash.
- **Recursion:** `TreeItem` renders its children. Each row independently
  registers its own draggable + drop target — no shared context needed.
- **Pinned section:** dragging a `pinned-` item out unpins it. Encode the
  source section in the draggable's `getInitialData` and resolve in the monitor.
- **Keyboard DnD:** dnd-kit had a `KeyboardSensor`. pragmatic-dnd needs a
  separate keyboard story; if keyboard reordering is required, scope it
  explicitly (the tracker uses a context-menu "Move to" + arrow moves instead —
  see `TrackerPage` `moveTasksToColumn`/`moveTaskByOne`. Consider mirroring that).

Acceptance (Phase 1):
- React DevTools highlight: dragging a row flashes **only** the dragged row (+
  the single hovered drop-target row), not all `TreeItem`s.
- All existing behaviors verified manually: click-to-open, rename
  (textarea/Enter/Esc/blur), `+`/`⋯` buttons, chevron collapse, icon picker,
  multi-select (shift-click), reorder, nest into folder, unpin, move to
  unsorted/workspace root.
- Drop **sticks** (regression from a prior attempt — verify explicitly).

## Phase 2 — Notes (`NoteEditor.tsx` + `BlockRenderer.tsx`)

Same primitive swap as Phase 1. Block-specific concerns:

- **contentEditable is the whole point:** with pragmatic-dnd, idle blocks won't
  re-render during a drag, so the `set innerHTML` effect won't re-fire — this is
  the entire perf win. Verify the dragged block's caret/selection isn't disturbed.
- **Custom preview:** disable native preview and render a follower (the dragged
  block already has rich content; a simplified preview like the tracker's card is
  fine). See `TaskCard.tsx` `onGenerateDragPreview`/`onDrag`.
- **Reorder logic:** keep `handleDragEnd`'s `setBlocks` splice + `persistBlocks`;
  feed it the resolved target index from drop geometry (mirror
  `TrackerPage.columnIndexFromPointer` / `positionForDrop`).
- **Multi-block drag:** if a multi-selection is dragged, move the whole group
  (tracker does this — see `TrackerPage.onDrop` group branch).
- **Nested/column blocks:** `BlockRenderer` recurses for `columns`/children and
  `TableBlock` has its own nested sortable (Phase 2b). Each draggable registers
  independently; nested drop targets resolve by the deepest matching element.

Acceptance (Phase 2):
- Highlight: dragging a block flashes only the dragged block (+ hovered target).
- Profiler: `set innerHTML` no longer dominates the drag.
- Manual: typing, caret position, slash menu, selection toolbar, fold/unfold,
  nested/column blocks, tables, drop sticks, multi-block drag, undo/redo.

---

## Risks

- **Behavioral parity is the hard part, not the primitives.** dnd-kit encodes a
  lot of drop semantics (nesting, unpin, section moves, collision). Port the
  *resolution* carefully; reuse the existing `handleDragEnd` bodies.
- **Manual verification only.** Unit tests won't catch caret jumps, focus loss,
  or drop-target edge cases. Budget hands-on testing per phase.
- **Do it on a branch, one surface at a time.** Land Phase 1 (sidebar) and
  verify in production-like use before starting Phase 2 (notes).
- Consider keeping `@dnd-kit` installed until `SortableRouterGrid` is migrated or
  intentionally left on it.

## Definition of done

- Sidebar and notes drags show only the dragged (+ hovered) item re-rendering.
- No `@dnd-kit` imports in `Sidebar.tsx`, `TreeItem.tsx`, `NoteEditor.tsx`,
  `BlockRenderer.tsx`, `TableBlock.tsx` (admin grid optional).
- All listed manual acceptance checks pass on each surface.

---

## Appendix: Safari tracker-drag stutter (investigated, engine-level)

The tracker (Kanban) drag is smooth-ish in Chrome after the memo + rAF fixes,
but **Safari still stutters**. Safari Timelines profiling of a card drag showed:

- **Composite** is the dominant, near-continuous activity (CPU spiking to ~88%).
- Not Paint-dominated, not Scripting-dominated.

Concrete, fixable causes were each tested and **ruled out**:

- **CSS transitions** (cards' `transition-colors`, gap's `transition-[height]`):
  disabled during drag via `.is-dragging [data-kanban-column] *`. No improvement.
- **Dragged preview box-shadow** re-rasterizing per frame: removed via console
  mid-drag. No improvement.
- **React re-renders**: already minimized (KanbanColumn memo + TaskCard memo);
  confirmed in Chrome via highlight test.

Conclusion: the residual Safari cost is **engine-level compositing of the
transform-animated dragged card subtree** — Safari re-composites the layer tree
each frame more aggressively than Chrome. No single scoped CSS/JS change fixed
it. Not pursued further (one-browser, diminishing returns). If revisited, the
only plausible levers are reducing the dragged preview's layer complexity
(simpler preview DOM, `contain: paint`, isolating it on its own layer) — but
these are speculative and were not validated.
