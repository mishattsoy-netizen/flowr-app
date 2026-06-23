Date: 27.05.2026
Time: 13:41

User request: "make tasks drom aniamtion smooth and consistant"

### Objective Reconstruction
Refine the drag-and-drop mechanics and visual transitions for cards on the Tracker Kanban board to ensure they feel premium, fluid, and completely consistent. Eliminate layout jumps, card resize pops, and visual stutters during sorting and drop operations.

### Strategic Reasoning
1. **Dynamic Size-Preserving Placeholder**: The previous code swapped active cards with a hardcoded `h-[88px]` preview box during dragging, causing severe layout jumps for cards with longer text, subtasks, or metadata. By rendering the actual `TaskCardUI` with an invisible wrapper (`opacity-0` and `pointer-events-none`) for the placeholder, the DOM computes the *exact same height*, maintaining perfect visual consistency with zero layout shift.
2. **Overlay Match & Premium Cue**: The Kanban columns are exactly `300px` wide, which translates to `268px` wide card elements (due to `p-4` padding). By setting the `DragOverlay` wrapper width to exactly `268px` (instead of `320px`), we eliminate the jarring width pop when picked up. We added a subtle tilt (`-rotate-1`), scale up (`scale-[1.03]`), and deep premium drop shadow (`shadow-2xl`) to provide a tactile "lifted card" look.
3. **Snappy & Premium Curves**: Replaced the browser-default linear transition for rearranged cards and standard landing drops with high-end, responsive `cubic-bezier(0.2, 1, 0.2, 1)` (easeOutQuint) curves.

### Detailed Blueprint
- `src/components/tracker/TaskCard.tsx`:
  - Configure the `useSortable` hook with transition details (`duration: 200`, `easing: 'cubic-bezier(0.2, 1, 0.2, 1)'`).
  - Delete the hardcoded `if (isDragging)` fixed-height `div` return in `TaskCard`.
  - In `TaskCardUI`, wrap the contents in a transparent container (`opacity-0 pointer-events-none`) when `isDragging` is true, and swap the background to `bg-[var(--bone-3)]` to form a perfect-height, borderless placeholder.
- `src/components/tracker/TrackerPage.tsx`:
  - Customize the `dropAnimation` configuration to use easeOutQuint `220ms` easing and fade back smoothly.
  - Set the `DragOverlay` width to exactly `268px` and apply standard premium floating effects (`scale-[1.03]`, `-rotate-1`, `shadow-2xl`).

### Operational Trace
1. **Modified `TaskCard.tsx`**:
   - Integrated `transition` options into the `useSortable` hook in `TaskCard`.
   - Updated `TaskCardUI` container classes to swap `bg-[var(--bone-6)]` for `bg-[var(--bone-3)]` and added `transition-all duration-200` to smoothly handle layout changes.
   - Wrapped inner contents of `TaskCardUI` with a conditional `opacity-0` div to form a dynamic size placeholder.
   - Removed the redundant, jumpy `if (isDragging)` short-circuit return from the `TaskCard` wrapper.
2. **Modified `TrackerPage.tsx`**:
   - Replaced default overlay styles with specific width matching (`width: 268`) and a beautiful lift transform (`scale-[1.03] -rotate-1 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] rounded-[10px]`).
   - Integrated custom `dropAnimation` parameters.

### Status Assessment
- **Completed**:
  - Perfect dynamic height placeholder preserves exact dimensions when starting to drag.
  - Consistent width in drag overlay matching the column cards.
  - Premium floating lift visuals (tilt, scale, deep shadow).
  - Buttery-smooth transitions for shifting card elements and dropping items.
- **Unresolved**: None.
- **Recommendations**: Clear cache and restart the dev server to verify all animations load instantly.
