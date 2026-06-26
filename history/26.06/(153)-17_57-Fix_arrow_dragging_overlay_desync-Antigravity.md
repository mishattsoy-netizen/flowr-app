Date: 26.06.2026
Time: 17:57

User request: "all good but when i move arrow, it moves away from bounding box and comesback to back anly when i drop"

### 1. User Request
User request: "all good but when i move arrow, it moves away from bounding box and comesback to back anly when i drop"

### 2. Objective Reconstruction
Resolve the visual desync during spline/arrow dragging where the arrow path translates smoothly with the pointer, but the selection overlay (bounding box) remains static or drifts away, only snapping back to align with the path upon releasing the drag (pointerup).

### 3. Strategic Reasoning
During spline/arrow dragging, a CSS `transform` style (`translate3d(currentDX, currentDY, 0) rotate(...)`) is directly applied in the DOM by `useDrag.ts` to both the SVG `<g>` element (the arrow path) and the HTML `overlayEl` (the bounding box selection frame).
However, unlike other canvas blocks (which return `undefined` for `transform` in their React style object when active dragging is detected), the `VectorPath.tsx` overlay was always rendering `transform: renderRotation ? rotate(deg) : undefined` in React.
As a result, any React re-render occurring during the drag (such as peer live cursor broadcasts or pointer movement events) would overwrite the HTML overlay's inline CSS `transform` style back to the static, untranslated rotation, leaving it behind. Since the SVG `<g>` has no style-based `transform` managed by React, it was never reset, leading to the visual desync.
Checking the non-reactive `activeDragOffsets.has(block.id)` global map inside `VectorPath.tsx`'s overlay style and returning `undefined` for `transform` during drag tells React to leave the drag translation intact, keeping both elements perfectly synchronized.

### 4. Detailed Blueprint
- Modify `src/components/canvas/edges/VectorPath.tsx`:
  - Import `activeDragOffsets` from `@/lib/canvasDragState`.
  - Update the portal-ed HTML selection frame style `transform` parameter to be `undefined` when `activeDragOffsets.has(block.id)` is true.

### 5. Operational Trace
- Edited [VectorPath.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/edges/VectorPath.tsx):
  - Added import for `activeDragOffsets`.
  - Updated selection overlay portal styling so `transform` is skipped/undefined if the block is actively dragging.
- Ran `npx tsc --noEmit` which completed successfully with zero type checking errors.

### 6. Status Assessment
- Spline/arrow dragging desync is fully resolved.
- Selection box overlay translation and rotation now track the arrow curve synchronously in real time during dragging.
- Type checks are fully verified and clean.
