# History Report

- **Date**: 19.06.2026
- **Time**: 22:11

User request: "not fixed"

## Objective Reconstruction
Resolve the residual cases where same-position drag-and-drop insertion lines were still being rendered.
Specifically:
1. When a drop target is resolved to a no-op position (returning `edge = null` in `getData`), the `onDragEnter` and `onDrag` callbacks were still falling back to `visualEdge` (which was not null), causing the visual line to be rendered anyway.
2. In `AfterFolderSpacer`, the check for dropping the last child back into its parent folder at the bottom (which is a no-op) was restricted to root-only `forceInside` situations, meaning it was bypassed at depth > 0.

## Strategic Reasoning
1. **Bypassing Visual Edge for Blocked/No-Op Drops**: In `dropTargetForElements.getData`, if the drop is identified as a same-position no-op or descendant drop, it sets `edge = null`. However, the drag monitors on the DOM were falling back to `visualEdge: originalEdge` (which had the raw physical hover value, like `'top'`). By changing the resolved drag edge calculation inside `onDragEnter` and `onDrag` to explicitly set the edge to `null` if `self.data.edge` is `null`, we ensure the visual line is completely hidden for blocked drops.
2. **Generalizing Spacer No-Op Containment Check**: Extracted the folder containment check (`dragEntity.parentId === folderId` and dragged item is the last child) out of the `forceInside` block in `checkIsNoOp` so that it applies at all tree depths.

## Detailed Blueprint
- **Modify** `src/components/layout/TreeItem.tsx`:
  - In `AfterFolderSpacer.checkIsNoOp`, move the `dragEntity.parentId === folderId` child checking block outside the `if (forceInside)` condition so it triggers regardless of depth.
  - In `TreeItem.onDragEnter` and `TreeItem.onDrag`, update `const edge = ...` definition to evaluate `null` if `self.data.edge === null`.

## Operational Trace
- Edited `src/components/layout/TreeItem.tsx` with `multi_replace_file_content` to apply the two generalized no-op fixes.

## Status Assessment
- **Completed**: Fixed the visual edge rendering fallback and spacer containment checks.
- **Unresolved**: None.
