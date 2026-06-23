User request: "hierarchy lines hould always be visible"

### 0. Date and time of the request
May 26, 2026 at 03:57 AM

### 1. User request
User request: "hierarchy lines hould always be visible"

### 2. Objective Reconstruction
Ensure the folder list tree hierarchy lines are always clearly visible and never hidden or obscured:
1. Fix the issue where active/hover selection backgrounds on child items paint over and hide the parent's hierarchy lines.
2. Boost the idle opacity of the hierarchy lines so they are clearly visible at all times, not just on hover.

### 3. Strategic Reasoning
- **Paint Order Override**: Adding `z-10` to the absolute-positioned vertical hierarchy lines ensures they are painted on top of relative sibling child rows, even when those child rows render solid active or hover selection backgrounds.
- **Opacity Boost**: Upgraded base background from `bg-[var(--bone-12)]` (12% opacity, too faint) to `bg-[var(--bone-20)]` (20% opacity) for rich baseline visibility on dark backgrounds, while boosting the hover accentuation to `group-hover/treeitem:bg-[var(--bone-40)]` (40% opacity).

### 4. Detailed Blueprint
- **TreeItem.tsx**:
  - Locate the `<div />` rendering `{/* Hierarchy Line */}`.
  - Add `z-10` class to its tailwind classes.
  - Replace `bg-[var(--bone-12)]` with `bg-[var(--bone-20)]` and `group-hover/treeitem:bg-[var(--bone-30)]` with `group-hover/treeitem:bg-[var(--bone-40)]`.

### 5. Operational Trace
- **TreeItem.tsx**:
  - Replaced the hierarchy line element classes with the improved, always-visible styling and higher z-index stacking properties.

### 6. Status Assessment
- **Completed**:
  - Successfully harmonized and fixed hierarchy line visibility across the entire workspace tree.
