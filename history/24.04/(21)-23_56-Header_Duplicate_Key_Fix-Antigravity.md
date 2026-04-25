User request: "fix duplicate children with the same key, dashboard error"

### Objective Reconstruction
The objective was to resolve a React console error (and potential crash) where the `HeaderBar` component encountered multiple tabs with the same ID (`dashboard`), leading to duplicate key warnings.

### Strategic Reasoning
The issue was localized to the `addTab` action in `store.ts`. This action was unconditionally appending the requested ID to the `openTabIds` array. If a user clicked "New Tab" while a dashboard tab was already open, it would create a duplicate entry. Since the `HeaderBar` uses the tab ID as the React `key`, this caused the conflict. I updated the logic to check for existing IDs before adding a new one; if found, it simply activates the existing tab.

### Detailed Blueprint
- **store.ts**: Modify `addTab` to include an `.includes(id)` check before updating the `openTabIds` state.

### Operational Trace
Modified `src/data/store.ts` at line 374.

### Status Assessment
Duplicate tab IDs are now prevented at the state level, resolving the console error and ensuring UI stability.
