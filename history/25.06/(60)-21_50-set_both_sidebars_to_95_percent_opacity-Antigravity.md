User request: "95%"

### 0. Date and time
2026-06-25 at 21:50 (local time)

### 1. User Request
Set both floating sidepanel backgrounds to 95% opacity.

### 2. Objective Reconstruction
Modify the background opacity of the Layers panel (left sidebar) and Style panel (right sidebar) from 90% to 95% to make the backgrounds slightly less transparent and more solid.

### 3. Strategic Reasoning
Increasing the background opacity from 90% to 95% makes the text and controls on the floating side panels easier to read against complex canvas backgrounds, while maintaining the premium glassmorphism blur look.

### 4. Detailed Blueprint
- `CanvasLayersPanel.tsx`: Update inline style background to use `95%` in `color-mix`.
- `CanvasStylePanel.tsx`: Update inline style background to use `95%` in `color-mix`.

### 5. Operational Trace
1. Updated `CanvasLayersPanel.tsx` line 108 background color-mix from `90%` to `95%`.
2. Updated `CanvasStylePanel.tsx` line 283 background color-mix from `90%` to `95%`.

### 6. Status Assessment
- Both the left Layers panel and the right Style panel backgrounds are now set to 95% opacity.

*Agent used: `engineering-frontend-developer`*
