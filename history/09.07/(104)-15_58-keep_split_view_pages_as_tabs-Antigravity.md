User request: "when i turn off split mode, opened pages must be kept as tabs in the one collumn view header, if i licked on other page, open it in full screen and tabs/pages from split view must be placed in the unselected tabs, but i i just unclicked slit view white 2 pages are opened, keep the left one full screen and on the right as unselected tab. same in the desktop"

### Date and Time
09.07.2026, 15:58

### Objective Reconstruction
Ensure that entities opened during split view are not lost when exiting split view. Instead, they should be converted into standard tabs in the single-column header.

### Strategic Reasoning
- Previously, exiting split view (either manually by toggling or automatically by clicking a completely new entity in the sidebar) would just restore the prior `openTabIds`, potentially discarding whatever was open in the right column.
- The solution is to ensure that both `splitViewLeftId` and `splitViewRightId` are flushed into `openTabIds` right before exiting split view.
- This logic needs to be applied in two specific exit points: `toggleSplitView` (for manual exiting) and `setActiveEntityId` (for automatic exiting via sidebar click).

### Detailed Blueprint
- **[store.ts](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/data/store.ts)**:
  - Updated `setActiveEntityId`: In the block that exits split view when clicking a new sidebar entity, we now push `splitViewLeftId` and `splitViewRightId` into `nextTabs` (if they aren't already there), and then safely push the new `id` as the active tab. Removed the old logic that was destructively overwriting the active tab index.
  - Updated `toggleSplitView`: Added the same push logic to the split view exit block. It ensures the right column's entity becomes an unselected tab and keeps the left entity as the full-screen active tab.

### Operational Trace
1. Analyzed `store.ts` for all code paths that exit split view.
2. Modified `setActiveEntityId` to capture split columns as tabs.
3. Modified `toggleSplitView` to capture split columns as tabs.

### Status Assessment
- **Completed**: Toggling split view off, or clicking a new sidebar item while split view is on, now successfully preserves both split columns as background tabs in the header.
