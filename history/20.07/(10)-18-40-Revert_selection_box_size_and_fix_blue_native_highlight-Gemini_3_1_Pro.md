User request: "why is block getting bger when i select it?"

## 0. Date and time of the request
20.07.2026, 18:40

## 1. User request
User request: "why is block getting bger when i select it?"

## 2. Objective Reconstruction
The user noticed that the previous fix caused the block to visually expand (become wider and taller) when selected, because the background moved from the inner text wrapper to the outer container. Additionally, re-evaluating the user's previous complaints ("talking about blue one") revealed that the actual "text selection box" they disliked was the browser's native blue text highlight, not the CSS `.selected-block` background. 
The objective is to revert the selection background size so it perfectly matches the hover state, and aggressively prevent the native blue text highlight from appearing when clicking the drag handle.

## 3. Strategic Reasoning
The visual size change happened because the outer block container (`.editor-block`) includes padding and spans full-width, making it larger than the inner text wrapper (`.flex-1.flex.items-start`). Reverting the `.selected-block` rule back to the inner wrapper restores the exact 1:1 visual match with the hover state.
To fix the *real* issue—the native blue text selection that appears when you click the drag handle—we need to clear the browser's selection state. Since `contentEditable` areas can easily trigger selection on mouse events, I added `window.getSelection()?.removeAllRanges()` to both `onMouseUp` and the `handleGripClick` logic. This ensures the native "blue" highlight never flashes or stays on screen when the block is selected.

## 4. Detailed Blueprint
- Revert `globals.css` to apply `.selected-block` styles back to `.flex-1.flex.items-start` and `.relative.w-full`.
- Update `BlockRenderer.tsx` to add `window.getSelection()?.removeAllRanges()` to `handleGripClick` and `onMouseUp` on the drag handle.

## 5. Operational Trace
- Used `multi_replace_file_content` to modify `globals.css` at line 1295.
- Used `multi_replace_file_content` to modify `BlockRenderer.tsx` at line 1648 and 1686 to clear text selection during click and mouseup events.

## 6. Status Assessment
Completed. The block no longer changes size when selected (it stays identical to the hover size), and the native blue text selection that caused the "double box" effect is aggressively suppressed.
