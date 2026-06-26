### 0. Date and time of the request
Date: 25.06.2026
Time: 17:58

### 1. User request
User request: "look what happens wehn i move shapes, they are still stuttering"

### 2. Objective Reconstruction
Eliminate remaining visual stuttering and jumping specifically for SVG shapes (`CanvasShapeLayer.tsx`) and connection lines (`CanvasConnections.tsx`) during dragging and resizing. Maintain unthrottled maximum refresh rate rendering for all visual elements.

### 3. Strategic Reasoning
1. **SVG Shapes**: Similar to HTML blocks, when Zustand store updates at 80ms throttled intervals, React re-rendered the shape layer. The inner SVG coordinates were computed based on throttled coordinates `b.x - dragOffset.dx`, while the `<g>` container style transform had its unthrottled `translate3d` wiped out. We resolved this by rendering shapes at their static original positions (`startX`, `startY`, `startPoints`) and compiling `translate3d(dx, dy)` transform directives in the JSX wrapper `<g>` style block.
2. **Connections**: Connection anchor nodes were drawing line paths using `b.x + dragOffset.dx`. Since `b.x` updates at throttled intervals, the equation mixed throttled and unthrottled dimensions causing line double-translation. We resolved this by querying the absolute dragOffset static anchor `startX + dx` if active offsets exist.

### 4. Detailed Blueprint
1. **[canvasDragState.ts](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/lib/canvasDragState.ts)**: Add `startPoints` array to the offset tracker typings.
2. **[useDrag.ts](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/hooks/useDrag.ts)**: Write snapshot starting coordinates (`startPoints`) into `activeDragOffsets` on pointer move.
3. **[CanvasConnections.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasConnections.tsx)**: Check for active offsets in `getBlockData` and return unthrottled node boundaries.
4. **[CanvasShapeLayer.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasShapeLayer.tsx)**: Render shapes at static initial coordinates (`startX`, `startY`, `startPoints`) and apply translations (`translate3d`) inside the `<g>` React transform inline style.

### 5. Operational Trace
1. Included `startPoints` typings inside `canvasDragState.ts`.
2. Stored `startPoints` on drag movement in `useDrag.ts`.
3. Overhauled `getBlockData` inside `CanvasConnections.tsx` to read dynamic coordinates when interactive offsets exist.
4. Rewrote `CanvasShapeLayer.tsx` mapping coordinates and group transform logic.
5. Ran compilation safety check (`npx tsc --noEmit`) - passed.
6. Executed vitest suite (`npx vitest run`) - all 118 unit tests passed.

### 6. Status Assessment
SVG shapes and connection lines are now completely synchronized with unthrottled DOM transformations, giving them a butter-smooth (up to hardware refresh limits) visual movement.
