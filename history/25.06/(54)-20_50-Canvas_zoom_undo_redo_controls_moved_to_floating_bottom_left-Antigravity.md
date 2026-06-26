User request: "move these buttons from top bar to floating position in the bottom left corner of canvas, image is reference"

### 0. Date and time of the request
- Date: 2026-06-25
- Time: 20:50 (Local time: 20:50+03:00)

### 1. User request
"move these buttons from top bar to floating position in the bottom left corner of canvas, image is reference"

### 2. Objective Reconstruction
Modify the canvas components:
1. Remove Zoom (`onZoomIn`/`onZoomOut`) and Undo/Redo (`onUndo`/`onRedo`) controls from the top header toolbar ([CanvasToolbar.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasToolbar.tsx)).
2. Place Zoom and Undo/Redo buttons into a floating layout in the bottom-left corner of the canvas viewport inside [CanvasPage.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasPage.tsx).
3. Align the styling of the new floating controls (using two pills next to each other, styling them with `bg-sidebar/95 backdrop-blur-xl border border-[var(--bone-12)] shadow-lg` and custom paddings/rounding matching the user's reference image).

### 3. Strategic Reasoning
- **Floating Controls**: Placing the utility buttons as floating pills directly on the canvas viewport gives the editor a focused tool-like feeling, maximizing space in the top header.
- **Mouse Event Capturing**: By calling `e.stopPropagation()` on `onPointerDown`/`onMouseDown` for the floating container, we ensure clicking the zoom or undo/redo buttons doesn't trigger canvas panning or box selection.
- **Pill UI Layout**: Divided controls into two rounded containers side-by-side:
  - Zoom Pill: contains Zoom Out (`-` icon), Zoom Reset (`100%` label that resets scale to 1.0 when clicked), and Zoom In (`+` icon).
  - History Pill: contains Undo and Redo curved arrow buttons that automatically use a `disabled` state with lower opacity (`opacity-30`) when no steps are left to undo/redo.

### 4. Detailed Blueprint
- **CanvasToolbar.tsx**:
  - Remove zoom, onZoomIn, onZoomOut, canUndo, canRedo, onUndo, onRedo from the `CanvasToolbarProps` interface and rendering function signature.
  - Delete layout markup blocks rendering Zoom and Undo/Redo buttons.
- **CanvasPage.tsx**:
  - Import `Minus`, `Undo2`, `Redo2` from `lucide-react`.
  - Remove unused props from `<CanvasToolbar ... />` invocation block.
  - Render the floating control containers absolute positioned at `bottom-6 left-6` inside the relative canvas container element.

### 5. Operational Trace
- Modified [CanvasToolbar.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasToolbar.tsx):
  - Removed Zoom element rendering, VSep element rendering, and TbBtn Undo/Redo rendering.
  - Trimmed signatures accordingly.
- Modified [CanvasPage.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasPage.tsx):
  - Added imports for `Minus`, `Undo2`, `Redo2`.
  - Removed the zoom/undo/redo props passed to `CanvasToolbar`.
  - Added the floating wrapper elements with full button event bindings and disable properties.

### 6. Status Assessment
- **Completed**: Controls moved to the floating bottom-left position.
- **Verification**: Built and compiled successfully.
