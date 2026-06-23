User request: "dont see"

### 0. Date and time of the request
May 26, 2026 at 03:59 AM

### 1. User request
User request: "dont see"

### 2. Objective Reconstruction
Fix the issue where hierarchy lines disappeared because invalid CSS custom tokens (`--bone-20` and `--bone-40`) were used, which are not defined in the project's global design system style guide (`globals.css`).

### 3. Strategic Reasoning
- **Design System Constraint Check**: A deep audit of `src/app/globals.css` revealed that the project supports specific discrete bone opacity tokens: `--bone-12` (12%), `--bone-15` (15%), and `--bone-30` (30%). Sticking strictly to valid existing design tokens is critical so they resolve to actual color values.
- **Contrast Optimization**: Switched the base color to `--bone-15` (15% opacity, clearly visible) and the hover transition to `--bone-30` (30% opacity, standard outer border hover value), and kept them rendered after children to naturally paint on top.

### 4. Detailed Blueprint
- **TreeItem.tsx**:
  - Replace `--bone-20` with `--bone-15` in `bg-[var(--bone-20)]`.
  - Replace `--bone-40` with `--bone-30` in `group-hover/treeitem:bg-[var(--bone-40)]`.

### 5. Operational Trace
- **TreeItem.tsx**:
  - Restored valid custom property token bindings for the vertical hierarchy lines.

### 6. Status Assessment
- **Completed**:
  - Fully resolved the styling discrepancy, ensuring hierarchy lines are beautifully, correctly, and clearly visible at all times!
