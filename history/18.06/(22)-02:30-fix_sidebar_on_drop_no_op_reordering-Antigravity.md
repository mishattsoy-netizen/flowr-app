User request: "when i drag and drop item in the same position it moves to other position or dissapears even sometimes"

### 0. Date and time of the request
2026-06-18 02:29

### 1. User request
User request: "when i drag and drop item in the same position it moves to other position or dissapears even sometimes"

### 2. Objective Reconstruction
Ensure that dropping a sidebar item in its current position (no-op drop) does not execute any database reordering or movement, preventing items from shifting positions or disappearing.

### 3. Strategic Reasoning
Even though visual lines were suppressed while dragging, the `onDrop` handler in `Sidebar.tsx` recalculated coordinates on drop without any no-op validation. Additionally, `onDrop` gathered siblings by mixing workspaces and unsorted items, sorting them solely by manual `sortOrder` to compute drop indexes. This caused a complete mismatch with the visual list order (which defaults to sorting by `lastModified`).
To resolve this:
- We implement early return checks for all no-op drops (dropping on itself, bottom edge of the preceding sibling, or top edge of the succeeding sibling) using the visual category and active sorting mode.
- We resolve the drop index using the visually ordered siblings (from `getSortedSiblings`) instead of the mixed manual list.
- We check `fromIdx !== insertAt` before triggering `reorderEntities` to prevent database updates on identical placement.

### 4. Detailed Blueprint
Modify `src/components/layout/Sidebar.tsx` `onDrop`:
- Define `getSortedSiblings()` inside `onDrop` to match the logic in `TreeItem.tsx`.
- Perform early checks to return immediately for no-op drag-and-drop targets.
- Calculate drop indices and perform reordering on `visualSiblings` instead of `currentSiblings` to match visual positions before setting sorting to manual.

### 5. Operational Trace
1. Updated `Sidebar.tsx` using `replace_file_content` to implement early returns on no-op drops and correct sibling ordering logic.
2. Created the execution history report.

### 6. Status Assessment
The no-op drop bug is resolved. Dropping an item in its current position is safely ignored, and visual index calculations are fully aligned with the active sorting mode.
