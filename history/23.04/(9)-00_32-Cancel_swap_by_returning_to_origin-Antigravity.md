User request: "also when i want to cancel swap and hover over initial place and drop, swap action reverses"

### Objective Reconstruction
Implement a mechanism to cancel a swap or push action by returning the dragged widget to its starting location. If the user hovers over the original widget spot or the original empty slot, the preview layout should immediately reset to the base configuration.

### Strategic Reasoning
To provide a friction-less "undo" during drag-and-drop, the system needs to recognize when the user has returned to the "origin". By detecting if the current hover target matches the `draggedId` (for widgets) or the original `(row, order)` coordinates (for empty slots), we can explicitly reset the `previewLayout` to the `layoutRef.current` (the state before dragging began). This allows the user to abort a move without releasing the mouse button.

### Detailed Blueprint
1.  **useBentoLayout.ts**:
    *   Updated `handleDragOverWidget`: If `targetId === draggedId`, clear the dwell timer and set `previewLayout` back to the base layout.
    *   Updated `handleDragOverEmpty`: Find the original position of the `draggedId`. If the currently hovered `(row, order)` matches this original position, clear the timer and reset `previewLayout`.

### Operational Trace
- Added origin-detection logic to both widget and empty-slot hover handlers.
- Integrated explicit reset calls to `setPreviewLayout(layoutRef.current)`.

### Status Assessment
The user can now cancel any drag operation by simply returning the widget to where it started. This completes the "Transient Preview" experience by providing a clear and intuitive escape hatch.
