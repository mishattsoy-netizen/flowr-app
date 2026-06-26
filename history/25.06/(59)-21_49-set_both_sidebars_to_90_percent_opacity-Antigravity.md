User request: "make both panelwith 90%"

### 0. Date and time
2026-06-25 at 21:49 (local time)

### 1. User Request
Set both the left Layers panel and right Style panel backgrounds to 90% opacity.

### 2. Objective Reconstruction
Adjust the background transparency of the two main sidebar floating panels (Layers panel and Style panel) to use a 90% color-mix with the theme's sidebar background color, allowing a bit more canvas detail to filter through the blur backdrop.

### 3. Strategic Reasoning
The user wanted the floating sidebars to have slightly more transparency than the almost opaque 98% setting configured previously. Bumping them to 90% opacity strikes a perfect balance of readable panel content with the glassmorphism backdrop-blur effect.

### 4. Detailed Blueprint
- `CanvasLayersPanel.tsx`: Update inline style background property to use `90%` opacity in `color-mix`.
- `CanvasStylePanel.tsx`: Update inline style background property to use `90%` opacity in `color-mix`.

### 5. Operational Trace
1. Updated `CanvasLayersPanel.tsx` line 108 background color-mix from `98%` to `90%`.
2. Updated `CanvasStylePanel.tsx` line 283 background color-mix from `98%` to `90%`.

### 6. Status Assessment
- Both the left Layers panel and the right Style panel now have their background set to 90% opacity.

*Agent used: `engineering-frontend-developer`*
