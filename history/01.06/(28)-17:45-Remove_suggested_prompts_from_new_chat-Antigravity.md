User request: "remove these suggested pills from new chat"

### 0. Date and time of the request
01.06.2026, 17:45

### 1. User request
User request: "remove these suggested pills from new chat"

### 2. Objective Reconstruction
Completely remove the suggested prompt buttons (pills) rendering on the welcome page of a new chat session.

### 3. Strategic Reasoning
The suggested prompt pills were defined via the `SUGGESTED_PROMPTS` array constant and mapped to interactive button elements in the `ChatConversation.tsx` component. Removing both the mapped HTML block and the constant declutter/clean the file and prevents lint/type-checking warnings on unused variables.

### 4. Detailed Blueprint
- Modify [ChatConversation.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/chat/ChatConversation.tsx) to remove `SUGGESTED_PROMPTS` array (lines 10-15) and the suggestions map wrapper block (lines 79-90).

### 5. Operational Trace
- Deleted the `SUGGESTED_PROMPTS` array.
- Removed the JSX block mapping `SUGGESTED_PROMPTS` to buttons inside the welcome/empty chat container.

### 6. Status Assessment
- Completed successfully. The welcome screen now displays only the central brand icon and welcome message text.
