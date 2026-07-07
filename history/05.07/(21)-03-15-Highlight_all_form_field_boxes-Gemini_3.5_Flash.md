### 0. Date and time of the request
Date: 05.07.2026
Time: 03:15 (Start) - 03:15 (End)

### 1. User request
User request: "every field box must hghlight on hover and focus, and idle color of subtasks, description, workspace, tag, date and priority field boxes must be same."

### 2. Objective Reconstruction
- Unify the default background styling for the subtasks input container, description container, workspace selector button, tag input, date picker trigger, and priority selector buttons to the same initial color (`var(--bone-6)`).
- Ensure that every field box highlights (transitions background color to `var(--bone-10)`) when hovered or focused/active.

### 3. Strategic Reasoning
- Normalized all default idle states to `bg-[var(--bone-6)]` to build visual harmony in the panel.
- Used `hover:bg-[var(--bone-10)]` and `focus-within:bg-[var(--bone-10)]` / `focus:bg-[var(--bone-10)]` to provide dynamic hover and keyboard focus indicators across all container boxes.

### 4. Detailed Blueprint
- `src/components/ui/date-time-picker.tsx`: Add `focus:bg-[var(--bone-10)]` to the date picker button trigger.
- `src/components/tracker/TaskInspectorPanel.tsx`:
  - Set priority unselected states, workspace triggers, and tags input to add `hover:bg-[var(--bone-10)] focus:bg-[var(--bone-10)]`.
  - Wrap description textarea's wrapper and subtasks input wrapper in `hover:bg-[var(--bone-10)] focus-within:bg-[var(--bone-10)] transition-all`.

### 5. Operational Trace
- Edited styling classes inside `date-time-picker.tsx` and `TaskInspectorPanel.tsx`.
- Verified TypeScript compilation.

### 6. Status Assessment
Completed successfully. Form fields now share a unified idle background and highlight smoothly on hover and focus.
