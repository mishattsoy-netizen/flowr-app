### 0. Date and time of the request
Date: 05.07.2026
Time: 05:33

### 1. User request
User request: "not description, and main task title must be empty with focus"

### 2. Fix
- Removed `title`, `description`, and `note` from `handleDuplicate` presets.
- Reverted preset init blocks to always set `title = ''` and `description = ''`.
- Autofocus already fires on new/duplicate tasks since it triggers whenever `!activeTask`.

### 5. Result
Duplicate now copies: Status, Priority, Due Date, Workspace, Tag, Color, Subtasks.
Title is blank with autofocus. Description is blank.
