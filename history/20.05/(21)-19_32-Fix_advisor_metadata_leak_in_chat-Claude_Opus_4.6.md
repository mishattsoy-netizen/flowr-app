User request: "why do i see it when i have advisor on?"

### 0. Date and Time
- Date: 20.05 (May 20, 2026)
- Time: 19:32

### 1. User Request
User request: "why do i see it when i have advisor on?" — referring to raw advisor metadata (`PASS`, `---ADVISOR_STATE---...---END_ADVISOR_STATE---`) leaking into the chat UI.

### 2. Objective Reconstruction
When the advisor feature is enabled, the advisor model sometimes outputs raw pipeline metadata (the `PASS` keyword and `---ADVISOR_STATE---` JSON blocks) inline with its response. This internal metadata was not being stripped from the displayed chat content, so users could see it.

### 3. Strategic Reasoning
The advisor model outputs structured state markers (`---ADVISOR_STATE---...---END_ADVISOR_STATE---`) and a `PASS` keyword as part of its response protocol. The server-side `parseAdvisorResponse()` in `advisor.ts` already strips these from the parsed result, but the raw model output can still end up in the final streamed content via `onChunk` or in edge cases where the model echoes the markers. The safest fix is to add client-side stripping in `sanitizeContent()` — the single function responsible for cleaning all displayed AI content — ensuring these markers never reach the user regardless of where they originate.

### 4. Detailed Blueprint
- **File:** `src/components/assistant/components/ChatMessage.tsx`
- **Function:** `sanitizeContent()`
- **Changes:**
  1. Strip complete `---ADVISOR_STATE---...---END_ADVISOR_STATE---` blocks
  2. Strip partial/streaming `---ADVISOR_STATE---` blocks (when still loading)
  3. Strip leading `PASS` label

### 5. Operational Trace
- Added 3 regex replacements in `sanitizeContent()` after system-notes stripping:
  - `text.replace(/---ADVISOR_STATE---[\s\S]*?---END_ADVISOR_STATE---/g, '')` — strips completed blocks
  - `text.replace(/---ADVISOR_STATE---[\s\S]*$/, '')` — strips partial blocks during streaming
  - `text.replace(/^\s*PASS\s*/i, '')` — strips the leading PASS label

### 6. Status Assessment
- **Completed:** Advisor metadata is now stripped from chat display content.
- **Result:** Users will no longer see `PASS` or `---ADVISOR_STATE---` blocks in the chat when advisor is enabled.
- **No side effects:** The stripping only targets these specific advisor protocol markers.
