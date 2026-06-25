User request: "you are saying disappearing images/attachments, but it happens to text messages aswell"

### 0. Date and Time of the Request
- **Date**: 2026-06-24
- **Time**: 22:53

### 1. User Request
"you are saying disappearing images/attachments, but it happens to text messages aswell"

### 2. Objective Reconstruction
Prevent existing chat conversations (and all their text messages) from disappearing/deleting from the database during page navigation or view switches, by fixing the race condition where `cleanupActiveChatIfEmpty` was optimistically deleting chats whose messages were not yet loaded in the local state.

### 3. Strategic Reasoning
- The `cleanupActiveChatIfEmpty` function was originally designed to delete empty chats when switching away from them.
- However, when navigating views (e.g. from chat to note) or loading the application, if the database message fetch (`fetchMessages`) hasn't finished, the local store state for the chat (`chatMessagesMap[activeChatId]` and `aiMessages`) is empty.
- When `cleanupActiveChatIfEmpty` was called, it saw zero messages in the state and deleted the entire chat conversation from the database, causing regular text messages to disappear.
- To fix this safely, we introduced `newEmptyChatId` to track only the chats that are created as brand new empty chats inside `startNewChat`.
- We only run the deletion cleanup if `activeChatId === newEmptyChatId`. This guarantees that existing, populated conversations are never deleted from the database even if the local message array is temporarily empty or loading.
- We reset `newEmptyChatId` to `null` as soon as the user starts typing/sending a message, or starts a temp chat, or regenerates a message.

### 4. Detailed Blueprint
- **Files Modified**:
  - `src/data/store.ts` to implement `newEmptyChatId` tracking, update actions (`startNewChat`, `startTempChat`, `sendAIMessage`, `regenerateAIMessage`), and safeguard `cleanupActiveChatIfEmpty` with the new empty chat check.

### 5. Operational Trace
- Modified `src/data/store.ts`:
  - Initialized `newEmptyChatId: null` in the store state.
  - Set `newEmptyChatId: conv.id` in `startNewChat` when a blank session is created.
  - Reset `newEmptyChatId: null` in `startTempChat`.
  - Reset `newEmptyChatId: null` in the returned state inside `sendAIMessage` when the first user message is sent.
  - Reset `newEmptyChatId: null` in `regenerateAIMessage` state update.
  - Updated `cleanupActiveChatIfEmpty` to check `activeChatId === newEmptyChatId` before executing `deleteConversationFromDB(activeChatId)`.
- Verified changes with `npx tsc --noEmit` and confirmed clean compilation.

### 6. Status Assessment
- **Status**: Completed.
- **Outcome**: Existing chat conversations and text messages are completely safe from accidental deletion when switching pages, reloading, or navigating. Only newly created empty chats are cleaned up when switched away from.
