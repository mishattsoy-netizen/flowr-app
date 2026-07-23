User request: "make insert line smoother, nt instant snap. but not too slow"

## 0. Date and time of the request
21.07.2026, 05:37

## 1. User request
User request: "make insert line smoother, nt instant snap. but not too slow"

## 2. Objective Reconstruction
Animate the drag-and-drop indicator line so that it appears smoothly (e.g. fading in) and transitions its position softly instead of immediately snapping when hovering over drop targets. 

## 3. Strategic Reasoning
- The drop indicators are rendered per-block as conditional `div` elements or CSS borders based on Pragmatic Drag and Drop's `closestEdge` state.
- When crossing a block boundary, one block unmounts its indicator and the next one mounts its indicator.
- To make this unmounting/mounting feel less like a harsh "snap," we can apply Tailwind's `animate-in fade-in` classes so each new line quickly fades into view.
- When `closestEdge` flips from `top` to `bottom` within the same block, the element stays mounted but its `top/bottom` classes toggle. A `transition-all duration-200` ensures this movement glides smoothly.
- The `duration-200` (200ms) hits the sweet spot for UI animations—smooth but not sluggish.

## 4. Detailed Blueprint
- `src/components/editor/BlockRenderer.tsx`: Update all 8 horizontal indicator `div`s and 1 vertical indicator `div` to include `transition-all duration-200 animate-in fade-in` in their `className`.
- `src/components/editor/TableBlock.tsx`: Add `transition-all duration-200` to the table row classes that activate when `closestEdge` is `top` or `bottom`.

## 5. Operational Trace
- Used batched search-and-replace to add the transition utilities to all `bg-[var(--brand-blue)] rounded-full` drop indicators in `BlockRenderer.tsx`.
- Applied the same transition logic to the table drag borders in `TableBlock.tsx`.

## 6. Status Assessment
Completed. The drag insertion line now has a smooth 200ms fade-in and position transition, fulfilling the user's request for a smoother but responsive drag-and-drop experience.
