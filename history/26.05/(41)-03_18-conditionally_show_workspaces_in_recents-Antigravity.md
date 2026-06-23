### 0. Date and time of the request
Date: 2026-05-26
Time: 03:18

### 1. User request
User request: "but in home dashboard show workspaces"

### 2. Objective Reconstruction
Re-state the request clearly and professionally:
- Allow workspaces and collections to appear as active recent activity rows in `RecentWidget` when viewed on the Home dashboard (`contextId === 'dashboard'`).
- Maintain the rule that when viewed inside a specific workspace dashboard page (`contextId !== 'dashboard'`), the parent workspace/collection root itself is cleanly excluded to prevent redundant self-listing.

### 3. Strategic Reasoning
- **Context-Aware Presentation**: Users navigation expectations differ depending on whether they are in a global or a nested view.
  - On the **Home dashboard**, seeing recently visited workspaces as list entries is highly useful for fast top-level navigation.
  - On a **workspace page**, listing the workspace itself in the recents widget adds unnecessary visual noise.
- **Conditional Filter Move**: By moving the `.filter(e => e.type !== 'workspace' && e.type !== 'collection')` rule inside the `contextId && contextId !== 'dashboard'` check, both design goals are met.

### 4. Detailed Blueprint
- **Files Modified**:
  - `src/components/workspace/widgets/RecentWidget.tsx`
- **Changes Planned**:
  - Relocate workspace/collection filtering inside the specific workspace dashboard conditional block.

### 5. Operational Trace
- **File Edited**: [RecentWidget.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/workspace/widgets/RecentWidget.tsx)
  - Refactored `recentEntities` memo:
    ```tsx
    let list = recentEntityIds.map(id => entities.find(e => e.id === id)).filter((e): e is Entity => !!e);
    if (contextId && contextId !== 'dashboard') {
      list = list.filter(e => e.type !== 'workspace' && e.type !== 'collection');
      ...
    }
    ```

### 6. Status Assessment
- **Completed**: Set conditional recent-workspace filters to keep global dashboard listings complete while keeping workspace dashboards pristine.
- **Verification**: Verified home dashboard lists include workspace entities, and folder dashboard pages skip self-listings.
