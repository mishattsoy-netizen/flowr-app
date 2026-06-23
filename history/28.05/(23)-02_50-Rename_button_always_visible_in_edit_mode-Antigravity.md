User request: "i repeat, show only!!! when my mouse is in the header keep visible in edit mode."

### 0. Date and time of the request
- **Date**: 28 May 2026
- **Time**: 02:50 local time

### 1. User request
`User request: "i repeat, show only!!! when my mouse is in the header keep visible in edit mode."`

### 2. Objective Reconstruction
Incorporate visual rules for the workspace rename edit button (`Pencil` icon) inside the workspace header to:
1. Make it strictly hidden unless the pointer is hovering inside the workspace header (`opacity-0 group-hover/header:opacity-100`).
2. Keep it **permanently visible** when the Bento dashboard is in layout edit mode (`editMode` is true) to ensure easy title editing, bypassing the hover requirement.

### 3. Strategic Reasoning
- **Edit Mode Access Path**: Layout edit mode is designated for adjusting the page, meaning the rename button should stay always visible to indicate that editing is active.
- **Header State Passing**: Converted the `title` prop in `BentoDashboard` to support a React render function, allowing `BentoDashboard` to pass its local `editMode` state down to the title node in `WorkspacePage.tsx` beautifully.
- **Dynamic CSS Classes**: Evaluated `editMode` directly inside the class concatenation inside `WorkspacePage.tsx`, swapping the group-hover styling for full opacity when edit mode is active.

### 4. Detailed Blueprint
- **Files Involved**:
  - `src/components/bento/BentoDashboard.tsx`
  - `src/components/workspace/WorkspacePage.tsx`
- **Logic**:
  - `BentoDashboard.tsx`: Evaluate `title` as a render function `title(editMode)` when it's passed as a function.
  - `WorkspacePage.tsx`: Convert `title` definition to `(editMode: boolean) => JSX`.
  - Apply `editMode ? 'opacity-100' : 'opacity-0 group-hover/header:opacity-100'` on the button inside the Tooltip.

### 5. Operational Trace
- **Code Modification**:
  - Updated type annotations for `BentoDashboardProps` and added check to render title as `typeof title === 'function' ? title(editMode) : title`.
  - Re-routed the title definition inside `WorkspacePage.tsx` to receive `editMode: boolean`, and set the `className` of the `button` element conditionally based on `editMode`.
- **Type Checking**: Validated type safety with `npx tsc --noEmit` and confirmed compilation succeeds with 0 errors.

### 6. Status Assessment
- **Status**: 100% Completed.
- **Next Recommendation**: None — toggle layout edit mode to verify that the pencil icon stays permanently visible, and turn layout edit mode off to enjoy the clean header hover zone!
