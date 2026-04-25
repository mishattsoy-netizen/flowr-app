User request: "collapse button doesnt work, in expanded mode logo should act as collapse button"

### Objective Reconstruction
The objective was to fix the sidebar collapse functionality which was broken due to incorrect event propagation handling, and to ensure the logo effectively acts as a toggle button in expanded mode.

### Strategic Reasoning
The previous update added a `stopPropagation` to the entire right-side container of the header to prevent the `Toggle` component from triggering the sidebar collapse. However, this also blocked the `Chevron` icon from working. I moved the `stopPropagation` specifically to the `Toggle` container, allowing the `Chevron` and the rest of the header (including the `Logo`) to correctly bubble events to the parent toggle handler.

### Detailed Blueprint
- **Sidebar.tsx**: Relocate the `onClick={(e) => e.stopPropagation()}` from the right-side actions wrapper to only the specific `div` containing the `Toggle` component.

### Operational Trace
Modified `src/components/layout/Sidebar.tsx` at line 308.

### Status Assessment
The entire sidebar header, including the logo and chevron, now correctly toggles the sidebar state. The toggle switch remains isolated and functions independently.
