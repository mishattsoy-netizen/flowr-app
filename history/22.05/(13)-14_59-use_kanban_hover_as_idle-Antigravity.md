User request: "use hover style of kanban as idle. no hover effect"

### 0. Date and time of the request
May 22, 2026 at 14:59 (Local Time)

### 1. User request
User request: "use hover style of kanban as idle. no hover effect"

### 2. Objective Reconstruction
The user wants to refine the Kanban column background/border styling.
1. Use the previous hover style (`bg-[var(--color-panel)] border-[var(--bone-15)]`) as the default, idle style of each column container.
2. Remove any transition effect and remove hover styling (since it is already at full opacity/highlight by default).

### 3. Strategic Reasoning
- Converting the hover highlight style to the permanent idle style gives the Kanban board a highly premium, structural layout where each column's boundaries are fully defined immediately on load.
- Removing custom hover state switches and `transition-colors duration-150` aligns directly with our strict 0ms-response branding preferences (Universal Mandate) for utility elements.

### 4. Detailed Blueprint
1. **Container Styling (`src/components/tracker/KanbanColumn.tsx`)**:
   - Locate the `<div className={cn(...)` container of the column.
   - Replace the conditional class merger with a simple static string class containing `"flex flex-col w-[300px] shrink-0 h-full rounded-[var(--radius-big)] p-4 border bg-[var(--color-panel)] border-[var(--bone-15)]"`.

### 5. Operational Trace
- **Modified**: [KanbanColumn.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/tracker/KanbanColumn.tsx)
  - Removed `cn(...)` class evaluation, `isOver` styling conditional blocks, and hover transition classes.
  - Hardcoded the idle state style to `bg-[var(--color-panel)] border-[var(--bone-15)]`.

### 6. Status Assessment
- **Completed**: The Kanban columns now render with their highlight style active in idle state, with no transition or hover styling applied.
- **Verification**: Verified TypeScript compilation. Codebase builds perfectly.
