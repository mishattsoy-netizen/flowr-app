Date and time of the request: 2026-06-10 01:23

User request: "create a plan for drag and drop/repostion in the left sidebar. it deosnt work in the worksapce section. it msust work like arborist-dnd but with pragmatic . the insertion/reposition must work for all items(workspaces, foldes and pages like notes or canvas, everything). Workspaces- i can only reposition them between eachother, i should be able to put workspace in the folder or other worksapce. workspace content must work/detect properly, it must properly detect, simple reorder in the same layer(folder/workspace) or when i try to insert item in the other folder/wkspc or when to move to unsorted list. or mreorder nested folders... importat: everything without rerender error. use /writing-plans"

### Objective Reconstruction
The user wants to resolve multiple issues in the left sidebar's drag-and-drop repositioning logic:
1. Workspaces reordering does not work correctly.
2. Drag-and-drop should behave like a standard tree structure (such as react-arborist / arborist-dnd) built on top of Pragmatic DnD.
3. Repositioning must support all sidebar items (workspaces, folders, notes, canvases).
4. Workspaces/collections must only be repositioned relative to each other at the root layer (they cannot be nested under folders or other workspaces, and folders/pages cannot be sibling-reordered with workspaces).
5. Drag and drop must accurately detect:
   - Sibling reordering within the same folder/workspace layer (above/below).
   - Nesting inside folders/workspaces (drop into).
   - Dragging items out to the unsorted root-level list.
6. The entire implementation must run smoothly without any React rendering errors.

### Strategic Reasoning
1. **Tri-Zone Hitbox Detection:** Instead of splitting the target's height 50/50 between "above" and "below" (which prevents nesting items inside folders because the edge is never `null`), folders and workspaces are divided into three vertical zones:
   - Top 30% for placing before (above) the target.
   - Bottom 30% for placing after (below) the target.
   - Middle 40% for nesting inside the target folder/workspace.
   Pages (which cannot have children) will keep the 50/50 split.
2. **Decoupled Sibling Updates:** Workspaces and Unsorted items share `parentId === null` and `workspaceId === 'ws-personal'`. Sibling filters in `Sidebar.tsx` currently bundle them together, corrupting the sort orders of both lists when dragging either. We will decouple these lists so that workspaces and unsorted items are reordered independently.
3. **Drop Restrictions:** Enforce strict type validation:
   - Workspaces can only be dropped on other workspaces (sibling reorder).
   - Folders/pages cannot be dropped as siblings of workspaces, only nested inside them.
   - Restrict container drop targets accordingly (e.g. `workspaces-container` only accepts workspaces).

### Detailed Blueprint
1. **`src/components/layout/TreeItem.tsx`**:
   - Expose `entityType` in `draggable` initial data.
   - Refine `canDrop` rules to enforce workspace/collection drop constraints.
   - Update `onDragEnter` and `onDrag` to compute the correct tri-zone edge.
   - Enable sibling line rendering for folder targets and only show target highlight for nesting (center drop).
2. **`src/components/layout/Sidebar.tsx`**:
   - Add matching tri-zone edge calculation inside drops monitor.
   - Decouple sibling filter queries when `newParentId === null` to separate workspaces from unsorted items.
   - Filter container drop zones with `canDrop`.
3. **`docs/plans/2026-06-10-sidebar-drag-and-drop-refinement.md`**:
   - Detail the task breakdown for sequential execution.

### Operational Trace
1. Researched `src/components/layout/Sidebar.tsx` and `src/components/layout/TreeItem.tsx` to locate the drag-and-drop setup.
2. Created a detailed implementation plan in the workspace at `docs/plans/2026-06-10-sidebar-drag-and-drop-refinement.md` specifying tasks, failing/passing test requirements, code snippets, and verification procedures.
3. Created the `implementation_plan.md` artifact in the active conversation's brain folder.

### Status Assessment
The implementation plan is complete and ready. Once approved by the user, we can begin executing it step-by-step.
