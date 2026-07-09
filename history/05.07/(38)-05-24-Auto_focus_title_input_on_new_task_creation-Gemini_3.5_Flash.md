### 0. Date and time of the request
Date: 05.07.2026
Time: 05:24 (Start) - 05:24 (End)

### 1. User request
User request: "when i create new task i should be focused in task text area automatically so i can start typing"

### 2. Objective Reconstruction
- Configure the task inspector to automatically focus on the Task Title input field whenever a new task is created (i.e. when `activeTask` is undefined), enabling immediate keyboard input.

### 3. Strategic Reasoning
- Defined a `titleInputRef` to reference the DOM input node.
- Added a `useEffect` hook listening to `taskId` and `activeTask`. When opening the panel for a new task, the hook invokes `.focus()` on the reference node.

### 4. Detailed Blueprint
- `src/components/tracker/TaskInspectorPanel.tsx`:
  - Declare `titleInputRef`.
  - Add autofocus `useEffect` trigger block.
  - Pass the reference to the text input component.

### 5. Operational Trace
- Connected ref handles and lifecycle hooks inside `TaskInspectorPanel.tsx`.
- Verified TypeScript compilation.

### 6. Status Assessment
Completed successfully. Creating a new task now automatically focuses the Title input box.
