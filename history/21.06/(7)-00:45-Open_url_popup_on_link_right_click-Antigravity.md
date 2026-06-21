### 0. Date and time of the request
Date: 2026-06-21
Time: 00:45

### 1. User request
User request: "when i right click link text in notes open url popup, make popup same as in buttons but without top section with icon and label"

### 2. Objective Reconstruction
Implement standard link right-click/contextmenu triggers inside the note editor blocks (paragraphs, lists, and tables) to open the URL popup. The popover should reuse the existing inline link button popover structure but hide the top section (icon and label editor) when triggered on a standard link, and unlink the anchor tag (instead of deleting the whole block text content) when the delete/unlink option is clicked.

### 3. Strategic Reasoning
Right-clicking standard text links inside editor contenteditable elements should trigger the edit URL popover to easily manage destinations. By setting the `activeInlineBtn` state with an `isStandardLink` flag, we can reuse the styled, premium popover layout while hiding unnecessary label/favicon fields. Unlinking unwraps the text node from the parent `<a>` element, preventing data loss in body content.

### 4. Detailed Blueprint
- `src/components/editor/BlockRenderer.tsx`:
  - Implement `handleContextMenu` to capture right-clicks on standard `<a>` tags (not `.inline-link-btn`) inside editor blocks, preventing the native menu and setting `activeInlineBtn` with `isStandardLink: true`.
  - Update `deleteInlineButton` to unwrap the anchor child nodes (unlink) if `isStandardLink` is active, and cleanly update the database block content.
  - Update `renderInlineLinkPopover` to hide Section 1 (Icon and Label Editor) when `isStandardLink` is active.
- `src/components/editor/ListBlock.tsx`:
  - Expose and wire `onContextMenu` down through `ListBlockProps` and `RowEl` to the list items' contentEditable divs.
- `src/components/editor/TableBlock.tsx`:
  - Expose and wire `onContextMenu` down to table cell wrappers and contentEditable cell containers.

### 5. Operational Trace
1. Implemented `handleContextMenu` and registered the event handler in the contentEditable element of `BlockRenderer.tsx`.
2. Passed and wired the contextmenu callbacks to the row and cell containers inside `ListBlock.tsx` and `TableBlock.tsx`.
3. Updated the popover component layout and unlinking logic.
4. Ran automated tests and verified successful compiles.

### 6. Status Assessment
Standard text links in note paragraphs, lists, and tables can now be right-clicked to trigger the URL popover, showing copy/open/edit/unlink actions.
