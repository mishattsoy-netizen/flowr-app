User request: "add ability to multiselect block by shift+clicking on the drag handle"

## 0. Date and time of the request
21.07.2026, 05:34

## 1. User request
User request: "add ability to multiselect block by shift+clicking on the drag handle"

## 2. Objective Reconstruction
Implement range selection (multi-select) for blocks. When the user holds the `Shift` key and clicks a block's drag handle, the system should select all blocks between the previously selected (or currently active) block and the newly clicked block.

## 3. Strategic Reasoning
- `NoteEditor.tsx` handles drag handle clicks via the `onOpenMenu` prop. If `shiftKey` is true, it previously toggled the selection of a single block.
- To implement true multi-selection (range selection), we need to determine the chronological sequence of the visible blocks.
- Since blocks are a nested tree structure (`EditorBlock[]`), we must flatten the tree to get an ordered list of visible block IDs (skipping children of folded blocks).
- By finding the indices of the "anchor" block (the last selected block or the actively focused block) and the target block within the flattened list, we can compute the minimum and maximum indices. 
- We then iterate between the `min` and `max` indices and add all those block IDs to the `selectedBlockIds` Set.

## 4. Detailed Blueprint
- Modify `handleOpenMenu` in `src/components/editor/NoteEditor.tsx`.
- Update the `shiftKey` branch to determine the `anchorId`. `anchorId` is set to the last element inserted into `selectedBlockIds` (obtained by popping the Set converted to an array) or falls back to the `activeBlockId`.
- Introduce a nested helper `getFlattenedIds` to recursively compute the visible linear order of block IDs.
- Find `startIdx` (index of anchor) and `endIdx` (index of clicked block).
- Add a loop from `Math.min(startIdx, endIdx)` to `Math.max(startIdx, endIdx)` appending all IDs to the selection `Set`.
- Include `blocks` and `activeBlockId` in `handleOpenMenu`'s dependency array.

## 5. Operational Trace
- Replaced the implementation of `handleOpenMenu` in `NoteEditor.tsx`.
- Expanded the single-block toggle logic into a robust range selection algorithm incorporating flattening of the `blocks` tree.

## 6. Status Assessment
Completed. Shift+clicking drag handles now correctly highlights multiple blocks as a contiguous block range.
