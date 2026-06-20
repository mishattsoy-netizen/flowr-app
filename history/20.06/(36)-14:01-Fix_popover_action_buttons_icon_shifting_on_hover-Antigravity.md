# History Report

### 0. Date and Time
2026-06-20 14:01

### 1. User Request
User request: "all 3 icons started shifting on button hover"

### 2. Objective Reconstruction
Prevent the Copy, Open, and Delete icons (SVGs) in the popover toolbar from shifting/jumping by 0.5px - 1px vertically when hovering over the buttons.

### 3. Strategic Reasoning
- **Why it occurred**: The buttons had the `transition-all` utility class, which transitions all style properties including `opacity` (animating from `opacity-35` to `opacity-100`). During an active opacity transition, browsers switch the rendering of layout children (such as SVGs) to a GPU composited layer, altering subpixel antialiasing/metrics temporarily. Once the transition finishes, the layers collapse back to normal rendering, causing a visible vertical shift/wobble.
- **Approach**: 
  - Change the transition utility on the buttons from `transition-all` to `transition-colors`.
  - This transitions background, text, and border colors smoothly, but applies the opacity change instantly, avoiding the layer compositing animation state and completely eliminating subpixel rendering shift.

### 4. Detailed Blueprint
- **Files Involved**:
  - `src/components/editor/BlockRenderer.tsx`
- **Key Logic**:
  - Change class strings on the Copy, Open, and Delete buttons in Section 3 from `transition-all` to `transition-colors`.

### 5. Operational Trace
- Replaced `transition-all` with `transition-colors` inside `src/components/editor/BlockRenderer.tsx` on the Copy, Open, and Delete buttons.

### 6. Status Assessment
- **Status**: Completed.
- **Fixed**: Icons inside popover action buttons no longer wobble or shift on hover.
- **Remaining**: None.
