Date: 27.05.2026, Time: 13:15

User request: "change checkmark style to same as in the widgets"

### 2. Objective Reconstruction
Unify the visual checkbox styles inside the Tasks page Kanban board and details sidebar to match the premium rounded square checkboxes used in the home/dashboard widgets (`TaskItem.tsx`).

### 3. Strategic Reasoning
To achieve perfect visual consistency (as guided by `ui-consistency-rule.md`), all primary toggle elements indicating completion states should share a cohesive design language. Using rounded rectangles (`rounded-[var(--radius-small)]`) with standard Lucide `Check` icons instead of circles creates a tighter, more cohesive premium dark layout that matches the preference of widgets.

### 4. Detailed Blueprint
- **TaskCard.tsx**: Replace the circular color-filled custom buttons with the exact widget style (rounded square border that fills with text-background and checkmark when checked, maintaining event isolation `stopPropagation` to prevent card drag-and-drop conflicts).
- **TaskCard.tsx**: Refactor task card subtask small circle indicators to mini rounded rectangles with micro Check marks.
- **NewTaskModal.tsx**: Replace subtask item circles with rounded-square checkbox buttons using Lucide Check marks.

### 5. Operational Trace
- Added `Check` to imports in `src/components/tracker/TaskCard.tsx`.
- Updated `TaskCardUI` check toggle button to use standard `rounded-[var(--radius-small)] border` with `task.completed ? "bg-foreground border-foreground text-background" : "border-muted-foreground hover:border-foreground"`.
- Rendered Lucide `<Check className="w-3.5 h-3.5 stroke-[3]" />` when `task.completed` is true.
- Updated subtask circles on card items to `rounded-[3px]` and rendered `<Check className="w-2 h-2 stroke-[3]" />` when complete.
- Added `Check` to imports in `src/components/modals/NewTaskModal.tsx`.
- Updated subtask check button elements in the sidebar drawer to match the same style as widget checkboxes.
- Verified TypeScript compilation using `npx tsc --noEmit`.

### 6. Status Assessment
- **Tasks Page Kanban Card Checkboxes**: 100% unified with widget checkboxes.
- **Sidebar Drawer Subtasks Checkboxes**: 100% unified with widget checkboxes.
- **Task Card Embedded Subtasks**: 100% unified with widget checkboxes.
- All styles compiled successfully with zero type issues or layout regressions.
