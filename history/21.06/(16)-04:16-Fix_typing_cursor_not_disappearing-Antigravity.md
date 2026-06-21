User request: "in the chat the typing box is not dissapearing after done generating, fix it"

## Date and Time
2026-06-21 04:16

## User Request
"in the chat the typing box is not dissapearing after done generating, fix it"

## Objective Reconstruction
The user reported that the typing cursor/block (█) or typing indicator does not disappear in the chat panel after the assistant finishes generating a response. We need to ensure that when the assistant finishes generating, the typing cursor and indicator are immediately hidden.

## Strategic Reasoning
We traced the active streaming state (`isAILoading`) in the global store. In `finishAILoading`, the store had a bug where it only set `isAILoading` to `false` if `activeChatId` matches the session ID. However, when the active session is a note, canvas, or global workspace chat (meaning `activeChatId` is null), `isAILoading` was kept as `true`. This caused the loading states in components to remain `true` even after generation finished, preventing the cursor/typing indicators from disappearing. By simplifying and correcting the check to see if the finished session is the currently active one (`!chatId || chatId === currentActiveId`), we correctly transition `isAILoading` to `false` for all session types.

## Detailed Blueprint
- **Modified File**: [store.ts](file:///Users/mktsoy/Dev/flowr-app/src/data/store.ts)
  - Updated `finishAILoading` to correctly check if the completed session matches the currently active session (evaluating notes, canvas, global chat, and temporary chats).
  - Set `isAILoading` to `false` and `aiAbortController` to `null` if the finished session is the active one.

## Operational Trace
1. Identified the logic of `finishAILoading` in [store.ts](file:///Users/mktsoy/Dev/flowr-app/src/data/store.ts).
2. Found that when `activeChatId` is `null` but `activeEntityId` or global chat is active, `isAILoading` was never reset to `false`.
3. Replaced the logic with a robust, generalized check comparing the completed `chatId` to the current active session ID (`currentActiveId`).
4. Replaced the target code block in `store.ts` using the file replace tool.

## Status Assessment
Successfully fixed. The typing indicator loading states will now clear correctly when generation completes in any chat layout, ensuring the typing block/cursor is fully hidden.
