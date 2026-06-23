User request: "add no color color(default)"

# History Report: Add Default "No Color" Tag Option

### 0. Date and Time of the Request
- Date: May 27, 2026
- Completion Time: 1:06 PM

### 1. User Request
User request: "add no color color(default)"

### 2. Objective Reconstruction
- Add a "default / no color" option to the task details sidebar drawer's Color Tag row.
- Render the default option as a premium dashed circle with a neutral inner dot.
- Default new tasks to have no color (`''`) by default, rather than defaulting to the first color (Red).
- Fallback existing tasks that do not have custom color tag assignments cleanly to default transparent states.

### 3. Strategic Reasoning
- Previously, task color default values defaulted to `COLORS[0]` (Red), forcing all tasks to have a high-contrast red category.
- Introducing a "no color" option represented by `''` (empty string) allows tasks to render cleanly without custom colored tag indicators, falling back to the workspace's default accent theme.
- A dashed circular button is standard for representing empty or transparent selections.

### 4. Detailed Blueprint
- **`src/components/modals/NewTaskModal.tsx`**:
  - Initialize color state to `''` instead of `COLORS[0]`.
  - Check fallback in `activeTask` loader: `setColor(activeTask.color || '');`.
  - Add a dashed button `Default (No Color)` inside the properties color tags list, toggling color state to `''` when selected.

### 5. Operational Trace
1. **Refactored Color Tag State & Render**:
   - Initialized `color` state to `''` on creation.
   - Inserted the new dashed circular button inside the properties grid in `NewTaskModal.tsx`.
2. **Type Checking Verification**:
   - Ran `npx tsc --noEmit` and confirmed compiling is 100% clean.

### 6. Status Assessment
- **Status**: Completed. The "Color Tag" row now features a premium default dashed option, allowing users to unset custom color categories. New tasks now start without color tag values by default.
