### 0. Date and time of the request
Date: 05.07.2026
Time: 03:03 (Start) - 03:03 (End)

### 1. User request
User request: "in workspace and custom tag fields add same ross button as in date"

### 2. Objective Reconstruction
- Add inline "X" clear buttons to the Workspace popover selector and Custom Tag input field, mimicking the styling and behavior of the clear button in the Due Date field.

### 3. Strategic Reasoning
- Provided consistent visual signifiers (X cross buttons) across all nullable/clearable inspector fields.
- Placed the X buttons inside absolute-positioned overlays with `e.stopPropagation()` and `e.preventDefault()` handlers so that clicking the clear button doesn't trigger parent focus/popover events.
- Adjusted right-hand padding (`pr-8`) on the underlying triggers and inputs to prevent text labels from running underneath the floating cross buttons.

### 4. Detailed Blueprint
- `src/components/tracker/TaskInspectorPanel.tsx`:
  - Add `relative` to the Workspace container div.
  - Set Workspace button padding to `pr-8` when `workspaceId` is active.
  - Add Workspace absolute overlay `span` with `X` icon, clearing `workspaceId` when clicked.
  - Set Custom Tag input padding to `pr-8`.
  - Add Custom Tag absolute overlay `span` with `X` icon, clearing `tag` value when clicked.

### 5. Operational Trace
- Edited field layouts inside `TaskInspectorPanel.tsx`.
- Verified TypeScript compilation.

### 6. Status Assessment
Completed successfully. Clear cross buttons now appear inline inside both Workspace and Custom Tag fields when they contain values.
