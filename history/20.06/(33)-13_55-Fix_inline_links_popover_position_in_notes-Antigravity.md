# History Report

### 0. Date and Time
2026-06-20 13:55

### 1. User Request
User request: "good now fix popups position in chat" -> corrected: "i mean in notes"

### 2. Objective Reconstruction
Resolve the alignment offset and incorrect absolute rendering location of inline link popups/popovers when hovering over or interacting with pills (`.inline-link-btn`) inside note editor blocks.

### 3. Strategic Reasoning
- **Why it occurred**: The popup was triggered by a virtual `<div />` with `position: fixed` using absolute viewport coordinate bounds (`activeInlineBtn.rect.left` and `activeInlineBtn.rect.top`). However, the note editor blocks are rendered inside a scrollable container with transform classes. Any ancestor with CSS `transform` or `filter` acts as the new positioning boundary for `position: fixed` descendants, shifting the popover way off target.
- **Approach**: 
  - Change the positioning context of the popover trigger to `position: absolute`.
  - Calculate relative offset coords inside the block rendering pipeline by subtracting the block wrapper container bounds (`blockRect`) from the viewport coordinate bounds of the button (`activeInlineBtn.rect`).
  - By mounting the trigger as an absolute element inside the relative block wrapper container, it aligns exactly on top of the DOM link button, moving correctly even when the note editor is scrolled.

### 4. Detailed Blueprint
- **Files Involved**:
  - `src/components/editor/BlockRenderer.tsx`
- **Key Logic**:
  - Retrieve the bounding client rect of `elementRef.current`.
  - Compute `triggerLeft = activeInlineBtn.rect.left - blockRect.left` and `triggerTop = activeInlineBtn.rect.top - blockRect.top`.
  - Mount PopoverTrigger wrapped `div` with calculated style offsets.

### 5. Operational Trace
- Added relative coordinate calculation code to the render method body in `src/components/editor/BlockRenderer.tsx`.
- Changed `position: 'fixed'` to `position: 'absolute'` in the PopoverTrigger `div` styling, replacing viewport coordinates with `triggerLeft` and `triggerTop`.

### 6. Status Assessment
- **Status**: Completed.
- **Fixed**: Inline link popovers inside notes are now anchored correctly over their respective pill buttons and move fluidly on page scroll.
- **Remaining**: None.
