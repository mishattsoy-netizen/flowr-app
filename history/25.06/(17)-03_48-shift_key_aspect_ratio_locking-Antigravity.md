0. Date and time of the request: 25.06.2026 03:48

1. User request: "when i drag/create shape and hold shift, is shape shuld move with locked ratio, default behaviour in canva, figma, excalidraw and others..."

2. Objective Reconstruction
Implement aspect-ratio locking when the user holds down the Shift key in the Canva-like flowr-app canvas editor. This restriction applies in two scenarios:
- **Shape Creation (drag-to-draw)**: Restrict the shape (rect, ellipse, diamond) to a perfect 1:1 square/circular bounding box.
- **Corner Resizing**: Restrict resizing from any corner handle (`nw`, `ne`, `se`, `sw`) to preserve the starting width-to-height aspect ratio, anchoring the opposite corner properly in canvas coordinates. Resizing via side handles (`n`, `s`, `e`, `w`) remains unconstrained.

3. Strategic Reasoning
- **Dominant Resize Axis**: To make aspect ratio resizing intuitive, we determine whether the mouse dragged further along the width or height compared to their original aspect-ratio equivalent. The larger relative delta is treated as the dominant axis.
- **Anchor Math**: Resizing with a locked ratio moves the active corner while keeping the opposite corner fixed. This requires custom coordinate translation:
  - `se` drags bottom-right, anchoring top-left (`startX`, `startY`).
  - `sw` drags bottom-left, anchoring top-right (`startX + startWidth`, `startY`).
  - `ne` drags top-right, anchoring bottom-left (`startX`, `startY + startHeight`).
  - `nw` drags top-left, anchoring bottom-right (`startX + startWidth`, `startY + startHeight`).
- **Minimum Clamping**: Ensure bounding boxes do not collapse below minimum width (60px) or height (40px) while maintaining the locked ratio, preventing coordinate calculations from flipping or dividing by zero.

4. Detailed Blueprint
- **CanvasPage.tsx**: Update the gesture-drawing logic (`PointerEvent` handlers for drawing shapes) to check `ev.shiftKey`. If true, set `width = height = Math.max(width, height)`.
- **CanvasBlock.tsx**: Cache starting dimensions and position at the beginning of the resize drag. In `handlePointerMove`, check `moveEvent.shiftKey` and whether the current handle is a corner (`handle.length === 2`). Calculate constrained target dimensions based on `startSize.w / startSize.h` and translate `newX`/`newY` to preserve the correct anchor.

5. Operational Trace
- **CanvasPage.tsx**:
  - Updated shape-drawing move handler `onMove` to intercept `ev.shiftKey`. Equalized `dx` and `dy` values using `Math.max(Math.abs(dx), Math.abs(dy))` and adjusted shape offset calculations.
  - Implemented the same logic in `onUp` to ensure a shift-constrained shape is created even if the mouse release event coordinates differ slightly from the last move coordinates.
- **CanvasBlock.tsx**:
  - Added verification checks inside `handlePointerMove` for `isShiftPressed` and `isCorner` (corner handles `nw`, `ne`, `se`, `sw`).
  - Calculated original ratio (`w / h`). Applied dominant-axis delta calculation to choose whether width changes or height changes govern the new size.
  - Applied opposite corner anchoring offsets to recalculate `newX` and `newY` based on `targetW` and `targetH` constraints.
- **Type Checking**:
  - Ran `npx tsc --noEmit` to verify type safety and compilation success.

6. Status Assessment
- **Completed**:
  - Shift-key 1:1 aspect ratio constraint during drag-to-create shape drawings.
  - Shift-key aspect ratio lock resizing for all corner handles (`nw`, `ne`, `se`, `sw`) anchored to the respective opposite corner.
  - Preservation of unconstrained side resizing (`n`, `s`, `e`, `w`) and single-axis translation locking for group drag-and-move actions.
  - Compiled successfully with 0 errors.
- **Next Recommendations**:
  - Encourage the user to test the visual interaction of the locked resize handle in various directions.
