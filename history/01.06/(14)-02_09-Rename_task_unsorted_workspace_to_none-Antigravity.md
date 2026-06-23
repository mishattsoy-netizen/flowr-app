# Request History Report: Rename Task Unsorted Workspace to None

### 0. Date and time of the request
Date: June 1, 2026
Time: 02:09 AM

### 1. User request
User request: "rename unsorted to None"

### 2. Objective Reconstruction
The goal is to rename the default option and selection label for task workspace mapping inside the task creation/editing modal (`NewTaskModal.tsx`) from "Unsorted" to "None", making it clear and intuitive when a task has no workspace assigned.

### 3. Strategic Reasoning
- **Clarity and Ergonomics**: Inside the task modal, the workspace picker lists workspaces. If a task has no workspace assigned, showing "None" is standard industry naming and avoids confusing the user with the "Unsorted" section of the sidebar which relates to files and documents rather than task entities.

### 4. Detailed Blueprint
- **[MODIFY] [NewTaskModal.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/modals/NewTaskModal.tsx)**:
  - Rename the default label text inside `<span className="font-normal">Unsorted</span>` to "None".
  - Rename the default menu button item option inside the dropdown popover from "Unsorted" to "None".

### 5. Operational Trace
- **Step 1**: Modified `src/components/modals/NewTaskModal.tsx` to replace both user-facing occurrences of "Unsorted" with "None".
- **Step 2**: Ran `npx tsc --noEmit` and confirmed that the build passes perfectly with zero errors or warnings.

### 6. Status Assessment
- **Completed**: The task workspace selector now correctly and cleanly displays "None" instead of "Unsorted".
- **Verification**: Compilation completed successfully.
