User request: "remove ability i see 2 empty collumns."

### Date and Time
09.07.2026, 16:11

### Objective Reconstruction
Ensure that the split view mode never displays two empty columns simultaneously. If both columns would become empty, either prevent entering split view or exit it entirely.

### Strategic Reasoning
- An "empty column" visually occurs when a view pane has no underlying entity loaded (e.g. `splitViewLeftId` is null, or it references 'dashboard' or a deleted entity).
- **Entering Split View**: `toggleSplitView` sometimes allows entering split view from the Dashboard, which immediately produces two empty columns. We needed to add a check during toggle to verify that at least one assigned entity exists; if both are empty/invalid, simply abort entering split view.
- **Deleting Entities**: `deleteEntity` was previously not verifying whether deleting the active split view columns would leave both empty. We needed to update the `deleteEntity` state mutation to clear `splitViewLeftId` and `splitViewRightId` if their respective entities were deleted, and proactively turn off `splitViewActive` if both columns become null as a result.

### Detailed Blueprint
- **[store.ts](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/data/store.ts)**:
  - Updated `toggleSplitView`: Added a check after identifying default `leftId` and `rightId`. If `!leftIsReal && !rightIsReal`, it calls `return`, keeping the split view inactive.
  - Updated `deleteEntity`: Improved the Zustand `set` callback. It now actively filters out deleted entities from `openTabIds`. It also cleans up `splitViewLeftId` and `splitViewRightId`. Finally, if both split column IDs become null, it sets `splitViewActive = false`.

### Operational Trace
1. Verified `store.ts` logic for `toggleSplitView` and `deleteEntity`.
2. Modified `toggleSplitView` to conditionally abort early.
3. Modified `deleteEntity` to apply cascading cleanup to `openTabIds`, `splitViewLeftId`, and `splitViewRightId`.
4. Verified that the remaining tab behavior (`removeTab`) already effectively manages split view exits if a user manually closes the second-to-last tab.

### Status Assessment
- **Completed**: The app will no longer open split view if there are no viable tabs, and will gracefully exit split view if you delete all the entities currently displayed in its columns.
