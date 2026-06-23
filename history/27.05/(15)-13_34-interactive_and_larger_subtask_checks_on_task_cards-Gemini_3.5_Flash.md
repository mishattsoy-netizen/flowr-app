Date: 27.05.2026, Time: 13:34

User request: "mkae subbtasks a bit bigger and alco checkable"

### 2. Objective Reconstruction
1. Increase the visual scale of subtasks listed on the Kanban task cards: make text larger (`text-[11px]` with medium weight) and checkbox containers larger (`w-3.5 h-3.5`).
2. Make subtask items listed on Kanban cards interactive and fully checkable directly on the board cards, allowing users to toggle subtask completion states without opening the task sidebar drawer.

### 3. Strategic Reasoning
- **Subtask Interactive Value**: Enabling inline subtask checking directly on task cards provides outstanding convenience. Users can complete sub-steps in one click rather than sliding open the details drawer, updating, and closing, which increases app feel and speed.
- **Visual Scale Balance**: Toggling items requires a comfortable target click width. Upgrading checkboxes to `w-3.5 h-3.5` (14px) and subtask text to `text-[11px]` improves ergonomics while maintaining layout balance.
- **Strict Pointer Isolation**: Standardizing drag-prevention parameter blocks (`stopPropagation()`) on click and pointer down handlers is essential to keep column card drag-and-drop operations smooth and error-free when interacting with subtasks.

### 4. Detailed Blueprint
- **TaskCard.tsx**:
  - Destructure `updateTask` from Zustand `useStore()`.
  - Declare a `handleToggleSubtask(subId)` helper inside `TaskCardUI` which maps `subtasks` changes and calls `updateTask(task.id, { subtasks: nextSubtasks })`.
  - Replace subtasks map list rendering wrapper elements: change static subtask checkbox `div` indicators into interactive `<button>` elements, implementing `onClick` pointer togglers.
  - Scale subtask layout margins, font sizes, and check boxes up.

### 5. Operational Trace
- Added `updateTask` to `useStore()` destructuring in `src/components/tracker/TaskCard.tsx`.
- Declared state mapper `handleToggleSubtask` to execute reactive mutations inside `TaskCardUI`.
- Changed subtask item list rows from static wrappers to custom button components with isolated pointer triggers.
- Styled subtask checks up to `w-3.5 h-3.5` and subtask labels up to `text-[11px] font-medium text-[var(--bone-80)]`.
- Verified TypeScript compilation using `npx tsc --noEmit` and confirmed 0 errors.

### 6. Status Assessment
- **Larger Subtasks**: Completed. Displayed in highly readable sizes.
- **Checkable Subtasks on Cards**: Completed. Clicking a subtask checkbox on the board card instantly checks it off and persists state changes reactively.
