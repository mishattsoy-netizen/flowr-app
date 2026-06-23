Date: 19.06.2026 21:23

User request: "problem: when i pickup a row, i can see insert lines in the places that will pul row in the same position fix it without breaking anything"

## Objective Reconstruction
Resolve the issue where dragging a row displays an insertion line indicator in positions that would result in dropping the row back into its exact same position and parent container (specifically, when hovering over the element immediately below the parent container's last child, which redirects to the bottom of the parent container).

## Strategic Reasoning
1. **Identified Scenario**: When `Item 2` (the last child of `Folder 2`) is dragged, and the user hovers over the top edge of the sibling immediately below `Folder 2` (such as `Item 1`), `getRedirectedTarget` redirects the top-edge drop target to the bottom edge of `Folder 2` (`edge = 'bottom'`).
2. **Missing Guard**: The existing sibling no-op check only suppresses adjacent sibling drops. Since `Folder 2` is the parent of `Item 2` (not its sibling), the sibling no-op logic does not run. As a result, the bottom edge line for `Folder 2` gets drawn immediately below `Item 2`.
3. **The Solution**: Add a parent container check. If the drop target `redirectedEntity` is the parent container of the dragged item (`dragEntity.parentId === redirectedEntity.id`), and `edge` is `bottom`, we verify if the dragged item is already the last child of this parent container. If it is, we set `edge = null` to suppress the redundant insert line.

## Detailed Blueprint
- **Modify** `src/components/layout/TreeItem.tsx`:
  - Locate the drag-edge suppression block inside `dropTargetForElements.getData`.
  - Add a check checking if `edge === 'bottom' && dragEntity.parentId === redirectedEntity.id`.
  - Fetch the siblings list of `dragEntity` and check if the last item's ID matches the cleaned dragged item ID.
  - If so, set `edge = null`.

## Operational Trace
- Edited [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/TreeItem.tsx):
  - Inserted the parent container check inside `dropTargetForElements.getData`:
    ```typescript
    // Parent container check: if the target is the parent of the dragged item,
    // and we are inserting at the bottom (edge === 'bottom'), and the dragged item
    // is already the last child of this parent, it's a no-op.
    if (edge === 'bottom' && dragEntity.parentId === redirectedEntity.id) {
      const siblingsList = getSortedSiblings(dragEntity);
      const cleanDragId = dragId.replace('pinned-', '');
      if (siblingsList.length > 0 && siblingsList[siblingsList.length - 1].id === cleanDragId) {
        edge = null;
      }
    }
    ```

## Status Assessment
- **Completed**:
  - The redundant bottom-edge insert line under the parent folder's last child is now correctly suppressed, resolving the issue where drag indicators appeared on positions resulting in no-op moves.
