### 0. Date and time of the request
Date: 05.07.2026
Time: 03:01 (Start) - 03:01 (End)

### 1. User request
User request: "change done to save"

### 2. Objective Reconstruction
- Rename the button label from "Done" to "Save" in the task inspector panel footer.

### 3. Strategic Reasoning
- The rename aligns better with the user's intent to save edits to the task, differentiating it from the sibling "Mark as done" action button.

### 4. Detailed Blueprint
- `src/components/tracker/TaskInspectorPanel.tsx`: Change label inside the primary action button to "Save".

### 5. Operational Trace
- Replaced text "Done" with "Save" inside `TaskInspectorPanel.tsx`.
- Verified TypeScript compilation.

### 6. Status Assessment
Completed successfully. The primary save button is now labeled "Save".
