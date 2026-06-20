User request: "problems: i can see insert line when i drag item or folder between folded workspaces"

### 0. Date and Time of the Request
19.06.2026 01:57

### 1. User Request
"problems: i can see insert line when i drag item or folder between folded workspaces"

### 2. Objective Reconstruction
Ensure that when a user drags a regular note or folder (an item/folder) over workspace rows in the left sidebar, no horizontal insert lines (top or bottom edges) are shown. However, nesting highlights should still be shown when hovering on the middle of a workspace to allow dropping items inside it.

### 3. Strategic Reasoning
Workspaces/collections and regular notes/folders are completely different concepts in different sections of the sidebar:
- A workspace/collection can only be reordered relative to other workspaces/collections (all at root-level workspaces section).
- A note/folder can only be reordered relative to other notes/folders.
Therefore, reordering a note/folder directly between workspaces (creating a note as a sibling to workspaces) is an invalid operation. If `isDragWS !== isTargetWS` (one is a workspace and the other is not), top/bottom edge reordering is impossible. In this case, we must force `edge = null` in the drop target data. This prevents drawing any visual insert lines between workspaces, while still allowing the row to highlight for nesting drops (when hovering in the middle of a workspace where `edge` is naturally `null`). Pinned items also represent regular notes/folders, so we corrected `dragEntity` resolution to strip the `pinned-` prefix and correctly apply this boundary check to pinned drags.

### 4. Detailed Blueprint
- **[TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/TreeItem.tsx)**:
  - Strip `pinned-` prefix during `entities.find` lookup for `dragEntity` so that `dragEntity` matches the real entity even during pinned drags.
  - Suppress visual lines by setting `edge = null` when a pinned item is dragged outside the pinned section (`isPinnedDrag && !isTargetPinned`).
  - Suppress visual lines by setting `edge = null` when `isDragWS !== isTargetWS` (dragging a workspace over a note, or a note/folder over a workspace).

### 5. Operational Trace
- Updated `TreeItem.tsx` `getData`:
  - Resolved `dragEntityId` with `dragId.startsWith('pinned-') ? dragId.replace('pinned-', '') : dragId`.
  - Added early check for pinned drags:
    ```typescript
    } else if (isPinnedDrag && !isTargetPinned) {
      edge = null; // Dragging pinned item outside pinned section only unpins it; show no insert lines.
    ```
  - Added boundary check inside `else if (dragEntity)` block:
    ```typescript
    if (isDragWS !== isTargetWS) {
      edge = null; // Cannot reorder workspaces relative to regular items/folders
    }
    ```

### 6. Status Assessment
- Verified that visual insert lines do not show when dragging a note or folder over workspaces.
- Nesting highlights still display when hovering over the middle of workspaces, allowing items to be nested.
- Walkthrough updated.
