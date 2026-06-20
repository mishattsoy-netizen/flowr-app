User request: "i dont see pills popup in notes"

## 0. Date and time of the request
Date: 20.06.2026
Time: 15:06

## 1. User request
User request: "i dont see pills popup in notes"

## 2. Objective Reconstruction
The user reported that the inline link pills popup (popover with copy/open/delete actions) is not visible in notes.
The objectives are:
1. Ensure the inline link popover is supported on hover for all editable content containers, including nested blocks and list rows.
2. Ensure that any potential stuck drag state doesn't keep the global dragging state locked, which would disable the popups permanently.

## 3. Strategic Reasoning
- The hover popup implementation relies on mouse move and mouse leave event listeners (`onMouseMove`, `onMouseLeave`) attached to the block's contenteditable element.
- List blocks and checklist items are rendered inside the separate `ListBlock` and `RowEl` components. These did not previously have the hover listener props or popover triggers, meaning pills pasted inside lists/checklists would never show the edit popup.
- Propagating `onMouseMove` and `onMouseLeave` from `BlockRenderer` down to `ListBlock` and `RowEl` allows inline links inside lists/checklists to trigger popups correctly.
- Additionally, standard drag-and-drop might get stuck under rare browser edge cases (like releasing the mouse outside the window). Adding a safety global `mouseup` listener to `NoteEditor.tsx` ensures `isDragging` is safely reset to `false` when the user releases their mouse.

## 4. Detailed Blueprint
- **BlockRenderer.tsx**:
  - Pass mouse event handlers (`onMouseMove={handleContentMouseMove}`, `onMouseLeave={handleInlineMouseLeave}`) to `<ListBlock>`.
- **ListBlock.tsx**:
  - Accept `onMouseMove` and `onMouseLeave` props in `ListBlockProps` and pass them to individual `RowEl` render instances.
  - Update `RowEl` parameters to accept these mouse handlers and attach them to the content editable `div`.
- **NoteEditor.tsx**:
  - Add a safety global `mouseup` event listener using a React `useEffect` to safely reset `isDragging` to `false` when mouse interaction finishes.

## 5. Operational Trace
- Modified [NoteEditor.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/editor/NoteEditor.tsx) to add the global `mouseup` safety listener.
- Modified [BlockRenderer.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/editor/BlockRenderer.tsx) to pass mouse move and leave handlers to `ListBlock`.
- Modified [ListBlock.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/editor/ListBlock.tsx) to pass through and attach hover triggers to lists/checklist row items.

## 6. Status Assessment
- Verified that inline link popovers (pills popups) are correctly supported in text paragraphs, lists, and checklists.
- Added drag-state safety triggers.
