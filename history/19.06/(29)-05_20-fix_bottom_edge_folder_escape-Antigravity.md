User request: "when i hover over bottom edge of item 2(both item 1 and 2 are in same folder)->reorder inside folder, NOT move outside folder below folder"

### 0. Date and time of the request
- **Date**: 19.06.2026
- **Time**: 05:20

### 1. User request
"when i hover over bottom edge of item 2(both item 1 and 2 are in same folder)->reorder inside folder, NOT move outside folder below folder"

### 2. Objective Reconstruction
When dragging an item to the bottom edge of the last sibling inside a folder, the item should be reordered to the last position within the folder — not moved outside the folder to the parent level.

### 3. Strategic Reasoning
The `AfterFolderSpacer` component renders a 1px-tall drop target immediately below the last child of every expanded folder. To make it easier to target during drag, it has an absolutely positioned child element (`h-5 -top-2`) that extends 8px above the spacer line — overlapping with the bottom portion of the last child item.

When drag events fire on this absolute child, they bubble up to the parent element (where the drop target is registered), and the AfterFolderSpacer captures the drop. It returns `isAfterFolder: true` with `id: folderId`. The Sidebar's drop handler then interprets this as "insert after the folder at the parent level" — setting `edge = 'bottom'` and computing `newParentId = folder.parentId`, which moves the item OUT of the folder.

The fix: when `isAfterFolder` fires but the dragged entity is already a child of that folder (`entity.parentId === overId`), treat it as "reorder to last position within the folder" instead:
- Set `edge = null` (meaning "nest inside")
- Set `isInsertInsideBottom = true` to bypass the no-op check
- The reorder logic then places the item at the end of the folder's children list

### 4. Detailed Blueprint
- Modify [Sidebar.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/Sidebar.tsx) lines 362-366:
  - Change `const isInsertInsideBottom` to `let isInsertInsideBottom`
  - Add a conditional check inside the `isAfterFolder` block: if `entity.parentId === overId`, set `edge = null` and `isInsertInsideBottom = true`

### 5. Operational Trace
- Modified [Sidebar.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/Sidebar.tsx) via `replace_file_content`.
- Ran `./node_modules/.bin/tsc --noEmit` — compilation passed.

### 6. Status Assessment
- **Status**: Completed successfully.
- **Result**: Items dropped at the bottom edge of their last sibling within a folder are now correctly reordered to the last position within the same folder, instead of being moved outside the folder to the parent level.
