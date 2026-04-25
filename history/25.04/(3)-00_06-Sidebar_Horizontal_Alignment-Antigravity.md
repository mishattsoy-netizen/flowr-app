User request: "not 12px on both sides"

### Objective Reconstruction
The objective was to align the sidebar header's horizontal padding with the rest of the sidebar sections (Search, Footer), ensuring a consistent vertical alignment for icons and text.

### Strategic Reasoning
The sidebar header was using `px-4` (16px), while the search bar and footer were using `px-3` (12px). This created a horizontal misalignment where the logo and toggle button were indented more than the search icon and footer elements. I changed the header to `px-3` to achieve perfect horizontal alignment across the entire sidebar.

### Detailed Blueprint
- **Sidebar.tsx**: Update the header `className` from `px-4` to `px-3`.

### Operational Trace
Modified `src/components/layout/Sidebar.tsx` at line 294.

### Status Assessment
The sidebar now has a uniform 12px padding on all sides for the header, search bar, and footer, resulting in a cleaner and more aligned appearance.
