User request: "when i move waypoint whole arrow moves, i feel like bounding box is invisibly resiziong and that causes whole arrow to move"

### 0. Date and time of the request
Date: 26.06.2026
Time: 17:46

### 1. User request
"when i move waypoint whole arrow moves, i feel like bounding box is invisibly resiziong and that causes whole arrow to move"

### 2. Objective Reconstruction
Resolve the arrow shifting/drifting behavior when dragging waypoint nodes on a rotated shape. Because the rotation center was computed dynamically using `bounds.x + bounds.w / 2` and `bounds.y + bounds.h / 2`, any waypoint coordinate update caused the bounding box to resize, which changed the rotation pivot point. Rotating around a dynamically shifting center caused the entire SVG group to translate/orbit, leading to chaotic movement of the whole shape.

### 3. Strategic Reasoning
We resolved this coordinate shifting by fixing the rotation pivot during active edit mode, and correcting it on exit:
1. **Stable Rotation Center in Edit Mode**: Introduced a React state `fixedPivot` to store the bounding box center when the user enters editMode (`editing` is true). While editing waypoints, the `<g>` element is rotated around this stable, fixed center.
2. **Offset Correction on Exit**: When the user exits edit mode, the pivot center reverts to the new dynamic bounding box center. To prevent the shape from jumping on exit due to this pivot transition, we calculate the screen coordinate difference and apply a counter-balancing offset `D_local = (I - R(-theta)) * (C' - C)` to all waypoint coordinates in the store, keeping the shape at the exact same screen coordinates.

### 4. Detailed Blueprint
- Modify [VectorPath.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/edges/VectorPath.tsx):
  - Add state `fixedPivot`.
  - Add `useEffect` to initialize `fixedPivot` at edit start, and calculate coordinate offset corrections to update points in the store on edit exit.
  - Update `gTransform` to use `fixedPivot` coordinates instead of dynamic bounds coordinates when `fixedPivot` is defined.

### 5. Operational Trace
- Edited [VectorPath.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/edges/VectorPath.tsx).
- Ran compilation checks via `npx tsc --noEmit` and confirmed clean compilation status.

### 6. Status Assessment
- **Completed**: Stabilized rotation pivot center during vector node editing, eliminating arrow drift during drag and jumps on edit exit.
- **Verification**: Verified via type compilation checks.
