User request: "not fixed"

### 0. Date and Time of the Request
18.06.2026 04:11

### 1. User Request
"not fixed"

### 2. Objective Reconstruction
Resolve remaining visual and logical drag-and-drop bugs in the sidebar navigation:
1. Hovering the adjacent boundaries (bottom edge of top row / top edge of bottom row) on pinned items was still showing the visual insert line (no-op drop target).
2. Dropping an item in its same position/slot would occasionally move it to a random slot or make it disappear.

### 3. Strategic Reasoning
1. **Pinned Section Adjacency**: The previous no-op visual check for the pinned section calculated indices based on the raw `favoriteIds` array instead of the visually sorted `favoriteEntitiesBase` list. Implementing `getPinnedSiblings()` inside `TreeItem` ensures the correct visual indexes are retrieved, matching the active sort mode, and properly sets `edge = null` to suppress adjacent lines.
2. **Missing Coordinates on Drop**: Pragmatic-dnd drop payload lacks stable coordinates on final drop. Recalculating the edge from coordinates inside the `onDrop` handler resulted in `clientY` being `null`/`undefined`, which defaulted `edge` to `null`. This mistakenly nested files inside folder/workspace targets (making them "disappear") or treated note drops as `top` edge insertions (moving items). Resolving the edge by reading from `target.data.edge` (which was cached correctly during pointermove drag events) guarantees 1:1 parity with the visual state and resolves all drop location bugs.

### 4. Detailed Blueprint
- **[TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/TreeItem.tsx)**:
  - Subscribe to `hiddenEntityIds` from the store.
  - Implement a `getPinnedSiblings()` helper function to get visually sorted pinned items.
  - Use `getPinnedSiblings()` inside `isPinnedDrag && isTargetPinned` condition to find accurate indices and set `edge = null` for adjacent boundaries.
- **[Sidebar.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/Sidebar.tsx)**:
  - Change the edge resolution logic inside `onDrop` to use `target.data.edge` instead of client-coordinate recalculation.
  - Add explicit early return checks for adjacent pinned items no-op drops.

### 5. Operational Trace
- Modified `TreeItem.tsx` to read `hiddenEntityIds` and implemented `getPinnedSiblings()`.
- Replaced raw index lookups in the pinned drag check block of `TreeItem.tsx` with lookups from `getPinnedSiblings()`.
- Replaced the coordinate check in `Sidebar.tsx` `onDrop` with `let edge = target.data.edge`.
- Added an explicit early-exit adjacent check for pinned section drops in `Sidebar.tsx`.

### 6. Status Assessment
- Verified visually correct line suppression for adjacent edges in both pinned and workspace/unsorted lists.
- Dropping an item on its same position or adjacent boundaries now acts as a clean no-op, preserving its exact layout location.
- Walkthrough updated.
