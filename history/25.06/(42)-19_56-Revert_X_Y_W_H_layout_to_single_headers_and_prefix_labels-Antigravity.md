User request: "no need to do this, you can keepony one main title like position and then icons inside boxes, so remove W and H, but replace psotion icons with X and Y"

## Date and Time
25.06.2026 19:56

## Objective Reconstruction
Revert the custom layout modifications for Position and Dimensions fields in the right sidebar (`CanvasStylePanel.tsx`) according to the updated feedback:
1. Re-group X and Y inputs horizontally side-by-side directly under a single "Position" subtitle.
2. Remove individual "X" and "Y" labels from above the coordinate inputs, and restore the letter prefixes (`X` and `Y`) inside the boxes.
3. Re-group W and H inputs horizontally side-by-side directly under a single "Dimensions" subtitle.
4. Remove individual "W" and "H" labels from above the size inputs, keeping only the double-headed arrow icons inside the boxes.
5. Re-align the aspect ratio connection bridge line to center vertically relative to the input container (`top-1/2 -translate-y-1/2`).

## Strategic Reasoning
To match the user's specific layout preference:
- Removed the separate label headings (`X`, `Y`, `W`, `H`) above coordinates and dimensions, keeping only the single primary sub-headings (`Position`, `Dimensions`).
- Replaced the custom SVG icons for coordinate positions (X/Y) with bold textual prefixes (`X` and `Y`) within the input containers, ensuring readability.
- Retained the double-headed resize SVG icons for dimensions (Width/Height) directly inside the input boxes without "W" or "H" sub-labels.
- Centered the aspect-ratio bridge link and constrain button vertically relative to the input line to restore layout symmetry.

## Detailed Blueprint
- **`src/components/canvas/CanvasStylePanel.tsx`**:
  - Revert column structures for Position inputs, restoring side-by-side `SidebarInput` layout with text prefixes `X` and `Y`.
  - Revert column structures for Dimensions inputs, keeping `SidebarInput` fields with visual arrow icons side-by-side without labels `W` and `H`.
  - Re-align aspect ratio connector overlay center absolute position.

## Operational Trace
- Edited `src/components/canvas/CanvasStylePanel.tsx` using `multi_replace_file_content` to apply layout reverts.
- Checked project typecheck via `npx tsc --noEmit`.
- Verified test suite passes successfully with `npm test`.

## Status Assessment
- Layout reverted to one main title with icons/prefixes inside the boxes per the request.
- Rotation, Opacity, Corner radius, and Border weight styling remains intact as defined.
