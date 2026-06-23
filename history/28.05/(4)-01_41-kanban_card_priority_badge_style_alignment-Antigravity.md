# History Report — Kanban Card Priority Badge Style Alignment

### 0. Date and Time
May 28, 2026 at 01:41

### 1. User Request
User request: "in the kanban collumn show priority pills same style as in sidebar view"

### 2. Objective Reconstruction
The priority badge on Kanban cards (`TaskCard.tsx`) was styled in all-caps, with a border, and a bold font (`font-bold uppercase border`). This clashed visually with the priority selection pills inside the task drawer (`NewTaskModal.tsx`), which are capitalized, borderless, rounded, and have a medium font weight (`capitalize border-none font-medium`). The Kanban card badge needs to be updated to match the drawer view priority styles exactly.

### 3. Strategic Reasoning
To preserve UI/UX consistency across the entire application (Rule 4 of visual design guidelines), UI elements representing the same data domain (in this case, task priority) should share the same core design system tokens (colors, font weights, capitalization, and borders):
- **Capitalization**: Change from `uppercase` to `capitalize` (so it shows "Low", "Medium", "High").
- **Font Weight**: Change from `font-bold` to `font-medium` to match the drawer weight.
- **Borders**: Remove borders to keep it clean and unified (`border-none`).
- **Rounding**: Align rounded corners to `rounded-[6px]` (matching the drawer's `rounded-[6px]`).
- **Scale**: Scale down padding and text size (`px-2 py-0.5 text-[10px]`) slightly to keep it compact and proportional on a standard Kanban card container.

### 4. Detailed Blueprint
- **File**: `src/components/tracker/TaskCard.tsx`
- **Modifications**:
  1. Remove border and border-color styles from each priority tier class list.
  2. Change badge styling classes to `px-2 py-0.5 rounded-[6px] text-[10px] font-medium capitalize`.

### 5. Operational Trace
- Edited `src/components/tracker/TaskCard.tsx`:
  - Replaced:
    ```tsx
    "px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider",
    task.priority === 'high' ? "bg-red-500/10 text-red-400 border border-red-500/20" :
    task.priority === 'medium' ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
    "bg-blue-500/10 text-blue-400 border border-blue-500/20"
    ```
    with:
    ```tsx
    "px-2 py-0.5 rounded-[6px] text-[10px] font-medium capitalize",
    task.priority === 'high' ? "bg-red-500/10 text-red-400" :
    task.priority === 'medium' ? "bg-amber-500/10 text-amber-400" :
    "bg-blue-500/10 text-blue-400"
    ```
- Validated build integrity using `npx tsc --noEmit`. No errors.

### 6. Status Assessment
Completed. Priority badges on Kanban task cards are now styled in perfect visual alignment with the drawer selection pills.
