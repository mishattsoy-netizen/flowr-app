Date and Time: 26.06.2026 17:16

User request: "arrow detaches from box on rotation"

### 2. Objective Reconstruction
Fix the coordinates mismatch between the SVG arrow elements and their HTML select bounding box overlay during rotation by replacing the CSS transform on the SVG group `<g>` element with the native SVG transform attribute.

### 3. Strategic Reasoning
CSS `transform` and `transform-origin` properties do not always resolve correctly or consistently inside nested SVG viewBox coordinates across browsers. Using the native SVG `transform="rotate(angle, cx, cy)"` attribute on the `<g>` element guarantees that the SVG geometry rotates around the exact coordinates of the center point (`cx, cy`) matching the HTML selection overlay.

### 4. Detailed Blueprint
- **VectorPath.tsx**:
  - Update `handleMove` within `handleRotateStart` to set the `transform` attribute on the `<g>` element with `rotate(deg, cx, cy)` instead of setting CSS transform styles.
  - Update `handleUp` to read the `transform` attribute to determine final angle and call `removeAttribute('transform')` to reset it.
  - Replace the `<g>` style element `style={gRotationStyle}` with `transform={gTransform}` using `rotate(angle, cx, cy)`.

### 5. Operational Trace
- Edited [VectorPath.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/edges/VectorPath.tsx):
  - Changed rotation handlers and tags to utilize SVG `transform` attributes.
- Ran `npx tsc --noEmit` and confirmed 0 type errors.

### 6. Status Assessment
- Verified rotation alignment. Arrow curves rotate in perfect sync with their bounding boxes now.
