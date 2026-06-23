User request: "i repeat, show only!!! when my mouse is in the header keep visible in edit mode."

### 0. Date and time of the request
- **Date**: 28 May 2026
- **Time**: 02:52 local time

### 1. User request
`User request: "i repeat, show only!!! when my mouse is in the header keep visible in edit mode."`

### 2. Objective Reconstruction
Refine the workspace title rename edit button (`Pencil` icon) inside the workspace header to:
1. Show the edit button strictly and exclusively when the cursor is hovering inside the workspace header.
2. Completely hide the edit button the instant the mouse leaves the header (e.g., hovering widgets in the grid below), using `transition-none` to guarantee immediate zero-delay visual feedback.
3. Ensure the edit button remains perfectly operational on hover when the dashboard is in edit mode.

### 3. Strategic Reasoning
- **Strict Header Containment**: In order to prevent the edit button from being seen when hovering over widgets (regardless of whether the layout is in edit mode or normal mode), we removed the always-visible override (`opacity-100`) from dashboard edit mode. The button now relies completely on the `group-hover/header:opacity-100` state.
- **Universal 0ms Mandate**: The transition delay (`transition-opacity`) was causing the button to remain visible for a split second as the user moved the mouse from the header down to the widgets. Removing the opacity transition and applying `transition-none` aligns perfectly with the brand's **Universal Mandate (0ms)**, making the button instantly and cleanly vanish.

### 4. Detailed Blueprint
- **Files Involved**:
  - `src/components/workspace/WorkspacePage.tsx`
- **Class Swaps**:
  - Change `transition-opacity` to `transition-none` on the button inside the Tooltip.
  - Simplify the conditional class from `${isEditing ? 'opacity-0 pointer-events-none' : editMode ? 'opacity-100' : 'opacity-0 group-hover/header:opacity-100'}` to `${isEditing ? 'opacity-0 pointer-events-none' : 'opacity-0 group-hover/header:opacity-100'}`.

### 5. Operational Trace
- **Code Modification**:
  - Replaced the button class interpolation in `WorkspacePage.tsx` to omit layout `editMode` from changing the active visibility state, enforcing `opacity-0 group-hover/header:opacity-100` with `transition-none`.
- **Type Checking**: Validated compilation integrity using `npx tsc --noEmit` and verified 0 warnings or errors are present.

### 6. Status Assessment
- **Status**: 100% Completed.
- **Next Recommendation**: None — the workspace rename edit button now functions instantly, cleanly, and disappears immediately when the pointer leaves the header area.
