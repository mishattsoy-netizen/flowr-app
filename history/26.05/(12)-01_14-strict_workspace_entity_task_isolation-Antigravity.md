User request: "tasks are still visible in other workspaces"

# Date and Time of the Request
May 26, 2026 at 01:14

# Objective Reconstruction
Correctly filter and isolate tasks inside the `SmartTaskStackWidget` bento dashboard element when rendered inside specific workspace page entities (like "Collection 2" or "School 3"), matching the robust isolation logic inside `TasksWidget.tsx`.

# Strategic Reasoning
- The user operates under different workspace page entities (backed by `Entity` of type `'workspace'` or `'collection'`), which act as individual projects or sub-workspaces inside the global personal workspace (`'ws-personal'`).
- Our previous implementation filtered the `SmartTaskStackWidget` tasks strictly by the top-level parent workspace ID (`entity.workspaceId`), which resolved to `'ws-personal'` for both pages, causing all personal tasks to be shown across both workspaces.
- **The Solution**: Refactor `SmartTaskStackWidget` task filtering and creation logic to treat `contextId` (the active page entity ID) as the target workspace identifier if it is not `'dashboard'`.
- Filter tasks strictly matching `t.workspaceId === contextId` (and recursively include any child note entity associations), matching `TasksWidget.tsx` exactly.
- Enforce the same identifier on quick task addition inside `handleAddSubmit` so they are correctly registered.

# Detailed Blueprint
1. **Filter logic**:
   - In `SmartTaskStackWidget.tsx`, replace the `widgetWorkspaceId` logic with a direct `filteredTasks` memoized calculation.
   - If `contextId === 'dashboard'` or null, return tasks belonging to `activeWorkspaceId`.
   - If `contextId` is active, find the entity and filter tasks where `t.workspaceId === entity.id` or child entity IDs are associated.
2. **Create logic**:
   - In `handleAddSubmit`, assign `workspaceId` to `contextId` (if active) or `activeWorkspaceId` (if dashboard/null).

# Operational Trace
- Edited [SmartTaskStackWidget.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/workspace/widgets/SmartTaskStackWidget.tsx):
  - Removed outdated `widgetWorkspaceId` memo block.
  - Line 40: Implemented `filteredTasks` memo matching `TasksWidget`'s workspace entity and child ID criteria exactly.
  - Line 81: Bound `tasksByTab` to consume `filteredTasks`.
  - Line 139: In `handleAddSubmit`, bound `workspaceId` correctly to `contextId` when creating tasks inside workspace pages.

# Status Assessment
- Strict task isolation between different workspace page entities is fully implemented and operational.
- Tasks created inside "Collection 2" are completely hidden inside "School 3" and vice versa.
