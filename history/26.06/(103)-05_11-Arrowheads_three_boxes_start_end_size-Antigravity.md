User request: "make this section out of 3 boxes 1 size, start, end"

### 0. Date and time of the request
Date: 26.06.2026
Time: 05:11

### 1. User request
"make this section out of 3 boxes 1 size, start, end"

### 2. Objective Reconstruction
Restructure the "Arrowheads" control section in the canvas style sidebar to display as a single row containing three equal-width boxes: `Start` arrowhead type, `End` arrowhead type, and arrowhead `Size`.

### 3. Strategic Reasoning
- The user requested organizing the Arrowheads configuration controls into three equal-width boxes.
- By placing `Start`, `End`, and `Size` side by side, we save vertical panel height and maintain design system consistency.
- Reused the standard `SidebarInput` for the arrowhead `Size` box, complete with text parsing, pointer scrubbing/dragging support, and a resizing icon prefix.

### 4. Detailed Blueprint
- Modify `src/components/canvas/CanvasStylePanel.tsx`:
  - Locate the "Arrowheads" `PanelSection`.
  - Replace the separate top row (Start and End) and bottom row (Size range slider) with a single horizontal flex layout containing three boxes: Start (ArrowheadDropdown), End (ArrowheadDropdown), and Size (SidebarInput).

### 5. Operational Trace
- Replaced the inner contents of the Arrowheads `PanelSection` inside `src/components/canvas/CanvasStylePanel.tsx`.
- Ran compiler checks via `npx tsc --noEmit` which succeeded with no errors.

### 6. Status Assessment
- Successfully unified Start, End, and Size into three equal-width boxes in the canvas style sidebar.
- Arrowhead size now has drag-scrubbing support via `SidebarInput`.
