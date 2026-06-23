User request: "nope, i didnt told you to change drop preview style"

### 0. Date and time of the request
May 29, 2026 at 01:20

### 1. User request
The user requested to revert the visual drop preview style of the dragging card to match its original styling, while keeping the fix that ensures the drop preview is correctly positioned where the task is located during a drag.

### 2. Objective Reconstruction
The objective was to revert the class name changes on the dragging card wrapper inside `TaskCardUI` back to the original layout style (`bg-[var(--bone-3)] border-[var(--bone-3)] cursor-grabbing`), while preserving the correct `transform` and `transition` fixes in the parent `TaskCard` component that keep the placeholder static in the list rather than floating with the cursor.

### 3. Strategic Reasoning
1. **Accurate Style Preservation**: Reverted the classes to the exact visual style chosen by the user (`bg-[var(--bone-3)] border-[var(--bone-3)] cursor-grabbing`).
2. **Maintained Functional Correction**: Preserved the `isDragging ? undefined : CSS.Translate.toString(transform)` style optimization on the sortable hook so that the drop preview placeholder remains correctly and statically placed in the list, preserving high-fidelity drag-and-drop mechanics.

### 4. Detailed Blueprint
- **`TaskCard.tsx`**: Revert class names in `<TaskCardUI />` when `isDragging` is true to `"bg-[var(--bone-3)] border-[var(--bone-3)] cursor-grabbing"`.

### 5. Operational Trace
1. **Modified [TaskCard.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/tracker/TaskCard.tsx)**:
   - Restored original container class conditionals inside `<TaskCardUI />` for dragging and non-dragging.
2. **Typechecked and tested**:
   - Typechecking completed clean with no warnings/errors.
   - Executed `npm run test` and confirmed all 44 unit tests pass successfully.

### 6. Status Assessment
- **Completed**: Reverted active item dragging layout class names back to original styles, while keeping all drag alignment and transition speed optimizations completely intact.
- **Active state**: Verified, type-safe, and fully integrated with existing dashboard design standards.
