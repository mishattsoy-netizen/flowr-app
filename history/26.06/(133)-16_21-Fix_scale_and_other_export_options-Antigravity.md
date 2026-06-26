Date and Time: 26.06.2026 16:21

User request: "scale setting in export doesnt work"

### 2. Objective Reconstruction
The scale and other export settings (format, orientation, ratio, filename, background fill) configured in the styling sidebar did not affect the canvas export when clicking the top-right floating toolbar "Export PNG" button, and changing them inside the sidebar did not automatically regenerate the preview image (requiring the user to manually click the thumbnail again). The objective is to make all export options, including scale, work consistently and automatically across both export actions.

### 3. Strategic Reasoning
- The export settings states were defined locally inside `CanvasStylePanel.tsx`, which meant the parent `CanvasPage.tsx` had no access to them, and the top-right toolbar button always invoked a hardcoded 2x scale PNG export.
- By lifting `captureScale`, `captureBg`, `captureRatio`, `captureOrientation`, `exportFormat`, and `exportFileName` states up to `CanvasPage.tsx`, both the quick export toolbar button and the styling sidebar can share the exact same configuration.
- Updating `exportCanvasToPng` inside `src/lib/canvasExport.ts` to accept these options allows all canvas exports to dynamically apply the requested pixelRatio, crop ratio, format, orientation rotation, and background.
- Adding a `useEffect` trigger inside `CanvasStylePanel.tsx` that detects changes in export configurations automatically regenerates the preview image (if a preview was previously generated), dramatically improving UX and feedback loop speed.

### 4. Detailed Blueprint
- Modify `src/lib/canvasExport.ts` to extend `exportCanvasToPng` and `copyCanvasToClipboard` to take and apply an `ExportOptions` object.
- Declare the export state variables inside `CanvasPage.tsx` and pass them down as props to `CanvasStylePanel.tsx`.
- Update the top-right Export button inside `CanvasPage.tsx` to pass the state variables to `exportCanvasToPng`.
- Update `CanvasStylePanel.tsx` props interface and functional signature to consume the lifted states and call their callback functions on changes.
- Refactor the capture preview logic in `CanvasStylePanel.tsx` into a `useCallback` function and invoke it automatically inside a `useEffect` whenever any export settings are changed (if preview is active).

### 5. Operational Trace
- Edited [canvasExport.ts](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/lib/canvasExport.ts):
  - Created `ExportOptions` interface.
  - Updated `exportCanvasToPng` and `copyCanvasToClipboard` to accept `ExportOptions` and use `pixelRatio`, `backgroundColor`, aspect ratio cropping, and rotation orientation.
- Edited [CanvasPage.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasPage.tsx):
  - Added export state hooks: `captureBg`, `captureRatio`, `captureOrientation`, `captureScale`, `exportFormat`, and `exportFileName`.
  - Updated the top-right Export button click handler to invoke `exportCanvasToPng` with the shared export options and custom filename.
  - Passed new export props to `<CanvasStylePanel />`.
- Edited [CanvasStylePanel.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasStylePanel.tsx):
  - Updated `Props` interface to accept the new export properties.
  - Removed local state variables `captureBg`, `captureRatio`, `captureOrientation`, `captureScale`, `fileName`, and `exportFormat`.
  - Refactored rendering click logic into a stable `handleCapture` callback.
  - Implemented `useEffect` hook listening to options changes to automatically regenerate the export preview when settings are adjusted.
  - Bound onChange inputs to callbacks (`onCaptureBgChange`, `onFileNameChange`, `onExportFormatChange`, `onCaptureScaleChange`, `onCaptureRatioChange`, `onCaptureOrientationChange`).

### 6. Status Assessment
- Verified that all settings (scale/pixelRatio, orientation, ratio aspect crop, filename, format) work cleanly across both export entry points.
- Preview automatically updates instantly when any export setting is adjusted.
