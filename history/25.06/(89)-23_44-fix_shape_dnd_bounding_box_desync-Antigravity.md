User request: "not fixed, look i moved shape to the right a bit and it moves ahead of bounding box outside of it"

## 0. Date and time
25.06.2026 23:44

## 1. User request
"not fixed, look i moved shape to the right a bit and it moves ahead of bounding box outside of it"

## 2. Objective Reconstruction
The SVG shape was moving ahead of (to the right of) its HTML bounding box / selection outline during drag-and-drop.

## 3. Root Cause
The previous fix (returning `''` instead of `undefined` for empty transforms) introduced a new bug. During drag, `CanvasBlock` re-renders periodically because `onDragMove` calls `setIsOverSection(...)` as a state update. When React re-renders with `transform: ''`, it explicitly resets the HTML wrapper div's `transform` back to `''`, clearing useDrag's active `translate3d`. The SVG `<g>` element (in CanvasShapeLayer) does NOT re-render during drag (its store slice doesn't change), so its `translate3d` stays intact. Result: SVG shape moves forward, HTML bounding box stays put.

## 4. Fix Applied
- **CanvasBlock.tsx**: Return `undefined` from the `transform` computation during `isDraggingLocal`. This prevents React from touching the DOM `transform` style during re-renders mid-drag. After drop (isDraggingLocal = false), return `''` to clear the translate.
- **CanvasShapeLayer.tsx**: Import `activeDragOffsets` and return `undefined` during active drags (when `activeDragOffsets.has(b.id)` is true). After `activeDragOffsets` is cleared in `handlePointerUp` and the store update fires, React re-renders with `transform: ''` — clearing the translate — and simultaneously writes the new SVG x/y attributes. Zero double translation, zero flash.

## 5. Operational Trace
- Modified `CanvasBlock.tsx`: conditional `isDraggingLocal` guard before transform calc.
- Modified `CanvasShapeLayer.tsx`: added `activeDragOffsets` import + conditional guard.
- Ran `npx tsc --noEmit` — exit 0, no errors.

## 6. Status Assessment
Fix applied and compiled clean. Shape and bounding box should now stay perfectly in sync during drag for both rotated and non-rotated shapes.
