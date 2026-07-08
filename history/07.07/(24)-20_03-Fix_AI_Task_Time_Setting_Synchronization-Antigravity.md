User request: "transcripts/ai-transcript-2026-07-07T16-59-36.md transcripts/ai-transcript-2026-07-07T17-02-21.md Ai failed to set time for task."

### 0. Date and time
2026-07-07 | 20:03 local time

### 1. User request
User pointed out that when the AI creates a task with a specific time (e.g. "9pm today"), the time is not set properly on the task in the UI (it gets set to the next day without time, and the "include time" toggle is off).

### 2. Objective Reconstruction
Resolve the issue where a task created or updated by the AI with a specific time fails to preserve its time properties (like `includeTime`, `endDate`, `reminder`, etc.) in the frontend local state, leading to a synchronization overwrite that resets these values on the server.

### 3. Strategic Reasoning
When the AI tool `create_content` executes, it successfully saves all values (including `includeTime` and `dueDate` with the correct ISO timestamp) directly to the Supabase database. 

However, in Flowr's local-first architecture, when the client receives the `toolResults` array in `src/data/store.ts` (`POST` response handler):
- It was calling `get().addTask()` to append the new task to the Zustand store, but it did **not** pass `includeTime: tr.includeTime`, `endDate: tr.endDate`, `reminder: tr.reminder`, or `note: tr.description` fields to the store constructor. 
- Consequently, the local task object had these values set to `undefined`. 
- The client-side database synchronizer (`sync.ts`) then immediately ran its auto-save cycle (`upsertTask`) using the incomplete local object, pushing `include_time = null` back to Supabase and overwriting the correct time values that the AI had just set!
- Similarly, `update_content` tool results were completely ignored for tasks in the local store, depending solely on slow real-time DB sync.

### 4. Detailed Blueprint
- `src/data/store.ts`: 
  - Update `create_content` task handler in `lastToolResults` processor to include `includeTime`, `endDate`, `reminder`, and `note` (from `description`).
  - Add a dedicated local task update handler for `update_content` (when `tr.id.startsWith('task-')`) so client-side state updates instantly.
  - Exclude tasks from the notes `update_content` handler.

### 5. Operational Trace
- Inspected transcripts of the failure to verify that the AI called `create_content` with `includeTime: true` and the correct ISO timestamp, and that the database returned success.
- Found the missing fields in the Zustand `lastToolResults` handler in `src/data/store.ts`.
- Modified `src/data/store.ts` to map and preserve `tr.includeTime`, `tr.endDate`, `tr.reminder`, and `tr.description` (mapped to `note`) when calling `addTask`.
- Added the `update_task` store mutation within the tool result execution loop to sync task edits immediately.

### 6. Status Assessment
Fixed. AI-created tasks with specific times will now successfully render the time in the UI and won't have their timezone/time metadata stripped during local synchronization.
