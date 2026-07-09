User request: "there is not gap betweem edit button and tab"

### Date and Time
09.07.2026, 15:40

### Objective Reconstruction
Fix the visual spacing issue where the edit button was overlapping or touching the tab edge in `ColumnHeader`.

### Strategic Reasoning
- The tab pill uses a `ConcaveCorner` SVG which extends 13px (`r=12` plus 1px) to the left of the actual tab container DOM node.
- A margin of `mr-[7px]` was placing the button exactly 7px from the container, which meant the 13px concave corner completely overlapped the 7px gap.
- To achieve a true 7px visual gap, the margin needs to be `13px (corner) + 7px (gap) = 20px`.
- We updated the margin to `mr-[20px]` for whichever button sits immediately next to the tab (the Read/Edit button for notes, or the Options button for canvases).

### Detailed Blueprint
- **[ColumnHeader.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/layout/ColumnHeader.tsx)**: 
  - Updated the Read/Edit toggle's margin to `mr-[20px]`.
  - Updated the Options menu button's margin dynamically to `mr-[7px]` if it's next to the Read/Edit button, or `mr-[20px]` if it's directly next to the tab.

### Operational Trace
1. Analyzed the provided image and code structure for `ConcaveCorner`.
2. Calculated the offset required to accommodate the corner's negative left positioning (`-13px`).
3. Replaced `mr-[7px]` with `mr-[20px]` for the element immediately preceding the tab container.

### Status Assessment
- **Completed**: The visual gap between the control buttons and the tab pill should now be exactly 7px, matching the top and bottom margins perfectly.
