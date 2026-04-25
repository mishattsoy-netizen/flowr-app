User request: "dont use hover effect for this section"

### Objective Reconstruction
The objective was to remove the visual background hover effect from the sidebar header that was recently added to synchronize its behavior with other sections.

### Strategic Reasoning
While the user wanted the header to "act same as in the workspaces" (meaning clickable and animated), the specific background hover effect (`hover:bg-[var(--bone-6)]`) was deemed unnecessary or undesirable for the top-level logo area. I removed the hover background class while keeping the `cursor-pointer` and the click logic intact.

### Detailed Blueprint
- **Sidebar.tsx**: Remove `hover:bg-[var(--bone-6)]` from the header's `className` list.

### Operational Trace
Modified `src/components/layout/Sidebar.tsx` at line 294.

### Status Assessment
The sidebar header no longer shows a background highlight on hover, but remains clickable for expanding/collapsing the sidebar.
