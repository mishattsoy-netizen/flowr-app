User request: "highlihgt folder or workspace only when item i drag will be inserted INSIDE of it"

### 0. Date and time of the request
2026-06-18 01:21

### 1. User request
User request: "highlihgt folder or workspace only when item i drag will be inserted INSIDE of it"

### 2. Objective Reconstruction
Incorporate the conditional folder/workspace background highlighting requirement (only trigger highlight when drop edge is null, signifying nesting/inserting inside) into the implementation plan.

### 3. Strategic Reasoning
Currently, folders and workspaces display active background highlight indicators (`sidebar-folder-drop-target`) as soon as the item is dragged over them, even if the cursor is near the top or bottom edges (where it would be reordered above or below instead of nested). The highlight should only apply when `closestEdge === null`.

### 4. Detailed Blueprint
- Update `implementation_plan.md` and `task.md` to document and track the conditional highlight check.
- Plan modification in `src/components/layout/TreeItem.tsx`:
  - Change `isFolderDropTarget = isOver && isFolder` to `isFolderDropTarget = isOver && isFolder && closestEdge === null`.

### 5. Operational Trace
1. Updated `implementation_plan.md` with the new design rule.
2. Appended a new item to the checklist in `task.md`.

### 6. Status Assessment
The plan is updated and ready for user review.
