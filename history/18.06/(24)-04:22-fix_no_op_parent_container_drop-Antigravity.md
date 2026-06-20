User request: "when i drag and drop any row in its initial position it STILL drops to othe opsition!"

### 0. Date and Time of the Request
18.06.2026 04:21

### 1. User Request
"when i drag and drop any row in its initial position it STILL drops to othe opsition!"

### 2. Objective Reconstruction
Ensure that dropping a sidebar item within its current folder/container behaves as a no-op (does not reorder it to the end of the folder/container) when dropped without an active sibling edge target (where `edge` is `null`).

### 3. Strategic Reasoning
If an item is dropped on its parent folder or section container rather than on a specific sibling edge, the calculated `edge` is `null` (since it's dropped inside the container, not on an edge). 
In this case:
1. `newParentId` and `newWorkspaceId` remain identical to the item's current parent and workspace.
2. However, because `edge` is `null` (so not `'bottom'`), `toIdx` is looked up using `overId` (the container ID).
3. Since the container ID is not a sibling inside its own visual list, `toIdx` returned `-1`.
4. The `-1` value was handled by defaulting to `visualSiblings.length - 1` (the last child index).
5. As a result, the code executed a reordering, shifting the item to the end of the folder/container instead of returning early.
By detecting this condition (`newParentId === entity.parentId && newWorkspaceId === entity.workspaceId && edge === null`) and returning early, we prevent this incorrect jump to the end of the container.

### 4. Detailed Blueprint
- **[Sidebar.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/Sidebar.tsx)**:
  - Add a normalization function to safely check `parentId` and `workspaceId` equality.
  - Insert a check right after the target `newParentId` and `newWorkspaceId` resolution: if both match the dragged item's original attributes and `edge === null`, return early.

### 5. Operational Trace
- Added normalized comparison checking in `Sidebar.tsx` `onDrop`:
  ```typescript
  const normParent = (id: string | null | undefined) => id || null;
  const normWS = (id: string | null | undefined) => id || 'ws-personal';
  if (normParent(newParentId) === normParent(entity.parentId) && normWS(newWorkspaceId) === normWS(entity.workspaceId) && edge === null) {
    return; // No-op: dropped inside its current parent container
  }
  ```

### 6. Status Assessment
- Drops inside the item's current container/folder are now safely ignored as no-ops.
- Walkthrough updated.
