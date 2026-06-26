0. Date and time of the request: 25.06.2026 17:24

1. User request: "when i rotate, in the right sidebar, angle should actively change not only when i release. also when i rotate against the cloch, show negative angle. sam in the sidebar if -30, against the clock, if 30, with the clock"

2. Objective Reconstruction
- Support real-time customization sidebar updates:
  1. Dispatch block rotation state changes to the Zustand store dynamically during pointer move events so that the customization panel values update actively.
  2. Map rotation calculations to support negative angle values (range `[-180, 180]`) where clockwise rotations are positive and counterclockwise (against the clock) rotations are negative. Display matching signed values in both tooltips and sidebar controls.

3. Strategic Reasoning
- Triggering `updateCanvasBlock` on pointermove makes the store data reactive, forcing React to repaint the sidebar input box immediately.
- Converting rotation degrees greater than 180 to their negative counterparts (i.e. `deg - 360`) maps values cleanly to the `[-180, 180]` range for natural counterclockwise representations.

4. Detailed Blueprint
- **src/components/canvas/CanvasBlock.tsx**: Map rotation coordinates to `[-180, 180]` and trigger `updateCanvasBlock` inside the pointermove loop.
- **src/components/canvas/CanvasStylePanel.tsx**: Update the PropRow and input text parsers to normalize custom user values to the `[-180, 180]` range.

5. Operational Trace
- **CanvasBlock.tsx**: Added store updates to pointer move loops, set up negative angle checks, and formatted active labels.
- **CanvasStylePanel.tsx**: Updated the Angle field value normalizers.
- **Type checking**: Ran `npx tsc --noEmit` which completed successfully with 0 errors.

6. Status Assessment
- **Completed**: Angle inputs update live in the right sidebar, and negative/positive rotations render naturally based on clockwise direction.
