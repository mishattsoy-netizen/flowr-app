### 0. Date and time of the request
Date: 05.07.2026
Time: 05:48

### 1. User request
User request: "add attachments and tag pills in the task widgets"

### 2. Fix
The kanban card already showed both pills. The list-view widget (SmartTaskStackWidget) was missing them.
- Added `Paperclip` icon import.
- Added attachment count pill (📎 N) before the priority pill.
- Added tag pill after priority, matching the kanban card style, with truncation at 80px.

### 5. Files Changed
- `src/components/workspace/widgets/SmartTaskStackWidget.tsx`

### 6. Status
Completed.
