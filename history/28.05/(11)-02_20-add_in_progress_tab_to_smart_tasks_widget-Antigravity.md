# History Report - Added 'In Progress' Tab to Smart Tasks Widget

### 0. Date and time of the request
Date: 2026-05-28
Time: 02:20

### 1. User request
User request: "i dont see in progress tab in tasks widget"

### 2. Objective Reconstruction
Implement the newly created "In Progress" status tab inside the `SmartTaskStackWidget` (the "Smart Tasks" widget commonly labeled as "Tasks" on the Bento dashboard). Ensure it lists tasks mapped to `'in-progress'`, excludes duplicates from the other date tabs, and dynamically assigns `'in-progress'` status during task creation within that tab.

### 3. Strategic Reasoning
- **UI Consistency**: The dashboard's "Tasks" widget is actually a `SmartTaskStackWidget` (Smart Tasks widget template). Since we previously updated `TasksWidget` (the flat list version), the user pointed out that the bento dashboard's tabbed version still lacked the "In Progress" tab.
- **Dynamic Switcher**: Lucide's `Play` icon and a warm amber color theme (`text-amber-400`) fits the active, in-progress semantic status.
- **Filtered Segregations**: Added `'inProgress'` to the sliding-pill tab list, filtered out `status === 'in-progress'` from `'today'`, `'todo'`, and `'overdue'` tasks, and aligned `handleAddSubmit` to auto-populate task statuses to keep the widget and Kanban boards fully in sync.

### 4. Detailed Blueprint
- **Bento Widget**: Update the layout, filters, and creators inside [SmartTaskStackWidget.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/workspace/widgets/SmartTaskStackWidget.tsx).

### 5. Operational Trace
1. **Tabs Registration**: Imported `Play` from `lucide-react` and added `inProgress` definition to `ALL_TABS` with amber colors.
2. **Tab Queries**: Updated the `tasksByTab` selector memo to collect `'in-progress'` tasks under `inProgress` and filter them out from the remaining tabs.
3. **Creation Context**: Added custom status attribution defaults to `handleAddSubmit` when creating a task while the `inProgress` tab is active.
4. **Verification**: Executed typecheck using `npx tsc --noEmit` and confirmed clean compilation status.

### 6. Status Assessment
- **Status**: Completed.
- **Accomplished**:
  - The "Smart Tasks" widget on the dashboard now cleanly includes the sliding "In Progress" tab.
  - Adding a task from this tab correctly maps the status field dynamically.
  - Tasks do not duplicate across date groups.
