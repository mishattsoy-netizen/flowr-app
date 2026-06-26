User request: "make only this popup wider, but scale and ratio less wide"

## 0. Date and time of the request
Date: 26.06
Time: 05:50

## 1. User request
"make only this popup wider, but scale and ratio less wide"

## 2. Objective Reconstruction
Modify the select dropdown menus in the export preview section so that only the "Orient" dropdown menu is wider (`120px` to comfortably display labels like "Horizontal" and "Vertical" along with selection checks), while the "Scale" and "Ratio" select dropdown menus remain narrow (matching their trigger button widths).

## 3. Strategic Reasoning
- The general `ExportSelect` was previously updated with a default minimum width of `100px` to fix text clipping across all columns. However, this made the "Scale" and "Ratio" dropdowns unnecessarily wide relative to their triggers.
- To resolve this, supported a configurable `popupWidth` parameter in `ExportSelect` props:
  - If `popupWidth` is omitted, the dropdown width defaults to the trigger button's bounding client width (`posRef.current.width`), which is perfect for the short text values in "Scale" and "Ratio".
  - If `popupWidth` is explicitly passed (e.g. `120` for Orient), it renders at that exact width and uses right-alignment to float beautifully alongside the style panel border.

## 4. Detailed Blueprint
- **Modify** [CanvasStylePanel.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasStylePanel.tsx):
  - In `ExportSelect` props signature, add optional `popupWidth?: number` prop.
  - Set `const width = popupWidth ?? posRef.current.width;`.
  - Replace the fixed `Math.max(100, ...)` logic in both the `left` calculation and `width` styling in the portal dropdown menu with the dynamic `width` variable.
  - Pass `popupWidth={120}` to the Orient `ExportSelect` component.

## 5. Operational Trace
- Added the customizable width configuration parameters inside `ExportSelect`.
- Updated the Orient dropdown call with a width parameter of `120`.
- Verified the build succeeded cleanly with `npx tsc --noEmit`.

## 6. Status Assessment
- Scale and Ratio dropdowns are narrow again, matching their parent inputs.
- Orient dropdown is wider, rendering "Horizontal" and checkmarks cleanly without clipping.
- Compilation checks succeeded with no issues.
