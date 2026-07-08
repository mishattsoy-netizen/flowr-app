User request: "time was set wrong. time and date still doesnt work properly"

### 0. Date and time
2026-07-07 | 20:12 local time

### 1. User request
User pointed out that task date/time modifications still did not work correctly (e.g. setting time to 10pm resulted in the next day at 1:00 AM in the inspector, and date ranges shifted incorrectly).

### 2. Objective Reconstruction
Align the tool handler returns in the backend with the client-side store's expected fields. If the backend returns database-aligned names (e.g., `due_date`, `include_time`) or omits properties, the frontend cannot map them correctly during tool result processing, resulting in properties being wiped out on the local store, which then triggers a sync cycle that overwrites the correct database entries.

### 3. Strategic Reasoning
- The AI correctly triggers `create_content` and `update_content` with camelCase parameters like `dueDate`, `includeTime`, `endDate`, and `reminder`.
- The database writes them to snake_case columns (`due_date`, `include_time`, etc.).
- However, when returning the tool execution result:
  - `create_content` for tasks only returned `{ success: true, id, type: 'task', title }`, completely omitting the newly created properties.
  - `update_content` for tasks returned `{ success: true, id, ...updates }` where `updates` contained the database keys (e.g. `due_date`, `include_time`).
- Because of this, the frontend's Zustand store (which processes these results and updates local task objects using camelCase keys like `tr.dueDate`, `tr.includeTime`) received `undefined` for all of these fields.
- Wiping these fields in local state and immediately synchronizing back to the database was shifting timezone dates and disabling the "includeTime" toggle.
- Returning all updated camelCase properties in both `create_content` and `update_content` handlers resolves the mapping mismatch completely.

### 4. Detailed Blueprint
- `src/lib/bot/tools/handlers.ts`:
  - Update `create_content` for `task` to return all camelCase properties (`dueDate`, `endDate`, `includeTime`, `reminder`, `description` as `description`, `priority`, `tag`, `status`, `assignedWorkspaceId`).
  - Update `update_content` for `task` to return `{ success: true, id, ...args }` where `args` contains all camelCase parameters passed to the tool, instead of `...updates`.

### 5. Operational Trace
- Inspected the backend tool execution result formats in `handlers.ts`.
- Found that `create_content` omitted time properties and `update_content` returned database-mapped keys.
- Corrected both returns to supply the client-side store with matching camelCase property values.
- Verified TypeScript compilation.

### 6. Status Assessment
Fixed. Dates and times set by the AI will now persist in the local store and Supabase database without getting wiped or offset by local sync.
