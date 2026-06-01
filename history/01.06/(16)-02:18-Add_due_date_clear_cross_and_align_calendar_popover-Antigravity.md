# Request History Report: Add Due Date Clear Cross and Align Calendar Popover

### 0. Date and time of the request
Date: June 1, 2026
Time: 02:18 AM

### 1. User request
User request: "instead of calendar icon show cross to remove due date. change calendar popup puter corners to smae as in other popups like todo or workspace"

### 2. Objective Reconstruction
The goal is to enhance the usability and design of the task due date picker:
1. **Due Date Removal**: Replace the calendar icon on the right side of the due date button with a clickable cross `x` icon when a due date is selected. Clicking this cross should immediately clear the due date from the task without opening the calendar.
2. **Popover Aesthetics**: Align the calendar's popover menu wrapper corners and styling with other popovers on the page (like Workspace and Todo Sort menus), using premium `rounded-[12px]`, `border-[var(--bone-6)]` border, shadow, and backdrop-blur styling.

### 3. Strategic Reasoning
- **Interaction Logic**: Implemented the clear cross `x` button inside the `Button` element of `DatePickerTime`, using `e.stopPropagation(); e.preventDefault();` to prevent the click from opening the popover trigger. When no date is set, it still shows the standard calendar icon as an action signifier.
- **Visual Alignment**: Unified the `PopoverContent` classes in `date-time-picker.tsx` with those of `NewTaskModal.tsx` and `KanbanColumn.tsx`, applying a complete glassmorphism preset: `bg-panel border border-[var(--bone-6)] shadow-2xl rounded-[12px] backdrop-blur-3xl z-[202]`.

### 4. Detailed Blueprint
- **[MODIFY] [date-time-picker.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/ui/date-time-picker.tsx)**:
  - Import `X` from `'lucide-react'`.
  - In `DatePickerTime`, check if `activeDate` is set. If yes, render a clickable cross `x` button (`X` icon with click-propagation stopped that resets `handleSelect(undefined)`). Otherwise, show the default `CalendarIcon`.
  - Style `PopoverContent` for the calendar picker with: `bg-panel border border-[var(--bone-6)] shadow-2xl rounded-[12px] backdrop-blur-3xl z-[202]`.

### 5. Operational Trace
- **Step 1**: Modified `src/components/ui/date-time-picker.tsx` using multi-line replacements to import the `X` icon, implement the conditional click-to-clear cross, and apply premium glassmorphism popover styling.
- **Step 2**: Ran `npx tsc --noEmit` and confirmed that the build passes perfectly with zero errors or warnings.

### 6. Status Assessment
- **Completed**: Due date clearing is now effortless and semantic via the cross icon, and the calendar popover perfectly matches other app popovers with standard visual design and `rounded-[12px]` corners.
- **Verification**: Compilation completed successfully.
