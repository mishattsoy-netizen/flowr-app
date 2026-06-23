User request: "good now lets fix chats. when i click new chat, and New Chat apears in sidebar, then if i leave this new chat/switch to other chat->remove new empty chat. New  EMPTY chats cant stay in history in sidebar. Also when i have temp chat opened with messages, and i click temp chat in sideabr or type /clear->empty temp chat! Make sure that when i send message in new temp chat->dont load history from previous chat. and make sure that if chat is temporary, its not saved at all"

### 0. Date and Time of the Request
21.06.2026 22:50 (Completion: 23:02)

### 1. User Request
User request: "good now lets fix chats. when i click new chat, and New Chat apears in sidebar, then if i leave this new chat/switch to other chat->remove new empty chat. New  EMPTY chats cant stay in history in sidebar. Also when i have temp chat opened with messages, and i click temp chat in sideabr or type /clear->empty temp chat! Make sure that when i send message in new temp chat->dont load history from previous chat. and make sure that if chat is temporary, its not saved at all"

### 2. Objective Reconstruction
Implement four primary chat lifecycle behaviors:
1. **Empty Chat Cleanup**: When leaving an empty named chat (e.g., "+ New Chat" with 0 user/assistant messages) by switching chats, switching pages, or closing the chat tab, delete it from the database and local lists.
2. **Temp Chat Reset**: When already inside a temporary chat and clicking "Temp Chat" in the sidebar, or typing `/clear` in the input, completely reset and wipe the temporary chat messages.
3. **History Isolation**: Ensure starting a new temporary chat clears all local session contexts and messages so history from previous chats is not carried over or loaded.
4. **Bypass Database Writes**: Avoid writing session state (`bot_session_states` table) and analytics logs (`web_interactions` and `message_logs` tables) for temporary chats (IDs starting with `temp`).

### 3. Strategic Reasoning
- **UI Event Hooks**: Empty chat cleanup must hook into all switching actions (`startNewChat`, `startTempChat`, `loadConversation`), view switches (`setActiveEntityId`), and tab closures (`removeTab`). Running these asynchronously or awaiting them prevents UI freezing while ensuring cleanups are completed.
- **Server Privacy**: Checking `isTempChat` in the API route is the cleanest way to bypass analytics logging. Checking for a `temp` prefix inside `getSessionState`, `updateSessionState`, `clearSessionState`, and `summarizeSession` guarantees that database operations are never executed for temporary sessions.
- **Wiping Local Context**: Resetting `chatMessagesMap['temp']` and `sessionContextsMap['temp']` guarantees that subsequent messages do not load stale context, maintaining complete isolation.

### 4. Detailed Blueprint
- `src/data/store.types.ts`: Add signature for `cleanupActiveChatIfEmpty` and make `startTempChat` async.
- `src/data/store.ts`:
  - Implement `cleanupActiveChatIfEmpty`.
  - Update `loadConversation`, `startNewChat`, `startTempChat`, `clearAIChat`, `removeTab`, and `setActiveEntityId` to execute cleanup.
- `src/components/assistant/AIAssistant.tsx`: Intercept the `/clear` command in `handleSend`.
- `src/app/api/ai/chat/route.ts`: Avoid database logs when `isTempChat` is true.
- `src/lib/bot/context.ts`: Add `chatId.startsWith('temp')` guards to prevent DB queries and mutations.

### 5. Operational Trace
- **Type Signatures**: Modified `store.types.ts` to add `cleanupActiveChatIfEmpty` and change `startTempChat` to return a `Promise<void>`.
- **Empty Chat Cleanup**: Implemented `cleanupActiveChatIfEmpty` to query `chatMessagesMap[activeChatId]` or `aiMessages`, check for any user/assistant messages, and call `deleteConversationFromDB` if empty.
- **Tab/Page Switching**: Wired the cleanup into `setActiveEntityId` (when leaving `'chat'`), `removeTab` (when closing a chat tab and moving to another page), and all conversation load/creation methods.
- **Temp Chat Clearing**: Updated `startTempChat` to reset temporary store entries, clear the server-side memory for `'temp'`, and clear the active view if already on the temp chat.
- **Command Interception**: Intercepted `/clear` in `handleSend` to clear state and call `clearAIChat()`.
- **Database Bypasses**:
  - In `route.ts`, wrapped `logWebInteraction` and `logModelWebMessage` with `if (!isTempChat)`.
  - In `context.ts`, returned default structures in `getSessionState` and bypassed Supabase writes in `updateSessionState`, `clearSessionState`, and `summarizeSession` for any temporary `chatId`.
- **Verification**: Ran `tsc --noEmit` and `vitest run` which all compiled and passed cleanly.

### 6. Status Assessment
- **Completed**:
  - Switch/Leave cleanup for empty chats.
  - Temp chat resets via sidebar click or `/clear` command.
  - Context isolation for new temp chats.
  - Supabase/analytics write guards for temporary sessions.
- **Remaining**:
  - None. All requirements requested by the user are fully operational.
