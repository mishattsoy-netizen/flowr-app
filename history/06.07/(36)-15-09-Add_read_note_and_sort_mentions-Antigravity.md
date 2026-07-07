User request: "can we cahnge sorting in mention popup, most recentrly opened in the top, and descending"
User request: "bot still dont work properly"

## 2. Objective Reconstruction
1. Change the sorting of the mention popup list so that the most recently opened entities appear at the top in descending order.
2. Fix the AI failing to summarize or answer questions about the workspace content because it lacked the ability to read note content after the recent tool migration.
3. Ensure custom icons are rendered for notes, folders, and canvas in the mention popup and message bubbles.

## 3. Strategic Reasoning
- The recent migration to native AI tools removed the frontend-intercepted XML tool `<read_workspace_content />` and `<read_all_content />`. As a result, the AI only had `list_notes` and `search_notes` available, neither of which return the note content. So when asked to summarize, the AI had no way to read the notes, got stuck, hit the 4-hop tool limit, and the system produced an empty response message. To fix this, I added a new `read_note` native tool to the backend, enabling the AI to fetch specific note contents dynamically.
- For the mention popup sorting, I utilized `recentEntityIds` from the frontend store and updated the sorting logic in `AIAssistant.tsx` to prioritize recently opened entities.
- For the custom icons, I updated `getEntityIconReact` in `ChatMessage.tsx` and `getEntityIcon` in `ChatInputEditable.tsx` to apply the `iconName` mapping to all entity types, not just workspaces.

## 4. Detailed Blueprint
- `src/lib/bot/tools/definitions.ts`: Add `read_note` tool definition.
- `src/lib/bot/tools/handlers.ts`: Implement the `read_note` handler querying the Supabase database.
- `src/lib/bot/tools/prompt.ts`: Update `TOOL_INSTRUCTIONS` to explicitly tell the AI to use `read_note` when it needs to read content.
- `src/components/assistant/AIAssistant.tsx`: Add `recentEntityIds` hook and update sorting logic to sort by recent IDs first, then by `lastModified`.
- `src/components/assistant/components/ChatMessage.tsx`: Modify `getEntityIconReact` to process `iconName` for all types.
- `src/components/assistant/components/ChatInputEditable.tsx`: Modify `getEntityIcon` to process `iconName` for all types.

## 5. Operational Trace
- Searched codebase for `read_all_content` and `read_workspace_content` to trace the missing tool logic.
- Analyzed `definitions.ts`, `handlers.ts`, and `prompt.ts` to confirm no native note reading tool existed.
- Added `read_note` tool to definitions and handlers.
- Updated `prompt.ts` system prompt.
- Refactored sorting in `AIAssistant.tsx` to utilize `useStore(state => state.recentEntityIds)`.
- Updated icon fetching logic in `ChatMessage.tsx` and `ChatInputEditable.tsx`.

## 6. Status Assessment
- The AI now correctly has the `read_note` tool and can read note contents.
- The mention popup is successfully sorted by recently opened entities in descending order.
- Custom icons for notes, folders, and canvases now render correctly inside the AI chat interface.
- Issue fully resolved.
