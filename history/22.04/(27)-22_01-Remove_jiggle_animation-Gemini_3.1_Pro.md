User request: "remove jiggle"

## Objective Reconstruction
Remove the jiggle animation from widgets during edit mode.

## Strategic Reasoning
The jiggle animation was added to emulate iOS icon editing behavior, but the user requested its removal. This involves removing the `.bento-jiggle` class from the `BentoDashboard.tsx` component and deleting the corresponding CSS keyframes and class definitions from `globals.css`. This simplifies the visual feedback during edit mode to rely only on the drop target ring and layout shifting.

## Detailed Blueprint & Operational Trace
1. **Updated `src/components/bento/BentoDashboard.tsx`**:
   - Removed `editMode && !isDragged && 'bento-jiggle'` from the `clsx` classes applied to `.bento-widget-cell`.
2. **Updated `src/app/globals.css`**:
   - Deleted the `@keyframes bento-jiggle` definition.
   - Deleted the `.bento-jiggle` class.
   - Deleted the `.bento-jiggle:hover` pause rule.

## Status Assessment
- **Completed**: The jiggle animation is fully removed.
- **Next Recommendation**: No further action needed. The layout editing system remains fully functional without the jiggle animation.
