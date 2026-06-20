# 20.06 at 00:18

User request: "no insert line"

## Objective Reconstruction
Fix the visual insertion line not showing up when dragging an item and hovering over the outdented levels (e.g. depth 2) at the bottom of an expanded folder (e.g. Folder 2).

## Strategic Reasoning
The visual insertion line disappeared because the folder spacer's invisible hit target was horizontally constrained with `left: ${8 + depth * 18}px`. When the user moved their cursor to the left (to shallower depths like depth 2 or 1) to trigger outdenting, the cursor left the bounds of the hit target. This triggered a `dragleave` event on the spacer, setting `isOver` to false and hiding the visual insertion line. Setting `left: 0px` on the hit target ensures it spans the entire width of the sidebar, allowing the spacer to capture dragover events across all outdent depths while `getTargetConfig` dynamically handles the depth and visual line offset.

## Detailed Blueprint
Modify `TreeItem.tsx` in `AfterFolderSpacer`:
- Set `style={{ left: '0px' }}` on the invisible `sidebar-spacer-hit-target` `div`.

## Operational Trace
- Edited [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/TreeItem.tsx#L321-L327) using `replace_file_content` to set the horizontal hit target `left` style to `0px`.
- Updated [task.md](file:///Users/mktsoy/.gemini/antigravity-ide/brain/c52043d9-9ea0-4f2a-b82b-272771950fdd/task.md) and [walkthrough.md](file:///Users/mktsoy/.gemini/antigravity-ide/brain/c52043d9-9ea0-4f2a-b82b-272771950fdd/walkthrough.md).

## Status Assessment
- Verified the code change. When a drag is active, the spacer hit target will capture cursor movements all the way to the left edge of the sidebar, keeping the insertion line visible at the calculated outdented depths.
