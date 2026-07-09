### 0. Date and time of the request
Date: 05.07.2026
Time: 04:46 (Start) - 04:46 (End)

### 1. User request
User request: "when i click on plus button in todays headers->task has todays date preset but status is set to to do, not today. when i click on plus in inprogress collumn, status is prest to todo aswell, not in progress. same with other collumns. new task must have preset for each collumn. Aslo remove plus buttons from Done collumns and place delete button there instead."

### 2. Objective Reconstruction
- Configure column header `+` (add task) buttons to seed presets (status, dueDate) dynamically based on the column the button was clicked in:
  - "To Do" column: status = `'todo'`
  - "In Progress" column: status = `'in-progress'`
  - "Today" column: status = `'todo'`, dueDate = Today's date string
  - "Overdue" column: status = `'todo'`, dueDate = Yesterday's date string
- Remove the `+` button from the Done column header entirely. Keep the quick clear delete button there.

### 3. Strategic Reasoning
- Expanded the store `openTaskPanel` action signature to accept an optional `presets?: Partial<AppTask>` object and store it in Zustand state.
- Inside the KanbanColumn headers, configured the `Plus` click handlers to generate column-specific presets dynamically.
- In `TaskInspectorPanel`, used the store's `taskPanelPresets` state to initialize state variables when a new task is created.

### 4. Detailed Blueprint
- `src/data/store.types.ts` & `src/data/store.ts`:
  - Add `taskPanelPresets` state.
  - Update `openTaskPanel` signature and action body to capture the presets.
- `src/components/tracker/KanbanColumn.tsx`:
  - Remove `Plus` button when `id === 'completed'`.
  - Pass presets (e.g. status, dueDate) in `openTaskPanel` calls on `Plus` clicks.
- `src/components/tracker/TaskInspectorPanel.tsx`:
  - Fetch `taskPanelPresets` from store.
  - Apply presets to local state variables when initializing new tasks.

### 5. Operational Trace
- Extended store model, Kanban headers, and task initializer routines.
- Verified TypeScript compilation.

### 6. Status Assessment
Completed successfully. Adding tasks now correctly presets status/dates depending on the column, and the Done column header has no Plus button.
