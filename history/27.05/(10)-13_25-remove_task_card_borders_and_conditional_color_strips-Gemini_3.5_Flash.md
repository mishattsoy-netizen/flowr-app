Date: 27.05.2026, Time: 13:25

User request: "remove color strip if task color not selected. remove tasks borders"

### 2. Objective Reconstruction
1. Remove the left decorative color strip on task cards when no custom category tag color has been selected for the task (rather than falling back to an orange/amber default accent strip).
2. Remove the outer borders from task cards on the Kanban board to create a flatter, cleaner, and more premium borderless design.

### 3. Strategic Reasoning
- **Aesthetic Refinement**: Removing task card borders reduces visual noise and matches the design direction of a premium, flat user interface.
- **Strict Color Semantics**: The decorative left bar should only represent user-defined categorization color tags. If a user chooses "no color" (the transparent option), displaying an accent bar is a logical bug and distracts the user. Rendering it conditionally solves this cleanly.

### 4. Detailed Blueprint
- **TaskCard.tsx**:
  - Remove `border border-[var(--bone-6)]` from `TaskCardUI` outer layout wrapper.
  - Refactor the decorative side strip divider block to render conditionally: `{task.color && <div className="..." style={{ backgroundColor: task.completed ? 'var(--bone-20)' : task.color }} />}`.

### 5. Operational Trace
- Stripped outer borders `border border-[var(--bone-6)]` from the card layout classes in `src/components/tracker/TaskCard.tsx`.
- Changed left vertical accent bar to render conditionally *only* when `task.color` is present.
- Ran type-checks using `npx tsc --noEmit` and verified 0 warnings/errors.

### 6. Status Assessment
- **Borderless Cards**: Completed. Task cards display borderlessly and naturally in their column boards.
- **Conditional Indicator Bar**: Completed. Color strip is hidden for default uncolored tasks, and renders correctly for colored cards.
