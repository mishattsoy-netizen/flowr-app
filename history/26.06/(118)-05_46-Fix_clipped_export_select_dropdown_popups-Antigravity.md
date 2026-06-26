User request: "fix small popups"

## 0. Date and time of the request
Date: 26.06
Time: 05:46

## 1. User request
"fix small popups"

## 2. Objective Reconstruction
Fix text and checkmark clipping/squishing inside the small select dropdown popups under the "Scale / Ratio / Orient" columns in the style inspector's export panel.

## 3. Strategic Reasoning
- Previously, the `ExportSelect` dropdown popup set its width exactly equal to `posRef.current.width` (the width of the narrow trigger buttons, which range from 50px to 60px). Because of this narrow layout container, multi-character option text (like "Vertical") and inline selection checkmarks were compressed and truncated.
- Resolving this:
  - Enforced a minimum width of `100px` (`Math.max(100, posRef.current.width)`) on the select popup to guarantee sufficient padding and typography layout space.
  - Implemented an `align` property (`'left' | 'right'`) so right-aligned columns (like "Ratio" and "Orient") shift their popover leftward, aligning the popup's right edge exactly with the trigger button's right edge (avoiding out-of-bounds page overflows).
  - Appended the `canvas-floating-panel` class to the select portal content so they automatically inherit unified hover transitions.

## 4. Detailed Blueprint
- **Modify** [CanvasStylePanel.tsx](file:///c:/Users/misha/Documents/Dev\flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasStylePanel.tsx):
  - In `ExportSelect`, accept `align?: 'left' | 'right'`.
  - Update portal positioning to set `width: Math.max(100, posRef.current.width)`.
  - Update `left` calculation using the `align` prop to offset positions when right-aligned.
  - Add class `canvas-floating-panel` to the portal `div`.
  - In the inspector template, pass `align="right"` to "Ratio" and "Orient" selects.

## 5. Operational Trace
- Adjusted positioning calculations and properties inside `ExportSelect` implementation.
- Configured alignments for the Ratio and Orient export selectors.
- Checked project compilation using `npx tsc --noEmit`.

## 6. Status Assessment
- Dropdowns under the export section no longer clip or compress text labels.
- Layout remains aligned correctly.
- Compilation checks show zero errors.
