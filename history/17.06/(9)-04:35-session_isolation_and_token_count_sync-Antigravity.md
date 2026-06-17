Date: June 17, 2026
Time: 04:35

User request: "1"

### Objective Reconstruction
Implement the approved design plan to solve the three core UI and backend session state problems:
1. **Session/Chat Isolation:** Prevent cross-chat input leakage and streaming leakage by managing inputs, loaders, and abort controllers on a per-chat basis in Zustand.
2. **Stable Token Counting:** Count tokens dynamically based on active history size, distilled summaries, and count images/PDFs dynamically as 258 tokens per attachment rather than accumulating and bloating counts.
3. **Cloud Sync & Session Restore:** Sync states to the backend DB and load session details instantly upon switching chats in the frontend to prevent token bar flickering.

### Strategic Reasoning
- **Map-based State:** By introducing record maps keyed by chat/session ID, we decoupled Zustand's active UI properties from the global store, allowing independent chat states.
- **Signal Tracking:** Mapping AbortControllers per chat prevents stopping or polluting active streams in other chats when switching views.
- **Dynamic Slicing:** Counting tokens dynamically from the active list of messages (or summary + tail of 5 messages) mirrors the exact payload sent to the LLM.
- **Pre-loading Session State:** Setting the UI context state to the locally cached context map immediately when switching sessions completely prevents the visual count flickering.

### Detailed Blueprint
- **[MODIFY] [store.types.ts](file:///Users/mktsoy/Dev/flowr-app/src/data/store.types.ts)**: Added `chatInputs`, `loadingStatesMap`, `abortControllersMap`, `chatMessagesMap`, and `sessionContextsMap` to the store types. Added `chatId` parameter to `finishAILoading`.
- **[MODIFY] [store.ts](file:///Users/mktsoy/Dev/flowr-app/src/data/store.ts)**: Initialized maps and added them to `partialize` configuration. Updated `setAssistantInput`, `loadConversation`, `startTempChat`, `startNewChat`, `finishAILoading`, `stopAIGeneration`, and `sendAIMessage` to save/restore states per-chat.
- **[MODIFY] [AIAssistant.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/assistant/AIAssistant.tsx)**: Simplified `displayedTokens` to compute size dynamically (with 258 tokens per attachment) and update on mount/load immediately to prevent flicker.
- **[MODIFY] [chainRouter.ts](file:///Users/mktsoy/Dev/flowr-app/src/lib/bot/chainRouter.ts)**: Replaced cumulative token updates with active history slice token estimation.

### Operational Trace
1. Updated `AppState` in `store.types.ts` with map variables.
2. Initialized state maps in `store.ts` store builder and `partialize` persist config.
3. Rewrote input and session getters/seters in `setAssistantInput`, `startTempChat`, `startNewChat`, and `loadConversation`.
4. Refactored `sendAIMessage` to capture `targetChatId` and scoped all messages, stream reader updates, abort signals, and DB persistence actions to `targetChatId`.
5. Redesigned client-side token count calculation in `AIAssistant.tsx` to dynamically sum summary and history message characters/images.
6. Redesigned server-side token count calculator in `chainRouter.ts` to estimate tokens using the active history slice and images.
7. Updated `AIAssistant.tsx` to restore context from `sessionContextsMap` on change.

### Status Assessment
All tasks successfully implemented and verified. Next.js dev server successfully rebuilds changes.
