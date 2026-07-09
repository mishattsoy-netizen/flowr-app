User request: "worksapce now can be created but tasks needs some fixing, bot didnt create tasks. none of the tasks wasnt created, and assigned to new worksappce"

## 2. Objective Reconstruction
The user noticed that when they asked the AI to "assign 3 random tasks to this workspace", the AI instead added markdown checklists to a newly created note (e.g. "Bio & Overview") rather than creating actual task items inside the app's Task Tracker (Kanban board) for that workspace. The objective is to fix this by giving the AI the actual technical capability to interact with the Tracker component via a dedicated tool.

## 3. Strategic Reasoning
- Upon examining `src/lib/bot/prompts/tools.txt` and `src/lib/bot/tools/definitions.ts`, I discovered that there were *no* tools defined for task creation. The AI was literally incapable of creating real tasks, so it improvised by creating a note full of markdown checklist blocks.
- To resolve this, I needed to implement a full backend-to-frontend pipeline for a new `create_task` tool.
- The new tool needed to be documented in the system prompt (`tools.txt`), declared as a callable JSON schema function (`definitions.ts`), processed and inserted into the database (`handlers.ts`), and successfully optimistic-updated in the frontend UI (`store.ts`).

## 4. Detailed Blueprint
- **Schema**: Add `create_task(title, description, status, priority)` to `definitions.ts`.
- **Backend Execution**: Add `create_task` inside `handlers.ts` to insert into the `tasks` table with the active `workspaceId`.
- **Frontend Sync**: Add optimistic processing for `create_task` in `processToolResults` within `src/data/store.ts` by calling `get().addTask(...)`.
- **AI Instructions**: Update `tools.txt` to explicitly instruct the AI to use `create_task` instead of markdown checklists when asked to manage tasks.

## 5. Operational Trace
- Edited `src/lib/bot/tools/definitions.ts` to add the `create_task` schema object.
- Edited `src/lib/bot/tools/handlers.ts` to add the asynchronous insert logic.
- Edited `src/data/store.ts` via `replace_file_content` to add `create_task` tool results processing.
- Edited `src/lib/bot/prompts/tools.txt` to add the `create_task` command reference and append a critical rule forbidding markdown checklists as a substitute.

## 6. Status Assessment
The AI has now been granted full administrative capabilities over the Task Tracker. It knows exactly how to use the new `create_task` tool and when to use it, preventing it from incorrectly hallucinating checklist notes. Tasks will now correctly appear in the Tracker's Kanban board.
