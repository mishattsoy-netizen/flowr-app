### 0. Date and Time of the Request
*   **Date:** June 26, 2026
*   **Time:** 04:47 AM (Local Time)

### 1. User Request
User request: "fix popups in canvas, they dont have vertical gaps, inconsistant text position, ideally if you made them a bit more compact and all same sizing"

### 2. Objective Reconstruction
Standardize and fix the styling of canvas popovers/dropdowns in the right sidebar. Specifically:
1. Introduce vertical gaps between dropdown list options.
2. Fix text alignment issues and align the option checkmarks to the right.
3. Make dropdown popups compact (reducing vertical size and padding to fit trigger buttons).
4. Standardize the popup sizing (uniform widths) instead of squeezing them into parent button widths, and align them properly (auto-overflow check for right screen edge).

### 3. Strategic Reasoning
*   The default `popup-item` utility class is optimized for larger context menus (`text-[13.5px]` and high padding). For canvas panels, matching the compact `h-7` trigger buttons and `text-[11px]` font size is essential.
*   By setting custom styles for items directly inside `ExportSelect` and `ArrowheadDropdown`, we override standard `popup-item` values for canvas panels without breaking global menus.
*   By specifying `flex flex-col gap-0.5` on `popup-glass-small` containers, we introduce consistent vertical spacing.
*   Adding `align="right"` to the end-arrowhead dropdown absolute container and implementing an auto-overflow horizontal alignment calculation in `ExportSelect` prevents dropdown menus from clipping the screen boundaries.

### 4. Detailed Blueprint
*   Modify `ExportSelect` in [CanvasStylePanel.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasStylePanel.tsx):
    *   Set fixed `popupWidth = 110`.
    *   Check for window width overflow to determine left position.
    *   Change popup options list to use `flex flex-col gap-0.5`.
    *   Update button classes to use compact `h-7 px-2.5 text-[11px] text-left justify-between` layout.
*   Modify `ArrowheadDropdown` in [CanvasStylePanel.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasStylePanel.tsx):
    *   Add `align` prop ('left' | 'right') to specify absolute alignment.
    *   Set fixed popup width `w-[125px]` and `flex flex-col gap-0.5`.
    *   Apply identical compact button styles.
*   Modify `CanvasStylePanel` render usages:
    *   Pass `align="right"` to the `End` arrowhead selector.
*   Modify `MediaUploadPopover.tsx` button wrapper to add `gap-0.5` inside `flex flex-col` for visual consistency.

### 5. Operational Trace
*   Modified [CanvasStylePanel.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasStylePanel.tsx) to restructure `ExportSelect` and `ArrowheadDropdown` items and wrappers.
*   Modified [MediaUploadPopover.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/MediaUploadPopover.tsx) to add `gap-0.5` inside `mode === 'menu'` flex-col button lists.
*   Ran type safety check using `npx tsc --noEmit` and verified successful compilation.

### 6. Status Assessment
*   Popups vertical gaps added.
*   Text positions and checkmark alignments made consistent and left/right-justified.
*   Sizing standardized: Export dropdowns set to `110px` width; arrowhead dropdowns set to `125px` width (with start/end left/right alignment).
*   All tests/compilation passing cleanly.
