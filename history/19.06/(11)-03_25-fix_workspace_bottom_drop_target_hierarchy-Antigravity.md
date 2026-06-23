User request: "problem, i can drag row in the bottom of unfolded workspace with children nsert line has workspace level width and when i drop, row drops to unsorted, i think this scenario, insert line is displayed at depth 0(workspaces) and when i drop, item goes to unsorted because i cant drop item on that depth, insted i should see 1 septh(inside worspace root)"

# 0. Date and time of the request
June 19, 2026 at 03:23 AM

# 1. User request
"problem, i can drag row in the bottom of unfolded workspace with children nsert line has workspace level width and when i drop, row drops to unsorted, i think this scenario, insert line is displayed at depth 0(workspaces) and when i drop, item goes to unsorted because i cant drop item on that depth, insted i should see 1 septh(inside worspace root)"

# 2. Objective Reconstruction
Prevent regular items (notes, canvas, folders) from dropping at depth 0 (workspace parent level) when dragged below the children of an expanded workspace or collection. Instead, visual drop indicators and drop coordinates should target depth 1 (the workspace's own root level) and insert the item at the bottom of the workspace's children.

# 3. Strategic Reasoning
*   **Prevent Depth 0 Drops**: Regular items cannot exist as top-level workspaces or collections. Dropping them at depth 0 sets their parent to `null`, which causes them to incorrectly filter into the "Unsorted" section.
*   **Depth Offset in Spacer**: We expose `entityType` in the drag data wrapper. If a regular item is dragged over a root-level workspace/collection spacer (depth 0), the spacer aligns its visual indicator line at depth 1 (`depth + 1`) and returns a custom drop attribute: `isInsertInsideBottom: true`.
*   **Inside Insertion**: In the drop handler inside `Sidebar.tsx`, detecting `isInsertInsideBottom` overrides the target edge to `null` (nest inside) and redirects the item's parent to the workspace/collection ID.
*   **Reordering at Bottom**: Setting `toIdx = visualSiblings.length` when the drop target is the parent itself (i.e. `toIdx === -1`) ensures that the item is appended at the very bottom of the children list during the `arrayMove` reordering cycle.
*   **Workspace Row Hover**: Similarly, if a regular item is dragged directly onto a workspace header row, we force the edge to `null` to highlight it as a folder drop target and only allow nesting inside, blocking invalid parent-level reorderings.

# 4. Detailed Blueprint
*   Modify `TreeItem.tsx`:
    *   Expose `entityType: entity.type` in the initial draggable data.
    *   Update `AfterFolderSpacer` to check `source.data.entityType` and dynamically return `isInsertInsideBottom: true` and `isAfterFolder: false` when a regular item is dragged over a root-level folder. Adjust `displayDepth` to 1.
    *   In the `rowRef` drop target `getData` handler, check `isRegularOnWorkspace` (hovering a root-level workspace with a regular item) and force `edge = null`.
*   Modify `Sidebar.tsx`:
    *   In the element monitor `onDrop` handler, translate `isInsertInsideBottom` to `edge = null`.
    *   Default `toIdx` to `visualSiblings.length` when target sibling index is not found (`toIdx === -1`), enabling correct bottom-append sorting inside folders and workspaces.

# 5. Operational Trace
*   Modified [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/TreeItem.tsx):
    *   Exposed `entityType` in `getInitialData` on line 226.
    *   Rewrote `AfterFolderSpacer` on line 37 to check `source.data.entityType`, set `isInsertInsideBottom`, and compute `displayDepth`.
    *   Modified `rowRef` drop target edge calculation on line 293 to force `edge = null` for regular items dragged onto workspaces.
*   Modified [Sidebar.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/Sidebar.tsx):
    *   Added `isInsertInsideBottom` check on line 363 to force `edge = null`.
    *   Updated default `toIdx` assignment on line 504 to `visualSiblings.length`.

# 6. Status Assessment
*   Regular items can no longer drop at depth 0 when dragged below the children of workspaces/collections.
*   The visual insert line correctly aligns at depth 1 (indented) when hovering below workspace children.
*   Dropping on the spacer or row correctly inserts the item at the bottom of the workspace's children.
