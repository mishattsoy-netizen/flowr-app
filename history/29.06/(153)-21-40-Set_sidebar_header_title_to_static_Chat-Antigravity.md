User request: "dont change header title Either Chat or Temporary Chat"

### 0. Date and time of the request
Date: 29.06.2026
Time: 21:40

### 1. User request
User request: "dont change header title Either Chat or Temporary Chat"

### 2. Objective Reconstruction
Modify the AI Assistant sidebar header title behavior. Instead of dynamically displaying the active conversation's title (which would change the header title to the user's message/conversation title once a chat is started), force the title to statically display "Chat" (for regular chats) or "Temporary Chat" (for temporary chats).

### 3. Strategic Reasoning
In `AIAssistant.tsx`, the title element was reading the current conversation's title using `chatConversations.find(c => c.id === activeChatId)?.title || 'New Chat'`. Replacing this expression with a static `'Chat'` string ensures the header title remains consistent and never dynamically changes when a conversation starts or is selected.

### 4. Detailed Blueprint
- **Modify**: [AIAssistant.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/assistant/AIAssistant.tsx)
  - Change the header title rendering logic from the dynamic title search expression to the static string `'Chat'`.

### 5. Operational Trace
- Replaced the dynamic conversation title lookup expression at line 694 with the static string `'Chat'`.

### 6. Status Assessment
- Completed: Header title is now statically set to either "Chat" or "Temporary Chat".
