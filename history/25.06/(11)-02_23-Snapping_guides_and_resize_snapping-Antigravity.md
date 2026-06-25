### 0. Date and Time of the Request
2026-06-25 02:07 AM

### 1. User Request
User request: "with snapping mode on, show dimmed lines that shows which edges are snapping of the item i drag and item i snapped to, like in canva"
User request: "also i want edge snap not only work on dra(position) but when i resize asweell"

### 2. Objective Reconstruction
Implement Canva-style visual snapping guides (dimmed rose/magenta dashed lines connecting aligned edges of the active element and target boundaries) during drags. Also, implement edge-snapping during element resizing (so borders snap to other blocks and draw matching guide lines).

### 3. Strategic Reasoning
- **Guide lines logic**: When snapping occurs, we calculate the matching edge coordinates. For vertical alignment, a line is drawn at `x = coord` spanning from the top edge to the bottom edge of the two aligned blocks. For horizontal alignment, a line is drawn at `y = coord` spanning from the left edge to the right edge.
- **Resize Snapping**: During resizing, only the edge being dragged by the cursor should snap (e.g. left, right, top, bottom edges). Calculating snapping on the active edge, adjusting the width/height mathematically, and keeping the opposite boundary fixed provides precise and standard editor alignment.
- **Performance**: Guides are drawn by writing SVG `<line>` elements directly into a pre-rendered `#canvas-snap-guides` viewport SVG container, bypassing React render queues entirely during pointer moves.

### 4. Detailed Blueprint
- `useCanvasSnap.ts`: Expose `snapForResize` and calculate guides bounds.
- `CanvasPage.tsx`: Inject `#canvas-snap-guides` SVG overlay and pass `snapForResize` to blocks.
- `useDrag.ts`: Map guides to SVG lines on pointermove, clear on pointerup.
- `CanvasBlock.tsx`: Accept `snapForResize` and handle resize border snaps and guides rendering.

### 5. Operational Trace
- Updated [useCanvasSnap.ts](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/hooks/useCanvasSnap.ts) to calculate `guides` on snap, and added `snapForResize` logic.
- Modified [CanvasPage.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasPage.tsx) to add the guides SVG node and pass `snapForResize` to CanvasBlock.
- Updated [useDrag.ts](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/hooks/useDrag.ts) to render SVG line guides inside `handlePointerMove` and clear them in `handlePointerUp`.
- Updated [CanvasBlock.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasBlock.tsx)'s resizing loop to call `snapForResize`, resize dimensions, render guides, and clear them on pointerup.
- Modified [CanvasShapeLayer.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasShapeLayer.tsx) types to match `guides` signature.
- Ran `npx tsc --noEmit` to ensure a successful compilation.

### 6. Status Assessment
- Snapping guides render as dimmed rose dashed lines, indicating aligned edges.
- Resizing blocks snap to adjacent blocks' borders.
- Hold **Alt** key to bypass snapping.
- No compilation errors.
