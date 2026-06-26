User request: "why do shapes and arrows have different bouding boxes, handles and rotation dots???"

### 2. Objective Reconstruction
Explain to the user the architectural and code-level reasons why shapes (CanvasBlock) and arrows/lines (VectorPath) display different selection UI elements (bounding boxes, handles, rotation dots).

### 3. Strategic Reasoning
Answering an investigatory request. The codebase splits rendering logic between HTML/DOM-based shapes and SVG-based vector paths. Consequently, their selection frames, resize handles, and rotation controls are implemented using different technologies and components with different styling.

### 4. Detailed Blueprint
No code changes were made. I reviewed `VectorPath.tsx` and `CanvasBlock.tsx` to confirm how selection is rendered for both types.

### 5. Operational Trace
- Searched for "Selection" in `src/components/canvas` to find the selection rendering code.
- Examined `VectorPath.tsx` (lines 210-260) and confirmed that it renders selection frames and handles as SVG `<rect>` elements and lacks a rotation handle.
- Examined `CanvasBlock.tsx` (lines 600-640) and confirmed that it uses HTML `<div>` elements for the selection bounding box, `<ResizeHandle>` components for handles, and a custom circular rotation dot.

### 6. Status Assessment
The user's query has been fully investigated and answered. The discrepancies are due to the fundamental difference between HTML DOM rendering (for shapes) and SVG rendering (for lines/arrows). No bugs to fix, just architectural differences in the UI implementation.
