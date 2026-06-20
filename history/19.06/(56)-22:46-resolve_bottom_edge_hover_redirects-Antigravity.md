Date: 19.06.2026
Time: 22:46

User request: "few more problems: when i drag item 1 to bottom edge of item 2->show insert line under item 2 inside folder 2 depth. also problem: when i drag item 1 to top edge of folder 1 i see insert line above it, this is correct but when i hover bottm edge i dont see insert line under, there should be insert line above folder 2(sibling), instead i just see highted folder 1. analyze plan and fix without breaking any other behaviours"

### 2. Objective Reconstruction
- Ensure that dragging an item to the bottom edge of a nested leaf item (e.g. `Item 2` at depth 3) correctly renders the horizontal insertion line under the item at the correct child depth (depth 3).
- Ensure that dragging an item to the bottom edge of an expanded folder (e.g. `Folder 1`) does not simply highlight the folder. Instead, it must show an insertion line above the folder's first child (e.g. `Folder 2` sibling) at the child depth (depth 2), representing dropping it inside the folder as its first child.

### 3. Strategic Reasoning
- For expanded folders, hovering over the bottom 30% of their header row is visually adjacent to their first child's top edge. Thus, we redirect bottom-edge drops on expanded folders to top-edge drops on their first child. This maps the visual line and final drop coordinates to the top of the first child at `depth + 1`.
- For `AfterFolderSpacer` (which represents the gap at the bottom of an expanded folder's children list), the visual line should always be drawn at `depth + 1` (the child depth) and resolve to `isInsertInsideBottom: true` (appending to the bottom of the children list). This ensures that any allowed item can be dropped at the bottom of the folder's children, resolving the issue where items from shallower depths or other workspaces had their visual insertion line blocked or drawn at incorrect depths because of non-sibling outdent calculations.

### 4. Detailed Blueprint
- [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/TreeItem.tsx):
  - In `AfterFolderSpacer`, simplify the `canDrop` logic to remove `dragDepth` constraints, set `isInsertInsideBottom: true` and `isAfterFolder: false` unconditionally, and set `displayDepth = depth + 1`.
  - In `TreeItem.getData`, remove the `!isExpanded` check when calculating `edge = 'bottom'` on container/folder rows.
  - In `TreeItem.getData`, implement a bottom-redirect block: `if (edge === 'bottom' && isFolder && isExpanded)`, redirect the drop target (`redirectedId`, `redirectedEntity`, `edge`, `redirectedDepth`) to the first child of the expanded folder with `edge = 'top'` and `redirectedDepth = depth + 1`.
- [Sidebar.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/Sidebar.tsx):
  - In `onDrop`, implement bottom-redirect drop logic for expanded folders: `if (edge === 'bottom' && isOverExpanded)`, redirect the target `overId`, `overEntity` to the first child's ID and instance, and set `edge = 'top'`.

### 5. Operational Trace
- Edited [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/TreeItem.tsx):
  - Refactored `AfterFolderSpacer` to simplify its state variables and drop rules.
  - Removed duplicate return block in `TreeItem.tsx` at the end of the spacer.
  - Implemented bottom-edge redirects to folder children in `getData`.
- Edited [Sidebar.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/Sidebar.tsx):
  - Added bottom-edge drop redirection logic in `onDrop`.

### 6. Status Assessment
- Dragging a regular item to the bottom of `Item 2` now correctly triggers the spacer at depth 3 and displays the visual insertion line under `Item 2` at depth 3.
- Hovering over the bottom of `Folder 1`'s header row redirects to `Folder 2`'s top edge, drawing the line above `Folder 2` at depth 2 and dropping it as the first child of `Folder 1`.
- All other reordering and hierarchy constraints remain completely functional.
