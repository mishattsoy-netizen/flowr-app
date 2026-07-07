User request: "but if i ask to summarize workspace not just one entity?"

## 2. Objective Reconstruction
Implement a tool that allows the AI to read the content of all entities within the active workspace simultaneously to support broad "summarize my workspace" requests without requiring parallel pagination through dozens of `read_note` calls.

## 3. Strategic Reasoning
- The user highlighted a valid gap: while the newly added `read_note` tool allows the AI to fetch specific notes, summarizing an entire workspace with many notes would require the AI to call `list_notes`, parse the IDs, and then emit numerous concurrent `read_note` calls. This might exceed tool call hop limits or be inefficient.
- To address this, I introduced the `read_workspace` native tool, which queries the database for all entities matching the current workspace ID and returns their full textual content in a single payload.
- This effectively replaces the functionality the user expected from the deprecated legacy frontend XML tools, but implemented natively and robustly on the backend.

## 4. Detailed Blueprint
- `src/lib/bot/tools/definitions.ts`: Add the `read_workspace` tool definition.
- `src/lib/bot/tools/handlers.ts`: Implement the `read_workspace` backend handler.
- `src/lib/bot/tools/prompt.ts`: Update `TOOL_INSTRUCTIONS` to inform the AI about the `read_workspace` tool for full workspace summarization tasks.

## 5. Operational Trace
- Edited `definitions.ts` to add `read_workspace` signature.
- Edited `handlers.ts` to add the Supabase querying logic for `read_workspace`.
- Edited `prompt.ts` to include instructions for the tool's use cases.

## 6. Status Assessment
- The AI now has the `read_workspace` native tool, enabling it to efficiently read and summarize the full text of all notes across the active workspace in a single tool call.
- Issue fully resolved.
