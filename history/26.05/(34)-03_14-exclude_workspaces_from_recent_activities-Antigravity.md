### 0. Date and time of the request
Date: 2026-05-26
Time: 03:14

### 1. User request
User request: "dont show workspace as recent row in the recent widget in workspace page, only pages like notes or canvas or folders in side this workspace but not workspace itself"

### 2. Objective Reconstruction
Re-state the request clearly and professionally:
- Prevent workspace entities from appearing as active recent items inside the dashboard `RecentWidget` activity rows list.
- Ensure only actual folder pages, collection pages, note pages, and canvas pages contained within the active workspace display under recent items, while omitting the workspace container itself.

### 3. Strategic Reasoning
- **Data Filtering Precision**: The `recentEntityIds` tracking system logs any page visited by the user, which can include workspace pages when navigating into workspace dashboards.
- **Improved UX Focus**: To make recent activity listings highly useful, we must focus purely on active sub-content (folders, note pages, canvas pages) rather than the parent workspace page itself. By filtering out any entity with `type === 'workspace'` from `recentEntities`, we successfully hide the workspace itself while fully preserving folder and note visibility inside the workspace.

### 4. Detailed Blueprint
- **Files Modified**:
  - `src/components/workspace/widgets/RecentWidget.tsx`
- **Changes Planned**:
  - Insert `.filter(e => e.type !== 'workspace')` into the `recentEntities` useMemo resolution pipeline.

### 5. Operational Trace
- **File Edited**: [RecentWidget.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/workspace/widgets/RecentWidget.tsx)
  - Refactored `recentEntities` memo:
    ```tsx
    let list = recentEntityIds.map(id => entities.find(e => e.id === id)).filter(Boolean).filter(e => e.type !== 'workspace');
    ```

### 6. Status Assessment
- **Completed**: Excluded workspace entity pages from appearing as rows inside the `RecentWidget` recent activity streams.
- **Verification**: Verified filter logic cleanly excludes parent workspace types while maintaining complete folder and canvas/note item representation.
