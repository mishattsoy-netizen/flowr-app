User request: "a"

### 0. Date and time of the request
Date: 17.06.2026
Time: 01:21

### 1. User request
"a" (representing Option A: Sequential execution of the AI Agent Evolution plan in this session)

### 2. Objective Reconstruction
Execute the complete, multi-phase AI Agent Evolution plan sequentially in the active codebase:
1. Build and integrate a robust Output Guard to prevent thinking metadata leakages.
2. Decouple tool calling from the classifier, making tools dynamically available within standard text chains.
3. Collapse intent classification categories from 10+ down to 4 (COMPLEX, WEB_SEARCH, IMAGE_GEN, AUDIO) and write migration scripts for database configuration.
4. Implement tool executing loop support in the OpenRouter provider.

### 3. Strategic Reasoning
- **Universal Sanitization:** Strip all brackets and tags (such as `[SEARCH DATA]`, `<thought>`, etc.) using regex substitution during the final routing returns to clean up user output without disrupting backend logs or transcripts.
- **Dynamic Tools:** Decouple tools from a strict classifier category; instead, enable function loops whenever `COMPLEX` intent is matched, letting the model determine when to call tools.
- **Simplification:** Collapse classifier categories to improve accuracy, speed, and prompt compactness. Legacy categories are mapped gracefully in the router to maintain backwards compatibility.
- **Feature Parity:** Bring the last non-tool-calling provider (OpenRouter) on par with Groq/Nvidia using a loop limit of `MAX_TOOL_HOPS = 4`.

### 4. Detailed Blueprint
- **New Modules:**
  - `src/lib/bot/outputGuard.ts` (sanitizer)
  - `src/lib/bot/outputGuard.test.ts` (unit tests)
- **Modified files:**
  - `src/lib/bot/chainRouter.ts` (enable tools for COMPLEX, map legacy intents, add status callbacks, sanitize final responses)
  - `src/lib/bot/classifier.ts` (simplify VALID_CATEGORIES, simplify prompt, update tag mapping and guard logic)
  - `src/lib/bot/providers/openrouter.ts` (implement function tool execution block)
- **Migrations:**
  - `docs/migrations/2026-06-17-simplify-classifier-keywords.sql` (renames categories in database JSON blocks)

### 5. Operational Trace
1. Initialized `task.md` tracking artifact.
2. Created `outputGuard.ts` containing the pattern declarations and stripping function.
3. Created `outputGuard.test.ts` covering bracket, tag, hint, idempotency, and whitespace cases.
4. Integrated `sanitizeOutput` into all return entrypoints in `chainRouter.ts` (standard paths, vision fast path, vision standard path).
5. Changed `useTools` flag logic inside `chainRouter.ts` to map COMPLEX, CODING, etc. to active tool loops.
6. Removed `'TOOLS'` from valid intent options and maps `/tool` tag inputs to `COMPLEX` in `classifier.ts`.
7. Intercepted `capturedToolCalls` in `chainRouter.ts` and pushed Status Pilling updates (`onStatus`) for real-time tool usage feedback in chat.
8. Collapsed categories down to the core 4 (COMPLEX, WEB_SEARCH, IMAGE_GEN, AUDIO) and removed obsolete prompt rules/CODING guards in `classifier.ts`.
9. Normalized raw inputs to `COMPLEX` and `WEB_SEARCH` inside `chainRouter.ts` to secure legacy compatibility.
10. Added `tools` definitions mapping, relocated `fetchHeaders`, and built a tool loop in `openrouter.ts` with error handling.
11. Created walkthrough and sql migration files.
12. Staged and committed code changes into local git repository.

### 6. Status Assessment
- **Completed:** All coding and migration phases (Phases 1-4) successfully completed and committed locally on `main` branch.
- **Verification:** Unit tests written. Recommended manual steps (applying SQL script, clearing build cache, running app queries) documented in `walkthrough.md`.
