### Date and time of the request
2026-05-26 at 01:18 AM

### 1. User request
User request: "remove upcoming collumn in kanpand and in tasks widgets. keep only todo that shows all tasks that are upcoming or without due date"

### 2. Objective Reconstruction
The task was to simplify the columns and tabs used across the task widgets and the Kanban board (`TrackerPage`):
- Eliminate the separate "Upcoming" and "In Progress" / "No date" categories.
- Replace them with a single "To do" (`todo`) category that groups all tasks that either have no due date or are scheduled for the future (i.e. due date is tomorrow or later).

### 3. Strategic Reasoning
- **Simplicity**: Consolidating upcoming tasks and tasks without due dates under a single "To do" column reduces layout clutter and makes scanning outstanding work much faster.
- **Drag & Drop Logic**: When tasks are dropped into "To do" on the Kanban board, their due date is cleared so they naturally remain in the "To do" backlog.
- **Sorting Reliability**: For the merged "To do" list, completed tasks are sorted to the bottom, and remaining tasks are ordered chronologically by due date (with undated tasks sorted to the end).

### 4. Detailed Blueprint
The planned changes targeted:
- **Kanban Board (`TrackerPage.tsx`)**: Update title switches to display "To do" for the `'todo'` column key.
- **Kanban Column Dot Colors (`KanbanColumn.tsx`)**: map the unified `'todo'` dot color.
- **Kanban Skeleton Layout (`TrackerSkeleton.tsx`)**: Align the skeleton columns list to have exactly 4 columns instead of 5.
- **Simple Tasks Widget (`TasksWidget.tsx`)**: Re-group status categories to merge "Upcoming" and "No date" into "To do".
- **Smart Task Stack Widget (`SmartTaskStackWidget.tsx`)**: Update default tabs and smart defaults on task addition to use the new `'todo'` tab ID and `'overdue'` yesterday due date default.

### 5. Operational Trace
- **Modified** [TrackerPage.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/tracker/TrackerPage.tsx) to map `'todo'` to the title `'To do'` inside the column renderer switch.
- **Modified** [KanbanColumn.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/tracker/KanbanColumn.tsx) to replace `upcoming` and `inProgress` dot color keys with a unified `todo` color indicator (`#F59E0B`).
- **Modified** [TrackerSkeleton.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/tracker/TrackerSkeleton.tsx) to update the visual loading columns array.
- **Modified** [TasksWidget.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/workspace/widgets/TasksWidget.tsx) to merge `Upcoming` and `No date` status groups into a single `'To do'` status group.
- **Modified** [SmartTaskStackWidget.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/workspace/widgets/SmartTaskStackWidget.tsx) to consolidate tabs under `today`, `todo`, and `overdue` (removing `upcoming` and `progress`), adjust the memo to filter and sort unified `todo` tasks, and set smart default due dates based on the active tab context.

### 6. Status Assessment
- **Completed**: The Kanban board tracker and both tasks widgets now render a clean, unified "To do" column/tab and status group aggregating future and undated tasks.
- **Verification**: Compilation and syntax checks completed successfully without issue. All design rules (flat look, neutral borders, premium typography) are strictly maintained.
