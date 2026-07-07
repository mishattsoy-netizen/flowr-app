### 0. Date and time of the request
Date: 05.07.2026
Time: 04:55 (Start) - 04:55 (End)

### 1. User request
User request: "remove this assigned worksapce placeholder, its apears automatically, if task isnt assigned to any workspace show none"

### 2. Objective Reconstruction
- Resolve a visual display issue in the task inspector panel's workspace selector. If the task is not assigned to a valid workspace (or if `workspaceId` is null/invalid), display "None" instead of falling back to a hardcoded `"Assigned"` label.
- Only render the inline clear ("X") button if a valid, existing workspace from the `entities` list is currently assigned.

### 3. Strategic Reasoning
- Previously, the trigger resolved the workspace title via `ws?.title || "Assigned"`. This meant that if `workspaceId` was set to an ID that did not exist in the filtered `workspaces` list, it erroneously rendered `"Assigned"`.
- Updated the resolution logic to look up the assigned workspace in the global `entities` collection. If found, it correctly displays `ws.title`. If not found or null, it falls back to the clean "None" layout state.

### 4. Detailed Blueprint
- `src/components/tracker/TaskInspectorPanel.tsx`:
  - Update `PopoverTrigger` to search in `entities` instead of the pre-filtered `workspaces` array.
  - If a matching entity exists, render its title; otherwise, display the "None" button and suppress the clear button.

### 5. Operational Trace
- Adjusted workspace state checks and fallback templates inside `TaskInspectorPanel.tsx`.
- Verified TypeScript compilation.

### 6. Status Assessment
Completed successfully. Unassigned tasks or invalid workspace references now correctly show "None" as the label.
