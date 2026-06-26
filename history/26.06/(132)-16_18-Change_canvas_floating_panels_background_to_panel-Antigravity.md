Date and Time: 26.06.2026 16:18

User request: "change bg color of all manels in canvas to panel"

### 2. Objective Reconstruction
The objective is to change the background color of all floating panels in the canvas view (including zoom controls, undo/redo controls, bottom toolbar, style panel, layers panel, text formatting toolbar, and color picker popover) to be panels (`bg-panel` / `var(--app-panel)`) instead of sidebar elements (`bg-sidebar` / `var(--sys-color)`).

### 3. Strategic Reasoning
To provide consistency across the canvas page, all floating panels should use the lighter/brighter panel theme background (`var(--app-panel)` or `bg-panel`) rather than matching the sidebar background (`var(--sys-color)` / `bg-sidebar`). This change updates all occurrences of `bg-sidebar` and `var(--sys-color)` inside the canvas UI elements to `bg-panel` / `var(--app-panel)`.

### 4. Detailed Blueprint
- Locate all canvas components (`CanvasPage.tsx`, `CanvasLayersPanel.tsx`, `CanvasStylePanel.tsx`, `CanvasToolbar.tsx`, `CanvasTextToolbar.tsx`, `ColorPickerPopover.tsx`).
- Replace `bg-sidebar` with `bg-panel` (preserving opacity overlays like `bg-sidebar/98` -> `bg-panel/98`).
- Replace `var(--sys-color)` with `var(--app-panel)`.

### 5. Operational Trace
- Edited [CanvasPage.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasPage.tsx#L1042-L1097):
  - Changed `bg-sidebar/98` to `bg-panel/98` (zoom controls, undo/redo controls).
  - Changed `bg-sidebar` to `bg-panel` (top right floating toolbar).
- Edited [CanvasToolbar.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasToolbar.tsx#L98):
  - Changed `bg-sidebar` to `bg-panel` (bottom toolbar).
- Edited [CanvasTextToolbar.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasTextToolbar.tsx#L99):
  - Changed `bg-sidebar/95` to `bg-panel/95` (floating text format toolbar).
- Edited [CanvasStylePanel.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasStylePanel.tsx#L697):
  - Changed style background `'var(--sys-color)'` to `'var(--app-panel)'`.
- Edited [CanvasLayersPanel.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasLayersPanel.tsx#L111):
  - Changed style background `'var(--sys-color)'` to `'var(--app-panel)'`.
- Edited [ColorPickerPopover.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/ColorPickerPopover.tsx#L294-L298):
  - Changed `var(--sys-color)` to `var(--app-panel)` in `bg-color-mix` and inline background styles.

### 6. Status Assessment
- All floating canvas panels now successfully use the panel background.
