User request: "Is there any way we can force same bouding  box technique for arrows without changing svg?"

### 0. Date and time of the request
- Date: 2026-06-26
- Time: 05:58

### 1. User request
"Is there any way we can force same bouding  box technique for arrows without changing svg?"

### 2. Objective Reconstruction
Answer the user's question about whether it is possible to render the arrow's selection box and resize handles using standard HTML DOM elements (identical to shapes) instead of SVG elements, without changing the arrow itself rendering inside an SVG.

### 3. Strategic Reasoning
Investigate the React DOM architecture of the canvas. Since SVG paths must stay inside the `<svg>` element, their selection outline currently resides inside the SVG layer too. However, we can render an HTML overlay positioned exactly over the arrow's bounding box outside the `<svg>` tag. This HTML overlay would wrap the exact same HTML components (`ResizeHandle` and rotation dots) as normal shapes. During dragging, we would update only the overlay container's CSS dimensions (`left`, `top`, `width`, `height`), and the CSS absolute positioning would automatically snap all child handles to their correct spots, eliminating complex manual DOM recalculations.

### 4. Detailed Blueprint
Explain the theory, benefits, and implementation details of using an HTML overlay at the `CanvasPage.tsx` level instead of the SVG-based selection frame inside `VectorPath.tsx`.

### 5. Operational Trace
No code changes made (purely answering an architectural question).

### 6. Status Assessment
The user's query has been fully answered. I presented the benefits of this approach (cleaner CSS, automatic handle positioning, unified codebase) and offered to implement it if requested.
