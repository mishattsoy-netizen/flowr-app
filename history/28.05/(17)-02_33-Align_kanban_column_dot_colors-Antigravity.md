User request: "use same dot colors for collumns"

### 0. Date and time of the request
- **Date**: 28 May 2026
- **Time**: 02:33 local time

### 1. User request
`User request: "use same dot colors for collumns"`

### 2. Objective Reconstruction
Align the Kanban board column indicator dots (`KanbanColumn.tsx`) to match the new status selection pill colors exactly (To Do: Blue `#3B82F6`, In Progress: Amber `#F59E0B`, Completed: Emerald `#10B981`).

### 3. Strategic Reasoning
- **Visual Synchronization**: Ensuring status indicator colors are 100% consistent across different pages (e.g. Kanban columns, widget tabs, modal dropdowns) is key to establishing a seamless brand identity.
- **Precision Swap**: Swapped the color values in the `DOT_COLORS` map inside `KanbanColumn.tsx` where these status color dots are registered.

### 4. Detailed Blueprint
- **Files Involved**:
  - `src/components/tracker/KanbanColumn.tsx`
- **Map Swaps**:
  - `todo`: Swap from `#F59E0B` (Amber) to `#3B82F6` (Blue).
  - `inProgress`: Swap from `#3B82F6` (Blue) to `#F59E0B` (Amber).

### 5. Operational Trace
- **Code Modification**: Updated the `DOT_COLORS` constant declaration at the top of `KanbanColumn.tsx` to align the status dot colors.
- **Type Checking**: Validated changes using `npx tsc --noEmit` and confirmed zero compiler warnings.

### 6. Status Assessment
- **Status**: 100% Completed.
- **Next Recommendation**: Refresh your tracker page to enjoy the perfectly synced column dot indicators!
