### 0. Date and time of the request
Date: 2026-06-21
Time: 04:25

### 1. User request
User request: "fix"

### 2. Objective Reconstruction
Isolate temporary chat session histories completely. Ensure that when starting a "Temp Chat", sending a new message does not load or merge with previous temporary chat or general chat session histories, keeping the temporary session isolated and clear of previous temporary histories.

### 3. Strategic Reasoning
- The root cause of the issue was that the `activeEntityId` property was set to the current system route name `'chat'` when navigating to the Chat page.
- As a result, the fallback expression `activeChatId || activeEntityId || (isTemp ? 'temp' : 'global')` evaluated to `'chat'` (since `'chat'` is truthy) instead of resolving to `'temp'` or `'global'`. This caused temporary messages to be incorrectly mapped under the `'chat'` key in `chatMessagesMap`.
- To fix this cleanly, we introduced a helper function `getChatSessionId` that checks if `activeEntityId` is a system route (like `'chat'`, `'dashboard'`, `'tracker'`, or `'settings'`). If it is, the helper bypasses it and falls back to `'temp'` or `'global'`. Otherwise, it maps the session to the actual note or canvas editor entity ID.
- This maintains clean context mapping for valid active entities (like notes and canvases) while fully isolating general pages.

### 4. Detailed Blueprint
- Modify [src/data/store.ts](file:///Users/mktsoy/Dev/flowr-app/src/data/store.ts):
  - Add `SYSTEM_ROUTES` constant array containing system route names (`'chat'`, `'dashboard'`, `'tracker'`, `'settings'`).
  - Introduce `getChatSessionId` helper function.
  - Locate all occurrences of the fallback patterns:
    - `activeChatId || activeEntityId || (isTempChat ? 'temp' : 'global')`
    - `activeChatId || activeEntityId || 'global'`
    - `chatId || activeChatId || activeEntityId || (isTempChat ? 'temp' : 'global')`
    - `activeChatId || activeEntityId || (isTemp ? 'temp' : 'global')`
    - `s.activeChatId || s.activeEntityId || (s.isTempChat ? 'temp' : 'global')`
  - Replace them with calls to `getChatSessionId`.

### 5. Operational Trace
- Defined `SYSTEM_ROUTES` and `getChatSessionId` in [src/data/store.ts](file:///Users/mktsoy/Dev/flowr-app/src/data/store.ts).
- Replaced all 14 session scoping fallbacks in [src/data/store.ts](file:///Users/mktsoy/Dev/flowr-app/src/data/store.ts) with `getChatSessionId` wrapper calls.
- Executed the vitest suite via `./node_modules/.bin/vitest run --exclude "**/.claude/**"` which completed successfully with 117 tests passing.

### 6. Status Assessment
- **Completed**: Fully resolved the temp chat isolation bug.
- **Fixed**: Scoping of chat sessions is now immune to system routing page names.
- **Remaining**: None.
