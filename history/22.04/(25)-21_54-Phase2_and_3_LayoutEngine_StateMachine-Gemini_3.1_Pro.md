User request: "continue" (execute Phase 2 and 3 of WIDGET_EDIT_MODE_PLAN.md)

## Objective Reconstruction
Implement the core logic for the new iOS-style widget edit mode. This involves creating the layout engine (Phase 2) to handle spatial math and the state machine (Phase 3) to manage drag lifecycles, dwell timers, and history (undo/redo).

## Strategic Reasoning
- `bento-engine.ts` handles pure spatial calculations: row constraints, gravity (compaction), width rebalancing, push displacement, and swap mechanics.
- `useBentoLayout.ts` consumes the engine to handle user interaction: pointer drag states, 300ms dwell timers to trigger swaps, and maintaining the history stack for undo/redo.
- This separation of concerns ensures that the math is isolated and testable while the React hooks handle UI rendering and transitions.

## Detailed Blueprint & Operational Trace
1. **Created** `src/lib/bento-engine.ts`:
   - `rebalanceRow` / `rebalanceAll`: ensures all occupied rows sum exactly to 3 columns (6 half-cols).
   - `compactLayout`: implements "gravity" to remove empty rows and shift widgets up.
   - `calculateSwapLayout`: performs position swaps between widgets and triggers rebalancing.
   - `calculatePushLayout`: implements displacement when inserting a widget.
   - `snapDivider` / `adjustDivider`: math for draggable ratio dividers between 2-widget rows.
   - `findFirstFit` / `canFit`: scans for available row capacity for new widgets.
2. **Rewrote** `src/hooks/useBentoLayout.ts`:
   - Implemented `commitLayout` to push history to the undo stack.
   - Added `draggedId`, `previewLayout`, `swapTargetId` state variables.
   - Added `handleDragStart`, `handleDragOverWidget`, `handleDragOverEmpty`, `handleDragEnd`.
   - Added `dwellTimerRef` to enforce the 300ms delay before previewing a swap or push.
   - Added keyboard listeners for `Ctrl+Z` (undo) and `Ctrl+Y` (redo).

## Status Assessment
- **Completed**: Phase 2 (Layout Engine) and Phase 3 (State Machine).
- **TypeScript**: No new errors introduced.
- **Next**: Phase 4 (Visual Feedback) to build the custom CSS Grid in `BentoDashboard.tsx`, implement the GSAP animations, and add the draggable dividers.
