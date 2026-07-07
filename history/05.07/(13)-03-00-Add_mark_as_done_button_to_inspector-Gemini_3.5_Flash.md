### 0. Date and time of the request
Date: 05.07.2026
Time: 03:00 (Start) - 03:00 (End)

### 1. User request
User request: "actually remove icon. and add same size button next to it like mark as done button in popup"

### 2. Objective Reconstruction
- Remove the checkmark icon from the monochromatic "Done" button (returning it to just text "Done").
- Add a new button adjacent to "Done" in the inspector panel footer when the task is not completed (`!completed`).
- Match the visual style of the "Mark as done" action from the task context menu popup (translucent emerald color theme, checkmark icon, identical sizing and padding).

### 3. Strategic Reasoning
- Restored the "Done" button to pure text without an icon to avoid redundancy.
- Created a sister "Mark as done" button matching the color scheme of the board's check actions (`bg-emerald-500/8 text-emerald-400/80` and `bg-emerald-500/15` hover state) to offer a direct mark-as-done trigger inside the task inspector, which hides itself once selected.

### 4. Detailed Blueprint
- `src/components/tracker/TaskInspectorPanel.tsx`:
  - Wrap buttons in a flex container `flex items-center gap-2`.
  - Conditionally render a "Mark as done" button if `!completed` before the "Done" button.
  - Remove the checkmark icon from the "Done" button.

### 5. Operational Trace
- Edited footer rendering structure in `TaskInspectorPanel.tsx`.
- Verified TypeScript compilation.

### 6. Status Assessment
Completed successfully. The task inspector panel footer now has side-by-side "Mark as done" and "Done" buttons when a task is active/uncompleted.
