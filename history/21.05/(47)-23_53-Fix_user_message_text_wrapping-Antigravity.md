User request: "image 1 is how text got sent. image 2 is how same text got sent in claude. fix it"

## 0. Date and time of the request
21.05 23:53

## 1. User request
User request: "image 1 is how text got sent. image 2 is how same text got sent in claude. fix it"

## 2. Objective Reconstruction
The user's message bubble in the chat was rendering raw newline characters (`\n`) as visible line breaks, splitting multiline text into individual lines. In Claude.ai, the same text flows as one natural paragraph. The user wants their app to match Claude's behavior.

## 3. Strategic Reasoning
The root cause was the `whitespace-pre-wrap` CSS class on the user message text div in `ChatMessage.tsx`. This class tells the browser to render whitespace characters (including `\n`) literally, just like a `<pre>` tag. Removing it lets the browser use its default `normal` whitespace mode, which collapses newlines into spaces and allows text to reflow naturally as a paragraph.

## 4. Detailed Blueprint
- `src/components/assistant/components/ChatMessage.tsx`: Removed `whitespace-pre-wrap` from the className of the user message text `<div>` at line 1172.

## 5. Operational Trace
- Located user message bubble render at line 1172 of ChatMessage.tsx.
- Removed the `whitespace-pre-wrap` class, leaving `break-words font-medium`.

## 6. Status Assessment
User messages will now flow as continuous paragraphs, matching Claude's behavior. The `break-words` class is retained to ensure very long words/URLs don't overflow the bubble.
