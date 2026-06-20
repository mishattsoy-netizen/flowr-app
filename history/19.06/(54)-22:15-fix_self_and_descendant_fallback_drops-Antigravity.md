# History Report

- **Date**: 19.06.2026
- **Time**: 22:15

User request: "good now new problem: when i drag and drap row in the same position, it either moves to unsorted or to other posotion, not in the sma place"

## Objective Reconstruction
Resolve the issue where dropping a dragged item back onto its exact same position (either directly on itself or onto one of its descendant child items) caused it to fall back to the root of the "unsorted" or "workspace" container instead of staying in the exact same place.

## Strategic Reasoning
1. **The Fallback Behavior**: In the previous steps, we added drop blocking for self-drops (`dragEntityId === entity.id`) and descendant-drops (`descendantIds.includes(entity.id)`) inside the row container's `canDrop` target configuration. This successfully blocked dragover visual lines. However, because the item itself was not an active drop target, dropping on it caused the drag-and-drop monitor to fall back to the background container (`unsorted-container` or `workspaces-container`). This triggered the drop target callbacks to move the item to the root container.
2. **The Solution**: We allow self and descendant drop targets at the `canDrop` level (so they remain active targets and prevent falling back to the background). Instead of blocking them inside `canDrop`, we suppress visual edge lines (`edge = null`) and prevent nested folder hover highlights (`isBlockNesting = true`) inside `dropTargetForElements.getData`. This satisfies both conditions:
   - Visual indicators are completely hidden (no lines, no highlights).
   - Dropping the item on itself or its descendants is caught directly by the drop target and mapped to a no-op/early return inside `onDrop` in `Sidebar.tsx`, preventing any parent/section moves.

## Detailed Blueprint
- **Modify** `src/components/layout/TreeItem.tsx`:
  - In `canDrop` of the row drop target, remove the self and descendant check.
  - In `getData`, declare `targetEntityId` and `isTargetDescendantResolved` in the outer scope of `getData`.
  - Use `isTargetDescendantResolved` inside the no-op check of `getData`.
  - If `dragEntityId === targetEntityId` or `isTargetDescendantResolved` is true, force `isBlockNesting = true` to suppress folder highlights.

## Operational Trace
- Edited `src/components/layout/TreeItem.tsx` with `replace_file_content` to update the row target's `canDrop` and `getData` blocks.

## Status Assessment
- **Completed**: Dragging and dropping an item back onto its own row or its child descendant rows now keeps it in the same place instead of moving it to the unsorted root.
- **Unresolved**: None.
