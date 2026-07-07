### 0. Date and time of the request
Date: 04.07.2026
Time: 20:55 (Start) - 20:56 (End)

### 1. User request
User request: "collapse button doesn match home page at all"

### 2. Objective Reconstruction
- Match the Tasks view sidebar workspace collapse chevron button overlays exactly with the Home view directory tree.
- Remove width limits (`w-3.5 h-3.5`) and transition animations from the collapse `<button>` tag so the button size matches the standard 26px square (`btn-sidebar-utility`) and snaps instantly on hover.

### 3. Strategic Reasoning
- The collapse button wrapper class had `w-3.5 h-3.5` and `transition-opacity` added locally, which overrode the standard `btn-sidebar-utility` (26px) size and instant hover state transitions.
- Cleaned the button class definitions to rely purely on `btn-sidebar-utility opacity-0 group-hover:opacity-100` and removed duration transitions, mirroring `TreeItem.tsx` behavior exactly.

### 4. Detailed Blueprint
- `src/components/layout/Sidebar.tsx`: Revert local wrapper class overrides, size overrides, and transition classes on the workspaces list collapse chevrons.

### 5. Operational Trace
- Replaced the icon and chevron markup wrapper with the standard `TreeItem` template.
- Verified TypeScript build completion.

### 6. Status Assessment
Completed successfully. Collapse chevrons listed inside the Tasks sidebar now behave, scale, and overlay exactly like those in the Home directory tree.
