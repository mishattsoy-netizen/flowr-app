User request: "soze should be first"

### 0. Date and time of the request
Date: 26.06.2026
Time: 05:12

### 1. User request
"soze should be first"

### 2. Objective Reconstruction
Reorder the boxes inside the "Arrowheads" control row on the canvas style sidebar to place the `Size` input first, followed by `Start` and `End` dropdowns.

### 3. Strategic Reasoning
- The user requested swapping the order of the inputs so that Arrowhead Size is shown first. This makes the row structure: [ Size | Start | End ], which groups style configurations logically.

### 4. Detailed Blueprint
- Modify `src/components/canvas/CanvasStylePanel.tsx`:
  - Within the Arrowheads `PanelSection`, swap the DOM order of the child divs representing Size, Start, and End.

### 5. Operational Trace
- Reordered the DOM elements inside `src/components/canvas/CanvasStylePanel.tsx`.
- Ran compiler checks via `npx tsc --noEmit` which succeeded with no errors.

### 6. Status Assessment
- Successfully reordered Arrowheads layout to size-first: [ Size | Start | End ].
- Checked compilation and all checks passed.
