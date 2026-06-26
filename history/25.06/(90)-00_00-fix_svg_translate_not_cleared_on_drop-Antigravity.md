User request: "still out of bounding/selection box"

## 0. Date and time
26.06.2026 00:00

## 1. User request
"still out of bounding/selection box"

## 2. Objective Reconstruction
The shape remained visually outside its selection bounding box even after dropping. The SVG shape and the HTML selection outline were offset from each other in the static (non-dragging) state.

## 3. Root Cause
In `handlePointerUp`, SVG `<g>` elements were not being touched at all. The code only explicitly cleared transforms on HTML elements. The plan was that React would re-render CanvasShapeLayer (triggered by the store update), see `transform: ''`, and clear the `translate3d`. However, if the store update wrote the same x/y values (Zustand bailout, or identical coords) the re-render might not trigger, leaving the stale `translate3d` permanently in the DOM. The shape would then visually be at (oldX + dx, oldY + dy) via the translate, while React re-rendered with `x={newX}` attributes, compounding the offset.

## 4. Fix Applied
Updated `handlePointerUp` in `useDrag.ts` to explicitly handle SVG `<g>` elements — same robust pattern already used by resize:

- **Box shapes (rect, ellipse, diamond):** update child SVG attributes (`x/y`, `cx/cy`, `points`) to the final position FIRST, THEN clear `el.style.transform`. Zero visual flash — position is correct before translate is removed.
- **Path shapes (line, arrow, freedraw):** query `:scope > path` and update `d` attribute from new computed points, then clear `el.style.transform`.
- **All SVG elements:** also update `transformOrigin` to the new center for correct future rotation behavior.

This makes the drop sequence self-contained and not dependent on React re-render timing.

## 5. Operational Trace
- Modified `useDrag.ts` `handlePointerUp` loop: added `else if (el instanceof SVGElement && snap)` branch.
- Ran `npx tsc --noEmit` → exit 0.

## 6. Status Assessment
SVG transforms are now explicitly cleared synchronously on drop with no flash. Bounding box and SVG shape should always remain aligned. The `activeDragOffsets` guard (from previous fix) is still in place as a safety net during drag.
