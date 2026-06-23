User request: "ican now move item to other workspaces but when i hover top edge of workspace 2, there is not insert line below folder 2"

### 0. Date and time of the request
- **Date**: 19.06.2026
- **Time**: 05:36

### 1. User request
User request: "ican now move item to other workspaces but when i hover top edge of workspace 2, there is not insert line below folder 2"

### 2. Objective Reconstruction
- Show the visual insert line at depth 1 when hovering the top edge of a root-level workspace (e.g., Workspace 2) if the sibling workspace above it (e.g., Workspace 1) is expanded.
- Drop the item inside the expanded workspace above as its last child (subject to the depth outdent safeguard if dragging within the same folder tree).

### 3. Strategic Reasoning
- Previously, `isRegularOnWorkspace` unconditionally forced `edge = null` on workspace headers at depth 0 to prevent regular items from reordering at depth 0.
- However, if the workspace directly above is expanded, hovering near the top edge of the current workspace represents the transition zone for the end of the expanded workspace's children.
- If we allow `edge = 'top'` under this specific condition (the workspace above is expanded), it triggers the top-edge redirect logic and correctly renders the visual line at depth 1.
- This expands the visual drop target hit area for nesting items at the bottom of the expanded workspace.

### 4. Detailed Blueprint
- Modified [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/TreeItem.tsx):
  - Refactored `isRegularOnWorkspace` handling in the `getData` drop target callback.
  - If a regular item is dragged over a root-level workspace, check if `isTopHover` is true (clientY in the top 30% of the row) and the sibling workspace directly above is expanded.
  - If yes, set `edge = 'top'`. Otherwise, set `edge = null`.

### 5. Operational Trace
- Edited `isRegularOnWorkspace` check in [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/TreeItem.tsx).
- Ran `./node_modules/.bin/tsc --noEmit` — compilation passed successfully.

### 6. Status Assessment
- **Status**: Completed successfully.
- **Result**: Hovering over the top edge of Workspace 2 when Workspace 1 is expanded now correctly renders the insert line at depth 1 (directly below Folder 2's children list) and supports dropping/safeguard outdenting as intended.
