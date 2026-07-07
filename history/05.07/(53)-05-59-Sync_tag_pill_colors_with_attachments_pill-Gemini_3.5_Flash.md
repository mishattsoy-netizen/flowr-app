### 0. Date and time of the request
Date: 05.07.2026
Time: 05:59

### 1. User request
User request: "tag pills color must be same as attachments pill in kanban"

### 2. Fix
Synchronized the visual appearance of the tag pills with the attachments pill.
- Changed background from `bg-[var(--bone-6)]` to `bg-[var(--bone-10)]`.
- Changed text color from `text-[var(--bone-40)]` to `text-[var(--bone-70)]`.
- Applied changes to both Kanban task cards (`TaskCard.tsx`) and workspace list widgets (`SmartTaskStackWidget.tsx`).

### 5. Files Changed
- `src/components/tracker/TaskCard.tsx`
- `src/components/workspace/widgets/SmartTaskStackWidget.tsx`

### 6. Status
Completed. Custom tag pills now match the background and text color of attachment pills.
