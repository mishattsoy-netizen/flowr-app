Date and Time: 26.06.2026 16:32

User request: "next to the save/export button add copt to clipboard. use default settgins for these buttons: 2x screen horizontal, background color on"

### 2. Objective Reconstruction
The objective is to add a "Copy to Clipboard" button next to the Export (Download) button on the top-right floating toolbar on the canvas page, and configure both buttons to use default quick settings: 2x scale (pixelRatio: 2), screen aspect ratio, horizontal orientation, and background fill enabled.

### 3. Strategic Reasoning
- Quick toolbar buttons are designed for fast actions, so they should use high-quality default export presets (2x, screen ratio, horizontal, bg-on) rather than being tied to the custom configurations selected in the style sidebar (which are intended for detailed preview-based export configuration).
- Importing `copyCanvasToClipboard` in `CanvasPage.tsx` allows the toolbar copy button to directly generate and copy the upscaled canvas PNG image to the system clipboard.
- Re-configuring both toolbar buttons to use the hardcoded presets ensures they function correctly independently of the style panel's state.

### 4. Detailed Blueprint
- Import `copyCanvasToClipboard` from `@/lib/canvasExport` in `CanvasPage.tsx`.
- Update the floating toolbar "Export PNG" button in `CanvasPage.tsx` to always use fixed defaults: scale 2, screen ratio, horizontal, and bg-on.
- Append a "Copy to Clipboard" button right next to the "Export PNG" button on the toolbar, using the `Copy` icon and invoking `copyCanvasToClipboard` with the same quick defaults.

### 5. Operational Trace
- Edited [CanvasPage.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasPage.tsx#L20):
  - Changed `exportCanvasToPng` import to include `copyCanvasToClipboard`.
- Edited [CanvasPage.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasPage.tsx#L1150-L1190):
  - Changed "Export PNG" click configuration to hardcoded presets: `pixelRatio: 2`, `backgroundColor: bg`, `format: 'png'`, `ratio: 'screen'`, `orientation: 'horizontal'`.
  - Added "Copy to Clipboard" button calling `copyCanvasToClipboard` with the same preset options.

### 6. Status Assessment
- Verified that both quick buttons on the toolbar perform as expected with 2x scale, screen ratio, horizontal orientation, and background on.
