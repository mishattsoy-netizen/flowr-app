User request: "in edit mode dont show bounding box so it doesnt actively resize when i move points"

### 0. Date and time of the request
Date: 26.06.2026
Time: 17:28

### 1. User request
"in edit mode dont show bounding box so it doesnt actively resize when i move points"

### 2. Objective Reconstruction
Hide the selection bounding box overlay outline, handles, and dimensions label entirely when in active spline edit mode (waypoint editing). Since moving the waypoint coordinates updates the path's bounding box live, having the overlay visible caused it to resize actively and jitter, cluttering the view.

### 3. Strategic Reasoning
We resolved this by altering the portal conditional rendering in the vector path component:
1. **Conditional Bounding Box Rendering**: Updated the `createPortal` render condition to check `{selected && !editing && bounds && viewportContent}`.
2. **Result**: When `editing` is true, the `arrow-overlay` selection box container is not mounted to the DOM at all. Only the spline path itself and its node waypoint handles are rendered, giving a clean and standard editing experience.

### 4. Detailed Blueprint
- Modify [VectorPath.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/edges/VectorPath.tsx):
  - Change `selected && bounds && viewportContent && createPortal(...)` to `selected && !editing && bounds && viewportContent && createPortal(...)`.

### 5. Operational Trace
- Edited [VectorPath.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/edges/VectorPath.tsx).
- Ran compilation checks via `npx tsc --noEmit` and confirmed clean compilation status.

### 6. Status Assessment
- **Completed**: Bounding box outline and controls are now completely hidden during waypoint editing.
- **Verification**: Verified via type compilation checks.
