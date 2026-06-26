User request: "i dont like all upercase"

## 0. Date and time of the request
25.06.2026 23:20

## 1. User request
"i dont like all upercase"

## 2. Objective Reconstruction
Refactor all-uppercase texts ("DEFAULT" and "TRANSP") and style components inside the canvas Style Panel and Color Picker Popover to use mixed-case/title-case ("Default", "Transparent", "Reset"), only transforming hex codes dynamically to uppercase for design consistency.

## 3. Strategic Reasoning
Forcing uppercase on words like "DEFAULT" or "TRANSP" makes the UI look loud and inconsistent with the premium, minimalist bone design tokens. We change these text values to title-case ("Default", "Transparent") and refactor the CSS class inputs to apply `uppercase` conditionally via `cn()` only when rendering hex values (e.g. `canvasBgColor !== 'default'` or `color !== 'transparent'`). We also remove `uppercase tracking-wider` styles from the "Reset" action buttons to make them softer.

## 4. Detailed Blueprint
- **CanvasStylePanel.tsx:**
  - Change background/pattern default input value from `'DEFAULT'` to `'Default'`.
  - Apply `uppercase` class conditionally to color inputs based on whether the color is default.
  - Modify `Reset` action button style to remove uppercase text transformation and letter spacing.
- **ColorPickerPopover.tsx:**
  - Change transparent input value from `'TRANSP'` to `'Transparent'`.
  - Support case-insensitive `"transparent"` or `"transp"` matching in text fields.
  - Apply `uppercase` class conditionally to the text field only when color is not `"transparent"`.

## 5. Operational Trace
- Modified [CanvasStylePanel.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasStylePanel.tsx) to update `Reset` button styles and `Default` text inputs.
- Modified [ColorPickerPopover.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/ColorPickerPopover.tsx) to format transparent values and conditional class inputs.
- Ran `npx tsc --noEmit` which completed successfully with exit code 0.

## 6. Status Assessment
Fixed and verified. Uppercase forcing is removed from all placeholder/default text states and buttons, while retaining proper uppercase rendering for raw hex colors.
