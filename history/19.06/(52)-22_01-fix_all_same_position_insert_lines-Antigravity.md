# History Report

- **Date**: 19.06.2026
- **Time**: 22:01

User request: "i see insert line that will drop in same position again!"

## Objective Reconstruction
Prevent drop insertion lines from displaying when dragging a tree item and hovering over drop areas that would result in dropping the item back into its exact same position. This includes:
1. Pinned drag-and-drop operations on spacers (which only trigger an unpin, not an insert).
2. Normal items that are already pinned being dragged and hovered over same-position zones in the pinned section (reorders).
3. Any sibling index calculations being shifted because hidden entities (`hiddenEntityIds`) were included in the sibling lists but not actually rendered.

## Strategic Reasoning
1. **Block Pinned Items on Spacers**: Since dropping a pinned item on a folder's spacer does not insert a new row (it only toggles the favorite status to unpinned), we should never show a visual insertion line there. We block these by checking `source.data.isPinned` in `AfterFolderSpacer`'s `canDrop`.
2. **Handle Normal-to-Pinned same-position drops**: If a normal item that is already pinned (`favoriteIds.includes(dragEntityId)`) is dragged and hovered over the pinned section, the drop target is in the pinned list. We check if the target index in the pinned list is immediately above/below the item's current pinned index, and set `edge = null` if so.
3. **Filter Hidden Siblings**: By ignoring `hiddenEntityIds` inside `getSortedSiblings` (for both `TreeItem.tsx` and `Sidebar.tsx`) and `getSectionSiblings` in `AfterFolderSpacer`, we align our index calculations with the actual UI rendering. This fixes off-by-one errors that prevented same-position no-op detection when hidden items were present in the same container/section.

## Detailed Blueprint
- **Modify** `src/components/layout/TreeItem.tsx`:
  - Update `AfterFolderSpacer`'s `canDrop` to reject when `source.data.isPinned === true`.
  - Update `AfterFolderSpacer`'s `getSectionSiblings` to exclude `hiddenEntityIds` from the workspace and unsorted siblings.
  - Update `getSortedSiblings` inside `TreeItem` to filter out `hiddenEntityIds` and add `hiddenEntityIds` to the dependency array.
  - Update `dropTargetForElements.getData` to look up `redirectedEntity` using `cleanRedirectedId` to avoid `undefined` mismatch.
  - In `dropTargetForElements.getData`, add a check for `!isPinnedDrag && isTargetPinned`. If the item is already in `favoriteIds`, retrieve the pinned siblings list and suppress same-position reorders.
  - Update raw sibling index check inside `getData` to compare `dragEntityId` instead of `dragId`.
- **Modify** `src/components/layout/Sidebar.tsx`:
  - Update `getSortedSiblings` to exclude `hiddenEntityIds` from the workspace and unsorted siblings list.

## Operational Trace
- Edited `src/components/layout/TreeItem.tsx` with `replace_file_content`:
  - Filtered `hiddenEntityIds` in `AfterFolderSpacer`'s siblings logic.
  - Added `isPinned` blocking in `AfterFolderSpacer`'s `canDrop`.
  - Filtered `hiddenEntityIds` in `getSortedSiblings` callback of `TreeItem`.
  - Added normal-to-pinned reorder no-op suppression in `getData`.
  - Substituted `dragId` with `dragEntityId` in the sibling index check.
- Edited `src/components/layout/Sidebar.tsx` with `replace_file_content`:
  - Excluded `hiddenEntityIds` from workspace, unsorted, and child siblings inside `getSortedSiblings`.

## Status Assessment
- **Completed**: Fully resolved all same-position drop insertion line edge cases for pinned, unpinned, and hidden entity scenarios.
- **Unresolved**: None.
