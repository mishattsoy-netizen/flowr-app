User request: "limit to 20 recently modified"

## 2. Objective Reconstruction
Modify the newly added `read_workspace` tool to only return the 20 most recently modified notes in the workspace to prevent excessively large payloads and potential API timeouts when querying very large workspaces.

## 3. Strategic Reasoning
- Although modern LLMs like Gemini 1.5 Pro have very large context windows, the user expressed concern about querying unlimited notes simultaneously. 
- Restricting to the 20 most recently modified notes acts as a safety limit against extreme outliers, reducing database load and LLM context bloat while keeping the core capability intact for active notes.

## 4. Detailed Blueprint
- `src/lib/bot/tools/handlers.ts`: Append `.order('last_modified', { ascending: false }).limit(20)` to the Supabase query in `read_workspace`.
- `src/lib/bot/tools/definitions.ts`: Update tool description to explicitly say it reads "up to 20 recently modified notes".
- `src/lib/bot/tools/prompt.ts`: Update the `TOOL_INSTRUCTIONS` text to align with the new 20-note limit.

## 5. Operational Trace
- Updated `handlers.ts` to limit the Supabase `.from('entities')` query.
- Updated the tool definition description in `definitions.ts`.
- Updated the internal system prompt in `prompt.ts`.

## 6. Status Assessment
- `read_workspace` now safely limits the payload to the top 20 most recently modified notes. Issue resolved.
