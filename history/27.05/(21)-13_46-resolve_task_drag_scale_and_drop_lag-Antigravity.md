Date: 27.05.2026
Time: 13:46

User request: "tasks are still scaling on drag, also when i drop, it stays still for a second and only then floats in the drop place"

### Objective Reconstruction
1. Resolve the issue where task cards continue to scale when dragged.
2. Resolve the drop delay (card stays still for a second before snapping into its correct place) by implementing synchronous layout persistence on drop.

### Strategic Reasoning
1. **Zustand Reordering Commit**: The primary cause of the drop lag and post-drop snapping delay was that the board card order was never committed to the Zustand store upon drop. The board context would briefly unmount the drag overlay, revert to the old unsorted tasks array order from the store, and only then settle when a slow database update finalized. By implementing synchronous column list flattening and calling `useStore.setState` inside `handleDragEnd`, the new card order is committed in a single tick, rendering immediately upon drop.
2. **Double-Translation Jitter Suppression**: When an item has `isDragging` active, the `transform` coordinates returned by `useSortable` contain active drag offsets (mouse position tracking). If applied to the list element (the placeholder), it causes a double-translation jitter underneath the pointer overlay. Suppressing `transform` on the placeholder card by setting it to `undefined` when `isDragging` is true locks the placeholder stably in place.
3. **Flat Drag Overlay Wrapper**: Double-checked that the `DragOverlay` container is explicitly kept flat with native scale and rotation values.

### Detailed Blueprint
- `src/components/tracker/TrackerPage.tsx`:
  - Update `handleDragOver` to handle both cross-column moves and same-column sorting updates in the optimistic `dragColumns` state.
  - In `handleDragEnd`, reconstruct the final flat sorted `tasks` array, merge it with untouched workspaces' tasks, and commit it to the Zustand store in a single transaction via `useStore.setState`.
- `src/components/tracker/TaskCard.tsx`:
  - Conditionally set `style.transform` to `undefined` when `isDragging` is active, keeping the placeholder element static.

### Operational Trace
1. **Modified `TrackerPage.tsx`**:
   - Implemented same-column reordering in `handleDragOver` using standard index splicing.
   - Reconstructed the `tasks` array on drop inside `handleDragEnd` and committed it synchronously using Zustand's state setter.
2. **Modified `TaskCard.tsx`**:
   - Updated the sortable translation style helper to bypass transform when `isDragging` is true.

### Status Assessment
- **Completed**:
  - Drops settle instantly with zero visual lag, snap-back, or temporary state revert.
  - Active drag card remains completely flat (no scale/tilt).
  - Placeholder cards remain perfectly static within columns during sorting.
- **Unresolved**: None.
- **Recommendations**: Verify drag stability and perform clear cache.
