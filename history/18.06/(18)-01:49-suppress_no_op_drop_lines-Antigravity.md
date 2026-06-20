User request: "this insert line should apear because item i drag will be insertet in the same initail posiiotn."

### 0. Date and time of the request
2026-06-18 01:33

### 1. User request
User request: "this insert line should apear because item i drag will be insertet in the same initail posiiotn."

### 2. Objective Reconstruction
Prevent visual drop indicator lines from showing when dropping the item in that position would result in a no-op (i.e., dragging an item over itself, hovering over the bottom edge of its immediate previous sibling, or hovering over the top edge of its immediate next sibling).

### 3. Strategic Reasoning
When dropping an item at its own current index/position, or between itself and its immediate siblings, the action is a no-op that shouldn't display a drop target indicator line. To achieve this:
- Detect the dragged item ID (`source.data.id`) and its sibling structure (retrieved from the Zustand entity store).
- Compare sibling indices of the dragged item and target item.
- Set the calculated `edge` to `null` if the target is hovering over a no-op zone.
- By setting `edge = null` inside the `onDragEnter` and `onDrag` callbacks in pragmatic-dnd, the TreeItem's state suppresses the drop line rendering.

### 4. Detailed Blueprint
Modify `src/components/layout/TreeItem.tsx` drop target setup:
- Within the `getData` logic inside `dropTargetForElements`, calculate if:
  - `dragId === myId`
  - Dragged item is a sibling (shares same parent and workspace) and target item is `dragIdx - 1` with a `bottom` edge.
  - Dragged item is a sibling and target item is `dragIdx + 1` with a `top` edge.
  - Handle pinned items separately since they are matched via `favoriteIds` rather than `entities`.

### 5. Operational Trace
1. Implemented no-op drop line suppression inside `onDragEnter` and `onDrag` handlers in [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/TreeItem.tsx).
2. Checked off the task checklist item in [task.md](file:///Users/mktsoy/.gemini/antigravity-ide/brain/c4eb9967-7924-448c-bfa2-ae948032991d/task.md).
3. Documented changes and updated verification steps in [walkthrough.md](file:///Users/mktsoy/.gemini/antigravity-ide/brain/c4eb9967-7924-448c-bfa2-ae948032991d/walkthrough.md).

### 6. Status Assessment
The no-op drop line suppression is successfully implemented and documented.
