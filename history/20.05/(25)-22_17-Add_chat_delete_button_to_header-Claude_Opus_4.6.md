User request: "add delete button to the chatpage in the top right in the header"

### 0. Date and time of the request
- Date: 20.05
- Time: 22:17

### 1. User request
User request: "add delete button to the chatpage in the top right in the header"

### 2. Objective Reconstruction
The user wants a quick way to delete the current chat directly from the top-right header of the chat page, rather than having to use the sidebar's chat history panel.

### 3. Strategic Reasoning
The main app header (`HeaderBar.tsx`) handles right-aligned actions for the current view. When viewing a chat, the typical entity actions (like Favorite, Duplicate, Layout) are hidden. I can reuse the existing `DeleteConfirmModal` by extending its type interface in the global store to accept an `isChat: boolean` flag, and then passing the `chatConversations` context so it can safely delete a chat and reset the view to a new temporary chat.

### 4. Detailed Blueprint
- Update the modal typings in `store.types.ts` to include `isChat?: boolean` for the `deleteConfirm` kind.
- Update `DeleteConfirmModal.tsx` to safely pull the chat entity, and call `deleteChatConversation` when confirmed. Add logic to call `startTempChat()` if the currently active chat is deleted to prevent a broken UI state.
- Add the `Trash2` action button conditionally to `HeaderBar.tsx` exclusively for saved chats (`activeEntityId === 'chat' && !isTempChat`).

### 5. Operational Trace
- Edited `/Users/mktsoy/Dev/flowr-4-main/src/data/store.types.ts` to add `isChat` boolean to `ModalType` `deleteConfirm`.
- Edited `/Users/mktsoy/Dev/flowr-4-main/src/components/modals/DeleteConfirmModal.tsx` to handle `isChat` modal state and trigger deletion.
- Edited `/Users/mktsoy/Dev/flowr-4-main/src/components/layout/HeaderBar.tsx` to render the Trash icon for active saved chats in the top right.

### 6. Status Assessment
The delete button was successfully added to the chat header and opens a confirmation modal before permanently deleting the chat.
