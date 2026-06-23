User request: "problems: [SEARCH] in final answer. news sources are not pills/button fi it"

### 0. Date and time of the request
Date: 2026-06-21
Time: 22:45

### 1. User request
User request: "problems: [SEARCH] in final answer. news sources are not pills/button fi it"

### 2. Objective Reconstruction
The task was to solve two issues in the AI chat responses:
1. Strip the internal `[SEARCH] <query>` text prefix that occasionally leaks into the final output of the assistant.
2. Ensure that search citations at the end of list items correctly render as styled button pills (using `LinkWithPopup`) instead of standard text links when the model outputs URLs without an explicit protocol (e.g. `anthropic.com` instead of `https://anthropic.com`).

### 3. Strategic Reasoning
1. **Search Prefix Leak:** The model sometimes outputs `[SEARCH] <query>` as a search query formulation command. We resolved this by adding a regular expression to match and remove `[SEARCH] ...` prefixes from final responses in both the backend output sanitizer (`outputGuard.ts`) and the frontend assistant display sanitizer (`ChatMessage.tsx`).
2. **Missing Citation Pills:** The assistant is trained to reference sources using markdown links. When it generates hostnames without a protocol (like `[Anthropic](anthropic.com)`), browser default matching and `URL` parsing failed, resulting in plain relative links. Resolving this required:
   - Converting URLs to absolute links (`https://...`) inside the link parsing utilities (`ChatMessage.tsx` and `markdownToBlocks.ts`).
   - Normalizing hostname checks in `ChatMessage.tsx` to handle protocol-less inputs properly, ensuring accurate matching against `msg.citations`.

### 4. Detailed Blueprint
- **Modify** [outputGuard.ts](file:///Users/mktsoy/Dev/flowr-app/src/lib/bot/outputGuard.ts) to filter out `[SEARCH] ...` patterns.
- **Modify** [outputGuard.test.ts](file:///Users/mktsoy/Dev/flowr-app/src/lib/bot/outputGuard.test.ts) to verify the output cleaning via unit tests.
- **Modify** [ChatMessage.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/assistant/components/ChatMessage.tsx) to strip `[SEARCH]` on the client side, ensure absolute link URLs, and fallback safely to host-matched citation popups.
- **Modify** [markdownToBlocks.ts](file:///Users/mktsoy/Dev/flowr-app/src/lib/utils/markdownToBlocks.ts) to normalize markdown-saved URLs to absolute paths inside the note editor block generator.

### 5. Operational Trace
- Added the `[SEARCH]\s*[^\n]*(?:\n+|$)` regex to `SANITIZE_PATTERNS` in `outputGuard.ts`.
- Wrote a unit test `strips [SEARCH] query prefixes` in `outputGuard.test.ts`.
- Integrated `ensureAbsoluteUrl` helper inside the `a` element renderer within `ChatMessage.tsx`'s `markdownComponents`.
- Updated `getHostname` inside `ChatMessage.tsx` to prepend `https://` if a URL starts without a protocol, ensuring successful extraction of the hostname.
- Updated link transformation in `markdownToBlocks.ts` to normalize saved URLs with `ensureAbsoluteUrl`.

### 6. Status Assessment
- **Completed:** Both issues are successfully addressed. The `[SEARCH]` text is sanitized out, and citation links without protocols are correctly matching against citations to render as premium styled pills rather than standard text links.
- **Verification:** Unit tests for `outputGuard` were added.
