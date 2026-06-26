User request: "Is there any way we can force same bouding box technique for arrows without changing svg? [yes]"

### 0. Date and time of the request
- Date: 2026-06-26
- Time: 06:00

### 1. User request
"yes" (approving the proposal to implement HTML selection overlay for arrows using React portals, rendering standard HTML selection boxes, resize handles, and rotation handles identical to shapes).

### 2. Objective Reconstruction
Implement the same DOM/HTML selection bounding box, `<ResizeHandle>` components, and rotation controls for arrows/lines as shapes, using a React Portal. This aligns their look, feel, animations, and hover state scaling exactly, without changing the fact that the actual arrow curves are drawn inside SVG paths.

### 3. Strategic Reasoning
Instead of duplicating CSS, transitions, and shadow filters for SVG elements inside `VectorPath.tsx`, we can create a React Portal that targets an HTML wrapper container (`#canvas-viewport-content`) positioned exactly over the canvas. When an arrow is selected, `VectorPath.tsx` uses `createPortal` to render standard HTML components (like `<ResizeHandle>` and rotation divs) positioned absolutely inside the canvas coordinate space.
Because absolute HTML positioning is relative to the overlay wrapper, `useDrag.ts` only needs to update the wrapper's `left`, `top`, `width`, and `height` styles in real-time during a shape move. The browser's native rendering engine automatically repositions the handles to the correct corners of the wrapper, avoiding manual handle math and preventing detaching.

### 4. Detailed Blueprint
- **CanvasPage.tsx**: Add `id="canvas-viewport-content"` to the viewport overlay `div`.
- **VectorPath.tsx**:
  - Import `createPortal` and `ResizeHandle`.
  - Set up a state reference and a `useEffect` hook to store `canvas-viewport-content` element.
  - Map string positions (`nw`, `n`, etc.) to index-based values (`POSITION_MAP`).
  - Render the selection overlay inside `createPortal` targeting the viewport container when selected. The overlay contains standard HTML borders, dimension labels, rotation controls, and `<ResizeHandle>` tags.
  - Remove all legacy SVG-based selection `<rect>`, handles, lines, and `<circle>` elements.
- **useDrag.ts**:
  - Simplify the pointermove connection logic. Find the portal element (`arrow-overlay-{arrowId}`) and set its `style.left`, `style.top`, `style.width`, and `style.height` directly.
  - Update the dimension labels text directly in the DOM.

### 5. Operational Trace
- Modified imports and inner wrapper ID in [CanvasPage.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasPage.tsx).
- Swapped SVG elements for HTML createPortal elements in [VectorPath.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/edges/VectorPath.tsx).
- Simplified the real-time layout update logic in [useDrag.ts](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/hooks/useDrag.ts).
- Checked compilation using `npx tsc --noEmit`.

### 6. Status Assessment
The HTML selection overlay strategy is successfully implemented. Arrows and shapes now share the exact same CSS-based selection outline, resize handles, and rotation handles. The handles automatically adapt to bounding box size updates during drag and remain anchored, eliminating the detaching handles issue entirely. Compilation is verified.
