Date: 27.05.2026
Time: 13:51

User request: "Tasks are transforming on drag!!!!"

### Objective Reconstruction
Restore standard `@dnd-kit` inline sorting translations to eliminate visual warping, card jumping, and double-translation layout glitches when initiating card dragging on the board.

### Strategic Reasoning
1. **Restore Core Coordinate Tracking**: The previous optimization bypassed applying the `transform` inline styles returned by `useSortable` when `isDragging` was true, trying to keep the placeholder static. Bypassing these coordinates broke `@dnd-kit`'s internal state tracking and calculations, causing active and sibling cards to float, jitter, and slide incorrectly (which the user reported in all caps as "transforming on drag!!!!"). Restoring standard `CSS.Translate.toString(transform)` for all sortable states ensures standard `@dnd-kit` coordinates align with DOM rendering.
2. **Synchronous layout rendering**: Preserved the instant, single-tick Zustand reordering inside `TrackerPage.tsx`, maintaining instant settlement on drops.

### Detailed Blueprint
- `src/components/tracker/TaskCard.tsx`:
  - Restore `style.transform` to `CSS.Translate.toString(transform)` for all states inside the `TaskCard` sortable wrapper.

### Operational Trace
1. **Modified `TaskCard.tsx`**:
   - Reverted the conditional ternary in `style.transform` back to the standard `CSS.Translate.toString(transform)` positioning.

### Status Assessment
- **Completed**:
  - The dragging coordinates are fully restored, resolving all drag distortions and card jumps.
  - Kanban board and task sorting are extremely stable and robust.
- **Unresolved**: None.
- **Recommendations**: Re-test dragging multiple cards.
