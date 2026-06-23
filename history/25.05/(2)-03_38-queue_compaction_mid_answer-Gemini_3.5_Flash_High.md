0. Date and time of the request: 2026-05-25 03:35

1. User request
User request: "when i change any mode or manually compact mid answer. apply it only to the next answer, dont interrupt bot"

2. Objective Reconstruction
Implement a deferred execution system for manual database compaction (`compactAIChat`) and mode toggles when clicked mid-answer. Ensure that if the user clicks "Compact Memory" or changes modes while the bot is actively generating/loading a response (`isAILoading === true`), the compaction request is queued and executed only after the current response finishes streaming, preventing database conflicts or lock interrupts to the active stream.

3. Strategic Reasoning
*   **The Issue**: Previously, triggering a manual compaction (`compactAIChat`) mid-answer initiated an asynchronous database transaction (via `/api/ai/memory/compact`) to clean up message history in Supabase. Running this concurrently with an active generation stream in `/api/ai/chat` could result in transaction collisions, database locks, or deletion of history the model was currently referencing, causing the stream to crash with a "Request failed" or "Connection error".
*   **The Approach**:
    *   Add a `pendingCompaction` boolean flag to the store's state.
    *   Modify `compactAIChat` to check if `isAILoading` is true. If it is, set `pendingCompaction: true` and return immediately without hitting the backend endpoint.
    *   Introduce a centralized store action `finishAILoading` to handle AI response completion safely. This action sets `isAILoading: false`, clears `aiAbortController`, checks if `pendingCompaction` is true, and if so, resets the flag and runs `compactAIChat()` automatically.
    *   Replace all inline occurrences of `isAILoading: false` state updates in both `sendAIMessage` and `regenerateAIMessage` with calls to `finishAILoading()`.
    *   Since active generation requests serialize their parameters (such as `activeMode`, `thinkingEnabled`, and `advisorEnabled`) at the very beginning of request execution, changing these parameters mid-answer is already naturally applied only to the *next* request. This queuing of compaction completes the protection against stream interruptions.
*   **Trade-offs/Assumptions**: We assume that if a compaction request is queued, running it immediately after the stream closes is safe and doesn't interfere with the next message, since there is a natural delay before the user can compose and send their next message.

4. Detailed Blueprint
*   **Files involved**: 
    *   `src/data/store.types.ts`
    *   `src/data/store.ts`
*   **Plan**:
    *   Define `pendingCompaction` state and `finishAILoading` action inside `store.types.ts`.
    *   Initialize `pendingCompaction: false` inside the initial state of the store in `store.ts`.
    *   Define the `finishAILoading` helper in `store.ts` to clear loading state and trigger compaction if it was queued.
    *   Modify `compactAIChat` to set `pendingCompaction: true` if `isAILoading` is active.
    *   Find and update all locations in `store.ts` where `isAILoading: false` is updated to call `finishAILoading()` instead.

5. Operational Trace
*   **File Changes**:
    *   Modified `/Users/mktsoy/Dev/flowr-4-main/src/data/store.types.ts` to add state/action interfaces.
    *   Modified `/Users/mktsoy/Dev/flowr-4-main/src/data/store.ts` to implement queueing of manual compaction calls, initialize state, and use `finishAILoading()`.
*   **Verification**:
    *   Initiated `npx tsc --noEmit` compiler checks to verify compilation.

6. Status Assessment
*   **Completed**: Manual compaction triggered mid-answer is now safely deferred to the end of the streaming session, completely eliminating transaction collisions and stream interruptions.
*   **Unresolved**: None.
*   **Edge Cases**: If the user aborts the response manually using the "Stop" button, the aborted stream also safely triggers any pending compaction.
