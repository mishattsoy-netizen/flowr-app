User request: "still there. i want talking about blue one. there is a block effect, and there is another box inside a block that hihglights in the text area, its a bit lighter then blobk bg color"

## 0. Date and time of the request
20.07.2026, 17:42

## 1. User request
User request: "still there. i want talking about blue one. there is a block effect, and there is another box inside a block that hihglights in the text area, its a bit lighter then blobk bg color"

## 2. Objective Reconstruction
Fix the double-box highlight effect that occurs when a block is selected via the drag handle. The user was seeing a darker outer background (the native cross-block selection effect) and a lighter inner background (the actual `.selected-block` effect on the text wrapper), causing a confusing nested-box visual.

## 3. Strategic Reasoning
When a block is selected by clicking the drag handle, it gains the `.selected-block` class. This class applies `var(--bone-6)` to the inner text wrapper (`.flex-1.flex.items-start`). However, clicking the drag handle can also unintentionally trigger the browser's native text selection. 
In `globals.css`, there was a rule `.editor-block:has(::selection)` which applies a very faint background (`var(--bone-3)`) to the *entire outer block container* whenever native text selection occurs. 
Since both were happening simultaneously, the user saw the outer container turn `var(--bone-3)` (which they called the "block effect") and the inner text area turn `var(--bone-6)` (the actual selection effect, which is lighter).
The solution is to ensure `.editor-block:has(::selection)` is ignored on blocks that are already explicitly `.selected-block`. I also added `select-none` to the drag controls to stop the native selection from triggering in the first place.

## 4. Detailed Blueprint
- Update `globals.css` to change `.editor-block:has(::selection)` to `.editor-block:not(.selected-block):has(::selection)`.
- Update `BlockRenderer.tsx` to add `select-none` to the `BlockControls` wrapper so that clicking it does not initiate a text selection drag.

## 5. Operational Trace
- Used `multi_replace_file_content` to modify `globals.css` at line 1749.
- Used `multi_replace_file_content` to modify `BlockRenderer.tsx` at line 1663 to add `select-none` to the `BlockControls` div.

## 6. Status Assessment
Completed. The conflicting outer text selection background will no longer render when a block is explicitly selected, leaving only a single, clean block-level highlight.
