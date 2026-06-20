# History Report

- **Date**: 19.06.2026
- **Time**: 21:57

User request: "i see insert line that will drop in same position again!"

## Objective Reconstruction
The user reported seeing drop insertion lines in positions that would result in a no-op (dropping the item back into its exact same position). This included dragging an item and hovering over its own row (especially when dealing with cross-section clones like pinned vs. regular items) or dragging a folder and hovering over its own children/descendants. The goal was to fully suppress all insertion lines in these cases.

## Strategic Reasoning
1. **Self-Drop Blocking**: We block drops on the same entity at the `canDrop` level by comparing the raw entity IDs of the dragged item and the target item: `dragEntityId === entity.id`. This covers both regular items and their corresponding pinned/shortcut clones, preventing any hover highlights or line indicators.
2. **Descendant Drop Blocking**: We block dropping a folder inside its own child descendants (nested subfolders/notes) at the `canDrop` level: `descendantIds.includes(entity.id)`. This prevents all drop indicators on subtrees of the dragged folder.
3. **Descendant Redirection Suppression**: Inside `getData`, if a top-edge redirect target is resolved to a descendant of the dragged item or the dragged item itself, we set `edge = null` to suppress the visual line.

## Detailed Blueprint
We modify [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/TreeItem.tsx):
1. In the row container's `canDrop`, extract `dragEntityId` (stripping any `"pinned-"` prefix) and check:
   - `if (dragEntityId === entity.id) return false;`
   - `if (descendantIds.includes(entity.id)) return false;`
2. In the row container's `getData` no-op check, replace the exact string match `dragId === redirectedId` with a raw ID and descendant validation:
   - Extract `dragEntityId` and `targetEntityId` by stripping `"pinned-"` prefixes.
   - Calculate `isTargetDescendant = getDescendantIds(entities, dragEntityId).includes(targetEntityId)`.
   - Set `edge = null` if `dragEntityId === targetEntityId || isTargetDescendant`.

## Operational Trace
Applied edits in `TreeItem.tsx` using `multi_replace_file_content`:
- Added self-entity and descendant entity drop blocking to the row drop target's `canDrop` configuration.
- Upgraded the self-reorder line suppression inside `getData` to perform raw ID checks (supporting cross-section clone detection) and block descendant redirections.

## Status Assessment
- **Completed**: Fully blocked drop lines when hovering over the dragged item itself, its corresponding pinned/unpinned clone, or any of its sub-hierarchy child descendants.
- **Unresolved**: None.
- **Verification**: Manual validation steps are detailed in `walkthrough.md`.
