User request: "increase top and bottom gaps for this section make it 12px"

### Objective Reconstruction
The objective was to standardize the vertical spacing (top and bottom gaps) of the sidebar's primary header and search bar section to exactly 12px.

### Strategic Reasoning
Visual consistency is key for a high-end interface. The sidebar header previously had asymmetrical padding (12px top, 14px bottom), and the search bar had minimal padding (4px). By setting both to `py-3` (12px), I established a more balanced and professional vertical rhythm that aligns with the user's preference for spacious but structured layout.

### Detailed Blueprint
- **Sidebar.tsx**: 
    - Update header `className` from `pt-3 pb-3.5` to `py-3`.
    - Update search bar container `className` from `py-1` to `py-3`.

### Operational Trace
Modified `src/components/layout/Sidebar.tsx` at lines 294 and 331.

### Status Assessment
The sidebar's top sections now have consistent 12px vertical gaps, creating a more cohesive and aesthetic interface.
