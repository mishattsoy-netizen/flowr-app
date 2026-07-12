# Fix Legacy Block Editor Issues

We will fix the 8 issues you reported with the old block editor. 

## Proposed Changes

### 1. Selection & Cursor Fixes
- **Cursor UI**: Remove any `cursor-crosshair` or `cross` cursors. Ensure the drag handle uses `grab`/`grabbing`, and text uses `text` (I-beam).
- **Text Selection**: Implement a more seamless selection experience. We'll adjust `user-select` CSS properties so that dragging from outside a block doesn't break selection, and ensure the container allows pointer events to pass through correctly.

### 2. Undo / Redo (Ctrl+Z)
- Implement a custom history stack for the active note.
- Intercept `Ctrl+Z` (Undo) and `Ctrl+Shift+Z` or `Ctrl+Y` (Redo) to traverse the history stack, restoring the `blocks` state and syncing it with the store.

### 3. Native Selection Toolbar
- Create a floating `SelectionToolbar` component that listens to `document.onselectionchange`.
- When text within a block is selected, the toolbar will appear near the cursor offering `Bold`, `Italic`, `Underline`, `Strikethrough`, and `Code` formatting via standard `document.execCommand`.

### 4. Bottom Area Focus & Block Creation
- Refine the click handler on the empty editor background.
- When clicking the empty space, a new block is created. We will use `requestAnimationFrame` to guarantee the cursor is instantly focused into the new text area so you can start typing without wondering if it worked.

### 5. Keyboard Shortcuts (Enter / Shift+Enter / Ctrl+Enter)
- **Shift+Enter**: Force create a new block below the current one, moving the cursor to it.
- **Enter**: 
  - If in a list: Create a new list row.
  - If in regular text: Create a soft line break (`<br>`) within the same block.
- **Ctrl+Enter**: 
  - If in a list: Break out of the list and create a regular block below.
  - If in regular text: Same as regular break or create a new block.

### 6. Fix Focus Loss on Enter
- When pressing Enter (e.g. creating a new list item), the focus currently drops because the React state updates and the DOM node is recreated/appended. We will implement deterministic focus restoration by tracking the `newlyCreatedBlockId` and focusing it after the render cycle.

### 7. Block and Text Colors
- Fix the `BlockOptionsMenu` color selection. Ensure that choosing a text color or background color correctly updates the `block.textColor` and `block.backgroundColor` properties in the store.
- Update `BlockRenderer` to read these properties and apply them via inline styles (`style={{ color: block.textColor, backgroundColor: block.backgroundColor }}`).

## Open Questions
- For the Text Selection issue (Point 1), standard contenteditable `div`s (which our blocks use) don't naturally allow selecting text *across* multiple separate blocks at once smoothly. Are you okay with a workaround where selecting across blocks highlights the blocks themselves (like Notion), or do you strictly need seamless text-level selection across boundaries?

If you approve this plan, I'll start implementing these fixes immediately!
