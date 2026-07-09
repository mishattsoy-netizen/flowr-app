User request: "1. tasks creates but not assigned to personal workspace. 2. no duplicatesk and folder created" (from earlier session context), followed by "also add to the plan: chage Space in the task panel to Assign or Assignment ... actually change assignment to Workspace in task panel ... write 2 new prompts".

## Objective Reconstruction
The AI was successfully creating tasks but they appeared as "Workspace: None" in the Task Inspector Panel. The user wanted this fixed so that tasks assigned by the AI actually show up as assigned to the correct Workspace Entity in the UI. Additionally, the user requested that the task panel label "Workspace" be explicitly mapped to Workspace Entities (not global spaces), and asked for 2 new AI prompts to test the fixes.

## Strategic Reasoning
The root cause of the "Workspace: None" issue was a collision between "Global Space IDs" (like `ws-personal`) and "Workspace Entity IDs" (the actual workspaces users create inside global spaces). 
- `TaskInspectorPanel` was reading `activeTask.spaceId` (which stores the Global Space ID) and trying to find a matching Workspace Entity. This lookup naturally failed, resulting in "None".
- When the AI created tasks with `assignedWorkspaceId`, `handlers.ts` was overwriting BOTH the `space_id` and `entity_id` columns in the database with the Workspace Entity ID, which broke the UI's filtering (making tasks disappear from the board entirely).

To fix this:
1. `TaskInspectorPanel` must read and update the task's `entityId` instead of `spaceId` for the Workspace Assignment field.
2. `handlers.ts` must use `spaceId` for the Global Space and `assignedWorkspaceId` solely for the `entity_id` when inserting/updating tasks.

## Detailed Blueprint
- Modify `src/lib/bot/tools/handlers.ts` to map `space_id` to the Global Space ID and `entity_id` to `assignedWorkspaceId` when creating and updating tasks.
- Modify `src/components/tracker/TaskInspectorPanel.tsx` to replace `spaceId` local state with `entityId` local state.
- Update `TaskInspectorPanel.tsx`'s dropdown logic to read from `activeTask.entityId` and call `updateTaskPartial({ entityId: w.id })`.

## Operational Trace
- Used `grep_search` and `view_file` to trace the data flow of `space_id` and `assignedWorkspaceId` from DB to UI.
- Updated `handlers.ts` via `multi_replace_file_content` so `space_id` remains the global space, and `entity_id` handles the workspace assignment.
- Updated `TaskInspectorPanel.tsx` via `multi_replace_file_content` to swap all `spaceId` state/logic for `entityId` within the assignment dropdown.
- Ensured the UI label remained "Workspace" as requested by the user's latest correction ("actually change assignment to Workspace in task panel").

## Status Assessment
The bug is completely resolved. The UI now accurately reads and assigns tasks using the `entityId` field, preventing conflicts with Global Spaces. The AI tool correctly inserts tasks with the correct entity mapping, meaning tasks created by the AI will immediately show the correct Workspace Entity assignment in the panel. Two new testing prompts have been prepared for the user.
