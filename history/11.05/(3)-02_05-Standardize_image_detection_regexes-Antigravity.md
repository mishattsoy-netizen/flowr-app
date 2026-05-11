User request: "no image!"

Objective Reconstruction:
Standardized all image detection and rendering logic across the chat component and admin logs to use a consistent, whitespace-permissive regex pattern. This ensures that images are correctly identified and rendered even when models or formatting layers introduce extra spaces or newlines.

Strategic Reasoning:
- Found a discrepancy between the sanitization regex (which was permissive) and the rendering regex (which was strict), leading to "protected" images that the renderer failed to catch, resulting in empty content or broken markdown.
- Standardized the image detection pattern `/!\[.*?\]\s*\(\s*(data:image\/|https?:\/\/|AUO)/` across all components.
- Improved the `p` component's initial check (`hasPotentialImage`) to use this same robust regex, ensuring that even oddly-formatted markdown hits the specialized rendering path.
- Updated the admin panel's truncation logic to stay in sync with these changes, preventing broken previews.

Detailed Blueprint:
- **ChatMessage.tsx**:
    - Standardized `looksLikeImageContent` to use the permissive regex.
    - Standardized `p` component's `hasPotentialImage` and `imgMatch` to handle leading spaces inside `(...)`.
- **LogsTable.tsx**:
    - Updated `truncate` split regex to handle spaces after the opening parenthesis.

Operational Trace:
- Modified `src/components/assistant/components/ChatMessage.tsx` (lines 134, 630, 633).
- Modified `src/app/admin/logs/LogsTable.tsx` (line 34).

Status Assessment:
- Image detection is now universally consistent and resilient to formatting variations.
- The "empty bubble" and "empty log detail" issues should be resolved as the renderer now correctly identifies the markdown it is given.
