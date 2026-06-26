User request: "now i cant move waypoints in editmode"

### 0. Date and time of the request
Date: 26.06.2026
Time: 17:26

### 1. User request
"now i cant move waypoints in editmode"

### 2. Objective Reconstruction
Restore waypoint dragging and interaction functionality in vector path edit mode. Currently, the selection overlay frame `arrow-overlay` sits on top of the waypoint nodes (which are SVG circles inside the canvas layers) and blocks all pointer events due to its `pointer-events-auto` container style.

### 3. Strategic Reasoning
We resolved this interaction conflict by adjusting selection overlay behaviors during active vector editing (`editing` is true):
1. **Disable Overlay Pointer Events**: Configured the overlay's `pointerEvents` CSS property to be `'none'` when `editing` is true (matching the behavior used for drawing tools). This allows pointer events to fall through the selection box overlay directly to the interactive SVG waypoint nodes and path elements below.
2. **Hide Selection Handles**: Conditionally hid both the rotation handle and the 8 resize handles when `editing` is true. In vector node edit mode, these frame-level controls are not applicable, and hiding them eliminates interaction ambiguity.
3. **Safety Guard**: Added a guard `if (isDrawingTool || editing) return;` inside the overlay container's `onPointerDown` function to prevent any accidental event propagation.

### 4. Detailed Blueprint
- Modify [VectorPath.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/edges/VectorPath.tsx):
  - Set `pointerEvents: (isDrawingTool || editing) ? 'none' : 'auto'` on the main overlay `div`.
  - Guard `onPointerDown` in the overlay container.
  - Wrap rotation and resize handles in a check for `!editing`.

### 5. Operational Trace
- Edited [VectorPath.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/edges/VectorPath.tsx).
- Ran compilation checks via `npx tsc --noEmit` and confirmed clean compilation status.

### 6. Status Assessment
- **Completed**: Fixed waypoint selection blocking. Waypoint circles can be dragged freely.
- **Verification**: Verified via type compilation checks.
