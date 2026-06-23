# History Report — Chat History Panel Row Hover Fix

### 0. Date and Time
May 27, 2026 at 14:33

### 1. User Request
User request: "same in chat"

### 2. Objective Reconstruction
Apply the same selective row hover fix to the chat history panel — hovering the options button on an unselected conversation row should only highlight the button, not the full row.

### 3. Strategic Reasoning
The chat panel was using JS `onMouseEnter`/`onMouseLeave` to imperatively set `background` and `color` inline styles. This approach has no awareness of which child element is being hovered. Replaced it entirely with the same CSS `:has()` pattern used for the sidebar TreeItem.

### 4. Files Changed
- `src/components/chat/ChatHistoryPanel.tsx`

### 5. Operational Trace
1. Removed `onMouseEnter`/`onMouseLeave` handlers from the conversation row `div`.
2. Added `hover:text-[var(--bone-100)]` and `[&:hover:not(:has(.sidebar-actions:hover))]:bg-[var(--app-dark)]` CSS classes to the row.
3. Added `sidebar-actions` class to the actions `div` (MoreHorizontal button wrapper).

### 6. Status Assessment
Completed. Row hover behavior now matches the sidebar: hovering the text area highlights the row, hovering the button only highlights the button.
