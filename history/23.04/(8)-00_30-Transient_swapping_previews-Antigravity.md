User request: "change swapping to 500ms, when im swapping, widgets shoould only swap places like that, im hovering over widget, it swaps place with me but if i didnt drop yet and hover over another widget, this widget does in my place and the widget i hovered first goes back to his place"

### Objective Reconstruction
1.  Increase the hover-to-swap delay (dwell time) to 500ms.
2.  Implement "Transient Previews": Ensure that swapping is non-permanent during the drag-over phase. If the user hovers over multiple widgets in sequence, only the current target should swap with the dragged widget, and previous targets must return to their original positions.

### Strategic Reasoning
Previously, the preview layout was being updated cumulatively, meaning each hover would "bake" the previous swap into the preview state. By changing the logic to always calculate the swap/push relative to the *initial* layout (the state at drag start), we create a clean "rollback" effect. Moving the cursor away from a widget now naturally reverts the dashboard to its base state before applying the next preview.

### Detailed Blueprint
1.  **useBentoLayout.ts**:
    *   Updated `DWELL_DELAY_MS` to 500.
    *   Refactored `handleDragOverWidget` to call `calculateSwapLayout(layoutRef.current, ...)` instead of updating the current preview.
    *   Refactored `handleDragOverEmpty` to call `calculatePushLayout(layoutRef.current, ...)` for the same reason.
    *   Since `layoutRef.current` only updates on `commitLayout` (which happens on `handleDragEnd`), it serves as the perfect immutable base for all drag-time previews.

### Operational Trace
- Modified `DWELL_DELAY_MS` constant.
- Updated functional updates in `setPreviewLayout` to use absolute base references.

### Status Assessment
The drag-and-drop experience is now significantly more predictable. Widgets "spring back" to their original locations when the user moves past them, only committing the final state when the pointer is released.
