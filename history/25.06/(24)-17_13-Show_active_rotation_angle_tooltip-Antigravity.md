0. Date and time of the request: 25.06.2026 17:13

1. User request: "when i rotaste shape, show active angle next to it, like small box with dimensions but now with angle"

2. Objective Reconstruction
- Display a small floating tooltip showing the active rotation angle in degrees next to the shape container while it is being actively rotated.

3. Strategic Reasoning
- Toggling an `isRotating` state on rotation start and end allows mounting a lightweight `.rotation-label` tooltip styled identically to the size dimensions label.
- Writing degree calculations directly to the DOM node (`labelEl.textContent`) during the pointermove loop avoids React state-update overhead, preserving smooth 60fps hardware-accelerated animations.

4. Detailed Blueprint
- **src/components/canvas/CanvasBlock.tsx**:
  - Add an `isRotating` local state.
  - Implement direct `.rotation-label` DOM text content updates in `handleRotateStart`.
  - Render the `.rotation-label` div container positioned absolute below the shape borders during rotation.

5. Operational Trace
- **CanvasBlock.tsx**:
  - Added `isRotating` hook trigger.
  - Captured `.rotation-label` nodes inside `requestAnimationFrame` on rotate gesture.
  - Formatted and mapped active degree values to the tooltip on movement.
  - Fixed typo mapping `moveEvent.clientY` correctly.
  - **Type checking**: Ran `npx tsc --noEmit` which completed successfully with 0 errors.

6. Status Assessment
- **Completed**: The live rotation angle box displays next to the shape as it is rotated and hides on pointer release.
