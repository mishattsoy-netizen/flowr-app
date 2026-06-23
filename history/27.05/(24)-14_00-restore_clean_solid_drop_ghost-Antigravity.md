Date: 27.05.2026
Time: 14:00

User request: "you removed drop ghost"

### Objective Reconstruction
Restore the clean, solid, empty "drop ghost" container inside the active column slot during dragging while retaining its dynamic, exact computed card height.

### Strategic Reasoning
1. **Empty Drop Ghost Aesthetics**: In the previous turn, to make the placeholder "not transparent", we removed the `opacity-0` wrapper, making all the card's text and contents visible. However, this caused the card to appear fully rendered in two places at once (in the list and under the mouse), which removed the "drop ghost" slot. Restoring `opacity-0` on children for the placeholder (`isDragging={true}`) hides the content duplication and restores a beautiful, solid, blank gray container (`bg-[var(--bone-3)]`) of the exact correct card height.
2. **Stable Sorting Coordinates**: Standard `@dnd-kit` CSS.Translate transform tracking is kept fully active to ensure sibling cards shift cleanly.

### Detailed Blueprint
- `src/components/tracker/TaskCard.tsx`:
  - Restore the `opacity-0` utility class to the `TaskCardUI` children wrapper when `isDragging` is true.

### Operational Trace
1. **Modified `TaskCard.tsx`**:
   - Re-applied `opacity-0` inside the conditional class evaluation for the children wrapping div.

### Status Assessment
- **Completed**:
  - The board drop preview slot renders as a clean, blank solid gray drop ghost container of exact dynamic card height.
  - Sorting and drag transformations are completely stable and compile successfully with 0 errors.
- **Unresolved**: None.
- **Recommendations**: Re-test board dragging behavior.
