Date: 19.06.2026
Time: 22:30

User request: "perfect now: when i drag workspace and hover over another wokrspace, other one highlights, it shouldnt, when i drag workspace, only insert lines on depth 0"

### 2. Objective Reconstruction
Prevent visual folder hover highlights on sibling workspaces when dragging a workspace (they should not act as folder drop targets). Enforce that dragging a workspace only generates insertion lines at depth 0, preventing any redirection to nested expanded descendants (depth > 0).

### 3. Strategic Reasoning
When dragging a workspace (`isDraggingWorkspace = true`), nesting is structurally invalid because workspaces cannot have parent nodes and must always live at depth 0. We can leverage the `isBlockNesting` flag to block nesting visual states entirely. This disables the workspace-on-workspace folder hover highlight.
Additionally, when dragging a workspace, we must bypass the top-redirect logic (`getRedirectedTarget`) which typically redirects hovers above a workspace to the deepest expanded child of the preceding workspace (which would draw an insert line at depth > 0). Keeping `redirectedDepth` at the natural hover depth (0) ensures workspace drag-and-drop lines stay strictly at depth 0.

### 4. Detailed Blueprint
- [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/TreeItem.tsx):
  - Modify the `isBlockNesting` assignment in `getData` to set it to `true` when `isDraggingWorkspace` is `true`.
  - Modify the top-edge redirect logic in `getData` to only run `if (edge === 'top' && !isDraggingWorkspace)`.
- [Sidebar.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/Sidebar.tsx):
  - In the `onDrop` callback, define `isDraggingWorkspace` for the dragged entity.
  - Bypass the top-redirect drop logic `if (edge === 'top' && overEntity && !isDraggingWorkspace)`.

### 5. Operational Trace
- Edited [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/TreeItem.tsx):
  - Conditionally bypassed `getRedirectedTarget` calculation `if (edge === 'top' && !isDraggingWorkspace)`.
  - Added an override to set `isBlockNesting = true` if `isDraggingWorkspace` is true.
- Edited [Sidebar.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/Sidebar.tsx):
  - Defined `isDraggingWorkspace` in the `onDrop` monitor.
  - Conditionally bypassed the drop target redirection logic `if (edge === 'top' && overEntity && !isDraggingWorkspace)`.

### 6. Status Assessment
- Folder highlights on target workspaces are now successfully suppressed during workspace drag operations.
- Workspace drag insertion lines are strictly restricted to depth 0.
- All other drag-and-drop behaviors remain unaffected and correct.
