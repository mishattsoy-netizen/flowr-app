### 0. Date and time of the request
Date: 2026-06-21
Time: 22:21

### 1. User request
User request: "sources still have underline not pills, why?"

### 2. Objective Reconstruction
Resolve why search sources rendered as standard underlined links rather than capsule pills in chat messages when Tavily search was executed. The issue was that search engine steps do not return their parsed URLs inside `citations` of the final synthesis model (grounding is bypassed when results are pre-injected as `[SEARCH DATA]`). The objective is to extract the search URLs from the system prompt's search block dynamically to populate `msg.citations`.

### 3. Strategic Reasoning
- When manual web search providers (like Tavily) execute, they append raw search results to the system prompt. Grounding is disabled on the downstream synthesis model (e.g. Gemini) to save free-tier quotas and prevent double-grounding.
- Consequently, the synthesis model returns empty or undefined citations, resulting in an empty `msg.citations` field in the final message database record.
- Without a populated `msg.citations` array, the frontend's hostname check fails, causing the search links inside paragraphs to render as standard underlined text links, and the bottom "Sources" section to disappear entirely.
- By parsing `system_prompt` for `URL: https://...` lines and populating the `citations` list in `chainRouter.ts`, we ensure search URLs are correctly stored. This resolves the pill rendering issue and makes the bottom Sources block show up.

### 4. Detailed Blueprint
- Modify [chainRouter.ts](file:///Users/mktsoy/Dev/flowr-app/src/lib/bot/chainRouter.ts):
  - In `runChain`, right after `sanitizeOutput(finalContent)`, check if `citations` is empty.
  - If so, parse `system_prompt` using a regular expression `URL:\s*(https?:\/\/[^\s\n]+)` to collect all searched URLs.
  - De-duplicate and assign them to `citations`.

### 5. Operational Trace
- Added the regular expression citation extraction block in [chainRouter.ts](file:///Users/mktsoy/Dev/flowr-app/src/lib/bot/chainRouter.ts).
- Staged all files.
- Ran the test suite via `./node_modules/.bin/vitest run --exclude "**/.claude/**"`: all 117 tests passed successfully.

### 6. Status Assessment
- **Completed**: Dynamically populated the `citations` array from system prompt search blocks.
- **Fixed**: Search sources rendering as standard links instead of pills in assistant chat responses.
- **Remaining**: None.
