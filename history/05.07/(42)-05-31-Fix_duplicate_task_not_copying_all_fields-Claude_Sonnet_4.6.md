### 0. Date and time of the request
Date: 05.07.2026
Time: 05:32

### 1. User request
User request: "duplicate task doesnt copy details. all these fields in image must be duplicated"

### 2. Root Cause
Two bugs:
1. `handleDuplicate` was not copying `status` or `completed` into presets.
2. The render-phase initialization branches in `TaskPanelContent` always set `title = ''`, `description = ''`, and `subtasks = []` — ignoring whatever was in `taskPanelPresets`. So even if the preset had them, they were overwritten with empty values.

### 3. Fix
- Added `status`, `completed`, and subtask `completed: false` reset to `handleDuplicate` presets.
- Updated both render-phase else-branches to read `title`, `description`, and `subtasks` from `taskPanelPresets` instead of always defaulting to empty.

### 5. Files Changed
- `src/components/tracker/TaskInspectorPanel.tsx`

### 6. Status
Completed. Duplicating now copies: Status, Priority, Due Date, Workspace, Custom Tag, Description, Subtasks, Color.
