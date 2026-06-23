User request: "make placeholders bone 30, task title, subtasks, description..."

### 0. Date and time of the request
- **Date**: 28 May 2026
- **Time**: 02:58 local time

### 1. User request
`User request: "make placeholders bone 30, task title, subtasks, description..."`

### 2. Objective Reconstruction
Standardize the placeholder colors in the task creation and editing modal (`NewTaskModal.tsx`) to consistently use the bone-30 aesthetic (`--bone-30`) for the "Task Title...", "Write description or notes...", and "Add new subtask..." fields.

### 3. Strategic Reasoning
- **Aesthetic Harmony**: Previously, the task title and description fields were using a darker `--bone-20` value (`placeholder-[var(--bone-20)]`), while the subtask input utilized `--bone-30`. Adjusting all field placeholders to leverage `--bone-30` aligns their visual weight, ensuring they are perfectly legible yet secondary to active values, matching the premium bone design guidelines.

### 4. Detailed Blueprint
- **Files Involved**:
  - `src/components/modals/NewTaskModal.tsx`
- **Class Swaps**:
  - Change `placeholder-[var(--bone-20)]` to `placeholder-[var(--bone-30)]` inside the Task Title `<input className={...}>` configuration.
  - Change `placeholder-[var(--bone-20)]` to `placeholder-[var(--bone-30)]` inside the Description `<textarea className={...}>` configuration.
  - Keep the existing `placeholder-[var(--bone-30)]` setup on the Subtasks composer input.

### 5. Operational Trace
- **Code Modification**:
  - Replaced the Tailwind helper placeholder configurations inside `NewTaskModal.tsx`.
- **Type Checking**: Validated changes using `npx tsc --noEmit` and confirmed compilation completes successfully with 0 errors.

### 6. Status Assessment
- **Status**: 100% Completed.
- **Next Recommendation**: None — all input placeholders inside the task modal now share the unified bone-30 look.
