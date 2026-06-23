User request: "when i hover top edge of bottom row and bottom endge of top row i still se insert line"

### 0. Date and time of the request
2026-06-18 02:23

### 1. User request
User request: "when i hover top edge of bottom row and bottom endge of top row i still se insert line"

### 2. Objective Reconstruction
Resolve visual drop indicator lines still appearing on no-op states when hovering over adjacent siblings (bottom edge of the sibling above or top edge of the sibling below).

### 3. Strategic Reasoning
For root-level items (workspaces and unsorted items), the `parentId` property can be set to `null` or left as `undefined` depending on the entity source. Since `null === undefined` is false, comparisons like `dragEntity.parentId === entity.parentId` and `e.parentId === entity.parentId` failed. This skipped the no-op detection logic entirely for root-level items. Normalizing all parentId comparisons to `|| null` ensures that both representations match correctly as root-level siblings.

### 4. Detailed Blueprint
Update `src/components/layout/TreeItem.tsx` to:
- Compare parent IDs using `(parentId || null)` in `onDragEnter`, `onDrag` callbacks, and inside the `visualDropDepth` memo helper.

### 5. Operational Trace
1. Normalized all parentId comparisons inside `TreeItem.tsx` handlers using `multi_replace_file_content`.
2. Created the execution history report.

### 6. Status Assessment
The parent ID normalization resolves the mismatch, ensuring no-op drop lines are correctly hidden on root-level adjacent sibling edges.
