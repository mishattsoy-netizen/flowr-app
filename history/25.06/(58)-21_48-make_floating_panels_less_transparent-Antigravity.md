User request: "make them less transparent"

### 0. Date and time
2026-06-25 at 21:48 (local time)

### 1. User Request
Make the floating canvas UI elements less transparent (more solid/opaque).

### 2. Objective Reconstruction
Adjust the background opacity of all floating canvas panels (Layers panel, Style panel, Toolbar, Zoom, and Undo/Redo controls) to be less transparent, establishing a highly opaque backdrop to improve contrast and readability.

### 3. Strategic Reasoning
Previously, the Layers and Style panels used `var(--sidebar)`, which was not defined in the CSS custom properties, leading to complete transparency (only the blur effect was visible). The floating toolbar and controls used 95% opacity. By switching the Layers and Style panels to use `color-mix` with `var(--sys-color)` at 98% opacity, and upgrading the other floating components from `bg-sidebar/95` to `bg-sidebar/98`, the elements are now much more solid while retaining a subtle premium glassmorphism finish.

### 4. Detailed Blueprint
- `CanvasLayersPanel.tsx`: Replace `background: 'var(--sidebar)'` with `background: 'color-mix(in srgb, var(--sys-color) 98%, transparent)'`.
- `CanvasStylePanel.tsx`: Replace `background: 'var(--sidebar)'` with `background: 'color-mix(in srgb, var(--sys-color) 98%, transparent)'`.
- `CanvasToolbar.tsx`: Replace `bg-sidebar/95` with `bg-sidebar/98`.
- `CanvasPage.tsx`: Replace `bg-sidebar/95` with `bg-sidebar/98` on the zoom and undo/redo wrappers.

### 5. Operational Trace
1. Updated `CanvasLayersPanel.tsx` line 108 background style definition.
2. Updated `CanvasStylePanel.tsx` line 283 background style definition.
3. Updated `CanvasToolbar.tsx` line 143 background opacity class.
4. Updated `CanvasPage.tsx` lines 970 and 1000 background opacity classes.

### 6. Status Assessment
- All floating panels (Layers, Style, Toolbar, and Controls) now have a consistent 98% opacity background.
- This resolves the issue where panels were completely transparent and makes all panels consistently solid and readable.

*Agent used: `engineering-frontend-developer`*
