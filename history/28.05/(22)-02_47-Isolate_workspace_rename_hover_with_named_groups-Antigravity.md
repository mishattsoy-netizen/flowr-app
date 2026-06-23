User request: "i can still se it when hover widgets fix it"

### 0. Date and time of the request
- **Date**: 28 May 2026
- **Time**: 02:47 local time

### 1. User request
`User request: "i can still se it when hover widgets fix it"`

### 2. Objective Reconstruction
Isolate the workspace title rename edit button (`Pencil` icon) hover visibility strictly to the workspace header row element, ensuring it never appears when hovering over any widgets inside the bento grid below.

### 3. Strategic Reasoning
- **Named Group Isolation**: Swapping the generic `group` and `group-hover` classes for custom named group bindings (`group/header` and `group-hover/header:opacity-100`) completely encapsulates the visual hover detection within `<header>`.
- **Eliminating Interference**: By stripping the `group` class from `h1` and relying solely on the specific named header group, we completely prevent adjacent component hovers (such as dragging items or hovering widget elements) from unintentionally triggering the workspace rename edit button.

### 4. Detailed Blueprint
- **Files Involved**:
  - `src/components/bento/BentoDashboard.tsx`
  - `src/components/workspace/WorkspacePage.tsx`
- **Class Swaps**:
  - `BentoDashboard.tsx`: Add `group/header` to the `<header>` element.
  - `WorkspacePage.tsx`: Strip `group` class from `h1` and replace `group-hover:opacity-100` with `group-hover/header:opacity-100` on the button inside the Tooltip.

### 5. Operational Trace
- **Code Modification**:
  - Changed `<header className="group flex items-end justify-between mb-3 px-[6px]">` to `<header className="group/header flex items-end justify-between mb-3 px-[6px]">` in `BentoDashboard.tsx`.
  - Re-routed hover logic in `WorkspacePage.tsx` using `group-hover/header:opacity-100` and removed `group` from the `h1` title header.
- **Type Checking**: Validated changes using `npx tsc --noEmit` and confirmed that the build passes with 0 errors.

### 6. Status Assessment
- **Status**: 100% Completed.
- **Next Recommendation**: None — hovering the widget cells will no longer trigger the workspace edit indicator, rendering the header completely clean and insulated.
