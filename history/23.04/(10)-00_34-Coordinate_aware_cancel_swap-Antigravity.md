User request: "doest work i can swap back wiht my inital posotion"

### Objective Reconstruction
Refine the "Cancel Swap" logic to work correctly when widgets have already swapped places. The user reported that moving back to the origin didn't always reset the layout, likely because the origin was now occupied by a different widget in the preview, blocking the "hover over self" detection.

### Strategic Reasoning
The previous "ID-based" origin detection was insufficient because as soon as a swap occurs, the widget at the origin changes. By switching to "Coordinate-based" detection, we can identify when the user has returned to the physical grid location where the drag started. We track the `initialPos` (row and column) at the start of the drag and use this as the master reference for resetting the preview.

### Detailed Blueprint
1.  **bento-engine.ts**:
    *   Moved `computeGridPositions` from the component to the engine to share geometry logic.
2.  **BentoDashboard.tsx**:
    *   Updated the pointer tracking logic to pass current grid `col` to the hook handlers.
3.  **useBentoLayout.ts**:
    *   Implemented `initialPosRef` to store the starting `(row, col)` of the dragged widget.
    *   Updated `handleDragOverWidget` and `handleDragOverEmpty` to accept coordinates and trigger a reset if the pointer returns to `initialPos`.

### Operational Trace
- Centralized grid position calculation.
- Integrated coordinate-aware reset triggers in the layout hook.
- Ensured `currentHoverRef` stays in sync with coordinates to prevent thrashing.

### Status Assessment
Returning to the origin now reliably cancels all transient swaps and pushes, regardless of what widget currently occupies that space in the preview. This provides the "cancel" behavior the user expected.
