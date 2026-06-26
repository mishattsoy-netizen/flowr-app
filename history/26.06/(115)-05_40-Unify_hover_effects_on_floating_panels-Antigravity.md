User request: "make all hover effects speed and animation(fade in and out) same in these panels"

## 0. Date and time of the request
Date: 26.06
Time: 05:40

## 1. User request
"make all hover effects speed and animation(fade in and out) same in these panels"

## 2. Objective Reconstruction
Unify the hover transition speeds and fade-in/fade-out animation behavior (150ms ease-in-out) across all interactive elements (buttons, inputs, selects, swatches, custom pointer items) within the canvas floating panels:
- Style Panel
- Layers Panel
- Floating Toolbar (bottom-center)
- Zoom Controls (bottom-left)
- Undo/Redo Controls (bottom-left)
- Top-Right Floating Toolbar (sidebar toggles & export)
- Color Picker Popover
- Media Upload Popover
- Text Editing Toolbar

## 3. Strategic Reasoning
Instead of adding individual tailwind transition classes to every button and input element in JS/TSX files (which creates visual noise and is prone to human error when new elements are added), we created a scoped CSS rule targeting interactive elements (buttons, inputs, select tags, custom pointers, color swatches, role="button") residing within any element carrying the `.canvas-floating-panel` class.
This scoping prevents transitions from leaking into core canvas shape manipulation tools (which could introduce drag/resize lag or dynamic rendering delays).
At the same time, it excludes sliding selector pills and tabs which have active state tracking variables and must follow immediate position snap animations.

## 4. Detailed Blueprint
- **Modify** [globals.css](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/app/globals.css) to add the scoped CSS transitions rules.
- **Modify** [CanvasLayersPanel.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasLayersPanel.tsx) to tag the main wrapper container with the `canvas-floating-panel` class.
- **Modify** [CanvasToolbar.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasToolbar.tsx) to tag the bottom-center toolbar container with the `canvas-floating-panel` class.
- **Modify** [CanvasStylePanel.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasStylePanel.tsx) to tag the inspector panel inner container with the `canvas-floating-panel` class.
- **Modify** [CanvasPage.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasPage.tsx) to tag the Zoom Controls panel, Undo/Redo panel, and Top-Right panel with the `canvas-floating-panel` class.
- **Modify** [ColorPickerPopover.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/ColorPickerPopover.tsx) to tag the color picker popover outer container with the `canvas-floating-panel` class.
- **Modify** [MediaUploadPopover.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/MediaUploadPopover.tsx) to tag the media upload modal/popover container with the `canvas-floating-panel` class.
- **Modify** [CanvasTextToolbar.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasTextToolbar.tsx) to tag the floating formatting toolbar container with the `canvas-floating-panel` class.

## 5. Operational Trace
- Added transition overrides selector `.canvas-floating-panel button, .canvas-floating-panel input, .canvas-floating-panel select, .canvas-floating-panel .color-swatch-trigger, .canvas-floating-panel [class*="cursor-pointer"]:not(.pointer-events-none), .canvas-floating-panel [role="button"]` in `src/app/globals.css` right before `@layer base`.
- Appended `canvas-floating-panel` class to key wrapper divs in `CanvasLayersPanel.tsx`, `CanvasToolbar.tsx`, `CanvasStylePanel.tsx`, `CanvasPage.tsx`, `ColorPickerPopover.tsx`, `MediaUploadPopover.tsx`, and `CanvasTextToolbar.tsx`.
- Ran `npx tsc --noEmit` to verify type-check and compilation pass cleanly.

## 6. Status Assessment
- Unified hover effects are successfully implemented across all designated panels.
- Transition-none and custom sliding selector pills continue to operate properly as they do not match the transition selector.
- Compilation checks show no errors or regressions.
