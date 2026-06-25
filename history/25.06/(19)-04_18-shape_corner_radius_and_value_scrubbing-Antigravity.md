0. Date and time of the request: 25.06.2026 04:18

1. User request: "default corner radius for the shapes with sharp corners must be 20. also add feature: in the fields like Radius, width, Position, Height... add ability for me to click on it and drag left or right to increase number to the right or decrease on the left"

2. Objective Reconstruction
- Change the default corner radius for shape block creations with sharp corners (e.g. rectangles) to 20px.
- Implement an interactive click-and-drag scrubbing mechanism (similar to Blender/Figma value scrubbing) on numeric input labels (Width, Height, Border Width, Corner Radius) and inline coordinate headers (X, Y) so dragging left or right decrements or increments their respective styles.

3. Strategic Reasoning
- **Default State Adjustment**: Transitioning the default corner radius configuration to 20px inside the global `activeStyle` state directly configures newly drawn rectangular shapes with rounded borders.
- **Scrubbing Interactivity via Pointer Event Delta**: Rather than introducing heavy wrapper layout sliders, we bind a pointerdown gesture listener to input labels. Movement updates track delta mouse movements (`dx`) mapped to active setters, setting the body cursor to `ew-resize` for clear feedback.
- **Explicit Inline Position Scrubbers**: Since X and Y coordinates share a single row labeled "Position", we split the position inputs to sit side-by-side with separate, explicit, interactive "X" and "Y" prefix tags that scrub their respective positions independently, solving structural ambiguity.

4. Detailed Blueprint
- **CanvasPage.tsx**: Update `activeStyle` state initialization default value for `cornerRadius` to `20`.
- **CanvasStylePanel.tsx**:
  - Add optional `scrub` configuration to `PropRow` arguments interface.
  - Implement dragging calculations: bind pointer events inside `PropRow`'s label span to monitor pointer offsets and feed values back to parent hooks.
  - Apply scrubbing configuration parameters to the **Width**, **Height**, border **Width**, and **Radius** rows.
  - Restructure the **Position** inputs: replace string-prefixed formatting values (`X  ` and `Y  `) with raw numbers, placing inline interactive "X" and "Y" spans alongside each input field respectively.

5. Operational Trace
- **CanvasPage.tsx**:
  - Changed default `cornerRadius` in `activeStyle` state hook from `0` to `20`.
- **CanvasStylePanel.tsx**:
  - Bound mouse pointer movement tracking to update local and store coordinates/radius details.
  - Restructured the Size panel fields, attaching `scrub` properties to Width and Height rows.
  - Re-implemented the Position row to display separate `X` and `Y` input sections with custom scrub listeners on their inline labels.
  - Attached scrubbing configurations to border strokeWidth and cornerRadius rows.
- **Type Checking**:
  - Successfully ran `npx tsc --noEmit` and resolved all type parameters with zero errors.

6. Status Assessment
- **Completed**:
  - Default corner radius (20px) for rectangular shapes.
  - Label drag-to-scrub adjustments for Width, Height, Radius, and border Width.
  - Inline scrubbable X and Y prefix tags for shape coordinates.
  - Clear coordinate formatting with clean numeric parsing.
