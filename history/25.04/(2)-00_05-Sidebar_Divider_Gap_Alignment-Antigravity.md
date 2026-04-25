User request: "make gaps around this divider 12px aswell"

### Objective Reconstruction
The objective was to ensure that the vertical space above and below the sidebar header's divider line is perfectly symmetrical at 12px.

### Strategic Reasoning
The header section had 12px top/bottom padding (`py-3`), but an additional `mb-1` (4px) was pushing the following search section further away, creating an asymmetrical 16px gap below the line. By removing the `mb-1`, the space below the line is now solely determined by the search bar's 12px top padding, resulting in perfect 12px symmetry around the divider.

### Detailed Blueprint
- **Sidebar.tsx**: Remove `mb-1` from the header container `className`.

### Operational Trace
Modified `src/components/layout/Sidebar.tsx` at line 294.

### Status Assessment
The gaps around the sidebar header divider are now exactly 12px on both sides, fulfilling the requirement for vertical rhythm consistency.
