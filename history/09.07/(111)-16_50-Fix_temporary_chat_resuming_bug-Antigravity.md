User request: "sometimes, when i click on temporary chat, new temporary chat opens but hwne i send message, it is sent to previus temp chat. make sure that when i open temp chat and last temp chat wasnt cleared/deleted, open it instead of showing new temp chat then opening last active temp chat session."

### 2. Objective Reconstruction
The user reported a state desync bug with Temporary Chats. Clicking "Temporary Chat" when switching from another conversation would visually clear the chat (showing an empty chat), but when a message was sent, it would get appended to the invisible previous temporary chat session. The expected behavior is that clicking "Temporary Chat" should **resume** the existing temporary chat session unless it was explicitly cleared.

### 3. Strategic Reasoning
The bug was caused by `startTempChat` in `store.ts` forcibly setting `tempChatMessages: []` and wiping `chatMessagesMap["temp"]` every time it was called, effectively erasing the local state array but not properly destroying the chat session identifier context (`sid`). When the user sent a message, `sendAIMessage` matched the `sid` of the supposedly cleared temp chat, causing the backend/memory to append the new message to the existing invisible conversation history.
I rewrote `startTempChat` to properly resolve the `sid` for the active context (e.g. global vs note-specific), load any existing messages from `chatMessagesMap[sid]`, and populate the chat view with them rather than blindly clearing them. It now only clears the chat if the user clicks "Temporary Chat" *while already actively inside* that specific temp chat.

### 4. Detailed Blueprint
- Update `startTempChat` in `store.ts` to fetch `existingMessages`, `existingContext`, and `existingInput` from `chatMessagesMap`, `sessionContextsMap`, and `chatInputs` respectively using the correctly resolved `sid`.
- Update the store state object returned by `startTempChat` to preserve the chat arrays instead of resetting them to `[]`.
- Remove the destructive override of `chatMessagesMap[sid]: []` from `startTempChat`.

### 5. Operational Trace
- Replaced the hardcoded reset state with a contextual retrieval of existing temporary session data.
- Restored the missing `set(s => ...)` block properly after a replace chunk error.

### 6. Status Assessment
Temporary chats now correctly resume from where they were left off if the user switches away and back without explicitly clearing them. The desync between the visual UI and the invisible message history array is fully fixed. The fix is live in the development server.
