User request: "add loading animation when thinking and add stop button instead of send when thinking"

### Objective Reconstruction
The user wants to improve the user experience during AI generation in the Planning Assistant by replacing the static/bouncing empty message bubble with a clear loading animation, and providing a "Stop" button to abort the generation request if it's taking too long.

### Strategic Reasoning
1. **Stop Button Implementation:**
   - To abort a fetch request cleanly in standard React, an `AbortController` is needed.
   - When the user sends a message, an `AbortController` is created, saved in state, and its `signal` is passed to the fetch call.
   - During `isLoading`, the normal `Send` button is swapped for a red `Square` icon button that, when clicked, calls `.abort()` on the controller.
   - The fetch catch block was updated to gracefully ignore `AbortError` so it doesn't show a "Network Error" message when the user manually stops it.
2. **Loading Animation Improvement:**
   - The previous loading animation used three nested div dots with `animate-bounce` and inline `animationDelay`. This can occasionally break depending on Tailwind compilation and resulted in an empty dark bubble.
   - Replaced it with a robust combination of `animate-pulse` on the container, a spinning `Loader2` lucide icon, and the explicit text "Thinking..." to clearly communicate the system state.

### Detailed Blueprint
- `src/components/admin/roadmap/PlanningAssistant.tsx`:
  - Import `Square` and `Loader2` icons.
  - Add `abortController` to local state.
  - Wrap the `fetch` call with an `AbortController` signal.
  - Add `handleStop` function to abort the request.
  - Swap the input button conditionally based on `isLoading`.
  - Refactor the `isLoading` chat bubble to use the `Loader2` animation.

### Operational Trace
- Successfully replaced the send button with a stop button during active generation.
- The `AbortController` is fully wired to cancel pending `/api/admin/roadmap/chat` requests.
- The loading state is now visually clearer.

### Status Assessment
The user experience during AI thinking time is significantly enhanced. The UI provides direct feedback and empowers the user to interrupt the process if needed.
