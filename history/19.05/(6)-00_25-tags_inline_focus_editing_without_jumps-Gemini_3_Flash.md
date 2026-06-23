User request: "fix tags editing mode. teg mustnt change on edit mode, just focus in the text right inside of the tag"

### 0. Date and Time of the Request
- **Date**: 19.05.2026
- **Time**: 00:25

### 1. User Request
User request: "fix tags editing mode. teg mustnt change on edit mode, just focus in the text right inside of the tag"

### 2. Objective Reconstruction
- Fix a visual discrepancy and layout jump in the tags section of the editor when editing a tag:
  - The tag container (pill shape, border color, text color, background color, and delete button) must remain perfectly identical to its display state.
  - The orange focus ring / custom editing classes and layout changes must be completely avoided.
  - The input text field must overlay exactly within the text slot of the tag, adapting its width dynamically to match the content length (`ch` unit) to prevent visual gaps.

### 3. Strategic Reasoning
- Previously, enabling editing mode on a `TagItem` replaced the custom colorful colored pill container classes with `"ring-1 ring-accent bg-background text-foreground border-accent"`, which hid the customized category background and border color and hid the `X` delete button. This caused substantial jumping and layout shifts.
- By retaining the exact background, border, text color, and outer padding styles on the pill-shaped `div` container at all times (and keeping the `X` button rendered regardless of edit state), the tag pill remains completely stable.
- Inside the tag, swapping the `<span className="truncate max-w-[120px]">` with an unstyled `<input>` that inherits style properties (font, color) and sets its CSS width to `Math.max(editValue.length, 2)ch` allows the user to click, focus, select, and edit the tag name right inside the tag itself with zero layout jumps or text shifting.

### 4. Detailed Blueprint
- File modified: `src/components/editor/NoteEditor.tsx`
- Edits in `TagItem` return block:
  - Keep `colors.bg`, `colors.text`, and `colors.border` on the container `div`'s `style` attribute in both editing and display modes.
  - Maintain the container's className and hover brightness effects when `!isEditing`.
  - In edit mode, render the `<input>` element directly where the text `span` was, giving it an unstyled, fluid appearance.
  - Keep the `<button>` and `<X className="w-3 h-3" />` delete element rendered and clickable in both display and editing modes.

### 5. Operational Trace
- Discovered that line-endings in `NoteEditor.tsx` were CRLF (`\r\n`), causing multi-line replaces to fail.
- Created and executed a node scratch script at `/scratch/normalize_line_endings.js` to normalize the line endings to LF (`\n`).
- Surgically updated `TagItem` in `NoteEditor.tsx` with unified container styles and fluid inline text input.
- Validated build safety with `npx tsc --noEmit` and confirmed zero regressions.

### 6. Status Assessment
- **Status**: Completed successfully.
- **Verification**: Clicking a tag enters editing mode seamlessly. The tag's visual shell remains completely identical, while the text itself transforms into a focused, editable text input that resizes dynamically with each character typed. Clicking the "x" button deletes the tag as expected.
