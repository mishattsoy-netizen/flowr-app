User request: "i should be able to put workspace inside a workspace so dont highlight"

### 0. Date and time of the request
2026-06-18 01:28

### 1. User request
User request: "i should be able to put workspace inside a workspace so dont highlight"

### 2. Objective Reconstruction
Incorporate the restriction preventing workspace/collection nesting into the implementation plan (forcing a 50/50 reorder-only split when dragging workspaces and preventing highlighting).

### 3. Strategic Reasoning
Workspaces and collections are root-level elements (depth 0) and cannot be nested inside any parent. Thus, when dragging a workspace or collection, it should never trigger nesting drop behaviors or highlights. By checking the dragged entity type during `onDragEnter` and `onDrag`, we can split the hover zone 50/50 (top/bottom reorder) instead of 25/50/25 (nesting inside).

### 4. Detailed Blueprint
- Update `implementation_plan.md` and `task.md` with workspace nesting prevention rules.
- Plan code changes in `TreeItem.tsx` to read the dragged item entity type from the store and force 50/50 split on folder drop targets if it is a workspace or collection.

### 5. Operational Trace
1. Updated `implementation_plan.md` using `replace_file_content`.
2. Appended the task to `task.md`.

### 6. Status Assessment
The plan is updated and ready for user review.
