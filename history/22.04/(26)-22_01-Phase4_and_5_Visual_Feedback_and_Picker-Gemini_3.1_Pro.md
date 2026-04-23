User request: "proceed" (execute Phase 4 and Phase 5 of WIDGET_EDIT_MODE_PLAN.md)

## Objective Reconstruction
Implement the visual rendering and interaction layer for the new Bento Dashboard layout engine. This involves rewriting `BentoDashboard.tsx` to handle absolute positioning, fluid drag-and-drop animations, draggable ratio dividers, and CSS-based visual feedback.

## Strategic Reasoning
- **Absolute Positioning over CSS Grid/Flex:** While `react-grid-layout` was removed, relying solely on CSS Grid/Flex makes smooth transition animations nearly impossible without a heavy JS library. By translating the row-based layout into absolute `left`, `top`, `width`, and `height` properties via `computeGridPositions`, we achieve pixel-perfect layout while allowing native CSS `transition: all 0.3s cubic-bezier` to handle fluid sliding when widgets move.
- **Pointer Events:** HTML5 Drag and Drop limits control over ghost styling and drop indicators. Swapping to pure pointer events (`onPointerDown`, `onPointerMove`, `onPointerUp`) mapped to the `window` allows us to render our own drag ghost (a slightly scaled-up clone) and a drop placeholder underneath.
- **Draggable Dividers:** For rows with exactly 2 widgets, a 20px wide hit area is rendered over the gap. Dragging it updates the ratio of the two widgets smoothly.

## Detailed Blueprint & Operational Trace
1. **Rewrote `BentoDashboard.tsx`**:
   - `computeGridPositions(layout)`: translates abstract `row` and `order` into a virtual 6-column `x/y/w/h` grid for rendering.
   - Replaced flex rows with an `absolute` positioned system container.
   - Implemented pointer event listeners (`onPointerDown` on widgets, global `pointermove` for dragging).
   - Rendered a custom Drag Ghost and a Placeholder element when a widget is being dragged.
   - Implemented the Divider rendering and drag loop (`handleDividerDrag`).
2. **Updated `globals.css`**:
   - Added `@keyframes bento-jiggle` and `.bento-jiggle` class.
   - Set `.bento-widget-cell` to transition smoothly when not being actively dragged.
3. **Updated `WidgetPicker.tsx`**:
   - Updated helper text to specify "Click to add" instead of drag and drop.
4. **Updated `useBentoLayout.ts`**:
   - Swapped out the `sonner` toast (since it's not installed in the project) for a native `alert` when `findFirstFit` returns null (dashboard full).

## Status Assessment
- **Completed**: Phase 4 (Visual Feedback) and Phase 5 (Widget Picker updates).
- **TypeScript**: No new TS errors introduced. Compilation is clean.
- The core functionality of the new iOS-style widget edit mode is completely integrated. The architecture is fully decoupled from react-grid-layout and handles its own constraint-based math. 
- **Next Recommendation**: The system is ready for testing. Run the dev server, toggle Edit Mode, and test dragging, reordering, and resizing widgets using the dividers. Phase 6 (Stacking) was deferred in the plan.
