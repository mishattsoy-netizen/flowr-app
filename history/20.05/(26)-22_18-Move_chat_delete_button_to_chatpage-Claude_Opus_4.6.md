User request: "i mean in the header where the title of tha chat is"

### 0. Date and time of the request
- Date: 20.05
- Time: 22:18

### 1. User request
User request: "i mean in the header where the title of tha chat is"

### 2. Objective Reconstruction
The user clarified that the delete button for the chat page should be placed directly in the `ChatPage.tsx` component's internal header (where the chat title floats over the scroll area), rather than the global app `HeaderBar.tsx`.

### 3. Strategic Reasoning
Since `ChatPage.tsx` handles its own floating header (`<h2 className="text-sm font-medium truncate...>{title}</h2>`), I can safely inject the delete button here and use flexbox `justify-between` on the container to align it to the far right. Then, I can remove the previously added duplicate logic from the global `HeaderBar.tsx`.

### 4. Detailed Blueprint
- Update `ChatPage.tsx` to import the `Trash2` icon.
- In `ChatPage.tsx`, update the top fade header `div` to use `justify-between` and wrap the title in a container to keep it aligned to the left.
- Render the `Trash2` delete button on the right side of this header when `!isTempChat && activeChatId` is true, triggering the same `DeleteConfirmModal` logic.
- Remove the chat-specific logic block from `HeaderBar.tsx`.

### 5. Operational Trace
- Edited `/Users/mktsoy/Dev/flowr-4-main/src/components/chat/ChatPage.tsx` to add the `Trash2` button to the internal header.
- Edited `/Users/mktsoy/Dev/flowr-4-main/src/components/layout/HeaderBar.tsx` to remove the previously added `Trash2` button.

### 6. Status Assessment
The chat delete button has been moved to its proper location on the chat page's internal floating header and removed from the global app header.
