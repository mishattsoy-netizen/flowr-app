User request: "nope, like this" [screenshot of sidebar opacity input box]

### 0. Date and time
2026-06-25 at 22:11 (local time)

### 1. User Request
Replace the pattern opacity range slider with the standardized `SidebarInput` style, including an opacity circle icon, text input field, and drag-scrub support.

### 2. Objective Reconstruction
Refactor the canvas pattern opacity control inside the style sidebar to match the premium `SidebarInput` design layout shown in the user's screenshot.

### 3. Strategic Reasoning
Replacing the slider with the `SidebarInput` layout ensures visual consistency with the rest of the style panel inputs (like dimensions, coordinates, rotation, shape opacity, etc.) and provides precise input control alongside fluid scrub adjustments.

### 4. Detailed Blueprint
- `CanvasStylePanel.tsx`: Replace the range slider layout inside the `canvasPattern !== 'none'` conditional block with `SidebarInput` featuring the half-filled circle SVG prefix, drag-scrubbable properties, and integer percentage parsing.

### 5. Operational Trace
1. Updated `CanvasStylePanel.tsx` line 727 to render a standard `SidebarInput` for pattern opacity instead of the slider.

### 6. Status Assessment
- Pattern opacity control now matches the user's design reference exactly.

*Agent used: `engineering-frontend-developer`*
