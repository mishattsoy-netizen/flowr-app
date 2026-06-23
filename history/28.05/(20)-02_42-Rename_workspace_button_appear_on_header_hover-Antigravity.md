User request: "rename workspace button must only appear on title hover"

### 0. Date and time of the request
- **Date**: 28 May 2026
- **Time**: 02:42 local time

### 1. User request
`User request: "rename workspace button must only appear on title hover"`
*(Clarified in subsequent message: "i mean header hover")*

### 2. Objective Reconstruction
Configure the workspace rename edit button (`Pencil` icon) to appear contextually whenever the user hovers anywhere over the **entire header row** of the workspace (the dashboard title and quick action actions section), rather than just the title text's bounding box.

### 3. Strategic Reasoning
- **Enhanced Header Hover Zone**: Previously, the `group` class was set only on the `h1` element inside `WorkspacePage.tsx`, causing the pencil button to remain hidden when hovering other parts of the header bar. Adding the `group` class to the parent `<header>` element inside `BentoDashboard.tsx` extends the hover region across the entire header bar.
- **Micro-Interactions**: This keeps the workspace header completely clean while the user interacts with the Bento widget grid below, but smoothly reveals edit capabilities the moment their mouse enters the top header region.

### 4. Detailed Blueprint
- **Files Involved**:
  - `src/components/bento/BentoDashboard.tsx`
- **Classes**:
  - Add `group` to the `<header>` element.

### 5. Operational Trace
- **Code Modification**: Changed `<header className="flex items-end justify-between mb-3 px-[6px]">` to `<header className="group flex items-end justify-between mb-3 px-[6px]">` inside `BentoDashboard.tsx`.
- **Type Checking**: Confirmed type safety via typescript compiler dry-run check.

### 6. Status Assessment
- **Status**: 100% Completed.
- **Next Recommendation**: Move your mouse over any region in the workspace header to see the edit rename button smoothly appear!
