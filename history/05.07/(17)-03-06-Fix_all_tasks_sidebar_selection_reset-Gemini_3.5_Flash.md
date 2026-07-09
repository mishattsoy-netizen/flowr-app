### 0. Date and time of the request
Date: 05.07.2026
Time: 03:06 (Start) - 03:06 (End)

### 1. User request
User request: "sometimes when iselect tag in sidebar i cant switch filed to all task or others"

### 2. Objective Reconstruction
- Fix a bug where clicking the "All tasks" button in the sidebar does not clear the active `trackerFilterTag` filter, leaving the user locked into the selected tag filter even after switching to the general tasks view.

### 3. Strategic Reasoning
- When selecting a custom tag in the sidebar, `trackerFilterTag` is set in the store. When the user navigates back to "All tasks", we must reset BOTH the workspace filter (`trackerFilterWorkspace`) and the tag filter (`trackerFilterTag`) to `null`.
- Updated the visual active condition for the "All tasks" button to `trackerFilterWorkspace === null && trackerFilterTag === null` so the button displays active state highlight correctly only when no filters are active.

### 4. Detailed Blueprint
- `src/components/layout/Sidebar.tsx`:
  - Update "All tasks" button `onClick` event to call both `setTrackerFilterWorkspace(null)` and `setTrackerFilterTag(null)`.
  - Update "All tasks" button active styling check to `trackerFilterWorkspace === null && trackerFilterTag === null`.

### 5. Operational Trace
- Modified the click handler and class styling in `Sidebar.tsx`.
- Verified TypeScript compilation.

### 6. Status Assessment
Completed successfully. Navigating to "All tasks" now clears any active tag filter.
