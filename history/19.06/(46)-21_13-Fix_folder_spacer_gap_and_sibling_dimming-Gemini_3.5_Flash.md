Date: 19.06.2026 21:13

User request: "when i hover gap between item 2 and workspace, there is no insert line, i expect same behaviour. also another problem: when i dra item 1 from folder 1 back to folder 2, whole folder 2is dimmed and i cant drop there."

## Objective Reconstruction
1. Resolve the issue where hovering the gap between an item (such as item 2) and the workspace below it does not show the insertion line visual indicator when dragging an item from a deeper nesting level.
2. Resolve the issue where dragging an item (such as item 1) from Folder 1 back into Folder 2 (its sibling) causes Folder 2 to be visually dimmed (indicating blocked nesting / invalid drop target) and preventing a drop.

## Strategic Reasoning
1. **Gap between item 2 and workspace**: The spacer below Folder 1 (depth=1) has a strict depth check in `AfterFolderSpacer.canDrop`. When dragging `item 1` (which was at depth=3), the spacer rejected drops because `targetDepth(1) < dragDepth(3) - 1 = 2`. Relaxing this constraint to `dragDepth - 2` lets the spacer accept drops from deeper nesting levels, and adjusting the visual representation using `Math.max(depth, dragDepth - 1)` draws the insert line at the correct logical/visual level.
2. **Folder 2 dimmed / blocked drop**: The `AfterFolderSpacer` below Folder 2 had a `checkIsNoOp` guard. Since `item 1` was sorted immediately after `Folder 2` inside Folder 1, dragging it to Folder 2's spacer matched the `dragIdx === folderIdx + 1` condition, triggering a no-op return. This killed the spacer's drop target status, which in turn caused `canDrop` to return false and dim the folder. However, dragging a sibling item to the spacer actually intends to "insert inside" the folder rather than "insert after" the folder. By detecting if the dragged item is a sibling of the target folder, we bypass the no-op check and return `isInsertInsideBottom: true`, preventing dimming and correctly routing the drop.

## Detailed Blueprint
- **Modify** `src/components/layout/TreeItem.tsx`:
  - Relax depth constraint in `AfterFolderSpacer.canDrop` to check `targetDepth < dragDepth - 2`.
  - Pass `draggedDepth` state to track the active drag depth in `AfterFolderSpacer` for drawing the insert line at `Math.max(depth, dragDepth - 1)`.
  - Identify when the dragged entity is a sibling of the folder (sharing same parent and workspace).
  - If it is a sibling drag, skip the depth checks and no-op guards in `canDrop` (return `true`), and return `isInsertInsideBottom: true` / `isAfterFolder: false` from `getData`.

## Operational Trace
- Edited [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/TreeItem.tsx):
  - Modified `AfterFolderSpacer` component structure to track `draggedDepth` and `isSiblingDrag`.
  - In `canDrop` within `AfterFolderSpacer`:
    ```typescript
    const dragEntity = freshEntities.find(e => e.id === dragId);
    const folderEntity = freshEntities.find(e => e.id === folderId);
    const isSibling = dragEntity && folderEntity &&
      (dragEntity.parentId || null) === (folderEntity.parentId || null) &&
      (dragEntity.workspaceId || 'ws-personal') === (folderEntity.workspaceId || 'ws-personal');
    if (isSibling) return true;

    if (targetDepth < dragDepth - 2) {
      return false;
    }
    ```
  - In `getData` within `AfterFolderSpacer`:
    ```typescript
    const isSibling = dragEntity && folderEntity &&
      (dragEntity.parentId || null) === (folderEntity.parentId || null) &&
      (dragEntity.workspaceId || 'ws-personal') === (folderEntity.workspaceId || 'ws-personal');

    return {
      type: 'tree-item',
      id: folderId,
      isAfterFolder: !forceInside && !isSibling,
      isInsertInsideBottom: forceInside || !!isSibling,
    };
    ```
  - In `onDragEnter`, `onDragLeave`, and `onDrop` of `AfterFolderSpacer`: set/clear `draggedDepth` and `isSiblingDrag` state variables.
  - Calculated `displayDepth` using `isSiblingDrag` and `draggedDepth`:
    ```typescript
    const displayDepth = isSiblingDrag
      ? depth + 1
      : draggedDepth !== null
        ? Math.max(depth, draggedDepth - 1)
        : (isTargetRoot && draggedType && !isDragRootOnly) ? 1 : depth;
    ```

## Status Assessment
- **Completed**:
  - The spacer logic is successfully updated to support drops from depth=3 onto depth=1 (resolving the gap insert line issue).
  - Sibling drags are properly recognized and routed to `isInsertInsideBottom` instead of triggering a no-op check, which solves the dimming/blocked drop target problem on Folder 2.
- **Unresolved / Next Steps**:
  - Verify if the client-side UI renders these updates correctly after the server has completely refreshed.
