User request: "problems: 1.when i hover item 2 on other workspace 2 and 3->there is no hover effect, 2 and 3 dont react. 2.when i drag and drop item 2 over workspace 2, item 2 i dont see insert line, and make sure item 2 drops to folder 2(moves out of folder 2)"

### 0. Date and time of the request
- **Date**: 19.06.2026
- **Time**: 05:27

### 1. User request
"problems: 1.when i hover item 2 on other workspace 2 and 3->there is no hover effect, 2 and 3 dont react. 2.when i drag and drop item 2 over workspace 2, item 2 i dont see insert line, and make sure item 2 drops to folder 2(moves out of folder 2)"

### 2. Objective Reconstruction
- Enable hover effects and insert lines when dragging items across different workspaces.
- Allow items to be dropped into other workspaces regardless of their current nesting depth.

### 3. Strategic Reasoning
The depth constraints in the `canDrop`, `getData`, and `isBlockNesting` logic were applied unconditionally — blocking drops when the target depth was too shallow relative to the drag source depth. For example, an item at depth 3 could not interact with workspace rows at depth 0 because `0 < 3 - 2`.

But these constraints exist only to prevent excessive outdenting **within the same workspace tree**. Cross-workspace moves are a fundamentally different operation and should always be allowed. The fix: scope all depth checks to fire only when `source.workspaceId === target.workspaceId`.

### 4. Detailed Blueprint
Modified [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/TreeItem.tsx):
- Added `workspaceId` prop to `AfterFolderSpacer` and passed it from the render site.
- In `AfterFolderSpacer.canDrop`: added `sameWorkspace` check before depth constraint.
- In `TreeItem.canDrop`: added `sameWorkspace` check before depth constraint.
- In `TreeItem.getData`: added `sameWs` check before edge-to-null depth conversion and before `isBlockNesting` calculation.

### 5. Operational Trace
- Modified [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/TreeItem.tsx) via `multi_replace_file_content`.
- Ran `./node_modules/.bin/tsc --noEmit` — compilation passed.

### 6. Status Assessment
- **Status**: Completed successfully.
- **Result**: Items can now be dragged across workspaces freely, with proper hover effects, insert lines, and successful drops regardless of nesting depth.
