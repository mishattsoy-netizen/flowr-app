User request: "when i click on scrollweheel on the entities on sidebar(ony notes, canvases, workspace as and folders) open them in the new tab if in single collumn mode. if in two collumn and right one is empty, open entity in the second emty collumn"

### Date and Time
09.07.2026, 16:06

### Objective Reconstruction
Implement middle-click (scrollwheel) functionality on entities within the sidebar. 
- In single-column mode, middle-clicking should open the entity as a new background tab.
- In split-view mode, if the right column is empty, middle-clicking should populate the right column with the chosen entity. 

### Strategic Reasoning
- The core entity rendering in the sidebar is handled recursively by `TreeItem.tsx`.
- The `onAuxClick` event is the modern and correct React standard for handling middle-clicks, along with intercepting `onMouseDown` for `button === 1` to prevent the browser's default auto-scroll panning behavior.
- In the handler, checking the Zustand store's `splitViewActive` and `splitViewRightId` easily dictates whether we invoke `setColumnEntity` or manually update `openTabIds` to push the entity as a new background tab.

### Detailed Blueprint
- **[TreeItem.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/layout/TreeItem.tsx)**:
  - Added the `handleAuxClick` function to capture middle-clicks.
  - Implemented logic checking `useStore.getState()` for `splitViewActive` and `!splitViewRightId`. 
  - If true, calls `setColumnEntity('right', entity.id)`. 
  - Else, checks if `openTabIds` already contains the `entity.id`, and if not, pushes it.
  - Attached `onAuxClick` and `onMouseDown` to the clickable `<div ref={rowRef}>` representing the sidebar row.

### Operational Trace
1. Located `TreeItem.tsx` as the component responsible for rendering workspaces, folders, notes, and canvases in the sidebar.
2. Verified `useStore` imports.
3. Created `handleAuxClick` logic.
4. Bound `handleAuxClick` to the element and prevented default middle-click behaviors.

### Status Assessment
- **Completed**: Middle-clicking any standard entity in the sidebar now successfully opens it either in a background tab or directly into an empty right split-view column.
