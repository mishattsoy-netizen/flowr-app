User request: "make it smaller"

Objective Reconstruction:
Resized the AI-generated images in the Admin Logs detail view to improve usability and prevent them from dominating the screen.

Strategic Reasoning:
- The images were rendering at full resolution, making it difficult to navigate the expanded log view.
- Added a `max-h-[500px]` constraint and centering logic to the Admin Log's image containers.
- This ensures images remain high-quality but are visually contained and easy to scan.
- Fixed a temporary syntax error introduced during the resizing logic implementation.

Detailed Blueprint:
- **LogsTable.tsx**:
    - Updated the `isPureImage` bypass and the `p` component override to include a flex container with centering.
    - Applied `max-h-[500px]` and `object-contain` to the image tags.
    - Added a subtle shadow and themed border for a premium look.

Operational Trace:
- Modified `src/app/admin/logs/LogsTable.tsx` (resizing and centering logic).

Status Assessment:
- Admin log images are now appropriately sized and centered.
- The UI remains layout-stable even with massive base64 payloads.
