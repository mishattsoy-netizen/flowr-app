User request: "all boxes with value must have some icons inside for example add this to border weight, also box title must sit above it, same as Position, rotation, Dimensions and others"

## Date and Time
25.06.2026 19:53

## Objective Reconstruction
Update the styling of the right property sidebar (`CanvasStylePanel.tsx`) so that:
1. Every input field containing a numeric or text value has a visual SVG icon prefix inside the input container instead of letters.
2. Individual labels/titles for each coordinate and size (X, Y, W, H) are positioned directly above the input boxes, aligning with the existing patterns for Opacity, Corner radius, Rotation, and Border Weight.
3. The custom stacked-bars border weight prefix icon is updated with rounded linecaps matching the user's mockup image exactly.

## Strategic Reasoning
To create a premium, consistent visual identity across the styling sidebar:
- Replaced the textual prefixes ("X", "Y", "W", "H") inside coordinates and size input fields with descriptive, clean SVG vectors (e.g., origin-axis offsets for X/Y coordinates, and double-headed resize arrows for width/height).
- Split the inputs for X/Y and W/H into separate columns, adding small `font-ui-label` captions above each.
- Centered the aspect-ratio bridge connector line vertically relative to the input fields by computing its static top alignment coordinate (`top-[28px]`).
- Refined the Border Weight lines by introducing `strokeLinecap="round"` to render three stacked capsules instead of flat lines.

## Detailed Blueprint
- **`src/components/canvas/CanvasStylePanel.tsx`**:
  - Re-align X and Y coordinates with separate label containers and new custom SVG prefix icons.
  - Re-align Width (W) and Height (H) inputs with separate labels above them, visual SVG prefix icons, and adjust the absolute positioning coordinates of the aspect lock link bridge.
  - Apply `strokeLinecap="round"` to the stacked-bars SVG vector under the border Weight input field.

## Operational Trace
- Edited `src/components/canvas/CanvasStylePanel.tsx` with `multi_replace_file_content` to apply structural layout and icon enhancements.
- Verified TypeScript type safety by running `npx tsc --noEmit`.
- Validated all tests pass successfully using `npm test`.

## Status Assessment
- Redesign of value inputs and visual icon/label alignment has been successfully completed.
- Sidebar sections render correctly, and coordinate inputs retain their full interactive dragging/scrubbing behaviors.
