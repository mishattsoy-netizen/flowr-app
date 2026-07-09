User request: "i wanted options button in split view to sit on the left side of red/edit mode in the tabs header. and gap from edit button to selected tab must be same as top and bottm gaps so margins around edit and option button are same in the tabs header"

### Date and Time
09.07.2026, 15:37

### Objective Reconstruction
Move the "More Options" (three dots) button from the top right of the note editor into the `ColumnHeader` (tabs header) when in split view. It should sit immediately to the left of the Read/Edit button, with a consistent 7px margin around both buttons and the selected tab pill.

### Strategic Reasoning
- The `ColumnHeader` is 42px high, and the buttons are 28x28px (`w-7 h-7`), creating a natural vertical gap of 7px on the top and bottom.
- To match this visually as requested, the horizontal margin between the Options button, the Read/Edit button, and the Tab pill must be exactly 7px.
- The `MoreVertical` button in `NoteEditor.tsx` was wrapped in a `!splitViewActive` check to remove the old absolute-positioned button when split view is on.
- A new `MoreVertical` options button was added to `ColumnHeader.tsx` which calls `openContextMenu(entityId, x, y, 'tab')` directly, bringing up the global options context menu for the active entity.

### Detailed Blueprint
- **[ColumnHeader.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/layout/ColumnHeader.tsx)**: 
  - Added `MoreVertical` to imports.
  - Rendered the Options Menu Button right before the Read/Edit toggle.
  - Used `mr-[7px]` for both the Options button and the Read/Edit button to achieve perfect equidistant margins.
- **[NoteEditor.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/editor/NoteEditor.tsx)**: 
  - Wrapped the entire top-right controls container in `{!splitViewActive && ( ... )}` so both the edit button and options menu disappear from the canvas area during split view.

### Operational Trace
1. Grepped for "More Options" to find its location in `NoteEditor.tsx`.
2. Reviewed `ColumnHeader.tsx` to figure out the current layout of the read/edit button (`mr-1`).
3. Replaced `mr-1` with `mr-[7px]` in `ColumnHeader.tsx`.
4. Added the Options button with identical `mr-[7px]` layout class, using `useStore.getState().openContextMenu`.
5. Adjusted `NoteEditor.tsx` to conditionally hide both buttons in split view.

### Status Assessment
- **Completed**: The Options button has been moved into the tabs header in split view, sitting on the left of the edit mode button, with uniform 7px gaps around them.
