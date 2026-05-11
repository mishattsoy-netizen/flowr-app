User request: "make it even smaller and remove shadow"

Objective Reconstruction:
Further refined the Admin Log image presentation by reducing the maximum height and removing unnecessary decorative elements like shadows.

Strategic Reasoning:
- The user requested a more compact view for log entries.
- Reduced the `max-h` from 500px to 320px.
- Removed the `shadow-2xl` class to give the UI a flatter, more integrated aesthetic that doesn't distract from the technical data in the logs.

Detailed Blueprint:
- **LogsTable.tsx**:
    - Updated both the `isPureImage` bypass and the fallback renderer to use a 320px height limit.
    - Stripped shadow classes from the image container.

Operational Trace:
- Modified `src/app/admin/logs/LogsTable.tsx` (style refinements).

Status Assessment:
- Log details are now highly compact and efficient, suitable for high-density auditing.
