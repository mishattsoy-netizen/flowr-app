User request: "make sure that folder can only be create in the parent workspace, it cant stand without parent. entities like canvas and notes can be either created/moved, in the unsorted, workspace root, or specific folder INSIDE the workspace(folders can be nested in eachother)"

### 0. Date and time of the request
06.07 16:24

### 1. User request
User request: "make sure that folder can only be create in the parent workspace, it cant stand without parent. entities like canvas and notes can be either created/moved, in the unsorted, workspace root, or specific folder INSIDE the workspace(folders can be nested in eachother)"

### 2. Objective Reconstruction
Enforce strict hierarchy rules for entities:
1. Folders MUST have a parent (a workspace or another folder). They cannot be unsorted.
2. Notes (and canvases) CAN be unsorted, or they can be placed inside a workspace root or specific folder.
The AI tools and prompts need to reflect these rules, and the backend handlers need to enforce them.

### 3. Strategic Reasoning
- Updated create_folder tool definition to make parentId required.
- Updated create_folder handler to explicitly reject requests where parentId is missing or is just a Space identifier (ws-xxx), ensuring it must be a valid entity ID.
- Updated create_note tool definition to explicitly describe the valid placement options (unsorted, workspace, folder).
- Updated prompt.ts and 	ools.txt to clearly state these rules to the AI.

### 4. Detailed Blueprint
- src/lib/bot/tools/prompt.ts: Update create_folder to state parentId is required and must be a workspace or another folder. Update create_note to state it can be unsorted (omit parentId), inside a workspace, or inside a folder.
- src/lib/bot/tools/definitions.ts: Update create_folder schema to make parentId a required string parameter. Update create_note description to explain placement rules.
- src/lib/bot/tools/handlers.ts: In create_folder, add a validation check if (!parentId || parentId.startsWith('ws-')) and return an error if triggered.
- src/lib/bot/prompts/tools.txt: Sync descriptions.
- src/lib/sync.ts: Fixed another lingering SpaceId vs spaceId TypeScript typo for AppTask.

### 5. Operational Trace
- Used Node scripts to update the text descriptions in prompt.ts, definitions.ts, and 	ools.txt.
- Changed the JSON schema for create_folder in definitions.ts to add "parentId" to the equired array.
- In handlers.ts, updated the create_folder function signature and added an explicit error return if a valid parentId is missing.
- Fixed 	.SpaceId to 	.spaceId in sync.ts based on build logs.

### 6. Status Assessment
Completed. The AI is now explicitly instructed on the strict structural rules, and the create_folder backend handler enforces that a parent entity ID is provided, preventing folders from being orphaned at the root space level.
