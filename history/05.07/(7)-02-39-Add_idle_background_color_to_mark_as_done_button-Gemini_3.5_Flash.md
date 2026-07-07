### 0. Date and time of the request
Date: 05.07.2026
Time: 02:39 (Start) - 02:39 (End)

### 1. User request
User request: "mark as done buttons bg should be a bit colored aswell when idle and onhover kepp current color"

### 2. Objective Reconstruction
- Add a subtle background color highlight to the "Mark as done" context menu item in its idle state.
- Keep the current highlight color (`hover:bg-emerald-500/15`) and text color (`hover:text-emerald-400`) when hovered.

### 3. Strategic Reasoning
- Added the `bg-emerald-500/8` utility class to the button element when it is idle, providing a light, elegant 8% opacity green background container that is visible before hover.
- Boosted text readability in idle state by setting it to `text-emerald-400/80`.

### 4. Detailed Blueprint
- `src/components/tracker/TaskContextMenu.tsx`: Update the "Mark as done" button element's `className` property to include `bg-emerald-500/8 text-emerald-400/80`.

### 5. Operational Trace
- Modifed the class list inside `TaskContextMenu.tsx`.
- Verified TypeScript compilation.

### 6. Status Assessment
Completed successfully. The "Mark as done" context menu button now displays a light green background container in its idle state, transitioning smoothly on hover.
