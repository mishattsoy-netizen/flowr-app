# Report: Fix Self Row Drop Reverting to Unsorted

## 0. Date and Time of the Request
Date: 2026-06-19
Time: 04:08 AM

## 1. User Request
User request: "look i pickup item 1, drag a bit to the right, drop in the same place and it drops to unsorted why?"

## 2. Objective Reconstruction
- Fix the issue where picking up a tree item (such as `Item 1` in `workspace 1`), dragging it slightly to the right, and dropping it within the horizontal bounds of its own row causes it to be moved to the "Unsorted" section instead of executing as a no-op.

## 3. Strategic Reasoning
- Previously, the `TreeItem` row drop target `canDrop` validator rejected drops of the item itself (`source.data.id !== myId`).
- When dragging an item and dropping it on its own row area, the row drop target rejected the drop, causing the drop event to bubble up to the parent container (`workspaces-container`).
- Dropping on `workspaces-container` resolved the new parent as `null` and the new workspace as `activeWorkspaceId`. Since the active view was the Dashboard, `activeWorkspaceId` was `'ws-personal'`, causing the item to move to the Unsorted section.
- By removing the `source.data.id !== myId` restriction from `canDrop` on the row, dropping an item on its own row is accepted by the row drop target. It resolves `overId === activeId`, which triggers the early return no-op check `if (activeId === overId) return;` in [Sidebar.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/Sidebar.tsx) and correctly does nothing.

## 4. Detailed Blueprint
- Modify `canDrop` in `dropTargetForElements` inside [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/TreeItem.tsx) to remove the `source.data.id !== myId` check.

## 5. Operational Trace
- Modified [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/TreeItem.tsx) around line 350:
  ```diff
      return dropTargetForElements({
        element: el,
  -     canDrop: ({ source }) => source.data.type === 'tree-item' && source.data.id !== myId,
  +     canDrop: ({ source }) => source.data.type === 'tree-item',
        getData: ({ input, element, source }) => {
  ```

## 6. Status Assessment
- **Self-drop no-op fix**: Dropping an item on any part of its own row (even when dragged slightly horizontally) correctly executes as a no-op and preserves the item's original position.
