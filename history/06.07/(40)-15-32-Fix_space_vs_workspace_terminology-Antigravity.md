User request: "wdym before reading a non-active workspace? or it simply called read_workspace() and successfully read the active one? wdym by active or non active, I think you are confusing workspaces(main folders as categories for entities in sidebar) with spaces(isolated space with separate isolated entites and all content)"

## 2. Objective Reconstruction
Resolve the naming collision where the AI mistakenly treated the isolated App Space (`activeWorkspaceId`) as the root-level sidebar folders (`entities` with `type: 'workspace'`).

## 3. Strategic Reasoning
- The user pointed out a massive architectural terminology mistake on my end. In the DB schema, isolated environments are called `workspace_id` (e.g. `ws-personal`), whereas the UI and user refer to these as "Spaces".
- Conversely, the UI sidebar has root-level folders which the user calls "Workspaces" (which map to `entities` where `type: 'workspace'`).
- Because I named the tool `read_workspace` and queried `.eq('workspace_id', spaceId)`, the AI ended up fetching the entire isolated space (which included *both* the "Flowr Startup" folder and the "Personal" folder) rather than the specific root sidebar folder.
- To fix this, I renamed the tools to explicitly separate these concepts: `read_entire_space` for the isolated DB, and `read_sidebar_workspace(entityId)` to fetch only the descendant notes of a specific sidebar root folder.

## 4. Detailed Blueprint
- **`definitions.ts`**: Replace `list_workspaces` and `read_workspace` with `read_entire_space` and `read_sidebar_workspace`.
- **`handlers.ts`**: 
  - Update `read_entire_space` to fetch the whole isolated space based on `context.activeWorkspaceId`.
  - Create `read_sidebar_workspace` to fetch the entity tree for the active space, isolate the target `entityId`, find all its descendants, and return only the descendant notes.
- **`prompt.ts`**: Update the AI prompt instructions to reflect the new tool names and correct terminology.

## 5. Operational Trace
- Edited `definitions.ts`, `handlers.ts`, and `prompt.ts` to implement the new tool names and recursive tree-fetching logic for sidebar workspaces.

## 6. Status Assessment
- Terminology collision fixed. The AI now distinguishes between the isolated app "Space" and the sidebar "Workspaces" (folders).
- The AI can now accurately fetch the exact contents of a specific sidebar workspace by finding its entity ID and pulling its descendants.
