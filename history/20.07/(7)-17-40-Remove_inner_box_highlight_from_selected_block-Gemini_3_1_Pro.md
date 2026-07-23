User request: "i want talking about blue one. there is a block effect, and there is another box inside a block that hihglights in the text area, its a bit lighter then blobk bg color"

## 0. Date and time of the request
20.07.2026, 17:40

## 1. User request
User request: "i want talking about blue one. there is a block effect, and there is another box inside a block that hihglights in the text area, its a bit lighter then blobk bg color"

## 2. Objective Reconstruction
Remove the inner background color (`var(--app-dark)`) that gets applied to the text wrapper div when a block is selected, which creates a redundant inner box highlight effect inside the broader selected block.

## 3. Strategic Reasoning
When a block is selected in `NoteEditor.tsx`, the block container receives the `.selected-block` class which sets a light background (`var(--bone-6)`). However, several individual block renderers inside `BlockRenderer.tsx` (like text, lists, media, columns) also had conditional classes like `isSelected && "bg-[var(--app-dark)]"` applied to their inner wrappers. This caused a double-highlight effect, with an inner box rendering in a slightly different shade. 
The fix is to remove all occurrences of `isSelected && "bg-[var(--app-dark)]"` inside `BlockRenderer.tsx` so that selection styling is exclusively handled by the outer `.selected-block` class.

## 4. Detailed Blueprint
- Locate all usages of `bg-[var(--app-dark)]` in `BlockRenderer.tsx` that are conditioned on `isSelected`.
- Remove these usages from the `className` arrays.
- Adjust ternary operators (like `isSelected ? "bg-[var(--app-dark)]" : ...`) to only handle the non-selected states (e.g. hover).

## 5. Operational Trace
- Searched `BlockRenderer.tsx` for `var(--app-dark)`.
- Found 5 occurrences inside various block type render branches (divider, table, media, column, list).
- Used `multi_replace_file_content` to remove or adjust these classes so that `bg-[var(--app-dark)]` is no longer applied upon selection.

## 6. Status Assessment
Completed. The inner text area box highlight has been removed. When a block is selected, it will now display a single, unified block effect background.
