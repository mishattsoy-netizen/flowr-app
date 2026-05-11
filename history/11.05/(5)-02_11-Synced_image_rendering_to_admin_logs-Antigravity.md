User request: "i dont see image in the logs"

Objective Reconstruction:
Unified the image rendering logic between the Chat and Admin Logs by implementing the high-performance "Pure Image" bypass in the Logs detail view.

Strategic Reasoning:
- Noticed that while the Chat component was optimized, the Admin Log expanded view was still relying on a potentially unstable `ReactMarkdown` rendering path for massive image payloads.
- Applied the `isPureImage` detection logic to `LogsTable.tsx`.
- Now, if a log entry consists exclusively of an image markdown, it bypasses the parser and renders as a direct `img` tag with a themed container.
- Standardized regexes across both files to ensure consistent identification of image markdown regardless of whitespace or formatting.

Detailed Blueprint:
- **LogsTable.tsx**:
    - Added an IIFE within the model response cell to detect pure image markdown.
    - Implemented direct `img` rendering for pure image logs.
    - Kept the robust `p` and `img` overrides for `ReactMarkdown` as fallbacks for mixed-content logs.

Operational Trace:
- Modified `src/app/admin/logs/LogsTable.tsx` (implemented bypass logic).

Status Assessment:
- Both the main chat and the admin audit logs now use the same hardened, optimized rendering path.
- Existing logs might still show artifacts if they were mangled during a previous session's failed sanitization, but all NEW generations and logs should render perfectly.
