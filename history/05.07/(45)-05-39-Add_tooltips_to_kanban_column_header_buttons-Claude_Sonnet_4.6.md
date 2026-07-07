### 0. Date and time of the request
Date: 05.07.2026
Time: 05:40

### 1. User request
User request: "add custom tooltips to these buttons aswell in columns"

### 2. Fix
Imported the project's custom Tooltip component in KanbanColumn.tsx and wrapped all three column header action buttons:
- **Trash (Done column)** → "Clear completed tasks"
- **Sort (all columns)** → "Sort tasks"
- **Plus (non-Done columns)** → "New task"

### 5. Files Changed
- `src/components/tracker/KanbanColumn.tsx`

### 6. Status
Completed.
