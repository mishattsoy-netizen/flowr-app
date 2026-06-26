User request: "deafult pattern opacity to 3%"

## 0. Date and time of the request
25.06.2026 23:40

## 1. User request
"deafult pattern opacity to 3%"

## 2. Objective Reconstruction
Change the canvas grid/dots pattern default opacity from 6% (`0.06`) to 3% (`0.03`) inside `CanvasPage.tsx` and adjust the Style Panel reset handlers to reflect this new default.

## 3. Strategic Reasoning
Updating the default state value in `useState` to `0.03` reduces grid lines prominence immediately on load. Updating the threshold and callback in the Style Panel's `Canvas Pattern` section makes the "Reset" action function correctly with the new default target.

## 4. Detailed Blueprint
- **CanvasPage.tsx:**
  - Change default state for `canvasPatternOpacity` from `0.06` to `0.03`.
- **CanvasStylePanel.tsx:**
  - Change reset condition and callback values for `canvasPatternOpacity` from `0.06` to `0.03`.

## 5. Operational Trace
- Modified [CanvasPage.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasPage.tsx) state declaration.
- Modified [CanvasStylePanel.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasStylePanel.tsx) reset conditions.
- Ran `npx tsc --noEmit` which completed successfully with exit code 0.

## 6. Status Assessment
Fixed and verified. Default pattern opacity is set to 3% on load and correctly resets to 3%.
