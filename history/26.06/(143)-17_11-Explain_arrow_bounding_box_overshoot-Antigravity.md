Date and Time: 26.06.2026 17:11

User request: "why arrows dont fit in the bounding box?"

### 2. Objective Reconstruction
Provide a clear, technical explanation of why the curved canvas arrows bend outside of their selection bounding box in the UI.

### 3. Strategic Reasoning
Answering this query helps the user understand the underlying geometry engine:
1. The selection bounding box is calculated by checking only the min/max X/Y coordinates of the arrow's control points (`resolvedPts` / `b.points`).
2. The arrow curve is rendered using a Catmull-Rom spline interpolation algorithm.
3. Because the spline interpolates smoothly between points, the curve naturally overshoots the control point bounds to maintain smooth tangents, resulting in the visual protrusion.

### 4. Detailed Blueprint
- Analyze `selectionBoundingBox` in `CanvasPage.tsx` and `bounds` in `VectorPath.tsx`.
- Formulate the explanation highlighting Catmull-Rom spline mathematics versus coordinate-based bounding box calculations.

### 5. Operational Trace
- Read geometry and rendering logic in [CanvasPage.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasPage.tsx) and [VectorPath.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/edges/VectorPath.tsx).
- Documented findings in this history file.

### 6. Status Assessment
- Delivered a clear and mathematically accurate response explaining the behavior.
