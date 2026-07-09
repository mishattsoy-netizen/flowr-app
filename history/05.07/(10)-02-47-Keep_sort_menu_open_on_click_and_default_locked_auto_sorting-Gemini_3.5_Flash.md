### 0. Date and time of the request
Date: 05.07.2026
Time: 02:47 (Start) - 02:47 (End)

### 1. User request
User request: "this popup closes when i click any button fix it also make sure that default is locked auto sorting"

### 2. Objective Reconstruction
- Keep the column sorting menu popup open when the user clicks sorting modes (Manual, Auto, Recently Added) or toggles the "Lock sorting" switch.
- Configure all board columns to default to "Locked Auto-sorting" (Auto-sorting mode enabled, and sorting lock set to `true`) by default.

### 3. Strategic Reasoning
- Removed the explicit `setIsSortMenuOpen(false)` triggers from the dropdown click handlers so that the popover remains open during interactive toggling, closing only on click-outside.
- Set the default properties for `trackerColumnSortLocks` and fallback values in handlers to `true` (locked) instead of `undefined` / `false` to ensure locked sorting is active by default.

### 4. Detailed Blueprint
- `src/components/tracker/KanbanColumn.tsx`: Remove `setIsSortMenuOpen(false)` inside options onClick closures.
- `src/data/store.ts`:
  - Set initial state values for `trackerColumnSortLocks` columns to `true`.
  - Add fallback default checks `?? true` inside `setTrackerColumnSortMode` and `toggleTrackerColumnSortLock` action handlers.

### 5. Operational Trace
- Edited layout handlers in `KanbanColumn.tsx` and state properties in `store.ts`.
- Verified TypeScript compilation.

### 6. Status Assessment
Completed successfully. Column sorting popup remains open during mode toggles, and columns now default to locked auto-sorting.
