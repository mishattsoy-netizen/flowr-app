User request: "sometimes when i drop item awkwardly on folder. whole folder dissapears somewhere"

### 0. Date and time of the request
- **Date**: 19.06.2026
- **Time**: 05:12

### 1. User request
"sometimes when i drop item awkwardly on folder. whole folder dissapears somewhere"

### 2. Objective Reconstruction
Prevent folder-type entities from vanishing from the sidebar after an awkward drag-and-drop operation.

### 3. Strategic Reasoning
The sidebar renders entities in three display sections:
- **Workspaces**: only `workspace` or `collection` types
- **Unsorted**: only `note`, `canvas`, or `mixed` types with no valid parent
- **Nested**: entities whose `parentId` matches a visible parent

A `folder` type entity with `parentId: null` falls into **none** of these categories — it literally becomes invisible.

This could happen when dropping an item on the **edge** of a root-level workspace/collection item. The drop handler sets `newParentId = overEntity.parentId`, and for root-level items that's `null`. If the dragged entity is a `folder`, it gets assigned `parentId: null` and disappears from every sidebar section.

The fix is a simple guard: if the computed `newParentId` is `null` and the entity type is `folder` (not `workspace`/`collection`), block the move entirely. Folders must always have a parent to remain visible.

### 4. Detailed Blueprint
- Modify [Sidebar.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/Sidebar.tsx):
  - Add a guard after the descendant check (line ~522) that returns early if `newParentId` is null and entity type is `folder`.

### 5. Operational Trace
- Edited [Sidebar.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/Sidebar.tsx) to add the guard.
- Ran `./node_modules/.bin/tsc --noEmit` — compilation succeeded with no errors.

### 6. Status Assessment
- **Status**: Completed successfully.
- **Result**: Folder-type entities can no longer be accidentally orphaned to `parentId: null` via drag-and-drop. The guard blocks any move that would make a folder invisible in the sidebar.
