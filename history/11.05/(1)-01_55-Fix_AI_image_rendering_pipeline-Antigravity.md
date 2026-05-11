User request: "fix"

Objective Reconstruction:
Resolved failures in the AI image rendering pipeline where large base64-encoded images were displayed as raw text instead of visual images in both the chat interface and the admin logs.

Strategic Reasoning:
- Identified that standard markdown parsers often fail on extremely large base64 strings (megabytes of data) or when models introduce minor formatting inconsistencies (like newlines between the alt text and URL).
- Implemented a "permissive detection" layer in the custom paragraph component to catch and render these "broken" markdown images manually using the existing `ChatImage` component.
- Enhanced the sanitization logic to reliably protect large data URIs during content processing.
- Optimized the admin logs table to hide base64 noise in the summary view and correctly render images in the expanded details view.

Detailed Blueprint:
- **ChatMessage.tsx**: 
    - Updated `looksLikeImageContent` to be more permissive.
    - Updated `sanitizeContent` regex to handle optional whitespace/newlines.
    - Revamped `markdownComponents.p` to detect images in both string and array-based children, extract them reliably, and render them using `ChatImage`.
- **LogsTable.tsx**:
    - Updated `truncate` helper to detect base64 images and replace them with a short "[Image Data]" label.
    - Added an `img` component override to the `ReactMarkdown` instance in the expanded log view to clean and render base64 sources.

Operational Trace:
- Modified `src/components/assistant/components/ChatMessage.tsx` (lines 134, 157, 622).
- Modified `src/app/admin/logs/LogsTable.tsx` (lines 31, 516).
- Validated regex patterns for data URI extraction.

Status Assessment:
- Image rendering is now robust against large payloads and formatting quirks.
- Admin panel performance improved by avoiding rendering megabytes of raw text in table rows.
- Chat UI correctly transitions from "Generating" state to displaying the final image.
