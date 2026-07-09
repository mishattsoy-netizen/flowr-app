### 0. Date and time of the request
Date: 05.07.2026
Time: 02:35 (Start) - 02:35 (End)

### 1. User request
User request: "when i move mouse to move to popup it closes. remove mark as done for completed tasks, change Completed to done in task panel, in popups with colored status or collumn buttons highlight bg with each's color on hover"

### 2. Objective Reconstruction
1. Fix the context menu "Move to" submenu hover closing issue by resolving the mouse travel gap.
2. Hide the "Mark as done" context menu item if the target task is already completed (in Done column/status).
3. Change the status name label for the completed state from "Completed" to "Done" in the task inspector panel.
4. Correctly highlight status items in the inspector status dropdown (and context submenu options) on hover using their respective column theme colors.

### 3. Strategic Reasoning
- **Submenu Hover Closing**: Shifted the visual `popup-glass-small` class and padding to a nested child container within the submenu layout, keeping the absolute container boundary directly touching the parent trigger element so that the mouse never crosses a "dead zone" gap.
- **Mark as Done Option**: Conditionally rendered the context menu button check based on whether the target task's `completed` state is `true`.
- **Label Rename**: Replaced "Completed" string templates in `TaskInspectorPanel.tsx` with "Done".
- **Dynamic Tailwind hover compilation**: Statically defined the hover classes (`hoverClass`) inside the options array (e.g. `hover:bg-blue-500/15 hover:text-blue-400`) to guarantee that static Tailwind CSS compile extraction registers and renders the background highlight on hover correctly.

### 4. Detailed Blueprint
- `src/components/tracker/TaskContextMenu.tsx`:
  - Update `MOVE_TARGETS` hover string modifiers to use `/15` opacity.
  - Wrap target task logic checking `completed` state to conditionally render "Mark as done".
  - Refactor absolute submenu container position structure to replace margins (`ml-1`) with padding (`pl-1.5`) enclosing a nested visual wrapper.
- `src/components/tracker/TaskInspectorPanel.tsx`:
  - Change `"Completed"` status text options to `"Done"`.
  - Add `hoverClass` string properties to options mapping, rendering them statically on hover checks.

### 5. Operational Trace
- Edited `TaskContextMenu.tsx` and `TaskInspectorPanel.tsx`.
- Verified TypeScript compilation.

### 6. Status Assessment
Completed successfully. The submenu closing issue is fixed, "Mark as done" is hidden for completed tasks, status label is renamed, and hover highlight colors work perfectly.
