User request: "more transparent"

### 0. Date and time of the request
- Date: 2026-06-25
- Time: 20:47 (Local time: 20:47+03:00)

### 1. User request
"more transparent"

### 2. Objective Reconstruction
Modify the canvas viewport background grid lines opacity in:
1. The active canvas editor component ([CanvasPage.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasPage.tsx)).
2. The split canvas editor placeholder preview component ([MixedPage.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/editor/MixedPage.tsx)).
Set the line colors to a lower opacity level (`var(--bone-5)` which corresponds to 5% opacity, instead of `var(--bone-10)` / `var(--border)`).

### 3. Strategic Reasoning
- The initial grid implementation with 10-12% opacity was slightly too prominent. Lowering the grid lines' opacity to 5% (`var(--bone-5)`) maintains the structural grid outline for spatial awareness, but renders it as an extremely subtle, premium, and unobtrusive background element.

### 4. Detailed Blueprint
- **CanvasPage.tsx**: Update the linear gradients' color argument in `backgroundImage` from `var(--bone-10)` to `var(--bone-5)`.
- **MixedPage.tsx**: Update the linear gradients' color argument in `backgroundImage` from `var(--border)` to `var(--bone-5)`.

### 5. Operational Trace
- Modified [CanvasPage.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasPage.tsx):
  - Changed `backgroundImage: linear-gradient(to right, var(--bone-10)...)` to `backgroundImage: linear-gradient(to right, var(--bone-5)...)`.
- Modified [MixedPage.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/editor/MixedPage.tsx):
  - Changed `backgroundImage: linear-gradient(to right, var(--border)...)` to `backgroundImage: linear-gradient(to right, var(--bone-5)...)`.

### 6. Status Assessment
- **Completed**: Grid lines opacity lowered successfully on both canvas pages.
- **Verification**: Next.js hot-reloaded and compiled successfully.
