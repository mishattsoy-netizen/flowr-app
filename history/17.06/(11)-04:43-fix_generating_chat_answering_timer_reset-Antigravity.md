Date: June 17, 2026
Time: 04:43

User request: "when i come back to chat that is still generating answer, next to the status message, answering time resets evety time i leave chat"

### Objective Reconstruction
Prevent the active generation duration timer from resetting to zero and restarting when a user leaves and returns to a chat session that is actively streaming/loading in the background.

### Strategic Reasoning
- The `ChatMessage` component previously tracked duration using a local component state (`elapsed`) and `timerStartRef.current = Date.now()`. When switching chats, the component unmounts and remounts. If the chat is still loading, it restarts the timer from `Date.now()` (the return time), resetting the displayed seconds.
- By setting the timer's start reference to the message's persistent `msg.timestamp` (which was recorded when the prompt request was initiated), the timer calculates the correct overall duration since inception when mounting.

### Detailed Blueprint
- **[MODIFY] [ChatMessage.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/assistant/components/ChatMessage.tsx)**: Initialize `timerStartRef.current` using `msg.timestamp` instead of `Date.now()`, and append `msg.timestamp` to the effect's dependency array.

### Operational Trace
1. Located the duration timer effect in `ChatMessage.tsx` around line 936.
2. Modified the start time assignment to check `msg.timestamp` first: `timerStartRef.current = msg.timestamp || Date.now();`.
3. Added `msg.timestamp` to the dependency list of `useEffect`.

### Status Assessment
Completed. Answering duration calculation is now stable and retains history across chat navigations.
