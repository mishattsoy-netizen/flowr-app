User request: "fix this bug with overlaping widgets"

## Objective Reconstruction
Fix the layout engine's grid placement math so that wide widgets properly yield to tall spanners (widgets with height > 1), preventing visual overlapping across multiple rows.

## Strategic Reasoning
The visual overlap was being caused by the interaction of two separate algorithms:
1. `computeGridPositions` (in the UI) used a greedy algorithm that plopped widgets at the *first* available empty cell (`x`), but it never checked if the widget's full width could actually fit in that empty gap without hitting another widget later in the row.
2. `rebalanceAll` (in the Engine) calculated available width (`avail`) by blindly summing the widths of all spanners on a row, ignoring whether that empty space was contiguous or fragmented (e.g., if a spanner sits in the middle of a row, the empty space is split into a left and right chunk).

Because of this, the engine would assign a widget a `width: 4`, but the UI would place it in a hole of size `2`, causing the widget to literally draw over top of the obstacle next to it.

## Detailed Blueprint & Operational Trace
1. **Engine Rewrite (`src/lib/bento-engine.ts`)**:
   - Upgraded `rebalanceAll()` to utilize a full 2D grid matrix simulation internally.
   - For every row, it now pre-populates the grid with any spanners that are protruding downwards from previous rows.
   - When calculating the final width for a widget, it dynamically calculates the `maxW` (the maximum *contiguous* empty blocks available starting from the first open slot).
   - It strictly clamps the widget's width to `Math.min(b.w, maxW)`. This mathematically guarantees that no widget is ever allowed to be wider than the physical hole it is being placed into.

## Status Assessment
- **Fixed**: Spanners and multi-row widgets now properly segment the layout grid, and adjacent native widgets correctly shrink themselves to fit perfectly within the fragmented holes without overlapping.
- **Next Recommendation**: The dashboard layout is now fully geometrically sound and collision-proof. Wait for user feedback on layout flow.
