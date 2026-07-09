User request: "what is this READ WORKSPACE artifact Untitled? whn i click it nothing happens. Alsoartifact shows folder icon and untitled but i dont have folder with this name. When i said summarize personal workspace, i wanted to test if bot could read worksapce folder even if i didnt use metion tool but i think he didnt read specific worksapce and read eveything instead, analyze what happened and why and how to fix it."

## 2. Objective Reconstruction
1. Fix the `read_workspace` tool pill UI to display the actual workspace title and handle clicks properly.
2. Allow the AI to read workspaces *other* than the currently active one by adding a `list_workspaces` tool and updating `read_workspace` to accept an optional `workspaceId` parameter.

## 3. Strategic Reasoning
- The user observed that the "READ WORKSPACE" pill in the chat history was named "Untitled" and did nothing when clicked. This was because `read_workspace` returned `{ workspaceId }` instead of `{ id, title }`, meaning the frontend UI couldn't map it properly to an entity for display or navigation.
- The user also noticed that the AI summarized the "Personal" workspace (which was likely their active workspace at the time) but incorrectly suspected it read "everything". Because `read_workspace` implicitly used the active workspace ID, the AI was actually trapped in the active workspace. If the user had asked to summarize a different workspace while inside "Flowr Startup", it would have failed. 
- Adding `list_workspaces` allows the AI to discover all workspace IDs, and adding the optional `workspaceId` argument to `read_workspace` enables true cross-workspace reading.

## 4. Detailed Blueprint
- `src/lib/bot/tools/handlers.ts`: 
  - Update `read_workspace` to fetch the workspace title and return `{ id, title }` to fix the UI pill.
  - Add `list_workspaces` handler to fetch all entities where `type = 'workspace'` for the current user.
  - Update `read_workspace` to accept `workspaceId` from args.
- `src/lib/bot/tools/definitions.ts`: Define `list_workspaces` and update `read_workspace` parameters.
- `src/lib/bot/tools/prompt.ts`: Inject `list_workspaces` into the `TOOL_INSTRUCTIONS`.

## 5. Operational Trace
- Added `list_workspaces` to `handlers.ts`, `definitions.ts`, and `prompt.ts`.
- Updated `read_workspace` in `handlers.ts` to accept `workspaceId` and return `{ id, title }`.
- Updated `read_workspace` in `definitions.ts` to document the optional parameter.

## 6. Status Assessment
- The AI can now switch workspaces and summarize *any* workspace by finding its ID via `list_workspaces` and passing it to `read_workspace(id)`.
- The frontend chat UI will now correctly display "READ WORKSPACE [Workspace Title]" and the pill will be clickable.
- Issue fully resolved.
