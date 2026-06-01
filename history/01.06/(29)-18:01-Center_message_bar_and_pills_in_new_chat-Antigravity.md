User request: "new chat should look like this, message bar and welcome title in the middle and 5 quick access/suggestion pills: 1. Generate Image 2. Web Search 3. Deep Research 4. Code 5. Add Task"

### 0. Date and time of the request
01.06.2026, 18:01

### 1. User request
User request: "new chat should look like this, message bar and welcome title in the middle and 5 quick access/suggestion pills: 1. Generate Image 2. Web Search 3. Deep Research 4. Code 5. Add Task"

### 2. Objective Reconstruction
Re-design the welcome dashboard for a new/empty chat conversation to focus all primary visual elements in the screen center:
1. Centered welcome greeting (dynamically matching the time of day and user profile name) aligned with the decorative brand star icon.
2. Centered high-fidelity message input bar (`<AIAssistant />` embedded inline).
3. 5 interactive prompt suggestion pills directly below the input bar for direct action triggers (Generate Image, Web Search, Deep Research, Code, Add Task).
4. Hide the bottom floating message bar and backdrop gradients until a message is active.

### 3. Strategic Reasoning
An empty chat viewport with bottom input placement leaves the screen center underutilized. Centering the greeting, chat box, and suggestion pills establishes a sleek, premium, user-centric landing page matching modern chat interfaces. The bottom floating input bar only displays when a conversation has active messages, ensuring a seamless visual transition as soon as a prompt is submitted.

### 4. Detailed Blueprint
- **[ChatConversation.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/chat/ChatConversation.tsx)**:
  - Import `useAuth`, `AIAssistant`, and Lucide icons (`Image`, `Globe`, `Telescope`, `Terminal`, `CheckSquare`).
  - Declare the `QUICK_ACCESS_PILLS` dataset featuring matching ids, label strings, prefixes, and icons.
  - Implement `getGreeting()` using local hour constraints and display name retrieval.
  - Implement `handlePillClick(pill)` to load slash commands, inject active intent tags, and focus the message input field.
  - Update the empty-viewport JSX to render the centered title, `<AIAssistant chatPageMode />`, and pills wrapper.
- **[ChatPage.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/chat/ChatPage.tsx)**:
  - Check `displayMessages.length === 0` to decide if the bottom bar should be hidden.
  - Wrap bottom floating bar and fade shadows inside the conditional `showBottomBar` flag.

### 5. Operational Trace
- Added required icons and components to `ChatConversation.tsx`.
- Rewrote `ChatConversation.tsx` empty-messages view to map the centered title, main input box, and suggetion pills.
- Added conditional `showBottomBar` rendering inside `ChatPage.tsx`.

### 6. Status Assessment
- Completed successfully. The welcome landing page layout matches the user's reference perfectly.
