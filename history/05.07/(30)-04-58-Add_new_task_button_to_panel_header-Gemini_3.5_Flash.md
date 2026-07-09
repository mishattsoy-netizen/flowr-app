### 0. Date and time of the request
Date: 05.07.2026
Time: 04:58 (Start) - 04:58 (End)

### 1. User request
User request: "add this button next to the close button that opens new task(and saves current one if not empty)"

### 2. Objective Reconstruction
- Add a new task button (represented by the `SquarePen` edit icon) next to the close button in the task inspector panel's header.
- Configure the button to generate a new task ID and load it in the inspector panel instantly.
- Ensure that the current task being viewed is safely saved (which is handled natively by our real-time auto-saving synchronization engine).

### 3. Strategic Reasoning
- The auto-saving hook ensures that any typed text is already fully saved on keypress.
- Adding a button that invokes `openTaskPanel(generateId())` lets users rapidly chain task creations directly from the sidebar panel without exiting to the Kanban board first.

### 4. Detailed Blueprint
- `src/components/tracker/TaskInspectorPanel.tsx`:
  - Import `SquarePen` from `lucide-react`.
  - Fetch `openTaskPanel` from Zustand.
  - Insert a new `<button>` immediately to the left of the close button. On click, it generates a new UUID via `generateId()` and triggers `openTaskPanel(newTaskId)`.

### 5. Operational Trace
- Added the header button trigger and icon dependencies.
- Verified TypeScript compilation.

### 6. Status Assessment
Completed successfully. The header now features the new task creation button and behaves exactly as requested.
