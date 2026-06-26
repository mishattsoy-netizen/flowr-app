User request: "dont highlingt edges/boorder of shape when selected"

### 0. Date and Time of the Request
- **Date**: 25.06.2026
- **Time**: 22:47

### 1. User Request
"dont highlingt edges/boorder of shape when selected"

### 2. Objective Reconstruction
Prevent the canvas shape layers from overriding a shape block's customized border (stroke, strokeWidth, and arrowhead fill colors) with the selection blue highlight color (`var(--brand-blue)`) when selected. The shape's natural styling properties must remain visible in real time while selected.

### 3. Strategic Reasoning
Previously, `CanvasShapeLayer.tsx` intercepted shape selections and changed their SVG border properties to `selectionStroke` (`var(--brand-blue)`). This forced selected shapes (rectangles, ellipses, diamonds, lines, arrows, freedraw) to look blue. As a result, the user could not see custom border styling changes immediately. Removing this override ensures that standard shape styles are kept, while the outer rectangular bounding box (rendered by `CanvasBlock.tsx`) still indicates which element is selected without distorting the shape's visual borders.

### 4. Detailed Blueprint
- **Modify**: [CanvasShapeLayer.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasShapeLayer.tsx)
  - Remove `selectionStroke` constant reference and usage.
  - Simplify shape `rect`, `ellipse`, `diamond` properties to use natural `stroke` and `sw` (strokeWidth).
  - Simplify shape `line`, `arrow`, `freedraw` path elements to use natural `stroke`, `sw`, and arrowhead marker fill properties instead of overriding them based on selection status.

### 5. Operational Trace
- Edited [CanvasShapeLayer.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasShapeLayer.tsx) with the `replace_file_content` tool to drop the `isSelected` color/width ternary checks.
- Initiated a background build task to verify the application compiling correctly.

### 6. Status Assessment
- **Status**: Completed.
- **Verification**: Verifying typing compatibility and Next.js compiler output.
