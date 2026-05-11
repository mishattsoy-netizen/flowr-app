User request: "no image"

Objective Reconstruction:
Fixed a regression where the previous image rendering fix caused some images (especially those with slightly different formatting or smaller sizes) to not render at all, leaving an empty chat bubble.

Strategic Reasoning:
- Identified that the manual image extraction in the `p` component was too strict about children types and whitespace.
- Found that `sanitizeContent` could be even more permissive with whitespace inside the markdown parentheses to handle various model output quirks.
- Simplified the paragraph rendering logic to prioritize standard React elements (like parsed images) while still providing a robust fallback for "unparsed" image markdown.

Detailed Blueprint:
- **ChatMessage.tsx**:
    - Updated `sanitizeContent` regex to handle leading/trailing whitespace inside `(...)`.
    - Rewrote `markdownComponents.p` logic to correctly join children before matching and ensure surrounding text is rendered with proper styling.
    - Simplified the logic to return `renderContentWithStyles(children)` as the default, ensuring that correctly parsed markdown always renders.

Operational Trace:
- Modified `src/components/assistant/components/ChatMessage.tsx` (lines 157, 627).
- Refined regex patterns for image protection and extraction.

Status Assessment:
- Both large and small base64 images should now render reliably.
- Correctly parsed markdown images (by `ReactMarkdown`) will use the default path, while unparsed ones will be caught by the `p` component fallback.
