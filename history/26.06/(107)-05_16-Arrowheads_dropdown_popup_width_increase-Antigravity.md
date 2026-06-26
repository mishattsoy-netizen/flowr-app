User request: "increase popup width they dont fix"

### 0. Date and time of the request
Date: 26.06.2026
Time: 05:16

### 1. User request
"increase popup width they dont fix"

### 2. Objective Reconstruction
Increase the width of the `ArrowheadDropdown` popup menu list to a fixed `120px` to prevent text, icon, and checkmark clipping, and dynamically offset the left coordinate if the dropdown is right-aligned (`align === 'right'`).

### 3. Strategic Reasoning
- Because the three input columns (Size, Start, End) in the style panel are narrow (approx. 70px wide), matching the popup width directly to the trigger button causes text wrapping.
- Setting a fixed popup width of `120px` provides enough space for items.
- Adding right-alignment math (`left = left + width - 120`) ensures the right-aligned End dropdown aligns with the button's right border, keeping the UI tidy.

### 4. Detailed Blueprint
- Modify `src/components/canvas/CanvasStylePanel.tsx`:
  - Locate the `createPortal` element in `ArrowheadDropdown`.
  - Replace the style object to use a fixed width of `120` and compute `left` dynamically based on the `align === 'right'` layout property.

### 5. Operational Trace
- Updated `ArrowheadDropdown` rendering code inside `src/components/canvas/CanvasStylePanel.tsx`.
- Confirmed compilation using `npx tsc --noEmit`.

### 6. Status Assessment
- Successfully set the dropdown menu width to 120px and added right-alignment offsets.
- Compilation passed cleanly.
