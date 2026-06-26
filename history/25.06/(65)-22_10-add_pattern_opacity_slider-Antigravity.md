User request: "also add pattern opacity box under if patternt is selected"

### 0. Date and time
2026-06-25 at 22:10 (local time)

### 1. User Request
Add a pattern opacity slider under the pattern picker in the canvas style panel when a pattern is active (Grid or Dots).

### 2. Objective Reconstruction
- Introduce a pattern opacity state (`canvasPatternOpacity`) that dynamically sets the opacity of canvas background grid lines and dots.
- Implement an interactive slider control underneath the pattern picker segment controls, styled to match existing opacity row elements, appearing only when the pattern type is not 'none'.

### 3. Strategic Reasoning
- Allowing manual control over pattern opacity lets users fine-tune workspace visibility based on their canvas background color.
- Applying the opacity via CSS `color-mix` with `var(--bone-100)` preserves theme compatibility for both dark and light modes.

### 4. Detailed Blueprint
- **`CanvasPage.tsx`**:
  - Add `canvasPatternOpacity` state (defaulting to 6% / `0.06`).
  - Pass the state and setter callback to `CanvasStylePanel`.
  - Update `backgroundImage` styles to mix pattern lines/dots color using `canvasPatternOpacity`.
- **`CanvasStylePanel.tsx`**:
  - Update `Props` interface and destructured signature parameters with pattern opacity variables.
  - Insert a `PropRow` containing a range input element and percentage labels below the pattern picker, wrapped in a `canvasPattern !== 'none'` check.

### 5. Operational Trace
1. Declared `canvasPatternOpacity` state in `CanvasPage.tsx`.
2. Updated canvas wrapper `backgroundImage` inline styles to color-mix canvas pattern using dynamic opacity.
3. Passed new props to `CanvasStylePanel` in `CanvasPage.tsx`.
4. Updated `Props` interface and destructuring arguments list in `CanvasStylePanel.tsx`.
5. Created pattern opacity row in `CanvasStylePanel.tsx` using native range inputs styled to match the page theme.

### 6. Status Assessment
- Pattern opacity slider has been successfully integrated and is fully functional.

*Agent used: `engineering-frontend-developer`*
