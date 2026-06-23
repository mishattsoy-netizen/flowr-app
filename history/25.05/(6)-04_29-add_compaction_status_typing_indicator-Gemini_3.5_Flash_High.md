User request: "also i should see copactiong as status message"

### 0. Date and time of the request
Completed on: 25.05.2026 at 04:30

### 1. User request
"also i should see copactiong as status message"

### 2. Objective Reconstruction
Render a beautiful status typing indicator inside the active chat history panel whenever manual memory compaction is running.
- Retrieve the custom compaction status label (e.g., `Compressing...` with rocket emoji) configured inside the database pipeline settings (`aiSessionContext.status_messages.COMPACTION`).
- Render a fully animated AIAvatar typing indicator bubble displaying this message at the bottom of both sidebar chat (`AIAssistant.tsx`) and full-page chat views (`ChatConversation.tsx`).

### 3. Strategic Reasoning
- **Visual Responsiveness**: When manual compaction is triggered, the API fetch takes 1-3 seconds. Showing no visual typing indicator at the bottom of the message loop makes the app feel unresponsive. Introducing an animated, inline status loader that mimics the AI's natural thinking/typing status matches the UI perfectly.
- **Custom Configuration Binding**: We resolved the status message content dynamically from the user's database configuration (`aiSessionContext?.status_messages?.COMPACTION`), with a robust fallback to `"🚀 Compressing..."`. This preserves 100% theme and customization coherence.

### 4. Detailed Blueprint
- `src/data/store.types.ts`: Add `isCompacting: boolean` to `AppState`.
- `src/data/store.ts`: Initialize `isCompacting: false`, and wrap the `compactAIChat` API execution with `set({ isCompacting: true })` and `set({ isCompacting: false })` in the `finally` block.
- `src/components/assistant/AIAssistant.tsx`: Import `StatusTyping`, read `isCompacting` from the store, and render the loading indicator row above the scroll anchor. Remove local component setters.
- `src/components/chat/ChatConversation.tsx`: Import `StatusTyping`, read `isCompacting` from the store, and render the loading indicator row at the bottom of the main central panel message thread.

### 5. Operational Trace
- **Modified `store.types.ts` & `store.ts`**: Declared and managed the `isCompacting` state transitions.
- **Modified `AIAssistant.tsx`**: Cleaned up the redundant local state/setters and integrated `StatusTyping` and `AIAvatar` loader components. Resolved a React + TypeScript `useRef` generic typing compiler error by initializing it with `undefined`.
- **Modified `ChatConversation.tsx`**: Imported and mounted the matching compaction typing block.
- **Verified Success**: Run `npx tsc --noEmit` and confirmed that all files are error-free and fully type safe.

### 6. Status Assessment
- **Status**: 100% completed, fully visual, and type-safe.
- **Unresolved Items**: None.
