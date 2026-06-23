Date: 27.05.2026, Time: 13:36

User request: "tasks are not centered with the checkbox"

### 2. Objective Reconstruction
Resolve a vertical alignment layout mismatch on Kanban task cards where main task titles and nested subtask texts did not align vertically on the center axis of their corresponding checkbox buttons.

### 3. Strategic Reasoning
- **Visual Precision**: In a dark, clean, borderless premium layout, tiny misalignment bugs (such as a checkbox sitting slightly higher or lower than its text label) break standard visual grids.
- **Axis Centering**:
  - Main Title: Transitioning the flex row to `items-center` and removing the top margin offset from the button centers single-line titles flawlessly.
  - Subtask Items: Subtasks are short text elements. Declaring `leading-none` on the `span` and wrapping in `items-center` flex containers locks the text exactly onto the center line of the checkbox, maintaining visual symmetry.

### 4. Detailed Blueprint
- **TaskCard.tsx**:
  - Change main title flex row class from `items-start` to `items-center`.
  - Remove `mt-0.5` class from the main checkbox button.
  - Add `leading-none` class to the subtask `span` element to center it exactly.

### 5. Operational Trace
- Modified the title container flex alignment inside `src/components/tracker/TaskCard.tsx`.
- Removed vertical margins on check buttons.
- Injected typography baseline centering overrides (`leading-none`) in the subtask list loops.
- Checked compiler soundness via `npx tsc --noEmit` and confirmed 0 compilation errors.

### 6. Status Assessment
- **Main Task Title Alignment**: Centered vertically with its checkbox.
- **Subtask Item Alignment**: Centered vertically with its checkbox.
- Code is fully sound and operational.
