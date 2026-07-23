User request: "when i click on the drag handle and block selectes, remove this text selection box effect, just keep the block effect"

## 0. Date and time of the request
20.07.2026, 17:37

## 1. User request
User request: "when i click on the drag handle and block selectes, remove this text selection box effect, just keep the block effect"

## 2. Objective Reconstruction
Remove the native browser text selection highlight (the blue "text selection box effect") that appears when a user clicks the drag handle to select a block, while preserving the block-level selection effect (the grey background).

## 3. Strategic Reasoning
When a user clicks the drag handle, the block is added to the `selectedBlockIds` state, which applies the `.selected-block` class to the block container. This applies the visual block effect (a light background color). However, the browser's native `mousedown`/`mouseup` events in the `contentEditable` area can still inadvertently cause the text inside the block to become natively highlighted (selected by the browser), creating an unwanted blue highlight effect over the text itself.
By adding `user-select: none` to the `.selected-block` CSS rule in `globals.css`, we ensure that any block currently marked as "selected" by the application will naturally repel the browser's native text selection, immediately hiding any text highlight and preventing new text highlights from forming on that specific block until it is unselected.

## 4. Detailed Blueprint
- Modify `globals.css` and locate the `.selected-block` CSS definitions.
- Add `user-select: none;` to the `.selected-block .flex-1.flex.items-start` and `.selected-block .relative.w-full` rules so that native text selection is disabled when the block is selected via the drag handle.

## 5. Operational Trace
- Searched `globals.css` for `.selected-block`
- Used `multi_replace_file_content` to add `user-select: none;` to the selector at line 1295.

## 6. Status Assessment
Completed. Clicking the drag handle will now select the block, showing the block background effect without the text being natively highlighted by the browser.
