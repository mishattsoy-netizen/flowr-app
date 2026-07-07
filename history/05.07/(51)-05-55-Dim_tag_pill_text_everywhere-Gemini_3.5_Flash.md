### 0. Date and time of the request
Date: 05.07.2026
Time: 05:55

### 1. User request
User request: "dim tags text a bit everywhere"

### 2. Fix
Modified the custom tag pills in both Kanban task cards (`TaskCard.tsx`) and list widgets (`SmartTaskStackWidget.tsx`) to change the text color class from `text-[var(--bone-50)]` to `text-[var(--bone-40)]`.

### 5. Files Changed
- `src/components/tracker/TaskCard.tsx`
- `src/components/workspace/widgets/SmartTaskStackWidget.tsx`

### 6. Status
Completed. Custom tag pill text is now slightly dimmer/less visible.
