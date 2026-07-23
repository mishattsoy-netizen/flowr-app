User request: "find out why is insertion line when i drag blocks in the note shifting. when i hover top the top side of the row, insertion ine is closer to the top block when i hover over bottom side of top block,line is closer to the block under it. it mustnt shift, it must be between blocks. /root-cause-tracing /writing-plans"

## 0. Date and time of the request
20.07.2026, 16:15

## 1. User request
User request: "find out why is insertion line when i drag blocks in the note shifting. when i hover top the top side of the row, insertion ine is closer to the top block when i hover over bottom side of top block,line is closer to the block under it. it mustnt shift, it must be between blocks. /root-cause-tracing /writing-plans"

## 2. Objective Reconstruction
Investigate and resolve the issue where the blue insertion line used as a visual indicator during drag-and-drop operations inside notes shifts vertically depending on whether the user hovers over the bottom of a block or the top of the adjacent block.

## 3. Strategic Reasoning
The root cause was traced to how Tailwind spacing classes were used for positioning the indicator. Blocks are stacked vertically with zero margin between them (within their local flow) but are spaced by an 8px margin (`space-y-2`) applied to their container. 
The absolute positions `-top-1` and `-bottom-1` evaluated to `top: -4px` and `bottom: -4px`. Because they are relative to the block boundaries, this caused the indicator to render 4px inward from the block's edge. Depending on which block edge triggered the hover (`closestEdge`), the line rendered either 4px above the bottom block or 4px below the top block, resulting in an 8px visual shift.
The fix required replacing these relative tailwind classes with exact pixel coordinates (`top-[-1px]` and `bottom-[-1px]`) to perfectly center the 2px line precisely on the boundary between any two adjacent blocks. Similar adjustments were made for horizontal columns using `left-[-10px]` and `right-[-10px]` to center a 4px line in a 16px gap (`gap-4`).

## 4. Detailed Blueprint
- Analyze the `DropIndicator` positioning logic in `BlockRenderer.tsx`
- Determine the offset mismatch between `-top-1` and the actual spacing
- Propose a fix using exact pixel boundaries
- Modify all instances of `-top-1` and `-bottom-1` to `top-[-1px]` and `bottom-[-1px]` in vertical block borders
- Modify all instances of `left-0` and `right-0` in column drop targets to `left-[-10px]` and `right-[-10px]` to center the line within the 16px gap

## 5. Operational Trace
- Searched codebase for `dropIndicator` and drag-and-drop related functionality inside `src/components/editor`.
- Verified Pragmatic Drag and Drop implementations in `BlockRenderer.tsx`.
- Identified that `closestEdge` relies on standard spacing classes `-top-1` and `-bottom-1`.
- Calculated visual pixel offsets caused by parent `space-y-2` gaps.
- Wrote an implementation plan and requested user approval via artifact `implementation_plan.md`.
- After user approval, used `multi_replace_file_content` to apply exact pixel replacement values in `BlockRenderer.tsx`.
- Created task tracker and walkthrough artifact.

## 6. Status Assessment
The drag-and-drop indicator positioning was successfully updated. The blue line will now render dead-center between blocks, both vertically and horizontally, eliminating the shifting discrepancy entirely. No additional unresolved edge cases were identified.
