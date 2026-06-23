User request: "gaps between pages, folders and workspaces are not 1 px fix"

### 0. Date and Time of the Request
- Date: 20.05 (May 20, 2026)
- Time: 17:43

### 1. User Request
User request: "gaps between pages, folders and workspaces are not 1 px fix"

### 2. Objective Reconstruction
The objective is to fix vertical gaps/spacing between sidebar elements (specifically pages, folders, and workspaces including their nested children) so they are exactly `1px` high, ensuring pixel-perfect layout and rendering consistency.

### 3. Strategic Reasoning
In the sidebar, top-level lists (Favorites, Unsorted, Workspaces) already had a flex column gap of `1px` defined on their respective wrappers. However, child folder contents (nested pages, subfolders) rendered recursively inside `TreeItem` used a custom container with `gap-[3px]` and `mt-[3px]` for expanded children. Replacing these settings with `gap-[1px]` and `mt-[1px]` perfectly aligns the spacing between all nested and sibling elements to exactly `1px`.

### 4. Detailed Blueprint
- **Files Modified:** [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/layout/TreeItem.tsx)
- **Modifications:** Modify the nested items flex-column container styling under expanded items to change from `gap-[3px]` to `gap-[1px]` and `mt-[3px]` to `mt-[1px]`.

### 5. Operational Trace
- Edited [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/layout/TreeItem.tsx) to modify the expanded children wrapper container:
  - Changed `gap-[3px]` to `gap-[1px]`
  - Changed `mt-[3px]` to `mt-[1px]`

### 6. Status Assessment
- **Completed:** Spacing of nested tree items in the sidebar has been successfully adjusted to exactly `1px`.
- **Validation:** Standardized recursive TreeItem rendering now respects the exact visual 1px gap alignment requested.
