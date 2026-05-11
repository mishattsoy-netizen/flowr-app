User request: "no wrong, no hardcoded status message, status messase must be used from this section where i set custom messages for each chain, if theer is no custom messae show Working"

### Objective Reconstruction
Remove all hardcoded status messages from the AI assistant (specifically "thinking" and "classifier") and implement a dynamic status label system. This system must pull custom labels and emojis from the administrative settings. If no custom message is defined for a specific phase, the UI must fallback to displaying "Working".

### Strategic Reasoning
To achieve zero hardcoding and dynamic updates without breaking the synchronous chat API, I extended the `SessionState` (server-side) and `AISessionContext` (client-side store) to include the `status_messages` map. By fetching these settings during the initial session context load, the frontend gains access to user-configured labels before any processing begins. The `chainRouter` and backend pipeline executors were also refactored to prioritize these settings, ensuring that both the initial loading phase and subsequent pipeline steps use identical, configuration-driven logic.

### Detailed Blueprint
- **Core State**: Add `status_messages` to `SessionState` interface in `src/lib/bot/context.ts` and `AISessionContext` in `src/data/store.types.ts`.
- **Server API**: Update `getSessionState` in `src/lib/bot/context.ts` to fetch and include `pipeline_status_messages` from Supabase settings.
- **Frontend UI**: Refactor `ChatMessage.tsx` to read from the store and resolve the correct emoji + label string, with a global "Working" fallback.
- **Backend Orchestration**: 
    - Refactor `getStatusLabel` in `src/lib/bot/chainRouter.ts` to remove hardcoded strings and support a "Working" default.
    - Update `src/lib/bot/pipeline.ts` and `src/lib/bot/thinkChain.ts` to use "Working" as the fallback label for pipeline steps.

### Operational Trace
1.  **Modified `src/lib/bot/context.ts`**: Updated `getSessionState` to fetch `getPipelineSettings` and include `status_messages` in the return payload.
2.  **Modified `src/data/store.types.ts`**: Synchronized the frontend `AISessionContext` interface to include the new field.
3.  **Modified `src/components/assistant/components/ChatMessage.tsx`**:
    - Added `aiSessionContext` hook.
    - Replaced hardcoded `thinkingEnabled ? "thinking" : "classifier"` with dynamic lookup in `aiSessionContext.status_messages`.
    - Implemented "Working" as the final fallback.
4.  **Modified `src/lib/bot/chainRouter.ts`**:
    - Refactored `getStatusLabel` helper to handle optional fallbacks.
    - Removed hardcoded strings from all routing phase status calls.
5.  **Modified `src/lib/bot/pipeline.ts` & `src/lib/bot/thinkChain.ts`**: Changed step initialization to use "Working" instead of `undefined` for labels when custom settings are missing.

### Status Assessment
- **Completed**: Zero hardcoded status messages in the routing and display flow.
- **Completed**: Full integration with "Pipeline Status Messages" settings.
- **Completed**: Global "Working" fallback implemented.
- **Resolved**: "classifier" string removed from UI.

**Next Recommendation**: The user should verify that "🚀 Analyzing" (or their chosen label) appears during the classification phase by checking the Assistant chat window.
