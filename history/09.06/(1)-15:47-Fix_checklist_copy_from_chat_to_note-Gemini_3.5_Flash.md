User request: "fix checklists copying from chat to note incorrectly"

### 0. Date and time of the request
Date: 09.06.2026
Time: 15:47

### 1. User request
User request: "fix checklists copying from chat to note incorrectly"

### 2. Objective Reconstruction
The objective is to fix a bug where copying a checklist from the AI chat assistant to a note is rendered incorrectly. Specifically, checklists in the chat message starting with bullet prefixes (e.g. `- [ ]` or `* [x]`) were being incorrectly classified as standard bullet lists containing raw text brackets instead of active checklist checkboxes.

### 3. Strategic Reasoning
- The chat-to-note feature works by parsing the markdown content of a chat message using `parseMarkdownToBlocks` in [markdownBlocks.ts](file:///Users/mktsoy/Dev/flowr-app/src/lib/editor/markdownBlocks.ts).
- Under the hood, `classifyLine` matches lines against various regexes. Standard markdown checklist items of the form `- [ ] text` or `* [ ] text` were matching the general bullet regex `^[-*] (.+)` first. This classified them as bullet list items containing the text `[ ] text`.
- To fix this, we need to:
  1. Update the checklist regex to match optional bullet/list markers before the checkbox brackets: `^([-*+]?\s+)?\[([ xX])\] (.+)`.
  2. Put the checklist matching step *before* the general bullet matching step in `classifyLine` so checklist structures are detected first.

### 4. Detailed Blueprint
- **Modify** [markdownBlocks.ts](file:///Users/mktsoy/Dev/flowr-app/src/lib/editor/markdownBlocks.ts):
  - Move the checklist matcher before the bullet list matcher.
  - Update the check regex to support optional bullet prefixes (`-`, `*`, `+`) followed by spaces, and check case-insensitively for `x`/`X` state.
- **Modify** [markdownBlocks.test.ts](file:///Users/mktsoy/Dev/flowr-app/src/lib/editor/markdownBlocks.test.ts):
  - Add a unit test verifying checklist items with various bullet prefixes and check states (lowercase/uppercase) parse correctly.

### 5. Operational Trace
1. Analyzed how chat messages copy to notes in `ChatMessage.tsx`. Identified that markdown is parsed using `parseMarkdownToBlocks` from `src/lib/editor/markdownBlocks.ts`.
2. Located the issue in `classifyLine` where `- [ ]` lines matched the bullet matcher first.
3. Updated the line classifier logic in `src/lib/editor/markdownBlocks.ts` to test for checklist markers before bullets and support standard prefixes (`-`, `*`, `+`) and case-insensitive check states.
4. Added new test cases verifying the updated parser in `src/lib/editor/markdownBlocks.test.ts`.
5. Ran vitest unit tests using `npx vitest run src/lib/editor/markdownBlocks.test.ts` to verify parser compliance and correctness. All tests passed.

### 6. Status Assessment
- **Completed**: Checklist parsing with bullet prefixes and case insensitivity has been fully corrected.
- **Verified**: Unit tests pass successfully.
- **Recommendations**: If the development server is currently running, recommend clearing the Next.js cache (`rm -rf .next`) and restarting the server to ensure all updates are loaded cleanly.
