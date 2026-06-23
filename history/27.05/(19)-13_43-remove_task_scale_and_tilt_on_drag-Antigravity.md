Date: 27.05.2026
Time: 13:43

User request: "remove task scale and tilt on drag"

### Objective Reconstruction
Remove the scale-up (`scale-[1.03]`) and rotation (`-rotate-1`) transformations from the task card container in the drag overlay during dragging, maintaining a flat-axis, clean, and minimalist style.

### Strategic Reasoning
1. **Design System Alignment**: In `PREFERENCES.md` under "User Dislikes", it explicitly lists "Scale transforms on selected items" as a design choice to be avoided. Removing scale and tilt from active cards during drag fully respects this styling preference, ensuring the interface feels flat, crisp, and clean.
2. **Tactile Simplicity**: Without the visual "tilt" and "scale" shifts, the picked-up card retains its exact visual boundaries and alignment, making column crossings and drop alignment feel extremely direct and stable.

### Detailed Blueprint
- `src/components/tracker/TrackerPage.tsx`:
  - Strip the `scale-[1.03]` and `-rotate-1` styling classes from the container wrapper div inside `DragOverlay`.

### Operational Trace
1. **Modified `TrackerPage.tsx`**:
   - Removed `scale-[1.03]` and `-rotate-1` from the Tailwind class list on the wrapper div inside `DragOverlay`.

### Status Assessment
- **Completed**:
  - Drag overlay card retains its native `1:1` scale and `0deg` rotation during drag.
  - Deep floating shadow and perfectly matched `268px` card width are preserved for clean depth separation.
- **Unresolved**: None.
- **Recommendations**: Verify visual alignment during board drags.
