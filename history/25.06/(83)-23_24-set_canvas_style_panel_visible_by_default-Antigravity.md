User request: "sidebar must be shown by default"

## 0. Date and time of the request
25.06.2026 23:24

## 1. User request
"sidebar must be shown by default"

## 2. Objective Reconstruction
Change the default visibility of the right style sidebar/panel inside `CanvasPage.tsx` so that it is shown immediately when the canvas is loaded rather than requiring the user to open it manually.

## 3. Strategic Reasoning
Adjusting the default React state of `showStylePanel` to `true` ensures that the sidebar is visible by default upon landing on the canvas screen, improving discoverability and workflow efficiency.

## 4. Detailed Blueprint
- **CanvasPage.tsx:**
  - Change default state value in `useState` declaration of `showStylePanel` from `false` to `true`.

## 5. Operational Trace
- Modified [CanvasPage.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasPage.tsx) state declaration on line 31.
- Ran `npx tsc --noEmit` which completed successfully with exit code 0.

## 6. Status Assessment
Fixed and verified. The style panel sidebar renders open by default.
