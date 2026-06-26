User request: "more" (referring to background grid transparency)

### 0. Date and time of the request
- Date: 2026-06-25
- Time: 20:48 (Local time: 20:48+03:00)

### 1. User request
"more"

### 2. Objective Reconstruction
Modify the canvas viewport background grid lines opacity in:
1. The active canvas editor component ([CanvasPage.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasPage.tsx)).
2. The split canvas editor placeholder preview component ([MixedPage.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/editor/MixedPage.tsx)).
Further lower the opacity of the grid lines from `var(--bone-5)` (5% opacity) to `var(--bone-3)` (3% opacity) for a more faint, subtle canvas texture.

### 3. Strategic Reasoning
- Lowering the grid lines' opacity to 3% (`var(--bone-3)`) makes the grid outline extremely faint. This minimizes visual noise on the canvas screen while retaining layout guidance lines for sizing and positioning canvas shapes and text boxes.

### 4. Detailed Blueprint
- **CanvasPage.tsx**: Update the linear gradients' color argument in `backgroundImage` from `var(--bone-5)` to `var(--bone-3)`.
- **MixedPage.tsx**: Update the linear gradients' color argument in `backgroundImage` from `var(--bone-5)` to `var(--bone-3)`.

### 5. Operational Trace
- Modified [CanvasPage.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasPage.tsx):
  - Changed `backgroundImage: linear-gradient(to right, var(--bone-5)...)` to `backgroundImage: linear-gradient(to right, var(--bone-3)...)`.
- Modified [MixedPage.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/editor/MixedPage.tsx):
  - Changed `backgroundImage: linear-gradient(to right, var(--bone-5)...)` to `backgroundImage: linear-gradient(to right, var(--bone-3)...)`.

### 6. Status Assessment
- **Completed**: Grid lines opacity lowered to 3% successfully on both canvas pages.
- **Verification**: Next.js hot-reloaded and compiled successfully.
