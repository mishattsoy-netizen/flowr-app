User request: "move collapce button containder in the folders and workspaces a bit to the left to top,bottom and left margins are same"

## 0. Date and time of the request
Date: 19.05 (May 19, 2026)
Time: 02:37

## 1. User request
"move collapce button containder in the folders and workspaces a bit to the left to top,bottom and left margins are same"

## 2. Objective Reconstruction
Shift the hover active expand/collapse chevron button container (which replaces folder/workspace icons on hover) 3px to the left. This equalizes the margin on the left side with the top and bottom margins (exactly 3px) relative to the item row highlight bounding box.

## 3. Strategic Reasoning
- **Precise Geometry**: The tree row has a height of 28px (`h-7`). The collapse trigger container is 22px high (`top: -4px; bottom: -4px` relative to 14px parent).
- Top/Bottom margins are `(28 - 22) / 2 = 3px`.
- By shifting the left edge from `-4px` to `-7px`, the trigger left edge is exactly 3px from the tree row left edge (`10px` padding-left - `7px` offset = `3px`). This creates a mathematically uniform margin of 3px on top, bottom, and left sides of the hover container, making it perfectly flush and aligned.

## 4. Detailed Blueprint
- `src/components/layout/TreeItem.tsx`:
  - Locate the collapsible chevron overlay container (lines 189–197).
  - Replace `absolute -inset-[4px]` with `absolute top-[-4px] bottom-[-4px] left-[-7px] right-[-1px]`.

## 5. Operational Trace
- Edited `src/components/layout/TreeItem.tsx`:
  - Replaced `absolute -inset-[4px]` with custom asymmetrical offsets: `absolute top-[-4px] bottom-[-4px] left-[-7px] right-[-1px]` on the chevron hover wrapper.

## 6. Status Assessment
- **Completed**: Chevron button hover wrapper adjusted to have perfectly equal top, bottom, and left margins (3px) for folders, collections, and workspaces.
