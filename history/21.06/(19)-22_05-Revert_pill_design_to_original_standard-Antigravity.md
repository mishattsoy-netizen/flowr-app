### 0. Date and time of the request
Date: 2026-06-21
Time: 22:05

### 1. User request
User request: "continue"

### 2. Objective Reconstruction
Revert the catch-all rendering of inline links in the AI assistant's chat messages as capsule pills to their original style. Standard links should render as standard inline underlined text links (`chat-standard-link`), while search source citations (URLs present in `msg.citations` or explicitly prefixed with `pill:`) should render as capsule pills (`LinkWithPopup`).

### 3. Strategic Reasoning
- The user expressed negative feedback ("wtf is this pill design, use same as it was") regarding the change that turned all inline links in assistant messages into capsule pills.
- To address this, we reverted the unconditional rendering of pills in `ChatMessage.tsx`'s `a` markdown component.
- We added a dynamic check: if the link text starts with the `pill:` prefix, or if its hostname matches any hostname present in the message's `citations` array, we render it as a capsule pill (`LinkWithPopup`).
- All other standard inline links (e.g. channel links, documentation references, normal paragraph links) are rendered as standard underlined links (`chat-standard-link`).
- This satisfies both the request to keep sources as pills and the request to not clutter the paragraph text flow with general pills.

### 4. Detailed Blueprint
- Modify [ChatMessage.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/assistant/components/ChatMessage.tsx):
  - Under the custom `a` component mapping, extract the hostname matching logic.
  - If a link matches `isPill` or `isSourceCitation` (hostname matches a URL in `msg.citations`), render it as `LinkWithPopup`.
  - Otherwise, render standard `a` tag with class `chat-standard-link`.

### 5. Operational Trace
- Replaced the inline link rendering logic inside `a` custom renderer in [ChatMessage.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/assistant/components/ChatMessage.tsx) to match by hostname and check `isPill`.
- Ran the test suite via `./node_modules/.bin/vitest run --exclude "**/.claude/**"`: all 117 tests passed successfully.

### 6. Status Assessment
- **Completed**: Reverted inline links back to standard underlines, while retaining capsule pills for explicit pills and search citations.
- **Fixed**: Render layout styling for inline links inside assistant chat messages.
- **Remaining**: None.
