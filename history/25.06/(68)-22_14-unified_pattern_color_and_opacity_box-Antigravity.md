User request: "actually use same color and opacity box in pattern, not just opacity"

### 0. Date and time
2026-06-25 at 22:14 (local time)

### 1. User Request
Replace the standalone pattern opacity input box with the unified "Color and Opacity" box layout (swatch picker, hex value, divider, and opacity text input) for canvas pattern customization.

### 2. Objective Reconstruction
- Add a new `canvasPatternColor` state in the main canvas page component.
- Dynamically style the canvas grid lines and dots backgrounds using this pattern color state.
- In the style sidebar, render a composite Color and Opacity box that controls both the canvas pattern color (with responsive light/dark defaults) and its custom opacity.

### 3. Strategic Reasoning
Unified styling for all color properties (fills, strokes, canvas backgrounds, and pattern grids) aligns with premium designer guidelines. The combined color block looks cleaner, provides complete styling agency over grid colors, and integrates the opacity adjustment right inside the same panel box.

### 4. Detailed Blueprint
- **`CanvasPage.tsx`**:
  - Add `canvasPatternColor` state (defaulting to `'default'`).
  - Pass the state and setter down to `CanvasStylePanel`.
  - Update `backgroundImage` styles to use the customized pattern color (falling back to theme-dependent `var(--bone-100)` when set to `'default'`).
- **`CanvasStylePanel.tsx`**:
  - Update `Props` interface and destructured signature parameters with pattern color variables.
  - Declare a shared `isDark` helper to resolve swatch previews.
  - Replace the standalone opacity `SidebarInput` within the `Canvas Pattern` panel section with the new unified Color & Opacity `PropRow` component.

### 5. Operational Trace
1. Added `canvasPatternColor` state to `CanvasPage.tsx`.
2. Updated container `backgroundImage` styling in `CanvasPage.tsx` lines 713-717 to map `canvasPatternColor`.
3. Passed new props to `CanvasStylePanel` inside `CanvasPage.tsx`.
4. Extended props destructuring in `CanvasStylePanel.tsx`.
5. Added `isDark` checker to `CanvasStylePanel.tsx` line 260.
6. Replaced pattern opacity input block with full Color and Opacity component at line 761 in `CanvasStylePanel.tsx`.

### 6. Status Assessment
- Pattern customizer now features matching Color and Opacity settings.

*Agent used: `engineering-frontend-developer`*
