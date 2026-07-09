User request: "Fix dektop ap header in the split page. selected tab in the right collumns must have its own tabs heaer boundaries with the sze oth right collumn, always alighned with left side, same as lef collumn. and switch to single page from split page, the in the no plit layout there are stacked tabs in the left instead of being spread like in desktom app. also in split desktop move read/edit button frin notes collumns to the header in the left side of selected tabs. Also the way i can acivate split screen is by have opened note or canvas then select one more note or canvas in the sidebar and then presssplit page->open both pages in split screen"

### 0. Date and time of the request
July 9, 2026, 14:35

### 1. User request
"Fix dektop ap header in the split page. selected tab in the right collumns must have its own tabs heaer boundaries with the sze oth right collumn, always alighned with left side, same as lef collumn. and switch to single page from split page, the in the no plit layout there are stacked tabs in the left instead of being spread like in desktom app. also in split desktop move read/edit button frin notes collumns to the header in the left side of selected tabs. Also the way i can acivate split screen is by have opened note or canvas then select one more note or canvas in the sidebar and then presssplit page->open both pages in split screen"

### 2. Objective Reconstruction
- Render individual column tab headers on the desktop application in split screen. Each column tab header must align on the left and be bounded by the column's width.
- Hiding main tabs and split view controls from the global HeaderBar in split view to prevent visual redundancies and fix the overlapping/stacked tabs bug in single-page mode when exiting split screen.
- Lift read/edit note state to the global Zustand store and move the NoteEditor's read/edit toggle button to the column header bar next to active tabs in split view.
- Add a sidebar context menu action `"Split page"` to open a sidebar item and the active page side by side.

### 3. Strategic Reasoning
- Lifting the read/edit state into the global Zustand store enables multiple separate layout files (`NoteEditor` and `ColumnHeader`) to share and change the mode instantly.
- Removing the desktop check in `ColumnHeader` utilizes the prebuilt, responsive mobile/web layout architecture on the desktop app, which matches the required boundaries and alignments.
- Rendering global tabs only when `splitViewActive` is false avoids absolute-position overlap calculations on exiting split screen and keeps the DOM layout clean.

### 4. Detailed Blueprint
- **Zustand Store**: Introduce `readModeStates: Record<string, boolean>` state and `setReadMode` action.
- **HeaderBar**: Condition tabs and split view button group on `!splitViewActive`.
- **ColumnHeader**: Remove `isDesktop` early return block. Add Lucide icons and render read/edit toggle next to the tab pill if the active tab is a note.
- **NoteEditor**: Read `isReadMode` from store. Hide the local read/edit button when `splitViewActive` is true.
- **ContextMenu**: Add a sidebar context menu item `"Split page"` when another note/canvas is active.

### 5. Operational Trace
- Added state and action keys in `src/data/store.types.ts` and `src/data/store.ts` and set up store persistence.
- Refactored `src/components/layout/HeaderBar.tsx` to conditionally render tabs and controls when `!splitViewActive`.
- Modified `src/components/layout/ColumnHeader.tsx` to remove the desktop block and inject the BookOpen/Pencil read/edit button.
- Updated `src/components/editor/NoteEditor.tsx` to read the shared edit mode and hide the local button.
- Appended the `"Split page"` action in `src/components/layout/ContextMenu.tsx`.
- Ran `npm run build` which verified compilation correctness.

### 6. Status Assessment
- **Complete**: All requested layouts, buttons, state, and sidebar split activation flows have been implemented.
- **Verification**: Next.js production build succeeded and tests compile correctly.
