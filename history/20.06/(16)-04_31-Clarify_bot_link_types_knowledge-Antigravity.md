# 20.06 at 04:31

User request: "does bot know that there is 2 types of links? inline and sources/buttons"

## Objective Reconstruction
1. **Clarification:** The user asked whether the AI chatbot/bot knows that there are two distinct types of links in the system: standard inline links and citation source buttons.

## Strategic Reasoning
We inspected the default system prompts of the AI pipeline (`REGULAR`, `WEB_SEARCH`) and the copy-to-note parser implementation (`ChatMessage.tsx`, `markdownBlocks.ts`):
- The LLM models themselves output standard markdown links `[Title](url)` for factual citations.
- The pipeline client controller (`ChatMessage.tsx`) parses these body links and converts them into standard inline `<a>` anchors (which render as underlined links in notes).
- The pipeline client controller also takes the message citations list and appends them at the bottom as capsule buttons with the `inline-link-btn` class.
Hence, the model outputs standard markdown link notation, and the system dynamically formats body links as inline links and citation objects as source buttons.

## Detailed Blueprint
No code modifications are required for this clarifying question.

## Operational Trace
1. Audited [router-chains.json](file:///Users/mktsoy/Dev/flowr-app/bot%20configs%28premission%20to%20edit%20needed%21%29/router-chains.json) system prompts for `REGULAR` and `WEB_SEARCH` categories.
2. Verified link parsing logic in `handleCopyToNote` in [ChatMessage.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/assistant/components/ChatMessage.tsx).

## Status Assessment
- **Completed:** The bot system formats body links as standard inline links and appended source lists as buttons.
