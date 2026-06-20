User request: "this insert line should apear because item i drag will be insertet in the same initail posiiotn."

### 0. Date and time of the request
2026-06-18 01:33

### 1. User request
User request: "this insert line should apear because item i drag will be insertet in the same initail posiiotn."

### 2. Objective Reconstruction
Incorporate the logic to suppress visual drop indicator lines when a drop would result in a no-op (i.e., dragging an item over itself, over the bottom edge of its immediate previous sibling, or over the top edge of its immediate next sibling).

### 3. Strategic Reasoning
Visual lines that show a drop target at the exact same location as the item's current position represent a no-op action and confuse the user. In the drag callbacks `onDragEnter` and `onDrag`, we can calculate if the current hover position represents a no-op for the dragged item ID (`source.data.id`) and set the calculated `edge` to `null` to avoid rendering the visual line.

### 4. Detailed Blueprint
- Update `implementation_plan.md` and `task.md` with no-op drop line suppression rules.
- Plan code changes in `TreeItem.tsx` to:
  - Check if the target item and dragged item share the same parent and workspace.
  - Determine sibling indices and suppress edge indicator if it matches the current index.

### 5. Operational Trace
1. Updated `implementation_plan.md` using `replace_file_content`.
2. Appended the task to `task.md`.

### 6. Status Assessment
The plan is updated and ready for user review.
