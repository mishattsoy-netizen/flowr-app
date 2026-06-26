Date: 25.06.2026 19:23

User request: "when i alighnt shapes and both are same size, i want all three snap lines to show(one edge, center and second edge).  current;y only one line is visible one edge or other."

## Objective Reconstruction
When aligning two shapes of identical dimensions on the canvas, draw and render all matching alignment guide lines (left edge, center, and right edge for vertical guides; or top edge, center, and bottom edge for horizontal guides) simultaneously, rather than rendering only one of them.

## Strategic Reasoning
The previous snapping hook was checking alignments on a single pass, updating local variables inside a loop, which meant only one guide was returned. 
By decoupling the snap alignment into a clean two-pass model:
1. **Pass 1**: Scan all blocks to locate the absolute closest snapped X and Y coordinates globally using `minDiffX` and `minDiffY`.
2. **Pass 2**: Scan blocks again and collect every single alignment check that resolves within a tiny tolerance (`< 0.01`) of the final coordinates.
This design automatically identifies when multiple edges/centers align (since their math resolves identically for same-size shapes) and generates all three guides in parallel. It also prevents snapping coordinates from flickering or stuttering since `minDiff` is tracked globally.

## Detailed Blueprint
- **`src/hooks/useCanvasSnap.ts`**:
  - Refactored `snapWithObjects` to track `minDiffX` / `minDiffY` globally.
  - In Pass 2, check for alignments at the final snapped coordinate.
  - Push matching guides to the guides array.

## Operational Trace
- Edited `src/hooks/useCanvasSnap.ts` to implement the two-pass snap guide collector.
- Corrected double return statements and trailing brackets at the end of the file.
- Ran `npx tsc --noEmit` to verify TypeScript compile checks.
- Ran `npm test` to verify unit tests.

## Status Assessment
- Snapping now renders multiple guides concurrently when dragging identical-sized blocks.
- Overall dragging remains highly responsive and free of jitter.
