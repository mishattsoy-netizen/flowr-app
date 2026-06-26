User request: "color picker popup issnt always accurate. also keep color box highlighted when popup active"

### 0. Date and time of the request
- Date: 2026-06-26
- Time: 05:51

### 1. User request
"color picker popup issnt always accurate. also keep color box highlighted when popup active"

### 2. Objective Reconstruction
- Resolve coordination and precision errors in the floating canvas color picker popover.
- Allow typing/editing color hex codes smoothly without key-press rejection/flicker.
- Keep the corresponding color input swatch container highlighted (with active dark background and subtle border) in the `CanvasStylePanel` while its picker popover remains open.

### 3. Strategic Reasoning
- **Color Accuracy**: Rounded conversions between HSV and RGB/Hex caused coordinate snapping and color loss (e.g. hue snapped to 0 when saturation/value was 0). Normalizing hue mathematically in `hsvToRgb` and skipping state sync inside the `useEffect` when the normalized color strings are identical resolves this desync perfectly.
- **TextInput Usability**: The hex input was directly bound to parsed state, blocking keystrokes until exactly 6 characters were typed. Decoupling the input value into a local `inputValue` state resolves this and permits typing intermediate values, with an `onBlur` fallback.
- **Active Swatch Highlight**: Checked `activePicker` value against fill, stroke, background, and pattern, and conditionally replaced `border-transparent bg-[var(--bone-6)]` with `border-[var(--bone-30)] bg-[var(--app-dark)]` for visual feedback.

### 4. Detailed Blueprint
- **ColorPickerPopover.tsx**:
  - Normalize hue coordinates.
  - Implement standard color normalization.
  - Set up `inputValue` local state.
  - Bind input onChange/onBlur and triggerChange.
- **CanvasStylePanel.tsx**:
  - Apply active styles to Fill, Stroke, Background, and Pattern color wrapper divs when their picker is active.

### 5. Operational Trace
- Added `normalizeToHex` utility function to [ColorPickerPopover.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/ColorPickerPopover.tsx).
- Updated `hsvToRgb` to normalize hue within `[0, 360)`.
- Replaced `useEffect` synchronization logic to skip redundant updates if standard hex matches.
- Created `inputValue` text field state with custom validation handlers.
- Modified color container divs in [CanvasStylePanel.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasStylePanel.tsx) to render styling conditionally.

### 6. Status Assessment
- Features and UI tweaks compiled successfully with zero errors.
- Color selection and dragging are accurate and highly responsive.
- Swatches stay highlighted when active.
