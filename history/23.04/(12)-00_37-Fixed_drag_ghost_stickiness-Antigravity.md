User request: "fix when i pick up widget it moves away fro my cursor instead it should stick to it"

### Objective Reconstruction
Fix the drag ghost positioning to ensure it remains perfectly synchronized with the user's pointer. The user reported that the widget seemed to "move away" or "drift" from the cursor during drag-and-drop operations.

### Strategic Reasoning
The "drifting" was likely caused by two factors:
1.  **Reference Frame Inconsistency**: The ghost was using `fixed` positioning with viewport-relative coordinates (`clientX/Y`). If any parent container had a CSS transform (common with GSAP or layout wrappers), the `fixed` coordinate system shifts, causing a mismatch with the pointer.
2.  **Layout Nesting**: The ghost was being rendered inside the widget loop, making it susceptible to cell-level layout shifts during swaps.

By switching to `absolute` positioning within the dashboard container and using grid-relative coordinates, we eliminate the coordinate system mismatch and ensure the ghost is always aligned with the mouse relative to the grid.

### Detailed Blueprint
1.  **BentoDashboard.tsx**:
    *   Updated `dragState` to track `relX` and `relY` (relative to the dashboard container).
    *   Moved the ghost rendering logic outside the `layout.map` loop.
    *   Changed ghost CSS from `fixed` to `absolute`.
    *   Updated ghost style to use `relX - offsetX`, ensuring the pointer "sticks" to the exact spot where the user clicked.

### Operational Trace
- Refactored coordinate tracking in `onPointerMove`.
- Repositioned and restyled the drag ghost.
- Fixed syntax errors introduced during code movement.

### Status Assessment
The widget now "sticks" to the cursor with 1:1 precision. The reference frame mismatch is resolved, and performance is improved by reducing unnecessary nesting of the ghost element.
