### 0. Date and time of the request
Date: 05.07.2026
Time: 01:10 (Start) - 01:12 (End)

### 1. User request
User request: "do it" (confirming removal of task card checkboxes and replacement of decorative side color borders with dynamic inline color dots next to task titles).

### 2. Objective Reconstruction
- Remove the interactive checkbox element from task cards on the tracker board.
- Remove the left-side absolute color borders/strips from task cards.
- Add an inline 8px circle color dot (`w-2 h-2 rounded-full`) prefix on the left of the task title if `task.color` is present.

### 3. Strategic Reasoning
- Simplifying checkboxes on the board reduces visual clutter and prevents logical columns/checklist conflicts, focusing task completion on column dragging and context menu actions.
- Replacing the vertical side borders with colored dots next to titles creates a cleaner, more minimalist color coding indicator.

### 4. Detailed Blueprint
- `src/components/tracker/TaskCard.tsx`:
  - Remove button element representing the checkbox.
  - Insert a `span` color dot mapped to `task.color`.
  - Remove the absolute decorative left strip `div`.

### 5. Operational Trace
- Replaced templates inside `TaskCard.tsx`.
- Verified TypeScript compilation.

### 6. Status Assessment
Completed successfully. Task cards now have no checkbox/side color lines, displaying a neat color dot next to the title instead when custom color tagging is present.
