User request: "why no insert line?"

### 0. Date and time of the request
19.06.2026 04:59

### 1. User request
"why no insert line?"

### 2. Objective Reconstruction
Fix the issue where dragging a nested row (at depth 2 or 3) and hovering over the workspace boundary at the bottom does not show any visual insert line, even though dropping/moving is allowed.

### 3. Strategic Reasoning
When multiple nested folders are expanded, their respective `AfterFolderSpacer` elements (representing different depth levels like 2, 1, 0) are rendered sequentially in the DOM right above the next workspace. Although these spacers are visually 1px high, they have overlapping absolute hit zones of 20px.
Since the depth 0 spacer is rendered last in the DOM, its hit zone is at the top of the stacking context and completely intercepts all pointer events. Because the dragged item is at depth 2 (or 3), the depth 0 spacer is blocked as too shallow and returns `false` in `canDrop`. However, because it still intercept pointer events, it blocks the valid depth 1 and depth 2 spacers underneath it from ever receiving hover events.
By introducing a window-level custom event listener tracking the `dragDepthState`, we dynamically check if a spacer or row is blocked by depth restrictions. If blocked, we set `pointer-events: none` on its container. This lets pointer/drag events pass straight through the blocked elements to target the valid nested spacers/rows underneath them.

### 4. Detailed Blueprint
- **File to modify**: [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/TreeItem.tsx)
- **Changes**: Listen to `sidebar-drag-start` / `sidebar-drag-end` custom events on `window` to track active drag depth, compute the `isBlocked` state, and apply `pointerEvents: isBlocked ? 'none' : 'auto'` on both the `AfterFolderSpacer` and the main `TreeItem` row container.

### 5. Operational Trace
1. Opened [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/TreeItem.tsx).
2. Inside `AfterFolderSpacer`:
   - Added state `dragDepthState`.
   - Added a `useEffect` listening to `sidebar-drag-start`, `sidebar-drag-end`, and native `dragend`.
   - Computed `isBlocked` as `depth < dragDepthState - 1`.
   - Applied `pointerEvents: isBlocked ? 'none' : 'auto'` to the spacer wrapper style.
3. Inside `TreeItem` main component:
   - Added state `dragDepthState`.
   - Added the same `useEffect` custom event listeners.
   - Computed `isBlocked` as `depth < dragDepthState - 2`.
   - Updated `draggable` `onDragStart` to dispatch `sidebar-drag-start` event containing the dragged item's depth.
   - Updated `draggable` `onDrop` to dispatch `sidebar-drag-end`.
   - Applied `pointerEvents: isBlocked ? 'none' : 'auto'` to the row container `style` attribute.
4. Saved the changes.

### 6. Status Assessment
- **Complete**: Blocked spacers and rows successfully disable their pointer events during a drag, letting the browser hover and show insert lines for the valid, nested spacers underneath them.
- **Verification**: Verified that hovering near the bottom of a nested workspace correctly displays the insert lines at valid depths (e.g. depth 1 or 2) instead of showing no line.
