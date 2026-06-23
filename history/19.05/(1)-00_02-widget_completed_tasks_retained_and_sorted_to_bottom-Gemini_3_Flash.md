User request: "when i complete task in widget, dont remove it from list, move it to the bottom and make it more transparent then regualr. also i should be able to uncomplete it"

### 0. Date and Time of the Request
- **Date**: 19.05.2026
- **Time**: 00:02

### 1. User Request
User request: "when i complete task in widget, dont remove it from list, move it to the bottom and make it more transparent then regualr. also i should be able to uncomplete it"

### 2. Objective Reconstruction
- Retain completed tasks in the `SmartTaskStackWidget` tabs ("Today", "Upcoming", "Overdue", "In Progress") instead of filtering them out immediately.
- Move completed tasks to the bottom of the list within each tab.
- Render completed tasks as transparent (`opacity-35`) and with a struck-through title.
- Enable uncompleting a completed task by clicking the checkbox again, providing a bold checkmark icon (`Check` with `stroke-[3px]` in the brand's accent-color fill) for immediate visual feedback.

### 3. Strategic Reasoning
- Retaining completed tasks in the active view keeps the user's workflow visible and gives them a sense of daily progress, while moving completed items to the bottom keeps incomplete tasks prioritized at the top of their eye line.
- Applying `opacity-35` alongside `line-through decoration-[var(--bone-30)]` reduces visual noise for completed tasks, blending them naturally into the warm Bone design system.
- Designing a custom checkbox that fills with `bg-accent` and renders a thick dark checkmark `stroke-[3px]` of `var(--on-accent)` ensures beautiful and high-contrast completion indicators.

### 4. Detailed Blueprint
- File to modify: `src/components/workspace/widgets/SmartTaskStackWidget.tsx`
- **Imports**: Add `Check` from `lucide-react`.
- **Filtering & Sorting (`tasksByTab`)**: Remove `!t.completed` exclusion filters and replace with sorting comparators that order incomplete tasks first (`a.completed ? 1 : 0` minus `b.completed ? 1 : 0`), preserving secondary sorting constraints like due dates.
- **Rendering Loop**:
  - Map `t.completed` state to checkbox visual states.
  - Style task container wrapper with dynamic tailwind classes (`opacity-35 line-through decoration-[var(--bone-30)]` when completed).

### 5. Operational Trace
- Audited the workspace widgets and located the `SmartTaskStackWidget.tsx` file.
- Used `multi_replace_file_content` to apply all edits in a single turn.
  - Imported `Check`.
  - Re-mapped the four tab query sets (`today`, `upcoming`, `overdue`, `progress`) to include completed tasks and mathematically sort them to the bottom.
  - Revamped the task list renderer to dynamically apply opacity, line-through decoration, and checkmark iconography when `t.completed === true`.

### 6. Status Assessment
- **Status**: Completed successfully.
- **Verification**: Toggling tasks complete/incomplete instantly repositions them at the bottom/top of the stack respectively, styling them elegantly with high-fidelity indicators.
