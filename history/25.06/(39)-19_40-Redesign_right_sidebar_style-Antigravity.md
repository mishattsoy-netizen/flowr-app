Date: 25.06.2026 19:40

User request: "change right sidebar style to this: [images]"

## Objective Reconstruction
Redesign the right property sidebar (`CanvasStylePanel.tsx`) and underlying layout components to match the layout mocks:
1. Re-align layout dimensions into W and H inputs with an aspect-ratio bridge connector overlay and a toggle constrain button.
2. Group Position inputs X and Y side-by-side with internal labels.
3. Align Rotation Angle input alongside a control group for preset actions (Rotate 90°, Flip Horizontal, Flip Vertical).
4. Place Opacity and Corner radius inputs side-by-side with top labels.
5. Implement Flip Horizontal, Flip Vertical, and persistent aspect ratio locking constraints.

## Strategic Reasoning
To match the Figma-style design in the screenshots:
- Created a reusable `SidebarInput` component embedding prefixes (`X`, `Y`, `W`, `H`) or custom SVGs (Angle, Opacity, Corner radius) directly within dark rounded background wrappers.
- Added `flipH`, `flipV`, and `aspectRatioLocked` to the `CanvasStyleExt` type.
- Modified block and shape transform calculations to apply horizontal/vertical scale flips.
- Implemented aspect ratio constraint calculations inside `CanvasBlock.tsx` resizing handlers to enforce proportional scaling on corner and side handles when aspect locking is toggled.

## Detailed Blueprint
- **`src/data/store.types.ts`**: Define new boolean fields `flipH`, `flipV`, and `aspectRatioLocked` in the `CanvasStyleExt` type.
- **`src/components/canvas/CanvasBlock.tsx`**: Support scaling flips and aspect-ratio scaling logic.
- **`src/components/canvas/CanvasShapeLayer.tsx`**: Support scaling flips on shape layers.
- **`src/components/canvas/CanvasStylePanel.tsx`**: Implement custom prefix inputs, control group buttons, and layout sections.

## Operational Trace
- Added the new style fields to `src/data/store.types.ts`.
- Modified transforms and resizing math in `src/components/canvas/CanvasBlock.tsx`.
- Modified SVG group transform attributes in `src/components/canvas/CanvasShapeLayer.tsx`.
- Replaced properties panel sections and inputs in `src/components/canvas/CanvasStylePanel.tsx`.
- Ran `npx tsc --noEmit` and verified compile-safety (successful).
- Ran unit tests with `npm test` (118 tests passed successfully).

## Status Assessment
- Property sidebar redesigned completely according to the mockups.
- Scale flips and aspect ratio locks are fully functional.
