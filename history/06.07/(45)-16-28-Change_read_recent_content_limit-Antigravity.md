User request: "change read_recent_content to 10 max."

### 0. Date and time of the request
06.07 16:28

### 1. User request
User request: "change read_recent_content to 10 max."

### 2. Objective Reconstruction
Reduce the maximum number of items returned by the ead_recent_content AI tool from 20 to 10.

### 3. Strategic Reasoning
- The tool's description in the system prompt (prompt.ts) and AI tool definitions (definitions.ts) must be updated to explicitly state "up to 10 recently modified notes".
- The backend handler (handlers.ts) must change its Supabase query from .limit(20) to .limit(10).

### 4. Detailed Blueprint
- src/lib/bot/tools/prompt.ts: Update text description from 20 to 10.
- src/lib/bot/tools/definitions.ts: Update description from 20 to 10.
- src/lib/bot/tools/handlers.ts: Find ead_recent_content database query and modify .limit(20) to .limit(10).
- src/lib/bot/prompts/tools.txt: Update the fallback text block.

### 5. Operational Trace
- Used Node script to search for the specific "up to 20 recently modified notes" phrase in prompt.ts, definitions.ts, and 	ools.txt and replaced it with 10.
- Replaced the hardcoded .limit(20) chained onto the order clause in handlers.ts inside ead_recent_content to .limit(10).

### 6. Status Assessment
Completed. The tool now strictly enforces a 10 item maximum both in its documented instructions for the LLM and in the actual backend database query.
