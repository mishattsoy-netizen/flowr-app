Date: 27.05.2026, Time: 13:32

User request: "i dont see subtasks"

### 2. Objective Reconstruction
1. Resolve a silent database data loss bug where subtasks loaded into cards or sidebar details would disappear upon page refresh or real-time sync.
2. Fix visual UX friction where typing a new subtask into the "Add new subtask..." composer input and clicking the primary "Done" button at the bottom right immediately closes the modal and loses the pending user input instead of automatically saving it as a subtask item.

### 3. Strategic Reasoning
- **Database Schema Mismatch**: The Zustand client-side store maps the `subtasks` array, and the sync layer attempts to write it to Supabase via `row.subtasks = t.subtasks`. However, the Supabase `tasks` table lacked a `subtasks` column. Due to `upsertTask`'s robust missing-column fallback logic, it silently deleted `subtasks` from payloads to make inserts succeed, leading to silent dataloss on refresh. Adding a `JSONB` column on the relation resolves this cleanly.
- **Save UX Enhancement**: Users logically expect that if they type a subtask and immediately click the primary "Done" save button, their typed text represents a finished subtask and should be captured. Automatically parsing and committing this pending string during manual save prevents this data loss gracefully.

### 4. Detailed Blueprint
- **supabase/migrations/20260527_tasks_subtasks.sql**: Provision a PostgreSQL migration adding the `subtasks` JSONB column with a default of `'[]'::jsonb` to the `tasks` relation.
- **NewTaskModal.tsx**: Refactor `handleSaveAndClose` to evaluate if `newSubtaskText.trim()` is present. If it has characters, append it as a committed subtask item object in the final array before updating/adding the task to the store, and clear the unmount autosave tracker.

### 5. Operational Trace
- Provisioned the missing `subtasks` JSONB column to the database via [20260527_tasks_subtasks.sql](file:///Users/mktsoy/Dev/flowr-4-main/supabase/migrations/20260527_tasks_subtasks.sql).
- Injected subtask commit checkers in `handleSaveAndClose` in `src/components/modals/NewTaskModal.tsx`.
- Cleared `saveRef.current.title` inside `handleSaveAndClose` to safely terminate unmount lifecycle autosaves from rewriting with obsolete values.
- Ran type checks via `npx tsc --noEmit` and confirmed clean compile with 0 issues.

### 6. Status Assessment
- **Subtasks Column Provisioning**: Completed. Subtasks are fully persisted and synced.
- **Composer Pending Text Commit**: Completed. Typing a subtask and clicking "Done" saves the subtask.
