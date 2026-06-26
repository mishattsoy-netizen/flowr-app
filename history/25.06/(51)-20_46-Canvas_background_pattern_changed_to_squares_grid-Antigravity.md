User request: "change bg pattern to sqares/grid"

### 0. Date and time of the request
- Date: 2026-06-25
- Time: 20:46 (Local time: 20:46+03:00)

### 1. User request
"change bg pattern to sqares/grid"

### 2. Objective Reconstruction
Modify the canvas viewport background pattern to a grid/squares design in:
1. The active canvas editor component ([CanvasPage.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasPage.tsx)).
2. The split canvas editor placeholder preview component ([MixedPage.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/editor/MixedPage.tsx)) for visual cohesion.

### 3. Strategic Reasoning
- **Squares/Grid Pattern**: Replaced the previous dots (`radial-gradient`) with horizontal and vertical grid lines (`linear-gradients` aligned to 1px wide lines).
- **Styling Colors**:
  - In `CanvasPage.tsx`, used a very subtle transparent bone shade `var(--bone-10)` to keep grid lines background-integrated and non-distracting while maintaining visibility across different zoom states (`viewport.scale`).
  - In `MixedPage.tsx`, used the theme-defined `var(--border)` variable for grid lines to align layout visual styling perfectly with the rest of the splits screen borders.

### 4. Detailed Blueprint
- **CanvasPage.tsx**: Update the inline style block's `backgroundImage` to combine horizontal and vertical linear gradients instead of a radial gradient dot.
- **MixedPage.tsx**: Update the container's inline styling `backgroundImage` property to match the new linear gradient grid setup.

### 5. Operational Trace
- Modified [CanvasPage.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasPage.tsx):
  - Changed `backgroundImage: radial-gradient(var(--bone-15) 1.2px, transparent 1.2px)` to `backgroundImage: linear-gradient(to right, var(--bone-10) 1px, transparent 1px), linear-gradient(to bottom, var(--bone-10) 1px, transparent 1px)`.
- Modified [MixedPage.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/editor/MixedPage.tsx):
  - Changed `backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1px)'` to `backgroundImage: 'linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)'`.

### 6. Status Assessment
- **Completed**: Canvas editor and static split canvas backgrounds have been transitioned from dots to a grid layout.
- **Verification**: Built and hot-reloaded successfully.
