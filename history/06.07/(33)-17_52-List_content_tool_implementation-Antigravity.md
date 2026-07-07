User request: "actualy 20k tokens is 67k character not 20k so we can increase max chars"

### 0. Date and time of the request
06.07, 17:52

### 1. User request
User request: "actualy 20k tokens is 67k character not 20k so we can increase max chars"

### 2. Objective Reconstruction
Implement the universal `list_content` tool to consolidate all app fetching capabilities into one powerful, heavily-filtered tool. Also implement dynamic token truncation to ensure that the payloads returned to the AI do not exceed a hard 65,000 character limit (~20k tokens), protecting context sizes.

### 3. Strategic Reasoning
Instead of having scattered tools for listing notes, searching, listing tasks, etc., one tool with extensive parameters allows the AI to fetch exact data efficiently. Tasks have both `space_id` for multi-tenant isolation and `entity_id` for assigned workspace filtering, which are mapped cleanly. The dynamic JSON payload truncation accurately protects token bounds without artificially limiting the number of titles fetched.

### 4. Detailed Blueprint
- Remove deprecated tools: `list_notes`, `search_notes`, `read_sidebar_workspace`, `read_recent_content`, `list_tasks`.
- Implement `list_content` handler with querying for `entities` and `tasks` based on the requested type.
- Update AI prompts in `prompt.ts`.
- Update provider configs in `google.ts`, `groq.ts`, `nvidia.ts`, `openrouter.ts`.

### 5. Operational Trace
- Edited `definitions.ts` to add the `list_content` schema and remove old tools.
- Completely rewrote `handlers.ts` to implement `list_content`, adding `MAX_CHARS` limit of 65000, ensuring heavy fields like `content` and `description` are stripped if the limit is exceeded.
- Updated `prompt.ts` with new tool usage instructions.
- Modified `providers` array config.
- Ran `npm run build` and fixed a Typescript `any` issue with the `.map()` function.

### 6. Status Assessment
The `list_content` tool is fully implemented and compiled successfully. Token limiting is active.
