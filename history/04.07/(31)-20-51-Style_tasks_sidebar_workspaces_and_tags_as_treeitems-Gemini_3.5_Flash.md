### 0. Date and time of the request
Date: 04.07.2026
Time: 20:50 (Start) - 20:51 (End)

### 1. User request
User request: "i want exact same colapse button logic in sidebar as in workspaces in home wage and same treeitems style"

### 2. Objective Reconstruction
1. Match the exact visual layout style of treeitems for both the workspace rows and nested tag rows inside the Tasks view sidebar.
2. Match the exact hover-based collapse/expand logic used in the Home Directory tree:
   - The workspace icon is visible by default.
   - On hover, the workspace icon fades out and is replaced by the collapse/expand chevron (`ChevronRight`/`ChevronDown`), absolutely positioned directly over the icon.
   - Tag sub-items are indented to `padding-left: 26px`, aligning them perfectly as child nodes.

### 3. Strategic Reasoning
- The user highlighted that the expand/collapse button in the sidebar directory tree (Home view) utilizes a hover overlay mechanism. The chevron overlays the icon rather than standing next to it.
- Applied the exact CSS classes and layout structure of `TreeItem.tsx` (`group/treeitem`, absolute chevron positioning on hover) to the workspaces and custom tags list rendered inside the Tasks sidebar in `Sidebar.tsx`.

### 4. Detailed Blueprint
- `src/components/layout/Sidebar.tsx`:
  - Format workspace row class names and styles to match treeitem row layout.
  - Implement absolute hover chevron overlay over the workspace icon container.
  - Format tag nested item row class names and indent to match child nodes style.

### 5. Operational Trace
- Updated the workspaces and tags rendering templates in `Sidebar.tsx` to align exactly with treeitem aesthetics and overlays.
- Successfully verified typescript builds.

### 6. Status Assessment
Completed successfully. The workspaces and custom tags listed in the Tasks view sidebar now match the exact styles and hover-overlay chevron interactions of the Home Directory tree.
