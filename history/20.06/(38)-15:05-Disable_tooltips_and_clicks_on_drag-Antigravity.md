User request: "when i drag block in notes, dont trigger tooltips and otther button clicks, and if any popups are open, close them on block drag"

## 0. Date and time of the request
Date: 20.06.2026
Time: 15:05

## 1. User request
User request: "when i drag block in notes, dont trigger tooltips and otther button clicks, and if any popups are open, close them on block drag"

## 2. Objective Reconstruction
The goal is to improve the user experience when dragging blocks in the note editor. Specifically:
1. Prevent tooltip components from appearing when hovering over drag handles or add buttons while a drag operation is active.
2. Ignore click events on interactive controls (such as checklist row checkboxes, folding chevrons, content buttons/links) during dragging.
3. Automatically close/dismiss any open popovers, dropdowns, and popup tools (like the block options menu, slash command menu, selection toolbar, and inline link edit popovers) as soon as dragging starts.

## 3. Strategic Reasoning
- ATLAs kit Pragmatic drag-and-drop handles block dragging by default, but hover events for tooltips can still be triggered by standard mouse movement over surrounding elements.
- The `isDragging` state tracked in `NoteEditor.tsx` can act as a global indicator. By propagating this state down to all recursive instances of `BlockRenderer` (as `isDraggingGlobal`), elements can reactively mute tooltips and clicks.
- Using `pointer-events-none` on block controls when `isDraggingGlobal` is true completely prevents all hover/active states, cursors, tooltips, and click events.
- Clearing the selection (`window.getSelection()?.removeAllRanges()`) during `onDragStart` hides the selection toolbar and exits active text edits cleanly.
- Adding a `useEffect` inside `BlockRenderer` listening to changes in `isDraggingGlobal` allows inline link edit popovers to dismiss themselves instantly.

## 4. Detailed Blueprint
- **NoteEditor.tsx**:
  - Close slash command menu and options menu on `onDragStart`.
  - Clear text range selection to close the text format popup tool.
  - Pass `isDraggingGlobal={isDragging}` to `<BlockRenderer>`.
- **BlockRenderer.tsx**:
  - Accept `isDraggingGlobal` in props (default false) and propagate it to columns/column sub-blocks.
  - Dismiss active inline button and popovers in a `useEffect` when `isDraggingGlobal` is true.
  - Ignore content clicks and folding chevrons clicks if `isDraggingGlobal` is true.
  - Pass `isDraggingGlobal` to `controlsProps` and `BlockControls` props.
  - Apply `pointer-events-none` and disable tooltips on `BlockControls` during drag.
- **ListBlock.tsx**:
  - Receive `isDraggingGlobal` and propagate it to checklist item rows.
  - Disable checklist clicking and apply `pointer-events-none` during dragging.

## 5. Operational Trace
- Modified [NoteEditor.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/editor/NoteEditor.tsx) to reset menus, clear ranges in `onDragStart`, and pass `isDraggingGlobal` to `BlockRenderer`.
- Modified [BlockRenderer.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/editor/BlockRenderer.tsx) to close popovers on drag, propagate state to children/sub-components, prevent click actions, disable Tooltips, and apply pointer-events-none to the controls.
- Modified [ListBlock.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/editor/ListBlock.tsx) to pass `isDraggingGlobal` down to `RowEl` and disable checkmark toggling.

## 6. Status Assessment
- Features are implemented cleanly.
- Changes compile successfully with the workspace component structure.
