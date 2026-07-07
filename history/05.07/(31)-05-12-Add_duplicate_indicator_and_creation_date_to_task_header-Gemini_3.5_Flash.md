### 0. Date and time of the request
Date: 05.07.2026
Time: 05:12 (Start) - 05:12 (End)

### 1. User request
User request: "add this button next to the close button that opens new task(and saves current one if not empty)" -> followed by clarifying choices adding a Sync status indicator, task creation timestamp, and a Duplicate action.

### 2. Objective Reconstruction
- Add three new visual and functional elements to the task inspector panel's header:
  - **Left side**: A muted creation date timestamp (e.g. `Created Jul 5, 2026`) and a real-time Sync Status Indicator (loading spinner when saving to Supabase, checkmark when successfully synced, and "Sync error" on write failures).
  - **Right side**: A "Duplicate task" action button (represented by the `Copy` icon) next to the new task button. When clicked, it replicates all task fields (including subtasks with fresh IDs) and loads the new duplicate task.

### 3. Strategic Reasoning
- The Sync Status Indicator provides feedback to the user that their automatic edits are successfully synchronized to the backend database. Updated the store's `addTask` and `updateTask` actions to return the database upsert promise to enable this tracking.
- The Duplicate feature extracts all states of the current task and feeds them into the store's `openTaskPanel` presets so the new task initialized is identical but distinct.

### 4. Detailed Blueprint
- `src/data/store.types.ts` & `src/data/store.ts`:
  - Update `addTask` and `updateTask` return signatures to `Promise<{ error: any }>`.
- `src/components/tracker/TaskInspectorPanel.tsx`:
  - Fetch `tasks` from store.
  - Implement a `syncState` local state (`'idle' | 'saving' | 'saved' | 'error'`).
  - Pass `setSyncState` to `TaskPanelContent` and handle the returned promise resolutions in the auto-save effect.
  - Build `formattedCreatedAt` timestamp and render it on the left of the header layout.
  - Add the `handleDuplicate` trigger next to the other header buttons.

### 5. Operational Trace
- Adjusted panel header layout components and store types.
- Verified TypeScript compilation.

### 6. Status Assessment
Completed successfully. The task inspector header now includes the creation timestamp, real-time sync status, task duplication trigger, and new task creator.
