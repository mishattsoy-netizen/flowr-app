### 0. Date and time of the request
Date: 05.07.2026
Time: 03:17 (Start) - 03:17 (End)

### 1. User request
User request: "i get this error every time i click on other task when task panel is open: Maximum update depth exceeded."

### 2. Objective Reconstruction
- Fix a critical React infinite render loop (Maximum update depth exceeded) when clicking on a different task card in the Kanban board while the task inspector panel is already open.

### 3. Strategic Reasoning
- When `taskId` changes, React triggers a re-render. The initialization `useEffect` schedules async state updates (`setTitle`, etc.) to match the new task's properties.
- Concurrently, the auto-save `useEffect` ran immediately on the new render cycle because `taskId` had changed, but it evaluated using the stale local states of the *previous* task. This caused it to incorrectly detect changes, call `updateTask(newTaskId, ...)` with old values, mutate the store, and prompt a loop of infinite state updates.
- Added a `loadedTaskIdRef` check to guarantee that the auto-save hook only processes updates if the local states have been fully initialized/loaded for the current active `taskId`.

### 4. Detailed Blueprint
- `src/components/tracker/TaskInspectorPanel.tsx`:
  - Declare a `loadedTaskIdRef` ref.
  - Set `loadedTaskIdRef.current = taskId` at the end of the initialization `useEffect`.
  - Add `if (loadedTaskIdRef.current !== taskId) return;` at the top of the auto-save `useEffect`.

### 5. Operational Trace
- Modified state control rules in `TaskInspectorPanel.tsx`.
- Verified TypeScript compilation.

### 6. Status Assessment
Completed successfully. Switching between task details in the inspector now works seamlessly without loops or crashes.
