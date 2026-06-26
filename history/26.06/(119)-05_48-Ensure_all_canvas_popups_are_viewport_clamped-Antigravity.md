User request: "make sure all popups are always visible and can go bewond screen's visible area"

## 0. Date and time of the request
Date: 26.06
Time: 05:48

## 1. User request
"make sure all popups are always visible and can go bewond screen's visible area"

## 2. Objective Reconstruction
Modify all popup menus, modals, and toolbars (specifically `ColorPickerPopover`, `MediaUploadPopover`, `ExportSelect` dropdown, `ArrowheadDropdown` dropdown, and `CanvasTextToolbar`) to render in a React Portal or fixed layouts, allowing them to freely extend outside the boundaries of their parent containers (e.g. style panel) while clamping their coordinates to remain fully visible within the browser viewport (screen's visible area).

## 3. Strategic Reasoning
- Previously, some popups (like `ColorPickerPopover`) were rendered directly inside the Style Panel container, which caused positioning issues. Other popups were positioned without screen edge checks, which could push them off-screen.
- To resolve this:
  - Wrapped `ColorPickerPopover` inside a React Portal (`createPortal(..., document.body)`) and changed its layout context to `fixed`. Calculated its position dynamically relative to the Style Panel's client rect, clamping it to the viewport height.
  - Implemented automatic viewport bounds checking inside `MediaUploadPopover` and `CanvasTextToolbar` so they measure themselves on mount and clamp their `left` and `top` properties to stay inside screen edges (additionally, the text toolbar flips below the text block if there is no vertical space above).
  - Added smart flip-upwards calculations inside `ArrowheadDropdown` and `ExportSelect` dropdown portals, detecting if the menu would clip at the bottom of the screen and positioning them above their trigger buttons.

## 4. Detailed Blueprint
- **Modify** [ColorPickerPopover.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/ColorPickerPopover.tsx):
  - Change position class to `fixed`.
  - Wrap JSX in `createPortal(..., document.body)`.
- **Modify** [CanvasStylePanel.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasStylePanel.tsx):
  - Replace `pickerTop` state with `pickerPos` coordinate state.
  - In `togglePicker`, calculate screen-space `fixed` coordinates and clamp `top` to keep it within the viewport height.
  - In `ExportSelect` and `ArrowheadDropdown` dropdown portals, calculate height dynamically and flip the top offset upwards if it exceeds `window.innerHeight`.
- **Modify** [MediaUploadPopover.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/MediaUploadPopover.tsx):
  - Add `coords` state and clamp coordinates on mount/render using window size.
- **Modify** [CanvasTextToolbar.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasTextToolbar.tsx):
  - Add `coords` state and implement boundary checks on client rect, positioning the toolbar below the text block if it overflows the top edge.

## 5. Operational Trace
- Replaced position bindings and coordinate calculations inside the respective components.
- Fixed TypeScript signature interface constraints.
- Verified compilation and build checks pass cleanly.

## 6. Status Assessment
- Viewport boundary clamping is successfully implemented on all canvas popups.
- Portals ensure no parent container (like the Style Panel) clip dropdown menus or overlays.
- Compilation checks succeeded with zero issues.
