User request: "remove ability to show same entity in both collumns"

### Date and Time
09.07.2026, 15:52

### Objective Reconstruction
Prevent the user from opening the exact same entity in both the left and right columns of the split view simultaneously.

### Strategic Reasoning
- The primary mechanism for changing an entity in a specific column is `setColumnEntity`.
- By adding a check inside `setColumnEntity` that compares the incoming `entityId` against the other column's active entity ID, we gracefully reject the assignment if they are identical.
- We previously confirmed that other pathways, like "Split Right" in `ContextMenu.tsx`, already have safeguards (`activeEntityId !== entity!.id`). 
- Sidebar selection uses `setActiveEntityId`, which already behaves correctly by shifting focus to the existing column if the entity is already open in split view, rather than duplicating it.

### Detailed Blueprint
- **[store.ts](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/data/store.ts)**: 
  - Updated `setColumnEntity` to immediately return if `entityId === state.splitViewRightId` (when setting left) or `entityId === state.splitViewLeftId` (when setting right).

### Operational Trace
1. Investigated all store actions that manipulate `splitViewLeftId` and `splitViewRightId`.
2. Verified that `ContextMenu.tsx`, `toggleSplitView`, and `setActiveEntityId` already behave securely and prevent exact duplicates.
3. Updated `setColumnEntity` in `store.ts` to implement the same restriction.

### Status Assessment
- **Completed**: The app will no longer allow the same entity to be displayed in both columns. Attempts to select an already-open entity via the column picker will be ignored.
