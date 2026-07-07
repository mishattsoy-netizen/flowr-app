User request: "remove delete tools, ai shouldnt have access to delete tools for safety reasonsn and it should know that."

### 0. Date and time of the request
06.07 16:31

### 1. User request
User request: "remove delete tools, ai shouldnt have access to delete tools for safety reasonsn and it should know that."

### 2. Objective Reconstruction
Remove all capabilities for the AI to delete entities (notes, tasks, etc.) to prevent accidental data loss. Update the AI's internal instructions so it is aware it lacks deletion permissions and can gracefully reject deletion requests.

### 3. Strategic Reasoning
- The delete_note and delete_task tools must be completely wiped from the schema (definitions.ts), handlers (handlers.ts), and the system prompts (prompt.ts, 	ools.txt).
- AI providers UI logic (groq.ts, google.ts, 
vidia.ts, openrouter.ts) must also stop registering these tools.
- A new top-level instruction should be added to the AI rules: "You DO NOT have any delete tools for safety reasons. If the user asks you to delete something, politely inform them that you cannot delete items for safety and they must delete it manually."

### 4. Detailed Blueprint
- src/lib/bot/tools/definitions.ts: Remove the JSON definitions for delete_note and delete_task.
- src/lib/bot/tools/handlers.ts: Delete the delete_note and delete_task async methods from 	oolHandlers.
- src/lib/bot/tools/prompt.ts: Remove delete_note from the tool list and append the new safety rule.
- src/lib/bot/prompts/tools.txt: Same as prompt.ts.
- src/lib/bot/providers/*.ts: Remove 'delete_note' and 'delete_task' from tool registration arrays.

### 5. Operational Trace
- Executed Node script to regex-replace and strip delete_note and delete_task across prompt.ts, definitions.ts, handlers.ts, 	ools.txt, and provider files.
- Encountered a syntax error in handlers.ts due to an overly eager regex stripping the export const toolHandlers... declaration.
- Restored the export const toolHandlers declaration via another Node script.
- Verified system integrity and tool removals by running 
pm run build, ensuring no TypeScript or runtime errors remained. 

### 6. Status Assessment
Completed. All deletion-related tools have been fully stripped from the codebase and AI context. The AI prompt now explicitly forbids it from attempting to delete files and commands it to redirect the user to do it manually.
