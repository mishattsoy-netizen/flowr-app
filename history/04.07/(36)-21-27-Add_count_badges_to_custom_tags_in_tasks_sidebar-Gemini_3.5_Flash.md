### 0. Date and time of the request
Date: 04.07.2026
Time: 21:27 (Start) - 21:27 (End)

### 1. User request
User request: "tags must also show count in sidebar"

### 2. Objective Reconstruction
- Display the count of uncompleted tasks matching each specific custom tag next to it inside the Tasks sidebar.
- Style the tag count badge exactly identical to the workspace count badges.

### 3. Strategic Reasoning
- Filtered active tasks dynamically by `workspaceId`, matching `tag`, and `!completed` state inside the `wsTags.map` loop.
- Rendered the count badge using matching CSS class definitions.

### 4. Detailed Blueprint
- `src/components/layout/Sidebar.tsx`: Compute active `tagCount` and render the badge on each custom tag row.

### 5. Operational Trace
- Edited the tag template loop inside `Sidebar.tsx`.
- Verified TypeScript compilation.

### 6. Status Assessment
Completed successfully. Nested custom tag list rows now display uncompleted task count badges.
