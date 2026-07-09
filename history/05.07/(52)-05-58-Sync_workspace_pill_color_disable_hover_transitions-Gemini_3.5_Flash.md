### 0. Date and time of the request
Date: 05.07.2026
Time: 05:58

### 1. User request
User request: "make smae as attachments and dont change pills color on row hover in widget"

### 2. Fix
- Updated workspaceName pill in `SmartTaskStackWidget.tsx` to use `text-[var(--bone-80)]` matching the Kanban card styles.
- Removed the hover-based styling transition wrappers (`group-hover:opacity-100 transition-opacity`, etc.) from the calendar info section inside `SmartTaskStackWidget.tsx` to make sure layout colors remain completely static when hover actions occur on a widget row.

### 5. Files Changed
- `src/components/workspace/widgets/SmartTaskStackWidget.tsx`

### 6. Status
Completed.
