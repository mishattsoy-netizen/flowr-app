User request: "looks horrible compared to figma"

### 0. Date and time
Date: 29.06.2026
Time: 23:19

### 1. User request
User request: "looks horrible compared to figma" — redesign the Auto Layout and Frame styling panel elements to match Figma's visual system exactly.

### 2. Objective Reconstruction
Redesign the styling widgets in `CanvasStylePanel.tsx`:
1. Re-implemented the `FlowDirectionPicker` as a flat, single-track option list inside a dark themed track (`bg-[#1e1e1e]`, `border-[#2c2c2c]`) with custom Figma SVGs.
2. Created a premium 3x3 `AlignmentPicker` grid box that looks like Figma's dark theme panel, highlighting the active selection in bright brand blue with standard dot layout.
3. Redesigned the geometry rows (Width, Height, Gap, Padding) to group in distinct visual cells with small text labels (`W`, `H`) using thin borders and crisp alignment.
4. Cleaned up spacing and button tags like "+ Auto Layout" or "Remove" to be clean textual links instead of bulky buttons.

### 3. Strategic Reasoning
To match Figma's premium feel, we moved away from generic browser/tailored inputs with bulky borders. Instead, we used a dark, containerized color scheme (`#1e1e1e`/`#2c2c2c`), exact Figma layout icons, and tighter grid layouts.

### 4. Detailed Blueprint
Modified: `CanvasStylePanel.tsx`
- `SVG_ICONS`: Replaced all direction picker SVGs with precise Figma replicas.
- `FlowDirectionPicker`: Redesigned container to dark border track.
- `AlignmentPicker`: Formatted as 64x64px grid with 3x3 layout dots and side label.
- `isSingleFrame` layout section: restructured rows, inputs, toggles into segmented layout compartments.

### 5. Operational Trace
- Replaced SVGs inside `SVG_ICONS`.
- Updated `FlowDirectionPicker` background/borders.
- Custom styled `AlignmentPicker` to draw dark layout dots.
- Re-formatted Width/Height input rows with thin mono prefix labels.
- Validated via `tsc --noEmit`.

### 6. Status Assessment
- Completed: Figma style panel revamp done. The direction controls, alignment grids, spacing inputs, and resizing modes match Figma's aesthetics.
