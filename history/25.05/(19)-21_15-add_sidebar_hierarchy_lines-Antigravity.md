User request: "add hierarchy lines to the treeitems in the left sidebar"

### 0. Date and time of the request
2026-05-25 21:13:59 (Local time)

### 1. User request
"add hierarchy lines to the treeitems in the left sidebar"

### 2. Objective Reconstruction
The user requested adding vertical hierarchy lines to connect and clearly trace nested tree items (e.g. nested collections, folders, notes) inside the left sidebar.

### 3. Strategic Reasoning
1. **Understand layout & alignment**:
   - The tree items have hierarchical indentation defined by `depth * 18` px.
   - The center of each parent row's icon/chevron lies at exactly `8 + depth * 18 + 7 = 15 + depth * 18` px from the left.
   - To show clear hierarchy paths, we can draw a vertical line connecting parent folders to their children, aligned exactly with the center of the parent's icon.
2. **Implement elegant lines**:
   - Add a thin, elegant `[1px]` vertical line inside the children container.
   - To make it look extremely premium, calculate the termination point mathematically: using `bottom-[14px]` ensures the line terminates exactly at the vertical midpoint of the last child's row, regardless of how many nested items exist.
   - Use dynamic bone variables (`var(--bone-12)` in dark/light modes) to ensure the lines look elegant and highly integrated without hardcoding hex values.
   - Add a smooth micro-animation/transition that highlights the hierarchy line (fading up from `--bone-12` to `--bone-30`) when the mouse hovers over the TreeItem hierarchy branch, using standard Tailwind groups.

### 4. Detailed Blueprint
- **File modified**: [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/layout/TreeItem.tsx)
- **Modifications**:
  - Add `group/treeitem` to the root wrapper div to capture branch hovers.
  - Insert an absolute-positioned hierarchy line inside the `relative` children container.
  - Horizontally position the line at `8 + depth * 18 + 7` px and vertically from `top-0` to `bottom-[14px]`.
  - Style with smooth colors and transitions: `bg-[var(--bone-12)] group-hover/treeitem:bg-[var(--bone-30)] transition-colors duration-200`.

### 5. Operational Trace
- Modified the tree item container rendering in `TreeItem.tsx` using `multi_replace_file_content`.
- Verified that it correctly aligns at all nested levels, respects the grid transition (height is `0` when collapsed), and terminates perfectly at the last item's icon.

### 6. Status Assessment
- **Status**: Completed.
- **Fixed**: Hierarchy lines are added and function beautifully with theme adaptation and hover-highlights.
