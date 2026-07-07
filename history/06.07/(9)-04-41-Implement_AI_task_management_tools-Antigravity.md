User request: "yes." (in response to adding text-based task fields and list_tasks with attachment counts)

## 2. Objective Reconstruction
The user confirmed that we should skip file upload/attachment capabilities for tasks via the AI chat for now, and instead provide the AI with rich text-based access to the task board. The objective is to implement `list_tasks`, `update_task`, and `delete_task` tools for the AI, while extending the existing `create_task` tool to support new fields like custom tags, due dates, workspace assignment, and subtasks. `list_tasks` should also report an `attachmentCount` so the AI knows if files are attached.

## 3. Strategic Reasoning
- The AI previously only had a rudimentary `create_task` tool. To be a capable assistant for the Kanban board, it needs full CRUD capabilities.
- I need to edit `src/lib/bot/tools/definitions.ts` to add the new schemas so the AI knows how to invoke them.
- I need to edit `src/lib/bot/tools/handlers.ts` to execute the database operations using `supabaseAdmin`, ensuring I enforce `owner_id` constraints so the AI can only modify the user's own tasks.
- For `list_tasks`, the attachment count can be derived by safely parsing the `attachments` JSON blob from the `tasks` table.

## 4. Detailed Blueprint
- **Tool Definitions (`definitions.ts`)**: Update `create_task` parameters. Add `update_task` (requiring `id`), `delete_task` (requiring `id`), and `list_tasks`. Include `tag`, `workspaceId`, `dueDate`, and `subtasks` in the properties.
- **Backend Handlers (`handlers.ts`)**: 
  - Update `create_task` to map the new parameters to `tasks` table columns (`tag`, `due_date`, `workspace_id`, `subtasks`).
  - Implement `update_task` with an `updates` object and `.eq('id', id).eq('owner_id', userId)`.
  - Implement `delete_task` with a simple Supabase delete.
  - Implement `list_tasks` to select all tasks for the active workspace, parsing the `attachments` field to return `attachmentCount`.
- **System Prompt (`tools.txt`)**: Update the instructions so the AI knows the new tools are available and what fields they support.

## 5. Operational Trace
- Edited `src/lib/bot/tools/definitions.ts` to wire up the new schemas.
- Edited `src/lib/bot/tools/handlers.ts` to provide the Supabase execution logic for the 4 task tools.
- Edited `src/lib/bot/prompts/tools.txt` to instruct the AI to use `list_tasks` to read the board, and `update_task`/`delete_task` as needed.

## 6. Status Assessment
The AI now has full programmatic control over the user's tasks. It can read the entire board (including subtask and attachment counts), update existing tasks (changing status, priority, due date, etc.), create fully-featured tasks, and delete them. The backend correctly enforces ownership limits. No actual file attachment parsing was implemented as agreed.
