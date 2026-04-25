User request: "fix these buttons in collapsed state"

### Objective Reconstruction
The objective was to fix the layout of the sidebar's footer buttons (Spaces, Theme, Settings) when the sidebar is in collapsed mode, as they were overflowing horizontally.

### Strategic Reasoning
In the collapsed state, the sidebar's width is insufficient to display three 28px buttons side-by-side with padding. Stacking them vertically resolves the overflow and maintains access to all utility functions. I also adjusted the vertical spacing and padding to ensure the layout feels intentional and balanced.

### Detailed Blueprint
- **Sidebar.tsx**: Update the footer container to use a vertical layout with increased spacing (`flex-col gap-5 py-4`) when collapsed. Change the buttons wrapper to `flex-col gap-2` in collapsed mode to stack them.

### Operational Trace
Modified `src/components/layout/Sidebar.tsx` at lines 627 and 640.

### Status Assessment
The sidebar footer now correctly handles the collapsed state by transitioning from a horizontal to a vertical layout, ensuring no element overflows the container.
