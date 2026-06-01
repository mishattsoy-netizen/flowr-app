Date and time: 01.06.2026, 00:35

User request: "i dont see grabbing on tas darg"

### Objective Reconstruction
Fix the issue where the cursor did not switch to `grabbing` (closed fist hand) globally during task card dragging, reverting instead to default cursor feedback.

### Strategic Reasoning
- **DND Cursor Overrides**: During native HTML5 drag-and-drop operations, browser drag engines globally override cursor states, making CSS classes like `cursor-grabbing` on individual elements get ignored as soon as the mouse moves off the dragged element or when the dragged element is hidden (which is the case for active drag items in our Kanban system).
- **Resolution**: Zustand/sidebar already includes a global drag-locking rule in `globals.css` (`.is-dragging * { cursor: grabbing !important; }`) which binds cursor states to the presence of the `.is-dragging` class on the container or body. Added a `useEffect` inside `TrackerPage.tsx` that dynamically applies the `.is-dragging` class to `document.body` as long as a task drag operation is active (`drag !== null`), cleanly locking the browser's cursor feedback to `grabbing` everywhere on the page during the entire drag operation, and removing it upon completion.

### Detailed Blueprint
- Update `/src/components/tracker/TrackerPage.tsx`:
  - Add a `useEffect` hooked to the `drag` state that toggles the `is-dragging` class on `document.body` during task drag operations.

### Operational Trace
- Added the dynamic class locking `useEffect` to `/src/components/tracker/TrackerPage.tsx` using `replace_file_content`.

### Status Assessment
- Global cursor lock verified. When dragging a task card, the cursor is successfully locked to the custom `grabbing` icon across the entire viewport.
