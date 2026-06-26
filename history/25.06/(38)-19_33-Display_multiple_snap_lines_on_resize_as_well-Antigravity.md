Date: 25.06.2026 19:33

User request: "goot bnow i see all three lines, But i see them ony when i move item, but i also want to see when i resized item so smae size. look at the images, ellipse is alighned with left edge of rectangle, when i resize right edge, move t to the right and alighn it with right edge of rect, i see only right edge line, but i want to see al alighned lines. also while i hold resize handle, i want all lines to be visible, like they are when i move item"

## Objective Reconstruction
When resizing a canvas shape and aligning its edges/center with another shape (or when multiple alignments match during resizing, such as resizing a shape to have matching dimensions and position), display all matching snapped guide lines (including edges and centers) concurrently, instead of only showing the single line for the handle being dragged.

## Strategic Reasoning
We applied the same two-pass guide line collection design from dragging to the `snapForResize` function. 
1. **Pass 1**: Find the globally closest snap position and dimension based on the active resize handle.
2. **Pass 2**: After determining the final snapped bounds (`snappedX`, `snappedY`, `snappedW`, `snappedH`), perform a second pass scanning over all blocks to collect any alignments (left, center, right, top, bottom) that fall within a sub-pixel tolerance (`< 0.01`) of the shape's final coordinates.
This dynamically outputs all matching lines (such as left edge, center, and right edge guides) simultaneously as the user resizes the shape to match another shape's size.

## Detailed Blueprint
- **`src/hooks/useCanvasSnap.ts`**:
  - Update `snapForResize` to run Pass 2 checking logic on the calculated snapped boundaries.
  - Draw guides for every matched alignment.

## Operational Trace
- Edited `src/hooks/useCanvasSnap.ts` using `replace_file_content`.
- Verified type-safety with `npx tsc --noEmit` (successful).
- Verified unit test suite with `npm test` (all 118 tests passed).

## Status Assessment
- Resizing now correctly displays multiple guide lines when shapes align on multiple edges/centers.
- Canvas performance remains high and stutter-free.
