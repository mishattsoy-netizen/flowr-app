### 0. Date and time of the request
Date: 04.07.2026
Time: 20:41 (Start) - 20:44 (End)

### 1. User request
User request: "NO you didnt udersttand, what did i tellabout tags?
Als show custom tasks nested under workspaces in left sidebar ike treeitems, when i click certain tag->show noly tasks with this tags"

### 2. Objective Reconstruction
1. Clarified that the user meant nested custom *tags* (not custom *tasks*) under workspaces in the left sidebar directory tree.
2. Nest each workspace's unique active task tags (extracted from the workspace's task collection) as tree items with a `Tag` icon under the workspace node.
3. Clicking a tag node under a workspace in the sidebar switches the main active view to the Tasks page and sets both the workspace filter (`trackerFilterWorkspace`) and the tag filter (`trackerFilterTag`) accordingly to show only matching tasks.

### 3. Strategic Reasoning
- **Data representation**: Changed `EntityType` from `'task'` to `'tag'`. Extracted unique tags dynamically from `tasks` where `t.workspaceId === workspace.id`.
- **Navigation flow**: Switched click behavior on tag tree items to:
  1. Set `trackerFilterWorkspace` to the task's parent workspace ID.
  2. Set `trackerFilterTag` to the tag name.
  3. Navigate/switch view to the Tasks board by setting `activeEntityId` to `'tracker'`.

### 4. Detailed Blueprint
- `src/data/store.types.ts`: Update `EntityType` union replacing `'task'` with `'tag'`.
- `src/components/layout/TreeItem.tsx`:
  - Extract unique tags from workspace tasks, formatting each as a pseudo-entity of type `'tag'`.
  - In `handleClick`, check for type `'tag'` and apply workspace filter, tag filter, and transition page to `'tracker'`.
  - In `getIcon`, return standard Lucide `Tag` icon for `'tag'` items.

### 5. Operational Trace
- Replaced task mapping with unique tag mapping under workspaces.
- Successfully verified typescript builds.

### 6. Status Assessment
Completed successfully. Directory tree items nested under workspace nodes now represent unique workspace task tags, clicking which directly filters the main Tasks Kanban board by workspace and tag.
