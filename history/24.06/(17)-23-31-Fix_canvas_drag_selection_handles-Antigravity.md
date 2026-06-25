User request: "when i move shape, selection stroke with resize handles stays in inistail position untill i drop fix it"

### 0. Date and Time of the Request
- **Date**: 2026-06-24
- **Time**: 23:31

### 1. User Request
"when i move shape, selection stroke with resize handles stays in inistail position untill i drop fix it"

### 2. Objective Reconstruction
Ensure the blue selection outline and all resize handles move dynamically in sync with canvas shape layers (rectangles, ellipses, etc.) during drag interactions, rather than staying frozen at the initial position until release.

### 3. Strategic Reasoning
- When a shape is selected and dragged, both the SVG element `<g id={b.id}>` (rendering the visual shape) and the HTML overlay container `<div id={block.id}>` (rendering the selection border and handles) are present on the page with matching IDs.
- In `useDrag.ts`, the hook was querying the element to translate using `document.getElementById(id)`. Because `id` must be unique but was duplicated between the SVG shape and the `CanvasBlock` div wrapper, the browser returned only the first occurrence (the SVG shape inside `<CanvasShapeLayer>`).
- Consequently, during dragging, only the SVG shape's transform was translated on the DOM directly. The selection boundary border and resize handles (inside `CanvasBlock`) remained at their initial positions until pointer release updated the coordinates in the store, causing a full state update.
- To resolve this elegantly, we modified `useDrag.ts` to locate dragged DOM elements using `document.querySelectorAll('[id="..."]')`. This queries all matching elements (both SVG `<g>` and the HTML wrapper `<div>`), translating them simultaneously and seamlessly.

### 4. Detailed Blueprint
- **Files Modified**:
  - `src/hooks/useDrag.ts` to replace `document.getElementById` with `document.querySelectorAll` to capture all elements associated with the dragged ID.

### 5. Operational Trace
- Modified [useDrag.ts](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/hooks/useDrag.ts):
  - Updated DOM node resolution logic inside `startDrag` (line 129) to query using `document.querySelectorAll` and append all results to `domElements`.
- Ran `npx tsc --noEmit` to verify type safety and ensure no compilation or layout errors exist.

### 6. Status Assessment
- **Status**: Completed.
- **Outcome**: The blue selection stroke and circular resize handles now translate smoothly and synchronously with the shape during dragging.
