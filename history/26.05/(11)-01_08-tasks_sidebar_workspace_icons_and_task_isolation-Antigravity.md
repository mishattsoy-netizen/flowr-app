User request: "fix workspaces in sidebar in tasks apge, it should have same icon as in the home list. also tasts that are created in the workspace mustnt be shown in the other workspaces widgets, they are not shared"

# Date and Time of the Request
May 26, 2026 at 01:08

# Objective Reconstruction
1. Sidebar Workspace Icons:
   - In the "Tasks" page sidebar view, render the actual workspace icons associated with each workspace (via `getEntityIcon(ws.icon)`) to match their appearance in the "Home" tree view.
2. Workspace Task Isolation:
   - Partition tasks strictly by workspace. Tasks created inside a specific workspace must not appear inside any other workspace's widgets (they are isolated/private to their respective workspaces).
   - Filter both `SmartTaskStackWidget` and `TasksWidget` lists to strictly display tasks matching the current widget's workspace context.

# Strategic Reasoning
- **Unified Icons**: Workspaces should have consistent iconography across all pages (Home, Tasks, etc.). Rendering standard workspace folder/collection icons instead of generic circular colored dots creates visual harmony.
- **Task Isolation**: Tasks are meant to be scope-isolated to workspaces. Showing all tasks in every workspace's widget leaks data and pollutes work contexts.
- By fetching the parent workspace ID context in widgets (`widgetWorkspaceId` derived from `contextId` or workspace page entities), we filter lists correctly (`tasks.filter(t => t.workspaceId === widgetWorkspaceId)`).
- When a task is added via the widget's quick input form, we explicitly inject the correct `workspaceId` into `addTask(...)` to prevent any default workspace assignment issues.

# Detailed Blueprint
1. **Sidebar Workspace List**:
   - In `Sidebar.tsx`, locate the workspace mapping loop inside the task navigation block (lines 804-818).
   - Replace the colored dot `span` element with `<WorkspaceIcon strokeWidth={2} className="w-3.5 h-3.5" />`, resolving the icon using `getEntityIcon(ws.icon)`.
2. **SmartTaskStackWidget Task Isolation**:
   - In `SmartTaskStackWidget.tsx`, hook up `entities` and `activeWorkspaceId` from `useStore`.
   - Calculate `widgetWorkspaceId` from `contextId` page entity matching.
   - Filter task lists by `widgetWorkspaceId` inside the `tasksByTab` memo.
   - Explicitly pass `workspaceId: widgetWorkspaceId` in `handleAddSubmit` when creating new tasks.
3. **TasksWidget Task Isolation**:
   - In `TasksWidget.tsx`, hook up `activeWorkspaceId` from `useStore`.
   - Filter `workspaceTasks` inside the memo using `activeWorkspaceId` when `contextId === 'dashboard'` instead of returning all tasks.
   - Explicitly pass `workspaceId: entity?.id ?? activeWorkspaceId ?? null` in `handleAdd` when creating new tasks instead of passing `contextId` directly.

# Operational Trace
- Edited [Sidebar.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/layout/Sidebar.tsx):
  - Refactored sidebar workspaces mapping list in the tasks view, replacing standard circles with dynamic `getEntityIcon(ws.icon)` folder elements.
- Edited [SmartTaskStackWidget.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/workspace/widgets/SmartTaskStackWidget.tsx):
  - Implemented dynamic `widgetWorkspaceId` extraction from widget `contextId` page properties.
  - Filtered task array by `widgetWorkspaceId` inside the main `tasksByTab` loop.
  - Bound `workspaceId` context parameters in task creation events.
- Edited [TasksWidget.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/workspace/widgets/TasksWidget.tsx):
  - Filtered default workspace tasks in dashboard view by `activeWorkspaceId`.
  - Added correct workspace fallback in `handleAdd`.

# Status Assessment
- Workspace sidebar list icons now match standard home view icons perfectly.
- Tasks are completely isolated inside their respective workspaces; they no longer leak into other workspaces' lists or widgets.
