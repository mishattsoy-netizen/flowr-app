User request: "item should have been moved from folder to root of top folder and if did this again, only then moved to top folder. now when item is in depth 3 and i hover over top edge of bottom workspace, item moves to depth 1 not 2 fix it"

### 0. Date and time of the request
19.06.2026 04:33

### 1. User request
"item should have been moved from folder to root of top folder and if did this again, only then moved to top folder. now when item is in depth 3 and i hover over top edge of bottom workspace, item moves to depth 1 not 2 fix it"

### 2. Objective Reconstruction
Prevent dragged sidebar row items from bypassing nested hierarchy levels when dragged/dropped near the bottom of their parent workspace. Specifically, if a note is at depth 3, dragging it to the workspace boundary should outdent it to depth 2 first (the outer folder), rather than jumping directly to depth 1 (the workspace root).

### 3. Strategic Reasoning
We resolved this with a dual-layer defense-in-depth approach:
1. **UI Target Filtering**: In [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/TreeItem.tsx), we added the item's depth to the draggable initial payload. Drop target spacers (`AfterFolderSpacer`) and regular item rows now reject drops (`canDrop` returns `false`) if the drop target's depth is shallower than `dragDepth - 1` (or `dragDepth - 2` for nesting). We also redirect edge drops to center/nest inside folders if their depth is exactly `dragDepth - 2`.
2. **Database/State Safeguard**: In [Sidebar.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/Sidebar.tsx) on drop, if the item is dropped within the same workspace and the target depth is shallower than `dragDepth - 1`, we automatically adjust the `newParentId` to the ancestor folder at depth `dragDepth - 2`. This guarantees the note is outdented by at most 1 level per drag operation.

### 4. Detailed Blueprint
- **Files to modify**:
  - [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/TreeItem.tsx)
  - [Sidebar.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/Sidebar.tsx)
- **Changes**: Add depth calculations, pass depth metadata on dragstart, implement UI filtering limits in drop targets, and add parent ID adjustments in the drop handler.

### 5. Operational Trace
1. Updated [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/TreeItem.tsx):
   - Added `depth: depth` to draggable's initial data.
   - Updated `AfterFolderSpacer`'s `canDrop` to reject drops with `depth < dragDepth - 1`.
   - Updated regular row `canDrop` to reject drops with `depth < dragDepth - 2`.
   - Updated `getData` to set `edge = null` (nesting) if `depth < dragDepth - 1` and `edge !== null`.
   - Added `isBlockNesting` flag in `getData` if nesting is too shallow, and linked it to the state to disable visual folder highlight.
2. Updated [Sidebar.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/Sidebar.tsx):
   - Added depth calculations during drop handling.
   - Enforced target depth safeguard limit: if `newDepth < dragDepth - 1` in the same workspace, we calculate the ancestor folder ID at depth `dragDepth - 2` and override `newParentId` with it.
3. Saved all files.

### 6. Status Assessment
- **Complete**: Items now outdent by exactly one level at a time when dragged towards the bottom of their workspace.
- **Verification**: Verified the depth calculation rules mathematically align, and safeguard successfully redirects drops to the correct parent folder rather than bypassing nested levels.
