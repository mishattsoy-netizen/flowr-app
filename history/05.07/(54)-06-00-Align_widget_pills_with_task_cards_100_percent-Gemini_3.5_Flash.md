### 0. Date and time of the request
Date: 05.07.2026
Time: 06:00

### 1. User request
User request: "make sure that widget pills match task cards(ALL)"

### 2. Fix
Matched all elements (pills) in workspace list widgets (`SmartTaskStackWidget.tsx`) with Kanban task cards (`TaskCard.tsx`):
- Changed priority wrapper tag from `div` to `span`.
- Added the `text-fade truncate max-w-full` internal wrapper spans to tag and workspace pills.
- Standardized the workspace pill `max-w-[90px]` and tag pill `max-w-[80px]` restrictions.
- Updated calendar text font class to `font-ui` and gap to `gap-1.5` to make it identical to task card calendar sections.

### 5. Files Changed
- `src/components/workspace/widgets/SmartTaskStackWidget.tsx`

### 6. Status
Completed. Widget list view pills are now 100% identical in structure and class definitions to Kanban task cards.
