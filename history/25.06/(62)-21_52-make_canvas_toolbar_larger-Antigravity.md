User request: "make toolbar a bit bigger"

### 0. Date and time
2026-06-25 at 21:52 (local time)

### 1. User Request
Increase the physical size of the floating canvas toolbar.

### 2. Objective Reconstruction
Enlarge the buttons, icons, padding, and height of the floating canvas toolbar to improve visibility and ease of interaction/clicking.

### 3. Strategic Reasoning
With the inner wrappers removed, scaling up the button sizes and icon sizes keeps the toolbar easy to use and looks visually balanced. We increased icon sizes to `w-4 h-4`, button sizes to `34px` width by `30px` height, extended separator height to `18px`, and added more spacing/padding to the outer container.

### 4. Detailed Blueprint
- `CanvasToolbar.tsx`:
  - Update `NAV_TOOLS`, `SHAPE_TOOLS`, and `CONTENT_TOOLS` Lucide icons from `w-3.5 h-3.5` to `w-4 h-4`.
  - Update `ToolGroup` buttons from `w-7 h-[26px]` to `w-[34px] h-[30px]`.
  - Update `VSep` separator height from `h-[14px] mx-[2px]` to `h-[18px] mx-[3px]`.
  - Update outer container padding, gap, and rounded corners to `p-[5px] gap-[4px] rounded-[11px]`.

### 5. Operational Trace
1. Updated Lucide icon sizes in tool lists in `CanvasToolbar.tsx`.
2. Changed button dimensions in `ToolGroup`.
3. Adjusted vertical separator heights in `VSep`.
4. Adjusted outer container class list on line 143.

### 6. Status Assessment
- Floating toolbar is now larger, with bigger buttons and icons, and has been successfully refactored.

*Agent used: `engineering-frontend-developer`*
