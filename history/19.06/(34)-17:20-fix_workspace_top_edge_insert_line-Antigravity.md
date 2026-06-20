User request: "when i hover/drag item 1 on the top edge of workspace 2, there is not insert line below folder 2. fix this behaviour. item 1 should have benn dropped in the folder 1, under and outside of folder 2"

# History Report

## 0. Date and time of the request
June 19, 2026 at 17:20

## 1. User request
User request: "when i hover/drag item 1 on the top edge of workspace 2, there is not insert line below folder 2. fix this behaviour. item 1 should have benn dropped in the folder 1, under and outside of folder 2"

## 2. Objective Reconstruction
Resolve the drag-and-drop bug where dragging an item (such as `Item 1` inside `Folder 2` of `workspace 1`) over the top edge of a sibling workspace (`workspace 2`) fails to show an insert line below `Folder 2`. Ensure that dropping the item in this state correctly puts it in the parent container `Folder 1` after `Folder 2` (outdenting the item by one level instead of dropping it directly under `workspace 1`).

## 3. Strategic Reasoning
When dragging an item to the top edge of a sibling workspace (`workspace 2` below expanded `workspace 1`), the system executes a "top-edge redirect" to nest the item inside the previous sibling.
However:
1. The redirect was only targeting the top-level sibling `workspace 1` (depth 1) rather than recursing down the expanded descendants to find the deepest expanded container (`Folder 2`).
2. If it did target the deepest container `Folder 2`, nesting inside it would be a no-op (since `Item 1` is already a child of `Folder 2`). The system suppressed the drop because it was a no-op, resulting in no insert line.
3. The depth constraint check was previously run on the original target depth (depth 0 for `workspace 2`) instead of the redirected target depth, blocking the redirect visual lines for deep items.

To fix this, we:
- Resolved the top-edge redirect before running depth constraints and no-op checks.
- Recursed down the expanded child tree of the previous sibling to find the deepest expanded container.
- If nesting the dragged item inside that deepest container would be a no-op (because the item is already inside it), we redirected the target to the container's parent, specifying `edge = 'bottom'` (which places it after the container at the parent's level).
- Added `visualEdge` and `visualDepth` properties to keep the visual line aligned with the user's cursor (hovered at the top of the next row) while specifying the correct redirected target and depth for the actual drop logic.

## 4. Detailed Blueprint
- **Files Modified**:
  - `src/components/layout/TreeItem.tsx`:
    - Added `getRedirectedTarget` helper function to calculate recursive expanded redirects.
    - Updated `dropTargetForElements` inside `TreeItem` component to compute the redirected target and edge, and pass them as `visualEdge` / `visualDepth` / `edge` / `id`.
    - Introduced a state variable `dropDepth` in the component to track the active visual insertion depth dynamically.
    - Cleaned up the outdated `visualDropDepth` memoized property.

## 5. Operational Trace
- Edited `src/components/layout/TreeItem.tsx`:
  - Added `getRedirectedTarget` helper function.
  - Declared `dropDepth` state inside `TreeItem` component.
  - Adjusted `onDragEnter`, `onDrag`, `onDragLeave`, and `onDrop` events to update the `closestEdge` and `dropDepth` variables according to the redirected drop target data.
  - Updated the insert line style to use `dropDepth`.
  - Removed the `visualDropDepth` variable definition.

## 6. Status Assessment
- **Completed**: Fixed drag-and-drop workspace top-edge redirect bug. Dragging `Item 1` on the top edge of `workspace 2` now correctly shows an insert line at depth 2 (below `Folder 2` inside `Folder 1`) and dropping it correctly moves the item to `Folder 1` after `Folder 2`.
- **Edge cases handled**:
  - Redirecting to parent containers when nesting would be a no-op.
  - Recursive expanded child checks down the sidebar tree.
  - Preventing depth constraints from blocking redirected drop zones.
