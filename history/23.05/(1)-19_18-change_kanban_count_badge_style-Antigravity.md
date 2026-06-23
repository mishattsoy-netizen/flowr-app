User request: "change this urple circle to bone 6 and make it smaller"

### 0. Date and time of the request
May 23, 2026 at 19:18 (Local Time)

### 1. User request
User request: "change this urple circle to bone 6 and make it smaller"

### 2. Objective Reconstruction
The user wants to refine the visual style of the task count badge in the Kanban board columns:
1. Change the background color of the badge from the prominent indigo (`bg-indigo-600`) to the dark/neutral bone-6 theme background (`bg-[var(--bone-6)]`).
2. Style the text color within the badge to clean grey-bone (`text-[var(--bone-70)]`) to provide soft, clean contrast matching the column header details.
3. Reduce the size of the circular badge from a large `w-5 h-5` (with `text-[10px]`) to a more compact, subtle `w-4 h-4` (with `text-[9px]`).

### 3. Strategic Reasoning
- The highly visible indigo count badge drew unnecessary high-contrast visual weight to columns even when they had zero tasks.
- Modifying the count circle to use `var(--bone-6)` background and `var(--bone-70)` text embeds the count badge naturally into the minimal visual system of the header group.
- Shrinking the diameter to `w-4 h-4` matches standard small tag styling (like the task tag strip) and keeps column labels neat and proportional.

### 4. Detailed Blueprint
- **File**: [KanbanColumn.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/tracker/KanbanColumn.tsx)
- **Target Element**: The Kanban column task count badge `span` component inside the column header title group.
- **Modifications**:
  - Replace `w-5 h-5` with `w-4 h-4`.
  - Replace `text-[10px]` with `text-[9px]`.
  - Replace `bg-indigo-600 text-white` with `bg-[var(--bone-6)] text-[var(--bone-70)]`.

### 5. Operational Trace
- **Modified**: [KanbanColumn.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/tracker/KanbanColumn.tsx)
  - Safely edited the circular badge markup to apply standard Bone classes for background and text.
  - Reduced sizes to a compact layout.
- **Ran Type Check**: Executed `npx tsc --noEmit` which completed successfully with absolutely zero warnings or compile errors.

### 6. Status Assessment
- **Completed**: The count badge has been successfully shrunk and styled to match the subtle, premium Bone system UI.
- **Result**: Visual noise is reduced, header layout is highly unified and clean.
