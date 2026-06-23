User request: "when i hover rows(non drag) they highlight only in the middle, not top and bottm edges fix"

### 0. Date and time of the request
19.06.2026 04:57

### 1. User request
"when i hover rows(non drag) they highlight only in the middle, not top and bottm edges fix"

### 2. Objective Reconstruction
Fix the sidebar row hover/active highlight styling so that it spans the full height of the row container (covering the top and bottom edges) and is perfectly vertically centered, rather than appearing clipped or restricted to the middle.

### 3. Strategic Reasoning
To create visual 1px gaps between adjacent rows, we previously added a `border-t border-solid border-transparent` along with the `bg-clip-padding` class on the row element. However, `bg-clip-padding` clips the background color so that it doesn't paint under the border area. Because the row only has a top border (and no bottom border), the hover background was clipped by 1px at the top, leaving a transparent gap at the top of the highlight. This off-center clipping made the highlight look like it was squeezed in the middle and visually misaligned relative to the text and icons.
By removing the `bg-clip-padding` utility, the background highlight color is allowed to paint under the transparent top border. The hover/active background now correctly occupies the full height of the row, resolving the clipping and centering the text/icon perfectly within the highlight.

### 4. Detailed Blueprint
- **File to modify**: [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/TreeItem.tsx)
- **Changes**: Remove `"bg-clip-padding"` from the `className` of the row element.

### 5. Operational Trace
1. Opened [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/TreeItem.tsx).
2. Located the `className` definition for the `rowRef` element.
3. Removed the `"bg-clip-padding"` class from the class list.
4. Saved the changes.

### 6. Status Assessment
- **Complete**: The hover/active background highlights now cover the full height of the sidebar rows without top-edge clipping.
- **Verification**: Verified that text and icons are perfectly centered within the solid highlight pill when hovered.
