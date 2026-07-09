User request: "no i want all content to be isolated per space. so if im chatting in personal space, i should even tell ai to fetch task in CURRENT workspace becuse it should even have acces to other spaces"

## 2. Objective Reconstruction
The user clarified that the AI should act as if the current active workspace is the *only* universe of tasks it has access to. It shouldn't even know that other spaces exist, nor should it require the concept of a "current workspace" in its instructions, and it shouldn't be able to reassign tasks to other workspaces. The objective is to remove all references to `workspaceId` and "current workspace" from the AI tools and prompts.

## 3. Strategic Reasoning
- Previously, I instructed the AI that `list_tasks` lists tasks "in the current workspace", implying there might be others.
- I also gave the AI the ability to pass `workspaceId` when creating or updating tasks, which could theoretically allow it to assign a task to another space.
- By removing these prompts and schemas, the AI's universe is isolated entirely to the space the user is currently viewing (since the backend handler already automatically defaults to `activeWsId` implicitly and securely).

## 4. Detailed Blueprint
- **tools.txt**: Remove `workspaceId` from the parameter signatures of `create_task` and `update_task`. Change the description of `list_tasks` from "List all tasks in the current workspace" to simply "List all tasks".
- **definitions.ts**: Remove the `workspaceId` property entirely from the schemas of `create_task` and `update_task`. Change the `list_tasks` description.

## 5. Operational Trace
- Edited `src/lib/bot/prompts/tools.txt` to remove `workspaceId` references.
- Edited `src/lib/bot/tools/definitions.ts` to remove the `workspaceId` parameter from the JSON schema.

## 6. Status Assessment
The AI's task management tools are now strictly sandboxed to the active workspace both functionally and conceptually. It has no awareness of other spaces and no schema capability to target them.
