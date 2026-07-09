### 0. Date and time of the request
Date: 05.07.2026
Time: 03:07 (Start) - 03:07 (End)

### 1. User request
User request: "make delete buttons same os others"

### 2. Objective Reconstruction
- Change the design styling of the "Delete" button in the task inspector panel footer so its size, padding, text, and icon styles match the sibling buttons ("Save" and "Mark as done").

### 3. Strategic Reasoning
- Upgraded the Delete button's size and font configuration to match `px-4 py-2 text-sm font-semibold` and standard `Check`/`Trash2` icon size (16x16 with `strokeWidth={2.5}`).
- Styled the Delete button using a red theme (`bg-red-500/8 text-red-400/80` and `bg-red-500/15` hover state) that structurally matches the layout and opacity design pattern of the green "Mark as done" button.

### 4. Detailed Blueprint
- `src/components/tracker/TaskInspectorPanel.tsx`: Replace Delete button className and inner contents at line 757.

### 5. Operational Trace
- Modified the class list and element structure in `TaskInspectorPanel.tsx`.
- Verified TypeScript compilation.

### 6. Status Assessment
Completed successfully. The Delete button is now styled consistently with the other actions in the footer.
