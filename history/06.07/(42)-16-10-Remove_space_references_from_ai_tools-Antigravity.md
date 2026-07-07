User request: "rename read_entire_space tool to read_recent_content and i dont wnat you to even mention spaces to ai, because it shouldnt even have acces to other space even if it wanted, it only should think that it hass acces tho all app content, but it shoulkdnt know about spaces, do you understand what i mean?"

### 0. Date and time of the request
06.07 16:10

### 1. User request
User request: "rename read_entire_space tool to read_recent_content and i dont wnat you to even mention spaces to ai, because it shouldnt even have acces to other space even if it wanted, it only should think that it hass acces tho all app content, but it shoulkdnt know about spaces, do you understand what i mean?"

### 2. Objective Reconstruction
Rename AI tools and update prompts so the AI assistant is completely unaware of "Spaces". It should operate under the assumption that it has access to the "entire app", when in reality the data it receives is strictly isolated. 

### 3. Strategic Reasoning
- The ead_entire_space tool must be renamed to ead_recent_content.
- Any mention of "workspace" or "space" must be removed from prompt.ts and definitions.ts. The AI should only see "folder", "root folder", or "app content".
- The actual router handles (handlers.ts) and AI tool triggers (google.ts, etc.) must match the new string names to maintain functionality.

### 4. Detailed Blueprint
- src/lib/bot/tools/prompt.ts: Rewrite TOOL_INSTRUCTIONS replacing "space" and "workspace" with "app" or "folder". Update ead_entire_space to ead_recent_content. Update ead_sidebar_workspace to ead_folder_content. Update create_workspace to create_root_folder.
- src/lib/bot/tools/definitions.ts: Rename the tools and their descriptions equivalently.
- src/lib/bot/tools/handlers.ts: Update the handler method names from ead_entire_space, ead_sidebar_workspace, and create_workspace to the new names so the 	oolHandlers export has the right keys.
- src/lib/bot/providers/*.ts: Update any hardcoded tool names in the providers that check for tools triggering UI updates.
- src/lib/bot/prompts/tools.txt: Update the text definitions identically.
- src/lib/sync.ts: Fixed a lingering SpaceId TS error.

### 5. Operational Trace
- Used Node script to rewrite prompt.ts.
- Used Node script to regex replace names in definitions.ts.
- Used Node script to update method names in handlers.ts and hardcoded names in 4 provider files (google.ts, groq.ts, 
vidia.ts, openrouter.ts), and 	ools.txt.
- Fixed a minor SpaceId typo in src/lib/sync.ts breaking the build.

### 6. Status Assessment
Completed. The AI prompt and its tools have been stripped of any "space" or "workspace" terminology. The AI now believes it has access to the "app", while isolation is strictly maintained under the hood.
