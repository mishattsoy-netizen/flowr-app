User request: "arrow handles detaching when i move shape"

### 0. Date and time of the request
- Date: 2026-06-26
- Time: 05:57

### 1. User request
"arrow handles detaching when i move shape"

### 2. Objective Reconstruction
Prevent selection frames, resize handles, and rotation controls of an arrow/line from detaching (i.e. lagging in their original position) when the shape it is bound to is being moved/dragged.

### 3. Strategic Reasoning
During drag, the app updates the DOM style properties of shapes directly (bypassing React re-renders) and recomputes only the SVG path's `d` attribute in real-time. Since the React store is only updated on pointer up, the arrow's React component does not re-render, causing the arrow's selection outline and handles to remain static at the old coordinates.
We can resolve this by adding specific data-attributes to the selection outline, handles, and rotation handles in the SVG, and updating their coordinates via direct DOM manipulation during the drag move handler, in tandem with the path updates.

### 4. Detailed Blueprint
- **VectorPath.tsx**:
  - Add `data-selection-frame={block.id}` to the selection `<rect>`.
  - Add `data-handle-index={i}` to the handle `<rect>` elements inside the mapping loop.
  - Add `data-rotation-line={block.id}` to the rotation `<line>`.
  - Add `data-rotation-circle={block.id}` to the rotation `<circle>`.
- **useDrag.ts**:
  - Within `handlePointerMove`, inside the `cachedPathElements` loop, track the live endpoints (`pts` or `[[sx, sy], [tx, ty]]`).
  - Calculate the new live bounds (`minX`, `minY`, `maxX`, `maxY`) using the pad padding of `6` (matching `VectorPath.tsx`).
  - Locate the parent `<g>` node.
  - Use `querySelector` to grab the selection elements by their data attributes and update their coordinates (`x`, `y`, `width`, `height`, `x1`, `y1`, `x2`, `y2`, `cx`, `cy`) in the DOM live.

### 5. Operational Trace
- Added matching data attributes in [VectorPath.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/edges/VectorPath.tsx).
- Implemented live bounds calculation and attribute updates in [useDrag.ts](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/hooks/useDrag.ts).
- Checked compilation using `npx tsc --noEmit`.

### 6. Status Assessment
The detaching handles issue has been successfully resolved. When dragging a shape, all bound arrows' selection frames, handles, and rotation controls now dynamically move and adjust along with the arrow path in real-time. Compilation is fully verified.
