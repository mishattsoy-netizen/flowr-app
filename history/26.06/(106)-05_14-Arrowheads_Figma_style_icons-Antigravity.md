User request: "every endpoint should have icon in popup and box similar to figma"

### 0. Date and time of the request
Date: 26.06.2026
Time: 05:14

### 1. User request
"every endpoint should have icon in popup and box similar to figma"

### 2. Objective Reconstruction
Add Figma-like endpoint SVG icons to both the `ArrowheadDropdown` trigger button (box) and the options item list inside the dropdown popup, aligning the icons side-by-side with their respective text labels.

### 3. Strategic Reasoning
- Following Figma's standard design patterns for vector paths/arrows, visual previews of the arrowhead endpoints (None, Triangle, Filled, Circle, Bar, Diamond) are rendered as left-pointing icons next to the labels.
- This enhances scanability and gives users an immediate visual representation of their line caps.

### 4. Detailed Blueprint
- Modify `src/components/canvas/CanvasStylePanel.tsx`:
  - Define `ARROWHEAD_ICONS` mapping containing SVG structures pointing left for each type.
  - Update `ArrowheadDropdown` to render the active endpoint's icon next to the selected option inside the button box.
  - Update popup map buttons to display icons inline with option labels.

### 5. Operational Trace
- Added the `ARROWHEAD_ICONS` dictionary.
- Rewrote the button template and loop templates in `ArrowheadDropdown` inside `src/components/canvas/CanvasStylePanel.tsx`.
- Ran compiler checks (`npx tsc --noEmit`) which compiled clean.

### 6. Status Assessment
- Successfully added icons to the Arrowheads dropdown trigger and dropdown items.
- Compilation check passed without warnings.
