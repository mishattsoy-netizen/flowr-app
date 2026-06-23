### 0. Date and time of the request
Date: 2026-06-21
Time: 04:37

### 1. User request
User request: "fix sources are not pills@[/Users/mktsoy/Dev/flowr-app/transcripts/ai-transcript-2026-06-21T02-35-02.md]"

### 2. Objective Reconstruction
Render all external links (sources/citations) in the AI assistant's chat messages as rounded capsule citation pills (`LinkWithPopup`), instead of standard underlined inline text links.

### 3. Strategic Reasoning
- The assistant model outputs sources as standard markdown links (e.g. `[GeekWire](url)`).
- In the ChatMessage markdown component renderer, the `a` custom component was only rendering links as pills if their labels explicitly started with the `'pill:'` prefix.
- Since the AI outputs standard link syntax without this prefix, they were rendering as standard underlined text links (`chat-standard-link`).
- To resolve this, we modified the `a` tag component inside `ChatMessage` to render all non-superscript citation links as `LinkWithPopup` (citation pills).
- This aligns with the styling preferences of the app, ensuring that external search results and citations look like premium rounded capsule chips with favicons.

### 4. Detailed Blueprint
- Modify [src/components/assistant/components/ChatMessage.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/assistant/components/ChatMessage.tsx):
  - In the custom `a` component mapping for `ReactMarkdown`, bypass the `isPill` prefix requirement.
  - Return `<LinkWithPopup href={href}>{displayChildren}</LinkWithPopup>` directly for all non-superscript links.

### 5. Operational Trace
- Edited [src/components/assistant/components/ChatMessage.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/assistant/components/ChatMessage.tsx) to remove the `isPill` prefix check and render all external links as `LinkWithPopup`.
- Ran the test suite via `./node_modules/.bin/vitest run --exclude "**/.claude/**"`: all 117 tests passed successfully.

### 6. Status Assessment
- **Completed**: Fixed chat source links to render as premium citation pills.
- **Fixed**: Custom markdown rendering for link tags in the Chat assistant messages.
- **Remaining**: None.
