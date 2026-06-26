User request: "show always when shape is selected"

## 0. Date and time of the request
25.06.2026 23:36

## 1. User request
"show always when shape is selected"

## 2. Objective Reconstruction
Refactor the live sizing (dimension) and angle (rotation) tooltips underneath active canvas shape blocks in `CanvasBlock.tsx` so that they remain visible at all times while the shape is selected (`isSelected`), rather than only during active dragging, resizing, or rotating gestures.

## 3. Strategic Reasoning
Always displaying properties like size and rotation when a shape is selected provides valuable persistent design context. Since the direct DOM updates for dragging, resizing, and rotating target the `.dimension-label` and `.rotation-label` selectors individually, we can mount both divs side-by-side inside a flex wrapper centered under the shape, conditional solely on `isSelected`. This preserves existing pointer move handlers while keeping the UI clean and overlap-free.

## 4. Detailed Blueprint
- **CanvasBlock.tsx:**
  - Remove separate `(isResizing || isDraggingLocal)` and `isRotating` conditional blocks.
  - Add a unified `isSelected` conditional block that wraps both `.dimension-label` and `.rotation-label` side-by-side inside a centered absolute flex row.

## 5. Operational Trace
- Modified [CanvasBlock.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasBlock.tsx) layouts inside shape selection overlay wrappers.
- Ran `npx tsc --noEmit` which completed successfully with exit code 0.

## 6. Status Assessment
Fixed and verified. Dimension and angle labels display side-by-side centered below selected shape frames.
