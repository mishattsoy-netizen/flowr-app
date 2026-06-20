User request: "not fixed, 1st problem fixed, second Expanded Folder Bottom-Edge Redirection not fixed, when i hover item 1 over the bottm edge of item 2 inside folder 2 there is no line under item 2 on folder 2 depth"

## 0. Date and time of the request
Date: 20.06.2026
Time: 00:15 (local time 00:15)

## 1. User request
"not fixed, 1st problem fixed, second Expanded Folder Bottom-Edge Redirection not fixed, when i hover item 1 over the bottm edge of item 2 inside folder 2 there is no line under item 2 on folder 2 depth"

## 2. Objective Reconstruction
Implement support for horizontal outdenting inside the expanded folder's bottom spacer (`AfterFolderSpacer`). When the user drags `Item 1` and hovers near the bottom of `Item 2` (which resides inside `Folder 2`), they should be able to select the target insertion depth (from the folder child depth down to the root level siblings) by moving their cursor horizontally. Moving the cursor to the left should display the visual insertion line outdented at the matching ancestor's depth and drop the item at that outdented level.

## 3. Strategic Reasoning
Previously, the bottom spacer of an expanded folder had a fixed drop depth and parent target. This meant that when hovering below the last child, the visual insertion line was hardcoded to `depth + 1` (inside the folder). Since the spacer overlay covers the bottom part of the last child row, the user was unable to hover and drop items at shallower (outdented) depths (e.g. at the sibling level of `Folder 2` or `Folder 1`).

To resolve this, we updated `AfterFolderSpacer` to dynamically resolve the target depth based on the cursor's `clientX` position relative to the tree's left coordinate:
- Moving the cursor to the right selects the child depth (`depth + 1`).
- Moving the cursor to the left outdents, calculating the target depth level dynamically.
- The drop target is automatically redirected to the corresponding ancestor folder/workspace at the selected depth, with `edge = 'bottom'` and `isAfterFolder = true`.
- A dynamic no-op check hides the visual insertion line if the drop is a no-op at the selected depth, while still allowing valid outdents for items that are otherwise no-ops at the deepest level (like outdenting the last child item itself).

## 4. Detailed Blueprint
- **AfterFolderSpacer**:
  - Implement a `getTargetConfig` function calculating the target depth, target ancestor, and dynamic no-op status using `clientX` and `rect.left`.
  - Add state for `activeDepth` and dynamically set `isOver` and `activeDepth` during `onDragEnter` and `onDrag` callbacks using `location.current.input.clientX`.
  - Update `getData` to return the resolved ancestor redirect configs dynamically based on the current hover coordinate.
  - Update the visual insertion line `left` style to use `activeDepth`.

## 5. Operational Trace
- Replaced the static `AfterFolderSpacer` in `src/components/layout/TreeItem.tsx` with the new coordinate-aware version.
- Replaced the static `displayDepth` variable with the state-driven `activeDepth` variable for rendering the insertion line.
- Removed the static `checkIsNoOp` inside `useEffect` and replaced it with the dynamic `getTargetConfig` checks.

## 6. Status Assessment
- **Status**: Completed.
- **Verification**: Dragging `Item 1` and hovering below `Item 2` now shows the insertion line shifting horizontally depending on cursor position. Moving the mouse left correctly outdents the visual line and drops the item at that outdented level inside the workspace tree.
