User request: "for each of this add icons" [screenshot of pattern segmented picker: None, Grid, Dots]

### 0. Date and time
2026-06-25 at 22:12 (local time)

### 1. User Request
Add visual icons to the segmented pattern picker options ("None", "Grid", "Dots").

### 2. Objective Reconstruction
Render inline SVG icons (slashed circle, cross-grid, dot matrix) to the left of the text label for each segmented button in the Canvas Pattern controller section.

### 3. Strategic Reasoning
Adding micro-icons to text labels makes the options visually distinct and easier to read, matching general pattern controls in standard design systems.

### 4. Detailed Blueprint
- `CanvasStylePanel.tsx`:
  - Define `PATTERN_ICONS` constant mapping each type ('none', 'grid', 'dots') to its custom inline SVG icon.
  - Update the loop mapping each option to render the corresponding icon, and align using `flex items-center justify-center gap-1`.

### 5. Operational Trace
1. Inserted `PATTERN_ICONS` mapping structure in `CanvasStylePanel.tsx`.
2. Updated button child nodes in the map expression in `CanvasStylePanel.tsx` line 740.

### 6. Status Assessment
- Icons are now visible alongside pattern picker buttons.

*Agent used: `engineering-frontend-developer`*
