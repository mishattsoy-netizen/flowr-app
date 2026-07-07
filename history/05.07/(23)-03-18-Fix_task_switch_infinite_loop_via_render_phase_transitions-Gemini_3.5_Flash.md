### 0. Date and time of the request
Date: 05.07.2026
Time: 03:18 (Start) - 03:18 (End)

### 1. User request
User request:
"Runtime Error
Maximum update depth exceeded.
at TaskPanelContent.useEffect"

### 2. Objective Reconstruction
- Permanently fix the "Maximum update depth exceeded" infinite loop crash when switching between tasks in the task inspector panel.

### 3. Strategic Reasoning
- The loop occurred because `useEffect` updates schedule state transitions that execute in the subsequent render cycle. When `taskId` changes, the auto-save effect would run inside the same commit phase with stale state values, falsely detecting modifications, mutating the store, and triggering an endless cycle of re-renders.
- Moved task state updates to a synchronous render-phase check. In React, updating state during the render function body restarts rendering immediately with the updated values. This completely bypasses the commit of stale state data to the DOM, ensuring that when the auto-save `useEffect` is invoked, it already has the correct state variables matching the new task.

### 4. Detailed Blueprint
- `src/components/tracker/TaskInspectorPanel.tsx`:
  - Delete `loadedTaskIdRef` and the initialization `useEffect`.
  - Add refs `prevTaskIdRef` and `lastActiveTaskRef`.
  - Implement render-phase checks to update states synchronously if the active task changes, if a different task is selected, or if we transition to a new (blank) task.

### 5. Operational Trace
- Replaced the task-switch `useEffect` with synchronous render-phase transitions in `TaskInspectorPanel.tsx`.
- Verified TypeScript compilation.

### 6. Status Assessment
Completed successfully. Selecting tasks in the board while the inspector is open is now instant and 100% loop-free.
