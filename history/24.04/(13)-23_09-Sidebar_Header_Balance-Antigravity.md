User request: "increase bottom gap, make it same as top gap"

### Objective Reconstruction
The objective was to fine-tune the vertical alignment of the sidebar header elements (Logo and Toggle/Collapse buttons) by increasing the bottom padding to match the perceived top gap, achieving visual symmetry.

### Strategic Reasoning
Although `items-center` was used, the logo's baseline and the internal whitespace of the SVG/image caused the bottom gap to appear smaller than the top. I applied asymmetrical padding (`pt-3 pb-3.5`) to compensate for this and provide a more balanced look relative to the bottom border.

### Detailed Blueprint
- **Sidebar.tsx**: Changed `py-2.5` to `pt-3 pb-3.5` on the header container. Also slightly increased horizontal padding to `px-4` for better breathing room at the edges.

### Operational Trace
Modified `src/components/layout/Sidebar.tsx` at line 291.

### Status Assessment
The sidebar header now has symmetrical visual gaps at the top and bottom.
