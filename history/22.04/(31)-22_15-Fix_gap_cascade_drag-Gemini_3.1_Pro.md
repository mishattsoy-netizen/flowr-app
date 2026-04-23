User request: "it doesnt work properly, ti should move whole gap linke, not oly fot the first row"

## Objective Reconstruction
Fix the divider drag preview so that adjusting a spanner widget (like the `h=2` Tasks widget) automatically and live-resizes any dependent widgets underneath it (like Shortcuts) to keep the vertical gap perfectly aligned across multiple rows.

## Strategic Reasoning
The issue was that `handleDividerDragPreview` was previously ONLY updating the widths of the two widgets on the dragged row, and it wasn't running the layout engine's `rebalanceAll()` logic during the live drag preview. Thus, the widget underneath (Shortcuts) didn't realize the spanner (Tasks) had resized until the user let go of the mouse.

Additionally, `rebalanceRow` inside `bento-engine.ts` had a logic flaw where it forced any 2-widget row perfectly back to a 50/50 (`3` and `3`) split every time `rebalanceAll` ran, which destroyed the user's manual ratio changes upon dropping the divider.

## Detailed Blueprint & Operational Trace
1. **Engine Fix (`src/lib/bento-engine.ts`)**:
   - Updated `rebalanceRow` so that if the current items already perfectly sum to the available total space, it skips overriding them. This preserves the user's manual drag ratios permanently.
2. **Live Cascade Preview (`src/hooks/useBentoLayout.ts`)**:
   - Updated `handleDividerDragPreview` to wrap the `adjustDivider` result in `compactLayout(rebalanceAll())`. This forces the entire dashboard to recalculate on every pixel of the drag. Now, when a spanner widget resizes, any native widget on the row below it instantly auto-fills the remaining space, making the "whole gap line" move seamlessly as a single united column edge.

## Status Assessment
- **Fixed**: The layout engine now correctly propagates column ratio changes down through all rows during the live drag preview, maintaining perfect vertical gap alignment.
- **Next Recommendation**: None required.
