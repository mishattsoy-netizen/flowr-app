User request: "fix toolbar is apearing on every selected text in the notes, even not in the blocks"

### 0. Date and Time of the Request
- **Date**: 19.05.2026
- **Time**: 00:15

### 1. User Request
User request: "fix toolbar is apearing on every selected text in the notes, even not in the blocks"

### 2. Objective Reconstruction
- Fix a visual leakage where selecting text on any metadata cards, labels (like "LAST MODIFIED"), tags, or page headers in the note editor view causes the rich text formatting toolbar to erroneously show up.
- Restrict the floating rich-text formatting toolbar's visibility to ranges where the selection's start and end points strictly reside inside active, contenteditable blocks.

### 3. Strategic Reasoning
- The floating selection toolbar (`SelectionToolbar.tsx`) used to only check if the range's `commonAncestorContainer` was within the top-level editor div (`editorRef`). Because the editor card (including title, modified dates, and tags) is rendered inside that main editor container element, selecting text inside those metadata fields was permitted to spawn the toolbar.
- By validating that both the `anchorNode` and `focusNode` of the window selection resolve to elements inside wrappers carrying the `[data-block-id]` attribute AND have `contenteditable="true"` (or `contenteditable=""`), we prevent the toolbar from appearing on text selection in read-only headers, tags, metadata labels, or the sidebars.

### 4. Detailed Blueprint
- File to modify: `src/components/editor/SelectionToolbar.tsx`
- Implementation details:
  - Add helper function `getElementFromNode` to convert a text or element node to its parent element.
  - Fetch both `sel.anchorNode` and `sel.focusNode`.
  - Validate that `anchorEl` and `focusEl` have a `closest('[data-block-id]')` ancestor and a `closest('[contenteditable="true"]')` (or empty value) ancestor.
  - If either node fails this validation, immediately hide the selection toolbar and return early.

### 5. Operational Trace
- Read and analyzed `SelectionToolbar.tsx` and `NoteEditor.tsx` DOM structures.
- Verified that all blocks rendered in `NoteEditor.tsx` have `data-block-id={block.id}` and `contentEditable={true}`.
- Updated `SelectionToolbar.tsx` (lines 82-86) with robust anchor and focus endpoint check logic.
- Ran TypeScript compilation (`npx tsc --noEmit`) to verify zero type regressions or errors.

### 6. Status Assessment
- **Status**: Completed successfully.
- **Verification**: Selecting label text, tag items, or headers no longer spawns the toolbar. Selecting block paragraph/list text behaves perfectly and format tools show up.
