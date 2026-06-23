User request: "add fade in and out"

### 0. Date and time of the request
- **Date**: 28 May 2026
- **Time**: 02:57 local time

### 1. User request
`User request: "add fade in and out"`

### 2. Objective Reconstruction
Incorporate a smooth fade-in and fade-out transition for the workspace title rename Pencil button when hovering inside or leaving the header bar viewport.

### 3. Strategic Reasoning
- **Smooth Interaction Path**: While the project has a general mandate for instant transitions, the user explicitly requested a smooth fade-in/fade-out aesthetic specifically for the workspace edit button.
- **Implementation via Tailwind Transition Utilities**: Swapped out `transition-none` with standard smooth opacity scaling class combinations (`transition-opacity duration-200 ease-in-out`), which ensures the button has a premium, organic fade effect.

### 4. Detailed Blueprint
- **Files Involved**:
  - `src/components/workspace/WorkspacePage.tsx`
- **Class Swaps**:
  - Replace `transition-none` with `transition-opacity duration-200 ease-in-out` on the button inside the Tooltip.

### 5. Operational Trace
- **Code Modification**:
  - Replaced the button class definition in `WorkspacePage.tsx`.
- **Type Checking**: Validated compilation integrity using `npx tsc --noEmit` and verified that no compilation warnings or errors are present.

### 6. Status Assessment
- **Status**: 100% Completed.
- **Next Recommendation**: None — the edit button now slides visually into view with a smooth 200ms ease transition on header hover and fades out seamlessly when leaving.
