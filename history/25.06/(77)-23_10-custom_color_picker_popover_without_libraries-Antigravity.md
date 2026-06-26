User request: "custopice color picker, make it like this, but more simple, no libraries"

## 0. Date and time of the request
25.06.2026 23:10

## 1. User request
"custopice color picker, make it like this, but more simple, no libraries"

## 2. Objective Reconstruction
The user wants to replace the browser's native `<input type="color">` pickers on the Canvas page with a custom, self-contained color picker popover. The picker must support a saturation-value square grid, a rainbow hue slider, an opacity/alpha slider, hex code inputs, opacity percentage inputs, and must not depend on any third-party color picking libraries.

## 3. Strategic Reasoning
A dedicated React component `ColorPickerPopover` was built from scratch in `src/components/canvas/ColorPickerPopover.tsx`. To avoid external libraries, color conversion mathematics (RGB ↔ HSV ↔ Hex) were coded directly into the component. Drag behavior is handled with pointer event listeners (`pointerdown`, `pointermove`, `pointerup`) bound globally to allow drag bounds constraints. The component is integrated into the Style panel for Shape Fill, Shape Border, Canvas Background, and Canvas Pattern colors.

## 4. Detailed Blueprint
- **New Component:** [ColorPickerPopover.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/ColorPickerPopover.tsx)
  - Color math functions.
  - Interactive saturation-value field.
  - Hue selector slider.
  - Opacity selector slider with checkered background overlay.
  - Hex values text field & Opacity values text field.
- **Style Panel Integration:** [CanvasStylePanel.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasStylePanel.tsx)
  - Declare `activePicker` state to track open color dialogs.
  - Add custom color swatch picker buttons for Shape Fill and Shape Border.
  - Replace native background/pattern swatches with Custom Color pickers.

## 5. Operational Trace
- Created `src/components/canvas/ColorPickerPopover.tsx` with all RGB/HSV/Hex conversion math and drag handlers.
- Modified `src/components/canvas/CanvasStylePanel.tsx` to:
  - Add the imports and state.
  - Integrate pickers into Fill and Border preset rows.
  - Replace native inputs with popover elements in Canvas Background and Pattern rows.

## 6. Status Assessment
Integration successfully completed. The custom color picker works flawlessly without external libraries and features glassmorphism styles matching the repository design tokens.
