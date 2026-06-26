User request: "rename border secion to stroke. and by default when i create new shame(not customized)->1px stroke"

### 0. Date and time of the request
Date: 26.06.2026
Time: 05:20

### 1. User request
"rename border secion to stroke. and by default when i create new shame(not customized)->1px stroke"

### 2. Objective Reconstruction
1. Rename the "Border" section title in the canvas style sidebar to "Stroke".
2. Change the default stroke width of newly created shapes (and arrow/line connections) from `2px` to `1px`.

### 3. Strategic Reasoning
- The user requested aligning the nomenclature with Figma by renaming the "Border" panel section to "Stroke".
- To make default shapes and lines cleaner and more elegant, their starting stroke weight was changed from `2px` to `1px`.

### 4. Detailed Blueprint
- Modify `src/components/canvas/CanvasStylePanel.tsx`:
  - Change `<PanelSection title="Border">` to `<PanelSection title="Stroke">`.
- Modify `src/components/canvas/CanvasPage.tsx`:
  - Change default `strokeWidth` in `activeStyle` state initialization from `2` to `1`.
  - Change default `strokeWidth` in drawn connection line (`canvasStyleExt`) configuration from `2` to `1`.

### 5. Operational Trace
- Replaced the section title in `CanvasStylePanel.tsx`.
- Updated default state and block parameters in `CanvasPage.tsx`.
- Ran compiler checks (`npx tsc --noEmit`) which succeeded with no errors.

### 6. Status Assessment
- Successfully renamed the sidebar section to "Stroke" and set the default stroke width for new shapes and lines to 1px.
- Checked project build integrity and all validation checks passed.
