User request: "@[c:\Users\misha\Documents\Dev\flowr-app copy\flowr-app copy\FIX-overlapping-stroke.md] plsu button icon next to the drag button"

## 0. Date and time of the request
21.07.2026, 05:40

## 1. User request
User request: "@[c:\Users\misha\Documents\Dev\flowr-app copy\flowr-app copy\FIX-overlapping-stroke.md] plsu button icon next to the drag button"

## 2. Objective Reconstruction
Fix an overlapping stroke artifact on the "Plus" block insertion button (which appears next to the drag handle) according to the project's overlapping stroke rules.

## 3. Strategic Reasoning
- The SVG stroke overlap artifact occurs when a path intersections or multiple paths are rendered with a text color that incorporates an alpha channel (e.g. `text-muted-foreground/40`). The overlapping areas blend together, creating doubled or dark strokes.
- As dictated by `FIX-overlapping-stroke.md`, the solution is to use a solid text color along with a CSS `opacity` property, avoiding the CSS engine's alpha compositing on the raw vector strokes.
- The styling for this button was found in the `markerBtnClass` string in `src/components/editor/BlockRenderer.tsx`, which defines the appearance of both the Plus and GripVertical (drag) buttons.

## 4. Detailed Blueprint
- `src/components/editor/BlockRenderer.tsx`: Update `markerBtnClass` to replace `text-muted-foreground/40` with `text-muted-foreground opacity-40 hover:opacity-100`.

## 5. Operational Trace
- Searched `BlockRenderer.tsx` for `markerBtnClass` inside the `BlockControls` component.
- Replaced the string to apply solid color and `opacity` utility classes, resolving the visual artifact.

## 6. Status Assessment
Completed. The Plus icon next to the drag handle now renders cleanly without intersection bleeding.
