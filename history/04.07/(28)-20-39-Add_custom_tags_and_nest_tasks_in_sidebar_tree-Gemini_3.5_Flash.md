### 0. Date and time of the request
Date: 04.07.2026
Time: 20:35 (Start) - 20:39 (End)

### 1. User request
User request: "add custom tag filed, that is displayed next to workspace pill in task card(same colors as workspace pill but a bit dimmed)(also add max widths to pills like custom tag and workspaces with fade out if pills title doesnt fit). Als show custom tasks nested under workspaces in left sidebar ike treeitems, when i click certain tag->show noly tasks with  this tags"

### 2. Objective Reconstruction
1. Support adding a custom tag per task in the task inspector panel form, saving this text value onto the task (`AppTask.tag`).
2. Render the custom tag pill next to the workspace name pill inside the task card:
   - Dimmed colors: `bg-[var(--bone-6)]` and `text-[var(--bone-50)]`.
   - Max width controls: Max-width limits (`max-w-[80px]` for tag, `max-w-[90px]` for workspace) with a CSS `mask-image` linear gradient right-fadeout so text overflows smoothly rather than showing generic ellipses.
   - Interactive filtering: Clicking the tag pill toggles active tag filtering (`trackerFilterTag`), displaying an active filter indicator pill next to the "Tasks" title in `TrackerPage` to clear it, and applying the filter.
3. Nest tasks under workspaces in the sidebar directory tree as TreeItems (with `CheckSquare` icon). Clicking a sidebar task item opens its TaskInspectorPanel.

### 3. Strategic Reasoning
- **Data modeling**: Added `tag?: string` optional property to `AppTask` in `store.types.ts`. Extended `EntityType` to support `'task'` so we can map tasks to pseudo-entities in the sidebar.
- **Pill aesthetics**: Applying CSS gradient fade masks (`[mask-image:linear-gradient(to_right,black_calc(100%-12px),transparent_100%)]`) gives a high-end visual look compared to text-ellipsis truncation. Clicking a tag pill highlights it in a green border overlay style.
- **Sidebar nesting**: Workspace `children` lists resolve normal folders/notes and append tasks matching that workspace's ID, sorted at the bottom. The click event redirects to `openTaskPanel`.

### 4. Detailed Blueprint
- `src/data/store.types.ts`: Update `EntityType` union; add `tag` to `AppTask`, `trackerFilterTag` and its action to `AppState`.
- `src/data/store.ts`: Initialize `trackerFilterTag` and implement `setTrackerFilterTag`.
- `src/components/tracker/TaskInspectorPanel.tsx`: Add custom tag text field, state, and save handling.
- `src/components/tracker/TaskCard.tsx`: Render tag pill with styling, click listener, and layout fade masks.
- `src/components/tracker/TrackerPage.tsx`: Apply tag filter to task rendering list; display active tag clear badge in header.
- `src/components/layout/TreeItem.tsx`: Map workspace tasks, render task checksquare icon, redirect clicks to task panel.

### 5. Operational Trace
- Edited store types, initializers, task inspector inputs, task cards layout, sidebar tree item maps, and headers.
- Successfully verified typescript builds.

### 6. Status Assessment
Completed successfully. Custom tags are fully integrated, interactive tag filtering is active, and tasks are beautifully nested in the workspace sidebar.
