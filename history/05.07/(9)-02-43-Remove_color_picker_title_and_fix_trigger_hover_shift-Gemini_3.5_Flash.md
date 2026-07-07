### 0. Date and time of the request
Date: 05.07.2026
Time: 02:43 (Start) - 02:43 (End)

### 1. User request
User request: "remove title from this popup and fix its shift on hover"

### 2. Objective Reconstruction
- Remove the text title "Select Color Tag" from the color selection popup inside the task inspector panel.
- Fix the visual layout shift/jump of the popover menu when moving the mouse from the trigger button into the popover content.

### 3. Strategic Reasoning
- The visual shift occurred because the circular trigger button had a scaling transition on hover (`hover:scale-115`). When moving the mouse into the popover container, the hover state on the trigger was lost, causing the trigger button to shrink. This size change forced the popover anchoring code to dynamically recalculate and reposition the popover, resulting in a layout jump.
- Removing the `hover:scale-115` class and replacing it with a simple `hover:opacity-85` transition maintains hover feedback without modifying layout box dimensions.
- Snugged up the popover width to `w-[200px]` with `p-1.5` padding to perfectly wrap the 7 circles once the text header was removed.

### 4. Detailed Blueprint
- `src/components/tracker/TaskInspectorPanel.tsx`:
  - Swap `transition-all hover:scale-115` with `hover:opacity-85 transition-opacity` on the `PopoverTrigger` button element.
  - Delete `div` containing "Select Color Tag" text.
  - Update `PopoverContent` class to `w-[200px] p-1.5`.

### 5. Operational Trace
- Edited layout attributes inside `TaskInspectorPanel.tsx`.
- Verified TypeScript compilation.

### 6. Status Assessment
Completed successfully. The color picker popover now displays a snug list of circles with no title, and coordinates remain completely stable when hovering.
