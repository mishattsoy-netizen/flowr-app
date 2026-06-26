User request: "rename opacity & corners to apearance"

### 0. Date and time of the request
Date: 26.06.2026
Time: 05:21

### 1. User request
"rename opacity & corners to apearance"

### 2. Objective Reconstruction
Rename the "Opacity & Corner" section header in the canvas style sidebar panel to "Appearance".

### 3. Strategic Reasoning
- The user requested renaming the header to "Appearance" to match Figma's standard layout grouping.

### 4. Detailed Blueprint
- Modify `src/components/canvas/CanvasStylePanel.tsx`:
  - Locate the `PanelSection` with title `"Opacity & Corner"`.
  - Replace it with title `"Appearance"`.

### 5. Operational Trace
- Renamed the header title inside `src/components/canvas/CanvasStylePanel.tsx`.
- Confirmed compilation builds cleanly using `npx tsc --noEmit`.

### 6. Status Assessment
- Section title successfully updated to "Appearance".
- Compilation checked out clean.
